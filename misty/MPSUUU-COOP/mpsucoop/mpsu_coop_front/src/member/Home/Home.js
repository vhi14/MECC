// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import Topbar from '../Topbar/Topbar';
// import axios from 'axios';
// import { BsFillPrinterFill } from "react-icons/bs";
// import { FaMoneyBillWave, FaCoins, FaHistory } from "react-icons/fa";

// const Home = () => {
//   const [memberData, setMemberData] = useState(null);
//   const [loanData, setLoanData] = useState([]);
//   const [paymentSchedules, setPaymentSchedules] = useState([]);
//   const [error, setError] = useState(null);
  
//   // Mobile modals
//   const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  
//   const navigate = useNavigate();

//   const formatNumber = (number) => {
//     if (number == null || number === '') return "0.00";
//     const num = Number(number) || 0;
//     return new Intl.NumberFormat('en-US', {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2
//     }).format(num);
//   };

//   const formatDate = (dateString) => {
//     try {
//       const date = new Date(dateString);
//       if (isNaN(date.getTime())) return 'Invalid Date';
//       return date.toLocaleDateString('en-PH', {
//         year: 'numeric',
//         month: 'numeric',
//         day: '2-digit',
//         timeZone: 'Asia/Manila'
//       });
//     } catch (error) {
//       return 'Invalid Date';
//     }
//   };

//   const handleNavigation = (path) => {
//     navigate(path);
//   };

//   useEffect(() => {
//     const fetchAllData = async () => {
//       try {
//         const token = localStorage.getItem('accessToken');
//         const acc_number = localStorage.getItem('account_number');

//         if (!token || !acc_number) {
//           setError("Missing token or account number. Please log in again.");
//           return;
//         }

//         const memberResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/member/profile/`, {
//           params: { account_number: acc_number },
//           headers: { Authorization: `Bearer ${token}` },
//         });

//         const accountNumber = memberResponse.data.accountN;

//         const loanResponse = await axios.get(`${process.env.REACT_APP_API_URL}/loans/?account_number=${accountNumber}`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });

//         const paymentScheduleResponse = await axios.get(`${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });

//         setMemberData(memberResponse.data);
//         setLoanData(loanResponse.data);
//         setPaymentSchedules(paymentScheduleResponse.data);

//       } catch (err) {
//         setError(err.response?.data?.detail || "Error fetching data.");
//       }
//     };

//     fetchAllData();
//   }, []);

//   const loansForMember = loanData.filter(
//     loan => loan.account_number === memberData?.accountN || loan.account === memberData?.accountN
//   );

//   const nearestRegularLoan = loansForMember.find(loan => loan.loan_type === 'Regular');
//   const nearestEmergencyLoan = loansForMember.find(loan => loan.loan_type === 'Emergency');

//   const paidSchedules = paymentSchedules.filter(schedule => schedule.is_paid || schedule.status === 'Paid');
//   const regularPayments = paidSchedules.filter(s => s.loan_type === 'Regular');
//   const emergencyPayments = paidSchedules.filter(s => s.loan_type === 'Emergency');

//   if (error) {
//     return (
//       <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
//         <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '500px' }}>
//           <div style={{ width: '80px', height: '80px', background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)', borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white' }}>⚠</div>
//           <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>Oops! Something went wrong</h2>
//           <p style={{ color: '#7f8c8d', marginBottom: '30px', fontSize: '16px' }}>{error}</p>
//           <a href="/" style={{ display: 'inline-block', background: 'linear-gradient(45deg, #667eea, #764ba2)', color: 'white', padding: '12px 30px', textDecoration: 'none', borderRadius: '25px', fontWeight: '600', transition: 'transform 0.3s ease', boxShadow: '0 5px 15px rgba(102, 126, 234, 0.3)' }}>Return to Login</a>
//         </div>
//       </div>
//     );
//   }

//   if (!memberData) {
//     return (
//       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
//         <div style={{ padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
//           <div style={{ width: '50px', height: '50px', border: '4px solid #667eea', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
//           <p style={{ color: '#0b78e6ff', fontSize: '14px' }}>Loading your dashboard...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div style={{ minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
//       <Topbar />
      
//       {/* RESPONSIVE MEDIA QUERIES */}
//       <style>
//         {`
//           /* Desktop/Tablet View */
//           .home-desktop-view {
//             display: block;
//           }
//           .home-mobile-view {
//             display: none;
//           }
//           .home-floating-buttons {
//             display: none;
//           }

//           /* Mobile View (768px and below) */
//           @media (max-width: 768px) {
//             .home-desktop-view {
//               display: none !important;
//             }
//             .home-mobile-view {
//               display: block !important;
//             }
//             .home-floating-buttons {
//               display: flex !important;
//             }
            
//             .home-main-content {
//               padding: 15px 10px !important;
//               margin-top: 80px !important;
//             }
            
//             .home-loan-card {
//               margin-bottom: 15px !important;
//             }
//           }

//           @keyframes spin {
//             0% { transform: rotate(0deg); }
//             100% { transform: rotate(360deg); }
//           }
//         `}
//       </style>

//       {/* DESKTOP VIEW */}
//       <div className="home-desktop-view" style={{ padding: '40px 20px', marginTop: '170px' }}>
//         <div style={{ width: '1500px', margin: '0 auto' }}>
//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            
//             {/* Left Panel */}
//             <div style={{ padding: '4px' }}>
//               {/* Member Info */}
//               <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '20px', borderRadius: '15px', marginBottom: '20px', textAlign: 'center' }}>
//                 <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '15px', textTransform: 'uppercase' }}>
//                   {memberData.first_name} {memberData.middle_name} {memberData.last_name}
//                 </h2>
//                 <div style={{ background: 'rgba(51, 49, 49, 0.2)', padding: '10px 20px', borderRadius: '25px', display: 'inline-block', fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>
//                   Account: {memberData.accountN || 'N/A'}
//                 </div>
//                 <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
//                   <div style={{ fontSize: '16px', fontWeight: '700' }}>
//                     💰 Share Capital: ₱{formatNumber(memberData.share_capital || 0)}
//                   </div>
//                 </div>
//               </div>

//               {/* Action Buttons */}
//               <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
//                 <button onClick={() => handleNavigation('/accounts')} style={{ background: '#28a745', boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', color: 'black', border: 'none', padding: '15px', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'transform 0.3s ease' }}>
//                   📊 Share Capital Transactions
//                 </button>
//                 <button onClick={() => handleNavigation('/loans')} style={{ background: '#007bff', boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', color: 'black', border: 'none', padding: '15px', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'transform 0.3s ease' }}>
//                   💳 Bi Monthly Amortization
//                 </button>
//               </div>
//             </div>

//             {/* Right Panel - Loan Details */}
//             <div style={{ padding: '4px' }}>
//               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
//                 {/* Regular Loan */}
//                 <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', borderRadius: '15px', padding: '20px' }}>
//                   <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '15px', textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px' }}>
//                     🏦 REGULAR LOAN DETAILS
//                   </h3>
//                   {nearestRegularLoan ? (
//                     <div>
//                       <p style={{ fontSize: '14px', marginBottom: '10px' }}><strong>Loan Amount:</strong> ₱{formatNumber(nearestRegularLoan.loan_amount)}</p>
//                       <p style={{ fontSize: '14px', marginBottom: '10px' }}><strong>Status:</strong> {nearestRegularLoan.status}</p>
//                       <p style={{ fontSize: '14px' }}><strong>Control #:</strong> {nearestRegularLoan.control_number}</p>
//                     </div>
//                   ) : (
//                     <p style={{ textAlign: 'center', color: '#6c757d' }}>No Regular Loan</p>
//                   )}
//                 </div>

//                 {/* Emergency Loan */}
//                 <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', borderRadius: '15px', padding: '20px' }}>
//                   <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '15px', textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px' }}>
//                     🚨 EMERGENCY LOAN DETAILS
//                   </h3>
//                   {nearestEmergencyLoan ? (
//                     <div>
//                       <p style={{ fontSize: '14px', marginBottom: '10px' }}><strong>Loan Amount:</strong> ₱{formatNumber(nearestEmergencyLoan.loan_amount)}</p>
//                       <p style={{ fontSize: '14px', marginBottom: '10px' }}><strong>Status:</strong> {nearestEmergencyLoan.status}</p>
//                       <p style={{ fontSize: '14px' }}><strong>Control #:</strong> {nearestEmergencyLoan.control_number}</p>
//                     </div>
//                   ) : (
//                     <p style={{ textAlign: 'center', color: '#6c757d' }}>No Emergency Loan</p>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Payment Tables */}
//           <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
//             {/* Regular Payments */}
//             <div style={{ background: 'white', boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)', borderRadius: '15px', overflow: 'hidden' }}>
//               <div style={{ background: '#28a745', padding: '15px', color: 'white' }}>
//                 <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'black' }}>🟢 Regular Loan Payments</h3>
//               </div>
//               <div style={{ height: '300px', overflowY: 'auto', padding: '15px' }}>
//                 {regularPayments.length > 0 ? (
//                   regularPayments.map((payment, idx) => (
//                     <div key={idx} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
//                       <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Amount:</strong> ₱{formatNumber(payment.payment_amount)}</p>
//                       <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Date:</strong> {formatDate(payment.payment_date || payment.due_date)}</p>
//                       <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>OR #:</strong> {payment.or_number || 'N/A'}</p>
//                     </div>
//                   ))
//                 ) : (
//                   <p style={{ textAlign: 'center', color: '#6c757d', paddingTop: '40px' }}>No payments found</p>
//                 )}
//               </div>
//             </div>

//             {/* Emergency Payments */}
//             <div style={{ background: 'white', boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)', borderRadius: '15px', overflow: 'hidden' }}>
//               <div style={{ background: '#dc3545', padding: '15px', color: 'white' }}>
//                 <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'black' }}>🔴 Emergency Loan Payments</h3>
//               </div>
//               <div style={{ height: '300px', overflowY: 'auto', padding: '15px' }}>
//                 {emergencyPayments.length > 0 ? (
//                   emergencyPayments.map((payment, idx) => (
//                     <div key={idx} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
//                       <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Amount:</strong> ₱{formatNumber(payment.payment_amount)}</p>
//                       <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Date:</strong> {formatDate(payment.payment_date || payment.due_date)}</p>
//                       <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>OR #:</strong> {payment.or_number || 'N/A'}</p>
//                     </div>
//                   ))
//                 ) : (
//                   <p style={{ textAlign: 'center', color: '#6c757d', paddingTop: '40px' }}>No payments found</p>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* MOBILE VIEW */}
//       <div className="home-mobile-view home-main-content" style={{ padding: '20px', marginTop: '100px' }}>
//         {/* Regular Loan Card */}
//         <div className="home-loan-card" style={{ background: '#888', boxShadow: '0px 6px 20px rgba(59, 59, 59, 0.12)', borderRadius: '15px', padding: '20px', marginBottom: '20px', border: '1.5px solid #e8eef5' }}>
//           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '15px', borderBottom: '2px solid #4f4f4fff' }}>
//             <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#000' }}>🏦 Regular Loan</h3>
//             <span style={{ background: '#28a745', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
//               {nearestRegularLoan?.status || 'N/A'}
//             </span>
//           </div>
//           {nearestRegularLoan ? (
//             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
//               <div style={{ padding: '10px', background: '#f8f9ff', borderRadius: '10px' }}>
//                 <div style={{ fontSize: '11px', color: '#000', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Loan Amount</div>
//                 <div style={{ fontSize: '14px', color: '#000', fontWeight: '900' }}>₱{formatNumber(nearestRegularLoan.loan_amount)}</div>
//               </div>
//               <div style={{ padding: '10px', background: '#f8f9ff', borderRadius: '10px' }}>
//                 <div style={{ fontSize: '11px', color: '#000', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Control #</div>
//                 <div style={{ fontSize: '14px', color: '#000', fontWeight: '700' }}>{nearestRegularLoan.control_number}</div>
//               </div>
//             </div>
//           ) : (
//             <p style={{ textAlign: 'center', color: '#6c757d' }}>No Regular Loan</p>
//           )}
//         </div>

//         {/* Emergency Loan Card */}
//         <div className="home-loan-card" style={{ background: '#888', boxShadow: '0px 6px 20px rgba(59, 59, 59, 0.12)', borderRadius: '15px', padding: '20px', marginBottom: '80px', border: '1.5px solid #e8eef5' }}>
//           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '15px', borderBottom: '2px solid #4f4f4fff' }}>
//             <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#000' }}>🚨 Emergency Loan</h3>
//             <span style={{ background: '#dc3545', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
//               {nearestEmergencyLoan?.status || 'N/A'}
//             </span>
//           </div>
//           {nearestEmergencyLoan ? (
//             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
//               <div style={{ padding: '10px', background: '#f8f9ff', borderRadius: '10px' }}>
//                 <div style={{ fontSize: '11px', color: '#000', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Loan Amount</div>
//                 <div style={{ fontSize: '14px', color: '#000', fontWeight: '900' }}>₱{formatNumber(nearestEmergencyLoan.loan_amount)}</div>
//               </div>
//               <div style={{ padding: '10px', background: '#f8f9ff', borderRadius: '10px' }}>
//                 <div style={{ fontSize: '11px', color: '#000', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Control #</div>
//                 <div style={{ fontSize: '14px', color: '#000', fontWeight: '700' }}>{nearestEmergencyLoan.control_number}</div>
//               </div>
//             </div>
//           ) : (
//             <p style={{ textAlign: 'center', color: '#6c757d' }}>No Emergency Loan</p>
//           )}
//         </div>
//       </div>

//       {/* FLOATING ACTION BUTTONS - Mobile Only */}
//       <div className="home-floating-buttons" style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '15px', zIndex: 999 }}>
//         <button onClick={() => handleNavigation('/loans')} style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'pointer', transition: 'all 0.3s ease' }} title="Bi Monthly Amortization">
//           <FaMoneyBillWave />
//         </button>
//         <button onClick={() => handleNavigation('/accounts')} style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(0, 180, 219, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'pointer', transition: 'all 0.3s ease' }} title="Share Capital Transactions">
//           <FaCoins />
//         </button>
//         <button onClick={() => setShowPaymentsModal(true)} style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(245, 87, 108, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'pointer', transition: 'all 0.3s ease' }} title="Payment History">
//           <FaHistory />
//         </button>
//       </div>

//       {/* PAYMENTS MODAL - Mobile */}
//       {showPaymentsModal && (
//         <>
//           <div onClick={() => setShowPaymentsModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(5px)', zIndex: 1000 }} />
//           <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', borderRadius: '20px', maxWidth: '95%', width: '500px', maxHeight: '85vh', zIndex: 1001, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)' }}>
//             <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//               <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: '700' }}>Payment History</h3>
//               <button onClick={() => setShowPaymentsModal(false)} style={{ background: 'white', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>
//                 Close
//               </button>
//             </div>
            
//             <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
//               {/* Regular Payments Section */}
//               <div style={{ marginBottom: '30px' }}>
//                 <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '15px', color: '#28a745', borderBottom: '2px solid #28a745', paddingBottom: '8px' }}>🟢 Regular Loan Payments</h4>
//                 {regularPayments.length > 0 ? (
//                   regularPayments.map((payment, idx) => (
//                     <div key={idx} style={{ background: '#f8f9ff', borderRadius: '10px', padding: '12px', marginBottom: '10px', border: '1px solid #e0e0e0' }}>
//                       <p style={{ margin: '5px 0', fontSize: '13px', fontWeight: '600' }}><strong>Amount:</strong> ₱{formatNumber(payment.payment_amount)}</p>
//                       <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>Date:</strong> {formatDate(payment.payment_date || payment.due_date)}</p>
//                       <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>OR #:</strong> {payment.or_number || 'N/A'}</p>
//                     </div>
//                   ))
//                 ) : (
//                   <p style={{ textAlign: 'center', color: '#6c757d', padding: '20px 0' }}>No payments found</p>
//                 )}
//               </div>

//               {/* Emergency Payments Section */}
//               <div>
//                 <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '15px', color: '#dc3545', borderBottom: '2px solid #dc3545', paddingBottom: '8px' }}>🔴 Emergency Loan Payments</h4>
//                 {emergencyPayments.length > 0 ? (
//                   emergencyPayments.map((payment, idx) => (
//                     <div key={idx} style={{ background: '#fff5f5', borderRadius: '10px', padding: '12px', marginBottom: '10px', border: '1px solid #e0e0e0' }}>
//                       <p style={{ margin: '5px 0', fontSize: '13px', fontWeight: '600' }}><strong>Amount:</strong> ₱{formatNumber(payment.payment_amount)}</p>
//                       <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>Date:</strong> {formatDate(payment.payment_date || payment.due_date)}</p>
//                       <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>OR #:</strong> {payment.or_number || 'N/A'}</p>
//                     </div>
//                   ))
//                 ) : (
//                   <p style={{ textAlign: 'center', color: '#6c757d', padding: '20px 0' }}>No payments found</p>
//                 )}
//               </div>
//             </div>
//           </div>
//         </>
//       )}
//     </div>
//   );
// };

// export default Home;
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../Topbar/Topbar';
import axios from 'axios';
import { BsFillPrinterFill } from "react-icons/bs";
import { FaMoneyBillWave, FaCoins, FaHistory } from "react-icons/fa";

const Home = () => {
  const [memberData, setMemberData] = useState(null);
  const [loanData, setLoanData] = useState([]);
  const [paymentSchedules, setPaymentSchedules] = useState([]);
  const [error, setError] = useState(null);
  
  // Mobile modals
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  
  const navigate = useNavigate();

  const formatNumber = (number) => {
    if (number == null || number === '') return "0.00";
    const num = Number(number) || 0;
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
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
      return 'Invalid Date';
    }
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

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

        setMemberData(memberResponse.data);
        setLoanData(loanResponse.data);
        setPaymentSchedules(paymentScheduleResponse.data);

      } catch (err) {
        setError(err.response?.data?.detail || "Error fetching data.");
      }
    };

    fetchAllData();
  }, []);

  const loansForMember = loanData.filter(
    loan => loan.account_number === memberData?.accountN || loan.account === memberData?.accountN
  );

  const nearestRegularLoan = loansForMember.find(loan => loan.loan_type === 'Regular');
  const nearestEmergencyLoan = loansForMember.find(loan => loan.loan_type === 'Emergency');

  const paidSchedules = paymentSchedules.filter(schedule => schedule.is_paid || schedule.status === 'Paid');
  const regularPayments = paidSchedules.filter(s => s.loan_type === 'Regular');
  const emergencyPayments = paidSchedules.filter(s => s.loan_type === 'Emergency');

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ width: '80px', height: '80px', background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)', borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white' }}>⚠</div>
          <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>Oops! Something went wrong</h2>
          <p style={{ color: '#7f8c8d', marginBottom: '30px', fontSize: '16px' }}>{error}</p>
          <a href="/" style={{ display: 'inline-block', background: 'linear-gradient(45deg, #667eea, #764ba2)', color: 'white', padding: '12px 30px', textDecoration: 'none', borderRadius: '25px', fontWeight: '600', transition: 'transform 0.3s ease', boxShadow: '0 5px 15px rgba(102, 126, 234, 0.3)' }}>Return to Login</a>
        </div>
      </div>
    );
  }

  if (!memberData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid #667eea', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
          <p style={{ color: '#0b78e6ff', fontSize: '14px' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <Topbar />
      
      {/* RESPONSIVE MEDIA QUERIES */}
      <style>
        {`
          /* Desktop/Tablet View - DEFAULT */
          .home-desktop-view {
            display: block !important;
          }
          .home-mobile-view {
            display: none !important;
          }
          .home-floating-buttons {
            display: none !important;
          }

          /* Mobile View (768px and below) */
          @media (max-width: 768px) {
            .home-desktop-view {
              display: none !important;
            }
            .home-mobile-view {
              display: block !important;
            }
            .home-floating-buttons {
              display: flex !important;
            }
            
            .home-main-content {
              padding: 15px 10px !important;
              margin-top: 80px !important;
            }
            
            .home-loan-card {
              margin-bottom: 15px !important;
            }
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* DESKTOP VIEW */}
      <div className="home-desktop-view" style={{ padding: '40px 20px', marginTop: '170px' }}>
        <div style={{ width: '1500px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            
            {/* Left Panel */}
            <div style={{ padding: '4px' }}>
              {/* Member Info */}
              <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', padding: '20px', borderRadius: '15px', marginBottom: '20px', textAlign: 'center' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '15px', textTransform: 'uppercase' }}>
                  {memberData.first_name} {memberData.middle_name} {memberData.last_name}
                </h2>
                <div style={{ background: 'rgba(51, 49, 49, 0.2)', padding: '10px 20px', borderRadius: '25px', display: 'inline-block', fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>
                  Account: {memberData.accountN || 'N/A'}
                </div>
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>
                    💰 Share Capital: ₱{formatNumber(memberData.share_capital || 0)}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => handleNavigation('/accounts')} style={{ background: '#28a745', boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', color: 'black', border: 'none', padding: '15px', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'transform 0.3s ease' }}>
                  📊 Share Capital Transactions
                </button>
                <button onClick={() => handleNavigation('/loans')} style={{ background: '#007bff', boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', color: 'black', border: 'none', padding: '15px', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'transform 0.3s ease' }}>
                  💳 Bi Monthly Amortization
                </button>
              </div>
            </div>

            {/* Right Panel - Loan Details */}
            <div style={{ padding: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Regular Loan */}
                <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', borderRadius: '15px', padding: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '15px', textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px' }}>
                    🏦 REGULAR LOAN DETAILS
                  </h3>
                  {nearestRegularLoan ? (
                    <div>
                      <p style={{ fontSize: '14px', marginBottom: '10px' }}><strong>Loan Amount:</strong> ₱{formatNumber(nearestRegularLoan.loan_amount)}</p>
                      <p style={{ fontSize: '14px', marginBottom: '10px' }}><strong>Status:</strong> {nearestRegularLoan.status}</p>
                      <p style={{ fontSize: '14px' }}><strong>Control #:</strong> {nearestRegularLoan.control_number}</p>
                    </div>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#6c757d' }}>No Regular Loan</p>
                  )}
                </div>

                {/* Emergency Loan */}
                <div style={{ boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)', borderRadius: '15px', padding: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '15px', textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px' }}>
                    🚨 EMERGENCY LOAN DETAILS
                  </h3>
                  {nearestEmergencyLoan ? (
                    <div>
                      <p style={{ fontSize: '14px', marginBottom: '10px' }}><strong>Loan Amount:</strong> ₱{formatNumber(nearestEmergencyLoan.loan_amount)}</p>
                      <p style={{ fontSize: '14px', marginBottom: '10px' }}><strong>Status:</strong> {nearestEmergencyLoan.status}</p>
                      <p style={{ fontSize: '14px' }}><strong>Control #:</strong> {nearestEmergencyLoan.control_number}</p>
                    </div>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#6c757d' }}>No Emergency Loan</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Tables */}
          <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Regular Payments */}
            <div style={{ background: 'white', boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)', borderRadius: '15px', overflow: 'hidden' }}>
              <div style={{ background: '#28a745', padding: '15px', color: 'white' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'black' }}>🟢 Regular Loan Payments</h3>
              </div>
              <div style={{ height: '300px', overflowY: 'auto', padding: '15px' }}>
                {regularPayments.length > 0 ? (
                  regularPayments.map((payment, idx) => (
                    <div key={idx} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
                      <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Amount:</strong> ₱{formatNumber(payment.payment_amount)}</p>
                      <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Date:</strong> {formatDate(payment.payment_date || payment.due_date)}</p>
                      <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>OR #:</strong> {payment.or_number || 'N/A'}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: '#6c757d', paddingTop: '40px' }}>No payments found</p>
                )}
              </div>
            </div>

            {/* Emergency Payments */}
            <div style={{ background: 'white', boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)', borderRadius: '15px', overflow: 'hidden' }}>
              <div style={{ background: '#dc3545', padding: '15px', color: 'white' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'black' }}>🔴 Emergency Loan Payments</h3>
              </div>
              <div style={{ height: '300px', overflowY: 'auto', padding: '15px' }}>
                {emergencyPayments.length > 0 ? (
                  emergencyPayments.map((payment, idx) => (
                    <div key={idx} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
                      <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Amount:</strong> ₱{formatNumber(payment.payment_amount)}</p>
                      <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Date:</strong> {formatDate(payment.payment_date || payment.due_date)}</p>
                      <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>OR #:</strong> {payment.or_number || 'N/A'}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: '#6c757d', paddingTop: '40px' }}>No payments found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div className="home-mobile-view home-main-content" style={{ padding: '20px', marginTop: '100px' }}>
        {/* Regular Loan Card */}
        <div className="home-loan-card" style={{ background: '#888', boxShadow: '0px 6px 20px rgba(59, 59, 59, 0.12)', borderRadius: '15px', padding: '20px', marginBottom: '20px', border: '1.5px solid #e8eef5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '15px', borderBottom: '2px solid #4f4f4fff' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#000' }}>🏦 Regular Loan</h3>
            <span style={{ background: '#28a745', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
              {nearestRegularLoan?.status || 'N/A'}
            </span>
          </div>
          {nearestRegularLoan ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '10px', background: '#f8f9ff', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#000', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Loan Amount</div>
                <div style={{ fontSize: '14px', color: '#000', fontWeight: '900' }}>₱{formatNumber(nearestRegularLoan.loan_amount)}</div>
              </div>
              <div style={{ padding: '10px', background: '#f8f9ff', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#000', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Control #</div>
                <div style={{ fontSize: '14px', color: '#000', fontWeight: '700' }}>{nearestRegularLoan.control_number}</div>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: '#6c757d' }}>No Regular Loan</p>
          )}
        </div>

        {/* Emergency Loan Card */}
        <div className="home-loan-card" style={{ background: '#888', boxShadow: '0px 6px 20px rgba(59, 59, 59, 0.12)', borderRadius: '15px', padding: '20px', marginBottom: '80px', border: '1.5px solid #e8eef5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '15px', borderBottom: '2px solid #4f4f4fff' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#000' }}>🚨 Emergency Loan</h3>
            <span style={{ background: '#dc3545', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
              {nearestEmergencyLoan?.status || 'N/A'}
            </span>
          </div>
          {nearestEmergencyLoan ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '10px', background: '#f8f9ff', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#000', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Loan Amount</div>
                <div style={{ fontSize: '14px', color: '#000', fontWeight: '900' }}>₱{formatNumber(nearestEmergencyLoan.loan_amount)}</div>
              </div>
              <div style={{ padding: '10px', background: '#f8f9ff', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#000', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Control #</div>
                <div style={{ fontSize: '14px', color: '#000', fontWeight: '700' }}>{nearestEmergencyLoan.control_number}</div>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: '#6c757d' }}>No Emergency Loan</p>
          )}
        </div>
      </div>

      {/* FLOATING ACTION BUTTONS - Mobile Only */}
      <div className="home-floating-buttons" style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '15px', zIndex: 999 }}>
        <button onClick={() => handleNavigation('/loans')} style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'pointer', transition: 'all 0.3s ease' }} title="Bi Monthly Amortization">
          <FaMoneyBillWave />
        </button>
        <button onClick={() => handleNavigation('/accounts')} style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(0, 180, 219, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'pointer', transition: 'all 0.3s ease' }} title="Share Capital Transactions">
          <FaCoins />
        </button>
        <button onClick={() => setShowPaymentsModal(true)} style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', border: 'none', boxShadow: '0 4px 15px rgba(245, 87, 108, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'pointer', transition: 'all 0.3s ease' }} title="Payment History">
          <FaHistory />
        </button>
      </div>

      {/* PAYMENTS MODAL - Mobile */}
      {showPaymentsModal && (
        <>
          <div onClick={() => setShowPaymentsModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(5px)', zIndex: 1000 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', borderRadius: '20px', maxWidth: '95%', width: '500px', maxHeight: '85vh', zIndex: 1001, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)' }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: '700' }}>Payment History</h3>
              <button onClick={() => setShowPaymentsModal(false)} style={{ background: 'white', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>
                Close
              </button>
            </div>
            
            <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
              {/* Regular Payments Section */}
              <div style={{ marginBottom: '30px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '15px', color: '#28a745', borderBottom: '2px solid #28a745', paddingBottom: '8px' }}>🟢 Regular Loan Payments</h4>
                {regularPayments.length > 0 ? (
                  regularPayments.map((payment, idx) => (
                    <div key={idx} style={{ background: '#f8f9ff', borderRadius: '10px', padding: '12px', marginBottom: '10px', border: '1px solid #e0e0e0' }}>
                      <p style={{ margin: '5px 0', fontSize: '13px', fontWeight: '600' }}><strong>Amount:</strong> ₱{formatNumber(payment.payment_amount)}</p>
                      <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>Date:</strong> {formatDate(payment.payment_date || payment.due_date)}</p>
                      <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>OR #:</strong> {payment.or_number || 'N/A'}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: '#6c757d', padding: '20px 0' }}>No payments found</p>
                )}
              </div>

              {/* Emergency Payments Section */}
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '15px', color: '#dc3545', borderBottom: '2px solid #dc3545', paddingBottom: '8px' }}>🔴 Emergency Loan Payments</h4>
                {emergencyPayments.length > 0 ? (
                  emergencyPayments.map((payment, idx) => (
                    <div key={idx} style={{ background: '#fff5f5', borderRadius: '10px', padding: '12px', marginBottom: '10px', border: '1px solid #e0e0e0' }}>
                      <p style={{ margin: '5px 0', fontSize: '13px', fontWeight: '600' }}><strong>Amount:</strong> ₱{formatNumber(payment.payment_amount)}</p>
                      <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>Date:</strong> {formatDate(payment.payment_date || payment.due_date)}</p>
                      <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>OR #:</strong> {payment.or_number || 'N/A'}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', color: '#6c757d', padding: '20px 0' }}>No payments found</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;