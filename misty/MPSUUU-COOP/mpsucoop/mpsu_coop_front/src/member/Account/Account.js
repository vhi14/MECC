import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Topbar from '../Topbar/Topbar';
import './Account.css';

const Ledger = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allTransactions, setAllTransactions] = useState([]);

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

        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/account/${accountNumber}/transactions/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        let transactionsData = response.data.transactions;
        transactionsData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        let combinedTransactions = [...transactionsData];

        const hasInitialDepositTransaction = transactionsData.some(
          (transaction) => transaction.transaction_type === 'in_dep'
        );

        if (!hasInitialDepositTransaction) {
          try {
            const memberResponse = await axios.get(
              `${process.env.REACT_APP_API_URL}/members/?accountN=${accountNumber}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            const member = memberResponse.data.find(m => m.accountN == accountNumber);
            
            if (member && member.in_dep && member.in_dep > 0) {
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
              } else {
                if (transactionsData.length > 0) {
                  memberCreationDate = transactionsData[0].timestamp;
                } else {
                  const sixMonthsAgo = new Date();
                  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                  memberCreationDate = sixMonthsAgo.toISOString();
                }
              }

              const testDate = new Date(memberCreationDate);
              if (!isNaN(testDate.getTime())) {
                const initialDepositTransaction = {
                  transaction_type: 'Initial Deposit',
                  amount: member.in_dep,
                  description: 'Initial Deposit',
                  balance_after_transaction: member.in_dep,
                  timestamp: memberCreationDate
                };

                combinedTransactions = [initialDepositTransaction, ...transactionsData];
              }
            }
          } catch (memberError) {
            console.log('Could not fetch member data:', memberError);
          }
        } else {
          try {
            const memberResponse = await axios.get(
              `${process.env.REACT_APP_API_URL}/members/?accountN=${accountNumber}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            const member = memberResponse.data.find(m => m.accountN == accountNumber);
            
            if (member) {
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
                combinedTransactions = transactionsData.map(t => {
                  if (t.transaction_type === 'in_dep') {
                    return {
                      ...t,
                      transaction_type: 'Initial Deposit',
                      timestamp: memberCreationDate,
                      description: t.description || 'Initial Deposit'
                    };
                  }
                  return t;
                });

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
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading transactions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <div className="error-icon">⚠</div>
          <h2 className="error-title">Error Loading Data</h2>
          <p className="error-message">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="error-button"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ledger-container">
      <Topbar />
      
      <div className="ledger-page-content">
        <div className="ledger-main-container">
          
          <div className="ledger-stats-grid">
            <div className="ledger-stat-card">
              <div className="ledger-stat-card-title">📈 Share Capital Transactions</div>
              <div className="ledger-stat-split">
                <div>
                  <div className="ledger-stat-deposits">💰 Deposits</div>
                  <div className="ledger-stat-deposits-value">
                    {allTransactions.filter(t => {
                      const type = t.transaction_type.toLowerCase();
                      return !type.includes('withdrawal') && !type.includes('withdraw');
                    }).length}
                  </div>
                </div>
                <div>
                  <div className="ledger-stat-withdrawals">💸 Withdrawals</div>
                  <div className="ledger-stat-withdrawals-value">
                    {allTransactions.filter(t => {
                      const type = t.transaction_type.toLowerCase();
                      return type.includes('withdrawal') || type.includes('withdraw');
                    }).length}
                  </div>
                </div>
              </div>
            </div>

            <div className="ledger-stat-card">
              <div className="ledger-stat-card-title">📅 Latest Transaction</div>
              <div className="ledger-stat-value-large">
                {allTransactions.length > 0 
                  ? formatDate(allTransactions[allTransactions.length - 1].timestamp)
                  : 'No transactions'
                }
              </div>
            </div>

            <div className="ledger-stat-card">
              <div className="ledger-stat-card-title">💰 Share Capital</div>
              <div className="ledger-stat-value-large">
                ₱{formatNumber(allTransactions.reduce((sum, t) => {
                  const isWithdrawal = t.transaction_type.toLowerCase().includes('withdrawal') || 
                                      t.transaction_type.toLowerCase().includes('withdraw');
                  return isWithdrawal ? sum - Number(t.amount) : sum + Number(t.amount);
                }, 0))}
              </div>
            </div>
          </div>

          <div className="ledger-transactions-container">
            <div className="ledger-header">
              <button
                onClick={() => navigate(-1)}
                className="ledger-back-button"
              >
                ← Back
              </button>

              <div className="ledger-header-title-section">
                <h1 className="ledger-header-title">
                  {isAdmin ? '📊 ALL TRANSACTIONS' : '💰 Share Capital Transactions'}
                </h1>
                <p className="ledger-header-subtitle">
                  {isAdmin ? 'Complete transaction history' : `Account: ${accountNumber}`}
                </p>
              </div>

              <div className="ledger-header-spacer"></div>
            </div>

            <div className="ledger-table-wrapper">
              {/* Desktop Table View */}
              <div className="table-container">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th className="ledger-table-header-cell">Transaction Type</th>
                      <th className="ledger-table-header-cell amount-col">Amount</th>
                      <th className="ledger-table-header-cell description-col">Description</th>
                      <th className="ledger-table-header-cell total-col">Total</th>
                      <th className="ledger-table-header-cell date-col">Date</th>
                      <th className="ledger-table-header-cell or-col">OR Number</th>
                      <th className="ledger-table-header-cell resolution-col">Board Resolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTransactions.map((transaction, index) => {
                      let runningTotal = allTransactions
                        .slice(0, index + 1)
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
                          className={isEvenRow ? 'even-row' : 'odd-row'}
                        >
                          <td className={`ledger-table-body-cell type-col ${isInitialDeposit ? 'initial-deposit' : ''}`}>
                            <div className="transaction-type-flex">
                              {isInitialDeposit ? '🎯' : '💳'}
                              <span>{transaction.transaction_type}</span>
                              {isInitialDeposit && (
                                <span className="initial-badge">INITIAL</span>
                              )}
                            </div>
                          </td>
                          <td className="ledger-table-body-cell amount-col">
                            ₱{formatNumber(transaction.amount)}
                          </td>
                          <td className={`ledger-table-body-cell ${!transaction.description ? 'italic-text' : ''}`}>
                            {transaction.description || 'No description'}
                          </td>
                          <td className="ledger-table-body-cell total-col">
                            ₱{formatNumber(runningTotal)}
                          </td>
                          <td className="ledger-table-body-cell">
                            {formatDate(transaction.timestamp)}
                          </td>
                          <td className={`ledger-table-body-cell ${!transaction.or_number ? 'italic-text' : ''}`}>
                            {transaction.or_number || (() => {
                              const desc = transaction.description || '';
                              const m = desc.match(/OR\s+(\d{4})/i);
                              return m ? m[1] : '—';
                            })()}
                          </td>
                          <td className={`ledger-table-body-cell ${!transaction.board_resolution ? 'italic-text' : ''}`}>
                            {transaction.board_resolution || '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {allTransactions.length === 0 && (
                      <tr>
                        <td colSpan="7" className="no-transactions-container">
                          <div className="no-transactions-flex">
                            <div className="no-transactions-icon">📭</div>
                            <div>No transactions found</div>
                            <div className="no-transactions-subtitle">
                              Transactions will appear here once you make deposits or withdrawals
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="mobile-transaction-cards">
                {allTransactions.length > 0 ? (
                  allTransactions.map((transaction, index) => {
                    let runningTotal = allTransactions
                      .slice(0, index + 1)
                      .reduce((sum, t) => {
                        const isWithdrawal = t.transaction_type.toLowerCase().includes('withdrawal') || 
                                           t.transaction_type.toLowerCase().includes('withdraw');
                        return isWithdrawal ? sum - Number(t.amount) : sum + Number(t.amount);
                      }, 0);

                    const isInitialDeposit = transaction.transaction_type === 'Initial Deposit';
                    const isWithdrawal = transaction.transaction_type.toLowerCase().includes('withdrawal') || 
                                        transaction.transaction_type.toLowerCase().includes('withdraw');
                    const isEvenRow = index % 2 === 0;

                    return (
                      <div 
                        key={index}
                        className={`mobile-transaction-card ${isEvenRow ? 'even-row' : ''}`}
                      >
                        <div className="mobile-card-header">
                          <div className="mobile-card-type">
                            {isInitialDeposit ? '🎯' : '💳'}
                            <span>{transaction.transaction_type}</span>
                            {isInitialDeposit && (
                              <span className="initial-badge">INITIAL</span>
                            )}
                          </div>
                          <div className={`mobile-card-amount ${isWithdrawal ? 'withdrawal' : ''}`}>
                            ₱{formatNumber(transaction.amount)}
                          </div>
                        </div>

                        <div className="mobile-card-body">
                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Description:</span>
                            <span className={`mobile-card-value ${!transaction.description ? 'italic-text' : ''}`}>
                              {transaction.description || 'No description'}
                            </span>
                          </div>

                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Date:</span>
                            <span className="mobile-card-value">
                              {formatDate(transaction.timestamp)}
                            </span>
                          </div>

                          <div className="mobile-card-row">
                            <span className="mobile-card-label">OR Number:</span>
                            <span className={`mobile-card-value ${!transaction.or_number ? 'italic-text' : ''}`}>
                              {transaction.or_number || (() => {
                                const desc = transaction.description || '';
                                const m = desc.match(/OR\s+(\d{4})/i);
                                return m ? m[1] : '—';
                              })()}
                            </span>
                          </div>

                          <div className="mobile-card-row">
                            <span className="mobile-card-label">Board Resolution:</span>
                            <span className={`mobile-card-value ${!transaction.board_resolution ? 'italic-text' : ''}`}>
                              {transaction.board_resolution || '—'}
                            </span>
                          </div>

                          <div className="mobile-card-total">
                            <span className="mobile-card-total-label">Running Total:</span>
                            <span className="mobile-card-total-value">
                              ₱{formatNumber(runningTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="mobile-no-transactions">
                    <div className="no-transactions-flex">
                      <div className="no-transactions-icon">📭</div>
                      <div>No transactions found</div>
                      <div className="no-transactions-subtitle">
                        Transactions will appear here once you make deposits or withdrawals
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ledger;