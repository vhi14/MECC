import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Topbar from '../Topbar/Topbar';

const Ledger = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allTransactions, setAllTransactions] = useState([]);
  const [filter, setFilter] = useState('deposit'); // 'all', 'deposit', 'withdraw'

  const formatNumber = (number) => {
    if (!number && number !== 0) return '0.00';
    const num = parseFloat(number);
    if (isNaN(num)) return '0.00';
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        timeZone: 'Asia/Manila'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  const accountNumber = localStorage.getItem('account_number');
  const userRole = localStorage.getItem('userRole');

  // Filter transactions based on selected filter
  const getFilteredTransactions = () => {
    if (filter === 'all') {
      return allTransactions;
    } else if (filter === 'deposit') {
      return allTransactions.filter(t => {
        const type = t.transaction_type.toLowerCase();
        return !type.includes('withdrawal') && !type.includes('withdraw');
      });
    } else if (filter === 'withdraw') {
      return allTransactions.filter(t => {
        const type = t.transaction_type.toLowerCase();
        return type.includes('withdrawal') || type.includes('withdraw');
      });
    }
    return allTransactions;
  };

  const filteredTransactions = getFilteredTransactions();

  useEffect(() => {
    setIsAdmin(userRole === 'admin');

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('accessToken');
        if (!accountNumber || !token) {
          setError('Account number or token missing.');
          setLoading(false);
          return;
        }

        // Fetch transactions
        const response = await axios.get(
          `http://localhost:8000/api/account/${accountNumber}/transactions/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        let transactionsData = response.data.transactions;
        
        // Sort regular transactions by timestamp (oldest first)
        transactionsData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        let combinedTransactions = [...transactionsData];

        // Check kung may 'in_dep' type na transaction
        const hasInitialDepositTransaction = transactionsData.some(
          (transaction) => transaction.transaction_type === 'in_dep'
        );

        // Kung WALANG in_dep transaction, kunin natin from member data
        if (!hasInitialDepositTransaction) {
          try {
            const memberResponse = await axios.get(
              `http://localhost:8000/members/?accountN=${accountNumber}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            const member = memberResponse.data.find(m => m.accountN == accountNumber);
            
            if (member && member.in_dep && member.in_dep > 0) {
              console.log('Member data:', member);
              console.log('Available member fields:', Object.keys(member));
              
              // Find member creation date
              let memberCreationDate = null;
              
              if (member.created_at) {
                memberCreationDate = member.created_at;
                console.log('Using created_at:', memberCreationDate);
              } else if (member.date_created) {
                memberCreationDate = member.date_created;
                console.log('Using date_created:', memberCreationDate);
              } else if (member.date_joined) {
                memberCreationDate = member.date_joined;
                console.log('Using date_joined:', memberCreationDate);
              } else if (member.membership_date) {
                memberCreationDate = member.membership_date;
                console.log('Using membership_date:', memberCreationDate);
              } else if (member.registration_date) {
                memberCreationDate = member.registration_date;
                console.log('Using registration_date:', memberCreationDate);
              } else {
                console.warn('No creation date field found. Available fields:', Object.keys(member));
                
                // Fallback: use oldest transaction date
                if (transactionsData.length > 0) {
                  memberCreationDate = transactionsData[0].timestamp;
                  console.log('Using oldest transaction date:', memberCreationDate);
                } else {
                  // Last resort estimate
                  const sixMonthsAgo = new Date();
                  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                  memberCreationDate = sixMonthsAgo.toISOString();
                  console.warn('Using estimated date (6 months ago):', memberCreationDate);
                }
              }

              // Validate date
              const testDate = new Date(memberCreationDate);
              if (!isNaN(testDate.getTime())) {
                // Create Initial Deposit transaction
                const initialDepositTransaction = {
                  transaction_type: 'Initial Deposit',
                  amount: member.in_dep,
                  description: 'Initial Deposit',
                  balance_after_transaction: member.in_dep,
                  timestamp: memberCreationDate
                };

                console.log('Created initial deposit transaction:', initialDepositTransaction);

                // Put Initial Deposit FIRST, then other transactions
                combinedTransactions = [initialDepositTransaction, ...transactionsData];
              }
            }
          } catch (memberError) {
            console.log('Could not fetch member data:', memberError);
          }
        } else {
          // MAY EXISTING in_dep transaction - so i-replace ang date niya with member creation date
          try {
            const memberResponse = await axios.get(
              `http://localhost:8000/members/?accountN=${accountNumber}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            const member = memberResponse.data.find(m => m.accountN == accountNumber);
            
            if (member) {
              console.log('Found member, checking creation date...');
              
              // Find member creation date
              let memberCreationDate = null;
              
              if (member.created_at) {
                memberCreationDate = member.created_at;
              } else if (member.date_created) {
                memberCreationDate = member.date_created;
              } else if (member.date_joined) {
                memberCreationDate = member.date_joined;
              } else if (member.membership_date) {
                memberCreationDate = member.membership_date;
              } else if (member.registration_date) {
                memberCreationDate = member.registration_date;
              }

              if (memberCreationDate) {
                // Update ang in_dep transaction date to member creation date
                combinedTransactions = transactionsData.map(t => {
                  if (t.transaction_type === 'in_dep') {
                    console.log('Updating in_dep transaction date from', t.timestamp, 'to', memberCreationDate);
                    return {
                      ...t,
                      transaction_type: 'Initial Deposit',
                      timestamp: memberCreationDate,
                      description: t.description || 'Initial Deposit'
                    };
                  }
                  return t;
                });

                // Sort again after updating dates
                combinedTransactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
              }
            }
          } catch (memberError) {
            console.log('Could not fetch member data for date update:', memberError);
          }
        }

        setTransactions(transactionsData);
        setAllTransactions(combinedTransactions);
        
      } catch (err) {
        setError('Failed to fetch transactions. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [accountNumber, userRole]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid #667eea', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
          <p style={{ color: '#0b78e6ff', fontSize: '14px' }}>Loading transactions...</p>
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
    <div style={{ minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"}}>
      <Topbar />
      
      <div style={{ padding: '40px 20px', marginTop: '170px' }}>
        <div style={{ width: '1380px', margin: '0 auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '50px', marginBottom: '50px',  }}>
            <div style={{
              background: '#dededeff',
              boxShadow: '0px 8px 5px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '10px',
              color: 'black',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px' }}>📈 Share Capital Transactions</div>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '5px'}}>
                <div>
                  <div style={{ fontSize: '14px', color: '#28a745', fontWeight: '600' }}>💰 Deposits</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#28a745' }}>
                    {allTransactions.filter(t => {
                      const type = t.transaction_type.toLowerCase();
                      return !type.includes('withdrawal') && !type.includes('withdraw');
                    }).length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#dc3545', fontWeight: '600' }}>💸 Withdrawals</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#dc3545' }}>
                    {allTransactions.filter(t => {
                      const type = t.transaction_type.toLowerCase();
                      return type.includes('withdrawal') || type.includes('withdraw');
                    }).length}
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              background: '#dededeff',
              boxShadow: '0px 8px 5px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '10px',
              color: 'black',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px' }}>📅 Latest Transaction</div>
              <div style={{ fontSize: '26px', fontWeight: '700' }}>
                {filteredTransactions.length > 0 
                  ? formatDate(filteredTransactions[filteredTransactions.length - 1].timestamp)
                  : 'No transactions'
                }
              </div>
            </div>

            <div style={{
              background: '#dededeff',
              boxShadow: '0px 8px 5px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '10px',
              color: 'black',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px' }}>💰 Share Capital</div>
              <div style={{ fontSize: '26px', fontWeight: '800' }}>
                ₱{formatNumber(allTransactions.reduce((sum, t) => {
                  const isWithdrawal = t.transaction_type.toLowerCase().includes('withdrawal') || 
                                      t.transaction_type.toLowerCase().includes('withdraw');
                  return isWithdrawal ? sum - Number(t.amount) : sum + Number(t.amount);
                }, 0))}
              </div>
            </div>
          </div>

          <div style={{
            background: 'white',
            boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
            borderRadius: '15px',
            overflow: 'hidden',
            height: '450px',
          }}>

            <div style={{
              background: '#000000ff',
              padding: '15px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              position: 'relative'
            }}>
              <button
                onClick={() => navigate(-1)}
                style={{
                  background: 'rgba(94, 94, 94, 1)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.3)',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  position: 'absolute',
                  left: '15px'
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'translateY(-3px)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                ← Back
              </button>

              <div style={{
                flex: 1,
                textAlign: 'center'
              }}>
                <h1 style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  margin: '0 0 10px 0',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                }}>
                  {isAdmin ? '📊 ALL TRANSACTIONS' : '💰 Share Capital Transactions'}
                </h1>
                <p style={{
                  fontSize: '16px',
                  margin: 0
                }}>
                  {isAdmin ? 'Complete transaction history' : `Account: ${accountNumber}`}
                </p>
              </div>

              <div style={{
                position: 'absolute',
                right: '15px',
                display: 'flex',
                gap: '10px'
              }}>
                <button
                  onClick={() => setFilter(filter === 'deposit' ? 'all' : 'deposit')}
                  style={{
                    background: filter === 'deposit' 
                      ? 'linear-gradient(135deg, #28a745, #20c997)' 
                      : 'linear-gradient(135deg, rgba(40, 167, 69, 0.5), rgba(32, 201, 151, 0.5))',
                    color: 'white',
                    border: filter === 'deposit' ? '3px solid #fff' : 'none',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: filter === 'deposit' 
                      ? '0 6px 20px rgba(40, 167, 69, 0.5)' 
                      : '0 4px 15px rgba(40, 167, 69, 0.3)'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-3px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(40, 167, 69, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = filter === 'deposit' 
                      ? '0 6px 20px rgba(40, 167, 69, 0.5)' 
                      : '0 4px 15px rgba(40, 167, 69, 0.3)';
                  }}
                >
                  💰 Deposit
                </button>

                <button
                  onClick={() => setFilter(filter === 'withdraw' ? 'all' : 'withdraw')}
                  style={{
                    background: filter === 'withdraw' 
                      ? 'linear-gradient(135deg, #dc3545, #c82333)' 
                      : 'linear-gradient(135deg, rgba(220, 53, 69, 0.5), rgba(200, 35, 51, 0.5))',
                    color: 'white',
                    border: filter === 'withdraw' ? '3px solid #fff' : 'none',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: filter === 'withdraw' 
                      ? '0 6px 20px rgba(220, 53, 69, 0.5)' 
                      : '0 4px 15px rgba(220, 53, 69, 0.3)'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-3px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(220, 53, 69, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = filter === 'withdraw' 
                      ? '0 6px 20px rgba(220, 53, 69, 0.5)' 
                      : '0 4px 15px rgba(220, 53, 69, 0.3)';
                  }}
                >
                  💸 Withdraw
                </button>
              </div>
            </div>

            <div style={{ 
              height: '350px', 
              overflow: 'hidden'
            }}>
              <style>
                {`
                  .table-container {
                    height: 100%;
                    width: 100%;
                    margin-top: -30px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    scroll-behavior: smooth;
                    scrollbar-width: none; /* Firefox */
                    -ms-overflow-style: none; /* IE and Edge */
                    padding-bottom: 20px;
                  }
                  .table-container::-webkit-scrollbar {
                    display: none; /* Chrome, Safari, Opera */
                  }
                `}
              </style>

              <div className="table-container">
                <table style={{
                  width: '1377px',
                  borderCollapse: 'collapse',
                  fontSize: '14px',
                  marginBottom: '2px',
                  marginLeft: '-28px',
                }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8f9fa' }}>
                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #000000ff'}}>
                      <th style={{
                        padding: '10px 10px',
                        textAlign: 'left',
                        fontWeight: '700',
                        color: '#000000ff',
                        fontSize: '16px',
                        borderRight: '1px solid #000000ff',
                        minWidth: '150px'
                      }}>
                        Transaction Type
                      </th>
                      <th style={{
                        padding: '10px 10px',
                        textAlign: 'left',
                        fontWeight: '700',
                        color: '#000000ff',
                        fontSize: '16px',
                        borderRight: '1px solid #000000ff',
                        minWidth: '120px'
                      }}>
                        Amount
                      </th>
                      <th style={{
                        padding: '10px 10px',
                        textAlign: 'left',
                        fontWeight: '700',
                        color: '#000000ff',
                        fontSize: '16px',
                        borderRight: '1px solid #000000ff',
                        minWidth: '200px'
                      }}>
                        Description
                      </th>
                      {filter !== 'deposit' && (
                        <>
                          <th style={{
                            padding: '10px 10px',
                            textAlign: 'left',
                            fontWeight: '700',
                            color: '#000000ff',
                            fontSize: '16px',
                            borderRight: '1px solid #000000ff',
                            minWidth: '160px'
                          }}>
                            OR Number
                          </th>
                          <th style={{
                            padding: '10px 10px',
                            textAlign: 'left',
                            fontWeight: '700',
                            color: '#000000ff',
                            fontSize: '16px',
                            borderRight: '1px solid #000000ff',
                            minWidth: '200px'
                          }}>
                            Board Resolution
                          </th>
                        </>
                      )}
                      <th style={{
                        padding: '10px 10px',
                        textAlign: 'left',
                        fontWeight: '700',
                        color: '#000000ff',
                        fontSize: '16px',
                        borderRight: '1px solid #000000ff',
                        minWidth: '120px'
                      }}>
                        Total
                      </th>
                      <th style={{
                        padding: '10px 10px',
                        textAlign: 'left',
                        fontWeight: '700',
                        color: '#000000ff',
                        fontSize: '16px',
                        minWidth: '120px'
                      }}>
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction, index) => {
                      // Calculate running total based on ALL transactions up to this point
                      const originalIndex = allTransactions.findIndex(t => t === transaction);
                      let runningTotal = allTransactions
                        .slice(0, originalIndex + 1)
                        .reduce((sum, t) => {
                          const isWithdrawal = t.transaction_type.toLowerCase().includes('withdrawal') || 
                                             t.transaction_type.toLowerCase().includes('withdraw');
                          return isWithdrawal ? sum - Number(t.amount) : sum + Number(t.amount);
                        }, 0);

                      const isInitialDeposit = transaction.transaction_type === 'Initial Deposit';
                      const isEvenRow = index % 2 === 0;

                      return (
                        <tr 
                          key={index}
                          style={{
                            backgroundColor: isEvenRow ? '#f9f9f9' : 'white',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseLeave={(e) => e.target.parentNode.style.backgroundColor = isEvenRow ? '#f9f9f9' : 'white'}
                        >
                          <td style={{
                            padding: '12px 10px',
                            color: '#000000ff',
                            fontWeight: isInitialDeposit ? '700' : '500',
                            borderRight: '1px solid #000000ff',
                            borderBottom: '1px solid #999999ff',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isInitialDeposit ? '🎯' : '💳'}
                              <span>{transaction.transaction_type}</span>
                              {isInitialDeposit && (
                                <span style={{
                                  background: '#28a745',
                                  color: 'white',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  fontSize: '10px',
                                  fontWeight: '600'
                                }}>
                                  INITIAL
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{
                            padding: '12px 10px',
                            borderRight: '1px solid #000000ff',
                            borderBottom: '1px solid #999999ff',
                            textAlign: 'left',
                            fontWeight: '700',
                            color: '#000000ff',
                            fontSize: '15px'
                          }}>
                            ₱{formatNumber(transaction.amount)}
                          </td>
                          <td style={{
                            padding: '12px 10px',
                            borderRight: '1px solid #000000ff',
                            borderBottom: '1px solid #999999ff',
                            textAlign: 'left',
                            fontWeight: '500',
                            color: '#000000ff',
                            fontSize: '14px',
                            fontStyle: transaction.description ? 'normal' : 'italic'
                          }}>
                            {transaction.description || 'No description'}
                          </td>
                          {filter !== 'deposit' && (
                            <>
                              <td style={{
                                padding: '12px 10px',
                                borderRight: '1px solid #000000ff',
                                borderBottom: '1px solid #999999ff',
                                textAlign: 'left',
                                fontWeight: '500',
                                color: '#000000ff',
                                fontSize: '14px',
                                fontStyle: transaction.or_number ? 'normal' : 'italic'
                              }}>
                                {transaction.or_number || (() => {
                                  const desc = transaction.description || '';
                                  const m = desc.match(/OR\s+(\d{4})/i);
                                  return m ? m[1] : '—';
                                })()}
                              </td>
                              <td style={{
                                padding: '12px 10px',
                                borderRight: '1px solid #000000ff',
                                borderBottom: '1px solid #999999ff',
                                textAlign: 'left',
                                fontWeight: '500',
                                color: '#000000ff',
                                fontSize: '14px',
                                fontStyle: transaction.board_resolution ? 'normal' : 'italic'
                              }}>
                                {transaction.board_resolution || '—'}
                              </td>
                            </>
                          )}
                          <td style={{
                            padding: '12px 10px',
                            borderRight: '1px solid #000000ff',
                            borderBottom: '1px solid #999999ff',
                            textAlign: 'left',
                            fontWeight: '700',
                            color: '#000000ff',
                            fontSize: '15px'
                          }}>
                            ₱{formatNumber(runningTotal)}
                          </td>

                          <td style={{
                            padding: '12px 10px',
                            borderBottom: '1px solid #999999ff',
                            textAlign: 'left',
                            fontWeight: '500',
                            color: '#000000ff',
                            fontSize: '14px'
                          }}>
                            {formatDate(transaction.timestamp)}
                          </td>
                          
                        </tr>
                      );
                    })}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td 
                          colSpan={filter === 'deposit' ? "5" : "7"}
                          style={{
                            padding: '40px',
                            textAlign: 'center',
                            color: '#000000ff',
                            fontSize: '18px',
                            fontStyle: 'italic'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                            <div style={{ fontSize: '48px', opacity: '0.5' }}>📭</div>
                            <div>No {filter === 'deposit' ? 'deposit' : filter === 'withdraw' ? 'withdrawal' : ''} transactions found</div>
                            <div style={{ fontSize: '14px', opacity: '0.7' }}>
                              {filter === 'all' 
                                ? 'Transactions will appear here once you make deposits or withdrawals'
                                : filter === 'deposit'
                                ? 'No deposit transactions yet. Click the Deposit button to add one.'
                                : 'No withdrawal transactions yet. Click the Withdraw button to add one.'
                              }
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ledger;