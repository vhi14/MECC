import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Topbar from "./Topbar/Topbar";

const PaymentSchedule = () => {
  const { control_number } = useParams();
  const [paymentSchedules, setPaymentSchedules] = useState([]);
  const [filteredSchedules, setFilteredSchedules] = useState([]);
  const [years, setYears] = useState([]);
  const [yearFilter, setYearFilter] = useState("All");
  const [loanType, setLoanType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const navigate = useNavigate();

  const formatNumber = (number) => {
    if (number == null || isNaN(number)) return "N/A";
    return new Intl.NumberFormat("en-US").format(number);
  };

  useEffect(() => {
    const fetchPaymentSchedules = async () => {
      try {
        const accessToken = localStorage.getItem("accessToken");
        const response = await fetch(
          `http://localhost:8000/api/payment-schedules/${control_number}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch payment schedules.");
        }

        const data = await response.json();
        const unpaidSchedules = data.filter((schedule) => !schedule.is_paid);
        setPaymentSchedules(unpaidSchedules);

        // Set loan type from the first schedule (all schedules have the same loan type)
        if (unpaidSchedules.length > 0 && unpaidSchedules[0].loan_type) {
          setLoanType(unpaidSchedules[0].loan_type);
        }

        // Extract and sort unique years
        const uniqueYears = [
          "All",
          ...new Set(
            unpaidSchedules.map((schedule) =>
              new Date(schedule.due_date).getFullYear()
            )
          ),
        ];
        setYears(uniqueYears);
        setFilteredSchedules(unpaidSchedules);
        setLoading(false);
      } catch (err) {
        setError("Unable to load payment schedules.");
        setLoading(false);
      }
    };

    fetchPaymentSchedules();
  }, [control_number]);

  const handleYearChange = (selectedYear) => {
    setYearFilter(selectedYear);
    setFilteredSchedules(
      selectedYear === "All"
        ? paymentSchedules
        : paymentSchedules.filter(
            (schedule) => new Date(schedule.due_date).getFullYear() === parseInt(selectedYear)
          )
    );
  };

  // Calculate bimonthly amortization (principal + interest)
  const calculateBimonthlyAmount = (schedule) => {
    const principal = parseFloat(schedule.principal_amount) || 0;
    const interest = parseFloat(schedule.interest_portion || schedule.interest_amount) || 0;
    return principal + interest;
  };

  // Calculate statistics - Total remaining principal only (not bimonthly)
  const totalRemainingPrincipal = filteredSchedules.reduce((sum, schedule) => {
    return sum + (parseFloat(schedule.principal_amount) || 0);
  }, 0);

  const overdueSchedules = filteredSchedules.filter(schedule => {
    const dueDate = new Date(schedule.due_date);
    const today = new Date();
    return dueDate < today && !schedule.is_paid;
  });
  
  const upcomingSchedules = filteredSchedules.filter(schedule => {
    const dueDate = new Date(schedule.due_date);
    const today = new Date();
    return dueDate >= today && !schedule.is_paid;
  });

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ width: '80px', height: '80px', background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)', borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white' }}>⚠</div>
          <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>Error Loading Data</h2>
          <p style={{ color: '#7f8c8d', marginBottom: '30px', fontSize: '16px' }}>{error}</p>
          <button
            onClick={() => navigate(-1)}
            style={{ display: 'inline-block', background: 'linear-gradient(45deg, #667eea, #764ba2)', color: 'white', padding: '12px 30px', border: 'none', borderRadius: '25px', fontWeight: '600', cursor: 'pointer', transition: 'transform 0.3s ease', boxShadow: '0 5px 15px rgba(102, 126, 234, 0.3)' }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            Go Back
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
          <p style={{ color: '#0b78e6ff', fontSize: '14px' }}>Loading payment schedules...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <Topbar />
      
      {/* Hidden Scrollbar Styles */}
      <style>
        {`
          .hidden-scrollbar {
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
          }
          .hidden-scrollbar::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
          }
          .bimonthly-cell {
            cursor: pointer;
            transition: all 0.2s;
          }
          .bimonthly-cell:hover {
            background-color: #e3f2fd !important;
          }
        `}
      </style>
      
      <div style={{ padding: '40px 20px', marginTop: '170px' }}>
        <div style={{ width: '1300px', margin: '0 auto' }}>
          
          {/* Statistics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '50px', marginBottom: '40px' }}>
            <div style={{
              background: '#28a745',
              boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '10px',
              color: 'black',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '22px', fontWeight: '600', marginBottom: '5px' }}>💰 Remaining Balance</div>
              <div style={{ fontSize: '26px', fontWeight: '800' }}>₱{formatNumber(parseFloat(totalRemainingPrincipal).toFixed(2))}</div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: '15px',
                padding: '0 10px'
              }}>
                <div style={{ fontSize: '16px', color: 'white', textAlign: 'left', fontWeight: 'bold' }}>
                  Control No: {control_number}
                </div>
                <div style={{ fontSize: '16px', color: 'black', textAlign: 'right', fontWeight: 'bold' }}>
                  Loan Type: {loanType || "N/A"}
                </div>
              </div>
            </div>

            <div style={{
              background: '#ffffffff',
              boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '20px',
              color: 'black',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '22px', fontWeight: '600', marginBottom: '5px' }}>📅 No. of Payments left</div>
              <div style={{ fontSize: '32px', fontWeight: '800' }}>{upcomingSchedules.length}</div>
            </div>

            <div style={{
              background: '#dc3545',
              boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              padding: '10px',
              color: 'black',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '22px', fontWeight: '600', marginBottom: '5px' }}>⚠️ Overdue</div>
              <div style={{ fontSize: '26px', fontWeight: '800' }}>{overdueSchedules.length}</div>
              <div style={{ fontSize: '16px', marginTop: '10px', color: 'white' }}>
                Schedules Past Due
              </div>
            </div>
          </div>

          {/* Payment Schedule Table Section */}
          {filteredSchedules.length > 0 ? (
            <div style={{
              background: 'white',
              boxShadow: '0px 8px 8px rgba(59, 59, 59, 0.99)',
              borderRadius: '15px',
              overflow: 'hidden',
              maxWidth: '1200px',
              margin: '0 auto'
            }}>
              
              {/* Table Header with Back Button and Year Filter */}
              <div style={{
                background: '#000000ff',
                color: 'white',
                padding: '15px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                {/* Back Button on Left */}
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
                      left: '180px'
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

                {/* Title in Center */}
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  textAlign: 'center',
                  flex: 1,
                  marginLeft: '100px'
                }}>
                  📊 MONTHLY AMORTIZATION
                </div>

                {/* Year Filter on Right */}
                <div style={{ maxWidth: '120px', width: '100%' }}>
                  <select
                    value={yearFilter}
                    onChange={(e) => handleYearChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '12px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: '20px',
                      outline: 'none',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                    onFocus={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                      e.target.style.borderColor = 'rgba(255,255,255,0.5)';
                    }}
                    onBlur={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.target.style.borderColor = 'rgba(255,255,255,0.3)';
                    }}
                  >
                    {years.map((year) => (
                      <option key={year} value={year} style={{ color: 'black', background: 'white' }}>
                        {year === "All" ? "📅 All Years" : `📅 ${year}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table Container with Hidden Scrollbar */}
              <div 
                className="hidden-scrollbar"
                style={{
                  maxHeight: '360px',
                  overflowY: 'auto',
                  overflowX: 'auto'
                }}
              >
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  <thead style={{
                    background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                  }}>
                    <tr>
                      <th style={{ padding: '10px 8px', textAlign: 'center', color: '#000000', fontSize: '16px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase'}}>Bimonthly Amortization</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', color: '#000000', fontSize: '16px', borderBottom: '1px solid #9b9b9bff', borderRight: '1px solid #9b9b9bff', textTransform: 'uppercase'}}>Due Date</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', color: '#000000', fontSize: '16px', borderBottom: '1px solid #9b9b9bff', textTransform: 'uppercase' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchedules.map((schedule, index) => {
                      const dueDate = new Date(schedule.due_date);
                      const today = new Date();
                      const isOverdue = dueDate < today && !schedule.is_paid;
                      const bimonthlyAmount = calculateBimonthlyAmount(schedule);
                      const principal = parseFloat(schedule.principal_amount) || 0;
                      const interest = parseFloat(schedule.interest_portion || schedule.interest_amount) || 0;
                      const isExpanded = selectedSchedule?.id === schedule.id;
                      
                      return (
                        <React.Fragment key={schedule.id}>
                          <tr>
                            {/* Bimonthly Amortization (Principal + Interest) */}
                            <td 
                              className="bimonthly-cell"
                              onClick={() => setSelectedSchedule(isExpanded ? null : schedule)}
                              style={{ 
                                padding: '10px 5px', 
                                textAlign: 'center',
                                color: '#035aa0ff',
                                fontWeight: '700',
                                fontSize: '14px',
                                borderRight: '1px solid #9b9b9bff',
                                borderBottom: isExpanded ? 'none' : '1px solid #9b9b9bff',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                            >
                              ₱{formatNumber(bimonthlyAmount.toFixed(2))}
                            </td>
                            
                            {/* Due Date */}
                            <td style={{ 
                              padding: '10px 5px', 
                              textAlign: 'center',
                              color: isOverdue ? '#e74c3c' : '#000000',
                              fontWeight: isOverdue ? '700' : '600',
                              fontSize: '14px',
                              borderRight: '1px solid #9b9b9bff',
                              borderBottom: isExpanded ? 'none' : '1px solid #9b9b9bff'
                            }}>
                              {new Date(schedule.due_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'numeric',
                                day: 'numeric'
                              })}
                            </td>
                            
                            {/* Status */}
                            <td style={{ 
                              padding: '10px 5px', 
                              textAlign: 'center', 
                              borderBottom: isExpanded ? 'none' : '1px solid #9b9b9bff' 
                            }}>
                              <span style={{
                                color: schedule.is_paid ? "#27ae60" : isOverdue ? "#e74c3c" : "#fb3a3aff",
                                fontWeight: '600',
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '14px',
                                textTransform: 'uppercase'
                              }}>
                                {schedule.is_paid ? "✅ PAID" : isOverdue ? "⚠ OVERDUE" : "⏰ UPCOMING"}
                              </span>
                            </td>
                          </tr>
                          
                          {/* Breakdown Row - Shows when clicked */}
                          {isExpanded && (
                            <tr>
                              <td colSpan="3" style={{
                                padding: '15px 30px',
                              }}>
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  gap: '40px',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  animation: 'slideDown 0.3s ease-out'
                                }}>
                                  <span style={{ color: '#000000ff' }}>
                                    Principal: <strong style={{ fontSize: '16px' }}>₱{formatNumber(principal.toFixed(2))}</strong>
                                  </span>
                                  <span style={{ color: '#000000ff' }}>+</span>
                                  <span style={{ color: '#000000ff' }}>
                                    Interest: <strong style={{ fontSize: '16px' }}>₱{formatNumber(interest.toFixed(2))}</strong>
                                  </span>
                                  <span style={{ color: '#000000ff' }}>=</span>
                                  <span style={{ color: '#035aa0ff' }}>
                                    Total: <strong style={{ fontSize: '16px' }}>₱{formatNumber(bimonthlyAmount.toFixed(2))}</strong>
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'white',
              padding: '60px',
              borderRadius: '20px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '100px',
                height: '100px',
                background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                borderRadius: '50%',
                margin: '0 auto 30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px'
              }}>
                📅
              </div>
              <h3 style={{
                color: '#2c3e50',
                fontSize: '24px',
                fontWeight: '700',
                marginBottom: '15px'
              }}>
                No Payment Schedules Found
              </h3>
              <p style={{
                color: '#7f8c8d',
                fontSize: '16px',
                margin: 0
              }}>
                No payment schedules found for this loan. This may indicate the loan has been fully paid or there's an issue with the data.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Slide Down Animation */}
      <style>
        {`
          @keyframes slideDown {
            from {
              opacity: 0;
              max-height: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              max-height: 200px;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default PaymentSchedule;