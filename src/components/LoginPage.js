import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { api, unwrap, setAuthToken } from '../services/api';

// Logo is in public folder
const logo = process.env.PUBLIC_URL + '/Polywerk_newlogo_color.png';

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login({ username, password });
      const payload = unwrap(response);
      const sessionData = payload?.data ?? payload;

      const token =
        sessionData?.token ||
        sessionData?.session_id ||
        sessionData?.session?.token ||
        sessionData?.session?.session_id ||
        sessionData?.session?.id ||
        payload?.token;

      const storedToken = token || 'session';
      // FIXED: Use ONLY sessionStorage, never localStorage (XSS vulnerability)
      sessionStorage.setItem('authToken', storedToken);
      // Remove any existing tokens from localStorage for security
      localStorage.removeItem('authToken');
      setAuthToken(storedToken);

      const userDisplay = {
        user_id: sessionData?.user_id,
        username: sessionData?.username,
        full_name: sessionData?.full_name,
        role: sessionData?.role,
      };
      sessionStorage.setItem('currentUser', JSON.stringify(userDisplay));
      if (sessionData?.permissions) {
        sessionStorage.setItem('userPermissions', JSON.stringify(sessionData.permissions));
      }
      // FIXED: Remove from localStorage and keep only in sessionStorage
      localStorage.removeItem('currentUser');

      onLogin(sessionData);
    } catch (err) {
      console.error('Login error:', err);
      if (err.response?.status === 401) {
        setError('Invalid username or password');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0b' }}>
      {/* Subtle background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-[0.04]" 
             style={{ background: 'radial-gradient(circle, #a855f7 0%, #06b6d4 50%, transparent 70%)' }}></div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src={logo} 
            alt="Polywerk" 
            className="h-24 w-auto mx-auto mb-4"
          />
          <h1 className="text-xl font-semibold text-zinc-100 mb-1">Staff Portal</h1>
          <p className="text-zinc-500 text-sm">Internal management system</p>
        </div>

        {/* Form Card */}
        <div className="p-6 rounded-xl border" style={{ backgroundColor: '#111113', borderColor: '#27272a' }}>
          
          {/* Staff Only Notice */}
          <div className="mb-5 p-3 rounded-lg flex items-start gap-2"
               style={{ backgroundColor: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
            <svg className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div className="text-xs text-purple-300/90">
              <span className="font-medium">Employees only</span>
              <p className="text-purple-400/70 mt-0.5">This portal is for Polywerk staff. If you're a customer, please contact us at info@polywerk.ee</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg flex items-center text-sm"
                 style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <svg className="w-4 h-4 text-red-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-400">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full px-3 py-2.5 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 transition-colors focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                style={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                placeholder="Enter username"
                required
                autoFocus
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2.5 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 transition-colors focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                style={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                placeholder="Enter password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-2.5 px-4 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
                boxShadow: loading ? 'none' : '0 2px 8px rgba(168, 85, 247, 0.25)'
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Help text */}
          <div className="mt-4 pt-4 text-center" style={{ borderTop: '1px solid #27272a' }}>
            <p className="text-xs text-zinc-600">
              Forgot credentials? Contact your manager.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-600">Polywerk OÜ • Tartu, Estonia</p>
        </div>
      </div>
    </div>
  );
};

LoginPage.propTypes = {
  onLogin: PropTypes.func.isRequired
};

export default LoginPage;
