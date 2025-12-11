import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { IoArrowBackCircle } from "react-icons/io5";
import { BsFillPrinterFill } from "react-icons/bs";
import { FaSync } from "react-icons/fa";
import '../PaymentSchedule/PaymentSchedule.css';

axios.defaults.withCredentials = false;

const Payments = () => {
  const [accountSummaries, setAccountSummaries] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accountDetails, setAccountDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loanTypeFilter, setLoanTypeFilter] = useState('Regular');
  const [loanDetails, setLoanDetails] = useState({
    Regular: null,
    Emergency: null
  }); 
  const [openYears, setOpenYears] = useState({});
  const [openORGroups, setOpenORGroups] = useState({});
  const [availableLoanTypes, setAvailableLoanTypes] = useState({ Regular: false, Emergency: false });
  const [paymentEvents, setPaymentEvents] = useState([]);
  const [archivedPayments, setArchivedPayments] = useState([]);
  const [showAdvanceOnly, setShowAdvanceOnly] = useState(false);

  // =============================
  // Payment Event Form State (duplicate simplified for Payments view)
  // =============================
  const [eventMode, setEventMode] = useState('regular');
  const [eventAmountRegular, setEventAmountRegular] = useState('');
  const [eventAmountAhead, setEventAmountAhead] = useState('');
  const [eventAmountCurtail, setEventAmountCurtail] = useState('');
  const [eventCurtailMethod, setEventCurtailMethod] = useState('shorten');
  const [eventScheduleId, setEventScheduleId] = useState(null);
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventResult, setEventResult] = useState(null);

  const computeEventTotal = () => {
    const r = parseFloat(eventAmountRegular || '0') || 0;
    const a = parseFloat(eventAmountAhead || '0') || 0;
    const c = parseFloat(eventAmountCurtail || '0') || 0;
    return (r + a + c).toFixed(2);
  };

  const resetEventForm = () => {
    setEventMode('regular');
    setEventAmountRegular('');
    setEventAmountAhead('');
    setEventAmountCurtail('');
    setEventCurtailMethod('shorten');
    setEventScheduleId(null);
    setEventResult(null);
  };

  const unpaidSchedules = schedules.filter(s => s.loan_type === loanTypeFilter && !s.is_paid);

  const validateEvent = () => {
    const total = parseFloat(computeEventTotal());
    if (total <= 0) return 'Total must be > 0';
    if (['regular','hybrid'].includes(eventMode) && !eventScheduleId) return 'Select schedule for regular portion';
    if (eventMode === 'regular' && (!eventAmountRegular || parseFloat(eventAmountRegular) <= 0)) return 'Enter regular amount';
    if (eventMode === 'pay_ahead' && (!eventAmountAhead || parseFloat(eventAmountAhead) <= 0)) return 'Enter pay-ahead amount';
    if (eventMode === 'curtail' && (!eventAmountCurtail || parseFloat(eventAmountCurtail) <= 0)) return 'Enter curtailment amount';
    if (eventMode === 'hybrid') {
      const any = [eventAmountRegular,eventAmountAhead,eventAmountCurtail].some(v => parseFloat(v||'0') > 0);
      if (!any) return 'Provide at least one allocation';
    }
    return null;
  };

  const submitPaymentEvent = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const err = validateEvent();
    if (err) { alert(err); return; }
    const currentLoan = loanDetails[loanTypeFilter];
    if (!currentLoan || !currentLoan.control_number) { alert('Loan details not loaded'); return; }
    setEventSubmitting(true);
    try {
      const payload = {
        schedule_id: eventScheduleId,
        mode: eventMode,
        curtailment_method: eventCurtailMethod,
        amount_regular: eventAmountRegular || '0',
        amount_pay_ahead: eventAmountAhead || '0',
        amount_curtailment: eventAmountCurtail || '0',
        notes: 'Admin composite payment via Payments view'
      };
      const url = `${process.env.REACT_APP_API_URL}/loans/${currentLoan.control_number}/payment-event/`;
      const resp = await axios.post(url, payload, { headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' } });
      setEventResult(resp.data.payment_event);
      await fetchPaymentSchedules(selectedAccount, loanTypeFilter);
      resetEventForm();
    } catch(e) {
      console.error('PaymentEvent submit error', e.response?.data || e.message);
      alert(e.response?.data?.error || 'Payment event failed');
    } finally {
      setEventSubmitting(false);
    }
  };

  const toggleYear = (loanType, year) => {
    setOpenYears((prev) => ({ 
      ...prev, 
      [`${loanType}-${year}`]: !prev[`${loanType}-${year}`] 
    }));
  };

  const toggleORGroup = (loanType, year, orNumber) => {
    setOpenORGroups((prev) => ({
      ...prev,
      [`${loanType}-${year}-${orNumber}`]: !prev[`${loanType}-${year}-${orNumber}`]
    }));
  };

  const formatNumber = (number) => {
    if (number == null || number === '') return 'N/A';
    const n = typeof number === 'string' ? Number(number) : number;
    if (Number.isNaN(n)) return 'N/A';
    const isWhole = Number.isInteger(n);
    return isWhole
      ? n.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Parse year number from numeric or textual forms like "Year 3", "3rd"
  const parseYearNumber = (value) => {
    if (value == null) return 1;
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    const s = String(value).toLowerCase();
    const m = s.match(/\d+/);
    return m ? Number(m[0]) : 1;
  };

  // Format ISO dates (YYYY-MM-DD) as local dates without timezone shift
  const formatISODate = (iso) => {
    if (!iso) return '—';
    try {
      const parts = String(iso).split('-').map(Number);
      const y = parts[0], m = (parts[1] || 1) - 1, d = parts[2] || 1;
      const dt = new Date(y, m, d);
      if (isNaN(dt.getTime())) return '—';
      return dt.toLocaleDateString();
    } catch (e) {
      return '—';
    }
  };

  const validateToken = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setError("Missing authentication token. Please log in again.");
      return null;
    }
    return token;
  };

  const fetchAccountSummaries = async () => {
    setLoading(true);
    setError('');

    const token = validateToken();
    if (!token) return;

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/payment-schedules/summaries/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      const summariesWithNames = await Promise.all(
        response.data.map(async (summary) => {
          const memberResponse = await axios.get(
            `${process.env.REACT_APP_API_URL}/members/?account_number=${summary.account_number}`,
            { withCredentials: true }
          );

          const member = memberResponse.data[0];
          return {
            ...summary,
            account_holder: member ? `${member.first_name} ${member.middle_name} ${member.last_name}` : 'Unknown',
            total_balance: summary.total_balance || 0,
          };
        })
      );
      setAccountSummaries(summariesWithNames);

    } catch (err) {
      console.error('Error fetching account summaries:', err);
      if (err.response?.status === 401) {
        setError(
          <div className="session-expired-overlay">
            <div className="session-expired-modal">
              <p className="session-expired-message">
                You have been away for quite some time, so we logged you out.<br />
                Please log in again to continue.
              </p>
              <button 
                onClick={() => {
                  localStorage.removeItem('sessionExpired');
                  localStorage.removeItem('accessToken');
                  localStorage.removeItem('userRole');
                  window.location.href = '/';
                }} 
                className="session-expired-button"
              >
                Log In
              </button>
            </div>
          </div>
        );
        return;
      }
      setError('Failed to fetch account summaries.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: Modified to accept loanType parameter and re-fetch on loan type change
  const fetchPaymentSchedules = async (accountNumber, requestedLoanType = null) => {
    setLoading(true);
    setError('');

    const token = validateToken();
    if (!token) return;

    try {
      console.log(`\n🔍 Fetching paid schedules for account ${accountNumber}`);
      
      // ✅ Check which loan types have schedules (only on first load)
      if (!requestedLoanType) {
        const [regularCheck, emergencyCheck] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}&loan_type=Regular`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: [] })),
          axios.get(`${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}&loan_type=Emergency`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: [] }))
        ]);

        const hasRegular = regularCheck.data && regularCheck.data.length > 0;
        const hasEmergency = emergencyCheck.data && emergencyCheck.data.length > 0;

        setAvailableLoanTypes({ Regular: hasRegular, Emergency: hasEmergency });

        // Determine which type to load first
        requestedLoanType = 'Regular';
        if (hasEmergency && !hasRegular) {
          requestedLoanType = 'Emergency';
        }
      }
      
      setLoanTypeFilter(requestedLoanType);

      // ✅ Fetch schedules for the requested type
      const [scheduleResponse, memberResponse] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}&loan_type=${requestedLoanType}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${process.env.REACT_APP_API_URL}/members/?account_number=${accountNumber}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const paidSchedules = scheduleResponse.data.filter((schedule) => {
        const statusNorm = String(schedule.status || '').trim().toLowerCase();
        const isPaidFlag = schedule.is_paid === true
          || statusNorm === 'paid'
          || statusNorm === 'fully paid'
          || statusNorm === 'credited'
          || statusNorm === 'credit';
        const hasOr = Boolean(
          schedule.OR ||
          schedule.or_number ||
          schedule.orNumber ||
          schedule.or_num ||
          schedule.receipt_number ||
          schedule.receipt_no ||
          schedule.official_receipt ||
          schedule.or_id
        );
        const hasDatePaid = Boolean(schedule.date_paid);
        return isPaidFlag || hasOr || hasDatePaid;
      });
      
      console.log(`📋 Found ${paidSchedules.length} paid schedules for ${requestedLoanType} loan`);

      const schedulesWithOrNumbers = paidSchedules.map((schedule) => {
        const orNumber = schedule.OR ||
          schedule.or_number ||
          schedule.orNumber ||
          schedule.or_num ||
          schedule.receipt_number ||
          schedule.receipt_no ||
          schedule.official_receipt ||
          schedule.or_id ||
          'N/A';

        return {
          ...schedule,
          or_number: orNumber,
        };
      });

      setSchedules(schedulesWithOrNumbers);
      setSelectedAccount(accountNumber);
      setAccountDetails(memberResponse.data[0]);

      // ✅ Group schedules by loan and loan type
      const schedulesByLoan = paidSchedules.reduce((acc, schedule) => {
        const loanId = schedule.loan || schedule.loan_control_number;
        const loanType = schedule.loan_type;
        
        if (!acc[loanType]) {
          acc[loanType] = {};
        }
        
        if (!acc[loanType][loanId]) {
          acc[loanType][loanId] = [];
        }
        
        acc[loanType][loanId].push(schedule);
        return acc;
      }, {});
      
      console.log(`📊 Schedules grouped by loan:`, {
        Regular: Object.keys(schedulesByLoan.Regular || {}).length,
        Emergency: Object.keys(schedulesByLoan.Emergency || {}).length
      });

      const newLoanDetails = {
        Regular: null,
        Emergency: null
      };

      // ✅ For the requested loan type, get the MOST RECENT loan (or most paid schedules)
      if (schedulesByLoan[requestedLoanType]) {
        const loanIds = Object.keys(schedulesByLoan[requestedLoanType]);
        
        if (loanIds.length > 0) {
          // If multiple loans, pick the one with most paid schedules
          let targetLoanId = loanIds[0];
          let maxSchedules = schedulesByLoan[requestedLoanType][targetLoanId].length;
          
          if (loanIds.length > 1) {
            console.warn(`⚠️ Member has ${loanIds.length} ${requestedLoanType} loans`);
            
            for (const loanId of loanIds) {
              const count = schedulesByLoan[requestedLoanType][loanId].length;
              if (count > maxSchedules) {
                targetLoanId = loanId;
                maxSchedules = count;
              }
            }
            
            console.log(`   Selected loan ${targetLoanId} (${maxSchedules} paid schedules)`);
          }
          
          // Fetch details for the selected loan
          await new Promise(resolve => setTimeout(resolve, 500));

          try {
            const loanDetailResponse = await axios.get(
              `${process.env.REACT_APP_API_URL}/loans/${targetLoanId}/detailed_loan_info/`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            
            const controlNumber = loanDetailResponse.data.control_number;
            
            console.log(`✅ ${requestedLoanType} Loan ${controlNumber}: Recalcs=${loanDetailResponse.data.yearly_recalculations?.length || 0}`);
            
            // ✅ Filter recalculations
            if (loanDetailResponse.data.yearly_recalculations) {
              const originalCount = loanDetailResponse.data.yearly_recalculations.length;
              
              loanDetailResponse.data.yearly_recalculations = 
                loanDetailResponse.data.yearly_recalculations.filter(
                  r => r.loan_control_number === controlNumber
                );
              
              const filteredCount = loanDetailResponse.data.yearly_recalculations.length;
              
              if (originalCount !== filteredCount) {
                console.error(`❌ Removed ${originalCount - filteredCount} incorrect recalculations`);
              }
            }
            
            newLoanDetails[requestedLoanType] = loanDetailResponse.data;
          } catch (loanErr) {
            console.error(`❌ Error fetching ${requestedLoanType} loan ${targetLoanId}:`, loanErr);
          }
        }
      }
      
      console.log(`✅ Final loan details:`, {
        Regular: newLoanDetails.Regular?.control_number || 'None',
        Emergency: newLoanDetails.Emergency?.control_number || 'None'
      });
      
      // 🔄 Fallback: if no paid schedules yielded loan details, fetch active loan by type
      try {
        const currentType = requestedLoanType;
        if (!newLoanDetails[currentType]) {
          const loansResp = await axios.get(`${process.env.REACT_APP_API_URL}/loans/`, { headers: { Authorization: `Bearer ${token}` } });
          const allLoans = Array.isArray(loansResp.data) ? loansResp.data : [];
          const typeLoans = allLoans
            .filter(l => String(l.account || l.account_number || '').toString() === String(accountNumber))
            .filter(l => String(l.loan_type).toLowerCase() === String(currentType).toLowerCase())
            .filter(l => String(l.status || '').toLowerCase() === 'ongoing')
            .sort((a,b) => new Date(b.loan_date) - new Date(a.loan_date));
          if (typeLoans.length > 0) {
            // Fetch detailed info for this active loan to populate recalcs/events correctly
            try {
              const loanDetailResponse = await axios.get(
                `${process.env.REACT_APP_API_URL}/loans/${typeLoans[0].control_number}/detailed_loan_info/`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              newLoanDetails[currentType] = loanDetailResponse.data;
            } catch (e) {
              // As a minimal fallback, keep basic loan object
              newLoanDetails[currentType] = typeLoans[0];
            }
          }
        }
      } catch (fallbackErr) {
        console.warn('Fallback loan fetch failed', fallbackErr.response?.data || fallbackErr.message);
      }

      setLoanDetails(newLoanDetails);

      // Fetch payment events for the selected loan type, if loan details exist
      try {
        const currentLoan = newLoanDetails[requestedLoanType];
        if (currentLoan && currentLoan.control_number) {
          const evResp = await axios.get(
            `${process.env.REACT_APP_API_URL}/loans/${currentLoan.control_number}/payment-event/`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const events = evResp.data?.events || [];
          console.log('📦 Payment events fetched:', events);
          setPaymentEvents(events);
        } else {
          setPaymentEvents([]);
        }
      } catch (e) {
        console.warn('Payments: failed to fetch payment events', e.response?.data || e.message);
        setPaymentEvents([]);
      }

      // Fetch archived payments and filter to current account + loan type
      try {
        const currCn = newLoanDetails[requestedLoanType]?.control_number;
        const archResp = await axios.get(
          `${process.env.REACT_APP_API_URL}/archived-payment-records/?account_number=${accountNumber}&loan_type=${requestedLoanType}${currCn ? `&loan_control_number=${currCn}` : ''}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const filteredArchived = archResp.data || [];
        setArchivedPayments(filteredArchived);
        console.log('📦 Archived payments fetched:', filteredArchived);
      } catch (archErr) {
        console.warn('Payments: failed to fetch archived payments', archErr.response?.data || archErr.message);
        setArchivedPayments([]);
      }

    } catch (err) {
      console.error('Error fetching schedules or account details:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
        return;
      }
      setError('Failed to fetch payment schedules or account details.');
    } finally {
      setLoading(false);
    }
  };

  const PaymentEventsSummary = () => {
    if (!paymentEvents || paymentEvents.length === 0) return null;
    const ahead = paymentEvents.filter(e => e.mode === 'pay_ahead' || (e.mode === 'hybrid' && parseFloat(e.amount_pay_ahead||'0')>0));
    if (ahead.length === 0) return null;
    const totalAhead = ahead.reduce((sum,e)=> sum + (parseFloat(e.amount_pay_ahead||'0') || 0), 0);
    return (
      <div className="advance-section" style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
          Advance Payments (Events)
          <span style={{
            marginLeft: '10px', background: '#e6f4ea', color: '#1e7e34', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 700
          }}>
            {ahead.length} entr{ahead.length === 1 ? 'y' : 'ies'}
          </span>
          <span style={{
            marginLeft: '10px', background: '#f0f7ff', color: '#0d6efd', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 700
          }}>
            Total ₱ {formatNumber(totalAhead)}
          </span>
        </h3>
        <div className="year-table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>OR Number</th>
                <th>Advance Amount</th>
                <th>Covered Schedules</th>
                <th>Date</th>
                <th>Mode</th>
              </tr>
            </thead>
          </table>
          <div className="payment-tbody-scroll">
            <table className="payment-table"><tbody>
              {ahead.slice().reverse().map(ev => (
                <tr key={`pev-${ev.id}`}>
                  <td>#{ev.id}</td>
                  <td>{ev.or_number || 'N/A'}</td>
                  <td style={{ fontWeight:'700', color:'#1e7e34' }}>₱ {formatNumber(parseFloat(ev.amount_pay_ahead||'0')||0)}</td>
                  <td>{Array.isArray(ev.covered_schedule_ids) ? ev.covered_schedule_ids.length : 0}</td>
                  <td>{ev.created_at ? formatISODate((ev.created_at||'').slice(0,10)) : '—'}</td>
                  <td>{ev.mode}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      </div>
    );
  };

  const ArchivedPaymentsSummary = () => {
    if (!archivedPayments || archivedPayments.length === 0) return null;
    // Strictly scope archives to current loan type and current loan control number if available
    const currentLoan = loanDetails[loanTypeFilter];
    const currentCN = currentLoan?.control_number;
    const advOnly = archivedPayments
      .filter(p => (p.payment_type || '').toLowerCase().includes('advance'))
      .filter(p => String(p.loan_type || '').toLowerCase() === String(loanTypeFilter).toLowerCase())
      .filter(p => {
        if (!currentCN) return true; // if we don't have CN yet, keep type-level filter only
        const pcn = p.loan_control_number || p.loan || p.control_number;
        return String(pcn || '') === String(currentCN);
      });
    const totalAdv = advOnly.reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0);
    return (
      <div className="advance-section" style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
         Advance Payments
          <span style={{
            marginLeft: '10px', background: '#e6f4ea', color: '#1e7e34', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 700
          }}>
            {advOnly.length} entr{advOnly.length === 1 ? 'y' : 'ies'}
          </span>
          <span style={{
            marginLeft: '10px', background: '#f0f7ff', color: '#0d6efd', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 700
          }}>
            Total ₱ {formatNumber(totalAdv)}
          </span>
        </h3>
        <div className="year-table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>OR Number</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Type</th>
              </tr>
            </thead>
          </table>
          <div className="payment-tbody-scroll">
            <table className="payment-table"><tbody>
              {advOnly.slice().reverse().map((p) => (
                <tr key={`arch-${p.id}`}>
                  <td>{p.or_number || 'N/A'}</td>
                  <td style={{ fontWeight:'700', color:'#1e7e34' }}>₱ {formatNumber(parseFloat(p.payment_amount)||0)}</td>
                  <td>{p.date_paid ? formatISODate(String(p.date_paid).slice(0,10)) : '—'}</td>
                  <td>{p.payment_type}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      </div>
    );
  };

  const LatestAdvanceBanner = () => {
    if (!paymentEvents || paymentEvents.length === 0) return null;
    const advEvents = paymentEvents.filter(e => e.mode === 'pay_ahead' || (e.mode === 'hybrid' && (parseFloat(e.amount_pay_ahead||'0')||0) > 0));
    if (advEvents.length === 0) return null;
    // Pick most recent by created_at, fallback by id
    const sorted = advEvents.slice().sort((a,b) => {
      const ad = new Date((a.created_at||'').slice(0,10)).getTime() || 0;
      const bd = new Date((b.created_at||'').slice(0,10)).getTime() || 0;
      if (bd !== ad) return bd - ad;
      return (b.id||0) - (a.id||0);
    });
    const ev = sorted[0];
    const amount = parseFloat(ev.amount_pay_ahead||'0')||0;
    const covered = Array.isArray(ev.covered_schedule_ids) ? ev.covered_schedule_ids.length : 0;
    const dateStr = ev.created_at ? formatISODate((ev.created_at||'').slice(0,10)) : '—';
    return (
      <div style={{
        margin: '0 0 16px 0',
        padding: '10px 12px',
        background: '#e6f4ea',
        borderLeft: '4px solid #1e7e34',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <strong style={{ color:'#1e7e34' }}>Latest Advance:</strong>
        <span>₱{formatNumber(amount)}</span>
        <span>OR {ev.or_number || 'N/A'}</span>
        <span>{dateStr}</span>
        {covered > 0 && (<span>Covered {covered} schedules</span>)}
        <span style={{ marginLeft:'auto', fontSize:'12px', color:'#555' }}>Event #{ev.id} • {ev.mode}</span>
      </div>
    );
  };

  const AdvanceMismatchBanner = () => {
    const loanTypeSchedules = filterSchedulesByLoanType();
    const scheduleShowsAdvance = loanTypeSchedules.some(s => (parseFloat(s.advance_pay)||0) > 0 || s.is_covered_by_advance);
    const eventsShowAdvance = Array.isArray(paymentEvents) && paymentEvents.some(e => e.mode === 'pay_ahead' || (e.mode === 'hybrid' && (parseFloat(e.amount_pay_ahead||'0')||0) > 0));
    if (scheduleShowsAdvance && !eventsShowAdvance) {
      return (
        <div style={{
          margin: '0 0 12px 0', padding:'10px 12px', background:'#fff3cd', borderLeft:'4px solid #856404', borderRadius:'6px', color:'#856404'
        }}>
          Advance payments detected on schedules, but no events were returned. Try Refresh Payments. If this persists, the backend may not be recording advance events for reconstruction.
        </div>
      );
    }
    return null;
  };

  const calculatePaidBalance = () => {
    // Base from schedules (regular + advance - under)
    const balance = filterSchedulesByLoanType()
      .reduce((total, schedule) => {
        const statusNorm = String(schedule.status || '').trim().toLowerCase();
        const isPaid = schedule.is_paid === true || statusNorm === 'paid' || statusNorm === 'fully paid' || statusNorm === 'credited' || statusNorm === 'credit' || Boolean(schedule.date_paid) || Boolean(schedule.or_number);
        if (!isPaid) return total;

        const principal = parseFloat(schedule.principal_amount) || 0;
        const interest = parseFloat(schedule.interest_portion) || 0;
        const base = parseFloat(schedule.payment_amount) || (principal + interest);
        const adv = parseFloat(schedule.advance_pay) || 0;
        const under = parseFloat(schedule.under_pay) || 0;
        return total + base + adv - under;
      }, 0);
    // Add archived advances scoped to current loan
    const currentLoan = loanDetails[loanTypeFilter];
    const currentCN = currentLoan?.control_number;
    const archivedAdvances = (archivedPayments || [])
      .filter(p => (p.payment_type || '').toLowerCase().includes('advance'))
      .filter(p => String(p.loan_type || '').toLowerCase() === String(loanTypeFilter).toLowerCase())
      .filter(p => {
        if (!currentCN) return true; // if CN unknown, include type-level advances
        const pcn = p.loan_control_number || p.loan || p.control_number;
        return String(pcn || '') === String(currentCN);
      })
      .reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0);

    return balance + archivedAdvances;
  };

  const filterSchedulesByLoanType = () => {
    return schedules.filter(schedule => schedule.loan_type === loanTypeFilter);
  };

  const filteredSummaries = accountSummaries.filter((summary) => {
    return (
      summary.account_number.toString().includes(searchQuery) ||
      summary.account_holder.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // ✅ FIXED: Re-fetch schedules when loan type changes
  const handleLoanTypeChange = (type) => {
    setLoanTypeFilter(type);
    // Re-fetch schedules for the selected loan type
    if (selectedAccount) {
      fetchPaymentSchedules(selectedAccount, type);
    }
  };

  const handlePrint = () => {
    // Temporarily open all years before printing
    const allYears = {};
    const allORGroups = {};
    const loanTypeSchedules = filterSchedulesByLoanType();
    const grouped = loanTypeSchedules.reduce((acc, schedule) => {
      const year = parseYearNumber(schedule.year_number);
      if (!acc[year]) acc[year] = [];
      acc[year].push(schedule);
      return acc;
    }, {});

    Object.keys(grouped).forEach(year => {
      allYears[`${loanTypeFilter}-${year}`] = true;
      
      // Also open all OR groups
      const yearSchedules = grouped[year];
      const groupedByOR = yearSchedules.reduce((acc, schedule) => {
        const orNum = schedule.or_number || 'N/A';
        if (!acc[orNum]) acc[orNum] = [];
        acc[orNum].push(schedule);
        return acc;
      }, {});
      
      Object.keys(groupedByOR).forEach(orNumber => {
        allORGroups[`${loanTypeFilter}-${year}-${orNumber}`] = true;
      });
    });

    setOpenYears(allYears);
    setOpenORGroups(allORGroups);

    // Wait for state to update, then print
    setTimeout(() => {
      const printWindow = window.open('', '', 'width=800, height=600');
      const content = document.getElementById('print-section').innerHTML;
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Payment History</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .year-group-box { margin-bottom: 30px; page-break-inside: avoid; }
              .year-header { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
              .year-toggle { display: none; }
              .recalculation-container { margin-top: 15px; }
              .recalculation-title { font-size: 16px; margin-bottom: 10px; }
              .print-button, .back-button, .loan-type-button { display: none !important; }
              .action-bar { display: none !important; }
              .or-toggle { display: none !important; }
            </style>
          </head>
          <body>
            ${content}
          </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.print();
    }, 100);
  };

  const PaymentEventForm = () => {
    const currentLoan = loanDetails[loanTypeFilter];
    if (!currentLoan || !currentLoan.control_number) return null;
    return (
      <div className="payment-event-panel">
        <h3>Composite Payment Event</h3>
        <div className="payment-event-row">
          <label>Mode:</label>
          <select value={eventMode} onChange={e=>setEventMode(e.target.value)} disabled={eventSubmitting}>
            <option value="regular">Regular</option>
            <option value="pay_ahead">Pay Ahead</option>
            <option value="curtail">Curtailment</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        {['regular','hybrid'].includes(eventMode) && (
          <div className="payment-event-row">
            <label>Schedule:</label>
            <select value={eventScheduleId||''} onChange={e=>setEventScheduleId(Number(e.target.value))} disabled={eventSubmitting}>
              <option value="">Select unpaid schedule</option>
              {unpaidSchedules.map(s => (
                <option key={s.id} value={s.id}>#{s.id} Due {formatISODate(s.due_date)} ₱{formatNumber(s.payment_amount)}</option>
              ))}
            </select>
          </div>
        )}
        {['regular','hybrid'].includes(eventMode) && (
          <div className="payment-event-row">
            <label>Amount Regular:</label>
            <input type="number" step="0.01" value={eventAmountRegular} onChange={e=>setEventAmountRegular(e.target.value)} disabled={eventSubmitting} />
          </div>
        )}
        {['pay_ahead','hybrid'].includes(eventMode) && (
          <div className="payment-event-row">
            <label>Amount Pay Ahead:</label>
            <input type="number" step="0.01" value={eventAmountAhead} onChange={e=>setEventAmountAhead(e.target.value)} disabled={eventSubmitting} />
          </div>
        )}
        {['curtail','hybrid'].includes(eventMode) && (
          <>
            <div className="payment-event-row">
              <label>Amount Curtail:</label>
              <input type="number" step="0.01" value={eventAmountCurtail} onChange={e=>setEventAmountCurtail(e.target.value)} disabled={eventSubmitting} />
            </div>
            <div className="payment-event-row">
              <label>Curtail Method:</label>
              <select value={eventCurtailMethod} onChange={e=>setEventCurtailMethod(e.target.value)} disabled={eventSubmitting}>
                <option value="shorten">Shorten Term</option>
                <option value="redistribute" disabled>Redistribute (coming)</option>
              </select>
            </div>
          </>
        )}
        <div className="payment-event-summary">Total: ₱{computeEventTotal()}</div>
        <div className="payment-event-actions">
          <button onClick={submitPaymentEvent} disabled={eventSubmitting}>Submit Event</button>
          <button onClick={resetEventForm} disabled={eventSubmitting}>Reset</button>
        </div>
        {eventResult && (
          <div className="payment-event-result">Event #{eventResult.id} Mode {eventResult.mode} Total ₱{eventResult.amount_total}</div>
        )}
      </div>
    );
  };

  const renderYearGroupedTable = (loanType, loanTypeSchedules, loanTypeDetails) => {
    const grouped = loanTypeSchedules.reduce((acc, schedule) => {
      const year = parseYearNumber(schedule.year_number);
      if (!acc[year]) acc[year] = [];
      acc[year].push(schedule);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([year, yearSchedules]) => (
        <div key={`${loanType}-${year}`} className="year-group-box">
          <div
            onClick={() => toggleYear(loanType, year)}
            className="year-header"
          >
            <span className="year-title">Year {year}</span>
            <span className="year-toggle">
              {openYears[`${loanType}-${year}`] ? '▼' : '►'}
            </span>
          </div>

          {openYears[`${loanType}-${year}`] && (
            <div className="year-table-wrapper">
              {(() => {
                const advCount = yearSchedules.filter(s => (parseFloat(s.advance_pay) || 0) > 0).length;
                const underCount = yearSchedules.filter(s => (parseFloat(s.under_pay) || 0) > 0).length;
                if (advCount === 0 && underCount === 0) return null;
                return (
                  <div style={{
                    margin: '0 0 8px 0',
                    fontSize: '12px',
                    color: '#555',
                    background: '#f8f9fa',
                    borderLeft: '4px solid #6f42c1',
                    padding: '6px 10px',
                    borderRadius: '6px'
                  }}>
                    {advCount > 0 ? `${advCount} entr${advCount > 1 ? 'ies' : 'y'} with advance` : ''}
                    {(advCount > 0 && underCount > 0) ? ' • ' : ''}
                    {underCount > 0 ? `${underCount} entr${underCount > 1 ? 'ies' : 'y'} with under payment` : ''}
                  </div>
                );
              })()}
              {!showAdvanceOnly && (
                <>
                  <table className="payment-table">
                    <thead>
                      <tr>
                        <th>Principal</th>
                        <th>Interest</th>
                        <th>Bimonthly Amortization</th>
                        <th>Due Date</th>
                        <th>Date Paid</th>
                        {/* <th>Remaining Balance</th> */}
                        {/* <th>Penalty</th> */}
                        {/* <th>Status</th> */}
                        <th>OR Number</th>
                      </tr>
                    </thead>
                  </table>
                  <div className="payment-tbody-scroll">
                    <table className="payment-table">
                      <tbody>
                        {(() => {
                      // Group schedules by OR number
                      const groupedByOR = yearSchedules.reduce((acc, schedule) => {
                        const orNum = schedule.or_number || 'N/A';
                        if (!acc[orNum]) acc[orNum] = [];
                        acc[orNum].push(schedule);
                        return acc;
                      }, {});

                      // Helper: map payment events by OR for quick lookup (advance/hybrid)
                      const eventsByOR = paymentEvents.reduce((acc, ev) => {
                        const isAdvanceEvent = ev.mode === 'pay_ahead' || (ev.mode === 'hybrid' && (parseFloat(ev.amount_pay_ahead||'0')||0) > 0);
                        const key = ev.or_number || 'N/A';
                        if (!isAdvanceEvent) return acc;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(ev);
                        return acc;
                      }, {});
                      // Helper: map archived advance payments by OR for inline display
                      const archivedByOR = archivedPayments.reduce((acc, p) => {
                        const isAdvance = (p.payment_type || '').toLowerCase().includes('advance');
                        const key = p.or_number || 'N/A';
                        if (!isAdvance) return acc;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(p);
                        return acc;
                      }, {});

                      const rows = [];
                      
                      Object.entries(groupedByOR).forEach(([orNumber, orSchedules]) => {
                        const isOpen = openORGroups[`${loanType}-${year}-${orNumber}`];
                        const hasMultiple = orSchedules.length > 1;
                        const relatedEvents = eventsByOR[orNumber] || [];
                        const coveredCount = relatedEvents.reduce((n, ev) => n + (Array.isArray(ev.covered_schedule_ids) ? ev.covered_schedule_ids.length : 0), 0);
                        const advanceEventSum = relatedEvents.reduce((sum, ev) => sum + (parseFloat(ev.amount_pay_ahead||'0')||0), 0);
                        // Archived advances for same OR
                        const archivedForOR = archivedByOR[orNumber] || [];
                        const archivedAdvanceSum = archivedForOR.reduce((sum, p) => sum + (parseFloat(p.payment_amount)||0), 0);
                        
                        // First row (always shown)
                        const firstSchedule = orSchedules[0];
                        rows.push(
                          <tr key={`${firstSchedule.id}-main`}>
                            <td>₱ {formatNumber(parseFloat(firstSchedule.principal_amount) || 0)}</td>
                            <td>₱ {formatNumber(parseFloat(firstSchedule.interest_portion) || 0)}</td>
                            <td style={{ fontWeight: '600' }}>
                              ₱ {formatNumber((parseFloat(firstSchedule.principal_amount) || 0) + (parseFloat(firstSchedule.interest_portion) || 0))}
                              {((parseFloat(firstSchedule.advance_pay) || 0) > 0 || (parseFloat(firstSchedule.under_pay) || 0) > 0) && (
                                <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                                  {(parseFloat(firstSchedule.advance_pay) || 0) > 0 && (
                                    <span style={{
                                      background: '#e6f4ea',
                                      color: '#1e7e34',
                                      borderRadius: '10px',
                                      padding: '2px 8px',
                                      fontSize: '11px',
                                      fontWeight: 600
                                    }}>
                                      Advance ₱{formatNumber(parseFloat(firstSchedule.advance_pay) || 0)}
                                    </span>
                                  )}
                                  {(parseFloat(firstSchedule.under_pay) || 0) > 0 && (
                                    <span style={{
                                      background: '#fdecea',
                                      color: '#c82333',
                                      borderRadius: '10px',
                                      padding: '2px 8px',
                                      fontSize: '11px',
                                      fontWeight: 600
                                    }}>
                                      Under ₱{formatNumber(parseFloat(firstSchedule.under_pay) || 0)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td>{formatISODate(firstSchedule.due_date)}</td>
                            <td>
                              {firstSchedule.date_paid ? (
                                formatISODate(firstSchedule.date_paid)
                              ) : (
                                <span style={{ color: '#6c757d', fontSize: '12px' }}>Paid (date not recorded)</span>
                              )}
                            </td>
                            {/* <td>₱ {formatNumber((parseFloat(firstSchedule.balance) || 0).toFixed(2))}</td> */}
                            {/* <td>₱ {formatNumber((parseFloat(firstSchedule.penalty) || 0).toFixed(2))}</td> */}
                            {/* <td>
                              <span className={`status-badge status-paid`}>Paid</span>
                            </td> */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {hasMultiple && (
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleORGroup(loanType, year, orNumber);
                                    }}
                                    className="or-toggle"
                                    style={{ cursor: 'pointer', userSelect: 'none', fontSize: '16px', color: '#0b26f7ff', fontWeight: 'bold' }}
                                  >
                                    {isOpen ? '▼' : '►'}
                                  </span>
                                )}
                                <span>{firstSchedule.or_number || 'N/A'}</span>
                                {hasMultiple && (
                                  <span style={{ fontSize: '12px', color: '#000000ff' }}>({orSchedules.length})</span>
                                )}
                                {advanceEventSum > 0 && (
                                  <span style={{
                                    marginLeft: '4px',
                                    background: '#e6f4ea',
                                    color: '#1e7e34',
                                    borderRadius: '12px',
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    fontWeight: 700
                                  }}>
                                    Adv ₱{formatNumber(advanceEventSum)}{coveredCount > 0 ? ` • Covered ${coveredCount}` : ''}
                                  </span>
                                )}
                                {archivedAdvanceSum > 0 && (
                                  <span style={{
                                    marginLeft: '4px',
                                    background: '#f0f7ff',
                                    color: '#0d6efd',
                                    borderRadius: '12px',
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    fontWeight: 700
                                  }}>
                                    Arch ₱{formatNumber(archivedAdvanceSum)}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                        
                        // Additional rows (shown when expanded)
                        if (hasMultiple && isOpen) {
                          orSchedules.slice(1).forEach((schedule, idx) => {
                            rows.push(
                              <tr key={`${schedule.id}-${idx}`} style={{ backgroundColor: '#f9f9f9' }}>
                                <td style={{ paddingLeft: '20px' }}>₱ {formatNumber(parseFloat(schedule.principal_amount) || 0)}</td>
                                <td>₱ {formatNumber(parseFloat(schedule.interest_portion) || 0)}</td>
                                <td style={{ fontWeight: '600' }}>
                                  ₱ {formatNumber((parseFloat(schedule.principal_amount) || 0) + (parseFloat(schedule.interest_portion) || 0))}
                                  {((parseFloat(schedule.advance_pay) || 0) > 0 || (parseFloat(schedule.under_pay) || 0) > 0) && (
                                    <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                                      {(parseFloat(schedule.advance_pay) || 0) > 0 && (
                                        <span style={{
                                          background: '#e6f4ea',
                                          color: '#1e7e34',
                                          borderRadius: '10px',
                                          padding: '2px 8px',
                                          fontSize: '11px',
                                          fontWeight: 600
                                        }}>
                                          Advance ₱{formatNumber(parseFloat(schedule.advance_pay) || 0)}
                                        </span>
                                      )}
                                      {(parseFloat(schedule.under_pay) || 0) > 0 && (
                                        <span style={{
                                          background: '#fdecea',
                                          color: '#c82333',
                                          borderRadius: '10px',
                                          padding: '2px 8px',
                                          fontSize: '11px',
                                          fontWeight: 600
                                        }}>
                                          Under ₱{formatNumber(parseFloat(schedule.under_pay) || 0)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td>{formatISODate(schedule.due_date)}</td>
                                <td>
                                  {schedule.date_paid ? (
                                    <div>
                                      {formatISODate(schedule.date_paid)}
                                      {/* ✅ ADD THIS BLOCK - Show payment type indicator */}
                                      {(() => {
                                        const isAdvance = schedule.is_covered_by_advance || 
                                                          schedule.advance_event_id || 
                                                          (parseFloat(schedule.advance_pay) || 0) > 0;
                                        const paymentType = isAdvance ? 'Advance Payment' : 'Regular Payment';
                                        
                                        if (isAdvance) {
                                          return (
                                            <div style={{ marginTop: '4px' }}>
                                              <span style={{
                                                background: '#e6f4ea',
                                                color: '#1e7e34',
                                                borderRadius: '10px',
                                                padding: '2px 8px',
                                                fontSize: '11px',
                                                fontWeight: 600
                                              }}>
                                                {paymentType}
                                              </span>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  ) : (
                                    schedule.is_paid ? (
                                      <span style={{ color: '#6c757d', fontSize: '12px' }}>
                                        Paid (date not recorded)
                                      </span>
                                    ) : '—'
                                  )}
                                </td>
                                {/* <td>
                                  {schedule.date_paid ? (
                                    formatISODate(schedule.date_paid)
                                  ) : (
                                    <span style={{ color: '#6c757d', fontSize: '12px' }}>Paid (date not recorded)</span>
                                  )}
                                </td> */}
                                {/* <td><span className={`status-badge status-paid`}>Paid</span></td> */}
                                <td style={{ paddingLeft: '30px' }}>{schedule.or_number || 'N/A'}</td>
                              </tr>
                            );
                          });
                        }
                      });
                      
                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {loanTypeDetails &&
                loanTypeDetails.yearly_recalculations &&
                loanTypeDetails.yearly_recalculations.length > 0 &&
                (() => {
                  const nextYear = parseInt(year) + 1;
                  const recal = loanTypeDetails.yearly_recalculations.find(r => r.year === nextYear);

                  if (recal) {
                    const isPaid = !!recal.fees_paid;
                    return (
                      <div key={recal.year} className="recalculation-container">
                        <h4 className="recalculation-title">Year {recal.year} Recalculation</h4>
                        <table className="recalculation-table">
                          <thead>
                            <tr>
                              <th>Service Fee</th>
                              <th>Interest</th>
                              <th>Admin Cost</th>
                              <th>CISP</th>
                              <th>Total Fees Due</th>
                              <th>Date Paid</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>₱ {formatNumber(recal.service_fee)}</td>
                              <td>₱ {formatNumber(recal.interest_amount)}</td>
                              <td>₱ {formatNumber(recal.admincost)}</td>
                              <td>₱ {formatNumber(recal.cisp)}</td>
                              <td style={{ fontWeight: '700', color: isPaid ? '#1e7e34' : '#d32f2f' }}>₱ {formatNumber(recal.total_fees_due)}</td>
                              <td>{formatISODate((recal.fees_paid_date || recal.date_paid || '') && String(recal.fees_paid_date || recal.date_paid).slice(0,10)) || '—'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  }
                  return null;
                })()
              }
            </div>
          )}
          
        </div>
      ));
  };

  const renderAdvancePayments = (loanType, loanTypeSchedules) => {
    const advanceSchedules = loanTypeSchedules.filter(s => (parseFloat(s.advance_pay) || 0) > 0);
    if (advanceSchedules.length === 0) return null;

    const grouped = advanceSchedules.reduce((acc, schedule) => {
      const year = parseYearNumber(schedule.year_number);
      if (!acc[year]) acc[year] = [];
      acc[year].push(schedule);
      return acc;
    }, {});

    // Total advance sum across all schedules (distinct OR groups not required for sum)
    const totalAdvance = advanceSchedules.reduce((sum, s) => sum + (parseFloat(s.advance_pay) || 0), 0);

    return (
      <div className="advance-section" style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          Advance Payments
          <span style={{
            background: '#e6f4ea',
            color: '#1e7e34',
            padding: '4px 10px',
            borderRadius: '14px',
            fontSize: '12px',
            fontWeight: 700
          }}>
            {advanceSchedules.length} entr{advanceSchedules.length === 1 ? 'y' : 'ies'}
          </span>
          <span style={{
            background: '#f0f7ff',
            color: '#0d6efd',
            padding: '4px 10px',
            borderRadius: '14px',
            fontSize: '12px',
            fontWeight: 700
          }}>
            Total ₱ {formatNumber(totalAdvance)}
          </span>
        </h3>
        {Object.entries(grouped)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([year, yearSchedules]) => (
            <div key={`advance-${loanType}-${year}`} className="year-group-box">
              <div
                onClick={() => toggleYear(loanType, year)}
                className="year-header"
              >
                <span className="year-title">Year {year}</span>
                <span className="year-toggle">
                  {openYears[`${loanType}-${year}`] ? '▼' : '►'}
                </span>
              </div>

              {openYears[`${loanType}-${year}`] && (
                <div className="year-table-wrapper">
                  <table className="payment-table">
                    <thead>
                      <tr>
                        <th>OR Number</th>
                        <th>Advance Amount</th>
                        <th>Due Date</th>
                        <th>Date Recorded</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                  </table>
                  <div className="payment-tbody-scroll">
                    <table className="payment-table">
                      <tbody>
                        {(() => {
                          const groupedByOR = yearSchedules.reduce((acc, schedule) => {
                            const orNum = schedule.or_number || 'N/A';
                            if (!acc[orNum]) acc[orNum] = [];
                            acc[orNum].push(schedule);
                            return acc;
                          }, {});

                          const rows = [];
                          Object.entries(groupedByOR).forEach(([orNumber, orSchedules]) => {
                            const first = orSchedules[0];
                            const sumAdvance = orSchedules.reduce((t, s) => t + (parseFloat(s.advance_pay) || 0), 0);
                            rows.push(
                              <tr key={`adv-${first.id}-main`}>
                                <td>{orNumber}</td>
                                <td style={{ fontWeight: '700', color: '#1e7e34' }}>₱ {formatNumber(sumAdvance)}</td>
                                <td>{formatISODate(first.due_date)}</td>
                                <td>{first.date_paid ? formatISODate(first.date_paid) : <span style={{ color: '#6c757d', fontSize: '12px' }}>Recorded (date not provided)</span>}</td>
                                <td><span className={`status-badge status-paid`}>Paid</span></td>
                              </tr>
                            );
                          });
                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    );
  };

  useEffect(() => {
    fetchAccountSummaries();
  }, []);

  // ✅ Auto-open year groups when schedules load so previous payments are visible
  useEffect(() => {
    if (!selectedAccount) return;
    const loanTypeSchedules = filterSchedulesByLoanType();
    if (loanTypeSchedules.length === 0) return;

    const grouped = loanTypeSchedules.reduce((acc, schedule) => {
      const year = parseYearNumber(schedule.year_number);
      if (!acc[year]) acc[year] = [];
      acc[year].push(schedule);
      return acc;
    }, {});

    const allYearsOpen = {};
    Object.keys(grouped).forEach((year) => {
      allYearsOpen[`${loanTypeFilter}-${year}`] = true;
    });
    setOpenYears(allYearsOpen);

    // Auto-open OR groups for the most recent year to reveal current payments
    const latestYear = Object.keys(grouped).map((y) => Number(y)).sort((a, b) => a - b).pop();
    if (latestYear != null) {
      const byOR = grouped[latestYear].reduce((acc, schedule) => {
        const orNum = schedule.or_number || 'N/A';
        if (!acc[orNum]) acc[orNum] = [];
        acc[orNum].push(schedule);
        return acc;
      }, {});
      const open = {};
      Object.keys(byOR).forEach((orNum) => {
        open[`${loanTypeFilter}-${latestYear}-${orNum}`] = true;
      });
      setOpenORGroups((prev) => ({ ...prev, ...open }));
    }
  }, [schedules, loanTypeFilter, selectedAccount]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div className="payments-container">
      {!selectedAccount ? (
        <>
          <h2 className="page-title">Payments</h2>
          
          <div className="search-container">
            <input 
              type="text"
              placeholder="Search Payments"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {filteredSummaries.length > 0 ? (
            <div className="table-wrapper">
              <table className="account-summary-table">
                <thead>
                  <tr>
                    <th>Account Number</th>
                    <th>Member</th>
                    <th>Next Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map((summary, index) => (
                    <tr
                      key={`${summary.account_number}-${index}`}
                      onClick={() => fetchPaymentSchedules(summary.account_number)}
                    >
                      <td className="account-number">{summary.account_number || 'N/A'}</td>
                      <td>{summary.account_holder}</td>
                      <td>{summary.next_due_date ? formatISODate(summary.next_due_date) : 'No Due Date'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-data">No ongoing schedules found.</p>
          )}
        </>
      ) : (
        <>
          <div id="print-section">
            {accountDetails && (
              <div style={{
                padding: '10px',
                marginBottom: '30px',
              }}>
                <h3 style={{ 
                  fontSize: '22px',
                  fontWeight: '700',
                  color: '#1a1a1a',
                  marginBottom: '30px',
                  marginTop: '-35px'
                }}>
                  Payment History For:
                  {loanDetails[loanTypeFilter] && (
                    (() => {
                      const ld = loanDetails[loanTypeFilter];
                      const isReloan = !!(ld.is_reloan || ld.reloan_of || ld.original_loan_control_number);
                      const parentCN = ld.reloan_of || ld.original_loan_control_number || null;
                      return isReloan ? (
                        <span style={{
                          marginLeft: '10px',
                          padding: '4px 10px',
                          backgroundColor: '#e6f4ea',
                          color: '#1e7e34',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          verticalAlign: 'middle'
                        }}>
                          RELOAN{parentCN ? ` • From ${parentCN}` : ''}
                        </span>
                      ) : null;
                    })()
                  )}
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))',
                  gap: '20px',
                  width: '100%',
                }}>
                  <div style={{
                    padding: '15px',
                    borderRadius: '8px',
                    borderLeft: '4px solid #007bff',
                    boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
                  }}>
                    <div style={{ fontSize: '12px', color: '#000000ff', marginBottom: '5px', fontWeight: '600' }}>NAME</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#000000ff' }}>
                      {accountDetails.first_name} {accountDetails.middle_name} {accountDetails.last_name}
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '15px',
                    borderRadius: '8px',
                    borderLeft: '4px solid #28a745',
                    boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
                  }}>
                    <div style={{ fontSize: '12px', color: '#000000ff', marginBottom: '5px', fontWeight: '600' }}>ACCOUNT NUMBER</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#000000ff' }}>
                      {selectedAccount}
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '15px',
                    borderRadius: '8px',
                    borderLeft: '4px solid #ffc107',
                    boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
                  }}>
                    <div style={{ fontSize: '12px', color: '#000000ff', marginBottom: '5px', fontWeight: '600' }}>TOTAL PAID AMOUNT</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#28a745' }}>
                      ₱{formatNumber(calculatePaidBalance())}
                    </div>
                  </div>

                  {filterSchedulesByLoanType().some(schedule => schedule.loan_type === 'Regular') && (
                    <>
                      <div style={{
                        padding: '15px',
                        borderRadius: '8px',
                        borderLeft: '4px solid #17a2b8',
                        boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
                      }}>
                        <div style={{ fontSize: '12px', color: '#000000ff', marginBottom: '5px', fontWeight: '600' }}>REGULAR LOAN - APPROVAL DATE</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#000000ff' }}>
                          {formatISODate(
                            filterSchedulesByLoanType().find(schedule => schedule.loan_type === 'Regular')?.loan_date
                          ) || 'No Date Available'}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '15px',
                        borderRadius: '8px',
                        borderLeft: '4px solid #6610f2',
                        boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
                      }}>
                        <div style={{ fontSize: '12px', color: '#000000ff', marginBottom: '5px', fontWeight: '600' }}>AMOUNT</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#000000ff' }}>
                          ₱{formatNumber(parseFloat(
                            filterSchedulesByLoanType().find(schedule => schedule.loan_type === 'Regular')?.loan_amount || 0
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {filterSchedulesByLoanType().some(schedule => schedule.loan_type === 'Emergency') && (
                    <>
                      <div style={{
                        padding: '15px',
                        borderRadius: '8px',
                        borderLeft: '4px solid #fd7e14',
                        boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
                      }}>
                        <div style={{ fontSize: '12px', color: '#000000ff', marginBottom: '5px', fontWeight: '600' }}>EMERGENCY LOAN - APPROVAL DATE</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#000000ff' }}>
                          {formatISODate(
                            filterSchedulesByLoanType().find(schedule => schedule.loan_type === 'Emergency')?.loan_date
                          ) || 'No Date Available'}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '15px',
                        borderRadius: '8px',
                        borderLeft: '4px solid #e83e8c',
                        boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
                      }}>
                        <div style={{ fontSize: '12px', color: '#000000ff', marginBottom: '5px', fontWeight: '600' }}>AMOUNT</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#000000ff' }}>
                          ₱{formatNumber(parseFloat(
                            filterSchedulesByLoanType().find(schedule => schedule.loan_type === 'Emergency')?.loan_amount || 0
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="action-bar" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => setSelectedAccount(null)} className="back-button">
                  <IoArrowBackCircle /> Back 
                </button>

                {availableLoanTypes.Regular && (
                  <button 
                    onClick={() => handleLoanTypeChange('Regular')} 
                    className={`loan-type-button ${loanTypeFilter === 'Regular' ? 'active' : ''}`}
                  >
                    Regular Loans
                  </button>
                )}

                {availableLoanTypes.Emergency && (
                  <button 
                    onClick={() => handleLoanTypeChange('Emergency')} 
                    className={`loan-type-button ${loanTypeFilter === 'Emergency' ? 'active' : ''}`}
                  >
                    Emergency Loans
                  </button>
                )}

                <button 
                  onClick={() => setShowAdvanceOnly(prev => !prev)}
                  className="loan-type-button"
                  title={showAdvanceOnly ? 'Return to full payments view' : 'Show archived advance payments only'}
                >
                  {showAdvanceOnly ? 'Back to All Payments' : 'Advance Payments'}
                </button>
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={handlePrint} className="print-button">
                  <BsFillPrinterFill />
                </button>
                <button
                  onClick={() => {
                    if (selectedAccount) {
                      fetchPaymentSchedules(selectedAccount, loanTypeFilter);
                    }
                  }}
                  className="loan-type-button"
                  title="Refresh payments"
                >
                  <FaSync />
                </button>
              </div>
            </div>

            {showAdvanceOnly ? (
              <div className="schedules-container">
                {ArchivedPaymentsSummary()}
                {archivedPayments.length === 0 && (
                  <p className="no-data">No archived advance payments found.</p>
                )}
              </div>
            ) : (
              filterSchedulesByLoanType().length > 0 ? (
                <div className="schedules-container">
                  {AdvanceMismatchBanner()}
                  {LatestAdvanceBanner()}
                  {renderYearGroupedTable(
                    loanTypeFilter,
                    filterSchedulesByLoanType(),
                    loanDetails[loanTypeFilter]
                  )}
                  {renderAdvancePayments(
                    loanTypeFilter,
                    filterSchedulesByLoanType()
                  )}
                  {PaymentEventsSummary()}
                </div>
              ) : (
                <p className="no-data">No payments found for the selected loan type.</p>
              )
            )}
          </div>

          <style>
            {`
              @media print {
                .print-button, .back-button, .or-toggle {
                  display: none !important;
                }
              }
            `}
          </style>
        </>
      )}
    </div>
  );
};

export default Payments;