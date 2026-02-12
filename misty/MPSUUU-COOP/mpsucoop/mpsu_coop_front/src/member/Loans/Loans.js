import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Topbar from "../Topbar/Topbar";
import { FaEye } from "react-icons/fa";
import './Loans.css';

const Loans = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [coMakers, setCoMakers] = useState([]);
  const [makersModal, setMakersModal] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const targetControl = queryParams.get("control");

  const targetRowRef = useRef(null);

  const formatNumber = (number) => {
    if (number == null || isNaN(number)) return "N/A";
    return new Intl.NumberFormat('en-US').format(number);
  };

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      setError("Please log in to view your loans.");
      setLoading(true);
      navigate("/home");
      return;
    }

    fetchLoans();
  }, [filter, navigate]);

  useEffect(() => {
    if (targetRowRef.current) {
      targetRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loans]);

  const fetchLoans = async () => {
    const accountNumber = localStorage.getItem("account_number");

    if (!accountNumber) {
      setError("Account number is missing");
      setLoading(false);
      return;
    }

    try {
      const url = filter
        ? `${process.env.REACT_APP_API_URL}/api/loans/by_account?account_number=${accountNumber}&filter=${filter}`
        : `${process.env.REACT_APP_API_URL}/api/loans/by_account?account_number=${accountNumber}`;

      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          setError("Session expired. Please log in again.");
          navigate("/");
        } else {
          throw new Error(`Failed to fetch loans: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      setLoans(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching loans:", err);
      setError("Unable to connect to the server. Please try again later.");
      setLoading(false);
    }
  };

  const filteredLoans = loans.filter((loan) => {
    const query = searchQuery.toLowerCase();
    return (
      loan.account_holder.toLowerCase().includes(query) ||
      loan.account.toLowerCase().includes(query)
    );
  });

  const regularLoans = loans.filter(loan => loan.loan_type === 'Regular');
  const emergencyLoans = loans.filter(loan => loan.loan_type === 'Emergency');
  const totalRegularAmount = regularLoans.reduce((sum, loan) => sum + parseFloat(loan.loan_amount || 0), 0);
  const totalEmergencyAmount = emergencyLoans.reduce((sum, loan) => sum + parseFloat(loan.loan_amount || 0), 0);

  if (error) {
    return (
      <div className="loans-error-wrapper">
        <div className="loans-error-container">
          <div className="loans-error-icon">⚠</div>
          <h2 className="loans-error-title">Error Loading Data</h2>
          <p className="loans-error-message">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="loans-error-button"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loans-loading-wrapper">
        <div className="loans-loading-container">
          <div className="loans-loading-spinner"></div>
          <p className="loans-loading-text">Loading loans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="loans-root-container">
      <Topbar />
      
      <div className="loans-main-content">
        <div className="loans-content-container">
          
          {/* Statistics Cards */}
          <div className="loans-stats-grid">
            <div className="loans-stat-card">
              <div className="loans-stat-title">💰 Regular Loans</div>
              <div className="loans-stat-value">₱{formatNumber(parseFloat(totalRegularAmount).toFixed(2))}</div>
              <div className="loans-stat-subtitle">Loan: {regularLoans.length}</div>
            </div>

            <div className="loans-stat-card">
              <div className="loans-stat-title">📋 Total Loans</div>
              <div className="loans-stat-value">{loans.length}</div>
            </div>

            <div className="loans-stat-card">
              <div className="loans-stat-title">🚨 Emergency Loans</div>
              <div className="loans-stat-value">₱{formatNumber(parseFloat(totalEmergencyAmount).toFixed(2))}</div>
              <div className="loans-stat-subtitle">Loan: {emergencyLoans.length}</div>
            </div>
          </div>

          {/* Loans Table Section - DESKTOP */}
          {filteredLoans.length > 0 ? (
            <>
              {/* DESKTOP TABLE VIEW */}
              <div className="loans-table-wrapper">
                
                {/* Table Header with Back Button */}
                <div className="loans-table-header">
                  <button
                    className="loans-back-button"
                    onClick={() => navigate(-1)}
                  >
                    ← Back
                  </button>

                  <div className="loans-table-title">
                    📊 MY LOANS
                  </div>

                  <div className="loans-spacer-80"></div>
                </div>

                {/* Table Container */}
                <div className="loans-table-scroll">
                  <table className="loans-table">
                    <thead>
                      <tr>
                        <th>Control Number</th>
                        <th>Account Number</th>
                        <th>Member</th>
                        <th>Loan Type</th>
                        <th>Loan Amount</th>
                        <th>Loan Term</th>
                        <th>Net Loan Proceeds</th>
                        <th>Loan Purpose</th>
                        <th>Status</th>
                        <th>Co-Makers</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    
                    <tbody>
                      {filteredLoans.map((loan, index) => {
                        const isTarget = loan.control_number === targetControl;
                        const isEvenRow = index % 2 === 0;
                        
                        return (
                          <tr key={loan.control_number}>
                            <td className="loans-table-cell-control">
                              {loan.control_number}
                            </td>
                            <td className="loans-table-cell-account">
                              {loan.account || "N/A"}
                            </td>
                            <td className="loans-table-cell-member">
                              {loan.account_holder || "N/A"}
                            </td>
                            <td className="loans-table-cell-type">
                              <span className={`loans-loan-type-badge ${loan.loan_type === 'Regular' ? 'loans-loan-type-regular' : 'loans-loan-type-emergency'}`}>
                                {loan.loan_type}
                              </span>
                            </td>
                            <td className="loans-table-cell-amount">
                              ₱{formatNumber(parseFloat(loan.loan_amount || 0).toFixed(2))}
                            </td>
                            <td className="loans-table-cell-term">
                              {`${loan.loan_period} ${loan.loan_type === 'Regular' ? 'Yrs' : 'Months'}`}
                            </td>
                            <td className="loans-table-cell-proceeds">
                              ₱{formatNumber(parseFloat(loan.net_proceeds || 0).toFixed(2))}
                            </td>
                            <td className="loans-table-cell-purpose">
                              {loan.purpose}
                            </td>
                            <td className="loans-table-cell-status">
                              <span className={`loans-status-badge ${
                                loan.status === "Paid-off" ? "loans-status-paid-off" 
                                : loan.status === "Ongoing" ? "loans-status-ongoing" 
                                : loan.status === "Pending" ? "loans-status-pending" 
                                : loan.status === "Cancelled" ? "loans-status-cancelled" 
                                : "loans-status-default"
                              }`}>
                                {loan.status}
                              </span>
                            </td>
                            <td className="loans-table-cell-comakers">
                              <button 
                                className="loans-action-button"
                                onClick={() => {
                                  setCoMakers([loan.co_maker, loan.co_maker_2, loan.co_maker_3, loan.co_maker_4, loan.co_maker_5]);
                                  setMakersModal(true);
                                }}
                              >
                                <FaEye /> View
                              </button>
                            </td>
                            <td className="loans-table-cell-actions">
                              <Link 
                                className="loans-action-button loans-schedules-link"
                                to={`/payment-schedules/${loan.control_number}`}
                              >
                                📅 SCHEDULES
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MOBILE CARDS VIEW */}
              <div className="loans-cards-wrapper">
                <div className="loans-table-header">
                  <button className="loans-back-button" onClick={() => navigate(-1)}>← Back</button>
                  <div className="loans-table-title">📊 MY LOANS</div>
                  <div className="loans-spacer-60"></div>
                </div>

                <div className="loans-cards-scroll">
                  <div className="loans-flex-cards-column">
                    {filteredLoans.map((loan) => (
                      <div key={loan.control_number} className="loans-mobile-card">

                        <div className="loans-mobile-card-header">
                          <div>
                            <div className="loans-mobile-control-label">Control #</div>
                            <div className="loans-mobile-control-value">{loan.control_number}</div>
                          </div>
                          <span className={`loans-mobile-type-badge ${loan.loan_type === 'Regular' ? 'loans-mobile-type-regular' : 'loans-mobile-type-emergency'}`}>
                            {loan.loan_type}
                          </span>
                        </div>

                        <div className="loans-mobile-details-grid">
                          <div className="loans-mobile-detail-box">
                            <div className="loans-mobile-detail-label">Account</div>
                            <div className="loans-mobile-detail-value">{loan.account || 'N/A'}</div>
                          </div>
                          <div className="loans-mobile-detail-box">
                            <div className="loans-mobile-detail-label">Member</div>
                            <div className="loans-mobile-detail-value">{loan.account_holder || 'N/A'}</div>
                          </div>
                          <div className="loans-mobile-detail-box-amount">
                            <div className="loans-mobile-detail-label">Amount</div>
                            <div className="loans-mobile-detail-value-bold">₱{formatNumber(parseFloat(loan.loan_amount || 0).toFixed(2))}</div>
                          </div>
                          <div className="loans-mobile-detail-box">
                            <div className="loans-mobile-detail-label">Term</div>
                            <div className="loans-mobile-detail-value">{`${loan.loan_period} ${loan.loan_type === 'Regular' ? 'Yrs' : 'Mo'}`}</div>
                          </div>
                          <div className="loans-mobile-detail-box-proceeds">
                            <div className="loans-mobile-detail-label">Net Proceeds</div>
                            <div className="loans-mobile-detail-value-bold">₱{formatNumber(parseFloat(loan.net_proceeds || 0).toFixed(2))}</div>
                          </div>
                          <div className={loan.status === "Paid-off" ? "loans-mobile-detail-box-status-paid" : "loans-mobile-detail-box-status-other"}>
                            <div className={loan.status === "Paid-off" ? "loans-mobile-detail-label-status-paid" : "loans-mobile-detail-label-status-other"}>Status</div>
                            <div className={
                              loan.status === "Paid-off" ? "loans-mobile-detail-status-paid" 
                              : loan.status === "Ongoing" ? "loans-mobile-detail-status-ongoing" 
                              : "loans-mobile-detail-status-pending"
                            }>
                              {loan.status}
                            </div>
                          </div>
                        </div>

                        <div className="loans-mobile-actions">
                          <button 
                            onClick={() => { 
                              setCoMakers([loan.co_maker, loan.co_maker_2, loan.co_maker_3, loan.co_maker_4, loan.co_maker_5]); 
                              setMakersModal(true); 
                            }} 
                            className="loans-mobile-view-button"
                          >
                            <FaEye /> View
                          </button>
                          <Link 
                            to={`/payment-schedules/${loan.control_number}`} 
                            className="loans-mobile-schedule-link"
                          >
                            📅 Schedule
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="loans-no-loans-container">
              <div className="loans-no-loans-back-wrapper">
                <button onClick={() => navigate(-1)} className="loans-no-loans-back-button">
                  ← Back
                </button>
              </div>
              <div className="loans-no-loans-icon">📋</div>
              <h3 className="loans-no-loans-title">No Loans Found</h3>
              <p className="loans-no-loans-message">No loans found for this account number. Contact support if you believe this is an error.</p>
            </div>
          )}
        </div>
      </div>

      {/* Co-Makers Modal */}
      {makersModal && (
        <>
          <div 
            className="loans-modal-overlay"
            onClick={() => setMakersModal(false)}
          />
          <div className="loans-modal-container">
            <button 
              onClick={() => setMakersModal(false)}
              className="loans-modal-close-button"
            >
              ×
            </button>
            
            <div className="loans-modal-header">
              <h2 className="loans-modal-title">
                Co-Makers List
              </h2>
            </div>
            
            <div>
              {coMakers.filter(maker => maker && maker.trim() !== '').length > 0 ? (
                coMakers.filter(maker => maker && maker.trim() !== '').map((maker, index) => (
                  <div 
                    key={index} 
                    className="loans-modal-comaker-item"
                  >
                    <p className="loans-modal-comaker-name">
                      {maker}
                    </p>
                  </div>
                ))
              ) : (
                <div className="loans-modal-no-comakers">
                  <div className="loans-modal-no-comakers-icon">
                    👥
                  </div>
                  <p className="loans-modal-no-comakers-text">
                    No co-makers assigned to this loan
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Loans;