import React, { useState, useEffect } from 'react';
import axios from 'axios';

// ErrorModal Component
const ErrorModal = ({ message, onClose }) => {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

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
          background: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(5px)',
          zIndex: 9998,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '53%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#edededff',
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

// SuccessModal Component
const SuccessModal = ({ message, onClose }) => {
  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

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
          background: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(5px)',
          zIndex: 9998,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#00c02dff',
          color: '#000000ff',
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
        <span role="img" aria-label="success check mark">✅</span> {message}
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

function DepositWithdrawForm({
  account,
  actionType,
  onClose,
  fetchAccounts,
  setError,
  onTransactionComplete,
}) {
  const [amount, setAmount] = useState('');
  const [formattedShareCapital, setFormattedShareCapital] = useState('');
  const [isInactive, setIsInactive] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [orNumber, setOrNumber] = useState('');
  const [boardResolution, setBoardResolution] = useState('');
  const [orError, setOrError] = useState('');
  const [step, setStep] = useState(1);

  // Determine if this is a full withdrawal (Leave button)
  const isFullWithdrawal = actionType === 'withdraw' && account.fullWithdrawal;
  const isPartialWithdrawal = actionType === 'partialWithdraw';
  const isWithdrawFlow = isFullWithdrawal || isPartialWithdrawal;

  const formatAmount = (value) => {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  useEffect(() => {
    setFormattedShareCapital(formatAmount(account.shareCapital || 0));
    setIsInactive(account.status === 'Inactive');
    
    // Set board resolution if it was passed from parent (for full withdrawal)
    if (account.boardResolutionNumber) {
      setBoardResolution(account.boardResolutionNumber);
    }
    
    // For full withdrawal, pre-fill the amount and skip to OR number step
    if (isFullWithdrawal) {
      setAmount(formatAmount(account.shareCapital));
      setStep(3); // Jump directly to OR number step
    } else if (isWithdrawFlow) {
      setStep(1); // Board resolution step for partial withdrawal
    } else {
      setStep(1); // Amount step for deposits
    }
  }, [account, isFullWithdrawal, isWithdrawFlow]);

  const handleAmountChange = (e) => {
    const formattedAmount = e.target.value
      .replace(/\D/g, '')
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setAmount(formattedAmount);
  };

  const validateBoardResolution = () => {
    if (!boardResolution || boardResolution.trim().length < 2) {
      setErrorMessage('Please enter a valid Board Resolution number.');
      return false;
    }
    return true;
  };

  const validateAmount = () => {
    const numericAmount = parseFloat((amount || '0').replace(/,/g, ''));
    const currentShareCapital = parseFloat(account.shareCapital || 0);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage(
        actionType === 'deposit'
          ? 'Invalid amount for deposit.'
          : 'Invalid amount for withdrawal.'
      );
      return false;
    }

    if (actionType === 'deposit') {
      if (currentShareCapital + numericAmount > 1000000) {
        setErrorMessage(
          `Deposit failed: Total balance cannot exceed ₱1,000,000. Current balance is ₱${currentShareCapital.toLocaleString()}`
        );
        return false;
      }
      if (numericAmount < 1 || numericAmount > 950000) {
        setErrorMessage('Deposit must be between 1 and 950,000 only!');
        return false;
      }
    } else if (isPartialWithdrawal) {
      // Partial withdrawal must maintain 50k minimum
      const remainingBalance = currentShareCapital - numericAmount;
      if (remainingBalance < 50000) {
        setErrorMessage(
          'Cannot withdraw: Must maintain minimum balance of ₱50,000'
        );
        return false;
      }
      if (numericAmount > currentShareCapital - 50000) {
        setErrorMessage(
          `Maximum withdrawal amount is ₱${(
            currentShareCapital - 50000
          ).toLocaleString()}`
        );
        return false;
      }
    }
    // For full withdrawal, no validation needed - amount is already set to full balance
    return true;
  };

  const validateOrNumber = () => {
    if (!orNumber || !/^\d{4}$/.test(orNumber)) {
      setErrorMessage('Please enter a valid 4-digit OR number.');
      return false;
    }
    return true;
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (isInactive) {
      setErrorMessage('Account is inactive. Cannot perform transactions.');
      return;
    }
    if (!isWithdrawFlow) return;
    
    if (step === 1) {
      if (validateBoardResolution()) setStep(2);
      return;
    }
    if (step === 2) {
      if (validateAmount()) setStep(3);
      return;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isInactive) {
      setErrorMessage('Account is inactive. Cannot perform transactions.');
      return;
    }

    if (isWithdrawFlow) {
      if (step === 1 && !validateBoardResolution()) return;
      if (step === 2 && !validateAmount()) return;
      if (step === 3 && !validateOrNumber()) return;
    } else {
      if (!validateAmount()) return;
    }

    try {
      const currentShareCapital = parseFloat(account.shareCapital || 0);
      let numericAmount = parseFloat((amount || '0').replace(/,/g, ''));

      const endpoint =
        actionType === 'deposit'
          ? `${process.env.REACT_APP_API_URL}/accounts/${account.account_number}/deposit/`
          : `${process.env.REACT_APP_API_URL}/accounts/${account.account_number}/withdraw/`;

      const payload =
        actionType === 'deposit'
          ? { amount: numericAmount.toString() }
          : {
              amount: numericAmount.toString(),
              or_number: orNumber,
              board_resolution: boardResolution,
            };

      const response = await axios.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
      });

      console.log('Response:', response);

      if (actionType === 'deposit') {
        setSuccessMessage(
          `Deposit Successful! ₱${numericAmount.toLocaleString()} has been added to your account.`
        );
      } else {
        setSuccessMessage(
          `Withdrawal Successful! ₱${numericAmount.toLocaleString()} has been withdrawn from your account.`
        );
      }

      // Notify parent so the OR column/table updates immediately
      if (onTransactionComplete) {
        onTransactionComplete({
          account,
          type: actionType,
          amount: numericAmount,
          orNumber: actionType === 'deposit' ? null : orNumber,
          boardResolution: actionType === 'deposit' ? null : boardResolution,
          timestamp: new Date().toISOString(),
        });
      }

      // For full withdrawal, mark account as inactive
      if (isFullWithdrawal) {
        await axios.patch(
          `${process.env.REACT_APP_API_URL}/accounts/${account.account_number}/`,
          { status: 'inactive' }
        );
        setIsInactive(true);
      }

      setTimeout(async () => {
        if (fetchAccounts) await fetchAccounts();
        onClose && onClose();
      }, 2100);
    } catch (err) {
      if (err.response) {
        console.error('Error response data:', err.response.data);
        setErrorMessage(
          err.response?.data?.error ||
            'An error occurred while processing your request.'
        );
      } else {
        setErrorMessage('An error occurred while processing your request.');
      }
    }
  };

  const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '420px',
    margin: '0 auto',
    padding: '20px',
    border: '0px',
    borderRadius: '8px',
    fontSize: '20px',
  };

  const buttonStyle = {
    padding: '10px',
    margin: '10px 5px',
    backgroundColor: '#007BFF',
    color: 'black',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    flex: '1',
  };

  const cancelButtonStyle = { backgroundColor: 'rgb(240, 50, 50)' };

  const headerStyle = {
    color: 'black',
    textAlign: 'center',
    marginBottom: '30px',
    marginTop: '30px',
  };

  const buttonContainerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '10px',
  };

  const stepIndicator = isWithdrawFlow && !isFullWithdrawal ? (
    <div style={{ textAlign: 'center', color: '#333', marginBottom: 10 }}>
      Step {step} of 3
    </div>
  ) : null;

  return (
    <div>
      <h2 style={headerStyle}>
        {actionType === 'deposit' ? 'Deposit' : isFullWithdrawal ? 'Full Withdrawal (Leave)' : 'Withdraw'} Funds
      </h2>

      <div style={{ marginBottom: '20px', textAlign: 'center', color: 'black' }}>
        <h3>Share Capital</h3>
        <p style={{ fontSize: '20px', fontWeight: 'bold' }}>
          ₱{formattedShareCapital}
        </p>
      </div>

      {isInactive ? (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <h3>Thank You!</h3>
          <p>Your account is inactive. No further actions are available.</p>
        </div>
      ) : (
        <form
          onSubmit={isWithdrawFlow && step < 3 ? handleNext : handleSubmit}
          style={formStyle}
        >
          {stepIndicator}

          {isWithdrawFlow ? (
            <>
              {/* For FULL withdrawal, skip board resolution (already entered) and amount (already set) */}
              {isFullWithdrawal && step === 3 && (
                <>
                  <div style={{ marginBottom: '20px', textAlign: 'center', color: '#333' }}>
                    <p><strong>Board Resolution:</strong> {boardResolution}</p>
                    <p><strong>Withdrawal Amount:</strong> ₱{amount}</p>
                  </div>
                  <label>
                    OR Number:
                    <input
                      type="text"
                      maxLength={4}
                      value={orNumber}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, '');
                        setOrNumber(v);
                        if (v.length === 4) setOrError('');
                        else setOrError('Enter 4-digit OR');
                      }}
                      required
                      style={{
                        padding: '10px',
                        margin: '10px 0',
                        border: '0px',
                        borderRadius: '4px',
                        fontSize: '16px',
                      }}
                      placeholder="0000"
                    />
                    {orError && (
                      <div
                        style={{
                          color: 'crimson',
                          fontSize: '14px',
                          marginTop: '4px',
                        }}
                      >
                        {orError}
                      </div>
                    )}
                  </label>
                </>
              )}

              {/* For PARTIAL withdrawal, show all 3 steps */}
              {isPartialWithdrawal && (
                <>
                  {step === 1 && (
                    <label>
                      Board Resolution No.:
                      <input
                        type="text"
                        value={boardResolution}
                        onChange={(e) => setBoardResolution(e.target.value)}
                        required
                        style={{
                          padding: '10px',
                          margin: '10px 0',
                          border: '0px',
                          borderRadius: '4px',
                          fontSize: '16px',
                        }}
                        placeholder="e.g., BR-2025-11-001"
                      />
                    </label>
                  )}

                  {step === 2 && (
                    <label>
                      Amount (Max: ₱{formatAmount(account.shareCapital - 50000)}):
                      <input
                        type="text"
                        value={amount}
                        onChange={handleAmountChange}
                        required
                        style={{
                          padding: '10px',
                          margin: '10px 0',
                          border: '0px',
                          borderRadius: '4px',
                          fontSize: '16px',
                        }}
                        placeholder="0.00"
                      />
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                        Must maintain ₱50,000 minimum balance
                      </div>
                    </label>
                  )}

                  {step === 3 && (
                    <label>
                      OR Number:
                      <input
                        type="text"
                        maxLength={4}
                        value={orNumber}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, '');
                          setOrNumber(v);
                          if (v.length === 4) setOrError('');
                          else setOrError('Enter 4-digit OR');
                        }}
                        required
                        style={{
                          padding: '10px',
                          margin: '10px 0',
                          border: '0px',
                          borderRadius: '4px',
                          fontSize: '16px',
                        }}
                        placeholder="0000"
                      />
                      {orError && (
                        <div
                          style={{
                            color: 'crimson',
                            fontSize: '14px',
                            marginTop: '4px',
                          }}
                        >
                          {orError}
                        </div>
                      )}
                    </label>
                  )}
                </>
              )}

              <div style={buttonContainerStyle}>
                {isPartialWithdrawal && step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    style={buttonStyle}
                  >
                    Back
                  </button>
                ) : (
                  <span />
                )}

                {step < 3 && isPartialWithdrawal ? (
                  <button type="submit" style={buttonStyle}>
                    Next
                  </button>
                ) : (
                  <button type="submit" style={buttonStyle}>
                    Submit
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  style={{ ...buttonStyle, ...cancelButtonStyle }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <label>
                Amount:
                <input
                  type="text"
                  value={amount}
                  onChange={handleAmountChange}
                  required
                  style={{
                    padding: '10px',
                    margin: '10px 0',
                    border: '0px',
                    borderRadius: '4px',
                    fontSize: '16px',
                  }}
                  placeholder="0.00"
                />
              </label>

              <div style={buttonContainerStyle}>
                <button type="submit" style={buttonStyle}>
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ ...buttonStyle, ...cancelButtonStyle }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {errorMessage && (
        <ErrorModal message={errorMessage} onClose={() => setErrorMessage(null)} />
      )}

      {successMessage && (
        <SuccessModal
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </div>
  );
}

export default DepositWithdrawForm;