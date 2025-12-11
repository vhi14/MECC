import React, { useState, useEffect } from 'react';

import axios from 'axios';
import './Archive.css';
import { BsFillPrinterFill } from "react-icons/bs";
import { FaEye, FaCog, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";

const ArchivedRecords = () => {
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [archivedLoans, setArchivedLoans] = useState([]);
  const [archivedAccounts, setArchivedAccounts] = useState([]);
  const [archivedPayments, setArchivedPayments] = useState([]);
  const [regularPayments, setRegularPayments] = useState([]);
  const [schedulePayments, setSchedulePayments] = useState([]);
  const [archivedPaymentRecords, setArchivedPaymentRecords] = useState([]); // NEW
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('members');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState(null);
  const [selectedArchivedAccount, setSelectedArchivedAccount] = useState(null); // NEW
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [loanData, setLoanData] = useState({});

  const handleViewComakers = (loan) => {
    setSelectedLoan(loan);
    setActiveTab('loanDetails');
  };
  //just now
  // Generate a unique OR number based on data (fallback for missing OR)
  function generateOrNumber(data) {
    // Use account_number and a timestamp for uniqueness
    const account = data.account_number || 'ACC';
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `OR-${account}-${dateStr}`;
  }//just now end

  // AUTO DELETE STATES
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(
    localStorage.getItem('autoDeleteEnabled') === 'true'
  );
  const [deletionDays, setDeletionDays] = useState(
    parseInt(localStorage.getItem('deletionDays')) || 30
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [warningRecords, setWarningRecords] = useState([]);

useEffect(() => {
  fetchArchivedData();
  fetchLoanData(); // Add this new function call
  if (autoDeleteEnabled) {
    checkAndAutoDelete();
    const interval = setInterval(checkAndAutoDelete, 3600000);
    return () => clearInterval(interval);
  }
}, [autoDeleteEnabled, deletionDays]);

  // AUTO DELETE CONFIG COMPONENT
const AutoDeleteConfig = () => (
  <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', border: '2px solid #ccc', borderRadius: '12px', padding: '30px', boxShadow: '0 8px 20px rgba(0,0,0,0.3)', zIndex: 2000, minWidth: '400px' }}>
    <h3 style={{ marginTop: '0', textAlign: 'center', color: 'black' }}>Auto-Delete Configuration</h3>
    
    {/* Add clarification message */}
    <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '6px', border: '1px solid #b3d9ff' }}>
      <small style={{ color: '#0066cc', fontWeight: 'bold' }}>
        Note: Auto-deletion applies only to archived Members and Accounts. 
        Loan and Payment records are permanently preserved.
      </small>
    </div>
    
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
        <input
          type="checkbox"
          checked={autoDeleteEnabled}
          onChange={(e) => setAutoDeleteEnabled(e.target.checked)}
          style={{ transform: 'scale(1.2)' }}
        />
        <span style={{ fontSize: '16px' }}>Enable automatic deletion of archived member and account records</span>
      </label>
    </div>
    
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
        Delete member and account records after (days):
      </label>
      <input
        type="number"
        min="1"
        max="365"
        value={deletionDays}
        onChange={(e) => setDeletionDays(parseInt(e.target.value) || 30)}
        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
        disabled={!autoDeleteEnabled}
      />
      <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
        Member and account records will be automatically deleted after this many days from archive date.
        Loan and payment records will remain preserved.
      </small>
    </div>
    
    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
      <button 
        onClick={() => setShowConfig(false)}
        style={{ padding: '10px 20px', border: '1px solid #ccc', borderRadius: '6px', background: '#f5f5f5', cursor: 'pointer' }}
      >
        Cancel
      </button>
      <button 
        onClick={handleConfigSave}
        style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', background: '#4CAF50', color: 'white', cursor: 'pointer' }}
      >
        Save Configuration
      </button>
    </div>
    
    {autoDeleteEnabled && (
      <div style={{ marginTop: '20px', padding: '15px', background: '#fff3cd', borderRadius: '6px', border: '1px solid #ffeaa7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <FaExclamationTriangle style={{ color: '#856404' }} />
          <strong style={{ color: '#856404' }}>Manual Deletion</strong>
        </div>
        <p style={{ margin: '0 0 15px 0', color: '#856404', fontSize: '14px' }}>
          Delete member and account records older than {deletionDays} days right now.
          Loan and payment records will remain preserved.
        </p>
        <button
          onClick={handleManualAutoDelete}
          disabled={isDeleting}
          style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', background: '#dc3545', color: 'white', cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.6 : 1 }}
        >
          {isDeleting ? 'Deleting...' : 'Delete Expired Member & Account Records'}
        </button>
      </div>
    )}
  </div>
);

  // WARNING NOTIFICATION COMPONENT
const WarningNotification = () => (
  warningRecords.length > 0 && (
    <div style={{ position: 'fixed', top: '20px', right: '20px', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '8px', padding: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1000, maxWidth: '350px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <FaExclamationTriangle style={{ color: '#856404' }} />
        <strong style={{ color: '#856404' }}>Member & Account Deletion Warning</strong>
      </div>
      <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
        {warningRecords.length} member/account records will be automatically deleted in {5 - Math.floor((new Date() - new Date(warningRecords[0]?.archived_at)) / (24 * 60 * 60 * 1000))} day(s).
        Loan and payment records remain preserved.
      </p>
      <button 
        onClick={() => setWarningRecords([])}
        style={{ background: 'none', border: 'none', color: '#856404', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px' }}
      >
        Dismiss
      </button>
    </div>
  )
);

const NotificationPopup = ({ message, type = 'success' }) => {
  if (!message) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.15)',
          backdropFilter: 'blur(5px)',
          zIndex: 9998,
        }}
      />
      <div
        style={{ 
          position: 'fixed',
          top: '50%',
          left: '55%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: type === 'success' ? '#4CAF50' : '#f1f1f1ff',
          color: 'black',
          padding: '20px 30px',
          borderRadius: '8px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          fontSize: '18px',
          textAlign: 'center',
          zIndex: 9999,
          minWidth: '300px',
          animation: 'fadeIn 0.3s ease-out',
        }}
      >
        {message}
      </div>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -60%); }
            to { opacity: 1; transform: translate(-50%, -50%); }
          }
        `}
      </style>
    </>
  );
};

// Update the handleConfigSave function
const handleConfigSave = () => {
  localStorage.setItem('autoDeleteEnabled', autoDeleteEnabled.toString());
  localStorage.setItem('deletionDays', deletionDays.toString());
  setShowConfig(false);
  setNotification({ 
    message: 'Auto-delete configuration saved successfully!',
    type: 'success'
  });
  setTimeout(() => {
    setNotification({ message: '', type: '' });
  }, 3000);
  
  if (autoDeleteEnabled) {
    checkAndAutoDelete();
  }
};

  // GET TOKEN HELPER
  const getAuthToken = () => {
    const token = localStorage.getItem('accessToken') || 
                  localStorage.getItem('authToken') || 
                  sessionStorage.getItem('accessToken') || 
                  sessionStorage.getItem('authToken');
    
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }
    
    return token;
  };

  // REMOVE DUPLICATES HELPER
  const removeDuplicates = (array, getKey) => {
    const seen = new Set();
    return array.filter(item => {
      const key = getKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // UPDATED FETCH ARCHIVED DATA
 const fetchArchivedData = async () => {
  setLoading(true);
  try {
    const token = getAuthToken();
    
    const [
      membersResponse, 
      loansResponse, 
      accountsResponse, 
      paymentsResponse,
      regularPaymentsResponse,
      schedulePaymentsResponse,
      archivedPaymentRecordsResponse
    ] = await Promise.all([
      axios.get(`${process.env.REACT_APP_API_URL}/archives/?archive_type=Member`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${process.env.REACT_APP_API_URL}/archives/?archive_type=Loan`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${process.env.REACT_APP_API_URL}/archives/?archive_type=Account`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${process.env.REACT_APP_API_URL}/archives/?archive_type=Payment`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${process.env.REACT_APP_API_URL}/archived-payments/`, { headers: { Authorization: `Bearer ${token}` } }).catch(err => ({ data: [] })),
      axios.get(`${process.env.REACT_APP_API_URL}/archived-schedules/`, { headers: { Authorization: `Bearer ${token}` } }).catch(err => ({ data: [] })),
      axios.get(`${process.env.REACT_APP_API_URL}/archived-payment-records/`, { headers: { Authorization: `Bearer ${token}` } }).catch(err => ({ data: [] }))
    ]);

    // Process loans to ensure control numbers are preserved
    const processedLoans = loansResponse.data.map(loan => ({
      ...loan,
      archived_data: {
        ...loan.archived_data,
        control_number: loan.archived_data?.control_number || 
                       loan.control_number ||
                       `ARCHIVED-${loan.id}` // Fallback control number if none exists
      }
    }));

    setArchivedUsers(removeDuplicates(membersResponse.data || [], (member) => member.archived_data?.memId || member.id));
    setArchivedLoans(removeDuplicates(processedLoans, (loan) => loan.archived_data?.control_number));
    setArchivedAccounts(removeDuplicates(accountsResponse.data || [], (account) => account.archived_data?.account_number || account.id));
    setArchivedPayments(removeDuplicates(paymentsResponse.data || [], (payment) => payment.id));
    setRegularPayments(regularPaymentsResponse.data || []);
    setSchedulePayments(schedulePaymentsResponse.data || []);
    setArchivedPaymentRecords(archivedPaymentRecordsResponse.data || []);

  } catch (err) {
    console.error('Error fetching archived data:', err);
    setError('Failed to fetch archived data.');
  } finally {
    setLoading(false);
  }
};

  // CHECK FOR EXPIRED RECORDS
const checkAndAutoDelete = async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - deletionDays);
    
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() - (deletionDays - 5));
    
    // Find expiring records - ONLY members and accounts
    const expiringRecords = [
      ...archivedUsers.filter(u => {
        const archivedDate = new Date(u.archived_at);
        return archivedDate < warningDate && archivedDate > cutoffDate;
      }),
      ...archivedAccounts.filter(a => {
        const archivedDate = new Date(a.archived_at);
        return archivedDate < warningDate && archivedDate > cutoffDate;
      })
      // REMOVED: loans, payments, regularPayments, schedulePayments, archivedPaymentRecords
    ];
    
    setWarningRecords(expiringRecords);
    
    // Find and delete expired records - ONLY members and accounts
    const expiredRecords = [
      ...archivedUsers.filter(user => new Date(user.archived_at) < cutoffDate),
      ...archivedAccounts.filter(account => new Date(account.archived_at) < cutoffDate)
      // REMOVED: loans, payments, regularPayments, schedulePayments, archivedPaymentRecords
    ];
    
    if (expiredRecords.length > 0) {
      await deleteExpiredRecords(expiredRecords);
    }

  } catch (error) {
    console.error('Error in auto-delete check:', error);
  }
};

  // DELETE EXPIRED RECORDS
const deleteExpiredRecords = async (expiredRecords) => {
  try {
    const token = getAuthToken();
    
    await Promise.all(expiredRecords.map(async (record) => {
      try {
        // Only use the main archives endpoint since we're only dealing with members and accounts
        const endpoint = `${process.env.REACT_APP_API_URL}/archives/${record.id}/`;
        
        await axios.delete(endpoint, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Failed to delete expired record:', err);
      }
    }));

    await fetchArchivedData();
  } catch (error) {
    console.error('Error deleting expired records:', error);
  }
};

  // MANUAL DELETE HANDLER
const handleManualAutoDelete = async () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - deletionDays);

  // Count only members and accounts
  const expiredCount = [
    ...archivedUsers.filter(u => new Date(u.archived_at) < cutoffDate),
    ...archivedAccounts.filter(a => new Date(a.archived_at) < cutoffDate)
    // REMOVED: loans and payment records from count
  ].length;

  if (expiredCount === 0) {
    alert('No archived member or account records older than ' + deletionDays + ' days found.');
    return;
  }

  if (!window.confirm(`Are you sure you want to delete ${expiredCount} archived member and account records older than ${deletionDays} days? This action cannot be undone.\n\nNote: Loan and payment records are preserved and will not be deleted.`)) {
    return;
  }

  setIsDeleting(true);
  try {
    await checkAndAutoDelete();
    alert('Successfully deleted expired member and account records. Loan and payment records remain preserved.');
  } catch (error) {
    console.error('Error during manual auto-delete:', error);
    alert('Failed to delete expired archives. Please try again.');
  } finally {
    setIsDeleting(false);
  }
};

  // FORMAT NUMBER HELPER
  const formatNumber = (number) => {
    if (number == null || isNaN(number)) return "N/A";
    return new Intl.NumberFormat('en-US').format(number);
  };

  const fetchLoanData = async () => {
  try {
    const token = getAuthToken();
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/loans/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // Create a map of account numbers to loan control numbers
    const loanMap = {};
    response.data.forEach(loan => {
      if (loan.account && loan.control_number) {
        loanMap[loan.account] = loan.control_number;
      }
    });
    
    setLoanData(loanMap);
  } catch (error) {
    console.error('Error fetching loan data:', error);
  }
};

// Update the sorting in getGroupedArchivedPaymentRecords function
const getGroupedArchivedPaymentRecords = () => {
  const grouped = {};
  
  // First, sort records by archived_at date in ascending order
  const sortedRecords = [...archivedPaymentRecords].sort((a, b) => 
    new Date(a.archived_at) - new Date(b.archived_at)
  );
  
  sortedRecords.forEach(payment => {
    const accountNumber = payment.account_number;
    // Get the loan control number from archived data or original data
    const loanControlNumber = payment.loan_control_number || 
                            payment.control_number || 
                            loanData[payment.account_number] || 
                            archivedLoans.find(loan => loan.archived_data?.account === accountNumber)?.archived_data?.control_number;

    const accountKey = `${accountNumber}-${loanControlNumber}`;
    
    if (!grouped[accountKey]) {
      grouped[accountKey] = {
        account_number: accountNumber,
        loan_control_number: loanControlNumber || 'N/A', // Fallback if no control number found
        account_holder: payment.account_holder,
        loan_type: payment.loan_type || 'N/A',
        payments: [],
        total_payments: 0,
        total_amount: 0,
        latest_payment_date: payment.date_paid,
        earliest_archived_date: payment.archived_at
      };
    }
    
    grouped[accountKey].payments.push(payment);
    grouped[accountKey].total_payments += 1;
    grouped[accountKey].total_amount += parseFloat(payment.payment_amount || 0);
    
    if (new Date(payment.date_paid) > new Date(grouped[accountKey].latest_payment_date)) {
      grouped[accountKey].latest_payment_date = payment.date_paid;
    }
    if (new Date(payment.archived_at) < new Date(grouped[accountKey].earliest_archived_date)) {
      grouped[accountKey].earliest_archived_date = payment.archived_at;
    }
  });
  
  return Object.values(grouped);
};

  // NEW: Filter grouped payment records
  const filterGroupedArchivedPayments = (groupedData) => {
    if (!searchTerm.trim()) return groupedData;
    return groupedData.filter((group) =>
      group.account_number.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.account_holder.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

const fetchPaymentHistory = async (loan) => {
  setLoading(true);
  setError('');
  
  try {
    if (loan.archived_data?.payments) {
      const payments = loan.archived_data.payments.map(payment => ({
        ...payment,
        or_number: payment.OR || payment.or_number || 'N/A', // Use existing OR or N/A
        loan_type: loan.archived_data.loan_type,
        status: 'Paid',
        is_paid: true
      }));
      setPaymentHistory(payments);
      setSelectedLoan(loan);
      setActiveTab('paymentHistory');
      return;
    }

    // Rest of the function...
  } catch (err) {
    console.error('Error fetching payment history:', err);
    setError('Failed to fetch payment history. Please try again.');
    setPaymentHistory([]);
  } finally {
    setLoading(false);
  }
};

// Update the getGroupedArchivedPayments function
const getGroupedArchivedPayments = () => {
  const grouped = {};
  
  archivedPayments.forEach(payment => {
    // Extract account details from payment data
    const archiveData = payment.archived_data || {};
    
    // Get account number - check all possible fields
    const accountNumber = 
      archiveData.account_number || 
      archiveData.account || 
      archiveData.control_number || 
      'Unknown';
    
    // Get account holder name
    const accountHolder = 
      archiveData.account_holder ||
      (archiveData.first_name && archiveData.last_name ? 
        `${archiveData.first_name} ${archiveData.last_name}` : 
        'Unknown');

    // Create or update group
    if (!grouped[accountNumber]) {
      grouped[accountNumber] = {
        account_number: accountNumber,
        account_holder: accountHolder,
        payments: [],
        archived_at: payment.archived_at,
        id: payment.id
      };
    }
    
    // Add payment to group with enhanced data
    grouped[accountNumber].payments.push({
      ...payment,
      archived_data: {
        ...archiveData,
        account_number: accountNumber,
        account_holder: accountHolder,
        payment_amount: archiveData.payment_amount || 
                       archiveData.amount || 
                       archiveData.principal_amount || 
                       0,
        loan_type: archiveData.loan_type || 'N/A',
        date_paid: archiveData.date_paid || 
                  archiveData.payment_date || 
                  payment.archived_at,
      }
    });
  });
  
  return Object.values(grouped);
};

// Update the fetchPaymentHistoryFromArchivedPayments function
const fetchPaymentHistoryFromArchivedPayments = async (paymentAccount) => {
  setLoading(true);
  setError('');
  
  try {
    const accountPayments = paymentAccount.payments || [];
    
    if (accountPayments.length > 0) {
      const formattedPayments = accountPayments.map(payment => {
        const data = payment.archived_data || {};
        return {
          id: payment.id,
          loan_type: data.loan_type || 'N/A',
          payment_amount: parseFloat(data.payment_amount || 
                                  data.amount || 
                                  data.principal_amount || 
                                  0),
          due_date: data.date_paid || 
                   data.payment_date || 
                   payment.archived_at,
          is_paid: true,
          status: 'Paid',
          or_number: data.OR || 
                    data.or_number || 
                    generateOrNumber(data)
        };
      });

      // Sort payments by date
      formattedPayments.sort((a, b) => 
        new Date(b.due_date) - new Date(a.due_date)
      );

      setPaymentHistory(formattedPayments);
      setSelectedPaymentAccount(paymentAccount);
      setActiveTab('archivedPaymentHistory');
    } else {
      setError('No payment records found for this account.');
      setPaymentHistory([]);
    }
  } catch (err) {
    console.error('Error fetching archived payment history:', err);
    setError('Failed to fetch payment history. Please try again.');
    setPaymentHistory([]);
  } finally {
    setLoading(false);
  }
};

const ArchivedPaymentsTable = () => {
  // Add new state for selected control number
  const [selectedControlNumber, setSelectedControlNumber] = useState(null);
  
  const groupedPayments = getGroupedArchivedPaymentRecords();
  const filteredGroupedPayments = filterGroupedArchivedPayments(groupedPayments);

  // Group payments by account holder
  const groupedByAccountHolder = {};
  filteredGroupedPayments.forEach(payment => {
    if (!groupedByAccountHolder[payment.account_holder]) {
      groupedByAccountHolder[payment.account_holder] = [];
    }
    groupedByAccountHolder[payment.account_holder].push(payment);
  });

  // If an account is selected, show detailed payments
  if (selectedArchivedAccount) {
    const accountPayments = selectedArchivedAccount.payments.sort((a, b) => 
      new Date(a.date_paid) - new Date(b.date_paid)
    );

    return (
      <div className="payment-history-section">
        <div style={{ marginTop: '-55px', paddingTop: '20px', fontSize: '16px'  }}>
          <h3>Payment History of: {selectedArchivedAccount.account_holder}</h3>
          <nav style={{ display: 'flex', gap: '20px', marginBottom: '10px', alignItems: 'center' }}>
            <span
              onClick={() => {
                setSelectedArchivedAccount(null);
                setSelectedControlNumber(null);
              }}
              style={{ cursor: 'pointer', fontWeight: 'bold', color: 'green', fontSize: '18px' }}
            >
              ← Back to List
            </span>

              <button
                onClick={() => {
                  const printContent = document.querySelector('.archived-payment-table-print');
                  const accountHolder = selectedArchivedAccount.account_holder || 'N/A';
                  const accountNumber = selectedArchivedAccount.account_number || 'N/A';

                  if (printContent) {
                    // Get only the payments table from the print container
                    const paymentsTable = printContent.querySelector('table');
                    
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Payment History - ${accountHolder}</title>
                          <style> body { font-family: Arial, sans-serif; margin: 20px; color: #000; } h2 { text-align: center; margin-bottom: 20px; color: black; } .info-header { margin-bottom: 20px; padding: 10px; border-bottom: 2px solid #000; } .info-header p { margin: 5px 0; font-size: 14px; } table { width: 100%; border-collapse: collapse; margin: 0 auto; } th, td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 12px; } th { background-color: #4CAF50; color: white; font-weight: bold; } tbody tr:nth-child(even) { background-color: #f9f9f9; } @media print { body { margin: 0; } table { font-size: 10px; } th, td { padding: 6px; } } </style>
                        </head>
                        <body>
                          <h2>Payment History</h2>
                          <div class="info-header">
                            <p><strong>Account Number:</strong> ${accountNumber}</p>
                            <p><strong>Account Holder:</strong> ${accountHolder}</p>
                            <p><strong>Date Printed:</strong> ${new Date().toLocaleDateString()}</p>
                            <p><strong>Total Payments:</strong> ${selectedArchivedAccount.payments.length}</p>
                          </div>
                          ${paymentsTable.outerHTML}
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                    printWindow.close();
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', backgroundColor: '#ede9c7', fontSize: '25px', cursor: 'pointer', border: 'none', position: 'fixed', right: '20px', top: '230px', zIndex: '1000', padding: '10px' }}
                title="Print Payment History"
              >
                <BsFillPrinterFill />
              </button>
          </nav>

          <div className="print-container archived-payment-table-print"
            style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: '50px', padding: '30px', border: '1px solid #ccc', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', margin: '0 auto', width: '120%', height: '350px' }}>
            {/* Account Details Section */}
            <div style={{ flex: '1', maxHeight: '150px', borderRadius: '10px', padding: '25px', backgroundColor: '#fef7f7ff', maxWidth: '450px', scrollbarWidth: 'none', msOverflowStyle: 'none', overflowY: 'auto', marginTop: '80px' }}>
              <h4 style={{ fontWeight: 'bold', fontSize: '20px', marginTop: '-10px' }}>
                📋 Loan Payment Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginTop: '10px', fontSize: '14px' }}>
                <div><strong>Account Number:</strong> {selectedArchivedAccount.account_number}</div>
                <div><strong>Account Holder:</strong> {selectedArchivedAccount.account_holder}</div>
                <div><strong>Control Number:</strong> {selectedArchivedAccount.loan_control_number}</div>
                <div><strong>Loan Type:</strong> {selectedArchivedAccount.loan_type}</div>
                <div><strong>Total Payments:</strong> {accountPayments.length}</div>
                <div><strong>Total Amount Paid:</strong> ₱{formatNumber(selectedArchivedAccount.total_amount.toFixed(2))}</div>
                <div><strong>Archived Since:</strong> {new Date(selectedArchivedAccount.earliest_archived_date).toLocaleDateString()}</div>
                <div><strong>Latest Payment:</strong> {new Date(selectedArchivedAccount.latest_payment_date).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Payments Table Section */}
            <div style={{ flex: '1', border: '1px solid #ccc', borderRadius: '10px', padding: '25px', backgroundColor: '#fef7f7ff', minWidth: '335px', maxWidth: '100%', marginTop: '1px', maxHeight: '320px', scrollbarWidth: 'none', msOverflowStyle: 'none', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '14px', height: '100px'  }}>
                <thead>
                  <tr style={{ position: 'sticky', top: '-30px'}}>
                    <th style={{ padding: '12px' }}>Paid Amount</th>
                    <th style={{ padding: '12px' }}>Date Paid</th>
                    <th style={{ padding: '12px' }}>OR Number</th>
                  </tr>
                </thead>
                <tbody>
                  {accountPayments.map((payment, index) => (
                    <tr key={`payment-${payment.id}-${index}`}>
                      <td style={{ padding: '8px' }}>₱{formatNumber(payment.payment_amount)}</td>
                      <td style={{ padding: '8px' }}>{new Date(payment.date_paid).toLocaleDateString()}</td>
                      <td style={{ padding: '8px' }}>{payment.OR || payment.or_number || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default view - show grouped accounts with dropdown for multiple loans
  return (
    <div className="records-box">
      <input
        type="text"
        placeholder="Search Archived Payment Accounts"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-bar"
      />
      <h2 style={{ textAlign: 'center', fontSize: '22px' }}>
        Archived Payment Records ({Object.keys(groupedByAccountHolder).length})
      </h2>
      
        <div style={{ maxHeight: '257px', overflowY: 'auto', marginTop: '20px', fontSize: '11px',}}></div>
          <div style={{overflowY: 'auto' }}>
            <table
              className="records-table"
              style={{width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', tableLayout: 'fixed', scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
              <thead style={{ backgroundColor: '#f2f2f2' }}>
                <tr>
              <th style={{ padding: '12px'}}>Account Holder</th>
              <th style={{ padding: '12px'}}>Account Number</th>
              <th style={{ padding: '12px'}}>Control Number</th>
              <th style={{ padding: '12px'}}>Loan Type</th>
              <th style={{ padding: '12px', width: '200px', textAlign: 'center'}}>Total Amount</th>
              <th style={{ padding: '12px', width: '200px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedByAccountHolder).length > 0 ? (
              Object.entries(groupedByAccountHolder).map(([accountHolder, loans]) => (
                <tr key={accountHolder}>
                  <td style={{ padding: '8px'}}> {accountHolder} </td>
                  <td style={{ padding: '8px'}}> {loans[0].account_number} </td>
                  <td style={{ padding: '8px'}}> {loans.length > 1 ? ( <select onChange={(e) => { const selectedLoan = loans.find(l => l.loan_control_number === e.target.value); setSelectedArchivedAccount(selectedLoan); }}> <option value="">Select Control Number</option> {loans.map(loan => ( <option key={loan.loan_control_number} value={loan.loan_control_number}> {loan.loan_control_number} </option> ))} </select> ) : ( loans[0].loan_control_number )} </td>
                  <td style={{ padding: '8px'}}> {loans[0].loan_type} </td>
                  <td style={{ padding: '8px', textAlign: 'center'}}> ₱{formatNumber(loans.reduce((total, loan) => total + loan.total_amount, 0).toFixed(2))} </td>
                  
                  <td style={{ padding: '8px', width: '200px', overflow: 'hidden' }}>
                    {loans.length === 1 && (
                      <button 
                        onClick={() => setSelectedArchivedAccount(loans[0])} 
                        className="actionButton actionButtonView"
                        style={{
                          display: 'flex',
                          gap: '5px',
                          padding: '6px 10px',
                          fontSize: '18px',
                          maxWidth: '200px',
                          margin: '0 auto',
                        }}
                      > 
                        <FaEye /> <span className="buttonText">View Payments</span>
                      </button>
                    )}
                  </td>

                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px', border: '1px solid #eee' }}>
                  No archived payment records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

  // FILTER DATA HELPERS
const filterData = (data, keys) => {
  if (!searchTerm.trim()) return data;
  return data.filter((item) =>
    keys.some((key) => {
      const value = item.archived_data?.[key];
      if (key === 'control_number' && !value) {
        // If control number is missing, use the fallback
        const fallbackControlNumber = `ARCHIVED-${item.id}`;
        return fallbackControlNumber.toString().toLowerCase().includes(searchTerm.toLowerCase());
      }
      return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
    })
  );
};

  const filterGroupedPayments = (groupedData, keys) => {
    if (!searchTerm.trim()) return groupedData;
    return groupedData.filter((item) =>
      keys.some((key) =>
        item[key]?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  };

  // Handle tab changes with proper cleanup
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSelectedArchivedAccount(null);
    setSelectedMember(null);
    setSelectedLoan(null);
    setSelectedPaymentAccount(null);
    setSearchTerm('');
  };

  // FILTERED DATA
  const filteredArchivedUsers = filterData(archivedUsers, ['memId', 'first_name', 'last_name', 'email']);
  const filteredArchivedLoans = filterData(archivedLoans, ['control_number', 'account_holder', 'loan_amount', 'status']);
  const filteredArchivedAccounts = filterData(archivedAccounts, ['account_number', 'status']);
  const groupedPayments = getGroupedArchivedPayments();
  const filteredGroupedPayments = filterGroupedPayments(groupedPayments, ['account_number', 'account_holder', 'control_number']);

return (
  <div className="archived-records">
    {notification.message && (
      <NotificationPopup 
        message={notification.message}
        type={notification.type}
      />
    )}
    <WarningNotification />
      {showConfig && <AutoDeleteConfig />}
      
      {!selectedMember && !selectedLoan && !selectedPaymentAccount && !selectedArchivedAccount && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="dropdown">
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value)}
              className="dropdown-select"
            >
              <option value="members">Archived Members</option>
              <option value="accounts">Archived Accounts</option>
              <option value="loan">Archived Loans</option>
              <option value="paymentRecords">Archived Payments</option>
            </select>
          </div>
          
          {/* <button
            onClick={() => setShowConfig(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 1px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', marginRight: '950px' }}
            title="Configure Auto-Delete Settings"
          >
            <FaCog />
            Auto-Delete Settings
          </button> */}
        </div>
      )}

      {/* ARCHIVED MEMBERS TAB */}
      {activeTab === 'members' && (
        <div className="records-box">
          <input
            type="text"
            placeholder="Search Records"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-bar"
          />
          <h2 style={{ textAlign: 'center', fontSize: '22px'}}>
            Archived Members ({filteredArchivedUsers.length})
          </h2>
          <div style={{ marginBottom: '70px', marginTop: '-50px' }}></div>
          <div style={{overflowY: 'auto' }}>
            <table
              className="records-table"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px', textAlign: 'left', tableLayout: 'fixed', scrollbarWidth: 'none', msOverflowStyle: 'none', }} >
              <thead>
                <tr>
                  <th style={{ padding: '12px 20px', width: '250px', borderBottom: '1px solid #ddd' }}>Name</th>
                  <th style={{ padding: '12px 20px', width: '220px', borderBottom: '1px solid #ddd' }}>Email</th>
                  <th style={{ padding: '12px 20px', width: '150px', borderBottom: '1px solid #ddd' }}>Phone</th>
                  <th style={{ padding: '12px 20px', width: '200px', borderBottom: '1px solid #ddd' }}>Archived Date</th>
                  <th style={{ padding: '12px 20px', width: '150px', borderBottom: '1px solid #ddd' }}>Auto-Delete In</th>
                </tr>
              </thead>
              <tbody>
                {filteredArchivedUsers.length > 0 ? (
                  filteredArchivedUsers.map((user, index) => {
                    const archivedDate = new Date(user.archived_at);
                    const deleteDate = new Date(archivedDate);
                    deleteDate.setDate(deleteDate.getDate() + deletionDays);
                    const daysUntilDeletion = Math.ceil((deleteDate - new Date()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <tr key={`member-${user.archived_data?.memId || user.id}-${index}`}>
                        <td
                          style={{ padding: '12px 20px', cursor: 'pointer', color: 'blue', width: '250px', borderBottom: '1px solid #eee' }}
                          onClick={() => {
                            setSelectedMember(user);
                            setActiveTab("Account");
                          }}
                        >
                          {`${user.archived_data?.first_name || ''} ${user.archived_data?.middle_name || ''} ${user.archived_data?.last_name || ''}`}
                        </td>
                        <td style={{ padding: '12px 20px', width: '220px', borderBottom: '1px solid #eee' }}>
                          {user.archived_data?.email}
                        </td>
                        <td style={{ padding: '12px 20px', width: '150px', borderBottom: '1px solid #eee' }}>
                          {user.archived_data?.phone_number}
                        </td>
                        <td style={{ padding: '12px 20px', width: '200px', borderBottom: '1px solid #eee' }}>
                          {new Date(user.archived_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 20px', width: '150px', borderBottom: '1px solid #eee', color: daysUntilDeletion <= 5 ? 'red' : daysUntilDeletion <= 10 ? 'orange' : 'green', fontWeight: daysUntilDeletion <= 5 ? 'bold' : 'normal' }}>
                          {daysUntilDeletion > 0 ? `${daysUntilDeletion} days` : 'Expired'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                      No archived members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MEMBER DETAILS VIEW */}
      {selectedMember && (
        <div style={{ marginTop: '-50px', paddingTop: '20px', fontSize: '16px' }}>
          <h3>
            Records of: {selectedMember.archived_data?.first_name} {selectedMember.archived_data?.middle_name} {selectedMember.archived_data?.last_name}
          </h3>
          <nav style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
            <span
              onClick={() => {
                setSelectedMember(null);
                setActiveTab('members');
              }}
              style={{cursor: 'pointer',fontWeight: 'bold',color: 'green',fontSize: '15px'}}>← Back to list
            </span>
          </nav>
          <div>
            {activeTab === 'Account' && selectedMember && (
              <div
                style={{display: 'flex',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'flex-start',gap: '50px',padding: '30px',border: '1px solid #ccc',borderRadius: '12px',boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',margin: '0 auto',width: '115%',height: '350px'}}>
                {/* LEFT: MEMBER INFORMATION */}
                <div
                  style={{flex: '1', marginTop: '-15px', maxHeight: '335px', border: '1px solid #ccc',borderRadius: '10px',padding: '25px',backgroundColor: '#fef7f7ff',maxWidth: '100%',scrollbarWidth: 'none', msOverflowStyle: 'none', overflowY: 'auto', fontSize: '14px'}}>
                  <h3 style={{ marginTop: '-20px', textAlign: 'center' }}>📋 Member Information</h3>
                  <div style={{ flexDirection: 'column',display: 'grid',gridTemplateColumns: 'repeat(2, 1fr)',gap: '15px', marginBottom: '-20px'}}>
                    {/* <div><strong>Member ID:</strong> {selectedMember.archived_data?.memId}</div> */}
                    <div><strong>First Name:</strong> {selectedMember.archived_data?.first_name}</div>
                    <div><strong>Middle Name:</strong> {selectedMember.archived_data?.middle_name}</div>
                    <div><strong>Last Name:</strong> {selectedMember.archived_data?.last_name}</div>
                    <div><strong>Email:</strong> {selectedMember.archived_data?.email}</div>
                    <div><strong>Birth Date:</strong> {selectedMember.archived_data?.birth_date}</div>
                    <div><strong>Birth Place:</strong> {selectedMember.archived_data?.birth_place}</div>
                    <div><strong>Age:</strong> {selectedMember.archived_data?.age}</div>
                    <div><strong>ZIP Code:</strong> {selectedMember.archived_data?.zip_code}</div>
                    <div><strong>Gender:</strong> {selectedMember.archived_data?.gender}</div>
                    <div><strong>Status:</strong> {selectedMember.archived_data?.pstatus}</div>
                    <div><strong>Religion:</strong> {selectedMember.archived_data?.religion}</div>
                    <div><strong>Address:</strong> {selectedMember.archived_data?.address}</div>
                    <div><strong>Phone Number:</strong> {selectedMember.archived_data?.phone_number}</div>
                    <div><strong>Height:</strong> {selectedMember.archived_data?.height}</div>
                    <div><strong>Weight:</strong> {selectedMember.archived_data?.weight}</div>
                    <div><strong>TIN:</strong> {selectedMember.archived_data?.tin}</div>
                    <div><strong>Valid ID:</strong> {selectedMember.archived_data?.valid_id}</div>
                    <div><strong>ID Number:</strong> {selectedMember.archived_data?.id_no}</div>
                    <div><strong>Annual Income:</strong> {selectedMember.archived_data?.ann_com}</div>
                    <div><strong>Initial Deposit:</strong> {selectedMember.archived_data?.in_dep}</div>
                    <div><strong>Membership in other Cooperatives:</strong> {selectedMember.archived_data?.mem_co}</div>
                    <div><strong>Address of the Cooperative:</strong> {selectedMember.archived_data?.addresss}</div>
                  </div>
                </div>

                <div
                  style={{ flex: '1', border: '1px solid #ccc', borderRadius: '10px', padding: '25px', backgroundColor: '#fef7f7ff', minWidth: '350px', maxWidth: '100%', marginTop: '40px', fontSize: '14px' }}>
                  <h3 style={{ marginTop: '-10px', textAlign: 'center' }}>👨‍👩‍👧 Beneficiaries</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', '@media (max-width: 768px)': { gridTemplateColumns: '1fr' } }}>
                    {/* Beneficiary 1 */}
                    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', backgroundColor: '#fff' }}>
                      <strong>Beneficiary 1:</strong> {selectedMember.archived_data?.beneficiary}<br />
                      <strong>Relationship:</strong> {selectedMember.archived_data?.relationship}<br />
                      <strong>Birth Date:</strong> {selectedMember.archived_data?.birth_date1}
                    </div>

                    {/* Beneficiary 2 */}
                    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', backgroundColor: '#fff' }}>
                      <strong>Beneficiary 2:</strong> {selectedMember.archived_data?.beneficiary2}<br />
                      <strong>Relationship:</strong> {selectedMember.archived_data?.relationship2}<br />
                      <strong>Birth Date:</strong> {selectedMember.archived_data?.birth_date2}
                    </div>
                  </div>

                  {/* Beneficiary 3 - Centered below */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', width: 'calc(50% - 10px)', minWidth: '250px' }}>
                      <strong>Beneficiary 3:</strong> {selectedMember.archived_data?.beneficiary3}<br />
                      <strong>Relationship:</strong> {selectedMember.archived_data?.relationship3}<br />
                      <strong>Birth Date:</strong> {selectedMember.archived_data?.birth_date3}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* ARCHIVED ACCOUNTS TAB */}
      {activeTab === 'accounts' && (
        <div className="records-box">
          <input
            type="text"
            placeholder="Search Accounts"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-bar"
          />
          <h2 style={{ textAlign: 'center', fontSize:'22px' }}>
            Archived Accounts ({filteredArchivedAccounts.length})
          </h2>
          <div style={{overflowY: 'auto' }}>
            <table className="records-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px', textAlign: 'left', tableLayout: 'fixed' }}>
              <thead style={{ backgroundColor: '#f2f2f2' }}>
                <tr>
                  <th style={{ padding: '12px 20px', border: '0px', width: '200px' }}>Account Number</th>
                  <th style={{ padding: '12px 20px', border: '0px', width: '250px' }}>Account Holder</th>
                  <th style={{ padding: '12px 20px', border: '0px', width: '150px' }}>Status</th>
                  <th style={{ padding: '12px 20px', border: '0px', width: '200px' }}>Archived At</th>
                  <th style={{ padding: '12px 20px', border: '0px', width: '120px' }}>Delete In</th>
                </tr>
              </thead>
              <tbody>
                {filteredArchivedAccounts.length > 0 ? (
                  filteredArchivedAccounts.map((account, index) => {
                    const archivedDate = new Date(account.archived_at);
                    const deleteDate = new Date(archivedDate);
                    deleteDate.setDate(deleteDate.getDate() + deletionDays);
                    const daysUntilDeletion = Math.ceil((deleteDate - new Date()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <tr key={`account-${account.archived_data?.account_number || account.id}-${index}`}>
                        <td style={{ padding: '12px 20px', width: '200px', borderBottom: '1px solid #eee' }}>
                          {account.archived_data?.account_number}
                        </td>
                        <td style={{ padding: '12px 20px', width: '250px', borderBottom: '1px solid #eee' }}>
                          {account.archived_data?.account_holder ? 
                            `${account.archived_data.account_holder.first_name || ''} ${account.archived_data.account_holder.middle_name || ''} ${account.archived_data.account_holder.last_name || ''}` : 
                            'N/A'
                          }
                        </td>
                        <td style={{ 
                          padding: '12px 20px',
                          width: '150px',
                          borderBottom: '1px solid #eee',
                          color: account.archived_data?.status?.toLowerCase() === 'inactive' ? 'red' : 'inherit', 
                          fontWeight: account.archived_data?.status?.toLowerCase() === 'inactive' ? 'bold' : 'normal'
                        }}>
                          {account.archived_data?.status || 'N/A'}
                        </td>
                        <td style={{ padding: '12px 20px', width: '200px', borderBottom: '1px solid #eee' }}>
                          {new Date(account.archived_at).toLocaleString()}
                        </td>
                        <td style={{ 
                          padding: '12px 20px', 
                          width: '120px', 
                          borderBottom: '1px solid #eee',
                          color: daysUntilDeletion <= 5 ? 'red' : daysUntilDeletion <= 10 ? 'orange' : 'green',
                          fontWeight: daysUntilDeletion <= 5 ? 'bold' : 'normal'
                        }}>
                          {daysUntilDeletion > 0 ? `${daysUntilDeletion} days` : 'Expired'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px', border: '0px' }}>
                      No archived accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ARCHIVED LOANS TAB */}
      {activeTab === 'loan' && (
        <div className="records-box">
          <input
            type="text"
            placeholder="Search Loans"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-bar"
          />
          <h2 style={{ textAlign: 'center', fontSize:'22px' }}>
            Archived Loans ({filteredArchivedLoans.length})
          </h2>
          <div style={{ marginBottom: '65px', marginTop: '-60px' }}></div>
          <div style={{overflowY: 'auto' }}>
            <table
              className="records-table"
              style={{width: '100%', borderCollapse: 'collapse', fontSize: '16px', textAlign: 'left', tableLayout: 'fixed', scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
              <thead style={{ backgroundColor: '#f2f2f2' }}>
                <tr>
                  <th style={{ padding: '12px', border: '0px' }}>Control Number</th>
                  <th style={{ padding: '12px', border: '0px' }}>Account Holder</th>
                  <th style={{ padding: '12px', border: '0px' }}>Loan Amount</th>
                  <th style={{ padding: '12px', border: '0px' }}>Status</th>
                  <th style={{ padding: '12px', border: '0px' }}>Archived At</th>
                  <th style={{ padding: '12px', border: '0px' }}>Actions</th>
                </tr>
              </thead>
            </table>
            <div style={{overflowY: 'auto' }}>
              <table
                className="records-table"
                style={{width: '100%',borderCollapse: 'collapse',fontSize: '16px',textAlign: 'left',tableLayout: 'fixed',scrollbarWidth: 'none',msOverflowStyle: 'none'}}>
                <tbody>
                  {filteredArchivedLoans.length > 0 ? (
                    filteredArchivedLoans.map((loan, index) => {
                      const archivedDate = new Date(loan.archived_at);
                      
                      return (
                        <tr key={`loan-${loan.archived_data?.control_number || loan.id}-${index}`}>
                          <td style={{ padding: '10px' }}> {loan.archived_data?.control_number || 'N/A'} </td>
                          <td style={{ padding: '10px' }}>{loan.archived_data?.account_holder || 'N/A'}</td>
                          <td style={{ padding: '10px' }}> ₱{formatNumber(parseFloat(loan.archived_data?.loan_amount || 0).toFixed(2))} </td>
                          <td style={{ padding: '10px', color: loan.archived_data?.status?.toLowerCase() === 'ongoing' ? 'red' : loan.archived_data?.status?.toLowerCase() === 'paid-off' ? 'green' : 'black' }}> {loan.archived_data?.status || 'N/A'} </td>
                          <td style={{ padding: '1px' }}>{new Date(loan.archived_at).toLocaleString()}</td>
                          
                          <td style={{ padding: '10px', textAlign: 'center' }}> 
                            <button onClick={() => handleViewComakers(loan)} className="actionButton actionButtonView" > 
                              <FaEye /> <span className="buttonText">View Comakers</span> 
                            </button> 
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '12px' }}>
                        No archived loans found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* LOAN DETAILS VIEW */}
      {selectedLoan &&(
        <div style={{ marginTop: '-50px', paddingTop: '20px', fontSize: '16px' }}>
          <h3>
            Records of:{selectedLoan.archived_data?.account_holder}</h3>
          <nav style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
            <span
              onClick={() => {
                setSelectedLoan(null);
                setActiveTab('loan');
              }}
              style={{ cursor: 'pointer', fontWeight: 'bold', color: 'green', fontSize: '15px' }}
            >
              ← Back to List
            </span>
          </nav>
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: '50px', padding: '30px', border: '1px solid #ccc', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', margin: '0 auto', width: '115%', height: '350px' }}>
            {/* LEFT: LOAN DETAILS */}
            <div style={{ flex: '1', marginTop: '40px', maxHeight: '335px', border: '1px solid #ccc', borderRadius: '10px', padding: '25px', backgroundColor: '#fef7f7ff', maxWidth: '100%', scrollbarWidth: 'none', msOverflowStyle: 'none', overflowY: 'auto', fontSize: '16px' }}>
              <h3 style={{ marginTop: '-10px', textAlign: 'center' }}>📋 Loan Information</h3>
              <div style={{ flexDirection: 'column', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                <div><strong>Account Number:</strong> {selectedLoan.archived_data?.account}</div>
                <div><strong>Loan Amount:</strong> ₱{formatNumber(selectedLoan.archived_data?.loan_amount)}</div>
                <div><strong>Loan Type:</strong> {selectedLoan.archived_data?.loan_type}</div>
                <div><strong>Purpose:</strong> {selectedLoan.archived_data?.purpose}</div>
                <div><strong>Take Home Pay:</strong> ₱{formatNumber(selectedLoan.archived_data?.takehomePay)}</div>
                <div><strong>Service Fee:</strong> ₱{formatNumber(selectedLoan.archived_data?.service_fee)}</div>
                <div><strong>Interest Amount:</strong> ₱{formatNumber(selectedLoan.archived_data?.interest_amount)}</div>
                <div><strong>Admin Cost:</strong> ₱{formatNumber(selectedLoan.archived_data?.admincost)}</div>
                <div><strong>Notarial Fee:</strong> ₱{formatNumber(selectedLoan.archived_data?.notarial)}</div>
                <div><strong>CISP:</strong> ₱{formatNumber(selectedLoan.archived_data?.cisp)}</div>
              </div>
            </div>

            {/* RIGHT: COMAKERS */}
            <div style={{ flex: '1', border: '1px solid #ccc', borderRadius: '10px', padding: '25px', backgroundColor: '#fef7f7ff', minWidth: '350px', maxWidth: '100%', marginTop: '35px', fontSize: '16px', maxHeight: '335px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <h3 style={{ marginTop: '-10px', textAlign: 'center' }}>👥 Co-Makers</h3>
              
              {!selectedLoan.archived_data?.co_maker && !selectedLoan.archived_data?.co_maker_2 && !selectedLoan.archived_data?.co_maker_3 && !selectedLoan.archived_data?.co_maker_4 && !selectedLoan.archived_data?.co_maker_5 ? ( <div style={{ textAlign: 'center', color: '#666' }}> No co-makers found </div> ) : ( <>
                  {/* Row 1: Co-Maker 1 and 2 */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: '20px',
                    marginBottom: '20px'
                  }}>
                    {selectedLoan.archived_data?.co_maker && (
                      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', textAlign: 'center' }}>
                        <strong>Co-Maker 1</strong><br/>
                        {selectedLoan.archived_data.co_maker}
                      </div>
                    )}
                    
                    {selectedLoan.archived_data?.co_maker_2 && (
                      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', textAlign: 'center' }}>
                        <strong>Co-Maker 2</strong><br/>
                        {selectedLoan.archived_data.co_maker_2}
                      </div>
                    )}
                  </div>

                  {/* Row 2: Co-Maker 3 (centered) */}
                  {selectedLoan.archived_data?.co_maker_3 && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', textAlign: 'center', width: 'calc(50% - 10px)', minWidth: '250px' }}>
                        <strong>Co-Maker 3</strong><br/>
                        {selectedLoan.archived_data.co_maker_3}
                      </div>
                    </div>
                  )}

                  {/* Row 3: Co-Maker 4 and 5 */}
                  {(selectedLoan.archived_data?.co_maker_4 || selectedLoan.archived_data?.co_maker_5) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                      {selectedLoan.archived_data?.co_maker_4 && (
                        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', textAlign: 'center' }}>
                          <strong>Co-Maker 4</strong><br/>
                          {selectedLoan.archived_data.co_maker_4}
                        </div>
                      )}
                      
                      {selectedLoan.archived_data?.co_maker_5 && (
                        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', textAlign: 'center' }}>
                          <strong>Co-Maker 5</strong><br/>
                          {selectedLoan.archived_data.co_maker_5}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW ARCHIVED PAYMENT RECORDS TAB */}
      {activeTab === 'paymentRecords' && <ArchivedPaymentsTable />}
 
    </div>
  );
};

export default ArchivedRecords;