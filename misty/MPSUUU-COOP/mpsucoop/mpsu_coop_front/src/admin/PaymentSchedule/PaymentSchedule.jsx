import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IoArrowBackCircle } from "react-icons/io5";
import axios from 'axios';
import './PaymentSchedule.css';

axios.defaults.withCredentials = false;

const PaymentSchedule = () => { 
  const [accountSummaries, setAccountSummaries] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
    // Local Error Boundary scoped to this view only
    class LocalErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false };
      }
      static getDerivedStateFromError() { return { hasError: true }; }
      componentDidCatch(err, info) { console.error('PaymentSchedule render error:', err, info); }
      render() {
        if (this.state.hasError) {
          return (
            <div className="year-group-box" style={{ padding: '16px' }}>
              <h3>Something went wrong</h3>
              <p style={{ color: '#555' }}>The schedules view failed to render. Try refreshing or going back and re-opening Loan History.</p>
            </div>
          );
        }
        return this.props.children;
      }
    }

    const retryFetch = async () => {
      if (!selectedAccount) return;
      try {
        setError('');
        await fetchPaymentSchedules(selectedAccount, loanType);
      } catch (e) {
        // fetchPaymentSchedules already handles errors
      }
    };
  const [accountDetails, setAccountDetails] = useState(null);
  const [loanType, setLoanType] = useState('Regular'); 
  const [searchQuery, setSearchQuery] = useState('');

  const [remainingBalance, setRemainingBalance] = useState(0);
  const [isEditBreakDown, setIsEditBreakDown] = useState(false);
  const [breakdownAmount, setBreakDownAmount] = useState(0);
 
  const [cachedRemainingBalance, setCachedRemainingBalance] = useState(null);
  const [showCachedBalance, setShowCachedBalance] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(localStorage.getItem('sessionExpired') === 'true');
  const [originalTotal, setOriginalTotal] = useState(0);
  
  const [loanDetails, setLoanDetails] = useState(null);
  const [showOrInput, setShowOrInput] = useState(false);
  const [orNumber, setOrNumber] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const orInputRef = useRef(null);
  const [openYears, setOpenYears] = useState({});
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [paying, setPaying] = useState(false);
  const [orValidation, setOrValidation] = useState({ available: true, message: '' });
  const [payingYearlyFees, setPayingYearlyFees] = useState(false);
  const [selectedRecalcId, setSelectedRecalcId] = useState(null);
  const [showYearlyFeesOrInput, setShowYearlyFeesOrInput] = useState(false);
  const [yearlyFeesOrNumber, setYearlyFeesOrNumber] = useState('');
  // Composite payment modal state (replaces legacy advance-only modal)
  const [showCompositeEvent, setShowCompositeEvent] = useState(false);
  
  const [availableLoanTypes, setAvailableLoanTypes] = useState({ Regular: false, Emergency: false });
  // Local helper: verify payload is JSON array, not HTML/string
  const isArrayPayload = (data) => Array.isArray(data);
  const isHtmlPayload = (data) => (typeof data === 'string' && /<!DOCTYPE|<html|<!--/.test(data));


  const [editingBreakdownYear, setEditingBreakdownYear] = useState(null);

  // =============================
  // Payment Event (Hybrid / Advance / Curtail) UI State
  // =============================
  const [eventMode, setEventMode] = useState('regular'); // regular | pay_ahead | curtail | hybrid
  const [eventAmountRegular, setEventAmountRegular] = useState('');
  const [eventAmountAhead, setEventAmountAhead] = useState('');
  const [eventAmountCurtail, setEventAmountCurtail] = useState('');
  const [eventCurtailMethod, setEventCurtailMethod] = useState('shorten'); // shorten only implemented
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventScheduleId, setEventScheduleId] = useState(null); // schedule for regular portion
  const [eventResult, setEventResult] = useState(null); // last response
  const [lastRemainingPrincipal, setLastRemainingPrincipal] = useState(null);
const [showAdvancePaymentModal, setShowAdvancePaymentModal] = useState(false);
const [advancePaymentAmount, setAdvancePaymentAmount] = useState('');
const [advancePaymentOR, setAdvancePaymentOR] = useState('');
const [advancePaymentValidation, setAdvancePaymentValidation] = useState({ available: true, message: '' });
const [processingAdvancePayment, setProcessingAdvancePayment] = useState(false);
  // Derived helper: total entered amount
  const computeEventTotal = () => {
    const r = parseFloat(eventAmountRegular || '0') || 0;
    const a = parseFloat(eventAmountAhead || '0') || 0;
    const c = parseFloat(eventAmountCurtail || '0') || 0;
    return (r + a + c).toFixed(2);
  };

  const resetPaymentEventForm = () => {
    setEventMode('regular');
    setEventAmountRegular('');
    setEventAmountAhead('');
    setEventAmountCurtail('');
    setEventCurtailMethod('shorten');
    setEventScheduleId(null);
    setEventResult(null);
    setOrNumber('');
    setOrValidation({ available: true, message: '' });
  };

  const unpaidSchedules = schedules.filter(s => !s.is_paid && s.loan_type === loanType);

  const validatePaymentEvent = () => {
    const total = parseFloat(computeEventTotal());
    if (total <= 0) return 'Total amount must be greater than 0';
    if (['regular','hybrid'].includes(eventMode)) {
      const target = eventScheduleId ? unpaidSchedules.find(s => s.id === eventScheduleId) : unpaidSchedules[0];
      if (eventMode === 'regular') {
        if (!eventAmountRegular || parseFloat(eventAmountRegular) <= 0) return 'Enter regular amount';
        if (target && parseFloat(eventAmountRegular) + 0.01 < parseFloat(target.payment_amount)) {
          return 'Regular amount must cover selected schedule (no partial payments)';
        }
      }
    }
    if (eventMode === 'pay_ahead' && (!eventAmountAhead || parseFloat(eventAmountAhead) <= 0)) {
      return 'Enter pay-ahead amount';
    }
    if (eventMode === 'curtail' && (!eventAmountCurtail || parseFloat(eventAmountCurtail) <= 0)) {
      return 'Enter curtailment amount';
    }
    if (eventMode === 'hybrid') {
      const any = [eventAmountRegular,eventAmountAhead,eventAmountCurtail].some(v => parseFloat(v||'0') > 0);
      if (!any) return 'Provide at least one allocation for hybrid payment';
    }
    if (orNumber && orNumber.length !== 4) return 'OR number must be 4 digits';
    if (orNumber && !orValidation.available) return orValidation.message || 'OR number not available';
    return null;
  };

  const submitPaymentEvent = async () => {
    const token = validateToken();
    if (!token) return;
    // Simplified: determine schedule target locally for regular/hybrid if not set
    let scheduleIdToUse = eventScheduleId;
    if ((eventMode === 'regular' || eventMode === 'hybrid') && !scheduleIdToUse) {
      const earliest = unpaidSchedules[0];
      if (earliest) {
        scheduleIdToUse = earliest.id;
      }
    }
    const errMsg = validatePaymentEvent();
    if (errMsg) {
      showNotification(errMsg,'error');
      return;
    }
    const currentLoan = loanDetails; // loanDetails refers to currently loaded loan type
    if (!currentLoan || !currentLoan.control_number) {
      showNotification('Loan details not loaded','error');
      return;
    }
    setEventSubmitting(true);
    setEventResult(null);
    try {
      // Final OR re-check on submit to prevent same-day reuse
      if (orNumber && orNumber.length === 4) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const isoDate = `${yyyy}-${mm}-${dd}`;
        try {
          const orResp = await axios.get(
            `${process.env.REACT_APP_API_URL}/check-or-number/?or_number=${orNumber}&account_number=${selectedAccount}&category=Loan&loan_type=${loanType}&date_paid=${isoDate}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!orResp.data.available) {
            if (orResp.data.is_used_by_other_member) {
              showNotification(`OR ${orNumber} is already used by another member.`, 'error');
            } else if (orResp.data.is_used_same_member_different_day) {
              showNotification(`OR ${orNumber} was used on a different day.`, 'error');
            } else if (orResp.data.is_used_same_member_same_loan_type_today) {
              showNotification(`OR ${orNumber} is already used today for ${loanType} payments.`, 'error');
            } else {
              showNotification('OR number cannot be reused.', 'error');
            }
            setEventSubmitting(false);
            return;
          }
        } catch (orErr) {
          console.error('Final OR re-check failed:', orErr);
          showNotification('Error validating OR number', 'error');
          setEventSubmitting(false);
          return;
        }
      }

      const payload = {
        schedule_id: scheduleIdToUse,
        mode: eventMode,
        curtailment_method: eventCurtailMethod,
        or_number: orNumber || undefined,
        amount_regular: eventAmountRegular || '0',
        amount_pay_ahead: eventAmountAhead || '0',
        amount_curtailment: eventAmountCurtail || '0',
        notes: `Frontend composite payment (${eventMode})`
      };
      const url = `${process.env.REACT_APP_API_URL}/loans/${currentLoan.control_number}/payment-event/`;
      const resp = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }
      });
      setEventResult(resp.data.payment_event);
      if (resp.data && resp.data.loan_remaining_principal !== undefined) {
        setLastRemainingPrincipal(resp.data.loan_remaining_principal);
      }
      // Show success notification
      showNotification('Payment event processed','success');
      // Refresh schedules & loan remaining principal
      await fetchPaymentSchedules(selectedAccount, loanType);
      // Also refresh events panel
      try { await fetchPaymentEvents(); } catch (_) {}

      // Archive the composite payment event for history
      try {
        const ev = resp?.data?.payment_event || {};
        const total = parseFloat(ev.amount_total || computeEventTotal()) || 0;
        const paymentType = ev.mode === 'pay_ahead'
          ? 'Advance Payment'
          : ev.mode === 'curtail'
          ? 'Curtailment'
          : ev.mode === 'hybrid'
          ? 'Hybrid Payment'
          : 'Schedule Payment';
        const archivePayload = {
          account_number: selectedAccount,
          account_holder: accountDetails ? `${accountDetails.first_name} ${accountDetails.middle_name || ''} ${accountDetails.last_name}`.trim() : 'Unknown',
          payment_amount: total,
          loan_type: loanType,
          date_paid: new Date().toISOString(),
          or_number: orNumber || ev.or_number || null,
          payment_type: paymentType
        };
        await axios.post(
          `${process.env.REACT_APP_API_URL}/archive-payment-record/`,
          archivePayload,
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
      } catch (archiveErr) {
        console.error('Archive composite event failed:', archiveErr);
      }
      // Auto-close modal and reset form on success, no success banner
      setShowCompositeEvent(false);
      resetPaymentEventForm();
    } catch (e) {
      console.error('PaymentEvent error', e.response?.data || e.message);
      showNotification(e.response?.data?.error || 'Payment event failed','error');
    } finally {
      setEventSubmitting(false);
    }
  };
const handleAdvanceORChange = async (value) => {
  const cleaned = value.replace(/[^0-9]/g, '');
  
  if (cleaned.length <= 4) {
    setAdvancePaymentOR(cleaned);
    
    if (cleaned.length > 0 && cleaned.length < 4) {
      setAdvancePaymentValidation({ 
        available: false, 
        message: 'Please enter a 4-digit OR number' 
      });
      return;
    }
    
    if (cleaned.length === 0) {
      setAdvancePaymentValidation({ available: true, message: '' });
      return;
    }
    
    if (cleaned.length === 4) {
      try {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const isoDate = `${yyyy}-${mm}-${dd}`;

        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/check-or-number/?or_number=${cleaned}&account_number=${selectedAccount}&category=Loan&loan_type=${loanType}&date_paid=${isoDate}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
          }
        );
        if (!response.data.available) {
          if (response.data.is_used_by_other_member) {
            setAdvancePaymentValidation({ available: false, message: '❌ This OR number is already used by another member' });
          } else if (response.data.is_used_same_member_different_day) {
            setAdvancePaymentValidation({ available: false, message: '❌ OR was used on a different day and cannot be reused' });
          } else if (response.data.is_used_same_member_same_loan_type_today) {
            setAdvancePaymentValidation({ available: false, message: `❌ OR ${cleaned} is already used today for ${loanType} payments` });
          } else {
            setAdvancePaymentValidation({ available: false, message: '❌ OR cannot be reused under current rules' });
          }
        } else {
          setAdvancePaymentValidation({ available: true, message: '✅ OR number available' });
        }
      } catch (error) {
        console.error('Error checking OR:', error);
        setAdvancePaymentValidation({ 
          available: false, 
          message: 'Error checking OR availability'
        });
      }
    }
  }
};

// Add this function to process advance payment
const processAdvancePaymentWithReconstruction = async () => {
  const token = validateToken();
  if (!token) return;
  
  // Validate inputs
  if (!advancePaymentAmount || parseFloat(advancePaymentAmount) <= 0) {
    showNotification('Please enter a valid advance payment amount', 'error');
    return;
  }
  
  if (!advancePaymentOR || advancePaymentOR.length !== 4) {
    showNotification('Please enter a valid 4-digit OR number', 'error');
    return;
  }
  
  if (!advancePaymentValidation.available) {
    showNotification('OR number is not available', 'error');
    return;
  }
  
  const amount = parseFloat(advancePaymentAmount);
  const remaining = calculateRemainingBalance();
  
  if (amount > remaining) {
    showNotification(
      `Advance amount (₱${formatNumber(amount)}) exceeds remaining principal (₱${formatNumber(remaining)})`,
      'error'
    );
    return;
  }
  
  setProcessingAdvancePayment(true);
  
  try {
    // Final OR re-check to enforce same-day per-category rule
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const isoDate = `${yyyy}-${mm}-${dd}`;
    try {
      const orResp = await axios.get(
        `${process.env.REACT_APP_API_URL}/check-or-number/?or_number=${advancePaymentOR}&account_number=${selectedAccount}&category=Loan&loan_type=${loanType}&date_paid=${isoDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (orResp.data.is_used_global) {
        showNotification(`OR ${advancePaymentOR} is already used and cannot be reused.`, 'error');
        setProcessingAdvancePayment(false);
        return;
      }
      if (!orResp.data.available) {
        if (orResp.data.is_used_by_other_member) {
          showNotification(`OR ${advancePaymentOR} is already used by another member.`, 'error');
        } else if (orResp.data.is_used_same_member_different_day) {
          showNotification(`OR ${advancePaymentOR} was used on a different day.`, 'error');
        } else if (orResp.data.is_used_same_member_same_loan_type_today) {
          showNotification(`OR ${advancePaymentOR} is already used today for ${loanType} payments.`, 'error');
        } else {
          showNotification('OR number cannot be reused.', 'error');
        }
        setProcessingAdvancePayment(false);
        return;
      }
    } catch (orErr) {
      console.error('Final OR re-check (advance) failed:', orErr);
      showNotification('Error validating OR number', 'error');
      setProcessingAdvancePayment(false);
      return;
    }

    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/process-advance-payment-reconstruction/`,
      {
        loan_control_number: loanDetails.control_number,
        advance_amount: advancePaymentAmount,
        or_number: advancePaymentOR
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.success) {
      // Show success message
      const message = response.data.loan_settled 
        ? '🎉 Congratulations! Loan fully paid with advance payment!'
        : `✅ Advance payment successful! ${response.data.new_schedules_created} new schedules created.`;
      
      showNotification(message, 'success');
      
      // Archive this advance payment so it reflects in Payments view
      try {
        const archivePayload = {
          account_number: selectedAccount,
          account_holder: accountDetails ? `${accountDetails.first_name} ${accountDetails.middle_name || ''} ${accountDetails.last_name}`.trim() : 'Unknown',
          payment_amount: parseFloat(advancePaymentAmount) || 0,
          loan_type: loanType,
          loan_control_number: loanDetails?.control_number,
          date_paid: new Date().toISOString(),
          or_number: advancePaymentOR,
          payment_type: 'Advance Payment'
        };
        await axios.post(
          `${process.env.REACT_APP_API_URL}/archive-payment-record/`,
          archivePayload,
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
      } catch (archiveErr) {
        console.error('Archive advance reconstruction failed:', archiveErr);
      }
      
      // Close modal
      setShowAdvancePaymentModal(false);
      setAdvancePaymentAmount('');
      setAdvancePaymentOR('');
      setAdvancePaymentValidation({ available: true, message: '' });
      
      // If loan is settled, go back to accounts list
      if (response.data.loan_settled) {
        setTimeout(() => {
          fetchAccountSummaries();
          setSelectedAccount(null);
        }, 2000);
      } else {
        // Refresh schedules to show reconstructed payment plan
        await fetchPaymentSchedules(selectedAccount, loanType);
      }
    }
  } catch (error) {
    console.error('Error processing advance payment:', error);
    showNotification(
      error.response?.data?.error || 'Error processing advance payment',
      'error'
    );
  } finally {
    setProcessingAdvancePayment(false);
  }
};
  // Switch loan type and reload schedules for current account
  const handleLoanTypeChange = async (type) => {
    setLoanType(type);
    if (selectedAccount) {
      await fetchPaymentSchedules(selectedAccount, type);
    }
  };

  
  const toggleYear = (year) => {
    setOpenYears((prev) => ({ ...prev, [year]: !prev[year] }));
  };

  // ✅ Helper: Get all years that have unpaid schedules
  const getYearsWithUnpaidSchedules = () => {
    const grouped = schedules.reduce((acc, schedule) => {
      const year = Number(schedule.year_number) || 1;
      if (!acc[year]) acc[year] = [];
      acc[year].push(schedule);
      return acc;
    }, {});
    
    return Object.entries(grouped)
      .filter(([_, yearSchedules]) => yearSchedules.some(s => !s.is_paid))
      .map(([year, _]) => Number(year))
      .sort((a, b) => a - b);
  };

  useEffect(() => {
    if (showOrInput && orInputRef.current) {
      setTimeout(() => {
        orInputRef.current.focus();
      }, 100);
    }
  }, [showOrInput]);
  const update_breakdown = async () => {
    const allUnpaidSchedules = schedules.filter((e) => !e.is_paid);
    
    if (allUnpaidSchedules.length === 0) {
      showNotification("No unpaid schedules to update", "error");
      return;
    }

    const paidSchedules = schedules.filter(s => s.is_paid).length;
    const MAX_TOTAL_SCHEDULES = loanDetails.loan_type === 'Regular' ? 96 : 12;
    const maxYears = loanDetails.loan_type === 'Regular' ? 4 : 0.5;

    const totalRemaining = Math.round(allUnpaidSchedules.reduce((sum, s) => sum + (parseFloat(s.principal_amount) || 0), 0) * 100) / 100;
    const breakdownValue = parseFloat(breakdownAmount);
    const originalPrincipal = parseFloat(
      (allUnpaidSchedules[0] && allUnpaidSchedules[0].original_principal) != null
        ? allUnpaidSchedules[0].original_principal
        : (loanDetails && loanDetails.principal) || 0
    );

    if (!breakdownAmount || breakdownValue <= 0) {
      showNotification("Invalid amount - must be greater than 0", "error");
      return;
    }

    if (breakdownValue < originalPrincipal) {
      showNotification(
        `Principal per payment (₱${formatNumber(breakdownValue)}) cannot be less than the original principal per payment (₱${formatNumber(originalPrincipal)})`,
        "error"
      );
      return;
    }

    if (breakdownValue > totalRemaining) {
      showNotification(
        `Principal per payment (₱${formatNumber(breakdownValue)}) cannot exceed total remaining principal (₱${formatNumber(totalRemaining.toFixed(2))})`,
        "error"
      );
      return;
    }

    // ✅ Calculate ACTUAL number of payments this will create
    const calculatedPayments = Math.ceil(totalRemaining / breakdownValue);
    const totalAfterUpdate = paidSchedules + calculatedPayments;
    
    // ✅ Show user what will actually happen
    console.log(`
      📊 Breakdown Calculation:
      - Remaining Principal: ₱${formatNumber(totalRemaining)}
      - Principal per Payment: ₱${formatNumber(breakdownValue)}
      - Calculated Payments: ${calculatedPayments}
      - Already Paid: ${paidSchedules}
      - Total After Update: ${totalAfterUpdate}
      - Maximum Allowed: ${MAX_TOTAL_SCHEDULES}
    `);
    
    if (totalAfterUpdate > MAX_TOTAL_SCHEDULES) {
      const availableSchedules = MAX_TOTAL_SCHEDULES - paidSchedules;
      const yearsPaid = (paidSchedules / 24).toFixed(1);
      
      showNotification(
        `Cannot exceed ${maxYears}-year loan term (${MAX_TOTAL_SCHEDULES} total payments). You've already paid ${paidSchedules} schedules (${yearsPaid} years). This breakdown would create ${calculatedPayments} schedules (total ${totalAfterUpdate}), exceeding the maximum by ${totalAfterUpdate - MAX_TOTAL_SCHEDULES}. Maximum remaining: ${availableSchedules} schedules.`,
        "error"
      );
      return;
    }

    // Cache current balance for display
    const currentBalance = calculateRemainingBalance();
    setCachedRemainingBalance(currentBalance);
    setShowCachedBalance(true);

    const schedules_id = allUnpaidSchedules.map((e) => e.id);

    try {
      console.log('📤 Sending update request:', {
        loan_control_number: loanDetails.control_number,
        shorten_to: calculatedPayments,  // Send calculated, not arbitrary number
        new_amount: breakdownValue.toFixed(2),
        remaining_principal: totalRemaining.toFixed(2),
        paid_count: paidSchedules
      });

      const payload = {
        loan_control_number: loanDetails.control_number,
        shorten_to: calculatedPayments,  // ✅ Send CALCULATED payments
        new_amount: breakdownValue
      };

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/update-breakdown/`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Update response:', response.data);

      if (response.status === 200) {
        await fetchPaymentSchedules(selectedAccount, loanType);
        
        setShowCachedBalance(false);
        setIsEditBreakDown(false);
        setBreakDownAmount(0);
        setEditingBreakdownYear(null);
        
        const effectiveCount = response.data?.calculated_from_remaining || calculatedPayments;
        const totalAfter = parseFloat(response.data?.totals?.after_total || totalRemaining);
        const perPayment = parseFloat(response.data?.totals?.per_payment || breakdownValue);
        
        showNotification(
          `✅ Breakdown updated: ${effectiveCount} payments of ₱${formatNumber(perPayment)} each. Total: ₱${formatNumber(totalAfter)}`, 
          "success"
        );
      }
    } catch (error) {
      console.error("❌ Error updating breakdown:", error);
      const errorMsg = error.response?.data?.error || "Failed to update breakdown";
      showNotification(errorMsg, "error");
      setShowCachedBalance(false);
    }
  };
// const update_breakdown = async () => {
//   // ✅ Get ALL UNPAID schedules across ALL YEARS
//   const allUnpaidSchedules = schedules.filter((e) => !e.is_paid);
  
//   if (allUnpaidSchedules.length === 0) {
//     showNotification("No unpaid schedules to update", "error");
//     return;
//   }

//   // Compute totals for ALL YEARS
//   const totalRemaining = Math.round(allUnpaidSchedules.reduce((sum, s) => sum + (parseFloat(s.principal_amount) || 0), 0) * 100) / 100;
//   const breakdownValue = parseFloat(breakdownAmount);
//   const originalPrincipal = parseFloat(
//     (allUnpaidSchedules[0] && allUnpaidSchedules[0].original_principal) != null
//       ? allUnpaidSchedules[0].original_principal
//       : (loanDetails && loanDetails.principal) || 0
//   );

//   // ✅ VALIDATION
//   if (!breakdownAmount || breakdownValue <= 0) {
//     showNotification("Invalid amount - must be greater than 0", "error");
//     return;
//   }

//   if (breakdownValue < originalPrincipal) {
//     showNotification(
//       `Principal per payment (₱${formatNumber(breakdownValue)}) cannot be less than the original principal per payment (₱${formatNumber(originalPrincipal)})`,
//       "error"
//     );
//     return;
//   }

//   if (breakdownValue > totalRemaining) {
//     showNotification(
//       `Principal per payment (₱${formatNumber(breakdownValue)}) cannot exceed total remaining principal (₱${formatNumber(totalRemaining.toFixed(2))})`,
//       "error"
//     );
//     return;
//   }

//   // ✅ Calculate how many payments this will create ACROSS ALL YEARS
//   const newPaymentCount = Math.ceil(totalRemaining / breakdownValue);
//   const oldPaymentCount = allUnpaidSchedules.length;

//   // Cache current balance for display
//   const currentBalance = calculateRemainingBalance();
//   setCachedRemainingBalance(currentBalance);
//   setShowCachedBalance(true);

//   const schedules_id = allUnpaidSchedules.map((e) => e.id);

//   try {
//     console.log('📤 Sending update request for ALL YEARS:', {
//       schedules_id,
//       new_principal_per_payment: breakdownValue.toFixed(2),
//       original_principal: originalPrincipal.toFixed(2),
//       total_remaining: totalRemaining.toFixed(2),
//       old_payment_count: oldPaymentCount,
//       new_payment_count: newPaymentCount
//     });

//     // ✅ Prefer new API (loan_control_number), but fallback to schedules_id for older servers
//     let response;
//     if (loanDetails && loanDetails.control_number) {
//       const payload = {
//         loan_control_number: loanDetails.control_number,
//         shorten_to: newPaymentCount,
//         new_amount: breakdownValue
//       };
//       try {
//         response = await axios.post(
//           '${process.env.REACT_APP_API_URL}/update-breakdown/',
//           payload,
//           {
//             headers: {
//               Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
//               'Content-Type': 'application/json',
//             },
//           }
//         );
//       } catch (e) {
//         // Fallback to legacy payload shape if server rejects new format
//         console.warn('🔁 Falling back to legacy breakdown API payload (schedules_id).');
//         response = await axios.post(
//           '${process.env.REACT_APP_API_URL}/update-breakdown/',
//           { schedules_id, new_amount: breakdownValue },
//           {
//             headers: {
//               Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
//               'Content-Type': 'application/json',
//             },
//           }
//         );
//       }
//     } else {
//       // If loan details missing, still try legacy payload to avoid blocking the action
//       response = await axios.post(
//         '${process.env.REACT_APP_API_URL}/update-breakdown/',
//         { schedules_id, new_amount: breakdownValue },
//         {
//           headers: {
//             Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
//             'Content-Type': 'application/json',
//           },
//         }
//       );
//     }

//     console.log('✅ Update response:', response.data);

//     if (response.status === 200) {
//       // Refresh schedules to show updated data
//       await fetchPaymentSchedules(selectedAccount, loanType);
      
//       setShowCachedBalance(false);
//       setIsEditBreakDown(false);
//       setBreakDownAmount(0);
//       setEditingBreakdownYear(null);
      
//       const effectiveCount = response.data?.shorten_to || newPaymentCount || response.data?.new_payment_count;
//       showNotification(`✅ Breakdown updated across all years. New total payments: ${effectiveCount}.`, "success");
//     }
//   } catch (error) {
//     console.error("❌ Error updating breakdown:", error);
//     console.error("Error details:", error.response?.data);
//     const errorMsg = error.response?.data?.error || "Failed to update breakdown";
//     showNotification(errorMsg, "error");
//     setShowCachedBalance(false);
//   }
// };

  const formatNumber = (number) => {
    if (number == null || number === '') return 'N/A';
    const n = typeof number === 'string' ? Number(number) : number;
    if (Number.isNaN(n)) return 'N/A';
    const isWhole = Number.isInteger(n);
    return isWhole
      ? n.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // =============================
  // Payment Event Form Component
  // =============================
  const PaymentEventForm = () => {
    const currentLoan = loanDetails;
    if (!currentLoan || !currentLoan.control_number) return null;
    return (
      <div className="payment-event-panel">
        <h3>Composite Payment Event</h3>
        <div className="payment-event-row">
          <label>Mode:</label>
          <select value={eventMode} onChange={e => setEventMode(e.target.value)} disabled={eventSubmitting}>
            <option value="regular">Regular</option>
            <option value="pay_ahead">Pay Ahead</option>
            <option value="curtail">Curtailment</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        {/* Simplified: remove schedule picker; auto-target earliest unpaid */}
        {['regular','hybrid'].includes(eventMode) && (
          <div className="payment-event-row">
            <label>Amount (Regular):</label>
            <input type="number" step="0.01" value={eventAmountRegular} onChange={e=>setEventAmountRegular(e.target.value)} disabled={eventSubmitting} />
          </div>
        )}
        {['pay_ahead','hybrid'].includes(eventMode) && (
          <div className="payment-event-row">
            <label>Amount (Pay Ahead):</label>
            <input type="number" step="0.01" value={eventAmountAhead} onChange={e=>setEventAmountAhead(e.target.value)} disabled={eventSubmitting} />
          </div>
        )}
        {['curtail','hybrid'].includes(eventMode) && (
          <>
            <div className="payment-event-row">
              <label>Amount (Curtail):</label>
              <input type="number" step="0.01" value={eventAmountCurtail} onChange={e=>setEventAmountCurtail(e.target.value)} disabled={eventSubmitting} />
            </div>
            <div className="payment-event-row">
              <label>Curtail Method:</label>
              <select value={eventCurtailMethod} onChange={e=>setEventCurtailMethod(e.target.value)} disabled={eventSubmitting}>
                <option value="shorten">Shorten Term</option>
                <option value="redistribute">Redistribute</option>
              </select>
            </div>
          </>
        )}
        <div className="payment-event-row">
          <label>OR Number (optional):</label>
          <input type="text" maxLength={4} value={orNumber} onChange={e=>handleOrChange(e.target.value)} disabled={eventSubmitting} />
          {orValidation.message && <span className={orValidation.available? 'or-ok':'or-error'}>{orValidation.message}</span>}
        </div>
        <div className="payment-event-summary">Total: ₱{computeEventTotal()}</div>
        <div className="payment-event-actions">
          <button onClick={submitPaymentEvent} disabled={eventSubmitting}>Submit</button>
          <button onClick={resetPaymentEventForm} disabled={eventSubmitting}>Reset</button>
        </div>
        {eventResult && (
          <div className="payment-event-result">
            <strong>Last Event:</strong> #{eventResult.id} Mode {eventResult.mode} Total ₱{eventResult.amount_total} Covered: {eventResult.covered_schedule_ids?.length || 0}
            {lastRemainingPrincipal !== null && (
              <div>Loan Remaining Principal: ₱{formatNumber(lastRemainingPrincipal)}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // =============================
  // Payment Events Summary (Advance/Curtail)
  // =============================
  const [paymentEvents, setPaymentEvents] = useState([]);

  const fetchPaymentEvents = useCallback(async () => {
    const token = validateToken();
    if (!token) return;
    const currentLoan = loanDetails;
    if (!currentLoan || !currentLoan.control_number) return;
    try {
      const url = `${process.env.REACT_APP_API_URL}/loans/${currentLoan.control_number}/payment-event/`;
      const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setPaymentEvents(resp.data?.events || []);
    } catch (e) {
      // silent fail
    }
  }, [loanDetails]);

  useEffect(() => { fetchPaymentEvents(); }, [fetchPaymentEvents]);

  const PaymentEventsSummary = () => {
    if (!paymentEvents || paymentEvents.length === 0) return null;
    const ahead = paymentEvents.filter(e => e.mode === 'pay_ahead' || (e.mode === 'hybrid' && parseFloat(e.amount_pay_ahead||'0')>0));
    const curtail = paymentEvents.filter(e => e.mode === 'curtail' || (e.mode === 'hybrid' && parseFloat(e.amount_curtailment||'0')>0));
    const totalCovered = ahead.reduce((n,e)=> n + (Array.isArray(e.covered_schedule_ids)? e.covered_schedule_ids.length:0), 0);
    const totalCurtail = curtail.reduce((n,e)=> n + (Array.isArray(e.covered_schedule_ids)? e.covered_schedule_ids.length:0), 0);
    return (
      <div className="payment-event-summary-panel">
        <h3>Advance & Curtailment Summary</h3>
        <div>Advance Covered Schedules: {totalCovered}</div>
        <div>Curtailment Removed Schedules: {totalCurtail}</div>
        <div className="event-list">
          {paymentEvents.slice(0,5).map(ev => (
            <div key={ev.id} className="event-item">
              <span>#{ev.id} {ev.mode}</span>
              <span> Total ₱{ev.amount_total}</span>
              {ev.or_number && <span> OR {ev.or_number}</span>}
              {ev.covered_schedule_ids?.length>0 && <span> Covered {ev.covered_schedule_ids.length}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Paid schedules that were advance-covered: show OR and dates
  const PaidAdvanceSummary = () => {
    const advPaid = schedules.filter(s => !!s.is_paid && (s.status_label === 'Advance Payment' || !!s.advance_covered));
    if (!advPaid || advPaid.length === 0) return null;
    return (
      <div className="payment-event-summary-panel">
        <h3>Advance-Covered Paid Schedules</h3>
        <div className="event-list">
          {advPaid.slice(0,10).map(s => (
            <div key={s.id} className="event-item">
              <span>#{s.id}</span>
              <span> Due {formatISODate(s.due_date)}</span>
              <span> Paid {formatISODate(s.date_paid)}</span>
              <span> OR {s.or_number || s.advance_or_number || 'N/A'}</span>
            </div>
          ))}
        </div>
      </div>
    );
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

  const showNotification = (message, type = 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: '', type: '' });
    }, 2000);
  };

  const checkOrAvailability = async (orNumber) => {
    if (!orNumber || orNumber.length !== 4) {
      setOrValidation({ available: false, message: 'Please enter a 4-digit OR number' });
      return false;
    }

    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/check-or-availability/${selectedAccount}/${orNumber}/`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (response.data.available) {
        setOrValidation({ available: true, message: '✅ OR number is available' });
        return true;
      } else {
        setOrValidation({ 
          available: false, 
          message: response.data.reason 
        });
        return false;
      }
    } catch (error) {
      console.error('Error checking OR:', error);
      setOrValidation({ 
        available: false, 
        message: 'Error checking OR availability' 
      });
      return false;
    }
  };

  const handleOrChange = async (value) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    
    if (cleaned.length <= 4) {
      setOrNumber(cleaned);
      
      if (cleaned.length > 0 && cleaned.length < 4) {
        setOrValidation({ 
          available: false, 
          message: 'Please enter a 4-digit OR number' 
        });
        return;
      }
      
      if (cleaned.length === 0) {
        setOrValidation({ available: true, message: '' });
        return;
      }
      
      if (cleaned.length === 4) {
        try {
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          const isoDate = `${yyyy}-${mm}-${dd}`;
          const response = await axios.get(
            `${process.env.REACT_APP_API_URL}/check-or-number/?or_number=${cleaned}&account_number=${selectedAccount}&category=Loan&loan_type=${loanType}&date_paid=${isoDate}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
              },
            }
          );
          if (!response.data.available) {
            if (response.data.is_used_by_other_member) {
              setOrValidation({ available: false, message: '❌ This OR number is already used by another member' });
            } else if (response.data.is_used_same_member_different_day) {
              setOrValidation({ available: false, message: '❌ OR was used on a different day and cannot be reused' });
            } else if (response.data.is_used_same_member_same_loan_type_today) {
              setOrValidation({ available: false, message: `❌ OR ${cleaned} is already used today for ${loanType} payments` });
            } else {
              setOrValidation({ available: false, message: '❌ OR cannot be reused under current rules' });
            }
          } else {
            setOrValidation({ available: true, message: '✅ OR number available' });
          }
        } catch (error) {
          console.error('Error checking OR:', error);
          setOrValidation({ 
            available: false, 
            message: error.response?.data?.message || 'Error checking OR availability'
          });
        }
      }
    }
  };

  const formatRemainingBalance = (number) => {
    if (number == null || isNaN(number)) return "N/A";
    
    // ✅ Round to 2 decimal places to avoid floating point display issues
    const rounded = Math.round(parseFloat(number) * 100) / 100;
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(rounded);
  };

  const validateToken = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setError("Missing authentication token. Please log in again.");
      showNotification("Missing authentication token. Please log in again.", "error");
      return null;
    }
    return token;
  };

    //ANINA KA
  const fetchAndLoadAccountSchedules = async (accountNumber) => {
    setLoading(true);
    
    const token = validateToken();
    if (!token) return;

    try {
      // First, check which loan types have schedules for this account
      const regularResponse = await axios.get(
        `${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}&loan_type=Regular`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!isArrayPayload(regularResponse.data)) {
        // Handle HTML or bad payload gracefully
        setError('Failed to load regular loan schedules. Please refresh and ensure you are logged in.');
        setLoading(false);
        return;
      }

      const emergencyResponse = await axios.get(
        `${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}&loan_type=Emergency`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!isArrayPayload(emergencyResponse.data)) {
        setError('Failed to load emergency loan schedules. Please refresh and ensure you are logged in.');
        setLoading(false);
        return;
      }

      const hasRegular = regularResponse.data && regularResponse.data.length > 0;
      const hasEmergency = emergencyResponse.data && emergencyResponse.data.length > 0;

      setAvailableLoanTypes({ Regular: hasRegular, Emergency: hasEmergency });

      // Determine which loan type to load
      let typeToLoad = 'Regular'; // default
      
      if (hasEmergency && !hasRegular) {
        // Only Emergency loans exist
        typeToLoad = 'Emergency';
      } else if (hasRegular && !hasEmergency) {
        // Only Regular loans exist
        typeToLoad = 'Regular';
      } else if (hasRegular && hasEmergency) {
        // Both exist, default to Regular
        typeToLoad = 'Regular';
      }

      // Set the loan type and fetch schedules
      setLoanType(typeToLoad);
      setLoading(false);
      
      // Now fetch with the correct type
      await fetchPaymentSchedules(accountNumber, typeToLoad);
      
    } catch (err) {
      console.error('Error checking available loan types:', err);
      setLoading(false);
      // Fallback to regular
      if (err?.response?.status === 401) {
        showNotification('Session expired. Please log in again.', 'error');
        setSessionExpired(true);
        return;
      }
      await fetchPaymentSchedules(accountNumber, 'Regular');
    }
  };
    //ANINA KA END
  // misty whole of account summaries
  const fetchAccountSummaries = async () => {
    setLoading(true);
    setError('');
    
    const token = validateToken();
    if (!token) return;

    try {
      // ✅ Fetch summaries for BOTH loan types
      const regularResponse = await axios.get(`${process.env.REACT_APP_API_URL}/payment-schedules/summaries/?loan_type=Regular`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const emergencyResponse = await axios.get(`${process.env.REACT_APP_API_URL}/payment-schedules/summaries/?loan_type=Emergency`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Combine both responses
      const allSummaries = [...regularResponse.data, ...emergencyResponse.data];
      
      const uniqueSummaries = allSummaries.reduce((acc, summary) => {
        const key = `${summary.account_number}-${summary.loan_type_annotated || 'Regular'}`;
        if (!acc[key]) {
          acc[key] = { 
            ...summary,
            loan_type: summary.loan_type_annotated || 'Regular', // ✅ Store loan type
            total_balance: summary.total_balance || 0 
          };
        } else {
          acc[key].total_balance += summary.total_balance || 0;
        }
        return acc;
      }, {});

      const summaryValues = Object.values(uniqueSummaries);
      const accountNumbers = summaryValues.map(s => s.account_number);
      
      // Fetch member names
      const namePromises = accountNumbers.map((accountNumber) =>
        axios.get(`${process.env.REACT_APP_API_URL}/members/?account_number=${accountNumber}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      const nameResponses = await Promise.all(namePromises);

      summaryValues.forEach((summary, index) => {
        const memberData = nameResponses[index].data[0];
        if (memberData) {
          summary.account_holder = `${memberData.first_name} ${memberData.middle_name} ${memberData.last_name}`;
        }
      });

      setAccountSummaries(summaryValues);

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
const handlePayYearlyFees = async (recalc, orNumber) => {
  if (!orNumber || orNumber.length !== 4) {
    showNotification("Please enter a 4-digit OR number", "error");
    return;
  }
  
  // ✅ Validate we have all required data
  if (!loanDetails || !loanDetails.control_number) {
    showNotification("Loan details not loaded", "error");
    return;
  }
  
  // ✅ Better validation for recalc data
  if (!recalc || !recalc.year || recalc.total_fees_due === null || recalc.total_fees_due === undefined || recalc.total_fees_due === '') {
    console.error('❌ Invalid recalc data:', recalc);
    showNotification("Invalid recalculation data", "error");
    return;
  }
  
  setPayingYearlyFees(true);
  
  try {
    const token = localStorage.getItem('accessToken');
    
    const payload = {
      loan_control_number: loanDetails.control_number,
      year: recalc.year,
      or_number: orNumber,
      amount: recalc.total_fees_due
    };
    
    console.log('📤 Sending payment request:', payload);
    
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/api/yearly-fees/pay/`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ Payment response:', response.data);
    
    if (response.data.success) {
      showNotification(`Year ${recalc.year} fees payment successful!`, "success");
      setShowYearlyFeesOrInput(false);
      setYearlyFeesOrNumber('');
      setSelectedRecalcId(null);
      
      // Refresh loan details
      await fetchPaymentSchedules(selectedAccount, loanType);
    }
  } catch (error) {
    console.error('❌ Error paying yearly fees:', error);
    console.error('Error response:', error.response?.data);
    showNotification(
      error.response?.data?.error || "Error processing payment", 
      "error"
    );
  } finally {
    setPayingYearlyFees(false);
  }
};
  // const fetchAccountSummaries = async () => {
  //   setLoading(true);
  //   setError('');
    
  //   const token = validateToken();
  //   if (!token) return;

  //   try {
  //     const response = await axios.get('${process.env.REACT_APP_API_URL}/payment-schedules/summaries/', {
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //       },
  //     });

  //     const uniqueSummaries = response.data.reduce((acc, summary) => {
  //       if (!acc[summary.account_number]) {
  //         acc[summary.account_number] = { 
  //           ...summary, 
  //           total_balance: summary.total_balance || 0 
  //         };
  //       } else {
  //         acc[summary.account_number].total_balance += summary.total_balance || 0;
  //       }
  //       return acc;
  //     }, {});

  //     const accountNumbers = Object.keys(uniqueSummaries);
  //     const namePromises = accountNumbers.map((accountNumber) =>
  //       axios.get(`${process.env.REACT_APP_API_URL}/members/?account_number=${accountNumber}`, {
  //         headers: {
  //           Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
  //         },
  //       })
  //     );
  //     const nameResponses = await Promise.all(namePromises);

  //     accountNumbers.forEach((accountNumber, index) => {
  //       const memberData = nameResponses[index].data[0];
  //       if (memberData) {
  //         uniqueSummaries[accountNumber].account_holder = `${memberData.first_name} ${memberData.middle_name} ${memberData.last_name}`;
  //       }
  //     });

  //     setAccountSummaries(Object.values(uniqueSummaries));

  //   } catch (err) {
  //     console.error('Error fetching account summaries:', err);
  //     if (err.response?.status === 401) {
  //       setError(
  //         <div className="session-expired-overlay">
  //           <div className="session-expired-modal">
  //             <p className="session-expired-message">
  //               You have been away for quite some time, so we logged you out.<br />
  //               Please log in again to continue.
  //             </p>
  //             <button 
  //               onClick={() => {
  //                 localStorage.removeItem('sessionExpired');
  //                 localStorage.removeItem('accessToken');
  //                 localStorage.removeItem('userRole');
  //                 window.location.href = '/';
  //               }} 
  //               className="session-expired-button"
  //             >
  //               Log In
  //             </button>
  //           </div>
  //         </div>
  //       );
  //       return;
  //     }
  //     setError('Failed to fetch account summaries.');
  //   } finally {
  //     setLoading(false);
  //   }
  // };
// atf 
const fetchPaymentSchedules = async (accountNumber, loanType) => {
  setSchedules([]);
  setLoading(true);
  setError('');

  const token = validateToken();
  if (!token) return;

  try {
    console.log(`\n🔍 Fetching schedules for account ${accountNumber}, type ${loanType}`);
    
    // ✅ STEP 1: Fetch payment schedules FIRST
    const response = await axios.get(
      `${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}&loan_type=${loanType}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    // Guard against HTML or unexpected payload (e.g., index.html comment)
    if (!isArrayPayload(response.data)) {
      console.error('Unexpected schedules payload (not an array):', response.data);
      // We are not in a catch block; respond with a generic message
      setError('Failed to load schedules. Please refresh and ensure you are logged in.');
      setSchedules([]);
      setLoanDetails(null);
      setLoading(false);
      return;
    }

    console.log(`📋 Found ${response.data.length} payment schedules`);

    if (response.data.length === 0) {
      console.log(`⚠️ No schedules found for this account/loan type`);
      setSchedules([]);
      setLoanDetails(null);
      setLoading(false);
      return;
    }
    
    setSchedules(response.data);
    setSelectedAccount(accountNumber);

    // ✅ STEP 2: Get member details
    const memberResponse = await axios.get(
      `${process.env.REACT_APP_API_URL}/members/?account_number=${accountNumber}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      }
    );
    setAccountDetails(memberResponse.data[0]);

    // ✅ STEP 3: CRITICAL - Get the loan FK from the FIRST SCHEDULE
    // This is the loan that these schedules actually belong to
    const firstSchedule = response.data[0];
    const scheduleLoanId = firstSchedule.loan; // This is the FK (control_number)
    
    console.log(`🔗 Schedules belong to loan: ${scheduleLoanId}`);

    // ✅ STEP 4: Verify this is the ACTIVE loan
    // If member has multiple loans, we need the one with unpaid schedules
    const allLoansResponse = await axios.get(
      `${process.env.REACT_APP_API_URL}/loans/?account=${accountNumber}&loan_type=${loanType}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    console.log(`📊 Account has ${allLoansResponse.data.length} ${loanType} loans total`);
    
    // Find the loan that matches our schedules
    const activeLoan = allLoansResponse.data.find(
      loan => loan.control_number === scheduleLoanId
    );
    
    if (!activeLoan) {
      console.error(`❌ ERROR: Could not find loan ${scheduleLoanId} in loan list!`);
      setError('Data inconsistency detected. Please contact support.');
      setLoading(false);
      return;
    }
    
    console.log(`✅ Active loan confirmed: ${activeLoan.control_number}`);
    console.log(`   Status: ${activeLoan.status}`);
    console.log(`   Amount: ${activeLoan.loan_amount}`);

    // ✅ STEP 5: Fetch detailed loan info for THIS SPECIFIC loan
    await new Promise(resolve => setTimeout(resolve, 500));

    const loanDetailResponse = await axios.get(
      `${process.env.REACT_APP_API_URL}/loans/${scheduleLoanId}/detailed_loan_info/`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    console.log(`✅ Received loan details for ${scheduleLoanId}:`);
    console.log(`   Control: ${loanDetailResponse.data.control_number}`);
    console.log(`   Recalculations: ${loanDetailResponse.data.yearly_recalculations?.length || 0}`);
    // Debug: show reloan eligibility payload
    try {
      const rel = loanDetailResponse.data.reloan_eligibility;
      if (rel) {
        console.log('🔎 Reloan Eligibility (backend):', rel);
        if (rel.counts) {
          console.log('   counts:', rel.counts);
        }
      } else {
        console.log('🔎 Reloan Eligibility (backend): <none>');
      }
    } catch (e) {
      console.warn('Could not log reloan eligibility:', e);
    }
    
    // ✅ STEP 6: CRITICAL VERIFICATION - Filter recalculations
    if (loanDetailResponse.data.yearly_recalculations) {
      const originalCount = loanDetailResponse.data.yearly_recalculations.length;
      
      // Filter to only include recalculations for THIS loan
      loanDetailResponse.data.yearly_recalculations = 
        loanDetailResponse.data.yearly_recalculations.filter(
          r => r.loan_control_number === scheduleLoanId
        );
      
      const filteredCount = loanDetailResponse.data.yearly_recalculations.length;

      if (filteredCount > 0) {
        console.log('✅ Verifying fees_paid status for each recalculation:');
        loanDetailResponse.data.yearly_recalculations.forEach(r => {
          console.log(`   Year ${r.year}: fees_paid=${r.fees_paid}, OR=${r.fees_or_number || 'N/A'}`);
        });
      }
      
      if (originalCount !== filteredCount) {
        console.error(`❌ MISMATCH DETECTED!`);
        console.error(`   Original recalcs: ${originalCount}`);
        console.error(`   After filtering: ${filteredCount}`);
        console.error(`   Removed ${originalCount - filteredCount} incorrect recalculations`);
      } else {
        console.log(`✅ All ${filteredCount} recalculations verified for loan ${scheduleLoanId}`);
      }
      
      // Log each recalculation for debugging
      loanDetailResponse.data.yearly_recalculations.forEach(r => {
        console.log(`   Year ${r.year}: prev_bal=${r.previous_balance}, total_fees_due=${r.total_fees_due}, paid=${r.fees_paid}`);
      });
    }
    
    setLoanDetails(loanDetailResponse.data);
    
  } catch (err) {
    console.error('Error fetching schedules or loan details:', err);
    if (err.response?.status === 401) {
      showNotification("Session expired. Please log in again.", "error");
      setSessionExpired(true);
      return;
    }
    setError('Failed to fetch payment schedules, account, or loan details. Please try again.');
  } finally {
    setLoading(false);
  }
};
  // const fetchPaymentSchedules = async (accountNumber, loanType) => {
  //   setSchedules([]);
  //   setLoading(true);
  //   setError('');

  //   const token = validateToken();
  //   if (!token) return;

  //   try {
  //     const response = await axios.get(
  //       `${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}&loan_type=${loanType}`,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //       }
  //     );
  //     setSchedules(response.data);
  //     setSelectedAccount(accountNumber);

  //     const memberResponse = await axios.get(
  //       `${process.env.REACT_APP_API_URL}/members/?account_number=${accountNumber}`,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
  //         },
  //       }
  //     );
  //     setAccountDetails(memberResponse.data[0]);

  //     const loanListResponse = await axios.get(
  //       `${process.env.REACT_APP_API_URL}/loans/?account=${accountNumber}&loan_type=${loanType}`,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //       }
  //     );
  //     if (loanListResponse.data && loanListResponse.data.length > 0) {
  //       const controlNumber = loanListResponse.data[0].control_number;

  //       await new Promise(resolve => setTimeout(resolve, 1000)); 

  //       const loanDetailResponse = await axios.get(
  //         `${process.env.REACT_APP_API_URL}/loans/${controlNumber}/detailed_loan_info/`,
  //         {
  //           headers: {
  //             Authorization: `Bearer ${token}`,
  //           },
  //         }
  //       );
        
  //       setLoanDetails(loanDetailResponse.data);
  //     } else {
  //       setLoanDetails(null);
  //     }
  //   } catch (err) {
  //     console.error('Error fetching schedules or loan details:', err);
  //     if (err.response?.status === 401) {
  //       showNotification("Session expired. Please log in again.", "error");
  //       return;
  //     }
  //     setError('Failed to fetch payment schedules, account, or loan details. Please try again.');
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  
  const handleOrSubmit = async () => {
    if (!orNumber || orNumber.length !== 4) {
      showNotification("Please enter a 4-digit OR number", "error");
      return;
    }

    try {
      const token = validateToken();
      if (!token) return;

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const isoDate = `${yyyy}-${mm}-${dd}`;

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/check-or-number/?or_number=${orNumber}&account_number=${selectedAccount}&category=Loan&loan_type=${loanType}&date_paid=${isoDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.data.available) {
        if (response.data.is_used_by_other_member) {
          showNotification(`OR ${orNumber} is already used by another member. Please use a different OR number.`, 'error');
        } else if (response.data.is_used_same_member_different_day) {
          showNotification(`OR ${orNumber} was used on a different day and cannot be reused.`, 'error');
        } else if (response.data.is_used_same_member_same_loan_type_today) {
          showNotification(`OR ${orNumber} is already used today for ${loanType} payments. Use a different OR.`, 'error');
        } else {
          showNotification('OR number cannot be reused under current rules.', 'error');
        }
        return;
      }

      const selectedScheduleData = schedules.find(s => s.id === selectedScheduleId);
      if (!selectedScheduleData) {
        showNotification("Schedule not found", "error");
        return;
      }

      await markAsPaid(
        selectedScheduleId, 
        parseFloat(selectedScheduleData.payment_amount) || 0, 
        orNumber
      );
      
    } catch (error) {
      console.error('Error processing payment:', error);
      if (error.response?.data?.error) {
        showNotification(error.response.data.error, "error");
      } else {
        showNotification("Error checking OR number", "error");
      }
    }
  };

  const handleOrInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleOrSubmit();
    }
  };

  const markAsPaid = async (id, totalPayment, orNumber) => {
    setPaying(true);
    
    try {
      const remainingUnpaid = schedules.filter(schedule => !schedule.is_paid).length;
      const isLastPayment = remainingUnpaid === 1;

      const token = validateToken();
      if (!token) {
        setPaying(false);
        return;
      }

      const currentSchedule = schedules.find(schedule => schedule.id === id);

      const markPaidResponse = await axios.post(
        `${process.env.REACT_APP_API_URL}/payment-schedules/${id}/mark-paid/`,
        { 
          received_amount: totalPayment, 
          account_number: selectedAccount,
          or_number: orNumber
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Handle server hints: year collapse and settlement
      try {
        const collapsedYears = Number(markPaidResponse?.data?.collapsed_years || 0);
        const loanSettled = Boolean(markPaidResponse?.data?.loan_settled || false);
        const latestRecalc = markPaidResponse?.data?.yearly_recalculation || null;
        if (loanSettled) {
          await fetchPaymentSchedules(selectedAccount, loanType);
          await new Promise(resolve => setTimeout(resolve, 500));
          await fetchPaymentSchedules(selectedAccount, loanType);
          showNotification("Congratulations! Loan successfully paid.", "success");
          setTimeout(() => {
            fetchAccountSummaries();
            setSelectedAccount(null);
          }, 1500);
          setShowOrInput(false);
          setOrNumber('');
          setSelectedScheduleId(null);
          setOrValidation({ available: true, message: '' });
          return; // Done
        }
        if (collapsedYears > 0) {
          const plural = collapsedYears > 1 ? 'years' : 'year';
          showNotification(`📦 Schedules shifted forward by ${collapsedYears} ${plural}.`, 'success');
        }
        // If backend returned a recalculation snapshot, show a banner
        if (latestRecalc) {
          const msg = `Year ${latestRecalc.year} fees recalculated. Previous Bal ₱${formatNumber(latestRecalc.previous_balance)}; Total Fees Due ₱${formatNumber(latestRecalc.total_fees_due)}; New Bimonthly ₱${formatNumber(latestRecalc.new_bimonthly_amortization)}.`;
          showNotification(msg, 'success');
        }
      } catch (_) { /* ignore */ }

      try {
        const archivePayload = {
          account_number: selectedAccount,
          account_holder: accountDetails ? 
            `${accountDetails.first_name} ${accountDetails.middle_name || ''} ${accountDetails.last_name}`.trim() : 
            'Unknown',
          payment_amount: totalPayment,
          loan_type: currentSchedule?.loan_type || loanType,
          date_paid: currentSchedule?.due_date || new Date().toISOString(),
          or_number: orNumber,
          payment_type: 'Schedule Payment'
        };

        await axios.post(
          `${process.env.REACT_APP_API_URL}/archive-payment-record/`,
          archivePayload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (archiveError) {
        console.error('Error archiving payment:', archiveError);
      }

      if (isLastPayment) {
        console.log('🔄 Refreshing schedules after last payment...');
        await fetchPaymentSchedules(selectedAccount, loanType);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchPaymentSchedules(selectedAccount, loanType);
        
        console.log('🎉 Showing success notification...');
        showNotification("Congratulations! Loan successfully paid.", "success");
        setTimeout(() => {
          fetchAccountSummaries();
          setSelectedAccount(null);
        }, 2000);
      } else {
        // Show recalculation summary if available on normal payment
        const latestRecalc = markPaidResponse?.data?.yearly_recalculation || null;
        if (latestRecalc) {
          const msg = `Year ${latestRecalc.year} fees recalculated. Previous Bal ₱${formatNumber(latestRecalc.previous_balance)}; Total Fees Due ₱${formatNumber(latestRecalc.total_fees_due)}; New Bimonthly ₱${formatNumber(latestRecalc.new_bimonthly_amortization)}.`;
          showNotification(msg, 'success');
        } else {
          showNotification("Payment successful!", "success");
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchPaymentSchedules(selectedAccount, loanType);
      }
      const advanceCovered = markPaidResponse?.data?.advance_covered_count || 0;
      if (advanceCovered > 0) {
        showNotification(
          `Payment successful! ${advanceCovered} future schedule(s) covered by advance payment.`,
          'success'
        );
      } else {
        showNotification("Payment successful!", "success");
      }
            
      setShowOrInput(false);
      setOrNumber('');
      setSelectedScheduleId(null);
      setOrValidation({ available: true, message: '' });
      
    } catch (err) {
      console.error('Error while marking as paid:', err);
      const errorMsg = err.response?.data?.error || "Payment processing failed";
      showNotification(errorMsg, "error");
      
      if (err.response?.status === 401) {
        showNotification("Session expired. Please log in again.", "error");
      } else if (err.response?.data?.error) {
        showNotification(err.response.data.error, "error");
      } else {
        showNotification("Error marking payment as paid", "error");
      }
    } finally {
      setPaying(false);
    }
  };

  const arePreviousPaymentsPaid = (scheduleId) => {
    const index = schedules.findIndex((schedule) => schedule.id === scheduleId);
    if (index <= 0) return true;
    // Treat zero-principal unpaid schedules as skippable (fully covered by advance payments)
    // Find the nearest previous schedule with principal_amount > 0
    for (let i = index - 1; i >= 0; i--) {
      const prev = schedules[i];
      const prevPrincipal = parseFloat(prev.principal_amount) || 0;
      if (prevPrincipal <= 0) {
        // skip interest-only/zero-principal entries
        continue;
      }
      return !!prev.is_paid;
    }
    return true;
  };

  // Enforce yearly recalculation fees before first payment of each year > 1
  const areYearlyFeesPaid = (schedule) => {
    if (!loanDetails || !loanDetails.yearly_recalculations) {
      return true;
    }

    const scheduleYear = parseInt(schedule.year_number) || 1;
    const yearSchedules = schedules.filter(s => parseInt(s.year_number) === scheduleYear);
    const firstUnpaidOfYear = yearSchedules.find(s => !s.is_paid);

    if (firstUnpaidOfYear?.id === schedule.id && scheduleYear > 1) {
      const recalc = loanDetails.yearly_recalculations.find(r => r.year === scheduleYear);
      if (recalc) {
        return !!recalc.fees_paid;
      }
    }

    return true;
  };
  // atf whole function
const calculateRemainingBalance = () => {
  if (!schedules || schedules.length === 0) return 0;
  
  // Sum actual principal_amount from unpaid schedules
  // This works correctly even after breakdown edits
  const unpaidSchedules = schedules.filter(s => !s.is_paid);
  
  const totalPrincipal = unpaidSchedules.reduce((sum, schedule) => {
    return sum + (parseFloat(schedule.principal_amount) || 0);
  }, 0);
  
  // ✅ Round to 2 decimal places to avoid floating point errors
  const roundedTotal = Math.round(totalPrincipal * 100) / 100;
  
  console.log(`📊 Remaining Balance Calculation:`);
  console.log(`   Unpaid Schedules: ${unpaidSchedules.length}`);
  console.log(`   Total Remaining Principal: ₱${roundedTotal.toFixed(2)}`);
  
  return roundedTotal;
};
// ✅ Calculate total remaining principal for validation
const calculateTotalRemainingPrincipal = () => {
  const total = schedules
    .filter(s => !s.is_paid)
    .reduce((sum, s) => sum + (parseFloat(s.principal_amount) || 0), 0);
  
  // ✅ Round to 2 decimal places to avoid floating point errors
  return Math.round(total * 100) / 100;
};

// ✅ Calculate original minimum principal (for validation)
  const calculateOriginalMinimum = () => {
    if (schedules.length === 0) return 0;
    const firstUnpaid = schedules.find(s => !s.is_paid);
    if (!firstUnpaid) return 0;
    // Prefer the current principal_amount (reflecting edited breakdown),
    // then fallback to original_principal, then loan's fixed principal
    const pa = parseFloat(firstUnpaid.principal_amount);
    if (!isNaN(pa) && pa > 0) return pa;
    const op = parseFloat(firstUnpaid.original_principal);
    if (!isNaN(op) && op > 0) return op;
    return parseFloat(loanDetails?.principal || 0);
  };

  // Reflect current edited principal per payment based on next unpaid schedule
  const getCurrentPrincipalPerPayment = () => {
    if (!schedules || schedules.length === 0) return parseFloat(loanDetails?.principal || 0);
    const firstUnpaid = schedules.find(s => !s.is_paid);
    if (!firstUnpaid) return parseFloat(loanDetails?.principal || 0);
    const pa = parseFloat(firstUnpaid.principal_amount);
    if (!isNaN(pa) && pa > 0) return pa;
    const op = parseFloat(firstUnpaid.original_principal);
    if (!isNaN(op) && op > 0) return op;
    return parseFloat(loanDetails?.principal || 0);
  };
  // ✅ Initialize which years are open (fix broken JSX and grouping)
  const initializeOpenYears = useCallback(() => {
    const grouped = schedules.reduce((acc, schedule) => {
      const year = Number(schedule.year_number) || 1;
      if (!acc[year]) acc[year] = [];
      acc[year].push(schedule);
      return acc;
    }, {});

    const newOpenYears = {};

    // Open Year 1 by default
    newOpenYears[1] = true;

    // Open any year that has unpaid schedules
    Object.entries(grouped).forEach(([year, yearSchedules]) => {
      const hasUnpaid = yearSchedules.some(s => !s.is_paid);
      if (hasUnpaid) {
        newOpenYears[Number(year)] = true;
      }
    });

    // Open the year AFTER a completed year (for next-year recalculation)
    Object.entries(grouped).forEach(([year, yearSchedules]) => {
      const allPaid = yearSchedules.every(s => s.is_paid);
      if (allPaid) {
        const nextYear = Number(year) + 1;
        if (loanDetails?.yearly_recalculations?.some(r => r.year === nextYear)) {
          newOpenYears[nextYear] = true;
        }
      }
    });

    return newOpenYears;
  }, [schedules, loanDetails?.yearly_recalculations]);

  // ✅ Auto-initialize open years when schedules change
  useEffect(() => {
    if (selectedAccount && schedules.length > 0) {
      setOpenYears(initializeOpenYears());
    }
  }, [schedules, selectedAccount, initializeOpenYears]);

  const filteredSummaries = accountSummaries.filter(summary =>
    summary.account_number.toString().includes(searchQuery) ||
    summary.account_holder.toLowerCase().includes(searchQuery.toLowerCase())
  );
// ✅ Initialize breakdown amount when entering edit mode
useEffect(() => {
  if (isEditBreakDown && schedules.length > 0) {
    const originalMin = calculateOriginalMinimum();
    const totalRemaining = calculateTotalRemainingPrincipal();
    
    // Set to original minimum by default
    setBreakDownAmount(originalMin);
    setOriginalTotal(originalMin);
    
    console.log('📊 Edit Breakdown Mode Initialized:', {
      originalPrincipalPerPayment: originalMin,
      totalRemaining: totalRemaining,
      unpaidSchedules: schedules.filter(s => !s.is_paid).length,
      example: `To reduce to 2 payments: Enter ${formatNumber(totalRemaining / 2)} (₱${(totalRemaining / 2).toFixed(2)})`
    });
  }
}, [isEditBreakDown, schedules]);
  useEffect(() => {
    fetchAccountSummaries();
  }, []);

  useEffect(() => {
    if (sessionExpired) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sessionExpired]);

  if (loading) return <p>Loading...</p>;
  if (error) {
    return (
      <div className="year-group-box" style={{ padding: '16px' }}>
        <p style={{ color: '#d32f2f', marginBottom: '10px' }}>{error}</p>
        {selectedAccount && (
          <button onClick={retryFetch} className="edit-breakdown-button" style={{ backgroundColor: '#007bff' }}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(5px)',
          zIndex: 9998,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            textAlign: 'center',
            maxWidth: '400px',
            zIndex: 9999
          }}
        >
          <h3 style={{ marginBottom: '20px', color: '#dc3545' }}>Session Expired</h3>
          <p style={{ marginBottom: '20px' }}>
            You have been away for quite some time, so we logged you out.<br />
            Please log in again to continue.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('sessionExpired');
              window.location.href = '/login';
            }}
            style={{
              padding: '10px 30px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            Log In
          </button>
        </div>
      </div>
    );
  }
const renderYearGroupedTable = (yearSchedules, year) => {
    // ✅ Show ALL schedules (paid and unpaid) so advance payments are visible
    // const displaySchedules = yearSchedules; 
    const displaySchedules = yearSchedules.filter(schedule => !schedule.is_paid);
    if (displaySchedules.length === 0) return null;
    return (
      <div className="year-table-wrapper">
        <table className="payment-table">
          <thead>
            <tr>
              <th>Principal</th>
              <th>Interest</th>
              <th>Bimonthly Amortization</th>
              <th>Due Date</th>
              {/* <th>Date Paid</th> */}
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
        </table>
        <div className="payment-tbody-scroll">
          <table className="payment-table">
            <tbody>
              {displaySchedules.map(schedule => {
                // ✅ Get actual values from schedule data
                const principal = parseFloat(schedule.principal_amount) || 0;
                const interest = parseFloat(schedule.interest_portion) || 0;
                const bimonthly = principal + interest;
                
                // ✅ Determine payment type
                const isAdvance = schedule.is_covered_by_advance || 
                                  schedule.advance_event_id || 
                                  (parseFloat(schedule.advance_pay) || 0) > 0;
                
                const paymentType = isAdvance ? 'Advance Payment' : 'Regular Payment';
                
                return (
                  <tr key={schedule.id}>
                    {/* Principal - Always show actual value */}
                    <td>
                      ₱ {formatNumber(principal)}
                    </td>
                    
                    {/* Interest - Always show actual value */}
                    <td>
                      ₱ {formatNumber(interest)}
                    </td>
                    
                    {/* Bimonthly - Calculate from principal + interest */}
                    <td style={{ fontWeight: '600' }}>
                      ₱ {formatNumber(bimonthly)}
                      
                      {/* Show advance/under payment indicators */}
                      {(((parseFloat(schedule.advance_pay) || 0) > 0) || 
                        ((parseFloat(schedule.under_pay) || 0) > 0)) && (
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
                    
                    {/* Due Date */}
                    <td>
                      {formatISODate(schedule.due_date)}
                    </td>
                    
                    {/* Date Paid - Show when payment was made */}
                    {/* <td>
                      {schedule.date_paid ? (
                        <div>
                          {formatISODate(schedule.date_paid)} */}
                          {/* Show payment type indicator */}
                          {/* {isAdvance && (
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
                          )}
                        </div>
                      ) : (
                        schedule.is_paid ? (
                          <span style={{ color: '#6c757d', fontSize: '12px' }}>
                            Paid (date not recorded)
                          </span>
                        ) : '—'
                      )}
                    </td> */}
                    
                    {/* Status */}
                    <td>
                      <span className={`status-badge ${schedule.is_paid ? 'status-paid' : 'status-ongoing'}`}>
                        {schedule.is_paid ? 'Paid' : 'Ongoing'}
                      </span>
                    </td>

                    {/* Action */}
                    <td>
                      {!schedule.is_paid && (
                        <button
                          onClick={() => {
                            if (!arePreviousPaymentsPaid(schedule.id)) {
                              showNotification('Please settle previous payments first.', 'error');
                              return;
                            }
                            if (!areYearlyFeesPaid(schedule)) {
                              const yr = parseInt(schedule.year_number) || 1;
                              showNotification(`Pay Year ${yr} fees first.`, 'error');
                              return;
                            }
                            setSelectedScheduleId(schedule.id);
                            setOrNumber('');
                            setShowOrInput(true);
                          }}
                          className="edit-breakdown-button"
                          style={{ backgroundColor: '#3dbc4c', borderRadius:'50px', width:'50%' }}
                        >
                          Credit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  // const renderYearGroupedTable = (yearSchedules, year) => {
  //   // ✅ Filter to show only UNPAID schedules
  //   const unpaidSchedules = yearSchedules.filter(schedule => !schedule.is_paid);
  //   const allYearPaymentsPaid = yearSchedules.every(schedule => schedule.is_paid);
  //   // Hide zero-principal unpaid rows (interest-only) after consolidation
  //   const displaySchedules = unpaidSchedules.filter(s => (parseFloat(s.principal_amount) || 0) > 0);
  //   const hiddenCount = unpaidSchedules.length - displaySchedules.length;
    
  //   // If this year is fully paid, hide the schedule table altogether
  //   if (allYearPaymentsPaid) return null;
    
  //   return (
  //     <div className="year-table-wrapper">
  //       {hiddenCount > 0 && (
  //         <div style={{
  //           margin: '0 0 8px 0',
  //           fontSize: '12px',
  //           color: '#555',
  //           background: '#f8f9fa',
  //           borderLeft: '4px solid #6f42c1',
  //           padding: '6px 10px',
  //           borderRadius: '6px'
  //         }}>
  //           {hiddenCount} schedule{hiddenCount > 1 ? 's' : ''} fully covered by advance payment and hidden.
  //         </div>
  //       )}
  //       <table className="payment-table">
  //         <thead>
  //           <tr>
  //             <th>Principal</th>
  //             <th>Interest</th>
  //             <th>Bimonthly Amortization</th>
  //             <th>Due Date</th>
  //             {/* <th>Remaining Balance</th>
  //             <th>Penalty</th> */}
  //             <th>Status</th>
  //             <th>Action</th>
  //           </tr>
  //         </thead>
  //       </table>
  //       <div className="payment-tbody-scroll">
  //         <table className="payment-table">
  //           <tbody>
  //             {displaySchedules.map(schedule => (
  //               <tr key={schedule.id}>
  //                 {/* Principal */}
  //                 <td>₱ {formatNumber(parseFloat(schedule.principal_amount) || 0)}</td>
                  
  //                 {/* Interest */}
  //                 <td>₱ {formatNumber(parseFloat(schedule.interest_portion) || 0)}</td>
                  
  //                 {/* Bimonthly - Calculate from principal + interest */}
  //                 <td style={{ fontWeight: '600' }}>
  //                   ₱ {formatNumber(
  //                     (parseFloat(schedule.principal_amount) || 0) + 
  //                     (parseFloat(schedule.interest_portion) || 0)
  //                   )}
  //                   {(((parseFloat(schedule.advance_pay) || 0) > 0) || ((parseFloat(schedule.under_pay) || 0) > 0)) && (
  //                     <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
  //                       {(parseFloat(schedule.advance_pay) || 0) > 0 && (
  //                         <span style={{
  //                           background: '#e6f4ea',
  //                           color: '#1e7e34',
  //                           borderRadius: '10px',
  //                           padding: '2px 8px',
  //                           fontSize: '11px',
  //                           fontWeight: 600
  //                         }}>
  //                           Advance ₱{formatNumber(parseFloat(schedule.advance_pay) || 0)}
  //                         </span>
  //                       )}
  //                       {(parseFloat(schedule.under_pay) || 0) > 0 && (
  //                         <span style={{
  //                           background: '#fdecea',
  //                           color: '#c82333',
  //                           borderRadius: '10px',
  //                           padding: '2px 8px',
  //                           fontSize: '11px',
  //                           fontWeight: 600
  //                         }}>
  //                           Under ₱{formatNumber(parseFloat(schedule.under_pay) || 0)}
  //                         </span>
  //                       )}
  //                     </div>
  //                   )}
  //                 </td>
                  
  //                 {/* Due Date */}
  //                 <td>
  //                   {formatISODate(schedule.due_date)}
  //                   {(schedule.status_label === 'Advance Payment' || schedule.is_covered_by_advance) && (
  //                     <div style={{ marginTop: '4px' }}>
  //                       <span style={{
  //                         background: '#e6f4ea',
  //                         color: '#1e7e34',
  //                         borderRadius: '10px',
  //                         padding: '2px 8px',
  //                         fontSize: '11px',
  //                         fontWeight: 600
  //                       }}>
  //                         Advance Payment
  //                       </span>
  //                     </div>
  //                   )}
  //                 </td>
                  
  //                 {/* Remaining Balance */}
  //                 {/* <td>₱ {formatNumber(parseFloat(schedule.balance) || 0)}</td> */}
                  
  //                 {/* Penalty */}
  //                 {/* <td style={{ color: '#ff0019ff', fontWeight: '600' }}>
  //                   ₱ {formatNumber(parseFloat(schedule.penalty) || 0)}
  //                 </td> */}
                  
  //                 {/* Status */}
  //                 <td>
  //                   <span className={`status-badge ${schedule.is_paid ? 'status-paid' : 'status-ongoing'}`}>
  //                     {schedule.is_paid ? 'Paid' : 'Ongoing'}
  //                   </span>
  //                 </td>

  //                 {/* Original Credit button restored */}
  //                 <td>
  //                   {!schedule.is_paid && (
  //                     <button
  //                       onClick={() => {
  //                         if (!arePreviousPaymentsPaid(schedule.id)) {
  //                           showNotification('Please settle previous payments first.', 'error');
  //                           return;
  //                         }
  //                         if (!areYearlyFeesPaid(schedule)) {
  //                           const yr = parseInt(schedule.year_number) || 1;
  //                           showNotification(`Pay Year ${yr} fees first.`, 'error');
  //                           return;
  //                         }
  //                         setSelectedScheduleId(schedule.id);
  //                         setOrNumber('');
  //                         setShowOrInput(true);
  //                       }}
  //                       className="edit-breakdown-button"
  //                       style={{ backgroundColor: '#3dbc4c', borderRadius:'50px', width:'50%' }}
  //                     >
  //                       Credit
  //                     </button>
  //                   )}
  //                 </td>
                  
  //                 {/* Action column removed per requirements */}
  //               </tr>
  //             ))}
  //           </tbody>
  //         </table>
  //       </div>
  //     </div>
  //   );
  // };
const AdvancePaymentModal = () => {
  if (!showAdvancePaymentModal) return null;
  
  const remainingPrincipal = calculateRemainingBalance();
  
  return (
    <div className="or-input-overlay">
      <div className="or-input-modal" style={{ maxWidth: '500px' }}>
        <h3>🚀 Advance Payment</h3>
        
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f7ff', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
            REMAINING PRINCIPAL
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#dc3545' }}>
            ₱ {formatNumber(remainingPrincipal)}
          </div>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            Advance Payment Amount
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={remainingPrincipal}
            value={advancePaymentAmount}
            onChange={(e) => setAdvancePaymentAmount(e.target.value)}
            className="or-input"
            placeholder="Enter amount"
            disabled={processingAdvancePayment}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
            Maximum: ₱{formatNumber(remainingPrincipal)}
          </div>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            OR Number
          </label>
          <input
            type="text"
            maxLength="4"
            value={advancePaymentOR}
            onChange={(e) => handleAdvanceORChange(e.target.value)}
            className="or-input"
            placeholder="Enter 4-digit OR"
            disabled={processingAdvancePayment}
            style={{ width: '100%' }}
          />
          {advancePaymentValidation.message && (
            <p className={`or-validation-message ${advancePaymentValidation.available ? 'or-ok' : 'or-error'}`}>
              {advancePaymentValidation.message}
            </p>
          )}
        </div>
        
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#fff3cd', 
          borderRadius: '6px', 
          marginBottom: '20px',
          fontSize: '13px',
          color: '#856404'
        }}>
          <strong>ℹ️ Note:</strong> This will deduct the amount from your remaining principal
          and reconstruct your payment schedule with the new balance.
        </div>
        
        <div className="or-input-buttons">
          <button 
            onClick={() => {
              setShowAdvancePaymentModal(false);
              setAdvancePaymentAmount('');
              setAdvancePaymentOR('');
              setAdvancePaymentValidation({ available: true, message: '' });
            }}
            className="or-cancel-button"
            disabled={processingAdvancePayment}
          >
            Cancel
          </button>
          
          <button
            onClick={processAdvancePaymentWithReconstruction}
            disabled={
              processingAdvancePayment || 
              !advancePaymentAmount || 
              parseFloat(advancePaymentAmount) <= 0 ||
              !advancePaymentOR || 
              advancePaymentOR.length !== 4 || 
              !advancePaymentValidation.available
            }
            style={{
              padding: '10px 20px',
              backgroundColor: processingAdvancePayment ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: processingAdvancePayment ? 'not-allowed' : 'pointer',
              fontWeight: '600'
            }}
          >
            {processingAdvancePayment ? 'Processing...' : 'Process Advance Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};
  return (
    <div className="payments-container">
      {!selectedAccount ? (
        <>
          <h2 className="page-title">Payment Schedules</h2>
          
          <div className="search-container">
            <input 
              type="text"
              placeholder="Search Payment Schedules"
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
                    {/* <th>Loan Type(s)</th> */}
                    <th>Next Due Date</th>
                  </tr>
                </thead>
                {/*ANINA KA*/}
                <tbody>
                  {filteredSummaries.map((summary, index) => (
                    <tr
                      key={`${summary.account_number}-${index}`}
                      onClick={() => fetchAndLoadAccountSchedules(summary.account_number)}
                    >
                      <td className="account-number">{summary.account_number || 'N/A'}</td>
                      <td>{summary.account_holder}</td>
                      <td>{summary.next_due_date ? new Date(summary.next_due_date).toLocaleDateString() : 'No Due Date'}</td>
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
        {accountDetails && loanDetails && (
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
              Payment Schedules For:
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
              gap: '10px',
              width: '100%',
            }}>
              {/* Name Card */}
              <div style={{
                padding: '15px',
                borderRadius: '8px',
                borderLeft: '4px solid #007bff',
                boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
              }}>
                <div style={{ fontSize: '12px', color: '#000', marginBottom: '5px', fontWeight: '600' }}>NAME</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#000' }}>
                  {accountDetails.first_name} {accountDetails.middle_name} {accountDetails.last_name}
                </div>
              </div>
              
              {/* Account Number Card */}
              <div style={{
                padding: '15px',
                borderRadius: '8px',
                borderLeft: '4px solid #28a745',
                boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
              }}>
                <div style={{ fontSize: '12px', color: '#000', marginBottom: '5px', fontWeight: '600' }}>ACCOUNT NUMBER</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#000' }}>
                  {selectedAccount}
                </div>
              </div>
             {/* ✅ CHANGED: Previous Balance instead of Remaining Balance */}
              {/* <div style={{ padding: '15px', borderRadius: '8px', borderLeft: '4px solid #ffc107', boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)' }}>
                <div style={{ fontSize: '12px', color: '#000', marginBottom: '5px', fontWeight: '600' }}>PREVIOUS BALANCE</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#dc3545' }}>
                  ₱ {formatRemainingBalance(parseFloat(loanDetails.previous_balance || loanDetails.loan_amount || 0))}
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  {schedules.filter(s => s.is_paid).length > 0 ? 'After payments' : 'Initial loan amount'}
                </div>
              </div> */}
              
              {/* Fixed Principal Card - NEW */}
              <div style={{
                padding: '15px',
                borderRadius: '8px',
                borderLeft: '4px solid #17a2b8',
                boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
              }}>
                <div style={{ fontSize: '12px', color: '#000', marginBottom: '5px', fontWeight: '600' }}>FIXED PRINCIPAL</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#17a2b8' }}>
                  ₱ {formatNumber(getCurrentPrincipalPerPayment())}
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  per payment
                </div>
              </div>
              
              {/* Remaining Principal Card */}
              <div style={{
                padding: '15px',
                borderRadius: '8px',
                borderLeft: '4px solid #ffc107',
                boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
              }}>
                <div style={{ fontSize: '12px', color: '#000', marginBottom: '5px', fontWeight: '600' }}>REMAINING PRINCIPAL</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#dc3545' }}>
                  ₱ {formatNumber(calculateRemainingBalance())}
                </div>
              </div>

              {/* Total Payments Card - NEW */}
              {/* <div style={{
                padding: '15px',
                borderRadius: '8px',
                borderLeft: '4px solid #6f42c1',
                boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
              }}>
                <div style={{ fontSize: '12px', color: '#000', marginBottom: '5px', fontWeight: '600' }}>PAYMENTS</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#000' }}>
                  {schedules.filter(s => s.loan_type === loanType && s.is_paid).length} / {schedules.filter(s => s.loan_type === loanType).length}
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  completed
                </div>
              </div> */}

              {/* Reloan Eligibility Card - NEW (hidden) */}
              {false && loanDetails?.reloan_eligibility && (
                <div style={{
                  padding: '15px',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${loanDetails.reloan_eligibility.eligible ? '#28a745' : '#dc3545'}`,
                  boxShadow: '0px 8px 8px rgba(182, 179, 172, 0.992)',
                }}>
                  <div style={{ fontSize: '12px', color: '#000', marginBottom: '5px', fontWeight: '600' }}>RELOAN ELIGIBILITY</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: loanDetails.reloan_eligibility.eligible ? '#28a745' : '#dc3545' }}>
                    {loanDetails.reloan_eligibility.eligible ? 'Eligible' : 'Not Eligible'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '6px', lineHeight: '1.4' }}>
                    {(() => {
                      const rr = loanDetails.reloan_eligibility || {};
                      const paidRatio = typeof rr.paid_ratio === 'number' ? rr.paid_ratio : parseFloat(rr.paid_ratio);
                      const remRatio = typeof rr.remaining_principal_ratio === 'number' ? rr.remaining_principal_ratio : parseFloat(rr.remaining_principal_ratio);
                      const paidPct = isFinite(paidRatio) ? (paidRatio * 100).toFixed(1) : '0.0';
                      const remPct = isFinite(remRatio) ? (remRatio * 100).toFixed(1) : '0.0';
                      return (
                        <>
                          Paid by Count: {paidPct}%
                          {rr.counts && (
                            <>
                              {' '}<span style={{ color: '#888' }}>
                                {/* ({parseInt(rr.counts.counted_paid_effective || rr.counts.counted_paid_baseline || 0, 10)} */}
                                {/* {parseInt(rr.counts.extra_advance_counts || 0, 10) > 0 ? ` +${parseInt(rr.counts.extra_advance_counts || 0, 10)}` : ''}
                                /{parseInt(rr.counts.original_total || rr.counts.current_total || 0, 10)}) */}
                              </span>
                            </>
                          )}
                          <br />
                          {/* Principal Remaining: {remPct}% */}
                          {rr.effective_remaining_principal && (
                            <>
                              {/* {' '}<span style={{ color: '#888' }}>
                                (₱ {formatNumber(parseFloat(rr.effective_remaining_principal || '0'))})
                              </span> */}
                            </>
                          )}
                          {rr.notes && (
                            <>
                              <br />
                              <span style={{ color: '#856404' }}>{rr.notes}</span>
                            </>
                          )}
                          {/* Debug: underlying type */}
                          {loanDetails.loan_type && (
                            <>
                              {/* <br />
                              <span style={{ color: '#888' }}>Type: {loanDetails.loan_type}</span> */}
                            </>
                          )}
                          {/* Debug block: show raw counts */}
                          {/* {rr.counts && (
                            <div style={{
                              marginTop: '8px',
                              padding: '8px',
                              background: '#f8f9fa',
                              borderRadius: '6px',
                              color: '#555',
                              fontSize: '11px'
                            }}>
                              <div><strong>Debug</strong></div>
                              <div>original_total: {parseInt(rr.counts.original_total || 0, 10)}</div>
                              <div>current_total: {parseInt(rr.counts.current_total || 0, 10)}</div>
                              <div>current_unpaid: {parseInt(rr.counts.current_unpaid || 0, 10)}</div>
                              <div>counted_paid_baseline: {parseInt(rr.counts.counted_paid_baseline || 0, 10)}</div>
                              <div>counted_paid_effective: {parseInt(rr.counts.counted_paid_effective || 0, 10)}</div>
                              <div>extra_advance_counts: {parseInt(rr.counts.extra_advance_counts || 0, 10)}</div>
                            </div>
                          )} */}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary panels removed per request */}

          <div className="action-bar">
            <button onClick={() => setSelectedAccount(null)} className="back-button">
              <IoArrowBackCircle /> Back 
            </button>
            {/*ANINA KA*/}
            {availableLoanTypes.Regular && (
              <button 
                onClick={() => handleLoanTypeChange('Regular')} 
                className={`loan-type-button ${loanType === 'Regular' ? 'active' : ''}`}
              >
                Regular Loans
              </button>
            )}

            {availableLoanTypes.Emergency && (
              <button 
                onClick={() => handleLoanTypeChange('Emergency')} 
                className={`loan-type-button ${loanType === 'Emergency' ? 'active' : ''}`}
              >
                Emergency Loans
              </button>
            )}

            <button 
              onClick={isEditBreakDown ? update_breakdown : () => setIsEditBreakDown(true)}
              className="edit-breakdown-button"
            >
              {isEditBreakDown ? 'Save' : 'Edit Breakdown'}
            </button>

            {isEditBreakDown && (
              <button 
                onClick={() => setIsEditBreakDown(false)}
                className="cancel-button"
              >
                Cancel
              </button>
            )}

            <div />
            {/* Global Advance Payment button (outside table) — hidden during Edit Breakdown */}
            {selectedAccount && !isEditBreakDown && (
              <button
                onClick={() => {
                  setAdvancePaymentAmount('');
                  setAdvancePaymentOR('');
                  setAdvancePaymentValidation({ available: true, message: '' });
                  setShowAdvancePaymentModal(true);
                }}
                className="edit-breakdown-button"
                style={{ backgroundColor: '#28a745' }}
              >
                Advance Payment 
              </button>
            )}
            {AdvancePaymentModal()}
{isEditBreakDown && (
  <input
    type="text"
    placeholder="Principal Amount"
    value={
      breakdownAmount
        ? new Intl.NumberFormat("en-US").format(breakdownAmount)
        : ""
    }
    onChange={(e) => {
      // Remove commas before saving to state
      const rawValue = e.target.value.replace(/,/g, "");
      setBreakDownAmount(rawValue);
    }}
    className="breakdown-input"
  />
)}

          </div>

          {/* Legacy advance-only modal removed in favor of composite modal */}

          {showCompositeEvent && (
            <div className="or-input-overlay">
              <div className="or-input-modal" style={{ maxWidth: '720px' }}>
                <h3>Advance / Hybrid Payment</h3>
                {PaymentEventForm()}
                <div className="or-input-buttons" style={{ marginTop: '12px' }}>
                  <button 
                    onClick={() => {
                      setShowCompositeEvent(false);
                      resetPaymentEventForm();
                    }}
                    className="or-cancel-button"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Yearly Fees OR Input Modal */}
          {showYearlyFeesOrInput && (
            <div className="or-input-overlay">
              <div className="or-input-modal">
                <h3>Pay Year {selectedRecalcId} Fees</h3>
                <input
                  type="text"
                  maxLength="4"
                  value={yearlyFeesOrNumber}
                  onChange={(e) => setYearlyFeesOrNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className="or-input"
                  placeholder="Enter 4-digit OR"
                />
                <div className="or-input-buttons" style={{ marginTop: '12px' }}>
                  <button 
                    onClick={() => {
                      setShowYearlyFeesOrInput(false);
                      setYearlyFeesOrNumber('');
                      setSelectedRecalcId(null);
                    }}
                    className="or-cancel-button"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        const recalc = loanDetails?.yearly_recalculations?.find(r => r.year === selectedRecalcId);
                        if (!recalc) {
                          showNotification('Recalculation data not found for this year.', 'error');
                          return;
                        }
                        await handlePayYearlyFees(recalc, yearlyFeesOrNumber);
                        setShowYearlyFeesOrInput(false);
                        setYearlyFeesOrNumber('');
                        setSelectedRecalcId(null);
                        // Refresh schedules and loan details view
                        await fetchPaymentSchedules(selectedAccount, loanType);
                      } catch (err) {
                        console.error('Yearly fees payment failed:', err);
                      }
                    }}
                    disabled={payingYearlyFees || !yearlyFeesOrNumber || yearlyFeesOrNumber.length !== 4}
                    style={{
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: (payingYearlyFees || !yearlyFeesOrNumber || yearlyFeesOrNumber.length !== 4) ? '#ccc' : '#ff9800',
                      color: 'white',
                      cursor: (payingYearlyFees || !yearlyFeesOrNumber || yearlyFeesOrNumber.length !== 4) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {payingYearlyFees ? 'Processing...' : `Pay Year ${selectedRecalcId}`}
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Regular Payment OR Input Modal */}
{showOrInput && (
  <div className="or-input-overlay">
    <div className="or-input-modal">
      <h3>Enter OR Number</h3>
      <p>Payment Amount: ₱{formatNumber(
        schedules.find(s => s.id === selectedScheduleId)?.payment_amount || 0
      )}</p>
      
      <input
        ref={orInputRef}
        type="text"
        maxLength="4"
        value={orNumber}
        onChange={(e) => handleOrChange(e.target.value)}
        onKeyPress={handleOrInputKeyPress}
        className="or-input"
        placeholder="Enter 4-digit OR number"
        disabled={paying}
      />
      
      {orValidation.message && (
        <p className={`or-validation-message ${orValidation.available ? 'or-ok' : 'or-error'}`}>
          {orValidation.message}
        </p>
      )}
      
      <div className="or-input-buttons">
        <button 
          onClick={() => {
            setShowOrInput(false);
            setOrNumber('');
            setSelectedScheduleId(null);
            setOrValidation({ available: true, message: '' });
          }}
          className="or-cancel-button"
          disabled={paying}
        >
          Cancel
        </button>
        
        <button
          onClick={handleOrSubmit}
          disabled={paying || !orNumber || orNumber.length !== 4 || !orValidation.available}
          className="or-submit-button"
          style={{
            backgroundColor: (paying || !orNumber || orNumber.length !== 4 || !orValidation.available) 
              ? '#ccc' 
              : '#28a745',
            cursor: (paying || !orNumber || orNumber.length !== 4 || !orValidation.available) 
              ? 'not-allowed' 
              : 'pointer'
          }}
        >
          {paying ? 'Processing...' : 'Submit'}
        </button>
      </div>
    </div>
  </div>
)}

          {schedules.length > 0 ? (
            <LocalErrorBoundary>
            <div className="schedules-container">
              {/* Removed redundant prominent Year Recalculations table */}

              {/* ✅ Year Groups with Schedules */}
              {(() => {
                const allPaidGlobal = schedules.every(s => !!s.is_paid);
                if (allPaidGlobal) {
                  return (
                    <div className="year-group-box" style={{ padding: '16px' }}>
                      <h3 style={{ marginBottom: '8px' }}>Loan Settled</h3>
                      <p style={{ color: '#555' }}>All payment schedules for this loan are paid. You can go back to accounts or switch loan type to view other histories.</p>
                    </div>
                  );
                }
                return null;
              })()}
              {(() => {
                const grouped = schedules.reduce((acc, schedule) => {
                  const year = Number(schedule.year_number) || 1;
                  if (!acc[year]) acc[year] = [];
                  acc[year].push(schedule);
                  return acc;
                }, {});
                let anyRendered = false;
                const items = Object.entries(grouped)
                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([year, yearSchedules]) => {
                    const yearInt = Number(year);
                    const yKey = yearInt; // normalize to numeric key for openYears
                    const allPaid = yearSchedules.every(s => s.is_paid);
                    // Hide fully paid year groups entirely
                    if (allPaid) return null;

                    // Attach recalculation for THIS year (created after previous year completion)
                    const recalcForThisYear = (loanDetails && loanDetails.yearly_recalculations)
                      ? loanDetails.yearly_recalculations.find(r => r.year === yearInt)
                      : null;

                    return (
                      <div key={year} className="year-group-box">
                        <div
                          onClick={() => toggleYear(yKey)}
                          className="year-header"
                        >
                          <span className="year-title">Year {year}</span>
                          <span className="year-toggle">
                            {openYears[yKey] ? '▼' : '►'}
                          </span>
                        </div>

                        {openYears[yKey] && (
                          <>
                            {/* Recalculation card for this year (persists until this year is fully paid) */}
                            {recalcForThisYear && (
                              <div key={`recalc-${recalcForThisYear.year}`} className="recalculation-container">
                                <h4 className="recalculation-title">
                                  Year {recalcForThisYear.year} Recalculation
                                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                                    (Loan: {recalcForThisYear.loan_control_number})
                                  </span>
                                  {recalcForThisYear.fees_paid ? (
                                    <span style={{
                                      marginLeft: '10px',
                                      padding: '4px 12px',
                                      backgroundColor: '#d4edda',
                                      color: '#155724',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600'
                                    }}>
                                      ✓ Paid
                                    </span>
                                  ) : (
                                    <span style={{
                                      marginLeft: '10px',
                                      padding: '4px 12px',
                                      backgroundColor: '#fff3cd',
                                      color: '#856404',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: '600'
                                    }}>
                                      ⚠ Unpaid
                                    </span>
                                  )}
                                </h4>

                                <table className="recalculation-table">
                                  <thead>
                                    <tr>
                                      <th>Service Fee</th>
                                      <th>Interest</th>
                                      <th>Admin Cost</th>
                                      <th>CISP</th>
                                      <th>Total Fees Due</th>
                                      <th>Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td>₱ {formatNumber(recalcForThisYear.service_fee)}</td>
                                      <td>₱ {formatNumber(recalcForThisYear.interest_amount)}</td>
                                      <td>₱ {formatNumber(recalcForThisYear.admincost)}</td>
                                      <td>₱ {formatNumber(recalcForThisYear.cisp)}</td>
                                      <td style={{ fontWeight: '700', color: '#d32f2f', whiteSpace: 'nowrap' }}>
                                        ₱ {formatNumber(recalcForThisYear.total_fees_due)}
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        {!recalcForThisYear.fees_paid && (
                                          <button
                                            onClick={() => {
                                              setSelectedRecalcId(recalcForThisYear.year);
                                              setYearlyFeesOrNumber('');
                                              setShowYearlyFeesOrInput(true);
                                            }}
                                            style={{
                                              padding: '6px 12px',
                                              backgroundColor: '#ff9800',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '6px',
                                              cursor: 'pointer',
                                              fontWeight: '600',
                                              fontSize: '12px'
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f57c00'}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = '#ff9800'}
                                          >
                                            💳 Pay Year {recalcForThisYear.year} Fees
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>

                                {/* Removed info block below recalculation table per requirements */}

                                {/* Removed schedule info block per requirements */}
                              </div>
                            )}
                            {(() => {
                              const block = renderYearGroupedTable(yearSchedules, year);
                              if (block) anyRendered = true;
                              return block;
                            })()}
                          </>
                        )}
                      </div>
                    );
                  });
                if (!anyRendered) {
                  // Keep year headers visible without extra hint/message
                  return items;
                }
                return items;
              })()}
            </div>
            </LocalErrorBoundary>
          ) : (
            <p className="no-data">No payment schedules found.</p>
          )}
        </>
      )}
    </div>
  );
};

export default PaymentSchedule;