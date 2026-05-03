import React, { useState, useEffect } from 'react';
import { db, functions } from './firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { DollarSign, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

function Withdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadWithdrawals();
  }, [filter]);

  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(
        query(collection(db, 'withdrawals'), orderBy('requested_at', 'desc'))
      );

      let withdrawalsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (filter !== 'all') {
        withdrawalsList = withdrawalsList.filter(w => w.status === filter);
      }

      setWithdrawals(withdrawalsList);
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Approve ───────────────────────────────────────────────
  // Calls the approveWithdrawal Cloud Function which marks
  // the withdrawal as completed server-side.
  // You still need to manually send the money via PayPal.

  const handleApprove = async (withdrawalId, withdrawal) => {
    if (!window.confirm(
      `Approve withdrawal of $${withdrawal.amount?.toFixed(2)} to ${withdrawal.paypal_email}?\n\nRemember to send the money manually via PayPal.`
    )) return;

    setProcessingId(withdrawalId);
    try {
      const approveWithdrawal = httpsCallable(functions, 'approveWithdrawal');
      await approveWithdrawal({ withdrawalId });
      await loadWithdrawals();
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      alert('Failed to approve withdrawal: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  // ── Reject ────────────────────────────────────────────────
  // Calls the rejectWithdrawal Cloud Function which marks
  // the withdrawal as rejected and automatically returns
  // the balance to the user's wallet.

  const handleReject = async (withdrawalId) => {
    const reason = window.prompt('Rejection reason (shown to user):');
    if (!reason || reason.trim().length === 0) return;

    setProcessingId(withdrawalId);
    try {
      const rejectWithdrawal = httpsCallable(functions, 'rejectWithdrawal');
      await rejectWithdrawal({ withdrawalId, reason: reason.trim() });
      await loadWithdrawals();
    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
      alert('Failed to reject withdrawal: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="status-badge pending"><Clock size={14} /> Pending</span>;
      case 'processing':
        return <span className="status-badge pending"><RefreshCw size={14} className="spinner" /> Processing</span>;
      case 'completed':
        return <span className="status-badge completed"><CheckCircle size={14} /> Completed</span>;
      case 'rejected':
        return <span className="status-badge rejected"><XCircle size={14} /> Rejected</span>;
      default:
        return null;
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  // Count pending for header
  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;

  return (
    <div className="withdrawals-container">
      <div className="withdrawals-header">
        <div className="header-left">
          <DollarSign size={32} className="header-icon" />
          <div>
            <h1>Withdrawal Requests</h1>
            <p className="subtitle">
              {withdrawals.length} withdrawal{withdrawals.length !== 1 ? 's' : ''}
              {filter === 'pending' && pendingCount > 0 && (
                <span style={{ color: '#f97316', marginLeft: 8 }}>
                  — send PayPal payments manually before approving
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <div className="filter-buttons">
            {['pending', 'completed', 'rejected', 'all'].map(f => (
              <button
                key={f}
                className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={loadWithdrawals}
            disabled={loading}
            className="btn btn-secondary"
          >
            {loading ? <RefreshCw className="spinner" size={16} /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>
      </div>

      {loading && withdrawals.length === 0 ? (
        <div className="loading-state">
          <RefreshCw className="spinner" size={32} />
          <p>Loading withdrawals...</p>
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="empty-state">
          <DollarSign size={48} />
          <h3>No withdrawals found</h3>
          <p>No {filter !== 'all' ? filter : ''} withdrawal requests at the moment</p>
        </div>
      ) : (
        <div className="withdrawals-list">
          {withdrawals.map(withdrawal => (
            <div key={withdrawal.id} className="withdrawal-card">
              <div className="withdrawal-header">
                <div className="withdrawal-info">
                  <div className="withdrawal-amount">
                    ${withdrawal.amount?.toFixed(2) || '0.00'}
                  </div>
                  <div className="withdrawal-user">
                    User ID: {withdrawal.user_id}
                  </div>
                </div>
                {getStatusBadge(withdrawal.status)}
              </div>

              <div className="withdrawal-details">
                <div className="detail-row">
                  <span className="label">PayPal Email:</span>
                  <span className="value">{withdrawal.paypal_email || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Requested:</span>
                  <span className="value">{formatDate(withdrawal.requested_at)}</span>
                </div>
                {withdrawal.processed_at && (
                  <div className="detail-row">
                    <span className="label">Processed:</span>
                    <span className="value">{formatDate(withdrawal.processed_at)}</span>
                  </div>
                )}
                {withdrawal.payout_reference && (
                  <div className="detail-row">
                    <span className="label">Reference:</span>
                    <span className="value">{withdrawal.payout_reference}</span>
                  </div>
                )}
                {withdrawal.status === 'rejected' && (
                  <div className="detail-row">
                    <span className="label">Refunded:</span>
                    <span className="value">{withdrawal.refunded ? 'Yes — balance returned' : 'No'}</span>
                  </div>
                )}
                {withdrawal.rejection_reason && (
                  <div className="detail-row rejection-reason">
                    <AlertTriangle size={14} />
                    <span>{withdrawal.rejection_reason}</span>
                  </div>
                )}
              </div>

              {withdrawal.status === 'pending' && (
                <div className="withdrawal-actions">
                  <button
                    onClick={() => handleApprove(withdrawal.id, withdrawal)}
                    disabled={processingId === withdrawal.id}
                    className="btn btn-success"
                  >
                    {processingId === withdrawal.id
                      ? <RefreshCw className="spinner" size={14} />
                      : <CheckCircle size={14} />
                    }
                    Mark as Sent
                  </button>
                  <button
                    onClick={() => handleReject(withdrawal.id)}
                    disabled={processingId === withdrawal.id}
                    className="btn btn-danger"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Withdrawals;