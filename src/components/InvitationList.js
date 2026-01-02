import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';
import InviteUserModal from './InviteUserModal';

/**
 * InvitationList - Manage pending and past invitations
 */
function InvitationList({ currentUser }) {
  const [invitations, setInvitations] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, expired: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invRes, statsRes] = await Promise.all([
        api.listInvitations(),
        api.getInvitationStats(),
      ]);

      const invData = unwrap(invRes);
      const statsData = unwrap(statsRes);

      setInvitations(invData?.data || []);
      setStats(statsData?.data || stats);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (invitationId) => {
    if (!window.confirm('Cancel this invitation?')) return;

    setActionLoading(invitationId);
    try {
      await api.cancelInvitation(invitationId);
      loadData();
    } catch (err) {
      console.error('Failed to cancel invitation:', err);
      alert(err.message || 'Failed to cancel invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async (invitationId) => {
    setActionLoading(invitationId);
    try {
      const res = await api.resendInvitation(invitationId);
      const data = unwrap(res);

      if (data?.data?.invite_url) {
        // Copy new link to clipboard
        await navigator.clipboard.writeText(data.data.invite_url);
        setCopiedId(invitationId);
        setTimeout(() => setCopiedId(null), 2000);
      }

      loadData();
    } catch (err) {
      console.error('Failed to resend invitation:', err);
      alert(err.message || 'Failed to resend invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredInvitations = filter === 'all' 
    ? invitations 
    : invitations.filter(inv => inv.status === filter);

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      accepted: 'bg-green-500/20 text-green-400',
      expired: 'bg-red-500/20 text-red-400',
      cancelled: 'bg-slate-600 text-slate-400',
    };
    return styles[status] || styles.pending;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpiringSoon = (expiresAt) => {
    if (!expiresAt) return false;
    const expires = new Date(expiresAt);
    const hoursLeft = (expires - new Date()) / (1000 * 60 * 60);
    return hoursLeft > 0 && hoursLeft < 24;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            ✉️ User Invitations
          </h2>
          <p className="text-slate-400 text-sm mt-1">Invite new team members to Polywerk</p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2.5 rounded-lg font-medium text-white flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
        >
          <span>➕</span>
          Invite User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Pending', value: stats.pending, color: 'text-yellow-400' },
          { label: 'Accepted', value: stats.accepted, color: 'text-green-400' },
          { label: 'Expired', value: stats.expired, color: 'text-red-400' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-slate-400' },
        ].map(stat => (
          <div 
            key={stat.label}
            className="p-3 rounded-lg text-center"
            style={{ backgroundColor: '#334155' }}
          >
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 rounded-lg overflow-x-auto" style={{ backgroundColor: '#1e293b' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'Pending' },
          { id: 'accepted', label: 'Accepted' },
          { id: 'expired', label: 'Expired' },
          { id: 'cancelled', label: 'Cancelled' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${
              filter === tab.id
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invitations List */}
      <div 
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400 mt-2">Loading invitations...</p>
          </div>
        ) : filteredInvitations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-slate-400">No invitations found</p>
            <button
              onClick={() => setShowInviteModal(true)}
              className="mt-4 text-purple-400 hover:underline text-sm"
            >
              Send your first invitation →
            </button>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#334155' }}>
            {filteredInvitations.map(inv => (
              <div 
                key={inv.invitation_id}
                className="p-4 hover:bg-slate-800/50 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white truncate">{inv.email}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>Invited by {inv.invited_by_name}</span>
                      <span>•</span>
                      <span>{formatDate(inv.created_at)}</span>
                      {inv.status === 'pending' && (
                        <>
                          <span>•</span>
                          <span className={isExpiringSoon(inv.expires_at) ? 'text-yellow-400' : ''}>
                            Expires {formatDate(inv.expires_at)}
                          </span>
                        </>
                      )}
                      {inv.status === 'accepted' && inv.accepted_username && (
                        <>
                          <span>•</span>
                          <span className="text-green-400">@{inv.accepted_username}</span>
                        </>
                      )}
                      {inv.resend_count > 0 && (
                        <>
                          <span>•</span>
                          <span>Resent {inv.resend_count}x</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex gap-2 sm:flex-shrink-0">
                    {inv.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleResend(inv.invitation_id)}
                          disabled={actionLoading === inv.invitation_id}
                          className="px-3 py-1.5 rounded text-sm font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition disabled:opacity-50"
                        >
                          {copiedId === inv.invitation_id ? '✓ Link Copied!' : '🔄 Resend'}
                        </button>
                        <button
                          onClick={() => handleCancel(inv.invitation_id)}
                          disabled={actionLoading === inv.invitation_id}
                          className="px-3 py-1.5 rounded text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {inv.status === 'expired' && (
                      <button
                        onClick={() => handleResend(inv.invitation_id)}
                        disabled={actionLoading === inv.invitation_id}
                        className="px-3 py-1.5 rounded text-sm font-medium bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition disabled:opacity-50"
                      >
                        {copiedId === inv.invitation_id ? '✓ Link Copied!' : '🔄 Resend'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSent={() => loadData()}
        currentUser={currentUser}
      />
    </div>
  );
}

export default InvitationList;
