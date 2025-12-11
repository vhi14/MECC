








const PaymentSchedule = () => {
  const [accountSummaries, setAccountSummaries] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accountDetails, setAccountDetails] = useState(null);
  const [loanType, setLoanType] = useState('Regular');
  const [searchQuery, setSearchQuery] = useState('');
  const [loanDetails, setLoanDetails] = useState(null);
  const [showOrInput, setShowOrInput] = useState(false);
  const [orNumber, setOrNumber] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [openYears, setOpenYears] = useState({});
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [paying, setPaying] = useState(false);
  const [orValidation, setOrValidation] = useState({ available: true, message: '' });

  const toggleYear = (age) => {
    setOpenYears((prev) => ({ ...prev, [age]: !prev[age] }));
  };

  const formatNumber = (number) => {
    if (number == null || isNaN(number)) return "N/A";
    return new Intl.NumberFormat('en-US').format(number);
  };

  const showNotification = (message, type = 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: '', type: '' });
    }, 2000);
  };

  // Check OR availability before allowing payment
  const checkOrAvailability = async (orNum) => {
    if (!orNum || orNum.length !== 4) {
      setOrValidation({ available: false, message: 'Please enter a 4-digit OR number' });
      return false;
    }

    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/check-or-availability/${selectedAccount}/${orNum}/`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (response.data.available) {
        setOrValidation({ available: true, message: 'OR number is available' });
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

  const handleOrChange = (value) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    if (cleaned.length <= 4) {
      setOrNumber(cleaned);
      if (cleaned.length === 4) {
        checkOrAvailability(cleaned);
      } else {
        setOrValidation({ available: true, message: '' });
      }
    }
  };

  const markAsPaid = async (id, totalPayment, orNum) => {
    setPaying(true);
    
    try {
      if (!orNum || orNum.length !== 4) {
        showNotification("Please enter a 4-digit OR number", "error");
        setPaying(false);
        return;
      }

      // Check OR availability first
      const isAvailable = await checkOrAvailability(orNum);
      if (!isAvailable) {
        showNotification(orValidation.message, "error");
        setPaying(false);
        return;
      }

      const token = localStorage.getItem('accessToken');
      if (!token) {
        showNotification("Session expired. Please log in again.", "error");
        setPaying(false);
        return;
      }

      const remainingUnpaid = schedules.filter(schedule => !schedule.is_paid).length;
      const isLastPayment = remainingUnpaid === 1;

      const markPaidResponse = await axios.post(
        `${process.env.REACT_APP_API_URL}/payment-schedules/${id}/mark-paid/`,
        { 
          received_amnt: totalPayment, 
          account_number: selectedAccount,
          or_number: orNum,
          loan_type: loanType 
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Archive payment
      const currentSchedule = schedules.find(schedule => schedule.id === id);
      try {
        const archivePayload = {
          account_number: selectedAccount,
          account_holder: accountDetails ? 
            `${accountDetails.first_name} ${accountDetails.middle_name || ''} ${accountDetails.last_name}`.trim() : 
            'Unknown',
          payment_amount: totalPayment,
          loan_type: currentSchedule?.loan_type || loanType,
          date_paid: currentSchedule?.due_date || new Date().toISOString(),
          or_number: orNum,
          payment_type: 'Schedule Payment'
        };

        await axios.post(
          '${process.env.REACT_APP_API_URL}/archive-payment-record/',
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
        showNotification("🎉 Congratulations! Loan fully paid!", "success");
        setTimeout(() => {
          setSelectedAccount(null);
          fetchAccountSummaries();
        }, 2000);
      } else {
        showNotification("Payment successful!", "success");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchPaymentSchedules(selectedAccount, loanType);
      }
      
      setShowOrInput(false);
      setOrNumber('');
      setSelectedScheduleId(null);
      setOrValidation({ available: true, message: '' });
      
    } catch (err) {
      console.error('Error while marking as paid:', err);
      const errorMsg = err.response?.data?.error || "Payment processing failed";
      showNotification(errorMsg, "error");
      
      try {
        await fetchPaymentSchedules(selectedAccount, loanType);
      } catch (refreshErr) {
        console.error('Error refreshing schedules:', refreshErr);
      }
      
      setOrNumber('');
      
    } finally {
      setPaying(false);
    }
  };

  const fetchAccountSummaries = async () => {
    setLoading(true);
    setError('');
    
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setError("Missing authentication token. Please log in again.");
      return;
    }

    try {
      const response = await axios.get('${process.env.REACT_APP_API_URL}/payment-schedules/summaries/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const uniqueSummaries = response.data.reduce((acc, summary) => {
        if (!acc[summary.account_number]) {
          acc[summary.account_number] = { 
            ...summary, 
            total_balance: summary.total_balance || 0 
          };
        } else {
          acc[summary.account_number].total_balance += summary.total_balance || 0;
        }
        return acc;
      }, {});

      const accountNumbers = Object.keys(uniqueSummaries);
      const namePromises = accountNumbers.map((accountNumber) =>
        axios.get(`${process.env.REACT_APP_API_URL}/members/?account_number=${accountNumber}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      const nameResponses = await Promise.all(namePromises);

      accountNumbers.forEach((accountNumber, index) => {
        const memberData = nameResponses[index].data[0];
        if (memberData) {
          uniqueSummaries[accountNumber].account_holder = 
            `${memberData.first_name} ${memberData.middle_name} ${memberData.last_name}`;
        }
      });

      setAccountSummaries(Object.values(uniqueSummaries));

    } catch (err) {
      console.error('Error fetching account summaries:', err);
      setError('Failed to fetch account summaries.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentSchedules = async (accountNumber, loanType) => {
    setSchedules([]);
    setLoading(true);
    setError('');

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/payment-schedules/?account_number=${accountNumber}&loan_type=${loanType}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSchedules(response.data);
      setSelectedAccount(accountNumber);

      const memberResponse = await axios.get(
        `${process.env.REACT_APP_API_URL}/members/?account_number=${accountNumber}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setAccountDetails(memberResponse.data[0]);

      // Fetch loan details with yearly recalculations
      const loanListResponse = await axios.get(
        `${process.env.REACT_APP_API_URL}/loans/?account=${accountNumber}&loan_type=${loanType}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (loanListResponse.data && loanListResponse.data.length > 0) {
        const controlNumber = loanListResponse.data[0].control_number;
        await new Promise(resolve => setTimeout(resolve, 500));

        const loanDetailResponse = await axios.get(
          `${process.env.REACT_APP_API_URL}/loans/${controlNumber}/detailed_loan_info/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log('🔍 Loan Details:', loanDetailResponse.data);
        setLoanDetails(loanDetailResponse.data);
      } else {
        setLoanDetails(null);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError('Failed to fetch payment schedules.');
    } finally {
      setLoading(false);
    }
  };

  const calculateRemainingBalance = () => {
    if (!loanDetails) return 0;
    
    const originalBalance = parseFloat(loanDetails.outstanding_balance || 0);
    const totalPaid = schedules
      .filter(s => s.is_paid)
      .reduce((sum, s) => sum + parseFloat(s.payment_amount || 0), 0);
    
    return originalBalance - totalPaid;
  };

  const arePreviousPaymentsPaid = (scheduleId) => {
    const index = schedules.findIndex((schedule) => schedule.id === scheduleId);
    if (index > 0) {
      return schedules[index - 1].is_paid;
    }
    return true;
  };

  const handleLoanTypeChange = (type) => {
    setLoanType(type);
    if (selectedAccount) {     
      fetchPaymentSchedules(selectedAccount, type);
    }
  };

  const filteredSummaries = accountSummaries.filter(summary =>
    summary.account_number.toString().includes(searchQuery) ||
    summary.account_holder.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    fetchAccountSummaries();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div style={{ width: '100%', height: '100vh', marginTop: '20px', padding: '20px' }}>
      {!selectedAccount ? (
        <>
          <h2 style={{ 
            width: '100%', 
            marginTop: '-25px', 
            padding: '20px', 
            textAlign: 'center', 
            color: 'black', 
            fontSize: '30px' 
          }}>
            Ongoing Payment Schedules
          </h2>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-end', 
            marginBottom: '40px' 
          }}>
            <input
              type="text"
              placeholder="Search Payments"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                padding: '10px', 
                fontSize: '16px', 
                border: '2px solid #000', 
                borderRadius: '4px', 
                width: '270px'
              }}
            />
          </div>

          {filteredSummaries.length > 0 ? (
            <div style={{ 
              maxHeight: '430px', 
              overflowY: 'auto', 
              boxShadow: '0px 0px 15px 0px rgb(154, 154, 154)', 
              padding: '5px', 
              borderRadius: '5px',
              border: '1px solid #ddd',
              scrollbarWidth: 'none'
            }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '14px' }}>
                <thead>
                  <tr style={{ 
                    position: 'sticky', 
                    top: '-5px', 
                    backgroundColor: '#f8f9fa', 
                    zIndex: 1, 
                    fontSize: '16px',
                    borderBottom: '2px solid #dee2e6'
                  }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Account Number</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Account Holder</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Next Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map((summary) => (
                    <tr 
                      key={summary.account_number} 
                      onClick={() => fetchPaymentSchedules(summary.account_number, loanType)} 
                      style={{ 
                        cursor: 'pointer',
                        borderBottom: '1px solid #dee2e6'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <td style={{ padding: '12px', color: 'blue' }}>
                        {summary.account_number || 'N/A'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {summary.account_holder || 'N/A'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {summary.next_due_date ? new Date(summary.next_due_date).toLocaleDateString() : 'No Due Date'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ textAlign: 'center', fontSize: '18px', color: '#666' }}>
              No ongoing schedules found.
            </p>
          )}
        </>
      ) : (
        <>
          {accountDetails && (
            <div style={{ 
              width: '100%',
              marginTop: '0px', 
              maxWidth: '500px', 
              marginBottom: '50px'
            }}>
              <h3 style={{ color: 'black', fontSize: '20px', marginBottom: '15px' }}>
                Payment Schedules For:
              </h3>
              <div style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: '#f8f9fa'
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Name: </strong>
                  <span>{accountDetails.first_name}</span>
                  <span style={{ paddingLeft: '5px' }}>{accountDetails.middle_name}</span>
                  <span style={{ paddingLeft: '5px' }}>{accountDetails.last_name}</span>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Account Number: </strong>
                  {selectedAccount}
                </div>
                <div>
                  <strong>Remaining Balance: </strong>
                  <span style={{ fontWeight: 'bold', color: '#dc3545' }}>
                    ₱ {formatNumber(Math.round(calculateRemainingBalance()))}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            <button 
              onClick={() => setSelectedAccount(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '10px 15px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>

            <button 
              onClick={() => handleLoanTypeChange('Regular')} 
              style={{ 
                backgroundColor: loanType === 'Regular' ? '#28a745' : 'transparent',
                color: loanType === 'Regular' ? 'white' : 'black',
                cursor: 'pointer', 
                border: '1px solid #28a745', 
                padding: '10px 15px',
                borderRadius: '4px'
              }}
            > 
              Regular Loans 
            </button>

            <button 
              onClick={() => handleLoanTypeChange('Emergency')} 
              style={{ 
                backgroundColor: loanType === 'Emergency' ? '#28a745' : 'transparent',
                color: loanType === 'Emergency' ? 'white' : 'black',
                cursor: 'pointer', 
                border: '1px solid #28a745', 
                padding: '10px 15px',
                borderRadius: '4px'
              }}
            > 
              Emergency Loans 
            </button>
          </div>

          {/* Notification */}
          {notification.message && (
            <>
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.15)',
                backdropFilter: 'blur(5px)',
                zIndex: 9998,
              }} />
              <div style={{ 
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: notification.type === 'success' ? '#d4edda' : '#f8d7da', 
                color: notification.type === 'success' ? '#155724' : '#721c24',
                padding: '20px 30px',
                borderRadius: '8px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                fontSize: '16px',
                textAlign: 'center',
                zIndex: 9999,
                minWidth: '300px',
                border: `1px solid ${notification.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
              }}>
                {notification.message}
              </div>
            </>
          )}

          {/* OR Number Input Modal */}
          {showOrInput && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '25px',
                borderRadius: '8px',
                width: '350px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
              }}>
                <h3 style={{ marginBottom: '15px', textAlign: 'center' }}>Enter OR Number</h3>
                <input
                  type="text"
                  maxLength="4"
                  value={orNumber}
                  onChange={(e) => handleOrChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginBottom: '10px',
                    border: `1px solid ${orValidation.available ? '#ccc' : '#dc3545'}`,
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter 4 digits"
                />
                {orValidation.message && (
                  <p style={{ 
                    margin: '5px 0 15px 0',
                    fontSize: '14px',
                    color: orValidation.available ? '#28a745' : '#dc3545'
                  }}>
                    {orValidation.message}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button 
                    onClick={() => {
                      setShowOrInput(false);
                      setOrNumber('');
                      setSelectedScheduleId(null);
                      setOrValidation({ available: true, message: '' });
                    }}
                    style={{
                      padding: '10px 20px',
                      border: '1px solid #dc3545',
                      borderRadius: '4px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const schedule = schedules.find(s => s.id === selectedScheduleId);
                      if (schedule) {
                        try {
                          await markAsPaid(selectedScheduleId, parseFloat(schedule.payment_amount) || 0, orNumber);
                        } catch (error) {
                          console.error('Payment failed:', error);
                        }
                      }
                    }}
                    disabled={paying || !orNumber || orNumber.length !== 4 || !orValidation.available}
                    style={{
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: paying || !orNumber || orNumber.length !== 4 || !orValidation.available ? '#ccc' : '#28a745',
                      color: 'white',
                      cursor: paying || !orNumber || orNumber.length !== 4 || !orValidation.available ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {paying ? 'Processing...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payment Schedules Table */}
          {schedules.length > 0 ? (
            <div style={{
              maxHeight: '500px',
              overflowY: 'auto',
              boxShadow: '0px 0px 15px 0px rgb(154, 154, 154)',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              backgroundColor: 'white',
              scrollbarWidth: 'none'
            }}>
              {(() => {
                if (!schedules.length) return null;

                const SCHEDULES_PER_YEAR = 24;
                const grouped = schedules.reduce((acc, schedule, index) => {
                  const year = Math.floor(index / SCHEDULES_PER_YEAR) + 1;
                  if (!acc[year]) acc[year] = [];
                  acc[year].push(schedule);
                  return acc;
                }, {});

                return Object.entries(grouped)
                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([year, yearSchedules]) => (
                    <div
                      key={year}
                      style={{
                        marginBottom: '20px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Year Header */}
                      <div
                        onClick={() => toggleYear(year)}
                        style={{
                          cursor: 'pointer',
                          padding: '15px',
                          background: 'linear-gradient(135deg, #f9f9fbff 0%, #d2c1e2ff 100%)',
                          color: 'black',
                          display: 'flex',
                          alignItems: 'center',
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ fontWeight: 'bold', fontSize: '18px', flex: 1 }}>
                          Year {year}
                        </span>
                        <span style={{ fontSize: '18px' }}>
                          {openYears[year] ? '▼' : '►'}
                        </span>
                      </div>

                      {/* Year Content */}
                      {openYears[year] && (
                        <div style={{ backgroundColor: '#fafbfc' }}>
                          {(() => {
                            const allYearPaymentsPaid = yearSchedules.every(schedule => schedule.is_paid);
                            
                            if (allYearPaymentsPaid) {
                              return (
                                <div style={{
                                  margin: '15px',
                                  padding: '20px',
                                  backgroundColor: '#d4edda',
                                  border: '1px solid #c3e6cb',
                                  borderRadius: '8px',
                                  textAlign: 'center',
                                  color: '#155724'
                                }}>
                                  <h4 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>
                                    Year {year} Completed!
                                  </h4>
                                  <p style={{ margin: 0, fontSize: '14px' }}>
                                    Congratulations! You have successfully completed all payments for Year {year}.
                                  </p>
                                </div>
                              );
                            }
                            
                            return (
                              <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                textAlign: 'center',
                                fontSize: '14px',
                                marginBottom: '10px'
                              }}>
                                <thead>
                                  <tr style={{
                                    backgroundColor: '#f8f9fa',
                                    color: 'black',
                                    fontSize: '14px',
                                    borderBottom: '2px solid #dee2e6'
                                  }}>
                                    <th style={{ padding: '12px' }}>Payment Amount</th>
                                    <th style={{ padding: '12px' }}>Due Date</th>
                                    <th style={{ padding: '12px' }}>Penalty</th>
                                    <th style={{ padding: '12px' }}>Status</th>
                                    <th style={{ padding: '12px' }}>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {yearSchedules
                                    .filter(schedule => !schedule.is_paid)
                                    .map(schedule => (
                                    <tr key={schedule.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                                      <td style={{ padding: '12px' }}>
                                        ₱ {formatNumber((parseFloat(schedule.payment_amount) || 0).toFixed(2))}
                                      </td>
                                      <td style={{ padding: '12px' }}>
                                        {new Date(schedule.due_date).toLocaleDateString()}
                                      </td>
                                      <td style={{ padding: '12px' }}>
                                        ₱ {formatNumber((parseFloat(schedule.penalty) || 0).toFixed(2))}
                                      </td>
                                      <td style={{
                                        padding: '12px',
                                        color: '#dc3545',
                                        fontWeight: 'bold'
                                      }}>
                                        Ongoing
                                      </td>
                                      <td style={{ padding: '12px' }}>
                                        <button
                                          style={{
                                            backgroundColor: arePreviousPaymentsPaid(schedule.id) ? '#28a745' : '#6c757d',
                                            color: 'white',
                                            border: 'none',
                                            padding: '8px 16px',
                                            borderRadius: '4px',
                                            cursor: arePreviousPaymentsPaid(schedule.id) ? 'pointer' : 'not-allowed',
                                            fontSize: '13px',
                                          }}
                                          onClick={(e) => {
                                            if (!arePreviousPaymentsPaid(schedule.id)) {
                                              e.preventDefault();
                                              showNotification('Previous payments must be paid first.', 'error');
                                              return;
                                            }
                                            setSelectedScheduleId(schedule.id);
                                            setShowOrInput(true);
                                          }}
                                          disabled={!arePreviousPaymentsPaid(schedule.id)}
                                        >
                                          Credit Now
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            );
                          })()}

                          {/* Yearly Recalculations */}
                          {loanDetails &&
                            loanDetails.yearly_recalculations &&
                            loanDetails.yearly_recalculations.length > 0 &&
                            (() => {
                              const allYearPaymentsPaid = yearSchedules.every(schedule => schedule.is_paid);
                              
                              if (allYearPaymentsPaid) {
                                const nextYear = parseInt(year) + 1;
                                const recal = loanDetails.yearly_recalculations.find(r => r.year === nextYear);
                                
                                if (recal) {
                                  return (
                                    <div
                                      key={recal.year}
                                      style={{
                                        margin: '15px',
                                        background: '#fff3cd',
                                        borderRadius: '8px',
                                        padding: '15px',
                                        border: '1px solid #ffc107'
                                      }}
                                    >
                                      <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>
                                        Year {recal.year} Recalculation
                                      </h4>
                                      <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        background: '#fff',
                                        borderRadius: '6px',
                                        overflow: 'hidden',
                                        border: '1px solid #dee2e6'
                                      }}>
                                        <thead>
                                          <tr style={{ background: '#f8f9fa' }}>
                                            <th style={{ padding: '10px', fontSize: '12px' }}>Previous Bal.</th>
                                            <th style={{ padding: '10px', fontSize: '12px' }}>Service Fee</th>
                                            <th style={{ padding: '10px', fontSize: '12px' }}>Interest</th>
                                            <th style={{ padding: '10px', fontSize: '12px' }}>Admin Cost</th>
                                            <th style={{ padding: '10px', fontSize: '12px' }}>CISP</th>
                                            <th style={{ padding: '10px', fontSize: '12px' }}>Outstanding Balance</th>
                                            <th style={{ padding: '10px', fontSize: '12px' }}>Recalculated At</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          <tr>
                                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '12px' }}>
                                              ₱ {formatNumber(recal.previous_balance)}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '12px' }}>
                                              ₱ {formatNumber(recal.service_fee)}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '12px' }}>
                                              ₱ {formatNumber(recal.interest_amount)}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '12px' }}>
                                              ₱ {formatNumber(recal.admincost)}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '12px' }}>
                                              ₱ {formatNumber(recal.cisp)}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '12px' }}>
                                              ₱ {formatNumber(recal.outstanding_balance)}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '12px' }}>
                                              {new Date(recal.recalculated_at).toLocaleDateString()}
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  );
                                }
                              }
                              return null;
                            })()
                          }
                        </div>
                      )}
                    </div>
                  ));
              })()}
            </div>
          ) : (
            <p style={{ textAlign: 'center', fontSize: '18px', color: '#666', marginTop: '20px' }}>
              No payment schedules found.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default PaymentSchedule;