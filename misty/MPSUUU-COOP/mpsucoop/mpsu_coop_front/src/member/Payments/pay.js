import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Topbar from '../Topbar/Topbar';

axios.defaults.withCredentials = false;

const MemberPayments = () => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [regularLoanAmount, setRegularLoanAmount] = useState(0);
  const [emergencyLoanAmount, setEmergencyLoanAmount] = useState(0);

  const formatNumber = (number) => {
    if (!number) return "0.00";
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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

      // Fetch ALL schedules first to get OR numbers properly
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}`,
        { withCredentials: true }
      );

      console.log('=== MEMBER PAYMENTS DEBUG ===');
      console.log('All schedules from API:', response.data);

      // Filter only paid schedules
      const paidSchedules = response.data.filter(
        (schedule) => schedule.is_paid || schedule.status === 'Paid'
      );

      console.log('Filtered paid schedules:', paidSchedules);

      // Map schedules with their OR numbers - check all possible field names
      const schedulesWithDetails = paidSchedules.map((schedule, index) => {
        console.log(`\n=== PAID SCHEDULE ${index + 1} ===`);
        console.log('Schedule object keys:', Object.keys(schedule));
        console.log('Schedule.OR:', schedule.OR);
        console.log('Schedule.or_number:', schedule.or_number);
        console.log('Schedule.orNumber:', schedule.orNumber);

        // Try different possible field names for OR number
        const orNumber = schedule.OR || 
                        schedule.or_number || 
                        schedule.orNumber || 
                        schedule.or_num ||
                        schedule.receipt_number ||
                        schedule.receipt_no ||
                        schedule.official_receipt ||
                        schedule.or_id ||
                        'N/A';

        console.log('Final OR number for this schedule:', orNumber);

        return {
          ...schedule,
          payment_date: schedule.payment_date
            ? new Date(schedule.payment_date).toLocaleDateString()
            : 'N/A',
          or_number: orNumber,
        };
      });

      console.log('=== FINAL RESULT FOR MEMBER PAYMENTS ===');
      console.log('Schedules with OR numbers:', schedulesWithDetails);

      setSchedules(schedulesWithDetails);

      // Calculate latest loan amounts
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

  const filteredRegular = schedules.filter(
    (schedule) =>
      schedule.loan_type === 'Regular' &&
      (schedule.due_date?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      new Date(schedule.due_date).toLocaleDateString().toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredEmergency = schedules.filter(
    (schedule) =>
      schedule.loan_type === 'Emergency' &&
      (schedule.due_date?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      new Date(schedule.due_date).toLocaleDateString().toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Styles
  const containerStyle = {
    padding: '10px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    marginTop: '70px',
    height: '100px',
    boxSizing: 'border-box',
  };

  const loanAmountContainerStyle = {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: '30px',
    gap: '50px',
    flexWrap: 'wrap',
  };

  const loanAmountCardStyle = {
    backgroundColor: '#d7d7d7ff',
    padding: '10px',
    borderRadius: '12px',
    boxShadow: '0 4px 10px rgba(43, 43, 43, 0.99)', 
    minWidth: '200px',
    textAlign: 'center',
    marginBottom: '10px',
  };

  const searchContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '70px',
    marginTop: '-80px',
    marginRight: '-300px'
  };

  const searchInputStyle = {
    padding: '1px 1px',
    fontSize: '15px',
    borderRadius: '25px',
    width: '200px',
    outline: 'none',
    boxShadow: '0 2px 10px rgba(37, 37, 37, 0.2)',
    transition: 'all 0.3s ease'
  };

const tablesContainerStyle = {
  display: 'grid',
  gridTemplateColumns: filteredEmergency.length > 0 ? '1fr 1fr' : '1fr',
  gap: '30px',
  width: '100%'
};

const tableContainerStyle = {
  backgroundColor: '#d7d7d7ff',
  borderRadius: '12px',
  boxShadow: '0 4px 10px rgba(43, 43, 43, 0.99)', 
  overflow: 'hidden',
  width: filteredEmergency.length > 0 ? '100%' : '115%', 
  transition: 'width 0.3s ease',
  marginLeft: '-50px'
};

  const tableEmergencyContainerStyle = {
    backgroundColor: '#d7d7d7ff',
    borderRadius: '12px',
    boxShadow: '0 4px 10px rgba(43, 43, 43, 0.99)', 
    overflow: 'hidden',
    height: '40%'
  };

  const scrollEmergencyContainerStyle = {
    maxHeight: '305px',
    overflowY: 'auto',
    overflowX: 'auto',
    scrollBehavior: 'smooth',
      '&::-webkit-scrollbar': {
        width: '8px',
        height: '8px'
      },
      '&::-webkit-scrollbar-thumb': {
        backgroundColor: '#888',
        borderRadius: '4px'
      }
  };

  const tableTitleStyle = {
    textAlign: 'center',
    padding: '15px',
    margin: '0',
    fontSize: '18px',
    fontWeight: '600px',
  };

  const regularTitleStyle = {
    ...tableTitleStyle,
    color: '#050505ff',
    borderBottom: '2px solid #27ae60',
    marginBottom: '3px'
  };

  const emergencyTitleStyle = {
    ...tableTitleStyle,
    color: '#000000ff',
    borderBottom: '2px solid #e74c3c',
    marginBottom: '3px'
  };

  const scrollContainerStyle = {
  maxHeight: '305px',
  overflowY: 'auto',
  overflowX: 'auto',
  scrollBehavior: 'smooth',
    '&::-webkit-scrollbar': {
      width: '8px',
      height: '8px'
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: '#888',
      borderRadius: '4px'
    }
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  };

   const stickyThStyle = {
    position: 'sticky',
    top: '0',
    backgroundColor: '#bababa',
    color: '#000000ff',
    zIndex: 2,
    padding: '10px 8px',
    textAlign: 'left',
    fontWeight: '600px',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '2px solid #000000ff'
  };

  const tdStyle = {
    padding: '10px 8px',
    borderBottom: '1px solid #000000ff',
    fontSize: '16px',
    color: '#000000ff'
  };

  const noDataStyle = {
    textAlign: 'center',
    fontSize: '16px',
    color: '#6c757d',
    padding: '10px 10px',
    fontStyle: 'italic'
  };

  const errorStyle = {
    color: '#e74c3c',
    backgroundColor: '#fdeaea',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #f5c6cb',
    textAlign: 'center',
    fontSize: '16px'
  };

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={errorStyle}>{error}</div>
      </div>
    );
  }

  return (
    <>
    <Topbar />
      <div style={containerStyle}>
        <h2 style={{marginLeft: '100px', textAlign: 'center', color: '#000305ff', fontSize: '32px', fontWeight: '700', marginBottom: '60px', marginTop: '-260px',}}>💰 My Paid Payments</h2>

        <div style={searchContainerStyle}>
          <input
            type="text"
            placeholder="🔍 Search by Due date...."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
            className="search-input"
          />
        </div>

        <div style={loanAmountContainerStyle} className="loan-amount-container">
          <div style={{...loanAmountCardStyle, borderLeft: '4px solid #27ae60', marginLeft: '50px'}} className="loan-card">
            <h3 style={{color: '#000000ff', margin: '0 0 10px 0', fontSize: '18px'}}>Regular Loan</h3>
            <p style={{fontSize: '24px', fontWeight: '700', margin: '0', color: '#1f1f1fff'}}>
              ₱ {formatNumber(parseFloat(regularLoanAmount).toFixed(2))}
            </p>
          </div>
          
          <div style={{...loanAmountCardStyle, borderLeft: '4px solid #e74c3c', marginLeft: '300px'}} className="loan-card">
            <h3 style={{color: '#000000ff', margin: '0 0 10px 0', fontSize: '18px'}}>Emergency Loan</h3>
            <p style={{fontSize: '24px', fontWeight: '700', margin: '0', color: '#000000ff'}}>
              ₱ {formatNumber(parseFloat(emergencyLoanAmount).toFixed(2))}
            </p>
          </div>
        </div>

        <div style={tablesContainerStyle} className="tables-container">
          {/* Regular Loan Table */}
          <div style={tableContainerStyle}>
            <h3 style={regularTitleStyle}>🟢 Regular Loan Payments</h3>
            {filteredRegular.length > 0 ? (
              <div style={scrollContainerStyle} className="scroll-container">
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={stickyThStyle}>Approval Date</th>
                      <th style={stickyThStyle}>Loan Type</th>
                      <th style={stickyThStyle}>Payment Amount</th>
                      <th style={stickyThStyle}>Status</th>
                      <th style={stickyThStyle}>Due Date</th>
                      <th style={stickyThStyle}>OR NO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegular.map((schedule, index) => (
                      <tr key={index} className="table-row">
                        <td style={tdStyle}>
                          {schedule.loan_date || 'No Date Available'}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#0a0a0aff',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            {schedule.loan_type || 'N/A'}
                          </span>
                        </td>
                        <td style={{...tdStyle, fontWeight: '600', color: '#000000ff'}}>
                          ₱ {formatNumber(parseFloat(schedule.payment_amount || 0).toFixed(2))}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#21ff55ff',
                            color: 'black',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            {schedule.is_paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {schedule.payment_date
                            ? new Date(schedule.due_date).toLocaleDateString()
                            : 'No Date Available'}
                        </td>
                        <td style={{...tdStyle, fontWeight: '600', color: '#000000ff'}}>
                          {schedule.or_number}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={noDataStyle}>
                📋 No paid payments found for regular loans.
              </div>
            )}
          </div>

          {/* Emergency Loan Table */}
          {filteredEmergency.length > 0 && (
          <div style={tableEmergencyContainerStyle}>
            <h3 style={emergencyTitleStyle}>🔴 Emergency Loan Payments</h3>
              <div style={scrollEmergencyContainerStyle} className="scroll-container">
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={stickyThStyle}>Approval Date</th>
                      <th style={stickyThStyle}>Loan Type</th>
                      <th style={stickyThStyle}>Payment Amount</th>
                      <th style={stickyThStyle}>Status</th>
                      <th style={stickyThStyle}>Due Date</th>
                      <th style={stickyThStyle}>OR NO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmergency.map((schedule, index) => (
                      <tr key={index} className="table-row">
                        <td style={tdStyle}>
                          {schedule.loan_date || 'No Date Available'}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#e74c3c',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            {schedule.loan_type || 'N/A'}
                          </span>
                        </td>
                        <td style={{...tdStyle, fontWeight: '600', color: '#e74c3c'}}>
                          ₱ {formatNumber(parseFloat(schedule.payment_amount || 0).toFixed(2))}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#155724',
                            color: 'black',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            ✓ {schedule.is_paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {schedule.payment_date
                            ? new Date(schedule.due_date).toLocaleDateString()
                            : 'No Date Available'}
                        </td>
                        <td style={{...tdStyle, fontWeight: '600', color: '#000000ff'}}>
                          {schedule.or_number}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}
            : (
              <div style={noDataStyle}>
                📋 No paid payments found for emergency loans.
              </div>
            )
          </div>
        </div>
    </>
  );
};

export default MemberPayments;