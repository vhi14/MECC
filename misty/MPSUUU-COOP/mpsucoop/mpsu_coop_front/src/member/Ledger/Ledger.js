import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const Ledger = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Support both storage keys used across the app
  const accountNumber = localStorage.getItem('account_number') || localStorage.getItem('accountN');
  const userRole = localStorage.getItem('userRole');

  useEffect(() => {
    setIsAdmin(userRole === 'admin');

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('accessToken');
        if (!accountNumber || !token) {
          setError('Account number or token is missing. Please log in again.');
          setLoading(false);
          return;
        }

        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/account/${accountNumber}/transactions/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = Array.isArray(response?.data?.transactions)
          ? response.data.transactions
          : [];

        // Frontend sanitization: ensure deposits have blanks (no "—")
        const cleaned = data.map((t) => sanitizeTransaction(t));
        setTransactions(cleaned);
      } catch (err) {
        setError('Failed to fetch transactions. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [accountNumber, userRole]);

  // Helpers

  function isDepositType(typeRaw) {
    const t = String(typeRaw || '').trim().toUpperCase();
    return t === 'INITIAL' || t.includes('DEPOSIT'); // matches "Initial Deposit", "Deposit", etc.
  }

  function normalizeBlank(v) {
    if (v == null) return '';
    const s = String(v).trim();
    // Treat these as blanks
    return ['—', '-', 'None', 'none', 'NULL', 'null', ''].includes(s) ? '' : s;
  }

  function sanitizeTransaction(t) {
    const deposit = isDepositType(t?.transaction_type);

    // Normalize placeholders first
    const or_number = normalizeBlank(t?.or_number);
    const board_resolution = normalizeBlank(t?.board_resolution);

    // For deposits, force blanks regardless of what backend sends
    const final_or = deposit ? '' : or_number;
    const final_board = deposit ? '' : board_resolution;

    return {
      ...t,
      or_number: final_or,
      board_resolution: final_board,
    };
  }

  function coerceDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatPHDate(d) {
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatPHDateTime(d) {
    return d.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const latestTransactionDate = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) return null;
    const dateFields = ['timestamp', 'transaction_date', 'payment_date', 'date', 'created_at'];
    let latest = null;
    for (const t of transactions) {
      for (const f of dateFields) {
        if (t && t[f]) {
          const d = coerceDate(t[f]);
          if (d && (!latest || d.getTime() > latest.getTime())) latest = d;
        }
      }
    }
    return latest;
  }, [transactions]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(Number(amount || 0));

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '20px' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ color: 'red', textAlign: 'center', marginTop: '20px' }}>{error}</div>;
  }

  return (
    <div className="member-page">
      <div className="member-page__content" style={{ fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '8px' }}>
        {isAdmin ? 'All Transactions' : 'Your Transactions'}
      </h1>

      {/* Latest Transaction date (dynamic) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '16px',
          color: '#374151',
          fontSize: '16px',
        }}
      >
        <span role="img" aria-label="calendar" style={{ marginRight: '6px' }}>
          📅
        </span>
        <strong style={{ marginRight: '6px' }}>Latest Transaction:</strong>
        <span>{latestTransactionDate ? formatPHDate(latestTransactionDate) : ''}</span>
      </div>

      <table
        border="1"
        cellPadding="5"
        cellSpacing="0"
        style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}
      >
        <caption style={{ captionSide: 'top', fontWeight: 'bold', marginBottom: '10px' }}>
          {isAdmin
            ? 'Overview of all account transactions'
            : 'A detailed view of your account transactions'}
        </caption>
        <thead style={{ backgroundColor: '#f4f4f4' }}>
          <tr>
            <th>Transaction Type</th>
            <th>Amount</th>
            <th>Description</th>
            <th>OR Number</th>
            <th>Board Resolution</th>
            <th>Total</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => {
            const type = transaction.transaction_type;
            const deposit = isDepositType(type);

            // OR Number: deposits blank if missing; non-deposits show value or “—”
            const explicitOR = normalizeBlank(transaction.or_number);
            let displayOR = '';
            if (deposit) {
              displayOR = explicitOR || '';
            } else {
              if (explicitOR) {
                displayOR = explicitOR;
              } else {
                // As a last resort for non-deposit, parse from description
                const desc = transaction.description || '';
                const m = desc.match(/\bOR\s+(\d{4,})\b/i);
                displayOR = m ? m[1] : '';
              }
            }

            // Board Resolution: deposits blank if missing; non-deposits “—” fallback
            const explicitBR = normalizeBlank(transaction.board_resolution);
            const displayBoardRes = deposit ? (explicitBR || '') : (explicitBR || '');

            // Totals and date
            const total = transaction.balance_after_transaction;
            const ts =
              coerceDate(transaction.timestamp) ||
              coerceDate(transaction.transaction_date) ||
              coerceDate(transaction.payment_date) ||
              coerceDate(transaction.date) ||
              coerceDate(transaction.created_at);

            return (
              <tr key={index}>
                <td>{type}</td>
                <td>{formatCurrency(transaction.amount)}</td>
                <td>{transaction.description}</td>
                <td>{displayOR}</td>
                <td>{displayBoardRes}</td>
                <td>{formatCurrency(total)}</td>
                <td>{ts ? formatPHDate(ts) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default Ledger;