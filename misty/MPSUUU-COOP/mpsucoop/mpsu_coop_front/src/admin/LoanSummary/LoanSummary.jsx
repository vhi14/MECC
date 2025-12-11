import React, { useEffect, useState } from "react";
import axios from 'axios';
import { DollarSign, FileText, AlertCircle, Receipt, Eye, Activity, Clock, UsersRound, UsersIcon, Archive, SquareActivity, X, TrendingUp, TrendingDown, Award, Building2 } from 'lucide-react';
import "./LoanSummary.css";

const LoanSummary = () => {
  const [loanSummary, setLoanSummary] = useState(null);
  const [error, setError] = useState(null);
  const [totalPenalties, setTotalPenalties] = useState(0);
  const [loans, setLoans] = useState([]);
  const [feesBreakdown, setFeesBreakdown] = useState(null);
  const [showFeesModal, setShowFeesModal] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);
  const [archivedMembers, setArchivedMembers] = useState(0);

  const [loanTypeFeesBreakdown, setLoanTypeFeesBreakdown] = useState({
    regular: {
      service_fee: 0,
      interest_amount: 0,
      admin_cost: 0,
      notarial: 0,
      cisp: 0,
      total: 0
    },
    emergency: {
      service_fee: 0,
      interest_amount: 0,
      admin_cost: 0,
      notarial: 0,
      cisp: 0,
      total: 0
    }
  });

  // chicha
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearlyData, setYearlyData] = useState(null);
  const [historicalYears, setHistoricalYears] = useState([]);
  const [showYearSelector, setShowYearSelector] = useState(false);
  // chicha ends
  // recently lang
  const [penaltyBreakdown, setPenaltyBreakdown] = useState(null);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  // recently lang ends

  const [loanAmountsByType, setLoanAmountsByType] = useState({
    regular: 0,
    emergency: 0
  });

  const BASE_URL = `${process.env.REACT_APP_API_URL}`;

  // chicha
  // Add this new useEffect to fetch current year data
  useEffect(() => {
    const fetchCurrentYearData = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/yearly-summary/current/`);
        setYearlyData(response.data);
      } catch (err) {
        console.error("Error fetching current year data:", err);
      }
    };
    
    fetchCurrentYearData();
  }, []);

  // Add this useEffect to fetch all available years
  useEffect(() => {
    const fetchHistoricalYears = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/yearly-summary/all/`);
        // Extract years from the response
        if (response.data.available_years) {
          setHistoricalYears(response.data.available_years);
        } else if (Array.isArray(response.data)) {
          setHistoricalYears(response.data.map(s => s.year));
        }
      } catch (err) {
        console.error("Error fetching historical years:", err);
      }
    };
    
    fetchHistoricalYears();
  }, []);
// recently lang
  useEffect(() => {
    const fetchPenaltyData = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/penalties/yearly/${selectedYear}/`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`
            }
          }
        );
        setPenaltyBreakdown(response.data);
      } catch (err) {
        console.error("Error fetching penalty data:", err);
      }
    };
    
    if (selectedYear) {
      fetchPenaltyData();
    }
  }, [selectedYear]);
// recently lang ends
  const handleYearChange = async (year) => {
  setSelectedYear(year);
  setShowYearSelector(false);
  
  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/yearly-summary/${year}/`);
    setYearlyData(response.data);
  } catch (err) {
    console.error(`Error fetching data for year ${year}:`, err);
  }
};
// chicha ends

  useEffect(() => {
    const fetchActiveMembers = async () => {
      try {
        const [membersRes, archivesRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/members/`),
          axios.get(`${process.env.REACT_APP_API_URL}/archives/?archive_type=Member`),
        ]);

        const archivedMemberIds = new Set(
          archivesRes.data.map(archive => archive.archived_data.member_id || archive.archived_data.memId)
        );

        const activeMembers = membersRes.data.filter(
          member => !archivedMemberIds.has(member.member_id || member.memId)
        );

        setTotalMembers(activeMembers.length);
        setArchivedMembers(archivesRes.data.length);
      } catch (err) {
        console.error("Error fetching active members:", err);
      }
    };

    fetchActiveMembers();
  }, []);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/total-penalties/`)
      .then(res => {
        setTotalPenalties(res.data.total_penalty);
      })
      .catch(err => {
        console.error("Error fetching total penalties:", err);
      });
  }, []);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/total-fees-breakdown/`)
      .then(res => {
        setFeesBreakdown(res.data);
      })
      .catch(err => {
        console.error("Error fetching fees breakdown:", err);
      });
  }, []);

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const token = sessionStorage.getItem('authToken') || 
                     sessionStorage.getItem('token') || 
                     sessionStorage.getItem('access_token') ||
                     sessionStorage.getItem('accessToken');
        
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const response = await axios.get(`${BASE_URL}/loans/`, { headers });
        const loansData = Array.isArray(response.data) ? response.data : [];
        setLoans(loansData);
      } catch (err) {
        console.error('Error fetching loans:', err);
        setLoans([]);
      }
    };
    
    fetchLoans();
  }, []);

  const formatNumber = (num) => {
    if (num == null) return "0.00";
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  useEffect(() => {
    const fetchLoanSummary = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/loan-summary/`);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        setLoanSummary(data);
      } catch (err) {
        console.error("Error fetching loan summary data:", err);
        setError(err.message);
      }
    };

    fetchLoanSummary();
  }, []);

  const calculateRegularFees = () => {
    const regularLoans = loans.filter(loan => loan.loan_type === 'Regular');
    
    const breakdown = {
      service_fee: regularLoans.reduce((sum, loan) => sum + parseFloat(loan.service_fee || 0), 0),
      interest_amount: regularLoans.reduce((sum, loan) => sum + parseFloat(loan.interest_amount || 0), 0),
      admin_cost: regularLoans.reduce((sum, loan) => sum + parseFloat(loan.admincost || 0), 0),
      notarial: regularLoans.reduce((sum, loan) => sum + parseFloat(loan.notarial || 0), 0),
      cisp: regularLoans.reduce((sum, loan) => sum + parseFloat(loan.cisp || 0), 0)
    };

    const total_fees = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    return { breakdown, total_fees };
  };

  const calculateEmergencyFees = () => {
    const emergencyLoans = loans.filter(loan => loan.loan_type === 'Emergency');
    
    const breakdown = {
      service_fee: emergencyLoans.reduce((sum, loan) => sum + parseFloat(loan.service_fee || 0), 0),
      interest_amount: emergencyLoans.reduce((sum, loan) => sum + parseFloat(loan.interest_amount || 0), 0),
      admin_cost: emergencyLoans.reduce((sum, loan) => sum + parseFloat(loan.admincost || 0), 0),
      notarial: emergencyLoans.reduce((sum, loan) => sum + parseFloat(loan.notarial || 0), 0),
      cisp: emergencyLoans.reduce((sum, loan) => sum + parseFloat(loan.cisp || 0), 0)
    };

    const total_fees = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    return { breakdown, total_fees };
  };

  useEffect(() => {
    if (loans.length > 0) {
      const regularFees = calculateRegularFees();
      const emergencyFees = calculateEmergencyFees();
      
      const regularLoans = loans.filter(loan => loan.loan_type === 'Regular');
      const emergencyLoans = loans.filter(loan => loan.loan_type === 'Emergency');
      
      const regularTotal = regularLoans.reduce((sum, loan) => sum + parseFloat(loan.loan_amount || 0), 0);
      const emergencyTotal = emergencyLoans.reduce((sum, loan) => sum + parseFloat(loan.loan_amount || 0), 0);
      
      setLoanTypeFeesBreakdown({
        regular: {
          ...regularFees.breakdown,
          total: regularFees.total_fees
        },
        emergency: {
          ...emergencyFees.breakdown,
          total: emergencyFees.total_fees
        }
      });
      
      setLoanAmountsByType({
        regular: regularTotal,
        emergency: emergencyTotal
      });
    }
  }, [loans]);

  if (error) {
    return (
      <div className="loan-summary-error">
        <AlertCircle size={48} />
        <div style={{fontSize: '18px', fontWeight: '600'}}>Failed to load dashboard</div>
        <div style={{fontSize: '14px', opacity: 0.7}}>{error}</div>
      </div>
    );
  }

  if (!loanSummary || !feesBreakdown) {
    return (
      <div className="loan-summary-loading">
        <div className="loader"></div>
        <div className="loading-text">Loading Dashboard Data...</div>
      </div>
    );
  }

  return (
    <>
      <div className="loan-summary-container">
        {/* Members Card */}
        <div className="loan-card">
          <div className="card-header">
            <div className="card-icon">
              <UsersIcon size={24} strokeWidth={2.5}/>
            </div>
          </div>
          <h3 className="loan-type">Members</h3>
          <p className="loan-amount">{totalMembers.toLocaleString()}</p>
          <span className="loan-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
            <Archive size={18} style={{ color: '#ff0000ff' }} /> Archived: {archivedMembers}
          </span>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>

        {/* Borrowers Card */}
        <div className="loan-card">
          <div className="card-header">
            <div className="card-icon">
              <UsersRound size={24} strokeWidth={2.5} />
            </div>
          </div>
          <h3 className="loan-type">Borrowers</h3>
          <p className="loan-amount">
            {(loanSummary.borrowers.active + loanSummary.borrowers.paidOff).toLocaleString()}
          </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span className="loan-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', flex: 1 }}>
                <TrendingUp size={18} style={{ color: '#16ad4dff'}}/>
                Active: {loanSummary.borrowers.active}
              </span>
              <span className="loan-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', flex: 1, marginRight: '-40px'}}>
                <Award size={18} style={{ color: '#16ad4dff'}}/>
                Settled: {loanSummary.borrowers.paidOff} 
              </span>
            </div>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>

        {/* Total Loans Card */}
        <div className="loan-card">
          <div className="card-header">
            <div className="card-icon">
              <FileText size={24} strokeWidth={2.5} style={{ color: '#066629ff' }}/>
            </div>
          </div>
          <h3 className="loan-type">Loans</h3>
          <p className="loan-amount">
            {(loanSummary.loans.ongoing + loanSummary.loans.completed).toLocaleString()}
          </p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span className="loan-label" style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '14px', flex: 1 }}>
              <Clock size={18} style={{ color: '#ff0000ff', marginRight: '5px' }}/>
              Ongoing: {loanSummary.loans.ongoing} 
            </span>
            <span className="loan-label" style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '14px', flex: 1, marginRight: '-10px'}}>
              <Award size={18} style={{ color: '#16ad4dff', marginRight: '5px' }}/>
              Completed: {loanSummary.loans.completed} 
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>

        {/* Total Loan Released Card */}
        <div className="loan-card">
          <div className="card-header">
            <div className="card-icon">
              <DollarSign size={24} strokeWidth={2.5} style={{ color: '#03b80fff' }}/>
            </div>
          </div>
          <h3 className="loan-type">NET GROSS Released</h3>
          <p className="loan-amount">₱ {formatNumber(loanSummary.netTotalLoan.returned)}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="loan-label" style={{ display: 'flex', alignItems: 'center', gap: '1px', fontSize: '13px', flex: 1, marginLeft: '-6px' }}>
              <span style={{ color: '#16ad4d', fontWeight: '700' }}>Regular:</span>
              <span style={{ color: '#000' }}>{formatNumber(loanAmountsByType.regular)}</span>
            </span>

            <span className="loan-label" style={{ display: 'flex', alignItems: 'center', gap: '1px', fontSize: '13px', flex: 1, marginRight: '40px'}}>
              <span style={{ color: 'rgba(255, 0, 0, 1)', fontWeight: '700', marginRight: '1px' }}>Emergency:</span>
              <span style={{ color: '#000' }}>{formatNumber(loanAmountsByType.emergency)}</span>
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>

        {/* recently lang */}
<div 
  className="loan-card" 
  onClick={() => setShowPenaltyModal(true)}
  style={{ marginTop: '50px', cursor: 'pointer' }}
>
  <div className="card-header">
    <div className="card-icon">
      <AlertCircle size={24} strokeWidth={2.5} style={{ color: '#ff0000ff' }}/>
    </div>
  </div>
  <h3 className="loan-type">Total Penalties ({selectedYear})</h3>
  <p className="loan-amount">
    ₱ {formatNumber(penaltyBreakdown?.total_penalties || totalPenalties)}
  </p>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span className="loan-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
      <TrendingDown size={18} style={{ color: 'rgba(255, 0, 0, 1)' }}/>
      From late payments
    </span>
    <span className="loan-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
    <Eye size={18} style={{ color: '#086ed3ff' }}/>
    Click for details
  </span>
  </div>
  <div className="progress-bar">
    <div className="progress-fill"></div>
  </div>
</div>

     {showPenaltyModal && penaltyBreakdown && (
  <>
    <div 
      onClick={() => setShowPenaltyModal(false)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 999
      }}
    />
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '30px',
      maxWidth: '500px',
      width: '90%',
      zIndex: 1000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '25px',
        paddingBottom: '15px',
        borderBottom: '2px solid #ff0000'
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
          Penalty Collections {selectedYear}
        </h2>
        <button
          onClick={() => setShowPenaltyModal(false)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '32px',
            cursor: 'pointer',
            color: '#ff0000'
          }}
        >
          ×
        </button>
      </div>

      {/* Summary */}
      <div style={{
        background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        color: 'white'
      }}>
        <div style={{ fontSize: '14px', opacity: 0.9 }}>
          Total Penalties Collected
        </div>
        <div style={{ fontSize: '32px', fontWeight: '700' }}>
          ₱ {formatNumber(penaltyBreakdown.total_penalties)}
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{
          padding: '15px',
          background: '#f8f9fa',
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          border: '1px solid #e5e7eb'
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
              Auto-Collected (Borrowers)
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Deducted from share capital
            </div>
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#ff6b6b' }}>
            ₱ {formatNumber(penaltyBreakdown.breakdown.auto_borrower)}
          </div>
        </div>

        <div style={{
          padding: '15px',
          background: '#f8f9fa',
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          border: '1px solid #e5e7eb'
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
              Auto-Collected (Comakers)
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              From comaker accounts
            </div>
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#ff6b6b' }}>
            ₱ {formatNumber(penaltyBreakdown.breakdown.auto_comaker)}
          </div>
        </div>

        <div style={{
          padding: '15px',
          background: '#f8f9fa',
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          border: '1px solid #e5e7eb'
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
              Manual Payments
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Paid with schedule
            </div>
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#ff6b6b' }}>
            ₱ {formatNumber(penaltyBreakdown.breakdown.manual)}
          </div>
        </div>
      </div>
    </div>
  </>
)}

        {/* Total Fees Card */}
        <div className="loan-card" onClick={() => setShowFeesModal(true)} style={{ marginTop: '50px'}}>
          <div className="card-header">
    <div className="card-icon">
      <Receipt size={24} strokeWidth={2.5} style={{ color: '#118718ff' }}/>
    </div>
  </div>
  <h3 className="loan-type">Total Fees Collected ({selectedYear})</h3>
  <p className="loan-amount">
    ₱ {formatNumber(yearlyData?.total_fees_collected || feesBreakdown.total_fees)}
  </p>
  <span className="loan-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
    <Eye size={18} style={{ color: '#086ed3ff' }}/>
    Click to view breakdown
  </span>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showFeesModal && (
        <>
          <div 
            onClick={() => setShowFeesModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(5px)',
              zIndex: 999,
              animation: 'fadeIn 0.2s ease'
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            maxWidth: '600px',
            width: '90%',
            zIndex: 1000,
            boxShadow: 'rgba(0, 0, 0, 0.15) 0px 8px 24px, rgba(0, 0, 0, 0.05) 0px 2px 6px, rgba(0, 0, 0, 0.07) 0px 0px 1px',
            animation: 'fadeIn 0.3s ease',
            border: '1px solid #e5e7eb',
          }}>
            
            {/* Modal Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '15px',
              borderBottom: '1px solid #ff0000ff',
              paddingBottom: '10px'
            }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: '24px',
                fontWeight: '600',
                color: '#000000ff'
              }}>Fees Breakdown</h2>
              <button
                onClick={() => setShowFeesModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '32px',
                  cursor: 'pointer',
                  color: '#ff0000ff',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'right',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease'
                }}
              >
                ×
              </button>
            </div>

            {/* Two Column Layout */}
            <div style={{ display: 'flex', gap: '20px' }}>
              
              {/* Regular Loan Column */}
              <div style={{ flex: 1 }}>
                <div style={{
                  color: '#009f03ff',
                  padding: '10px 15px',
                  borderRadius: '12px',
                  marginBottom: '15px',
                  fontWeight: '600',
                  fontSize: '18px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  border: '1px solid #93c5fd'
                }}>
                  <SquareActivity size={20} />
                  Regular Loan Fees
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(loanTypeFeesBreakdown.regular).map(([key, value]) => (
                    key !== 'total' && (
                      <div 
                        key={key}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 15px',
                          background: '#f1f1f1ff',
                          borderRadius: '10px',
                          border: '1px solid #e5e7eb',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <span style={{ 
                          color: '#000000ff', 
                          fontSize: '14px', 
                          fontWeight: '600',
                          textTransform: 'capitalize'
                        }}>
                          {key.split('_').join(' ')}
                        </span>
                        <strong style={{ 
                          color: '#000000ff', 
                          fontSize: '13px',
                          fontWeight: '600'
                        }}>
                          ₱ {formatNumber(value)}
                        </strong>
                      </div>
                    )
                  ))}
                  
                  {/* Regular Total */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '12px',
                    background: '#006c28ff',
                    color: 'white',
                    borderRadius: '8px',
                    marginTop: '10px',
                    fontSize: '16px'
                  }}>
                    <strong>TOTAL FEES:</strong>
                    <strong>₱ {formatNumber(loanTypeFeesBreakdown.regular.total)}</strong>
                  </div>
                </div>
              </div>

              

              {/* Emergency Loan Column */}
              <div style={{ flex: 1 }}>
                <div style={{
                  color: '#ff0000ff',
                  padding: '10px 15px',
                  borderRadius: '12px',
                  marginBottom: '15px',
                  fontWeight: '600',
                  fontSize: '18px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  border: '1px solid #fca5a5'
                }}>
                  <SquareActivity size={20} />
                  Emergency Loan Fees
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(loanTypeFeesBreakdown.emergency).map(([key, value]) => (
                    key !== 'total' && (
                      <div 
                        key={key}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 15px',
                          background: '#f1f1f1ff',
                          borderRadius: '10px',
                          border: '1px solid #e5e7eb',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <span style={{ 
                          color: '#000000ff', 
                          fontSize: '14px', 
                          fontWeight: '600',
                          textTransform: 'capitalize'
                        }}>
                          {key.split('_').join(' ')}
                        </span>
                        <strong style={{ 
                          color: '#000000ff', 
                          fontSize: '13px',
                          fontWeight: '600'
                        }}>
                          ₱ {formatNumber(value)}
                        </strong>
                      </div>
                    )
                  ))}
                  
                  {/* Emergency Total */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '12px',
                    background: '#ff0000ff',
                    color: 'white',
                    borderRadius: '8px',
                    marginTop: '10px',
                    fontSize: '16px'
                  }}>
                    <strong>TOTAL FEES:</strong>
                    <strong>₱ {formatNumber(loanTypeFeesBreakdown.emergency.total)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default LoanSummary;