/**
 * EmailSettings - Configure SMTP for sending quotes/invoices
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api/v1';

function EmailSettings() {
  const { t } = useLanguage();
  const [config, setConfig] = useState({
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: 'Polywerk OÜ',
    reply_to: '',
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/email/config`, { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setConfig(prev => ({ ...prev, ...data.data }));
      }
    } catch (err) {
      console.error('Failed to load email config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/email/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      const data = await response.json();
      if (data.success) {
        alert('✅ Email settings saved!');
      } else {
        alert(`❌ ${data.error || 'Failed to save'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${API_BASE}/email/test`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      setTestResult(data.success ? { success: true, message: 'Connection successful!' } : { success: false, error: data.error || 'Test failed' });
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    const testEmail = prompt('Enter email address to send test to:');
    if (!testEmail) return;
    
    setTesting(true);
    try {
      const response = await fetch(`${API_BASE}/email/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: testEmail }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ Test email sent to ${testEmail}`);
      } else {
        alert(`❌ ${data.error || 'Failed to send'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-xl border animate-pulse" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-700 rounded"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📧 Email Settings
          </h2>
          <p className="text-slate-400 text-sm mt-1">Configure SMTP for sending quotes and invoices</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="w-5 h-5 rounded border-slate-600 text-purple-500 focus:ring-purple-500"
            />
            <span className={config.enabled ? 'text-green-400' : 'text-slate-400'}>
              {config.enabled ? '✅ Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </div>

      {/* SMTP Settings */}
      <div className="p-6 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <h3 className="text-lg font-semibold text-white mb-4">🔧 SMTP Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">SMTP Host</label>
            <input
              type="text"
              value={config.smtp_host}
              onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
              placeholder="smtp.gmail.com"
              className="w-full px-3 py-2.5 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-400 mb-1">SMTP Port</label>
            <input
              type="number"
              value={config.smtp_port}
              onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value) || 587 })}
              placeholder="587"
              className="w-full px-3 py-2.5 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-400 mb-1">SMTP Username</label>
            <input
              type="text"
              value={config.smtp_user}
              onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
              placeholder="your-email@gmail.com"
              className="w-full px-3 py-2.5 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-400 mb-1">SMTP Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={config.smtp_password}
                onChange={(e) => setConfig({ ...config, smtp_password: e.target.value })}
                placeholder="App password or API key"
                className="w-full px-3 py-2.5 rounded-lg text-white pr-10"
                style={{ backgroundColor: '#334155' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">For Gmail, use an App Password</p>
          </div>
        </div>
      </div>

      {/* Sender Settings */}
      <div className="p-6 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <h3 className="text-lg font-semibold text-white mb-4">✉️ Sender Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">From Name</label>
            <input
              type="text"
              value={config.from_name}
              onChange={(e) => setConfig({ ...config, from_name: e.target.value })}
              placeholder="Polywerk OÜ"
              className="w-full px-3 py-2.5 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-400 mb-1">From Email</label>
            <input
              type="email"
              value={config.from_email}
              onChange={(e) => setConfig({ ...config, from_email: e.target.value })}
              placeholder="noreply@polywerk.ee"
              className="w-full px-3 py-2.5 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-400 mb-1">Reply-To Email</label>
            <input
              type="email"
              value={config.reply_to}
              onChange={(e) => setConfig({ ...config, reply_to: e.target.value })}
              placeholder="info@polywerk.ee"
              className="w-full px-3 py-2.5 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
            />
            <p className="text-xs text-slate-500 mt-1">Customers will reply to this address</p>
          </div>
        </div>
      </div>

      {/* Test Connection */}
      {testResult && (
        <div className={`p-4 rounded-xl border ${testResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <p className={testResult.success ? 'text-green-400' : 'text-red-400'}>
            {testResult.success ? '✅ ' : '❌ '}
            {testResult.message || testResult.error}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2.5 rounded-lg text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 disabled:opacity-50"
          >
            {testing ? '⏳ Testing...' : '🔌 Test Connection'}
          </button>
          <button
            onClick={handleSendTestEmail}
            disabled={testing || !config.enabled}
            className="px-4 py-2.5 rounded-lg text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 disabled:opacity-50"
          >
            📨 Send Test Email
          </button>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
        >
          {saving ? '⏳ Saving...' : '💾 Save Settings'}
        </button>
      </div>

      {/* Setup Guide */}
      <div className="p-6 rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <h3 className="text-lg font-semibold text-white mb-4">📚 Setup Guide</h3>
        
        <div className="space-y-4 text-sm text-slate-400">
          <div>
            <h4 className="text-white font-medium mb-2">Gmail Setup</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Enable 2-Factor Authentication on your Google account</li>
              <li>Go to Google Account → Security → App Passwords</li>
              <li>Generate a new app password for "Mail"</li>
              <li>Use that password in the SMTP Password field above</li>
            </ol>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-2">Outlook/Office 365</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Host: smtp.office365.com, Port: 587</li>
              <li>Use your full email as username</li>
              <li>Use your account password or app password</li>
            </ol>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-2">Custom SMTP</h4>
            <p>Check with your email provider for SMTP settings. Most use port 587 with TLS.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailSettings;
