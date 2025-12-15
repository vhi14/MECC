import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Topbar from "../Topbar/Topbar";
import { FaEye } from "react-icons/fa";

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div className="error-container" style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '500px' }}>
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid #667eea', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
          <p style={{ color: '#0b78e6ff', fontSize: '14px' }}>Loading loans...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
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
          /* ===== CRITICAL: SHOW/HIDE LOGIC ===== */
          .loans-table-wrapper {
            display: none !important;
          }
          .loans-cards-wrapper {
            display: block !important;
          }

          @media (min-width: 769px) {
            .loans-table-wrapper {
              display: block !important;
            }
            .loans-cards-wrapper {
              display: none !important;
            }
          }

          /* ===== RESPONSIVE BREAKPOINTS ===== */

          /* Extra Small Phones (320px - 480px) */
          @media (max-width: 480px) {
            .loans-main-content {
              padding: 15px 10px !important;
              margin-top: 130px !important;
            }
            .loans-content-container {
              width: 100% !important;
              max-width: 100% !important;
            }
            .loans-stats-grid {
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 8px !important;
              margin-bottom: 40px !important;
            }
            .loans-stat-card {
              padding: 6px !important;
            }
            .loans-stat-title {
              font-size: 13px !important;
            }
            .loans-stat-value {
              font-size: 13px !important;
            }
            .loans-stat-subtitle {
              font-size: 12px !important;
              margin-top: 3px !important;
            }
          }

          /* Small Phones (481px - 600px) */
          @media (min-width: 481px) and (max-width: 600px) {
            .loans-main-content {
              padding: 18px 12px !important;
              margin-top: 90px !important;
            }
            .loans-content-container {
              width: 100% !important;
              max-width: 100% !important;
            }
            .loans-stats-grid {
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 12px !important;
              margin-bottom: 18px !important;
            }
            .loans-stat-card {
              padding: 10px !important;
            }
            .loans-stat-title {
              font-size: 13px !important;
            }
            .loans-stat-value {
              font-size: 18px !important;
            }
            .loans-stat-subtitle {
              font-size: 11px !important;
            }
          }

          /* Tablets & Large Phones (601px - 768px) */
          @media (min-width: 601px) and (max-width: 768px) {
            .loans-main-content {
              padding: 25px 15px !important;
              margin-top: 110px !important;
            }
            .loans-content-container {
              width: 100% !important;
              max-width: 100% !important;
            }
            .loans-stats-grid {
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 15px !important;
              margin-bottom: 20px !important;
            }
            .loans-stat-card {
              padding: 12px !important;
            }
            .loans-stat-title {
              font-size: 15px !important;
            }
            .loans-stat-value {
              font-size: 22px !important;
            }
            .loans-stat-subtitle {
              font-size: 12px !important;
            }
            .loans-table-header {
              padding: 15px !important;
              font-size: 18px !important;
            }
            .loans-table-title {
              font-size: 22px !important;
            }
            .loans-cards-scroll {
              max-height: 500px !important;
            }
          }

          /* Desktops (769px - 1024px) */
          @media (min-width: 769px) and (max-width: 1024px) {
            .loans-main-content {
              padding: 30px 20px !important;
              margin-top: 120px !important;
            }
            .loans-content-container {
              width: 95% !important;
              max-width: 95% !important;
            }
            .loans-stats-grid {
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 30px !important;
              margin-bottom: 25px !important;
            }
            .loans-stat-card {
              padding: 15px !important;
            }
            .loans-stat-title {
              font-size: 16px !important;
            }
            .loans-stat-value {
              font-size: 24px !important;
            }
            .loans-stat-subtitle {
              font-size: 13px !important;
            }
            .loans-table-wrapper {
              margin-top: 30px !important;
            }
            .loans-table-scroll {
              max-height: 420px !important;
            }
          }

          /* Medium Desktops (1025px - 1366px) */
          @media (min-width: 1025px) and (max-width: 1366px) {
            .loans-content-container {
              width: 1200px !important;
            }
            .loans-back-button {
              left: 50px !important;
            }
          }

          /* Large Desktops (1367px+) */
          @media (min-width: 1367px) {
            .loans-main-content {
              padding: 40px 20px !important;
              margin-top: 170px !important;
            }
            .loans-content-container {
              width: 1380px !important;
              margin: 0 auto !important;
            }
            .loans-stats-grid {
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 50px !important;
              margin-bottom: 20px !important;
            }
            .loans-back-button {
              left: 80px !important;
            }
          }

          /* Landscape Orientation Fix */
          @media (max-height: 500px) and (orientation: landscape) {
            .loans-main-content {
              margin-top: 70px !important;
              padding: 10px !important;
            }
            .loans-stats-grid {
              gap: 10px !important;
              margin-bottom: 10px !important;
            }
            .loans-cards-scroll {
              max-height: 250px !important;
            }
            .loans-table-scroll {
              max-height: 250px !important;
            }
          }

          /* Touch Device Optimization */
          @media (hover: none) and (pointer: coarse) {
            .loans-action-button,
            .loans-back-button {
              min-height: 44px !important;
              min-width: 44px !important;
            }
          }
        `}
      </style>
      
      <div className="loans-main-content" style={{ padding: '40px 20px', marginTop: '170px' }}>
        <div className="loans-content-container" style={{ width: '1380px', margin: '0 auto' }}>
          
          {/* Statistics Cards */}
          <div className="loans-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '50px', marginBottom: '20px' }}>
            <div className="loans-stat-card" style={{ background: '#28a745', boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)', borderRadius: '15px', padding: '10px', color: 'black', textAlign: 'center' }}>
              <div className="loans-stat-title" style={{ fontSize: '22px', fontWeight: '600', marginBottom: '5px' }}>💰 Regular Loans</div>
              <div className="loans-stat-value" style={{ fontSize: '26px', fontWeight: '800' }}>₱{formatNumber(parseFloat(totalRegularAmount).toFixed(2))}</div>
              <div className="loans-stat-subtitle" style={{ fontSize: '16px', marginTop: '10px', color: 'white' }}>Loan: {regularLoans.length}</div>
            </div>

            <div className="loans-stat-card" style={{ background: '#dededeff', boxShadow: '0px 8px 5px rgba(59, 59, 59, 0.99)', borderRadius: '15px', padding: '20px', color: 'black', textAlign: 'center' }}>
              <div className="loans-stat-title" style={{ fontSize: '22px', fontWeight: '600', marginBottom: '5px' }}>📋 Total Loans</div>
              <div className="loans-stat-value" style={{ fontSize: '32px', fontWeight: '800' }}>{loans.length}</div>
            </div>

            <div className="loans-stat-card" style={{ background: '#dc3545', boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)', borderRadius: '15px', padding: '10px', color: 'black', textAlign: 'center' }}>
              <div className="loans-stat-title" style={{ fontSize: '22px', fontWeight: '600', marginBottom: '5px' }}>🚨 Emergency Loans</div>
              <div className="loans-stat-value" style={{ fontSize: '26px', fontWeight: '800' }}>₱{formatNumber(parseFloat(totalEmergencyAmount).toFixed(2))}</div>
              <div className="loans-stat-subtitle" style={{ fontSize: '16px', marginTop: '10px', color: 'white' }}>Loan: {emergencyLoans.length}</div>
            </div>
          </div>

          {/* Loans Table Section - DESKTOP */}
          {filteredLoans.length > 0 ? (
            <>
              {/* DESKTOP TABLE VIEW */}
              <div className="loans-table-wrapper" style={{ background: 'white', boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)', borderRadius: '15px', overflow: 'hidden', marginTop: '30px' }}>
                
                {/* Table Header with Back Button */}
                <div className="loans-table-header" style={{ background: '#000000ff', color: 'white', padding: '15px', fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
                  <button
                    className="loans-back-button"
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
                      left: '80px'
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

                  <div className="loans-table-title" style={{ flex: 1, textAlign: 'center', fontSize: '26px', fontWeight: '800' }}>
                    📊 MY LOANS
                  </div>

                  <div style={{ width: '80px' }}></div>
                </div>

                {/* Table Container */}
                <div className="loans-table-scroll" style={{ maxHeight: '420px', overflowY: 'auto', overflowX: 'hidden' }}>
                  <table className="loans-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontWeight: '600', tableLayout: 'fixed', maxWidth: '96.5%', marginLeft: '20px' }}>
                    <thead style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', position: 'sticky', top: 0, zIndex: 10,  }}>
                      <tr>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: '#000000', fontSize: '12px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Control Number</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: '#000000', fontSize: '12px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Account Number</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: '#000000', fontSize: '12px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Member</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: '#000000', fontSize: '12px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Loan Type</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: '#000000', fontSize: '12px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Loan Amount</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: '#000000', fontSize: '12px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Loan Term</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: '#000000', fontSize: '12px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Net Loan Proceeds</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: '#000000', fontSize: '12px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Loan Purpose</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: '#000000', fontSize: '12px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: '#000000', fontSize: '12px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Co-Makers</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: '#000000', fontSize: '12px', borderBottom: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Actions</th>
                      </tr>
                    </thead>
                    
                    <tbody>
                      {filteredLoans.map((loan, index) => {
                        const isTarget = loan.control_number === targetControl;
                        const isEvenRow = index % 2 === 0;
                        
                        return (
                          <tr
                            key={loan.control_number}
                            style={{
                              transition: 'all 0.3s ease',
                            }}
                          >
                            <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              {loan.control_number}
                            </td>
                            <td style={{ padding: '10px 8px', color: '#000000', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              {loan.account || "N/A"}
                            </td>
                            <td style={{ padding: '10px 8px', color: '#000000', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              {loan.account_holder || "N/A"}
                            </td>
                            <td style={{ padding: '10px 8px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              <span style={{
                                background: loan.loan_type === 'Regular' 
                                  ? '#28a745' 
                                  : '#dc3545',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                textTransform: 'uppercase'
                              }}>
                                {loan.loan_type}
                              </span>
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'left', color: '#000000ff', fontWeight: '700', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              ₱{formatNumber(parseFloat(loan.loan_amount || 0).toFixed(2))}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'left', color: '#000000', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              {`${loan.loan_period} ${loan.loan_type === 'Regular' ? 'Yrs' : 'Months'}`}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'left', color: '#000000ff', fontWeight: '700', fontSize: '13px', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              ₱{formatNumber(parseFloat(loan.net_proceeds || 0).toFixed(2))}
                            </td>
                            <td style={{ padding: '10px 8px', color: '#000000', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              {loan.purpose}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              <span style={{
                                color: loan.status === "Paid-off" ? "#00d716ff" 
                                     : loan.status === "Ongoing" ? "#ff1900ff" 
                                     : loan.status === "Pending" ? "#f39c12" 
                                     : loan.status === "Cancelled" ? "#95a5a6" 
                                     : "#000000ff",
                                fontWeight: '600',
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                textTransform: 'uppercase'
                              }}>
                                {loan.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #9b9b9bff', borderBottom: '1px solid #9b9b9bff' }}>
                              <button 
                                className="loans-action-button"
                                onClick={() => {
                                  setCoMakers([loan.co_maker, loan.co_maker_2, loan.co_maker_3, loan.co_maker_4, loan.co_maker_5]);
                                  setMakersModal(true);
                                }}
                                style={{
                                  background: '#0080ffff',
                                  color: 'black',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '15px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  cursor: 'pointer',
                                  transition: 'transform 0.3s ease',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                              >
                                <FaEye /> View
                              </button>
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid #9b9b9bff' }}>
                              <Link 
                                className="loans-action-button"
                                to={`/payment-schedules/${loan.control_number}`}
                                style={{
                                  background: '#0080ffff',
                                  color: 'black',
                                  textDecoration: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '15px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  transition: 'transform 0.3s ease',
                                  display: 'inline-block'
                                }}
                                onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
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
              <div className="loans-cards-wrapper" style={{ marginTop: '10px' }}>
                <div className="loans-table-header" style={{ background: 'black', color: 'white', padding: '5px', fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 'auto', borderRadius: '15px 15px 0 0', boxShadow: '0px 8px 20px rgba(0,0,0,0.15)' }}>
                  <button className="loans-back-button" onClick={() => navigate(-1)} style={{ background: '#888', color: 'black',  padding: '1px 5px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', maxWidth: '60px', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', backdropFilter: 'blur(10px)' }} onMouseOver={(e) => { e.target.style.transform = 'translateY(-3px)'; e.target.style.background = 'rgba(255,255,255,0.3)'; }} onMouseOut={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.background = 'rgba(255,255,255,0.2)'; }}>← Back</button>
                  <div className="loans-table-title" style={{ flex: 1, textAlign: 'center', fontSize: '18px', fontWeight: '800', color: 'white' }}>📊 MY LOANS</div>
                  <div style={{ width: '60px' }}></div>
                </div>

                <div className="loans-cards-scroll" style={{ maxHeight: '650px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '10px', borderRadius: '0 0 15px 15px', padding: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {filteredLoans.map((loan) => (
                      <div key={loan.control_number} style={{ background: '#888', height: '100%', maxWidth: '500px', marginLeft: '-20px', marginRight: '-20px', marginTop: '-25px', borderRadius: '10px', padding: '10px', transition: 'all 0.4s ease', border: '1.5px solid #e8eef5', position: 'relative', overflow: 'hidden' }} onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0px 15px 40px rgba(59, 59, 59, 0.2)'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = '#667eea'; }} onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0px 6px 20px rgba(59, 59, 59, 0.12)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e8eef5'; }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', paddingBottom: '10px' }}>
                          <div>
                            <div style={{ fontSize: '12px', color: '#000000ff', fontWeight: '700', textTransform: 'uppercase', marginBottom: '5px' }}>Control #</div>
                            <div style={{ fontSize: '18px', color: '#000000ff', fontWeight: '900' }}>{loan.control_number}</div>
                          </div>
                          <span style={{ background: `linear-gradient(135deg, ${loan.loan_type === 'Regular' ? '#28a745' : '#dc3545'}, ${loan.loan_type === 'Regular' ? '#20c997' : '#fd7e14'})`, color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', boxShadow: `0px 4px 12px ${loan.loan_type === 'Regular' ? 'rgba(40, 167, 69, 0.3)' : 'rgba(220, 53, 69, 0.3)'}` }}>{loan.loan_type}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '15px', paddingBottom: '15px', borderBottom: '1.5px solid #4f4f4fff' }}>
                          <div style={{ padding: '10px', background: '#f8f9ff', borderRadius: '10px' }}>
                            <div style={{ fontSize: '12px', color: '#000000ff', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Account</div>
                            <div style={{ fontSize: '13px', color: '#000000ff', fontWeight: '700' }}>{loan.account || 'N/A'}</div>
                          </div>
                          <div style={{ padding: '10px', background: '#f8f9ff', borderRadius: '10px' }}>
                            <div style={{ fontSize: '12px', color: '#000000ff', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Member</div>
                            <div style={{ fontSize: '13px', color: '#000000ff', fontWeight: '700' }}>{loan.account_holder || 'N/A'}</div>
                          </div>
                          <div style={{ padding: '10px', background: 'linear-gradient(135deg, #fff5e6 0%, #fff9f0 100%)', borderRadius: '10px' }}>
                            <div style={{ fontSize: '12px', color: '#000000ff', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Amount</div>
                            <div style={{ fontSize: '13px', color: '#000000ff', fontWeight: '900' }}>₱{formatNumber(parseFloat(loan.loan_amount || 0).toFixed(2))}</div>
                          </div>
                          <div style={{ padding: '10px', background: '#f8f9ff', borderRadius: '10px' }}>
                            <div style={{ fontSize: '12px', color: '#000000ff', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Term</div>
                            <div style={{ fontSize: '13px', color: '#000000ff', fontWeight: '700' }}>{`${loan.loan_period} ${loan.loan_type === 'Regular' ? 'Yrs' : 'Mo'}`}</div>
                          </div>
                          <div style={{ padding: '10px', background: 'linear-gradient(135deg, #e6f9ff 0%, #f0f8ff 100%)', borderRadius: '10px' }}>
                            <div style={{ fontSize: '12px', color: '#000000ff', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Net Proceeds</div>
                            <div style={{ fontSize: '13px', color: '#000000ff', fontWeight: '900' }}>₱{formatNumber(parseFloat(loan.net_proceeds || 0).toFixed(2))}</div>
                          </div>
                          <div style={{ padding: '10px', background: loan.status === "Paid-off" ? 'linear-gradient(135deg, #e6f9ed 0%, #f0fef5 100%)' : 'linear-gradient(135deg, #fff5e6 0%, #fff9f0 100%)', borderRadius: '10px' }}>
                            <div style={{ fontSize: '12px', color: loan.status === "Paid-off" ? '#00a152' : '#000000ff', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                            <div style={{ color: loan.status === "Paid-off" ? "#00d716ff" : loan.status === "Ongoing" ? "#ff1900ff" : "#f39c12", fontWeight: '800', fontSize: '11px' }}>{loan.status}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '70px', justifyContent: 'flex-end' }}>
                          <button onClick={() => { setCoMakers([loan.co_maker, loan.co_maker_2, loan.co_maker_3, loan.co_maker_4, loan.co_maker_5]); setMakersModal(true); }} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'black', border: 'none', padding: '5px 10px', maxWidth: '90px', marginLeft: '-10px', borderRadius: '18px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s ease', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0px 4px 12px rgba(102, 126, 234, 0.3)' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0px 6px 20px rgba(102, 126, 234, 0.4)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0px 4px 12px rgba(102, 126, 234, 0.3)'; }}><FaEye /> View</button>
                          <Link to={`/payment-schedules/${loan.control_number}`} style={{ background: 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)', color: 'black', textDecoration: 'none', padding: '8px 10px', borderRadius: '18px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', transition: 'all 0.3s ease', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0px 4px 12px rgba(0, 180, 219, 0.3)' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0px 6px 20px rgba(0, 180, 219, 0.4)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0px 4px 12px rgba(0, 180, 219, 0.3)'; }}>📅 Schedule</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ background: 'white', padding: '60px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center', marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '30px' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'rgba(94, 94, 94, 1)', color: 'white', border: '2px solid rgba(255,255,255,0.3)', padding: '10px 15px', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseOver={(e) => e.target.style.transform = 'translateY(-3px)'} onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}>← Back</button>
              </div>
              <div style={{ width: '100px', height: '100px', background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', borderRadius: '50%', margin: '0 auto 30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>📋</div>
              <h3 style={{ color: '#2c3e50', fontSize: '24px', fontWeight: '700', marginBottom: '15px' }}>No Loans Found</h3>
              <p style={{ color: '#7f8c8d', fontSize: '16px', margin: 0 }}>No loans found for this account number. Contact support if you believe this is an error.</p>
            </div>
          )}
        </div>
      </div>

      {/* Co-Makers Modal */}
      {makersModal && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => setMakersModal(false)}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <button 
              onClick={() => setMakersModal(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'transparent',
                border: 'none',
                fontSize: '28px',
                cursor: 'pointer',
                color: '#666',
                width: '35px',
                height: '35px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
                e.currentTarget.style.color = '#000';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#666';
              }}
            >
              ×
            </button>
            
            <div style={{
              marginBottom: '25px',
              paddingBottom: '15px',
              borderBottom: '2px solid #e0e0e0'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: '700',
                color: '#2c3e50'
              }}>
                Co-Makers List
              </h2>
            </div>
            
            <div>
              {coMakers.filter(maker => maker && maker.trim() !== '').length > 0 ? (
                coMakers.filter(maker => maker && maker.trim() !== '').map((maker, index) => (
                  <div 
                    key={index} 
                    style={{
                      backgroundColor: '#f8f9fa',
                      padding: '15px 20px',
                      marginBottom: '10px',
                      borderRadius: '10px',
                      border: '1px solid #e0e0e0',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#e9ecef';
                      e.currentTarget.style.transform = 'translateX(5px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <p style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#2c3e50'
                    }}>
                      {maker}
                    </p>
                  </div>
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#7f8c8d'
                }}>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '15px'
                  }}>
                    👥
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600'
                  }}>
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