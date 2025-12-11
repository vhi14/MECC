import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || `${process.env.REACT_APP_API_URL}`;
const FETCH_TIMEOUT = 30000; // 30 seconds timeout

const Ledger = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const accountNumber = localStorage.getItem('accountNumber');
  const userRole = localStorage.getItem('userRole');
  const accessToken = localStorage.getItem('access_token');

  useEffect(() => {
    if (userRole === 'admin') {
      setIsAdmin(true);
    }

    let timeoutId;

    const fetchTransactions = async () => {
      timeoutId = setTimeout(() => {
        setError('Request timed out. Please try again.');
        setLoading(false);
      }, FETCH_TIMEOUT);

      try {
        setLoading(true);
        const endpoint = isAdmin 
          ? `${API_URL}/api/transactions/all` 
          : `${API_URL}/api/account/${accountNumber}/transactions/`;
        
        const config = {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        };
        
        const response = await axios.get(endpoint, config);
        clearTimeout(timeoutId);
        setTransactions(response.data.transactions || []);

      } catch (err) {
        clearTimeout(timeoutId);
        if (err.response?.status === 403) {
          setError('You do not have permission to view this ledger.');
        } else if (err.response?.status === 404) {
          setError('Account not found');
        } else {
          setError(err.response?.data?.message || 'Failed to fetch transactions');
        }
      } finally {
        setLoading(false);
      }
    };

    if (accessToken) {
      fetchTransactions();
    } else {
      setError('Please login to view transactions');
      setLoading(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [accountNumber, userRole, isAdmin, accessToken]);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const renderTable = () => (
    <>
      <div className="table-responsive">
        <table className="transaction-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Transaction Type</th>
              <th>Amount</th>
              <th>Description</th>
              <th>Balance After</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {currentTransactions.map((transaction) => (
              <tr key={transaction.ledger_id}>
                <td>{transaction.ledger_id}</td>
                <td>{transaction.transaction_type}</td>
                <td className={`amount ${transaction.amount < 0 ? 'negative' : 'positive'}`}>
                  ₱{Math.abs(transaction.amount).toFixed(2)}
                </td>
                <td>{transaction.description}</td>
                <td>₱{transaction.balance_after_transaction.toFixed(2)}</td>
                <td>{new Date(transaction.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => paginate(currentPage - 1)} 
            disabled={currentPage === 1}
            className="pagination-button"
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            onClick={() => paginate(currentPage + 1)} 
            disabled={currentPage === totalPages}
            className="pagination-button"
          >
            Next
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="ledger-container">
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading transactions...</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>
          <p>{error}</p>
        </div>
      ) : !transactions.length ? (
        <div className="no-data">
          <i className="fas fa-info-circle"></i>
          <p>No transactions found</p>
        </div>
      ) : (
        <>
          <h1 className="ledger-title">
            {isAdmin ? "All Transactions" : "Your Transactions"}
          </h1>
          {renderTable()}
        </>
      )}
    </div>
  );
};

export default Ledger;