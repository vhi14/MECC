// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import Topbar from '../Topbar/Topbar';
// import axios from 'axios';
// import { Eye } from 'lucide-react';
// import { BsFillPrinterFill } from "react-icons/bs";

// const Home = () => {
//   const [memberData, setMemberData] = useState(null);
//   const [loanData, setLoanData] = useState([]);
//   const [paymentSchedules, setPaymentSchedules] = useState([]);
//   const [payments, setPayments] = useState([]);
//   const [controlNumberDetails, setControlNumberDetails] = useState([]);
//   const [error, setError] = useState(null);
//   const [cachedRemainingBalance, setCachedRemainingBalance] = useState(null);
//   const [showCachedBalance, setShowCachedBalance] = useState(false);
//   const [loanDetails, setLoanDetails] = useState({});
//   const [searchQuery, setSearchQuery] = useState('');
//   const [openORGroups, setOpenORGroups] = useState({});
//   const [completePaymentHistory, setCompletePaymentHistory] = useState([]);
  
//   // New state for showing history modals
//   const [showRegularHistory, setShowRegularHistory] = useState(false);
//   const [showEmergencyHistory, setShowEmergencyHistory] = useState(false);
  
//   // NEW: State for current year/month tracking
//   const [currentRegularYear, setCurrentRegularYear] = useState(1);
//   const [currentEmergencyMonth, setCurrentEmergencyMonth] = useState(1);
  
//   // Loan fees state - NOW STORES ALL YEARS (Regular) and MONTHS (Emergency)
//   const [loanFees, setLoanFees] = useState({
//     regular: {
//       year1: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//       year2: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//       year3: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//       year4: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 }
//     },
//     emergency: {
//       month1: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//       month2: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//       month3: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//       month4: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//       month5: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//       month6: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 }
//     }
//   });
  
//   const navigate = useNavigate();

//   const SHARE_CAPITAL_LIMIT = 1000000; 
//   const REGULAR_LOAN_LIMIT = 1500000; 
//   const SCHEDULES_PER_YEAR = 24;

//   const toggleORGroup = (loanType, orNumber) => {
//     setOpenORGroups((prev) => ({
//       ...prev,
//       [`${loanType}-${orNumber}`]: !prev[`${loanType}-${orNumber}`]
//     }));
//   };

//   const handlePrint = (historyType, data) => {
//     const printWindow = window.open('', '_blank');
    
//     printWindow.document.write(`
//       <html>
//         <head>
//           <title>${historyType} Payment History</title>
//           <style>
//             table {
//               width: 100%;
//               border-collapse: collapse;
//               margin-bottom: 20px;
//             }
//             th, td {
//               border: 1px solid #ddd;
//               padding: 8px;
//               text-align: left;
//             }
//             th {
//               background-color: ${historyType === 'Regular' ? '#28a745' : '#dc3545'};
//               color: white;
//             }
//             .header {
//               text-align: center;
//               margin-bottom: 20px;
//             }
//             .type-badge {
//               background-color: ${historyType === 'Regular' ? '#28a745' : '#dc3545'};
//               color: white;
//               padding: 4px 8px;
//               border-radius: 12px;
//               font-size: 11px;
//             }
//             @media print {
//               body { padding: 20px; }
//             }
//           </style>
//         </head>
//         <body>
//           <div class="header">
//             <h2>${historyType} Loan Payment History</h2>
//             <p>Print Date: ${new Date().toLocaleDateString()}</p>
//           </div>
//           <table>
//             <thead>
//               <tr>
//                 <th>TYPE</th>
//                 <th>AMOUNT</th>
//                 <th>DATE PAID</th>
//                 <th>OR NO.</th>
//                 <th>STATUS</th>
//               </tr>
//             </thead>
//             <tbody>
//               ${data.map(payment => `
//                 <tr>
//                   <td><span class="type-badge">${payment.loan_type}</span></td>
//                   <td>₱${formatNumber(parseFloat(payment.payment_amount || 0).toFixed(2))}</td>
//                   <td>${formatDate(payment.payment_date)}</td>
//                   <td>${payment.or_number}</td>
//                   <td><span class="type-badge">✓ Settled</span></td>
//                 </tr>
//               `).join('')}
//             </tbody>
//           </table>
//         </body>
//       </html>
//     `);
    
//     printWindow.document.close();
//     printWindow.focus();
//     printWindow.print();
//     printWindow.close();
//   };

//   const formatRemainingBalance = (number) => {
//     if (number == null || isNaN(number)) return "N/A";
//     return new Intl.NumberFormat('en-US', {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2
//     }).format(number);
//   };

//   const formatNumber = (number) => {
//     if (number == null || number === '') return "0.00";
//     const num = Number(number) || 0;
//     return new Intl.NumberFormat('en-US', {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2
//     }).format(num);
//   };

//   const formatPaidAmount = (number) => {
//     if (number == null || isNaN(number)) return "0.00";
//     return new Intl.NumberFormat('en-US', {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2
//     }).format(number);
//   };

//   const formatDate = (dateString) => {
//     try {
//       const date = new Date(dateString);
//       if (isNaN(date.getTime())) {
//         return 'Invalid Date';
//       }
      
//       return date.toLocaleDateString('en-PH', {
//         year: 'numeric',
//         month: 'numeric',
//         day: '2-digit',
//         timeZone: 'Asia/Manila'
//       });
//     } catch (error) {
//       console.error('Date formatting error:', error);
//       return 'Invalid Date';
//     }
//   };

//   // NEW FUNCTION: Determine current year/month based on payment progress
//   const determineCurrentPeriod = (schedules, loanType) => {
//     if (!schedules || schedules.length === 0) return 1;
    
//     const loanSchedules = schedules
//       .filter(s => s.loan_type === loanType)
//       .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    
//     // Count paid schedules
//     const paidCount = loanSchedules.filter(s => s.is_paid).length;
    
//     if (loanType === 'Regular') {
//       // Regular loans: 24 schedules per year
//       const year = Math.floor(paidCount / SCHEDULES_PER_YEAR) + 1;
//       return Math.min(year, 4); // Cap at year 4
//     } else {
//       // Emergency loans: 4 schedules per month (bi-monthly)
//       const month = Math.floor(paidCount / 4) + 1;
//       return Math.min(month, 6); // Cap at month 6
//     }
//   };

//   // NEW FUNCTION: Fetch loan details with recalculations
//   const fetchLoanDetailsWithRecalculations = async (controlNumber, token) => {
//     try {
//       const response = await axios.get(
//         `http://127.0.0.1:8000/loans/${controlNumber}/detailed_loan_info/`,
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );
//       return response.data;
//     } catch (error) {
//       console.error(`Error fetching details for ${controlNumber}:`, error);
//       return null;
//     }
//   };

//   // FETCH COMPLETE PAYMENT HISTORY
//   const fetchCompletePaymentHistory = async (accountNumber) => {
//     try {
//       const [archivedResponse, activeResponse] = await Promise.all([
//         axios.get(`http://127.0.0.1:8000/payment-history/${accountNumber}/`),
//         axios.get(`http://127.0.0.1:8000/payment-schedules/?account_number=${accountNumber}`)
//       ]);

//       const archivedPayments = archivedResponse.data || [];
//       const activePayments = activeResponse.data || [];

//       const allPayments = [
//         ...archivedPayments,
//         ...activePayments.filter(schedule => schedule.is_paid).map(schedule => ({
//           loan_type: schedule.loan_type,
//           payment_amount: schedule.payment_amount,
//           payment_date: schedule.payment_date || schedule.due_date,
//           or_number: schedule.or_number,
//           control_number: schedule.control_number,
//           status: 'Paid'
//         }))
//       ];

//       const seen = new Set();
//       return allPayments.filter(payment => {
//         const key = `${payment.control_number}_${payment.or_number}`;
//         if (seen.has(key)) return false;
//         seen.add(key);
//         return true;
//       });

//     } catch (err) {
//       console.error('Error fetching payment history:', err);
//       return [];
//     }
//   };

//   // Filter loans for the current member
//   const loansForMember = loanData.filter(
//     loan => loan.account_number === memberData?.accountN || loan.account === memberData?.accountN
//   );

//   // Get nearest payment schedule for regular loans
//   const nearestRegularPaymentSchedule = paymentSchedules
//     .filter(schedule => 
//       schedule.loan_type === 'Regular' &&
//       loansForMember.find(loan => 
//         loan.id === schedule.loan_id && 
//         loan.loan_type === 'Regular'
//       )
//     )
//     .sort((a, b) => {
//       const loanA = loansForMember.find(l => l.id === a.loan_id);
//       const loanB = loansForMember.find(l => l.id === b.loan_id);
      
//       if (loanA?.status === 'Paid-off' && loanB?.status !== 'Paid-off') return 1;
//       if (loanA?.status !== 'Paid-off' && loanB?.status === 'Paid-off') return -1;
      
//       return new Date(a.due_date) - new Date(b.due_date);
//     })[0];

//   const nearestRegularLoan = nearestRegularPaymentSchedule
//     ? loansForMember.find(loan => 
//         loan.id === nearestRegularPaymentSchedule.loan_id && 
//         loan.loan_type === 'Regular'
//       )
//     : null;

//   const nearestEmergencyPaymentSchedule = paymentSchedules
//     .filter(schedule => 
//       schedule.loan_type === 'Emergency' &&
//       loansForMember.find(loan => 
//         loan.id === schedule.loan_id && 
//         loan.loan_type === 'Emergency'
//       )
//     )
//     .sort((a, b) => {
//       const loanA = loansForMember.find(l => l.id === a.loan_id);
//       const loanB = loansForMember.find(l => l.id === b.loan_id);
      
//       if (loanA?.status === 'Paid-off' && loanB?.status !== 'Paid-off') return 1;
//       if (loanA?.status !== 'Paid-off' && loanB?.status === 'Paid-off') return -1;
      
//       return new Date(a.due_date) - new Date(b.due_date);
//     })[0];

//   const nearestEmergencyLoan = nearestEmergencyPaymentSchedule
//     ? loansForMember.find(loan => 
//         loan.id === nearestEmergencyPaymentSchedule.loan_id && 
//         loan.loan_type === 'Emergency'
//       )
//     : null;

//   // Get paid schedules for payment tables
//   const paidSchedules = paymentSchedules.filter(
//     (schedule) => schedule.is_paid || schedule.status === 'Paid'
//   );

//   const schedulesWithDetails = paidSchedules.map((schedule) => {
//     const orNumber = schedule.OR || 
//                     schedule.or_number || 
//                     schedule.orNumber || 
//                     schedule.or_num ||
//                     schedule.receipt_number ||
//                     schedule.receipt_no ||
//                     schedule.official_receipt ||
//                     schedule.or_id ||
//                     'N/A';

//     return {
//       ...schedule,
//       payment_date: schedule.payment_date
//         ? new Date(schedule.payment_date).toLocaleDateString()
//         : 'N/A',
//       or_number: orNumber,
//     };
//   });

//   // Filter for regular and emergency paid schedules
//   const filteredRegular = schedulesWithDetails.filter((schedule) => {
//     const searchLower = searchQuery.toLowerCase();
//     const fullDate = schedule.payment_date !== 'N/A' ? schedule.payment_date : formatDate(schedule.due_date);
//     const orNumber = (schedule.or_number || '').toString().toLowerCase();
    
//     return schedule.loan_type === 'Regular' && (
//       fullDate.toLowerCase().includes(searchLower) || 
//       orNumber.includes(searchLower)
//     );
//   });

//   const filteredEmergency = schedulesWithDetails.filter((schedule) => {
//     const searchLower = searchQuery.toLowerCase();
//     const fullDate = schedule.payment_date !== 'N/A' ? schedule.payment_date : formatDate(schedule.due_date);
//     const orNumber = (schedule.or_number || '').toString().toLowerCase();
    
//     return schedule.loan_type === 'Emergency' && (
//       fullDate.toLowerCase().includes(searchLower) || 
//       orNumber.includes(searchLower)
//     );
//   });

//   // Filter COMPLETE payment history
//   const regularPaymentHistory = completePaymentHistory
//     .filter(payment => payment.loan_type === 'Regular')
//     .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
  
//   const emergencyPaymentHistory = completePaymentHistory
//     .filter(payment => payment.loan_type === 'Emergency')
//     .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

//   // Calculate paid balance for regular loans
//   const calculatePaidBalance = () => {
//     if (!nearestRegularLoan) return 0;
    
//     return paymentSchedules
//       .filter(schedule => 
//         schedule.loan_id === nearestRegularLoan.id &&
//         schedule.loan_type === 'Regular' &&
//         (schedule.is_paid === true || schedule.status === 'Paid')
//       )
//       .reduce((total, schedule) => {
//         return total + parseFloat(schedule.payment_amount || 0);
//       }, 0);
//   };

//   // Calculate paid balance for emergency loans
//   const calculatePaidBalanceForEmergency = () => {
//     if (!nearestEmergencyLoan) return 0;
    
//     return paymentSchedules
//       .filter(schedule => 
//         schedule.loan_id === nearestEmergencyLoan.id && 
//         schedule.loan_type === 'Emergency' &&
//         (schedule.is_paid === true || schedule.status === 'Paid')
//       )
//       .reduce((total, schedule) => {
//         return total + parseFloat(schedule.payment_amount || 0);
//       }, 0);
//   };

//   const calculateRemainingBalance = () => {
//     if (!nearestRegularLoan) return 0;

//     const schedules = paymentSchedules.filter(schedule => 
//       schedule.loan_id === nearestRegularLoan.id && 
//       schedule.loan_type === 'Regular'
//     );

//     if (schedules.length === 0) return 0;

//     const details = loanDetails[nearestRegularLoan.control_number];
    
//     if (details && details.yearly_recalculations && details.yearly_recalculations.length > 0) {
//       const SCHEDULES_PER_YEAR = 24;
//       const allSchedules = [...schedules].sort((a, b) => 
//         new Date(a.due_date) - new Date(b.due_date)
//       );
      
//       let lastCompletedYear = 0;
//       for (let year = 1; year <= 4; year++) {
//         const yearStart = (year - 1) * SCHEDULES_PER_YEAR;
//         const yearEnd = yearStart + SCHEDULES_PER_YEAR;
//         const yearSchedules = allSchedules.slice(yearStart, yearEnd);
        
//         if (yearSchedules.length > 0 && yearSchedules.every(s => s.is_paid)) {
//           lastCompletedYear = year;
//         } else {
//           break;
//         }
//       }
      
//       if (lastCompletedYear > 0) {
//         const nextYearRecalc = details.yearly_recalculations.find(
//           r => r.year === lastCompletedYear + 1 && 
//                r.loan_control_number === nearestRegularLoan.control_number
//         );
        
//         if (nextYearRecalc) {
//           const outstandingBalance = parseFloat(nextYearRecalc.outstanding_balance || 0);
//           const currentYearStart = lastCompletedYear * SCHEDULES_PER_YEAR;
//           const currentYearSchedules = allSchedules.slice(currentYearStart);
//           const currentYearPaid = currentYearSchedules
//             .filter(s => s.is_paid)
//             .reduce((sum, s) => sum + parseFloat(s.payment_amount || 0), 0);
          
//           return Math.max(0, outstandingBalance - currentYearPaid);
//         }
//       }
//     }
    
//     return schedules
//       .filter(s => !s.is_paid)
//       .reduce((sum, s) => {
//         const paymentAmount = parseFloat(s.payment_amount || 0);
//         const penalty = parseFloat(s.penalty || 0);
//         return sum + paymentAmount + penalty;
//       }, 0);
//   };

//   const calculateRemainingBalanceForEmergency = () => {
//     if (!nearestEmergencyLoan) return 0;

//     const schedules = paymentSchedules.filter(schedule => 
//       schedule.loan_id === nearestEmergencyLoan.id && 
//       schedule.loan_type === 'Emergency'
//     );

//     if (schedules.length === 0) return 0;

//     const details = loanDetails[nearestEmergencyLoan.control_number];
    
//     if (details && details.yearly_recalculations && details.yearly_recalculations.length > 0) {
//       const SCHEDULES_PER_YEAR = 24;
//       const allSchedules = [...schedules].sort((a, b) => 
//         new Date(a.due_date) - new Date(b.due_date)
//       );
      
//       let lastCompletedYear = 0;
//       for (let year = 1; year <= 4; year++) {
//         const yearStart = (year - 1) * SCHEDULES_PER_YEAR;
//         const yearEnd = yearStart + SCHEDULES_PER_YEAR;
//         const yearSchedules = allSchedules.slice(yearStart, yearEnd);
        
//         if (yearSchedules.length > 0 && yearSchedules.every(s => s.is_paid)) {
//           lastCompletedYear = year;
//         } else {
//           break;
//         }
//       }
      
//       if (lastCompletedYear > 0) {
//         const nextYearRecalc = details.yearly_recalculations.find(
//           r => r.year === lastCompletedYear + 1 && 
//                r.loan_control_number === nearestEmergencyLoan.control_number
//         );
        
//         if (nextYearRecalc) {
//           const outstandingBalance = parseFloat(nextYearRecalc.outstanding_balance || 0);
//           const currentYearStart = lastCompletedYear * SCHEDULES_PER_YEAR;
//           const currentYearSchedules = allSchedules.slice(currentYearStart);
//           const currentYearPaid = currentYearSchedules
//             .filter(s => s.is_paid)
//             .reduce((sum, s) => sum + parseFloat(s.payment_amount || 0), 0);
          
//           return Math.max(0, outstandingBalance - currentYearPaid);
//         }
//       }
//     }
    
//     return schedules
//       .filter(s => !s.is_paid)
//       .reduce((sum, s) => {
//         const paymentAmount = parseFloat(s.payment_amount || 0);
//         const penalty = parseFloat(s.penalty || 0);
//         return sum + paymentAmount + penalty;
//       }, 0);
//   };

//   const handleNavigation = (path) => {
//     navigate(path);
//   };

//   // Function to render table with OR grouping
//   const renderTableWithORGrouping = (filteredSchedules, loanType) => {
//     const groupedByOR = filteredSchedules.reduce((acc, schedule) => {
//       const orNum = schedule.or_number || 'N/A';
//       if (!acc[orNum]) acc[orNum] = [];
//       acc[orNum].push(schedule);
//       return acc;
//     }, {});

//     const rows = [];
    
//     Object.entries(groupedByOR).forEach(([orNumber, orSchedules]) => {
//       const isOpen = openORGroups[`${loanType}-${orNumber}`];
//       const hasMultiple = orSchedules.length > 1;
      
//       const firstSchedule = orSchedules[0];
//       rows.push(
//         <tr key={`${firstSchedule.id || firstSchedule.control_number}-main`}>
//           <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
//             <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: loanType === 'Regular' ? '#28a745' : '#dc3545', color: '#fff', fontSize: '11px', fontWeight: '600' }}>
//               {firstSchedule.loan_type || 'N/A'}
//             </span>
//           </td>
//           <td style={{ padding: '10px 8px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
//             ₱{formatNumber(parseFloat(firstSchedule.payment_amount || 0).toFixed(2))}
//           </td>
//           <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
//             <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#28a745', color: 'white', fontSize: '11px', fontWeight: '600' }}>
//               ✓ Settled
//             </span>
//           </td>
//           <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
//             {firstSchedule.payment_date !== 'N/A' ? firstSchedule.payment_date : formatDate(firstSchedule.due_date)}
//           </td>
//           <td style={{ padding: '10px 8px', fontWeight: '600', borderBottom: '1px solid #9b9b9bff' }}>
//             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
//               {hasMultiple && (
//                 <span 
//                   onClick={(e) => {
//                     e.stopPropagation();
//                     toggleORGroup(loanType, orNumber);
//                   }}
//                   style={{ 
//                     cursor: 'pointer', 
//                     userSelect: 'none',
//                     fontSize: '16px',
//                     color: '#0b26f7ff',
//                     fontWeight: 'bold'
//                   }}
//                 >
//                   {isOpen ? '▼' : '►'}
//                 </span>
//               )}
//               <span>{firstSchedule.or_number}</span>
//               {hasMultiple && (
//                 <span style={{ fontSize: '12px', color: '#000000ff' }}>
//                   ({orSchedules.length})
//                 </span>
//               )}
//             </div>
//           </td>
//         </tr>
//       );
      
//       if (hasMultiple && isOpen) {
//         orSchedules.slice(1).forEach((schedule, idx) => {
//           rows.push(
//             <tr key={`${schedule.id || schedule.control_number}-${idx}`} style={{ backgroundColor: '#f9f9f9' }}>
//               <td style={{ padding: '10px 8px', paddingLeft: '20px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
//                 <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: loanType === 'Regular' ? '#28a745' : '#dc3545', color: '#fff', fontSize: '11px', fontWeight: '600' }}>
//                   {schedule.loan_type || 'N/A'}
//                 </span>
//               </td>
//               <td style={{ padding: '10px 8px', paddingLeft: '20px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
//                 ₱{formatNumber(parseFloat(schedule.payment_amount || 0).toFixed(2))}
//               </td>
//               <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
//                 <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#28a745', color: 'white', fontSize: '11px', fontWeight: '600' }}>
//                   ✓ Settled
//                 </span>
//               </td>
//               <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
//                 {schedule.payment_date !== 'N/A' ? schedule.payment_date : formatDate(schedule.due_date)}
//               </td>
//               <td style={{ padding: '10px 8px', paddingLeft: '30px', fontWeight: '600', borderBottom: '1px solid #9b9b9bff' }}>
//                 {schedule.or_number}
//               </td>
//             </tr>
//           );
//         });
//       }
//     });
    
//     return rows;
//   };

//   // NEW EFFECT: Fetch loan fees based on current year/month and recalculations
//   useEffect(() => {
//     const fetchYearlyLoanFees = async () => {
//       if (loansForMember.length === 0 || !paymentSchedules.length) return;

//       const token = localStorage.getItem('accessToken');
//       if (!token) return;

//       try {
//         // Process Regular Loans
//         const regularLoans = loansForMember.filter(loan => loan.loan_type === 'Regular');
//         const recentRegularLoan = regularLoans.sort((a, b) => 
//           new Date(b.loan_date) - new Date(a.loan_date)
//         )[0];

//         // Process Emergency Loans
//         const emergencyLoans = loansForMember.filter(loan => loan.loan_type === 'Emergency');
//         const recentEmergencyLoan = emergencyLoans.sort((a, b) => 
//           new Date(b.loan_date) - new Date(a.loan_date)
//         )[0];

//         const newFees = {
//           regular: {
//             year1: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//             year2: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//             year3: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//             year4: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 }
//           },
//           emergency: {
//             month1: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//             month2: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//             month3: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//             month4: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//             month5: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 },
//             month6: { interest: 0, cisp: 0, service_fee: 0, admin_cost: 0 }
//           }
//         };

//         // Fetch Regular Loan Details
//         if (recentRegularLoan) {
//           const regularDetails = await fetchLoanDetailsWithRecalculations(
//             recentRegularLoan.control_number, 
//             token
//           );

//           if (regularDetails) {
//             // Year 1 - Original loan
//             newFees.regular.year1 = {
//               interest: regular