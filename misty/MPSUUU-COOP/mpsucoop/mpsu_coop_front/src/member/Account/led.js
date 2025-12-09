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

  const formatNumber = (number) => {
    if (!number) return '0.00';
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Fixed date formatting function
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      // Format to Philippine time and readable format
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
            let combinedTransactions = [...transactionsData];
    
            // Check if initial deposit transaction exists
            const hasInitialDepositTransaction = transactionsData.some(
              (transaction) => transaction.transaction_type === 'in_dep'
            );
    
            // If no initial deposit transaction found, try to get it from member data
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
                  // Create initial deposit transaction object
                  const initialDepositTransaction = {
                    transaction_type: 'Initial Deposit',
                    amount: member.in_dep,
                    description: 'Initial Deposit',
                    balance_after_transaction: member.in_dep, // Assuming this is the starting balance
                    timestamp: member.created_at || new Date().toISOString() // Use member creation date or current date
                  };
    
                  // Add initial deposit as the first transaction
                  combinedTransactions = [initialDepositTransaction, ...transactionsData];
                }
              } catch (memberError) {
                console.log('Could not fetch member data:', memberError);
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
      
      <div style={{ padding: '40px 20px', marginTop: '140px' }}>
        <div style={{ width: '1300px', margin: '0 auto' }}>
          
          {/* Statistics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '50px', marginBottom: '30px' }}>
            <div style={{
              background: '#28a745',
              boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '20px',
              color: 'black',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>📈</div>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '5px' }}>Total Transactions</div>
              <div style={{ fontSize: '32px', fontWeight: '800' }}>{allTransactions.length}</div>
            </div>

            <div style={{
              background: '#007bff',
              boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '20px',
              color: 'black',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>💰</div>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '5px' }}>Current Balance</div>
              <div style={{ fontSize: '28px', fontWeight: '800' }}>
                ₱{formatNumber(allTransactions.reduce((sum, t) => sum + Number(t.amount), 0))}
              </div>
            </div>

            <div style={{
              background: '#ffc107',
              boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '20px',
              color: 'black',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>📅</div>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '5px' }}>Latest Transaction</div>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>
                {allTransactions.length > 0 
                  ? formatDate(allTransactions[allTransactions.length - 1].timestamp)
                  : 'No transactions'
                }
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div style={{
            background: 'white',
            boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
            borderRadius: '15px',
            overflow: 'hidden',
            height: '420px',
          }}>

            <div style={{
              background: '#000000ff',
              padding: '15px',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
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
                  margin: 0,
                  opacity: '0.9'
                }}>
                  {isAdmin ? 'Complete transaction history' : `Account: ${accountNumber}`}
                </p>
              </div>
              
              <button
                onClick={() => navigate(-1)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: '2px solid rgba(255,255,255,0.3)',
                  padding: '10px 20px',
                  borderRadius: '25px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)',
                  minWidth: '100px',
                  marginLeft: '690px'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.3)';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.2)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                ← Back
              </button>
            </div>

            {/* Table Content with Fixed Scrolling */}
            <div style={{ 
              height: '320px', 
              overflow: 'hidden',
              scrollBehavior: 'smooth'
            }}>
              <style>
                {`
                  .table-container::-webkit-scrollbar {
                    width: 0px;
                    height: 8px;
                  }
                  .table-container::-webkit-scrollbar-track {
                    border-radius: 4px;
                  }
                  .table-container::-webkit-scrollbar-thumb {
                    border-radius: 4px;
                  }
                  .table-container::-webkit-scrollbar-thumb:hover {
                  }
                `}
              </style>
              <div className="table-container" style={{ height: '100%', overflow: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px',
                  minWidth: '800px'
                }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #000000ff', }}>
                      <th style={{
                        padding: '15px 10px',
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
                        padding: '15px 10px',
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
                        padding: '15px 10px',
                        textAlign: 'left',
                        fontWeight: '700',
                        color: '#000000ff',
                        fontSize: '16px',
                        borderRight: '1px solid #000000ff',
                        minWidth: '200px'
                      }}>
                        Description
                      </th>
                      <th style={{
                        padding: '15px 10px',
                        textAlign: 'left',
                        fontWeight: '700',
                        color: '#000000ff',
                        fontSize: '16px',
                        borderRight: '1px solid #000000ff',
                        minWidth: '120px'
                      }}>
                        Running Total
                      </th>
                      <th style={{
                        padding: '15px 10px',
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
                    {allTransactions.map((transaction, index) => {
                      // Calculate running total
                      let runningTotal = allTransactions
                        .slice(0, index + 1)
                        .reduce((sum, t) => sum + Number(t.amount), 0);

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
                    {allTransactions.length === 0 && (
                      <tr>
                        <td 
                          colSpan="5" 
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
                            <div>No transactions found</div>
                            <div style={{ fontSize: '14px', opacity: '0.7' }}>
                              Transactions will appear here once you make deposits or withdrawals
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