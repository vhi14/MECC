import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../Topbar/Topbar';
import axios from 'axios';
import { Eye, TrendingUp, Wallet, CreditCard, ArrowUpRight, ArrowDownRight, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { BsFillPrinterFill } from "react-icons/bs";
import { FaMoneyBillWave, FaCoins, FaHistory } from "react-icons/fa";
import './Home.css';

const Home = () => {
  const [memberData, setMemberData] = useState(null);
  const [loanData, setLoanData] = useState([]);
  const [paymentSchedules, setPaymentSchedules] = useState([]);
  const [payments, setPayments] = useState([]);
  const [controlNumberDetails, setControlNumberDetails] = useState([]);
  const [error, setError] = useState(null);
  const [cachedRemainingBalance, setCachedRemainingBalance] = useState(null);
  const [showCachedBalance, setShowCachedBalance] = useState(false);
  const [loanDetails, setLoanDetails] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [openORGroups, setOpenORGroups] = useState({});
  const [completePaymentHistory, setCompletePaymentHistory] = useState([]);
  const [archivedPayments, setArchivedPayments] = useState([]);
  const [showRegularAdvanceOnly, setShowRegularAdvanceOnly] = useState(false);
  const [showEmergencyAdvanceOnly, setShowEmergencyAdvanceOnly] = useState(false);
  const [showRegularHistory, setShowRegularHistory] = useState(false);
  const [showEmergencyHistory, setShowEmergencyHistory] = useState(false);
  const [currentRegularYear, setCurrentRegularYear] = useState(1);
  const [currentEmergencyYear, setCurrentEmergencyYear] = useState(1);
  
  // Mobile modal state
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  
  const [loanFees, setLoanFees] = useState({
    regular: {
      year1: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
      year2: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
      year3: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
      year4: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 }
    },
    emergency: {
      year1: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
      year2: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
      year3: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
      year4: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 }
    }
  });
  
  const navigate = useNavigate();

  const SHARE_CAPITAL_LIMIT = 1000000; 
  const REGULAR_LOAN_LIMIT = 1500000; 
  const SCHEDULES_PER_YEAR = 24;

  const toggleORGroup = (loanType, orNumber) => {
    setOpenORGroups((prev) => ({
      ...prev,
      [`${loanType}-${orNumber}`]: !prev[`${loanType}-${orNumber}`]
    }));
  };

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

  const handlePrint = (historyType, data) => {
    const printWindow = window.open('', '_blank');
    const normalizedData = normalizeHistoryForTable(historyType);
    
    printWindow.document.write(`
      <html>
        <head>
          <title>${historyType} Payment History</title>
          <style>
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: ${historyType === 'Regular' ? '#0070ba' : '#ff6900'}; color: white; }
            .header { text-align: center; margin-bottom: 20px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${historyType} Loan Payment History</h2>
            <p>Print Date: ${new Date().toLocaleDateString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>TYPE</th>
                <th>AMOUNT</th>
                <th>DATE PAID</th>
                <th>OR NO.</th>
                <th>DESCRIPTION</th>
              </tr>
            </thead>
            <tbody>
              ${normalizedData.map(payment => {
                const isAdvance = String(payment.payment_type || '').toLowerCase().includes('advance');
                return `
                <tr>
                  <td>${payment.loan_type}</td>
                  <td>₱${formatNumber(parseFloat(payment.payment_amount || 0).toFixed(2))}</td>
                  <td>${formatISODate(String(payment.date_paid || payment.payment_date || '').slice(0, 10))}</td>
                  <td>${payment.or_number}</td>
                  <td>${isAdvance ? '💰 Advance Payment' : '📋 Regular Payment'}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const renderAdvanceOnlyTable = (loanType) => {
    let currentCN = null;
    if (loanType === 'Regular') {
      currentCN = nearestRegularLoan?.control_number || null;
    } else if (loanType === 'Emergency') {
      currentCN = nearestEmergencyLoan?.control_number || null;
    }

    const advOnly = (archivedPayments || [])
      .filter(p => String(p.loan_type || '').toLowerCase() === String(loanType).toLowerCase())
      .filter(p => (p.payment_type || '').toLowerCase().includes('advance'))
      .filter(p => {
        if (!currentCN) return true;
        const pcn = p.loan_control_number || p.loan || p.control_number;
        return String(pcn || '') === String(currentCN);
      });
      
    if (advOnly.length === 0) {
      return (
        <tr>
          <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
            <div style={{ fontSize: '48px', opacity: '0.5' }}>📭</div>
            <div>No archived advance payments found</div>
          </td>
        </tr>
      );
    }
    
    const groupedByOR = advOnly.reduce((acc, p) => {
      const key = p.or_number || 'N/A';
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});
    
    const rows = [];
    Object.entries(groupedByOR).forEach(([orNumber, items]) => {
      const sum = items.reduce((t, x) => t + (parseFloat(x.payment_amount) || 0), 0);
      const first = items[0] || {};
      rows.push(
        <tr key={`adv-${loanType}-${orNumber}`} className="paypal-table-row">
          <td>
            <span className={`loan-type-badge ${loanType.toLowerCase()}`}>
              {loanType}
            </span>
          </td>
          <td className="amount-cell">₱{formatNumber(sum)}</td>
          <td>{first.date_paid ? formatISODate(String(first.date_paid).slice(0,10)) : '—'}</td>
          <td className="or-number-cell">{orNumber}</td>
          <td>
            <span className="status-badge advance">
              💰 Advance
            </span>
          </td>
        </tr>
      );
    });
    return rows;
  };

  const formatRemainingBalance = (number) => {
    if (number == null || isNaN(number)) return "N/A";
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  };

  const formatNumber = (number) => {
    if (number == null || number === '') return "0.00";
    const num = Number(number) || 0;
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatPaidAmount = (number) => {
    if (number == null || isNaN(number)) return "0.00";
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'numeric',
        day: '2-digit',
        timeZone: 'Asia/Manila'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  const determineCurrentYear = (schedules, loanType) => {
    if (!schedules || schedules.length === 0) return 1;
    const loanSchedules = schedules
      .filter(s => s.loan_type === loanType)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    const paidCount = loanSchedules.filter(s => s.is_paid).length;
    const year = Math.floor(paidCount / SCHEDULES_PER_YEAR) + 1;
    return Math.min(year, 4);
  };

  const fetchLoanDetailsWithRecalculations = async (controlNumber, token) => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/loans/${controlNumber}/detailed_loan_info/`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching details for ${controlNumber}:`, error);
      return null;
    }
  };

  const fetchCompletePaymentHistory = async (accountNumber) => {
    try {
      const [archivedResponse, activeResponse] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/payment-history/${accountNumber}/`),
        axios.get(`${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}`)
      ]);

      const archivedPayments = archivedResponse.data || [];
      const activePayments = activeResponse.data || [];

      const allPayments = [
        ...archivedPayments,
        ...activePayments.filter(schedule => schedule.is_paid).map(schedule => ({
          loan_type: schedule.loan_type,
          payment_amount: schedule.payment_amount,
          payment_date: schedule.payment_date || schedule.date_paid || schedule.due_date,
          date_paid: schedule.date_paid || schedule.payment_date,
          or_number: schedule.or_number,
          control_number: schedule.control_number,
          status: 'Paid'
        }))
      ];

      const seen = new Set();
      return allPayments.filter(payment => {
        const key = `${payment.control_number}_${payment.or_number}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch (err) {
      console.error('Error fetching payment history:', err);
      return [];
    }
  };

  const loansForMember = loanData.filter(
    loan => loan.account_number === memberData?.accountN || loan.account === memberData?.accountN
  );

  const nearestRegularPaymentSchedule = paymentSchedules
    .filter(schedule => 
      schedule.loan_type === 'Regular' &&
      !schedule.is_paid &&
      loansForMember.find(loan => 
        loan.id === schedule.loan_id && 
        loan.loan_type === 'Regular'
      )
    )
    .sort((a, b) => {
      const loanA = loansForMember.find(l => l.id === a.loan_id);
      const loanB = loansForMember.find(l => l.id === b.loan_id);
      if (loanA?.status === 'Paid-off' && loanB?.status !== 'Paid-off') return 1;
      if (loanA?.status !== 'Paid-off' && loanB?.status === 'Paid-off') return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    })[0];

  const nearestRegularLoan = nearestRegularPaymentSchedule
    ? loansForMember.find(loan => 
        loan.id === nearestRegularPaymentSchedule.loan_id && 
        loan.loan_type === 'Regular'
      )
    : null;

  const nearestEmergencyPaymentSchedule = paymentSchedules
    .filter(schedule => 
      schedule.loan_type === 'Emergency' &&
      loansForMember.find(loan => 
        loan.id === schedule.loan_id && 
        loan.loan_type === 'Emergency'
      )
    )
    .sort((a, b) => {
      const loanA = loansForMember.find(l => l.id === a.loan_id);
      const loanB = loansForMember.find(l => l.id === b.loan_id);
      if (loanA?.status === 'Paid-off' && loanB?.status !== 'Paid-off') return 1;
      if (loanA?.status !== 'Paid-off' && loanB?.status === 'Paid-off') return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    })[0];

  const nearestEmergencyLoan = nearestEmergencyPaymentSchedule
    ? loansForMember.find(loan => 
        loan.id === nearestEmergencyPaymentSchedule.loan_id && 
        loan.loan_type === 'Emergency'
      )
    : null;

  const paidSchedules = paymentSchedules.filter(
    (schedule) => schedule.is_paid || schedule.status === 'Paid'
  );

  const schedulesWithDetails = paidSchedules.map((schedule) => {
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
      payment_date: schedule.payment_date || schedule.date_paid,
      or_number: orNumber,
    };
  });

  const filteredRegular = schedulesWithDetails.filter((schedule) => {
    const searchLower = searchQuery.toLowerCase();
    const datePaid = schedule.date_paid || schedule.payment_date;
    const fullDate = datePaid ? formatISODate(String(datePaid).slice(0, 10)) : formatDate(schedule.due_date);
    const orNumber = (schedule.or_number || '').toString().toLowerCase();
    
    return schedule.loan_type === 'Regular' && (
      fullDate.toLowerCase().includes(searchLower) || 
      orNumber.includes(searchLower)
    );
  });

  const filteredEmergency = schedulesWithDetails.filter((schedule) => {
    const searchLower = searchQuery.toLowerCase();
    const datePaid = schedule.date_paid || schedule.payment_date;
    const fullDate = datePaid ? formatISODate(String(datePaid).slice(0, 10)) : formatDate(schedule.due_date);
    const orNumber = (schedule.or_number || '').toString().toLowerCase();
    
    return schedule.loan_type === 'Emergency' && (
      fullDate.toLowerCase().includes(searchLower) || 
      orNumber.includes(searchLower)
    );
  });

  const regularPaymentHistory = completePaymentHistory
    .filter(payment => payment.loan_type === 'Regular')
    .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
  
  const emergencyPaymentHistory = completePaymentHistory
    .filter(payment => payment.loan_type === 'Emergency')
    .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

  const normalizeHistoryForTable = (loanType) => {
    const paidSchedules = loanType === 'Regular' ? filteredRegular : filteredEmergency;

    const regularPayments = (paidSchedules || []).map(schedule => {
      const orNumber = schedule.or_number || 'N/A';
      return {
        id: schedule.id || `${schedule.control_number || 'cn'}-${orNumber}`,
        loan_type: schedule.loan_type || loanType,
        payment_amount: schedule.payment_amount || 0,
        payment_date: schedule.payment_date || schedule.date_paid || null,
        date_paid: schedule.date_paid || schedule.payment_date || null,
        or_number: orNumber,
        payment_type: schedule.payment_type || 'regular',
        status: 'Paid',
        sourceType: 'schedule'
      };
    });

    const advancePayments = (archivedPayments || [])
      .filter(ap => String(ap.loan_type || '').toLowerCase() === String(loanType).toLowerCase())
      .filter(ap => {
        const paymentType = String(ap.payment_type || '').toLowerCase().trim();
        return paymentType === 'advance' || paymentType === 'advance payment' || paymentType === 'pay_ahead';
      })
      .map(ap => {
        const orNumber = ap.OR || ap.or_number || ap.orNumber || ap.or_num || ap.receipt_number || ap.receipt_no || ap.official_receipt || ap.or_id || 'N/A';
        return {
          id: ap.id || `${ap.loan_control_number || ap.control_number || 'adv'}-${orNumber}`,
          loan_type: ap.loan_type || loanType,
          payment_amount: ap.payment_amount || 0,
          payment_date: ap.payment_date || ap.date_paid || null,
          date_paid: ap.date_paid || ap.payment_date || null,
          or_number: orNumber,
          payment_type: ap.payment_type || 'advance',
          status: 'Advance',
          sourceType: 'archived'
        };
      });

    const merged = [...regularPayments, ...advancePayments];
    const seen = new Set();
    const deduplicated = merged.filter(item => {
      const key = `${item.or_number}_${item.payment_date || item.date_paid}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduplicated.sort((a, b) => new Date(b.payment_date || b.date_paid || 0) - new Date(a.payment_date || a.date_paid || 0));
  };

  const calculatePaidBalance = () => {
    if (!nearestRegularLoan) return 0;
    
    const base = paymentSchedules
      .filter(schedule => 
        schedule.loan_id === nearestRegularLoan.id &&
        schedule.loan_type === 'Regular' &&
        (schedule.is_paid === true || schedule.status === 'Paid')
      )
      .reduce((total, schedule) => {
        return total + parseFloat(schedule.payment_amount || 0);
      }, 0);

    const currentCN = nearestRegularLoan.control_number;
    const archivedAdvances = (archivedPayments || [])
      .filter(p => (p.payment_type || '').toLowerCase().includes('advance'))
      .filter(p => String(p.loan_type || '').toLowerCase() === 'regular')
      .filter(p => {
        if (!currentCN) return true;
        const pcn = p.loan_control_number || p.loan || p.control_number;
        return String(pcn || '') === String(currentCN);
      })
      .reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0);

    return base + archivedAdvances;
  };

  const calculatePaidBalanceForEmergency = () => {
    if (!nearestEmergencyLoan) return 0;
    
    const base = paymentSchedules
      .filter(schedule => 
        schedule.loan_id === nearestEmergencyLoan.id && 
        schedule.loan_type === 'Emergency' &&
        (schedule.is_paid === true || schedule.status === 'Paid')
      )
      .reduce((total, schedule) => {
        return total + parseFloat(schedule.payment_amount || 0);
      }, 0);

    const currentCN = nearestEmergencyLoan.control_number;
    const archivedAdvances = (archivedPayments || [])
      .filter(p => (p.payment_type || '').toLowerCase().includes('advance'))
      .filter(p => String(p.loan_type || '').toLowerCase() === 'emergency')
      .filter(p => {
        if (!currentCN) return true;
        const pcn = p.loan_control_number || p.loan || p.control_number;
        return String(pcn || '') === String(currentCN);
      })
      .reduce((sum, p) => sum + (parseFloat(p.payment_amount) || 0), 0);

    return base + archivedAdvances;
  };

  const calculateRemainingBalance = () => {
    if (!nearestRegularLoan) return 0;

    const schedules = paymentSchedules.filter(schedule => 
      schedule.loan_id === nearestRegularLoan.id && 
      schedule.loan_type === 'Regular'
    );

    if (schedules.length === 0) return 0;

    const details = loanDetails[nearestRegularLoan.control_number];
    
    if (details && details.yearly_recalculations && details.yearly_recalculations.length > 0) {
      const SCHEDULES_PER_YEAR = 24;
      const allSchedules = [...schedules].sort((a, b) => 
        new Date(a.due_date) - new Date(b.due_date)
      );
      
      let lastCompletedYear = 0;
      for (let year = 1; year <= 4; year++) {
        const yearStart = (year - 1) * SCHEDULES_PER_YEAR;
        const yearEnd = yearStart + SCHEDULES_PER_YEAR;
        const yearSchedules = allSchedules.slice(yearStart, yearEnd);
        
        if (yearSchedules.length > 0 && yearSchedules.every(s => s.is_paid)) {
          lastCompletedYear = year;
        } else {
          break;
        }
      }
      
      if (lastCompletedYear > 0) {
        const nextYearRecalc = details.yearly_recalculations.find(
          r => r.year === lastCompletedYear + 1 && 
               r.loan_control_number === nearestRegularLoan.control_number
        );
        
        if (nextYearRecalc) {
          const outstandingBalance = parseFloat(nextYearRecalc.outstanding_balance || 0);
          const currentYearStart = lastCompletedYear * SCHEDULES_PER_YEAR;
          const currentYearSchedules = allSchedules.slice(currentYearStart);
          const currentYearPaid = currentYearSchedules
            .filter(s => s.is_paid)
            .reduce((sum, s) => sum + parseFloat(s.payment_amount || 0), 0);
          
          return Math.max(0, outstandingBalance - currentYearPaid);
        }
      }
    }
    
    return schedules
      .filter(s => !s.is_paid)
      .reduce((sum, s) => {
        const paymentAmount = parseFloat(s.payment_amount || 0);
        const penalty = parseFloat(s.penalty || 0);
        return sum + paymentAmount + penalty;
      }, 0);
  };

  const calculateRemainingBalanceForEmergency = () => {
    if (!nearestEmergencyLoan) return 0;

    const schedules = paymentSchedules.filter(schedule => 
      schedule.loan_id === nearestEmergencyLoan.id && 
      schedule.loan_type === 'Emergency'
    );

    if (schedules.length === 0) return 0;

    const details = loanDetails[nearestEmergencyLoan.control_number];
    
    if (details && details.yearly_recalculations && details.yearly_recalculations.length > 0) {
      const SCHEDULES_PER_YEAR = 24;
      const allSchedules = [...schedules].sort((a, b) => 
        new Date(a.due_date) - new Date(b.due_date)
      );
      
      let lastCompletedYear = 0;
      for (let year = 1; year <= 4; year++) {
        const yearStart = (year - 1) * SCHEDULES_PER_YEAR;
        const yearEnd = yearStart + SCHEDULES_PER_YEAR;
        const yearSchedules = allSchedules.slice(yearStart, yearEnd);
        
        if (yearSchedules.length > 0 && yearSchedules.every(s => s.is_paid)) {
          lastCompletedYear = year;
        } else {
          break;
        }
      }
      
      if (lastCompletedYear > 0) {
        const nextYearRecalc = details.yearly_recalculations.find(
          r => r.year === lastCompletedYear + 1 && 
               r.loan_control_number === nearestEmergencyLoan.control_number
        );
        
        if (nextYearRecalc) {
          const outstandingBalance = parseFloat(nextYearRecalc.outstanding_balance || 0);
          const currentYearStart = lastCompletedYear * SCHEDULES_PER_YEAR;
          const currentYearSchedules = allSchedules.slice(currentYearStart);
          const currentYearPaid = currentYearSchedules
            .filter(s => s.is_paid)
            .reduce((sum, s) => sum + parseFloat(s.payment_amount || 0), 0);
          
          return Math.max(0, outstandingBalance - currentYearPaid);
        }
      }
    }
    
    return schedules
      .filter(s => !s.is_paid)
      .reduce((sum, s) => {
        const paymentAmount = parseFloat(s.payment_amount || 0);
        const penalty = parseFloat(s.penalty || 0);
        return sum + paymentAmount + penalty;
      }, 0);
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  const renderTableWithORGrouping = (filteredSchedules, loanType) => {
    const groupedByOR = filteredSchedules.reduce((acc, schedule) => {
      const orNum = schedule.or_number || 'N/A';
      if (!acc[orNum]) acc[orNum] = [];
      acc[orNum].push(schedule);
      return acc;
    }, {});

    const rows = [];
    
    Object.entries(groupedByOR).forEach(([orNumber, orSchedules]) => {
      const isOpen = openORGroups[`${loanType}-${orNumber}`];
      const hasMultiple = orSchedules.length > 1;
      const firstSchedule = orSchedules[0];
      
      rows.push(
        <tr key={`${firstSchedule.id || firstSchedule.control_number}-main`} className="paypal-table-row">
          <td>
            <span className={`loan-type-badge ${loanType.toLowerCase()}`}>
              {firstSchedule.loan_type || 'N/A'}
            </span>
          </td>
          <td className="amount-cell">
            ₱{formatNumber(parseFloat(firstSchedule.payment_amount || 0).toFixed(2))}
          </td>
          <td>
            <span className="status-badge settled">
              <CheckCircle size={14} /> Settled
            </span>
          </td>
          <td>
            {(() => {
              const datePaid = firstSchedule.date_paid || firstSchedule.payment_date;
              if (datePaid) {
                return formatISODate(String(datePaid).slice(0, 10));
              }
              return <span style={{ color: '#6c757d', fontSize: '12px' }}>Paid (date not recorded)</span>;
            })()}
          </td>
          <td className="or-number-cell">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {hasMultiple && (
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleORGroup(loanType, orNumber);
                  }}
                  className="expand-icon"
                >
                  {isOpen ? '▼' : '►'}
                </span>
              )}
              <span>{firstSchedule.or_number}</span>
              {hasMultiple && (
                <span className="count-badge">({orSchedules.length})</span>
              )}
            </div>
          </td>
        </tr>
      );
      
      if (hasMultiple && isOpen) {
        orSchedules.slice(1).forEach((schedule, idx) => {
          rows.push(
            <tr key={`${schedule.id || schedule.control_number}-${idx}`} className="paypal-table-row nested">
              <td>
                <span className={`loan-type-badge ${loanType.toLowerCase()}`}>
                  {schedule.loan_type || 'N/A'}
                </span>
              </td>
              <td className="amount-cell">
                ₱{formatNumber(parseFloat(schedule.payment_amount || 0).toFixed(2))}
              </td>
              <td>
                <span className="status-badge settled">
                  <CheckCircle size={14} /> Settled
                </span>
              </td>
              <td>
                {schedule.payment_date !== 'N/A' ? schedule.payment_date : formatDate(schedule.due_date)}
              </td>
              <td className="or-number-cell nested">
                {schedule.or_number}
              </td>
            </tr>
          );
        });
      }
    });
    
    return rows;
  };

  const renderHistoryWithORGrouping = (historyItems, loanType) => {
    const groupedByOR = (historyItems || []).reduce((acc, item) => {
      const key = item.or_number || 'N/A';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const rows = [];
    Object.entries(groupedByOR).forEach(([orNumber, items]) => {
      const isOpen = openORGroups[`${loanType}-HIST-${orNumber}`];
      const hasMultiple = items.length > 1;
      const first = items[0];
      
      const isAdvance = (payment) => {
        const paymentType = String(payment.payment_type || '').toLowerCase().trim();
        return paymentType === 'advance' || 
               paymentType === 'advance payment' || 
               paymentType === 'pay_ahead' ||
               paymentType.includes('advance');
      };
      
      const firstIsAdvance = isAdvance(first);

      rows.push(
        <tr key={`hist-${loanType}-${orNumber}-main`} className="paypal-table-row">
          <td>
            <span className={`loan-type-badge ${loanType.toLowerCase()}`}>
              {loanType}
            </span>
          </td>
          <td className="amount-cell">
            ₱{formatNumber(parseFloat(first.payment_amount || 0).toFixed(2))}
          </td>
          <td>
            {(() => {
              const datePaid = first.date_paid || first.payment_date;
              if (datePaid) return formatISODate(String(datePaid).slice(0,10));
              return <span style={{ color: '#6c757d', fontSize: '12px' }}>—</span>;
            })()}
          </td>
          <td className="or-number-cell">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {hasMultiple && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenORGroups(prev => ({ ...prev, [`${loanType}-HIST-${orNumber}`]: !prev[`${loanType}-HIST-${orNumber}`] }));
                  }}
                  className="expand-icon"
                >
                  {isOpen ? '▼' : '►'}
                </span>
              )}
              <span>{first.or_number}</span>
              {hasMultiple && (
                <span className="count-badge">({items.length})</span>
              )}
            </div>
          </td>
          <td>
            <span className={`status-badge ${firstIsAdvance ? 'advance' : 'regular'}`}>
              {firstIsAdvance ? '💰 Advance Payment' : '📋 Regular Payment'}
            </span>
          </td>
        </tr>
      );

      if (hasMultiple && isOpen) {
        items.slice(1).forEach((it, idx) => {
          const itIsAdvance = isAdvance(it);
          rows.push(
            <tr key={`hist-${loanType}-${orNumber}-${idx}`} className="paypal-table-row nested">
              <td>
                <span className={`loan-type-badge ${loanType.toLowerCase()}`}>{loanType}</span>
              </td>
              <td className="amount-cell">
                ₱{formatNumber(parseFloat(it.payment_amount || 0).toFixed(2))}
              </td>
              <td>
                {(() => {
                  const datePaid = it.date_paid || it.payment_date;
                  if (datePaid) return formatISODate(String(datePaid).slice(0,10));
                  return <span style={{ color: '#6c757d', fontSize: '12px' }}>—</span>;
                })()}
              </td>
              <td className="or-number-cell nested">
                {it.or_number}
              </td>
              <td>
                <span className={`status-badge ${itIsAdvance ? 'advance' : 'regular'}`}>
                  {itIsAdvance ? '💰 Advance Payment' : '📋 Regular Payment'}
                </span>
              </td>
            </tr>
          );
        });
      }
    });

    return rows;
  };

  useEffect(() => {
    const fetchYearlyLoanFees = async () => {
      if (loansForMember.length === 0 || !paymentSchedules.length) return;

      const token = localStorage.getItem('accessToken');
      if (!token) return;

      try {
        const regularLoans = loansForMember.filter(loan => loan.loan_type === 'Regular');
        const recentRegularLoan = regularLoans.sort((a, b) => 
          new Date(b.loan_date) - new Date(a.loan_date)
        )[0];

        const emergencyLoans = loansForMember.filter(loan => loan.loan_type === 'Emergency');
        const recentEmergencyLoan = emergencyLoans.sort((a, b) => 
          new Date(b.loan_date) - new Date(a.loan_date)
        )[0];

        const newFees = {
          regular: {
            year1: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
            year2: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
            year3: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
            year4: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 }
          },
          emergency: {
            year1: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
            year2: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
            year3: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
            year4: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 }
          }
        };

        if (recentRegularLoan) {
          const regularDetails = await fetchLoanDetailsWithRecalculations(
            recentRegularLoan.control_number, 
            token
          );

          if (regularDetails) {
            newFees.regular.year1 = {
              interest: regularDetails.interest_amount || 0,
              cisp: regularDetails.cisp || 0,
              service_fee: regularDetails.service_fee || 0,
              admin_cost: regularDetails.admincost || 0
            };

            if (regularDetails.yearly_recalculations) {
              regularDetails.yearly_recalculations
                .filter(r => r.loan_control_number === recentRegularLoan.control_number)
                .forEach(recalc => {
                  const yearKey = `year${recalc.year}`;
                  if (newFees.regular[yearKey]) {
                    newFees.regular[yearKey] = {
                      interest: recalc.interest_amount || 0,
                      cisp: recalc.cisp || 0,
                      service_fee: recalc.service_fee || 0,
                      admin_cost: recalc.admincost || 0
                    };
                  }
                });
            }

            const regularSchedules = paymentSchedules.filter(
              s => s.loan_type === 'Regular' && s.loan_id === recentRegularLoan.id
            );
            const regYear = determineCurrentYear(regularSchedules, 'Regular');
            setCurrentRegularYear(regYear);
          }
        }

        if (recentEmergencyLoan) {
          const emergencyDetails = await fetchLoanDetailsWithRecalculations(
            recentEmergencyLoan.control_number, 
            token
          );

          if (emergencyDetails) {
            newFees.emergency.year1 = {
              interest: emergencyDetails.interest_amount || 0,
              cisp: emergencyDetails.cisp || 0,
              service_fee: emergencyDetails.service_fee || 0,
              admin_cost: emergencyDetails.admincost || 0
            };

            if (emergencyDetails.yearly_recalculations) {
              emergencyDetails.yearly_recalculations
                .filter(r => r.loan_control_number === recentEmergencyLoan.control_number)
                .forEach(recalc => {
                  const yearKey = `year${recalc.year}`;
                  if (newFees.emergency[yearKey]) {
                    newFees.emergency[yearKey] = {
                      interest: recalc.interest_amount || 0,
                      cisp: recalc.cisp || 0,
                      service_fee: recalc.service_fee || 0,
                      admin_cost: recalc.admincost || 0
                    };
                  }
                });
            }

            const emergencySchedules = paymentSchedules.filter(
              s => s.loan_type === 'Emergency' && s.loan_id === recentEmergencyLoan.id
            );
            const emgYear = determineCurrentYear(emergencySchedules, 'Emergency');
            setCurrentEmergencyYear(emgYear);
          }
        }

        setLoanFees(newFees);

      } catch (error) {
        console.error('Error fetching yearly loan fees:', error);
      }
    };

    fetchYearlyLoanFees();
  }, [loansForMember, paymentSchedules]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const acc_number = localStorage.getItem('account_number');

        if (!token || !acc_number) {
          setError("Missing token or account number. Please log in again.");
          return;
        }

        const memberResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/member/profile/`, {
          params: { account_number: acc_number },
          headers: { Authorization: `Bearer ${token}` },
        });

        const accountNumber = memberResponse.data.accountN;

        const loanResponse = await axios.get(`${process.env.REACT_APP_API_URL}/loans/?account_number=${accountNumber}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const paymentScheduleResponse = await axios.get(`${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const paymentResponse = await axios.get(`${process.env.REACT_APP_API_URL}/payments/?account_number=${accountNumber}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setMemberData(memberResponse.data);
        setLoanData(loanResponse.data);
        setPaymentSchedules(paymentScheduleResponse.data);
        setPayments(paymentResponse.data);

        const history = await fetchCompletePaymentHistory(accountNumber);
        setCompletePaymentHistory(history);

        try {
          const archResp = await axios.get(`${process.env.REACT_APP_API_URL}/archived-payment-records/?account_number=${accountNumber}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setArchivedPayments(Array.isArray(archResp.data) ? archResp.data : []);
        } catch (archErr) {
          console.warn('Failed to fetch archived payments', archErr.response?.data || archErr.message);
          setArchivedPayments([]);
        }

      } catch (err) {
        setError(err.response?.data?.detail || "Error fetching data.");
      }
    };

    fetchAllData();
  }, []);

  useEffect(() => {
    const controlNumbers = loansForMember.map(loan => loan.control_number).filter(Boolean);

    const fetchControlDetails = async () => {
      const token = localStorage.getItem('accessToken');

      try {
        const details = await Promise.all(
          controlNumbers.map(async (control_number) => {
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/loans/details?control_number=${control_number}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            return response.data;
          })
        );
        setControlNumberDetails(details);
      } catch (err) {
        console.error("❌ Error fetching control number details:", err);
      }
    };

    if (controlNumbers.length > 0) {
      fetchControlDetails();
    }
  }, [loansForMember]);

  if (error) {
    return (
      <div className="paypal-error-container">
        <div className="paypal-error-card">
          <div className="error-icon">
            <AlertCircle size={64} />
          </div>
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <a href="/" className="paypal-btn primary">
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  if (!memberData || !loanData || !paymentSchedules || !payments) {
    return (
      <div className="paypal-loading-container">
        <div className="paypal-loading-card">
          <div className="spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="paypal-dashboard">
      <Topbar />
      
      <div className="paypal-container">
        <div className="paypal-content">

          {/* Main Grid Layout */}
          <div className="paypal-grid">
            
            {/* Left Column - Account Overview */}
            <div className="paypal-sidebar">
              
              {/* Balance Card */}
              <div className="paypal-card balance-card">
                <h1>{`WELCOME ${memberData.first_name || ''} ${memberData.middle_name || ''} ${memberData.last_name || ''}`.toUpperCase().trim()}</h1>
                  <p className="account-info">Account #{memberData.accountN}</p>
                  
                <div className="card-header">
                  <Wallet size={24} />
                  <h3>Account Balance</h3>
                </div>
                <div className="balance-amount">
                  <div className="balance-item">
                    <span className="balance-label">Share Capital</span>
                    <span className="balance-value">₱{formatNumber(Math.min(memberData.share_capital || 0, SHARE_CAPITAL_LIMIT))}</span>
                  </div>
                  <div className="balance-item">
                    <span className="balance-label">Share Value</span>
                    <span className="balance-value">₱{formatNumber(Math.min(memberData.share_capital || 0, SHARE_CAPITAL_LIMIT) / 1000)}</span>
                  </div>
                </div>
              </div>

{/* Regular Loan Fees Card - 2x2 Grid */}
{nearestRegularLoan && (
  <div className="paypal-card fees-card">
    <div className="card-header regular">
      <TrendingUp size={20} />
      <h3>Regular Loan Fees{nearestRegularLoan?.status !== 'Paid-off' && ` - Year ${currentRegularYear}`}</h3>
    </div>
    
    {nearestRegularLoan?.status === 'Paid-off' ? (
      <div className="fees-grid-2x2 settled">
        <div className="fee-item">
          <span>Interest (8%)</span>
          <span>₱0.00</span>
        </div>
        <div className="fee-item">
          <span>Service Fee</span>
          <span>₱0.00</span>
        </div>
        <div className="fee-item">
          <span>CISP</span>
          <span>₱0.00</span>
        </div>
        <div className="fee-item">
          <span>Admin Cost</span>
          <span>₱0.00</span>
        </div>
      </div>
    ) : (
      <div className="fees-grid-2x2">
        <div className="fee-item">
          <span>Interest (8%)</span>
          <span>₱{formatNumber(loanFees.regular[`year${currentRegularYear}`].interest)}</span>
        </div>
        <div className="fee-item">
          <span>Service Fee</span>
          <span>₱{formatNumber(loanFees.regular[`year${currentRegularYear}`].service_fee)}</span>
        </div>
        <div className="fee-item">
          <span>CISP</span>
          <span>₱{formatNumber(loanFees.regular[`year${currentRegularYear}`].cisp)}</span>
        </div>
        <div className="fee-item">
          <span>Admin Cost</span>
          <span>₱{formatNumber(loanFees.regular[`year${currentRegularYear}`].admin_cost)}</span>
        </div>
      </div>
    )}
  </div>
)}

{/* Emergency Loan Fees Card - 2x2 Grid */}
{nearestEmergencyLoan && (
  <div className="paypal-card fees-card">
    <div className="card-header emergency">
      <AlertCircle size={20} />
      <h3>Emergency Loan Fees{nearestEmergencyLoan?.status !== 'Paid-off' && ` - Month ${currentEmergencyYear}`}</h3>
    </div>
    
    {nearestEmergencyLoan?.status === 'Paid-off' ? (
      <div className="fees-grid-2x2 settled">
        <div className="fee-item">
          <span>Interest (4%)</span>
          <span>₱0.00</span>
        </div>
        <div className="fee-item">
          <span>Service Fee</span>
          <span>₱0.00</span>
        </div>
        <div className="fee-item">
          <span>CISP</span>
          <span>₱0.00</span>
        </div>
        <div className="fee-item">
          <span>Admin Cost</span>
          <span>₱0.00</span>
        </div>
      </div>
    ) : (
      <div className="fees-grid-2x2">
        <div className="fee-item">
          <span>Interest (4%)</span>
          <span>₱{formatNumber(loanFees.emergency[`year${currentEmergencyYear}`].interest)}</span>
        </div>
        <div className="fee-item">
          <span>Service Fee</span>
          <span>₱{formatNumber(loanFees.emergency[`year${currentEmergencyYear}`].service_fee)}</span>
        </div>
        <div className="fee-item">
          <span>CISP</span>
          <span>₱{formatNumber(loanFees.emergency[`year${currentEmergencyYear}`].cisp)}</span>
        </div>
        <div className="fee-item">
          <span>Admin Cost</span>
          <span>₱{formatNumber(loanFees.emergency[`year${currentEmergencyYear}`].admin_cost)}</span>
        </div>
      </div>
    )}
  </div>
)}

              {/* Quick Actions */}
              <div className="paypal-card actionss-card">
                <div className="action-buttons">
                  <button onClick={() => handleNavigation('/accounts')} className="paypal-btn action">
                    <Wallet size={18} />
                    Share Capital
                  </button>
                  <button onClick={() => handleNavigation('/loans')} className="paypal-btn action">
                    <CreditCard size={18} />
                    Amortization
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Loan Details */}
            <div className="paypal-main">
              
              {/* Loan Summary Cards */}
              {loansForMember.length > 0 && (
                <div className="loan-cards-grid">
                  
                  {/* Regular Loan Card */}
                  {loansForMember.some(loan => loan.loan_type === 'Regular') && nearestRegularPaymentSchedule && (
                    <div className="paypal-card loan-summary-card regular">
                      <div className="loan-header">
                        <div className="loan-title">
                          <CreditCard size={24} />
                          <h3>Regular Loan</h3>
                        </div>
                        <span className={`status-pill ${nearestRegularLoan?.status === 'Paid-off' ? 'paid' : 'active'}`}>
                          {nearestRegularLoan?.status === 'Paid-off' ? 'Paid Off' : 'Active'}
                        </span>
                      </div>
                      
                      <div className="loan-amount-section">
                        <div className="loan-amount">
                          <span className="label">Loan Amount</span>
                          <span className="value">₱{formatNumber(parseFloat(nearestRegularLoan?.loan_amount || 0).toFixed(2))}</span>
                        </div>
                      </div>

                      <div className="loan-details-grid">
                        <div className="detail-item">
                          <Clock size={16} />
                          <div>
                            <span className="detail-label">Approval Date</span>
                            <span className="detail-value">{nearestRegularLoan?.loan_date ? formatDate(nearestRegularLoan.loan_date) : 'N/A'}</span>
                          </div>
                        </div>
                        <div className="detail-item">
                          <Clock size={16} />
                          <div>
                            <span className="detail-label">Next Due</span>
                            <span className="detail-value">
                              {nearestRegularLoan?.status === 'Paid-off' 
                                ? 'SETTLED' 
                                : nearestRegularPaymentSchedule?.due_date 
                                  ? new Date(nearestRegularPaymentSchedule.due_date).toLocaleDateString()
                                  : 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Control Number</span>
                          <span 
                            className="detail-value link"
                            onClick={() => navigate(`/loans?control=${nearestRegularLoan?.control_number}`)}
                          >
                            {nearestRegularLoan?.control_number || 'N/A'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Amount Due</span>
                          <span className="detail-value">
                            ₱{nearestRegularLoan?.status === 'Paid-off' 
                              ? '0.00' 
                              : formatNumber(nearestRegularPaymentSchedule?.payment_amount || 0)}
                          </span>
                        </div>
                      </div>

                      <div className="progress-section">
                        <div className="progress-item">
                          <div className="progress-label">
                            <span>Paid</span>
                            <span className="progress-amount">₱{formatRemainingBalance(calculatePaidBalance().toFixed(2))}</span>
                          </div>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill regular"
                              style={{ 
                                width: `${nearestRegularLoan?.loan_amount > 0 
                                  ? (calculatePaidBalance() / nearestRegularLoan.loan_amount * 100) 
                                  : 0}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                        <div className="progress-item">
                          <div className="progress-label">
                            <span>Remaining</span>
                            <span className="progress-amount">₱{formatRemainingBalance(calculateRemainingBalance().toFixed(2))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Emergency Loan Card */}
                  {loansForMember.some(loan => loan.loan_type === 'Emergency') && nearestEmergencyPaymentSchedule && (
                    <div className="paypal-card loan-summary-card emergency">
                      <div className="loan-header">
                        <div className="loan-title">
                          <AlertCircle size={24} />
                          <h3>Emergency Loan</h3>
                        </div>
                        <span className={`status-pill ${nearestEmergencyLoan?.status === 'Paid-off' ? 'paid' : 'active'}`}>
                          {nearestEmergencyLoan?.status === 'Paid-off' ? 'Paid Off' : 'Active'}
                        </span>
                      </div>
                      
                      <div className="loan-amount-section">
                        <div className="loan-amount">
                          <span className="label">Loan Amount</span>
                          <span className="value">₱{formatNumber(parseFloat(nearestEmergencyLoan?.loan_amount || 0).toFixed(2))}</span>
                        </div>
                      </div>

                      <div className="loan-details-grid">
                        <div className="detail-item">
                          <Clock size={16} />
                          <div>
                            <span className="detail-label">Approval Date</span>
                            <span className="detail-value">{nearestEmergencyLoan?.loan_date ? formatDate(nearestEmergencyLoan.loan_date) : 'N/A'}</span>
                          </div>
                        </div>
                        <div className="detail-item">
                          <Clock size={16} />
                          <div>
                            <span className="detail-label">Next Due</span>
                            <span className="detail-value">
                              {nearestEmergencyLoan?.status === 'Paid-off' 
                                ? 'SETTLED' 
                                : nearestEmergencyPaymentSchedule?.due_date 
                                  ? new Date(nearestEmergencyPaymentSchedule.due_date).toLocaleDateString()
                                  : 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Control Number</span>
                          <span 
                            className="detail-value link"
                            onClick={() => navigate(`/loans?control=${nearestEmergencyLoan?.control_number}`)}
                          >
                            {nearestEmergencyLoan?.control_number || 'N/A'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Amount Due</span>
                          <span className="detail-value">
                            ₱{nearestEmergencyLoan?.status === 'Paid-off' 
                              ? '0.00' 
                              : formatNumber(nearestEmergencyPaymentSchedule?.payment_amount || 0)}
                          </span>
                        </div>
                      </div>

                      <div className="progress-section">
                        <div className="progress-item">
                          <div className="progress-label">
                            <span>Paid</span>
                            <span className="progress-amount">₱{formatRemainingBalance(calculatePaidBalanceForEmergency())}</span>
                          </div>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill emergency"
                              style={{ 
                                width: `${nearestEmergencyLoan?.loan_amount > 0 
                                  ? (calculatePaidBalanceForEmergency() / nearestEmergencyLoan.loan_amount * 100) 
                                  : 0}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                        <div className="progress-item">
                          <div className="progress-label">
                            <span>Remaining</span>
                            <span className="progress-amount">₱{formatRemainingBalance(calculateRemainingBalanceForEmergency().toFixed(2))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Tables Section */}
              {loansForMember.length > 0 && (
                <div className="payment-tables-grid">
                  
                  {/* Regular Loan Payments Table */}
                  {loansForMember.some(loan => loan.loan_type === 'Regular') && (
                    <div className="paypal-card payment-table-card">
                      <div className="payment-table-header">
                        <h3>
                          <span className="icon regular">●</span>
                          Regular Loan Payments
                        </h3>
                        <div className="table-actions">
                          <button
                            onClick={() => { setShowRegularHistory(true); setShowRegularAdvanceOnly(false); }}
                            className="paypal-btn small secondary"
                          >
                            <Eye size={16} />
                            View History
                          </button>
                          <button
                            onClick={() => setShowRegularAdvanceOnly(!showRegularAdvanceOnly)}
                            className={`paypal-btn small ${showRegularAdvanceOnly ? 'primary' : 'secondary'}`}
                          >
                            {showRegularAdvanceOnly ? 'Show All' : 'Advances'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="paypal-table-container">
                        {showRegularAdvanceOnly ? (
                          <table className="paypal-table">
                            <thead>
                              <tr>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>OR No</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {renderAdvanceOnlyTable('Regular')}
                            </tbody>
                          </table>
                        ) : filteredRegular.length > 0 ? (
                          <table className="paypal-table">
                            <thead>
                              <tr>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Date Paid</th>
                                <th>OR No</th>
                              </tr>
                            </thead>
                            <tbody>
                              {renderTableWithORGrouping(filteredRegular, 'Regular')}
                            </tbody>
                          </table>
                        ) : (
                          <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <p>No paid payments for regular loans</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Emergency Loan Payments Table */}
                  {loansForMember.some(loan => loan.loan_type === 'Emergency') && (
                    <div className="paypal-card payment-table-card">
                      <div className="payment-table-header">
                        <h3>
                          <span className="icon emergency">●</span>
                          Emergency Loan Payments
                        </h3>
                        <div className="table-actions">
                          <button
                            onClick={() => { setShowEmergencyHistory(true); setShowEmergencyAdvanceOnly(false); }}
                            className="paypal-btn small secondary"
                          >
                            <Eye size={16} />
                            View History
                          </button>
                          <button
                            onClick={() => setShowEmergencyAdvanceOnly(!showEmergencyAdvanceOnly)}
                            className={`paypal-btn small ${showEmergencyAdvanceOnly ? 'primary' : 'secondary'}`}
                          >
                            {showEmergencyAdvanceOnly ? 'Show All' : 'Advances'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="paypal-table-container">
                        {showEmergencyAdvanceOnly ? (
                          <table className="paypal-table">
                            <thead>
                              <tr>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>OR No</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {renderAdvanceOnlyTable('Emergency')}
                            </tbody>
                          </table>
                        ) : filteredEmergency.length > 0 ? (
                          <table className="paypal-table">
                            <thead>
                              <tr>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Date Paid</th>
                                <th>OR No</th>
                              </tr>
                            </thead>
                            <tbody>
                              {renderTableWithORGrouping(filteredEmergency, 'Emergency')}
                            </tbody>
                          </table>
                        ) : (
                          <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <p>No paid payments for emergency loans</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING ACTION BUTTONS - Mobile Only */}
      <div className="home-floating-buttons" style={{ 
        position: 'fixed', 
        bottom: '10px', 
        right: '10px', 
        display: 'none',
        flexDirection: 'column', 
        gap: '10px', 
        zIndex: 999 
      }}>
        <button 
          onClick={() => handleNavigation('/accounts')} 
          style={{ 
            width: '50px', 
            height: '50px', 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)', 
            color: 'white', 
            border: 'none', 
            boxShadow: '0 4px 15px rgba(0, 180, 219, 0.4)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '24px', 
            cursor: 'pointer', 
            transition: 'all 0.3s ease' 
          }} 
          title="Share Capital Transactions"
        >
          <FaCoins />
        </button>

        <button 
          onClick={() => handleNavigation('/loans')} 
          style={{ 
            width: '50px', 
            height: '50px', 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            color: 'white', 
            border: 'none', 
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '24px', 
            cursor: 'pointer', 
            transition: 'all 0.3s ease' 
          }} 
          title="Bi Monthly Amortization"
        >
          <FaMoneyBillWave />
        </button>
      </div>

      {/* Mobile CSS for Floating Buttons */}
      <style>
        {`
          @media (max-width: 768px) {
            .home-floating-buttons {
              display: flex !important;
            }
          }
        `}
      </style>

      {/* PAYMENTS MODAL - Mobile */}
      {showPaymentsModal && (
        <>
          <div 
            onClick={() => setShowPaymentsModal(false)} 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              backgroundColor: 'rgba(0, 0, 0, 0.6)', 
              backdropFilter: 'blur(5px)', 
              zIndex: 1000 
            }} 
          />
          <div style={{ 
            position: 'fixed', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            background: 'white', 
            borderRadius: '20px', 
            maxWidth: '95%', 
            width: '500px', 
            maxHeight: '85vh', 
            zIndex: 1001, 
            overflow: 'hidden', 
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)' 
          }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              padding: '20px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: '700' }}>
                Payment History
              </h3>
              <button 
                onClick={() => setShowPaymentsModal(false)} 
                style={{ 
                  background: 'white', 
                  color: '#000', 
                  border: 'none', 
                  padding: '8px 15px', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontWeight: '700' 
                }}
              >
                Close
              </button>
            </div>
            
            <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
              {/* Regular Payments Section */}
              <div style={{ marginBottom: '30px' }}>
                <h4 style={{ 
                  fontSize: '16px', 
                  fontWeight: '700', 
                  marginBottom: '15px', 
                  color: '#28a745', 
                  borderBottom: '2px solid #28a745', 
                  paddingBottom: '8px' 
                }}>
                  🟢 Regular Loan Payments
                </h4>
                {filteredRegular.length > 0 ? (
                  filteredRegular.map((payment, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        background: '#f8f9ff', 
                        borderRadius: '10px', 
                        padding: '12px', 
                        marginBottom: '10px', 
                        border: '1px solid #e0e0e0' 
                      }}
                    >
                      <p style={{ margin: '5px 0', fontSize: '13px', fontWeight: '600' }}>
                        <strong>Amount:</strong> ₱{formatNumber(payment.payment_amount)}
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '13px' }}>
                        <strong>Date:</strong> {formatISODate(String(payment.date_paid || payment.payment_date || '').slice(0, 10))}
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '13px' }}>
                        <strong>OR #:</strong> {payment.or_number || 'N/A'}
                      </p>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: '#6c757d', padding: '20px 0' }}>
                    No payments found
                  </p>
                )}
              </div>

              {/* Emergency Payments Section */}
              <div>
                <h4 style={{ 
                  fontSize: '16px', 
                  fontWeight: '700', 
                  marginBottom: '15px', 
                  color: '#dc3545', 
                  borderBottom: '2px solid #dc3545', 
                  paddingBottom: '8px' 
                }}>
                  🔴 Emergency Loan Payments
                </h4>
                {filteredEmergency.length > 0 ? (
                  filteredEmergency.map((payment, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        background: '#fff5f5', 
                        borderRadius: '10px', 
                        padding: '12px', 
                        marginBottom: '10px', 
                        border: '1px solid #e0e0e0' 
                      }}
                    >
                      <p style={{ margin: '5px 0', fontSize: '13px', fontWeight: '600' }}>
                        <strong>Amount:</strong> ₱{formatNumber(payment.payment_amount)}
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '13px' }}>
                        <strong>Date:</strong> {formatISODate(String(payment.date_paid || payment.payment_date || '').slice(0, 10))}
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '13px' }}>
                        <strong>OR #:</strong> {payment.or_number || 'N/A'}
                      </p>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: '#6c757d', padding: '20px 0' }}>
                    No payments found
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Regular Payment History Modal */}
      {showRegularHistory && (
        <div className="paypal-modal-overlay" onClick={() => setShowRegularHistory(false)}>
          <div className="paypal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header regular">
              <h3>Regular Loan - Complete Payment History</h3>
              <div className="modal-actions">
                <button
                  onClick={() => handlePrint('Regular', regularPaymentHistory)}
                  className="paypal-btn small secondary"
                >
                  <BsFillPrinterFill /> Print
                </button>
                <button
                  onClick={() => setShowRegularHistory(false)}
                  className="paypal-btn small secondary"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="modal-body">
              <table className="paypal-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Date Paid</th>
                    <th>OR No.</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const normalized = normalizeHistoryForTable('Regular');
                    if (normalized.length === 0) {
                      return (
                        <tr>
                          <td colSpan="5">
                            <div className="empty-state">
                              <div className="empty-icon">📭</div>
                              <p>No payment history found for regular loans</p>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return renderHistoryWithORGrouping(normalized, 'Regular');
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Payment History Modal */}
      {showEmergencyHistory && (
        <div className="paypal-modal-overlay" onClick={() => setShowEmergencyHistory(false)}>
          <div className="paypal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header emergency">
              <h3>Emergency Loan - Complete Payment History</h3>
              <div className="modal-actions">
                <button
                  onClick={() => handlePrint('Emergency', emergencyPaymentHistory)}
                  className="paypal-btn small secondary"
                >
                  <BsFillPrinterFill /> Print
                </button>
                <button
                  onClick={() => setShowEmergencyHistory(false)}
                  className="paypal-btn small secondary"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="modal-body">
              <table className="paypal-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Date Paid</th>
                    <th>OR No.</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const normalized = normalizeHistoryForTable('Emergency');
                    if (normalized.length === 0) {
                      return (
                        <tr>
                          <td colSpan="5">
                            <div className="empty-state">
                              <div className="empty-icon">📭</div>
                              <p>No payment history found for emergency loans</p>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return renderHistoryWithORGrouping(normalized, 'Emergency');
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;