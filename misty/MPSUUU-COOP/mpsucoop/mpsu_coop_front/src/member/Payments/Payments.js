import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Topbar from '../Topbar/Topbar';
import { BsFillPrinterFill } from "react-icons/bs";

axios.defaults.withCredentials = false;

const MemberPayments = () => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [regularLoanAmount, setRegularLoanAmount] = useState(0);
  const [emergencyLoanAmount, setEmergencyLoanAmount] = useState(0);
  const [completePaymentHistory, setCompletePaymentHistory] = useState([]);
  
  const [showRegularHistory, setShowRegularHistory] = useState(false);
  const [showEmergencyHistory, setShowEmergencyHistory] = useState(false);
  
  // New state for OR dropdowns
  const [openORGroups, setOpenORGroups] = useState({});

  const toggleORGroup = (loanType, orNumber) => {
    setOpenORGroups((prev) => ({
      ...prev,
      [`${loanType}-${orNumber}`]: !prev[`${loanType}-${orNumber}`]
    }));
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
                  <td>${formatDate(payment.payment_date)}</td>
                  <td>${payment.or_number}</td>
                  <td><span class="type-badge">✓ Paid</span></td>
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

  const formatNumber = (number) => {
    if (!number) return "0.00";
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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

  // FETCH COMPLETE PAYMENT HISTORY (persisted from backend)
  const fetchCompletePaymentHistory = async (accountNumber) => {
    try {
      // Get both archived and active history
      const [archivedResponse, activeResponse] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/payment-history/${accountNumber}/`),
        axios.get(`${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}`)
      ]);

      const archivedPayments = archivedResponse.data || [];
      const activePayments = activeResponse.data || [];

      // Combine and deduplicate
      const allPayments = [
        ...archivedPayments,
        ...activePayments.filter(schedule => schedule.is_paid).map(schedule => ({
          loan_type: schedule.loan_type,
          payment_amount: schedule.payment_amount,
          payment_date: schedule.due_date,
          or_number: schedule.or_number,
          control_number: schedule.control_number,
          status: 'Paid'
        }))
      ];

      // Remove duplicates
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

  const fetchPaymentSchedules = async () => {
    setLoading(true);
    setError('');
    try {
      const accountNumber = localStorage.getItem('account_number');

      if (!accountNumber) {
        setError('Account number is missing. Please log in again.');
        setLoading(false);
        return;
      }

      // STEP 1: Fetch complete payment history (includes archived loans)
      const backendHistory = await fetchCompletePaymentHistory(accountNumber);
      console.log('Backend history count:', backendHistory.length);

      // STEP 2: Fetch current active payment schedules
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}`,
        { withCredentials: true }
      );

      console.log('=== MEMBER PAYMENTS DEBUG ===');
      console.log('All schedules from API:', response.data);

      // Filter only PAID schedules from ACTIVE loans
      const paidSchedules = response.data.filter(
        (schedule) => schedule.is_paid || schedule.status === 'Paid'
      );

      console.log('Filtered paid schedules (active loans only):', paidSchedules);

      const schedulesWithDetails = paidSchedules.map((schedule, index) => {
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
          payment_date: schedule.payment_date
            ? new Date(schedule.payment_date).toLocaleDateString()
            : 'N/A',
          or_number: orNumber,
        };
      });

      // Set active schedules (these will disappear when loans are archived)
      setSchedules(schedulesWithDetails);

      // STEP 3: Merge backend history with current schedules for complete history
      const scheduleHistory = schedulesWithDetails.map(schedule => ({
        loan_type: schedule.loan_type,
        control_number: schedule.control_number,
        payment_amount: schedule.payment_amount,
        payment_date: schedule.due_date,
        or_number: schedule.or_number,
        status: 'Paid',
        source: 'active_schedule'
      }));

      // Mark backend history
      const markedBackendHistory = backendHistory.map(payment => ({
        ...payment,
        source: 'backend_history'
      }));

      // Combine both sources
      const allPayments = [...markedBackendHistory, ...scheduleHistory];

      // Remove duplicates
      const uniquePayments = [];
      const seen = new Set();

      allPayments.forEach(payment => {
        const key = `${payment.control_number}_${payment.or_number}`;
        if (!seen.has(key) && payment.or_number !== 'N/A') {
          seen.add(key);
          uniquePayments.push(payment);
        }
      });

      // Sort by payment date (newest first)
      uniquePayments.sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

      console.log('=== COMPLETE PAYMENT HISTORY ===');
      console.log('Total unique payments:', uniquePayments.length);
      console.log('From backend (archived):', uniquePayments.filter(p => p.source === 'backend_history').length);
      console.log('From active schedules:', uniquePayments.filter(p => p.source === 'active_schedule').length);

      // Set complete payment history (this PERSISTS even after archiving)
      setCompletePaymentHistory(uniquePayments);

      // Get latest loan amounts from ACTIVE loans only
      const latestRegularLoan = paidSchedules
        .filter((schedule) => schedule.loan_type === 'Regular')
        .slice(-1)[0]?.loan_amount || 0;

      const latestEmergencyLoan = paidSchedules
        .filter((schedule) => schedule.loan_type === 'Emergency')
        .slice(-1)[0]?.loan_amount || 0;

      setRegularLoanAmount(latestRegularLoan);
      setEmergencyLoanAmount(latestEmergencyLoan);

    } catch (err) {
      console.error('Error fetching payment schedules:', err);
      setError('Failed to fetch payment schedules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentSchedules();
  }, []);

  // Filter ACTIVE payment schedules (these will be empty when archived)
  const filteredRegular = schedules.filter((schedule) => {
    const searchLower = searchQuery.toLowerCase();
    const fullDate = formatDate(schedule.due_date);
    const orNumber = (schedule.or_number || '').toString().toLowerCase();
    
    return schedule.loan_type === 'Regular' && (
      fullDate.toLowerCase().includes(searchLower) || 
      orNumber.includes(searchLower)
    );
  });

  const filteredEmergency = schedules.filter((schedule) => {
    const searchLower = searchQuery.toLowerCase();
    const fullDate = formatDate(schedule.due_date);
    const orNumber = (schedule.or_number || '').toString().toLowerCase();
    
    return schedule.loan_type === 'Emergency' && (
      fullDate.toLowerCase().includes(searchLower) || 
      orNumber.includes(searchLower)
    );
  });

  // Filter COMPLETE payment history (this PERSISTS even after archiving)
  const regularPaymentHistory = completePaymentHistory.filter(payment => payment.loan_type === 'Regular');
  const emergencyPaymentHistory = completePaymentHistory.filter(payment => payment.loan_type === 'Emergency');

  // Function to render table with OR grouping
  const renderTableWithORGrouping = (filteredSchedules, loanType) => {
    // Group by OR number
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
      
      // First row (always shown)
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
              ✓ Paid
            </span>
          </td>
          <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
            {formatDate(firstSchedule.due_date)}
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
      
      // Additional rows (shown when expanded)
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
                  ✓ Paid
                </span>
              </td>
              <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                {formatDate(schedule.due_date)}
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid #667eea', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
          <p style={{ color: '#0b78e6ff', fontSize: '14px' }}>Loading payment schedules...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ width: '80px', height: '80px', background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)', borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white' }}>⚠</div>
          <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>Error Loading Data</h2>
          <p style={{ color: '#7f8c8d', marginBottom: '30px', fontSize: '16px' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ display: 'inline-block', background: 'linear-gradient(45deg, #667eea, #764ba2)', color: 'white', padding: '12px 30px', border: 'none', borderRadius: '25px', fontWeight: '600', cursor: 'pointer', transition: 'transform 0.3s ease', boxShadow: '0 5px 15px rgba(102, 126, 234, 0.3)' }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <Topbar />
      
      <div style={{ padding: '40px 20px', marginTop: '170px' }}>
        <div style={{ width: '1380px', margin: '0 auto' }}>
          
          {/* Statistics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '50px', marginBottom: '20px' }}>
            <div style={{
              background: '#28a745',
              boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '10px',
              color: 'black',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '22px', fontWeight: '600', marginBottom: '5px' }}>💰 Regular Loan</div>
              <div style={{ fontSize: '26px', fontWeight: '800' }}>₱{formatNumber(parseFloat(regularLoanAmount).toFixed(2))}</div>
              <div style={{ fontSize: '16px', marginTop: '10px', color: 'white' }}>
                Approval Date: {filteredRegular[0]?.loan_date || 'N/A'}
              </div>
            </div>

            <div style={{
              background: '#dededeff',
              boxShadow: '0px 8px 5px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '20px',
              color: 'black',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '22px', fontWeight: '600', marginBottom: '5px' }}>📋 Total Payments</div>
              <div style={{ fontSize: '32px', fontWeight: '800' }}>{completePaymentHistory.length}</div>
              <div style={{ fontSize: '14px', marginTop: '5px', color: '#666' }}>
                All-time payment history
              </div>
            </div>

            <div style={{
              background: '#dc3545',
              boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '10px',
              color: 'black',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '22px', fontWeight: '600', marginBottom: '5px' }}>🚨 Emergency Loan</div>
              <div style={{ fontSize: '26px', fontWeight: '800' }}>₱{formatNumber(parseFloat(emergencyLoanAmount).toFixed(2))}</div>
              <div style={{ fontSize: '16px', marginTop: '10px', color: 'white' }}>
                Approval Date: {filteredEmergency[0]?.loan_date || 'N/A'}
              </div>
            </div>
          </div>

          {/* Back + Dropdowns + Search */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            margin: '15px 0',
            gap: '15px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button
                onClick={() => navigate(-1)}
                style={{
                  background: 'rgba(94, 94, 94, 1)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.3)',
                  padding: '10px 10px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'transform 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseOver={(e) => e.target.style.transform = 'translateY(-3px)'}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                ← Back
              </button>

              <button
                onClick={() => setShowRegularHistory(!showRegularHistory)}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'translateY(-3px)';
                  e.target.style.boxShadow = '0 5px 15px rgba(40, 167, 69, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                Regular Payment History
                <span style={{ 
                  fontSize: '16px',
                  transition: 'transform 0.3s ease',
                  transform: showRegularHistory ? 'rotate(180deg)' : 'rotate(0deg)',
                  display: 'inline-block'
                }}>
                  ▼
                </span>
              </button>

              <button
                onClick={() => setShowEmergencyHistory(!showEmergencyHistory)}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'translateY(-3px)';
                  e.target.style.boxShadow = '0 5px 15px rgba(220, 53, 69, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                Emergency Payment History
                <span style={{ 
                  fontSize: '16px',
                  transition: 'transform 0.3s ease',
                  transform: showEmergencyHistory ? 'rotate(180deg)' : 'rotate(0deg)',
                  display: 'inline-block'
                }}>
                  ▼
                </span>
              </button>
            </div>

            <div style={{ position: 'relative', maxWidth: '250px', width: '100%' }}>
              <input
                type="text"
                placeholder="🔍 Search by date paid or OR NO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 20px',
                  fontSize: '12px',
                  border: '2px solid #000000ff',
                  borderRadius: '25px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e9ecef';
                  e.target.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                }}
              />
            </div>
          </div>

          {/* ACTIVE Payment Tables (Will be empty when archived) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            
            {/* Regular Loan Table - ACTIVE ONLY WITH OR GROUPING */}
            <div style={{
              background: 'white',
              boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              overflow: 'hidden',
              height: '350px',
            }}>
              <div style={{
                background: '#28a745',
                padding: '15px',
                color: 'white',
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  margin: 0,
                  color: 'black'
                }}>
                  🟢 Regular Loan
                </h3>
              </div>

              <div style={{ height: '290px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
                {filteredRegular.length > 0 ? (
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
                    <div>No active paid payments for regular loans</div>
                    <div style={{ fontSize: '12px', marginTop: '10px', color: '#999' }}>
                      Check "Regular History" for archived payments
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Emergency Loan Table - ACTIVE ONLY WITH OR GROUPING */}
            <div style={{
              background: 'white',
              boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              overflow: 'hidden',
              height: '350px',
            }}>
              <div style={{
                background: '#dc3545',
                padding: '15px',
                color: 'white',
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  margin: 0,
                  color: 'black'
                }}>
                  🔴 Emergency Loan
                </h3>
              </div>

              <div style={{ height: '290px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
                {filteredEmergency.length > 0 ? (
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
                    <div>No active paid payments for emergency loans</div>
                    <div style={{ fontSize: '12px', marginTop: '10px', color: '#999' }}>
                      Check "Emergency History" for archived payments
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Regular Payment History Modal */}
          {showRegularHistory && (
            <div 
              onClick={() => setShowRegularHistory(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'white',
                  borderRadius: '20px',
                  maxWidth: '90%',
                  maxHeight: '85vh',
                  width: '1200px',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                  overflow: 'hidden',
                  animation: 'slideUp 0.3s ease-out'
                }}
              >
                <div style={{
                  background: '#28a745',
                  padding: '20px 30px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '24px', fontWeight: '700' }}>
                    Regular Loan - Complete Payment History
                  </h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handlePrint('Regular', regularPaymentHistory)}
                      style={{
                        background: 'white',
                        color: '#000',
                        border: 'none',
                        padding: '8px 15px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <BsFillPrinterFill /> Print
                    </button>
                    <button
                      onClick={() => setShowRegularHistory(false)}
                      style={{
                        background: 'rgba(94, 94, 94, 1)',
                        color: 'white',
                        border: 'none',
                        padding: '8px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
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
                      {regularPaymentHistory.length > 0 ? (
                        regularPaymentHistory.map((payment, index) => (
                          <tr key={index}>
                            <td style={{ padding: '10px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#28a745', color: 'white', fontSize: '11px', fontWeight: '600' }}>
                                {payment.loan_type}
                              </span>
                            </td>
                            <td style={{ padding: '10px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              ₱{formatNumber(parseFloat(payment.payment_amount || 0).toFixed(2))}
                            </td>
                            <td style={{ padding: '10px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              {formatDate(payment.payment_date)}
                            </td>
                            <td style={{ padding: '10px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              {payment.or_number}
                            </td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #9b9b9bff' }}>
                              <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#28a745', color: 'white', fontSize: '11px', fontWeight: '600' }}>
                                ✓ Paid
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                            <div style={{ fontSize: '48px', opacity: '0.5' }}>📭</div>
                            <div>No payment history found for regular loans</div>
                          </td>
                        </tr>
                      )}
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
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'white',
                  borderRadius: '20px',
                  maxWidth: '90%',
                  maxHeight: '85vh',
                  width: '1200px',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                  overflow: 'hidden',
                  animation: 'slideUp 0.3s ease-out'
                }}
              >
                <div style={{
                  background: '#dc3545',
                  padding: '20px 30px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '24px', fontWeight: '700' }}>
                    Emergency Loan - Complete Payment History
                  </h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => handlePrint('Emergency', emergencyPaymentHistory)} 
                      style={{
                        background: 'white',
                        color: '#000',
                        border: 'none',
                        padding: '8px 15px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <BsFillPrinterFill /> Print
                    </button>
                    <button
                      onClick={() => setShowEmergencyHistory(false)}
                      style={{
                        background: 'rgba(94, 94, 94, 1)',
                        color: 'white',
                        border: 'none',
                        padding: '8px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
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
                      {emergencyPaymentHistory.length > 0 ? (
                        emergencyPaymentHistory.map((payment, index) => (
                          <tr key={index}>
                            <td style={{ padding: '10px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#dc3545', color: 'white', fontSize: '11px', fontWeight: '600' }}>
                                {payment.loan_type}
                              </span>
                            </td>
                            <td style={{ padding: '10px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              ₱{formatNumber(parseFloat(payment.payment_amount || 0).toFixed(2))}
                            </td>
                            <td style={{ padding: '10px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              {formatDate(payment.payment_date)}
                            </td>
                            <td style={{ padding: '10px', fontWeight: '600', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              {payment.or_number}
                            </td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #9b9b9bff' }}>
                              <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#28a745', color: 'white', fontSize: '11px', fontWeight: '600' }}>
                                ✓ Paid
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                            <div style={{ fontSize: '48px', opacity: '0.5' }}>📭</div>
                            <div>No payment history found for emergency loans</div>
                          </td>
                        </tr>
                      )}
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

            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          
        </div>
      </div>
    </div>
  );
};

export default MemberPayments;

