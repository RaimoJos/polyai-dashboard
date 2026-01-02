import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';

/**
 * AcceptInvitation - Page for accepting user invitations
 * 
 * URL: /invite/:token
 */
function AcceptInvitation({ token, onComplete }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    password: '',
    confirm_password: '',
  });

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.verifyInvitation(token);
      const data = unwrap(res);

      if (data?.data?.valid) {
        setInvitation(data.data);
      } else {
        setError('Invalid or expired invitation link');
      }
    } catch (err) {
      console.error('Failed to verify invitation:', err);
      setError(err.message || 'Failed to verify invitation');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    }

    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.acceptInvitation({
        token,
        username: formData.username.trim().toLowerCase(),
        full_name: formData.full_name.trim(),
        password: formData.password,
      });

      const data = unwrap(res);
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 3000);
    } catch (err) {
      console.error('Failed to accept invitation:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-4">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  // Error state (invalid/expired token)
  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0f172a' }}>
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Invitation</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <p className="text-sm text-slate-500">
            Please contact the person who sent you the invitation to get a new link.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0f172a' }}>
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to Polywerk!</h1>
          <p className="text-slate-400 mb-6">
            Your account has been created successfully.
          </p>
          <p className="text-sm text-slate-500">
            Redirecting to login page...
          </p>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0f172a' }}>
      <div 
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b text-center" style={{ borderColor: '#334155' }}>
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h1 className="text-xl font-bold text-white">You're Invited!</h1>
          <p className="text-slate-400 text-sm mt-1">
            Complete your account setup to join Polywerk
          </p>
        </div>

        {/* Invitation Info */}
        <div className="px-6 py-4 bg-slate-800/50 border-b" style={{ borderColor: '#334155' }}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Email</span>
            <span className="text-white font-medium">{invitation?.email}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-400">Role</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              invitation?.role === 'owner' ? 'bg-purple-500/20 text-purple-400' :
              invitation?.role === 'partner' ? 'bg-blue-500/20 text-blue-400' :
              'bg-slate-600 text-slate-300'
            }`}>
              {invitation?.role?.charAt(0).toUpperCase() + invitation?.role?.slice(1)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-400">Invited by</span>
            <span className="text-white">{invitation?.invited_by}</span>
          </div>
          {invitation?.message && (
            <div className="mt-3 p-3 rounded-lg bg-slate-700/50 text-sm text-slate-300 italic">
              "{invitation.message}"
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="johndoe"
              className={`w-full px-4 py-2.5 rounded-lg text-white ${
                formErrors.username ? 'border border-red-500' : ''
              }`}
              style={{ backgroundColor: '#334155' }}
            />
            {formErrors.username && (
              <p className="text-red-400 text-xs mt-1">{formErrors.username}</p>
            )}
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Full Name *</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Doe"
              className={`w-full px-4 py-2.5 rounded-lg text-white ${
                formErrors.full_name ? 'border border-red-500' : ''
              }`}
              style={{ backgroundColor: '#334155' }}
            />
            {formErrors.full_name && (
              <p className="text-red-400 text-xs mt-1">{formErrors.full_name}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Password *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Minimum 8 characters"
              className={`w-full px-4 py-2.5 rounded-lg text-white ${
                formErrors.password ? 'border border-red-500' : ''
              }`}
              style={{ backgroundColor: '#334155' }}
            />
            {formErrors.password && (
              <p className="text-red-400 text-xs mt-1">{formErrors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Confirm Password *</label>
            <input
              type="password"
              value={formData.confirm_password}
              onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
              placeholder="Repeat your password"
              className={`w-full px-4 py-2.5 rounded-lg text-white ${
                formErrors.confirm_password ? 'border border-red-500' : ''
              }`}
              style={{ backgroundColor: '#334155' }}
            />
            {formErrors.confirm_password && (
              <p className="text-red-400 text-xs mt-1">{formErrors.confirm_password}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg font-medium text-white disabled:opacity-50 transition mt-2"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            {submitting ? 'Creating Account...' : '🚀 Create My Account'}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t text-center" style={{ borderColor: '#334155' }}>
          <p className="text-xs text-slate-500">
            By creating an account, you agree to Polywerk's terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AcceptInvitation;
