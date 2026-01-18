import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, getDoc, Timestamp, increment } from 'firebase/firestore';
import { DollarSign, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

function Withdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('pending'); // 'all', 'pending', 'completed', 'rejected'
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
      
      // Filter client-side
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

  const handleApprove = async (withdrawalId) => {
    if (!window.confirm('Mark this withdrawal as completed?')) return;
    
    setProcessingId(withdrawalId);
    try {
      const withdrawalRef = doc(db, 'withdrawals', withdrawalId);
      await updateDoc(withdrawalRef, {
        status: 'completed',
        processed_at: Timestamp.now()
      });
      
      await loadWithdrawals();
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      alert('Failed to approve withdrawal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (withdrawalId) => {
    const reason = window.prompt('Rejection reason:');
    if (!reason) return;
    
    const shouldRefund = window.confirm('Refund money to user\'s wallet?\n\nClick OK to refund, Cancel to keep deducted.');
    
    setProcessingId(withdrawalId);
    try {
      // Get withdrawal data
      const withdrawalDoc = await getDoc(doc(db, 'withdrawals', withdrawalId));
      const withdrawalData = withdrawalDoc.data();
      
      if (!withdrawalData) {
        throw new Error('Withdrawal not found');
      }
      
      const { user_id, amount } = withdrawalData;
      
      // Update withdrawal status
      const withdrawalRef = doc(db, 'withdrawals', withdrawalId);
      await updateDoc(withdrawalRef, {
        status: 'rejected',
        processed_at: Timestamp.now(),
        rejection_reason: reason,
        refunded: shouldRefund
      });
      
      // Refund if admin chose to
      if (shouldRefund) {
        const userRef = doc(db, 'users', user_id);
        await updateDoc(userRef, {
          wallet_balance: increment(amount)
        });
      }
      
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

  return (
    <div className="withdrawals-container">
      <div className="withdrawals-header">
        <div className="header-left">
          <DollarSign size={32} className="header-icon" />
          <div>
            <h1>Withdrawal Requests</h1>
            <p className="subtitle">{withdrawals.length} withdrawal{withdrawals.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="filter-buttons">
            <button 
              className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('pending')}
            >
              Pending
            </button>
            <button 
              className={`btn ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('completed')}
            >
              Completed
            </button>
            <button 
              className={`btn ${filter === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('rejected')}
            >
              Rejected
            </button>
            <button 
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
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
                  <div className="withdrawal-amount">${withdrawal.amount?.toFixed(2) || '0.00'}</div>
                  <div className="withdrawal-user">User ID: {withdrawal.user_id}</div>
                </div>
                {getStatusBadge(withdrawal.status)}
              </div>

              <div className="withdrawal-details">
                <div className="detail-row">
                  <span className="label">Payment Method:</span>
                  <span className="value">{withdrawal.payment_method || 'N/A'}</span>
                </div>
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
                {withdrawal.status === 'rejected' && (
                  <div className="detail-row">
                    <span className="label">Refunded:</span>
                    <span className="value">{withdrawal.refunded ? 'Yes' : 'No'}</span>
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
                    onClick={() => handleApprove(withdrawal.id)}
                    disabled={processingId === withdrawal.id}
                    className="btn btn-success"
                  >
                    {processingId === withdrawal.id ? (
                      <RefreshCw className="spinner" size={14} />
                    ) : (
                      <CheckCircle size={14} />
                    )}
                    Approve
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