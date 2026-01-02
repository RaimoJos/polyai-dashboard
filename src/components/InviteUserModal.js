import React, { useState } from 'react';
import { api, unwrap } from '../services/api';

/**
 * InviteUserModal - Modal for creating user invitations
 */
function InviteUserModal({ isOpen, onClose, onInviteSent, currentUser }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    role: 'technician',
    message: '',
    expires_in_days: 7,
  });

  const roles = [
    { id: 'technician', label: 'Technician', description: 'Printer operation, maintenance, materials' },
    { id: 'modeler', label: '3D Modeler', description: 'File preparation, slicing, design' },
    { id: 'sales', label: 'Sales', description: 'Customer service, orders, quotes' },
    { id: 'print_manager', label: 'Print Manager', description: 'Operations, scheduling, QC, team oversight' },
    { id: 'partner', label: 'Partner', description: 'Business partner, full access except AI' },
    { id: 'owner', label: 'Owner', description: 'Full access including AI', ownerOnly: true },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setInviteLink(null);
    setLoading(true);

    try {
      const res = await api.createInvitation(formData);
      const data = unwrap(res);
      
      if (data?.data?.invite_url) {
        setInviteLink(data.data.invite_url);
        setSuccess(`Invitation created for ${formData.email}`);
        
        if (onInviteSent) {
          onInviteSent(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to create invitation:', err);
      setError(err.message || 'Failed to create invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClose = () => {
    setFormData({ email: '', role: 'technician', message: '', expires_in_days: 7 });
    setError(null);
    setSuccess(null);
    setInviteLink(null);
    onClose();
  };

  const handleNewInvite = () => {
    setFormData({ email: '', role: 'technician', message: '', expires_in_days: 7 });
    setError(null);
    setSuccess(null);
    setInviteLink(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              ✉️ Invite New User
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">Send an invitation link to join Polywerk</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Success State */}
          {success && inviteLink ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-500/20 border border-green-500/30">
                <p className="text-green-400 font-medium flex items-center gap-2">
                  <span>✅</span> {success}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Invitation Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 px-4 py-3 rounded-lg text-sm font-mono"
                    style={{ backgroundColor: '#334155', color: '#94a3b8' }}
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-2 rounded-lg font-medium text-white transition"
                    style={{ background: copied ? '#22c55e' : 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
                  >
                    {copied ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Share this link with the invited user. They'll use it to set up their account.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-sm text-blue-400">
                  💡 <strong>Tip:</strong> Send this link via email or messaging app. The invitation expires in {formData.expires_in_days} days.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleNewInvite}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-700 transition"
                >
                  Invite Another
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error */}
              {error && (
                <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email Address *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="colleague@example.com"
                  required
                  className="w-full px-4 py-3 rounded-lg text-white"
                  style={{ backgroundColor: '#334155', borderColor: '#475569' }}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Role *</label>
                <div className="space-y-2">
                  {roles.map(role => {
                    // Only show owner role if current user is owner
                    if (role.ownerOnly && currentUser?.role !== 'owner') {
                      return null;
                    }
                    
                    return (
                      <label
                        key={role.id}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition ${
                          formData.role === role.id
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role.id}
                          checked={formData.role === role.id}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-medium text-white">{role.label}</p>
                          <p className="text-xs text-slate-400">{role.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Personal Message */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Personal Message <span className="text-slate-500">(optional)</span>
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Welcome to the team! Looking forward to working with you."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg text-white resize-none"
                  style={{ backgroundColor: '#334155', borderColor: '#475569' }}
                />
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Link Expires In</label>
                <select
                  value={formData.expires_in_days}
                  onChange={(e) => setFormData({ ...formData, expires_in_days: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 rounded-lg text-white"
                  style={{ backgroundColor: '#334155', borderColor: '#475569' }}
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !formData.email}
                className="w-full py-3 rounded-lg font-medium text-white disabled:opacity-50 transition"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                {loading ? 'Creating Invitation...' : '✉️ Create Invitation'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default InviteUserModal;
