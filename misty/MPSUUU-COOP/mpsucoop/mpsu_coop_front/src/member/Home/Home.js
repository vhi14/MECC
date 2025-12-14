import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../Topbar/Topbar';
import axios from 'axios';
import { Eye } from 'lucide-react';
import { BsFillPrinterFill } from "react-icons/bs";
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
  
  // New state for showing history modals
  const [showRegularHistory, setShowRegularHistory] = useState(false);
  const [showEmergencyHistory, setShowEmergencyHistory] = useState(false);
  
  // NEW: State for current year tracking
  const [currentRegularYear, setCurrentRegularYear] = useState(1);
  const [currentEmergencyYear, setCurrentEmergencyYear] = useState(1);
  
  // Loan fees state - NOW STORES ALL YEARS
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
    
    printWindow.document.write(`
      <html>
        <head>
          <title>${historyType} Payment History</title>
          <style>
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: ${historyType === 'Regular' ? '#28a745' : '#dc3545'};
              color: white;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .type-badge {
              background-color: ${historyType === 'Regular' ? '#28a745' : '#dc3545'};
              color: white;
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 11px;
            }
            @media print {
              body { padding: 20px; }
            }
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
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(payment => `
                <tr>
                  <td><span class="type-badge">${payment.loan_type}</span></td>
                  <td>₱${formatNumber(parseFloat(payment.payment_amount || 0).toFixed(2))}</td>
                  <td>${formatISODate(payment.payment_date || payment.date_paid)}</td>
                  <td>${payment.or_number}</td>
                  <td><span class="type-badge">✓ Settled</span></td>
                </tr>
              `).join('')}
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

  // Render advance-only table grouped by OR for a given loan type
  const renderAdvanceOnlyTable = (loanType) => {
    // Scope to current loan control number to avoid double-counting across loans
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
        <div style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
          <div style={{ fontSize: '48px', opacity: '0.5' }}>📭</div>
          <div>No archived advance payments found</div>
        </div>
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
        <tr key={`adv-${loanType}-${orNumber}`}>
          <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: loanType === 'Regular' ? '#28a745' : '#dc3545', color: '#fff', fontSize: '11px', fontWeight: '600' }}>
              {loanType}
            </span>
          </td>
          <td style={{ padding: '10px 8px', fontWeight: '700', color: loanType === 'Regular' ? '#1e7e34' : '#dc3545', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            ₱{formatNumber(sum)}
          </td>
          <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            {first.date_paid ? formatISODate(String(first.date_paid).slice(0,10)) : '—'}
          </td>
          <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            {orNumber}
          </td>
          <td style={{ padding: '10px 8px', borderBottom: '1px solid #9b9b9bff' }}>
            <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#28a745', color: 'white', fontSize: '11px', fontWeight: '600' }}>
              ✓ Advance
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
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
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

  // NEW FUNCTION: Determine current year based on payment progress
  const determineCurrentYear = (schedules, loanType) => {
    if (!schedules || schedules.length === 0) return 1;
    
    const loanSchedules = schedules
      .filter(s => s.loan_type === loanType)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    
    // Count paid schedules
    const paidCount = loanSchedules.filter(s => s.is_paid).length;
    
    // Determine year (24 schedules per year)
    const year = Math.floor(paidCount / SCHEDULES_PER_YEAR) + 1;
    
    // Cap at year 4
    return Math.min(year, 4);
  };

  // NEW FUNCTION: Fetch loan details with recalculations
  const fetchLoanDetailsWithRecalculations = async (controlNumber, token) => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/loans/${controlNumber}/detailed_loan_info/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching details for ${controlNumber}:`, error);
      return null;
    }
  };

  // FETCH COMPLETE PAYMENT HISTORY
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
          payment_date: schedule.payment_date || schedule.date_paid || schedule.due_date, // ✅ UPDATED
          date_paid: schedule.date_paid || schedule.payment_date, // ✅ NEW
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

  // Filter loans for the current member
  const loansForMember = loanData.filter(
    loan => loan.account_number === memberData?.accountN || loan.account === memberData?.accountN
  );

  // Get nearest payment schedule for regular loans
   const nearestRegularPaymentSchedule = paymentSchedules
    .filter(schedule => 
      schedule.loan_type === 'Regular' &&
      !schedule.is_paid && // ✅ ONLY unpaid schedules
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

  // Get paid schedules for payment tables
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
      payment_date: schedule.payment_date || schedule.date_paid, // ✅ UPDATED
      or_number: orNumber,
    };
  });

  // Filter for regular and emergency paid schedules
  const filteredRegular = schedulesWithDetails.filter((schedule) => {
    const searchLower = searchQuery.toLowerCase();
    const datePaid = schedule.date_paid || schedule.payment_date; // ✅ NEW
    const fullDate = datePaid ? formatISODate(String(datePaid).slice(0, 10)) : formatDate(schedule.due_date); // ✅ UPDATED
    const orNumber = (schedule.or_number || '').toString().toLowerCase();
    
    return schedule.loan_type === 'Regular' && (
      fullDate.toLowerCase().includes(searchLower) || 
      orNumber.includes(searchLower)
    );
  });

const filteredEmergency = schedulesWithDetails.filter((schedule) => {
  const searchLower = searchQuery.toLowerCase();
  const datePaid = schedule.date_paid || schedule.payment_date; // ✅ NEW
  const fullDate = datePaid ? formatISODate(String(datePaid).slice(0, 10)) : formatDate(schedule.due_date); // ✅ UPDATED
  const orNumber = (schedule.or_number || '').toString().toLowerCase();
  
  return schedule.loan_type === 'Emergency' && (
    fullDate.toLowerCase().includes(searchLower) || 
    orNumber.includes(searchLower)
  );
});

  // Filter COMPLETE payment history
  const regularPaymentHistory = completePaymentHistory
    .filter(payment => payment.loan_type === 'Regular')
    .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
  
  const emergencyPaymentHistory = completePaymentHistory
    .filter(payment => payment.loan_type === 'Emergency')
    .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

  // NEW: Normalize history data to mirror tables and include archived advances
  const normalizeHistoryForTable = (historyList, loanType) => {
    const base = (historyList || [])
      .filter(p => String(p.loan_type || '').toLowerCase() === String(loanType).toLowerCase())
      .map(p => {
        const orNumber = p.OR || p.or_number || p.orNumber || p.or_num || p.receipt_number || p.receipt_no || p.official_receipt || p.or_id || 'N/A';
        return {
          id: p.id || `${p.control_number || p.loan_control_number || 'cn'}-${orNumber}`,
          loan_type: p.loan_type || loanType,
          payment_amount: p.payment_amount || 0,
          payment_date: p.payment_date || p.date_paid || p.due_date || null,
          date_paid: p.date_paid || p.payment_date || null,
          or_number: orNumber,
          status: p.status || 'Paid'
        };
      });

    // Merge archived advances for the same loan type
    const adv = (archivedPayments || [])
      .filter(ap => String(ap.loan_type || '').toLowerCase() === String(loanType).toLowerCase())
      .map(ap => {
        const orNumber = ap.OR || ap.or_number || ap.orNumber || ap.or_num || ap.receipt_number || ap.receipt_no || ap.official_receipt || ap.or_id || 'N/A';
        return {
          id: ap.id || `${ap.loan_control_number || ap.control_number || 'adv'}-${orNumber}`,
          loan_type: ap.loan_type || loanType,
          payment_amount: ap.payment_amount || 0,
          payment_date: ap.payment_date || ap.date_paid || null,
          date_paid: ap.date_paid || ap.payment_date || null,
          or_number: orNumber,
          status: 'Advance'
        };
      });

    const merged = [...base, ...adv];
    // Sort by payment_date desc to mirror typical history
    return merged.sort((a, b) => new Date(b.payment_date || b.date_paid || 0) - new Date(a.payment_date || a.date_paid || 0));
  };

  // Calculate paid balance for regular loans
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

    // Include archived advance payments scoped to current Regular loan control number
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

  // Calculate paid balance for emergency loans
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

    // Include archived advance payments scoped to current Emergency loan control number
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

  // Function to render table with OR grouping
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
        <tr key={`${firstSchedule.id || firstSchedule.control_number}-main`}>

          <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: loanType === 'Regular' ? '#28a745' : '#dc3545', color: '#fff', fontSize: '11px', fontWeight: '600' }}>
              {firstSchedule.loan_type || 'N/A'}
            </span>
          </td>

          <td style={{ padding: '10px 8px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            ₱{formatNumber(parseFloat(firstSchedule.payment_amount || 0).toFixed(2))}
          </td>
          <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#28a745', color: 'white', fontSize: '11px', fontWeight: '600' }}>
              ✓ Settled
            </span>
          </td>

          <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            {(() => {
              const datePaid = firstSchedule.date_paid || firstSchedule.payment_date;
              if (datePaid) {
                return formatISODate(String(datePaid).slice(0, 10));
              }
              return <span style={{ color: '#6c757d', fontSize: '12px' }}>Paid (date not recorded)</span>;
            })()}
          </td>

          <td style={{ padding: '10px 8px', fontWeight: '600', borderBottom: '1px solid #9b9b9bff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {hasMultiple && (
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleORGroup(loanType, orNumber);
                  }}
                  style={{ 
                    cursor: 'pointer', 
                    userSelect: 'none',
                    fontSize: '16px',
                    color: '#0b26f7ff',
                    fontWeight: 'bold'
                  }}
                >
                  {isOpen ? '▼' : '►'}
                </span>
              )}
              <span>{firstSchedule.or_number}</span>
              {hasMultiple && (
                <span style={{ fontSize: '12px', color: '#000000ff' }}>
                  ({orSchedules.length})
                </span>
              )}
            </div>
          </td>
        </tr>
      );
      
      if (hasMultiple && isOpen) {
        orSchedules.slice(1).forEach((schedule, idx) => {
          rows.push(
            <tr key={`${schedule.id || schedule.control_number}-${idx}`} style={{ backgroundColor: '#f9f9f9' }}>
              <td style={{ padding: '10px 8px', paddingLeft: '20px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: loanType === 'Regular' ? '#28a745' : '#dc3545', color: '#fff', fontSize: '11px', fontWeight: '600' }}>
                  {schedule.loan_type || 'N/A'}
                </span>
              </td>
              <td style={{ padding: '10px 8px', paddingLeft: '20px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                ₱{formatNumber(parseFloat(schedule.payment_amount || 0).toFixed(2))}
              </td>
              <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#28a745', color: 'white', fontSize: '11px', fontWeight: '600' }}>
                  ✓ Settled
                </span>
              </td>
              <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                {schedule.payment_date !== 'N/A' ? schedule.payment_date : formatDate(schedule.due_date)}
              </td>
              <td style={{ padding: '10px 8px', paddingLeft: '30px', fontWeight: '600', borderBottom: '1px solid #9b9b9bff' }}>
                {schedule.or_number}
              </td>
            </tr>
          );
        });
      }
    });
    
    return rows;
  };

  // NEW: Render Payment History mirroring tables with OR grouping and Advance inclusion
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

      rows.push(
        <tr key={`hist-${loanType}-${orNumber}-main`}>
          <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: loanType === 'Regular' ? '#28a745' : '#dc3545', color: '#fff', fontSize: '11px', fontWeight: '600' }}>
              {loanType}
            </span>
          </td>
          <td style={{ padding: '10px 8px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            ₱{formatNumber(parseFloat(first.payment_amount || 0).toFixed(2))}
          </td>
          <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            {(() => {
              const datePaid = first.date_paid || first.payment_date;
              if (datePaid) return formatISODate(String(datePaid).slice(0,10));
              return <span style={{ color: '#6c757d', fontSize: '12px' }}>—</span>;
            })()}
          </td>
          <td style={{ padding: '10px 8px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {hasMultiple && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenORGroups(prev => ({ ...prev, [`${loanType}-HIST-${orNumber}`]: !prev[`${loanType}-HIST-${orNumber}`] }));
                  }}
                  style={{ cursor: 'pointer', userSelect: 'none', fontSize: '16px', color: '#0b26f7ff', fontWeight: 'bold' }}
                >
                  {isOpen ? '▼' : '►'}
                </span>
              )}
              <span>{first.or_number}</span>
              {hasMultiple && (
                <span style={{ fontSize: '12px', color: '#000000ff' }}>({items.length})</span>
              )}
            </div>
          </td>
          <td style={{ padding: '10px 8px', borderBottom: '1px solid #9b9b9bff' }}>
            <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: first.status === 'Advance' ? '#0d6efd' : '#28a745', color: 'white', fontSize: '11px', fontWeight: '600' }}>
              {first.status === 'Advance' ? '✓ Advance' : '✓ Settled'}
            </span>
          </td>
        </tr>
      );

      if (hasMultiple && isOpen) {
        items.slice(1).forEach((it, idx) => {
          rows.push(
            <tr key={`hist-${loanType}-${orNumber}-${idx}`} style={{ backgroundColor: '#f9f9f9' }}>
              <td style={{ padding: '10px 8px', paddingLeft: '20px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: loanType === 'Regular' ? '#28a745' : '#dc3545', color: '#fff', fontSize: '11px', fontWeight: '600' }}>{loanType}</span>
              </td>
              <td style={{ padding: '10px 8px', paddingLeft: '20px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                ₱{formatNumber(parseFloat(it.payment_amount || 0).toFixed(2))}
              </td>
              <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                {(() => {
                  const datePaid = it.date_paid || it.payment_date;
                  if (datePaid) return formatISODate(String(datePaid).slice(0,10));
                  return <span style={{ color: '#6c757d', fontSize: '12px' }}>—</span>;
                })()}
              </td>
              <td style={{ padding: '10px 8px', paddingLeft: '30px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                {it.or_number}
              </td>
              <td style={{ padding: '10px 8px', borderBottom: '1px solid #9b9b9bff' }}>
                <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: it.status === 'Advance' ? '#0d6efd' : '#28a745', color: 'white', fontSize: '11px', fontWeight: '600' }}>
                  {it.status === 'Advance' ? '✓ Advance' : '✓ Settled'}
                </span>
              </td>
            </tr>
          );
        });
      }
    });

    return rows;
  };

  // NEW EFFECT: Fetch loan fees based on current year and recalculations
  useEffect(() => {
    const fetchYearlyLoanFees = async () => {
      if (loansForMember.length === 0 || !paymentSchedules.length) return;

      const token = localStorage.getItem('accessToken');
      if (!token) return;

      try {
        // Process Regular Loans
        const regularLoans = loansForMember.filter(loan => loan.loan_type === 'Regular');
        const recentRegularLoan = regularLoans.sort((a, b) => 
          new Date(b.loan_date) - new Date(a.loan_date)
        )[0];

        // Process Emergency Loans
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

        // Fetch Regular Loan Details
        if (recentRegularLoan) {
          const regularDetails = await fetchLoanDetailsWithRecalculations(
            recentRegularLoan.control_number, 
            token
          );

          if (regularDetails) {
            // Year 1 - Original loan
            newFees.regular.year1 = {
              interest: regularDetails.interest_amount || 0,
              cisp: regularDetails.cisp || 0,
              service_fee: regularDetails.service_fee || 0,
              admin_cost: regularDetails.admincost || 0
            };

            // Years 2-4 - From recalculations
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

            // Determine current year for Regular loan
            const regularSchedules = paymentSchedules.filter(
              s => s.loan_type === 'Regular' && s.loan_id === recentRegularLoan.id
            );
            const regYear = determineCurrentYear(regularSchedules, 'Regular');
            setCurrentRegularYear(regYear);
          }
        }

        // Fetch Emergency Loan Details
        if (recentEmergencyLoan) {
          const emergencyDetails = await fetchLoanDetailsWithRecalculations(
            recentEmergencyLoan.control_number, 
            token
          );

          if (emergencyDetails) {
            // Year 1 - Original loan
            newFees.emergency.year1 = {
              interest: emergencyDetails.interest_amount || 0,
              cisp: emergencyDetails.cisp || 0,
              service_fee: emergencyDetails.service_fee || 0,
              admin_cost: emergencyDetails.admincost || 0
            };

            // Years 2-4 - From recalculations
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

            // Determine current year for Emergency loan
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

  // Main data fetching effect
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

        // Fetch complete payment history
        const history = await fetchCompletePaymentHistory(accountNumber);
        setCompletePaymentHistory(history);

        // Fetch archived payments for advance-only views
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

  // Control number details fetching effect
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
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ width: '80px', height: '80px', background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)', borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white' }}>
            ⚠
          </div>
          <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>Oops! Something went wrong</h2>
          <p style={{ color: '#7f8c8d', marginBottom: '30px', fontSize: '16px' }}>{error}</p>
          <a 
            href="/" 
            style={{ display: 'inline-block', background: 'linear-gradient(45deg, #667eea, #764ba2)', color: 'white', padding: '12px 30px', textDecoration: 'none', borderRadius: '25px', fontWeight: '600', transition: 'transform 0.3s ease', boxShadow: '0 5px 15px rgba(102, 126, 234, 0.3)' }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  if (!memberData || !loanData || !paymentSchedules || !payments) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid #667eea', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
          <p style={{ color: '#0b78e6ff', fontSize: '14px' }}>Loading your dashboard...</p>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <Topbar />
      
      <div style={{ padding: '40px 20px', marginTop: '250px' }}>
        <div style={{ width: '1500px', margin: '0 auto' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            
            {/* Left Panel - Member Info */}
            <div style={{ padding: '4px' }}>

              {/* Member Profile Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginTop: '5px' }}>

                {/* Member Info Card (Left Side) */}
                <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '5px', borderRadius: '15px', marginBottom: '10px', color: 'black', textAlign: 'center', width: '320px', height: '150px', marginTop: '-70px' }}>

                  <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '10px 50px 0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>
                    {memberData.first_name} {memberData.middle_name} {memberData.last_name}
                  </h2>

                  <div style={{ background: 'rgba(51, 49, 49, 0.2)', padding: '5px 15px', borderRadius: '25px', display: 'inline-block', fontSize: '14px', fontWeight: '700', color: 'black', marginTop: '-10px' }}>
                    Account: {memberData.accountN || 'N/A'}
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    gap: '15px', 
                    marginTop: '20px',
                    flexWrap: 'wrap',
                    marginBottom: '15px',
                    justifyContent: 'center'
                  }}>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: '700', 
                      color: 'black', 
                    }}>
                      💰Share Capital: ₱{formatNumber(Math.min(memberData.share_capital || 0, SHARE_CAPITAL_LIMIT))}
                    </div>

                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: '700', 
                      color: 'black', 
                    }}>
                      💰Share: ₱{formatNumber(Math.min(memberData.share_capital || 0, SHARE_CAPITAL_LIMIT) / 1000)}
                    </div>
                  </div>
                </div>

              </div>

              {/* Loan Fees Card with YEAR-BASED data */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px', width: '300px' }}>
                <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '10px', borderRadius: '15px', color: 'black', textAlign: 'center', marginBottom: '15px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>
                    🏦 Regular Loan Fees & Interest{nearestRegularLoan?.status !== 'Paid-off' && ` - Year ${currentRegularYear}`}
                  </div>
                  {nearestRegularLoan?.status === 'Paid-off' ? (
                    <>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Interest (8%):</strong> ₱0.00
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>CISP:</strong> ₱0.00
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Service Fee:</strong> ₱0.00
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Admin Cost:</strong> ₱0.00
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Interest (8%):</strong> ₱{formatNumber(loanFees.regular[`year${currentRegularYear}`].interest)}
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>CISP:</strong> ₱{formatNumber(loanFees.regular[`year${currentRegularYear}`].cisp)}
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Service Fee:</strong> ₱{formatNumber(loanFees.regular[`year${currentRegularYear}`].service_fee)}
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Admin Cost:</strong> ₱{formatNumber(loanFees.regular[`year${currentRegularYear}`].admin_cost)}
                      </p>
                    </>
                  )}
                </div>
                
                <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '10px', borderRadius: '15px', color: '#000000ff', textAlign: 'center', marginTop: '5px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>
                    🚨Emergency Loan Fees & Interest{nearestEmergencyLoan?.status !== 'Paid-off' && ` - Month ${currentEmergencyYear}`}
                  </div>
                  {nearestEmergencyLoan?.status === 'Paid-off' ? (
                    <>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Interest (4%):</strong> ₱0.00
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>CISP:</strong> ₱0.00
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Service Fee:</strong> ₱0.00
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Admin Cost:</strong> ₱0.00
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Interest (4%):</strong> ₱{formatNumber(loanFees.emergency[`year${currentEmergencyYear}`].interest)}
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>CISP:</strong> ₱{formatNumber(loanFees.emergency[`year${currentEmergencyYear}`].cisp)}
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Service Fee:</strong> ₱{formatNumber(loanFees.emergency[`year${currentEmergencyYear}`].service_fee)}
                      </p>
                      <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                        <strong>Admin Cost:</strong> ₱{formatNumber(loanFees.emergency[`year${currentEmergencyYear}`].admin_cost)}
                      </p>
                    </>
                  )}
                </div>

                {/* Loan button Card */}
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', marginRight: '10px'}}>
                    <button
                      onClick={() => handleNavigation('/accounts')}
                      style={{ background: '#28a745', boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', color: 'black', border: 'none', padding: '10px 15px', borderRadius: '12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'transform 0.3s ease', position: 'relative', zIndex: 1 }}
                      onMouseOver={(e) => { e.target.style.transform = 'translateY(-3px)'; }}
                      onMouseOut={(e) => { e.target.style.transform = 'translateY(0)'; }}
                    >
                      📊 Share Capital Transactions
                    </button>

                    <button
                      onClick={() => handleNavigation('/loans')}
                      style={{ background: '#007bff', boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', color: 'black', border: 'none', padding: '10px 15px', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'transform 0.3s ease', position: 'relative', zIndex: 1 }}
                      onMouseOver={(e) => { e.target.style.transform = 'translateY(-3px)'; }}
                      onMouseOut={(e) => { e.target.style.transform = 'translateY(0)'; }}
                    >
                      💳 Bi Monthly Amortization
                    </button>
                  </div>
                </div>
              </div> 
                 
            </div>

            {/* Right Panel - Loan Details */}
            <div style={{ padding: '4px' }}>

              {/* Detailed Loan Information Cards - Side by Side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '-50px' }}>
                
                {/* Regular Loan Details Card */}
                <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', borderRadius: '15px', padding: '10px', color: 'black', marginTop: '-10px', height: 'auto', width: '530px', marginLeft: '-10px', marginRight: '50px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 10px 0', textAlign: 'center', borderBottom: '2px solid rgba(0, 0, 0, 1)', paddingBottom: '5px' }}>
                    🏦 REGULAR LOAN DETAILS
                  </h3>
                  
                  {nearestRegularPaymentSchedule ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {/* First Row - All loan details in horizontal layout */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                        <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'black' }}>
                            <strong>Regular Loan:</strong>
                          </p>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#28a745' }}>
                            ₱{formatNumber(parseFloat(nearestRegularLoan?.loan_amount || 0).toFixed(2))}
                          </p>
                        </div>
                        
                        <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: 'black' }}>
                            <strong>Loan Approval Date:</strong>
                          </p>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#000000' }}>
                            {nearestRegularLoan?.loan_date ? formatDate(nearestRegularLoan.loan_date) : 'N/A'}
                          </p>
                        </div>
                        
                        <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: 'black' }}>
                            <strong>Upcoming Due Date:</strong>
                          </p>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: nearestRegularLoan?.status === 'Paid-off' ? '#28a745' : '#000000' }}>
                            {nearestRegularLoan?.status === 'Paid-off' 
                              ? 'SETTLED' 
                              : nearestRegularPaymentSchedule?.due_date 
                                ? new Date(nearestRegularPaymentSchedule.due_date).toLocaleDateString()
                                : 'N/A'}
                          </p>
                        </div>
                        
                        <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: 'black' }}>
                            <strong>Control No.:</strong>
                          </p>
                          <p 
                            style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#0004ffff', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => navigate(`/loans?control=${nearestRegularLoan?.control_number}`)}
                          >
                            {nearestRegularLoan?.control_number || 'N/A'}
                          </p>
                        </div>
                        
                        <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: 'black' }}>
                            <strong>Amount Due:</strong>
                          </p>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#000000' }}>
                            ₱{nearestRegularLoan?.status === 'Paid-off' 
                              ? '0.00' 
                              : formatNumber(nearestRegularPaymentSchedule?.payment_amount || 0)}
                          </p>
                        </div>

                      </div>
                      
                      {/* Second Row - Paid Amount and Remaining Balance */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: 'black' }}>
                            <strong>Paid Amount:</strong>
                          </p>
                          <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#000000' }}>
                            ₱{formatRemainingBalance(calculatePaidBalance().toFixed(2))}
                          </p>
                        </div>
                        
                        <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: 'black' }}>
                            <strong>Remaining Balance:</strong>
                          </p>
                          <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#000000' }}>
                            ₱{formatRemainingBalance(calculateRemainingBalance().toFixed(2))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#28a745', boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '14px', opacity: '0.8', color: 'white' }}>
                        No upcoming Regular Loan Due.
                      </p>
                    </div>
                  )}
                </div>

                {/* Emergency Loan Details Card */}
                  <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', borderRadius: '15px', padding: '10px', color: 'black', marginTop: '-10px', height: '180px', width: '530px', marginLeft: '-50px', marginRight: '80px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 10px 0', textAlign: 'center', borderBottom: '2px solid rgba(0, 0, 0, 1)', paddingBottom: '5px' }}>
                      🚨 EMERGENCY LOAN DETAILS
                    </h3>
                    
                    {nearestEmergencyPaymentSchedule ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {/* First Row - All loan details in horizontal layout */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                          <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: 'black' }}>
                              <strong>Emergency Loan:</strong>
                            </p>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#dc3545' }}>
                              ₱{formatNumber(parseFloat(nearestEmergencyLoan?.loan_amount || 0).toFixed(2))}
                            </p>
                          </div>
                          
                          <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: 'black' }}>
                              <strong>Loan Approval Date:</strong>
                            </p>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#000000' }}>
                              {nearestEmergencyLoan?.loan_date ? formatDate(nearestEmergencyLoan.loan_date) : 'N/A'}
                            </p>
                          </div>
                          <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: 'black' }}>
                              <strong>Upcoming Due Date:</strong>
                            </p>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: nearestEmergencyLoan?.status === 'Paid-off' ? '#28a745' : '#000000' }}>
                              {nearestEmergencyLoan?.status === 'Paid-off' 
                                ? 'SETTLED' 
                                : nearestEmergencyPaymentSchedule?.due_date 
                                  ? new Date(nearestEmergencyPaymentSchedule.due_date).toLocaleDateString()
                                  : 'N/A'}
                            </p>
                          </div>
                          
                          <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: 'black' }}>
                              <strong>Control No.:</strong>
                            </p>
                            <p 
                              style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#0004ffff', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => navigate(`/loans?control=${nearestEmergencyLoan?.control_number}`)}
                            >
                              {nearestEmergencyLoan?.control_number || 'N/A'}
                            </p>
                          </div>
                          
                          <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: 'black' }}>
                              <strong>Amount Due:</strong>
                            </p>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#000000' }}>
                              ₱{nearestEmergencyLoan?.status === 'Paid-off' 
                                ? '0.00' 
                                : formatNumber(nearestEmergencyPaymentSchedule?.payment_amount || 0)}
                            </p>
                          </div>

                        </div>
                        
                        {/* Second Row - Paid Amount and Remaining Balance */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: 'black' }}>
                              <strong>Paid Amount:</strong>
                            </p>
                            <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#000000' }}>
                              ₱{formatRemainingBalance(calculatePaidBalanceForEmergency())}
                            </p>
                          </div>
                          
                          <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: 'black' }}>
                              <strong>Remaining Balance:</strong>
                            </p>
                            <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#000000' }}>
                              ₱{formatRemainingBalance(calculateRemainingBalanceForEmergency().toFixed(2))}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                    ) : (
                      <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '14px', opacity: '0.8' }}>
                          No active Emergency Loan
                        </p>
                      </div>
                    )}
                  </div>

              </div>
            </div>

          </div>

          {/* PAYMENT TABLES SECTION */}
          <div style={{ marginTop: '80px' }}>
            
            {/* Payment Tables with Dropdown Buttons Above */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              
              {/* Regular Loan Payment Table Section */}
              <div style={{ width: '550px', marginTop: '-450px', marginLeft: '330px' }}>
                {/* Regular History Button - Above Table */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', marginLeft: '20px' }}>
                  <button
                    onClick={() => { setShowRegularHistory(true); setShowRegularAdvanceOnly(false); }}
                    style={{
                      background: '#005fccff',
                      color: '#000',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',  
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      flex: 1
                    }}
                    title={'Show Regular Payment History'}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-3px)';
                      e.target.style.boxShadow = '0 5px 15px rgba(40, 167, 69, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    CLICK TO VIEW PAYMENTS HISTORY
                  </button>
                  <button
                    onClick={() => setShowRegularAdvanceOnly(true)}
                    style={{
                      background: showRegularAdvanceOnly ? '#28a745' : '#f0f7ff',
                      color: showRegularAdvanceOnly ? 'white' : '#000',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      flex: 1
                    }}
                    title={'Show archived advance payments only'}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-3px)';
                      e.target.style.boxShadow = '0 5px 15px rgba(13, 110, 253, 0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    ADVANCE PAYMENT
                  </button>
                </div>
                {/* Regular Loan Payment Table */}
                <div style={{ background: 'white', boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)', borderRadius: '15px', overflow: 'hidden', height: '310px', marginLeft: '20px', width: '550px' }}>
                  <div style={{ background: '#28a745', padding: '10px', color: 'white' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'black' }}>
                      🟢 Regular Loan Payments
                    </h3>
                  </div>
                  <div style={{ height: '265px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
                    {showRegularAdvanceOnly ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #0d6efd' }}>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>TYPE</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>ADVANCE AMOUNT</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>DATE</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>OR NO</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px' }}>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {renderAdvanceOnlyTable('Regular')}
                        </tbody>
                      </table>
                    ) : (
                      filteredRegular.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #28a745' }}>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>TYPE</th>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>AMOUNT</th>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>STATUS</th>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>DATE PAID</th>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px' }}>OR NO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {renderTableWithORGrouping(filteredRegular, 'Regular')}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                          <div style={{ fontSize: '48px', opacity: '0.5' }}>📭</div>
                          <div>No paid payments for regular loans</div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Emergency Loan Payment Table Section */}
              <div style={{ width: '550px', marginTop: '-450px', marginRight: '300px' }}>
                {/* Emergency History Button - Above Table */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', marginLeft: '50px' }}>
                  <button
                    onClick={() => { setShowEmergencyHistory(true); setShowEmergencyAdvanceOnly(false); }}
                    style={{
                      background: '#fbe9ef',
                      color: '#000',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      flex: 1
                    }}
                    title={'Show Emergency Payment History'}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-3px)';
                      e.target.style.boxShadow = '0 5px 15px rgba(220, 53, 69, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    CLICK TO VIEW PAYMENTS HISTORY
                  </button>
                  <button
                    onClick={() => setShowEmergencyAdvanceOnly(true)}
                    style={{
                      background: showEmergencyAdvanceOnly ? '#dc3545' : '#fbe9ef',
                      color: showEmergencyAdvanceOnly ? 'white' : '#000',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      flex: 1
                    }}
                    title={'Show archived advance payments only'}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-3px)';
                      e.target.style.boxShadow = '0 5px 15px rgba(220, 53, 69, 0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    ADVANCE PAYMENT
                  </button>
                </div>
                {/* Emergency Loan Payment Table */}
                <div style={{ background: 'white', boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)', borderRadius: '15px', overflow: 'hidden', height: '310px', marginLeft: '50px', width: '550px' }}>
                  <div style={{ background: '#dc3545', padding: '10px', color: 'white' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'black' }}>
                      🔴 Emergency Loan Payments
                    </h3>
                  </div>
                  <div style={{ height: '265px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
                    {showEmergencyAdvanceOnly ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #0d6efd' }}>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>TYPE</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>ADVANCE AMOUNT</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>DATE</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>OR NO</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px' }}>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {renderAdvanceOnlyTable('Emergency')}
                        </tbody>
                      </table>
                    ) : (
                      filteredEmergency.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dc3545' }}>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>TYPE</th>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>AMOUNT</th>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>STATUS</th>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>DATE PAID</th>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '700', fontSize: '12px' }}>OR NO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {renderTableWithORGrouping(filteredEmergency, 'Emergency')}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                          <div style={{ fontSize: '48px', opacity: '0.5' }}>📭</div>
                          <div>No paid payments for emergency loans</div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Regular Payment History Modal */}
          {showRegularHistory && (
            <div 
              onClick={() => setShowRegularHistory(false)}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.3s ease-out' }}
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'white', borderRadius: '20px', maxWidth: '90%', maxHeight: '85vh', width: '1200px', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)', overflow: 'hidden', animation: 'slideUp 0.3s ease-out' }}
              >
                <div style={{ background: '#28a745', padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '24px', fontWeight: '700' }}>
                    Regular Loan - Complete Payment History
                  </h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handlePrint('Regular', regularPaymentHistory)}
                      style={{ background: 'white', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <BsFillPrinterFill /> Print
                    </button>
                    <button
                      onClick={() => setShowRegularHistory(false)}
                      style={{ background: 'rgba(94, 94, 94, 1)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  </div>
                </div>
                  
                <div style={{ maxHeight: '70vh', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #28a745' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>TYPE</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>AMOUNT</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>DATE PAID</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>OR NO.</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', fontSize: '12px' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const normalized = normalizeHistoryForTable(regularPaymentHistory, 'Regular');
                        if (normalized.length === 0) {
                          return (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                                <div style={{ fontSize: '48px', opacity: '0.5' }}>📭</div>
                                <div>No payment history found for regular loans</div>
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
            <div 
              onClick={() => setShowEmergencyHistory(false)}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.3s ease-out' }}
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'white', borderRadius: '20px', maxWidth: '90%', maxHeight: '85vh', width: '1200px', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)', overflow: 'hidden', animation: 'slideUp 0.3s ease-out' }}
              >
                <div style={{ background: '#dc3545', padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '24px', fontWeight: '700' }}>
                    Emergency Loan - Complete Payment History
                  </h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => handlePrint('Emergency', emergencyPaymentHistory)} 
                      style={{ background: 'white', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <BsFillPrinterFill /> Print
                    </button>
                    <button
                      onClick={() => setShowEmergencyHistory(false)}
                      style={{ background: 'rgba(94, 94, 94, 1)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  </div>
                </div>
                  
                <div style={{ maxHeight: '70vh', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dc3545' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>TYPE</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>AMOUNT</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>DATE PAID</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', fontSize: '12px', borderRight: '1px solid #9b9b9bff' }}>OR NO.</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '700', fontSize: '12px' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const normalized = normalizeHistoryForTable(emergencyPaymentHistory, 'Emergency');
                        if (normalized.length === 0) {
                          return (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                                <div style={{ fontSize: '48px', opacity: '0.5' }}>📭</div>
                                <div>No payment history found for emergency loans</div>
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

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }

            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
        </div>
      </div>
    </div>
  );
};

export default Home;