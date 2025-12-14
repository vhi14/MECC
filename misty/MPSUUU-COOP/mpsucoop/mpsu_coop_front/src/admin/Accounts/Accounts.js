import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Accounts.css';
import DepositWithdrawForm from '../DepositWithdrawForm/DepositWithdrawForm';
import { PiHandDepositFill } from 'react-icons/pi';
import { BiMoneyWithdraw } from 'react-icons/bi';
import { BiExit } from 'react-icons/bi';

function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [archivedAccounts, setArchivedAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [actionType, setActionType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshArchives, setRefreshArchives] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [accountLoans, setAccountLoans] = useState([]);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [boardResolutionNumber, setBoardResolutionNumber] = useState('');
  const [showBoardResolutionModal, setShowBoardResolutionModal] = useState(false);
  const [pendingWithdrawalData, setPendingWithdrawalData] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [showWithdrawals, setShowWithdrawals] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [historyType, setHistoryType] = useState('withdraw');
  const [expandedAccountNumber, setExpandedAccountNumber] = useState(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  //OR NUMBER
  const handleTransactionComplete = (entry) => {
    const acctNo = entry?.account?.account_number ?? entry?.account_number;
    const orNum = entry?.orNumber ?? entry?.or_number;
    if (!acctNo || !orNum) return;
    setAccounts(prev =>
      prev.map(acc =>
        acc.account_number === acctNo ? { ...acc, or_number: orNum } : acc
      )
    );
  };

  const formatNumber = (number) => {
    if (number == null || isNaN(number)) return "N/A";
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  };

  useEffect(() => { 
    fetchAccounts();
    fetchLoans();
  }, []);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/archives/?archive_type=Account`)
      .then(response => setArchivedAccounts(response.data || []))
      .catch(error => console.error('Error fetching archived accounts:', error));
  }, [refreshArchives]);

   // OR number
  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/accounts/`);
      const apiAccounts = Array.isArray(response.data) ? response.data : [];

      setAccounts(prev => {
        const existingOrByAcc = new Map(
          (prev || []).map(a => [a.account_number, a.or_number])
        );

        const normalized = apiAccounts.map(a => {
          const apiOr =
            a.or_number ?? a.last_or_number ?? a.last_OR_number ?? a.lastOrNumber ?? null;
          const preservedOr = existingOrByAcc.get(a.account_number) ?? null;

          return {
            ...a,
            or_number: apiOr ?? preservedOr,
          };
        });

        return normalized;
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const fetchLoans = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/loans/`);
      setAccountLoans(response.data);
    } catch (err) {
      console.error('Error fetching loans:', err.response || err);
    }
  };

  const fetchWithdrawals = async (accountNumber) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/account/${accountNumber}/transactions/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const allTransactions = response.data.transactions || [];
      
      const withdrawalTransactions = allTransactions.filter(t => {
        const type = t.transaction_type?.toLowerCase() || '';
        return type.includes('withdraw') || type.includes('withdrawal');
      });

      withdrawalTransactions.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      setWithdrawals(withdrawalTransactions);
      
    } catch (err) {
      console.error('Error fetching withdrawals:', err.response || err);
      setWithdrawals([]);
    }
  };

  const fetchDeposits = async (accountNumber) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/account/${accountNumber}/transactions/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const allTransactions = response.data.transactions || [];
      
      const depositTransactions = allTransactions.filter(t => {
        const type = t.transaction_type?.toLowerCase() || '';
        return !type.includes('withdraw') && !type.includes('withdrawal');
      });

      depositTransactions.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      setDeposits(depositTransactions);
      
    } catch (err) {
      console.error('Error fetching deposits:', err.response || err);
      setDeposits([]);
    }
  };

  const handleAccountNumberClick = (accountNumber) => {
    if (expandedAccountNumber === accountNumber) {
      setExpandedAccountNumber(null);
      setShowWithdrawals(false);
      setHistorySearchQuery('');
    } else {
      setExpandedAccountNumber(accountNumber);
      setShowWithdrawals(true);
      setHistoryType('withdraw');
      setHistorySearchQuery('');
      fetchWithdrawals(accountNumber);
      fetchDeposits(accountNumber);
      const account = accounts.find(acc => acc.account_number === accountNumber);
      setSelectedAccount(account);
    }
  };

  const has_ongoing_loan = (account_number) => {
    return accountLoans.some(loan => {
      const isThisAccount = loan.account === account_number;
      const isOngoing = loan.status.toLowerCase() === 'ongoing';
      const isFullyPaid = loan.payment_schedules?.every(
        (schedule) => schedule.status?.toLowerCase() === 'paid'
      );
      return isThisAccount && isOngoing && !isFullyPaid;
    });
  };

  const openForm = (account, type) => {
  if (type === 'withdraw') {
    // Full withdrawal (Leave) - Show NOTICE modal first
    setModalContent({
      message: `Notice!: Your Account will be marked Inactive.\n\nDo you want to withdraw the full amount of ₱${formatNumber(account.shareCapital)}?`,
      onConfirm: () => {
        // After clicking Yes on Notice, show Board Resolution modal
        setPendingWithdrawalData({ account, type, isFullWithdraw: true });
        setShowBoardResolutionModal(true);
        closeModal();
      },
    });
    setShowModal(true);
    return;
  }
  // Deposit or Partial Withdraw - Open form directly
  setSelectedAccount(account);
  setActionType(type);
  setShowForm(true);
};

  const hasMaximumShareCapital = (shareCapital) => {
    return Number(shareCapital) >= 1000000;
  };

  const handleDepositWithdrawErrors = (error) => {
    if (actionType === 'deposit') {
      if (error.response && error.response.data) {
        if (error.response.data.amount < 50000) {
          return 'The deposit amount must be at least 50,000.';
        } else if (error.response.data.amount > 1000000) {
          return 'The account already has the maximum allowed share capital of 1,000,000.';
        }
      }
      return 'Deposits must be between 50,000 and 1,000,000.';
    } else if (actionType === 'withdraw') {
      if (error.response && error.response.data) {
        return 'No share capital available to be withdrawn.';
      }
      return 'You have No Share Capital amount to withdraw.';
    }
    return 'An unexpected error occurred.';
  };

  const openArchiveConfirmation = (account) => {
    setModalContent({
      message: `Are you sure you want to move this account to archive?\n\nThis action will remove the account from active records.`,
      onConfirm: () => {
        archiveAccount(account);
        closeModal();
      },
    });
    setShowModal(true);
  };

  const archiveAccount = async (account) => {
    try {
      const archivePayload = {
        archive_type: 'Account',
        archived_data: account,
        id: account.id,
        account_number: account.account_number,
      };

      const accountArchiveResponse = await axios.post(`${process.env.REACT_APP_API_URL}/archives/`, archivePayload);
      await axios.delete(`${process.env.REACT_APP_API_URL}/accounts/${account.account_number}/`);
      console.log(`✅ Account ${account.account_number} archived.`);

      const holder = account.account_holder;

      if (!holder) {
        console.warn(`⚠️ No account_holder found for account ${account.account_number}. Member will not be archived.`);
      } else {
        const memberId = holder.memId || holder.member_id || holder.id;
        if (!memberId) {
          console.warn(`⚠️ Could not extract member ID for account ${account.account_number}`);
        } else {
          try {
            const memberDetails = await axios.get(`${process.env.REACT_APP_API_URL}/members/${memberId}/`);
            const memberArchivePayload = {
              archive_type: 'Member',
              archived_data: memberDetails.data,
            };
            await axios.post(`${process.env.REACT_APP_API_URL}/archives/`, memberArchivePayload);
            console.log(`👤 Member ${memberId} archived.`);
          } catch (memberErr) {
            console.error(`❌ Failed to fetch/archive member ${memberId}:`, memberErr.response?.data || memberErr.message);
          }
        }
      }

      setNotificationMessage('Account and Member successfully archived.');
      setTimeout(() => setNotificationMessage(''), 4000);
      setAccounts(prev => prev.filter(acc => acc.account_number !== account.account_number));
      setRefreshArchives(prev => !prev);

    } catch (err) {
      console.error('❌ Error archiving account/member:', err.response?.data || err.message);
      setNotificationMessage(`An error occurred: ${err.response?.data?.message || err.message || 'Unknown error'}`);
      setTimeout(() => setNotificationMessage(''), 4000);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setModalContent(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setActionType('');
    fetchAccounts();
    if (showWithdrawals && expandedAccountNumber) {
      fetchWithdrawals(expandedAccountNumber);
      fetchDeposits(expandedAccountNumber);
    }
    setSelectedAccount(null);
  };

  const handleBoardResolutionSubmit = () => {
  if (!boardResolutionNumber.trim()) {
    alert('Please enter a Board Resolution Number');
    return;
  }

  const { account, type, isFullWithdraw } = pendingWithdrawalData;

  if (type === 'withdraw' && isFullWithdraw) {
    // After board resolution is entered, open the form
    setSelectedAccount({ 
      ...account, 
      fullWithdrawal: account.shareCapital,
      boardResolutionNumber: boardResolutionNumber
    });
    setActionType('withdraw');
    setShowForm(true);
    setBoardResolutionNumber('');
    setShowBoardResolutionModal(false);
    setPendingWithdrawalData(null);
  }
};

  const closeBoardResolutionModal = () => {
    setShowBoardResolutionModal(false);
    setBoardResolutionNumber('');
    setPendingWithdrawalData(null);
  };

  const BoardResolutionModal = ({ isOpen }) => {
    if (!isOpen) return null;

    return (
      <>
        <div style={{
          position: 'fixed',
          top: '0', left: '0', right: '0', bottom: '0',
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999
        }} onClick={closeBoardResolutionModal}></div>
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '10px',
          width: '450px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 10000
        }}>
          <h2 style={{ marginTop: '0', marginBottom: '20px', fontSize: '20px', color: '#333' }}>
            Board Resolution Number
          </h2>
          <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
            Please enter the Board Resolution Number for this withdrawal transaction.
          </p>
          <input
            type="text"
            value={boardResolutionNumber}
            onChange={(e) => setBoardResolutionNumber(e.target.value)}
            placeholder="e.g., BR-2024-001"
            autoFocus
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '16px',
              marginBottom: '20px',
              boxSizing: 'border-box'
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleBoardResolutionSubmit();
              }
            }}
          />
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={closeBoardResolutionModal}
              style={{
                padding: '10px 20px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: '#f0f0f0',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleBoardResolutionSubmit}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#4CAF50',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </>
    );
  };

  const Modal = ({ isOpen, content }) => {
    if (!isOpen || !content) return null;

    return (
      <div style={{
        position: 'fixed',
        top: '0', left: '0', right: '0', bottom: '0',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '10px',
          textAlign: 'center',
          width: '420px'
        }}>
          <p style={{ fontSize: '18px', marginBottom: '20px' }}>
            {content.message.split('\n').map((line, index) => {
              if (line.trim().toLowerCase().startsWith('notice')) {
                const [noticeWord, ...rest] = line.split(':');
                return (
                  <React.Fragment key={index}>
                    <span style={{ color: 'red', fontWeight: 'bold' }}>{noticeWord}:</span>
                    <span> {rest.join(':')}</span>
                    <br />
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={index}>
                  {line}
                  <br />
                </React.Fragment>
              );
            })}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button onClick={content.onConfirm} style={{ padding: '8px 16px' }}>Yes</button>
            <button onClick={closeModal} style={{ padding: '8px 16px' }}>No</button>
          </div>
        </div>
      </div>
    );
  };

  const BlurOverlay = () => (
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
  );

  const NotificationBox = ({ message, onClose }) => {
    if (!message) return null;

    return (
      <div
        style={{ 
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#4CAF50',
          padding: '20px 30px',
          borderRadius: '8px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          fontSize: '18px',
          textAlign: 'center',
          zIndex: 9999,
          minWidth: '300px',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <style>
            {`
              @keyframes fadeIn {
                from { opacity: 0; transform: translate(-50%, -60%); }
                to { opacity: 1; transform: translate(-50%, -50%); }
              }
            `}
          </style>
        <p style={{ fontSize: '18px', color: 'black', marginBottom: '20px' }}>{message}</p>
        <button onClick={onClose} style={{
          padding: '6px 20px',
          border: 'none',
          backgroundColor: '#007BFF',
          color: 'white',
          borderRadius: '5px',
          cursor: 'pointer'
        }}>OK</button>
      </div>
    );
  };

  const getAccountHolderName = (member) => {
    if (member && member.first_name && member.middle_name && member.last_name) {
      return `${member.first_name} ${member.middle_name} ${member.last_name}`;
    }
    return 'Member Not Found';
  };

  const filteredAccounts = accounts.filter((account) => {
    const accountNumber = account.account_number.toString();
    const accountHolderName = getAccountHolderName(account.account_holder).toLowerCase();
    return (
      accountNumber.includes(searchQuery.toLowerCase()) ||
      accountHolderName.includes(searchQuery.toLowerCase())
    );
  });

  // Filter history transactions based on search query
  const filterHistoryTransactions = (transactions) => {
    if (!historySearchQuery.trim()) return transactions;

    return transactions.filter(transaction => {
      const searchLower = historySearchQuery.toLowerCase();
      
      // Search in OR Number (for withdrawals only)
      const orNum = (transaction.or_number || '').toLowerCase();
      
      // Search in Board Resolution
      const boardRes = (transaction.board_resolution || transaction.board_resolution_number || '').toLowerCase();
      
      // Search in Date
      const date = transaction.timestamp || transaction.date || '';
      const formattedDate = new Date(date).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      }).toLowerCase();
      
      return orNum.includes(searchLower) || 
             boardRes.includes(searchLower) || 
             formattedDate.includes(searchLower);
    });
  };

  if (loadingAccounts) {
    return <div>Loading...</div>;
  }

  if (error) {
    const errorMessage = handleDepositWithdrawErrors(error);
    return <div style={{ fontSize: '30px' }}>{errorMessage}</div>;
  }

  return (
    <div style={{ width: '99%', padding: '10px' }}>
      {(notificationMessage || showModal) && <BlurOverlay />}
      <h2 style={{ width: '97%', padding: '20px', textAlign: 'center', color: 'black', fontSize: '30px', marginTop: '-45px' }}>
        SHARE CAPITAL
      </h2>

      {!showForm && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <input
              type="text"
              placeholder="Search Accounts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '7px 10px',
                fontSize: '16px',
                borderRadius: '4px',
                width: '250px',
                marginBottom: '10px',
              }}
            />
          </div>

          <div
            style={{
              maxHeight: '440px',
              overflowY: 'auto',
              boxShadow: '0px 0px 15px 0px rgb(154, 154, 154)',
              marginTop: '20px',
              padding: '5px',
              borderRadius: '5px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <style>
              {`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}
            </style>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid black', position: 'sticky', top: '-5px', fontSize: '14px', backgroundColor: '#fff', zIndex: 1 }}>
                  <th style={{ padding: '5px', textAlign: 'left' }}>Account Number</th>
                  <th style={{ padding: '5px', textAlign: 'left' }}>Member</th>
                  <th style={{ padding: '5px', textAlign: 'left' }}>Share Capital</th>
                  <th style={{ padding: '5px', textAlign: 'left' }}>Share</th>
                  {/* <th style={{ padding: '5px', textAlign: 'left' }}>OR Number</th> */}
                  <th style={{ padding: '5px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '5px', textAlign: 'left' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => {
                  const disabledLeave = has_ongoing_loan(account.account_number);
                  const canWithdraw = account.shareCapital > 50000;
                  
                  return (
                    <React.Fragment key={account.account_number}>
                      <tr style={{ fontSize: '14px' }}>
                        <td 
                          style={{ 
                            padding: '5px', 
                            color: ' #001eff', 
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            fontWeight: expandedAccountNumber === account.account_number ? 'bold' : 'normal'
                          }}
                          onClick={() => handleAccountNumberClick(account.account_number)}
                        >
                          {account.account_number}
                        </td>
                        <td style={{ padding: '5px' }}>{getAccountHolderName(account.account_holder)}</td>
                        <td style={{ padding: '5px' }}>₱{formatNumber(account.shareCapital)}</td>
                        <td style={{ padding: '5px' }}>₱{formatNumber(Math.min(account.shareCapital || 0, 1000000) / 1000)}</td>
                        {/* <td style={{ padding: '5px' }}>
                          {account.or_number || 'N/A'}
                        </td> */}
                        <td style={{ padding: '5px', color: account.status.toLowerCase() === 'active' ? 'green' : 'red', fontWeight: 'bold', textTransform: 'capitalize' }}>{account.status}</td>

                        <td style={{ padding: '5px', display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {account.status.toLowerCase() === 'active' ? (
                            <>
                              <button
                                onClick={() => {
                                  if (hasMaximumShareCapital(account.shareCapital)) {
                                    setModalContent({
                                      message: "This account has reached the maximum share capital limit of ₱1,000,000.00. No more deposits are allowed.",
                                      onConfirm: closeModal,
                                    });
                                    setShowModal(true);
                                    return;
                                  }
                                  openForm(account, 'deposit');
                                }}
                                disabled={hasMaximumShareCapital(account.shareCapital)}
                                title={hasMaximumShareCapital(account.shareCapital) ? 'Maximum share capital reached' : ''}
                                style={{
                                  borderRadius: '15px',
                                  padding: '5px',
                                  cursor: hasMaximumShareCapital(account.shareCapital) ? 'not-allowed' : 'pointer',
                                  color: hasMaximumShareCapital(account.shareCapital) ? 'red' : 'black',  // Already red ✓
                                  width: '50px',
                                  opacity: hasMaximumShareCapital(account.shareCapital) ? '1' : '1',
                                  fontSize: '14px',
                                }}
                              >
                                <PiHandDepositFill /> Deposit
                              </button>

                              <button
                                onClick={() => {
                                  if (!canWithdraw) {
                                    setModalContent({
                                      message: "Cannot withdraw: Account balance must be greater than ₱50,000 to make a withdrawal.",
                                      onConfirm: closeModal,
                                    });
                                    setShowModal(true);
                                    return;
                                  }
                                  openForm(account, 'partialWithdraw');
                                }}
                                disabled={!canWithdraw}
                                title={
                                  !canWithdraw
                                    ? 'Balance must be > ₱50,000 to withdraw' 
                                    : 'Withdraw while maintaining ₱50,000 minimum balance'
                                }
                                style={{
                                  cursor: canWithdraw ? 'pointer' : 'not-allowed',
                                  borderRadius: '15px',
                                  padding: '5px',
                                  color: canWithdraw ? 'black' : 'red',  // Change this line
                                  width: '55px',
                                  fontSize: '14px',
                                  opacity: canWithdraw ? 1 : 0.6
                                }}
                              >
                                <BiMoneyWithdraw /> 
                                Withdraw
                              </button>

                              <button
                                onClick={() => {
                                  if (disabledLeave) {
                                    setModalContent({
                                      message: "Cannot leave: You have an ongoing loan that must be fully paid first.",
                                      onConfirm: closeModal,
                                    });
                                    setShowModal(true);
                                    return;
                                  }
                                  openForm(account, 'withdraw');
                                }}
                                disabled={disabledLeave}
                                title={disabledLeave ? 'Cannot leave with ongoing loan' : 'Full withdrawal and close account'}
                                style={{
                                  cursor: disabledLeave ? 'not-allowed' : 'pointer',
                                  borderRadius: '15px',
                                  padding: '5px',
                                  color: disabledLeave ? 'red' : 'black',  // Change this line
                                  width: '35px',
                                  fontSize: '14px',
                                  opacity: disabledLeave ? 0.6 : 1
                                }}
                              >
                                <BiExit /> Leave
                              </button>

                            </>
                          ) : (
                            <button
                              onClick={() => openArchiveConfirmation(account)}
                              style={{
                                border: '0px',
                                padding: '5px',
                                cursor: 'pointer',
                                color: 'black',
                                backgroundColor: 'goldenrod',
                                width: '100px',
                              }}
                            >
                              Move to Archive
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* History row that appears below when account number is clicked */}
                      {expandedAccountNumber === account.account_number && showWithdrawals && (
                        <tr>
                          <td colSpan="7" style={{ padding: '10px', backgroundColor: '#f9f9f9' }}>
                            <div style={{
                              boxShadow: '0px 0px 10px 0px rgba(154, 154, 154, 0.3)',
                              padding: '10px',
                              borderRadius: '6px',
                              backgroundColor: 'white'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <h3 style={{ margin: 0, fontSize: '16px' }}>Share Capital History — {account.account_number}</h3>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      onClick={() => setHistoryType('withdraw')}
                                      style={{ 
                                        border: '1px solid #ccc', 
                                        background: historyType === 'withdraw' ? '#24e741ff' : '#fff', 
                                        borderRadius: '6px', 
                                        padding: '4px 10px', 
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600'
                                      }}
                                    >
                                      Withdrawals
                                    </button>
                                    
                                    <button
                                      onClick={() => setHistoryType('deposit')}
                                      style={{ 
                                        border: '1px solid #ccc', 
                                        background: historyType === 'deposit' ? '#24e741ff' : '#fff', 
                                        borderRadius: '6px', 
                                        padding: '4px 10px', 
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600'
                                      }}
                                    >
                                      Deposits
                                    </button>

                                    <button
                                      onClick={() => {
                                        fetchWithdrawals(account.account_number);
                                        fetchDeposits(account.account_number);
                                      }}
                                      style={{ 
                                        border: '1px solid #ccc', 
                                        background: '#fff', 
                                        borderRadius: '6px', 
                                        padding: '4px 10px', 
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600'
                                      }}
                                    >
                                      Refresh
                                    </button>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <input
                                    type="text"
                                    placeholder="Search OR, Board Resolution, Date..."
                                    value={historySearchQuery}
                                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '13px',
                                      borderRadius: '4px',
                                      border: '1px solid #ccc',
                                      width: '250px',
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      setShowWithdrawals(false);
                                      setExpandedAccountNumber(null);
                                      setHistorySearchQuery('');
                                    }}
                                    style={{ 
                                      border: '1px solid #ccc', 
                                      background: '#ff0000ff', 
                                      borderRadius: '6px', 
                                      padding: '4px 10px', 
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      fontWeight: '600',
                                      color: 'white'
                                    }}
                                  >
                                    Close
                                  </button>
                                </div>
                              </div>

                              <div style={{ 
                                maxHeight: '240px', 
                                overflowY: 'auto',
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                                position: 'relative'
                              }}>
                                <style>
                                  {`
                                    div::-webkit-scrollbar {
                                      display: none;
                                    }
                                  `}
                                </style>
                                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                  <thead>
                                    <tr style={{ 
                                      position: 'sticky',
                                      top: 0,
                                    }}>
                                      <th style={{ width: '50px',padding: '6px', textAlign: 'left', fontSize: '13px', borderBottom: '1px solid #000000ff', backgroundColor: '#b6b6b6ff' }}>Date</th>
                                      <th style={{ width: '50px',padding: '6px', textAlign: 'left', fontSize: '13px', borderBottom: '1px solid #000000ff', backgroundColor: '#b6b6b6ff' }}>Amount</th>
                                      {historyType === 'withdraw' && (
                                        <>
                                          <th style={{ width: '50px',padding: '6px', textAlign: 'left', fontSize: '13px', borderBottom: '1px solid #000000ff', backgroundColor: '#b6b6b6ff'}}>OR Number</th>
                                          <th style={{ width: '50px',padding: '6px', textAlign: 'left', fontSize: '13px', borderBottom: '1px solid #000000ff', backgroundColor: '#b6b6b6ff'}}>Board Resolution</th>
                                        </>
                                      )}
                                      <th style={{ width: '50px',padding: '6px', textAlign: 'left', fontSize: '13px', borderBottom: '1px solid #000000ff', backgroundColor: '#b6b6b6ff'}}>Type</th>
                                      <th style={{ width: '120px',padding: '6px', textAlign: 'left', fontSize: '13px', borderBottom: '1px solid #000000ff', backgroundColor: '#b6b6b6ff'}}>Notes</th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {filterHistoryTransactions(historyType === 'withdraw' ? withdrawals : deposits).length === 0 ? (
                                      <tr>
                                        <td colSpan={historyType === 'withdraw' ? 6 : 4} style={{ padding: '10px', color: '#666', textAlign: 'center', fontSize: '12px' }}>
                                          {historySearchQuery.trim() ? `No ${historyType} transactions match your search.` : `No ${historyType} transactions found.`}
                                        </td>
                                      </tr>
                                    ) : (
                                      filterHistoryTransactions(historyType === 'withdraw' ? withdrawals : deposits).map((transaction, idx) => {
                                        const date = transaction.timestamp || transaction.date || '—';
                                        const amount = transaction.amount || 0;
                                        const orNum = transaction.or_number || 'N/A';
                                        const brn = transaction.board_resolution || transaction.board_resolution_number || '';
                                        const type = transaction.transaction_type || (historyType === 'withdraw' ? 'Withdraw' : 'Deposit');
                                        const notes = transaction.description || transaction.notes || '';
                                        
                                        return (
                                          <tr key={`tx-${idx}`} style={{ borderBottom: '1px solid #000000ff' }}>
                                            <td style={{ padding: '6px', fontSize: '13px', color: 'black', borderBottom: '1px solid #565656ff' }}>
                                              {new Date(date).toLocaleDateString('en-PH', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: '2-digit'
                                              })}
                                            </td>
                                            <td style={{ padding: '6px', fontSize: '13px', color: 'black', borderBottom: '1px solid #565656ff' }}>₱{formatNumber(parseFloat(amount) || 0)}</td>
                                            {historyType === 'withdraw' && (
                                              <>
                                                <td style={{ padding: '6px', fontSize: '13px', color: 'black', borderBottom: '1px solid #565656ff'  }}>{orNum}</td>
                                                <td style={{ padding: '6px', fontSize: '13px', color: 'black', borderBottom: '1px solid #565656ff'  }}>{brn || '—'}</td>
                                              </>
                                            )}
                                            <td style={{ padding: '6px', fontSize: '13px', color: 'black', borderBottom: '1px solid #565656ff' }}>{type}</td>
                                            <td style={{ padding: '6px', fontSize: '13px', color: 'black', borderBottom: '1px solid #565656ff'  }}>{notes || '—'}</td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
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
        </>
      )}

      {showForm && (
        <DepositWithdrawForm
          onClose={closeForm}
          account={selectedAccount}
          actionType={actionType}
          fetchAccounts={fetchAccounts}
          setError={setError}
          onTransactionComplete={handleTransactionComplete}
        />
      )}

      <BoardResolutionModal isOpen={showBoardResolutionModal} />
      <Modal isOpen={showModal} content={modalContent} />
      <NotificationBox message={notificationMessage} onClose={() => setNotificationMessage('')} />
    </div>
  );
}

export default Accounts;