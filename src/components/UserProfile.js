import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';
import { useLanguage } from '../i18n';

/**
 * UserProfile - User profile settings and account management
 * Includes work-related information for business operations
 */
function UserProfile({ currentUser, onUserUpdate }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);

  // Profile form - Basic info
  const [profile, setProfile] = useState({
    full_name: currentUser?.full_name || '',
    email: currentUser?.email || '',
  });

  // Work info form
  const [workInfo, setWorkInfo] = useState({
    job_title: currentUser?.job_title || '',
    department: currentUser?.department || '',
    hourly_rate: currentUser?.hourly_rate || 0,
    start_date: currentUser?.start_date || '',
    phone: currentUser?.phone || '',
    emergency_contact: currentUser?.emergency_contact || '',
    emergency_phone: currentUser?.emergency_phone || '',
    skills: currentUser?.skills || [],
    certifications: currentUser?.certifications || '',
    default_printer: currentUser?.default_printer || '',
  });

  // Password form
  const [passwords, setPasswords] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  // Settings/preferences
  const [settings, setSettings] = useState({
    language: currentUser?.settings?.language || 'en',
    notifications_email: currentUser?.settings?.notifications_email !== false,
    notifications_browser: currentUser?.settings?.notifications_browser !== false,
    theme: currentUser?.settings?.theme || 'dark',
    default_view: currentUser?.settings?.default_view || 'dashboard',
    show_tips: currentUser?.settings?.show_tips !== false,
    compact_mode: currentUser?.settings?.compact_mode || false,
  });

  // Available skills for selection
  const availableSkills = [
    { id: 'fdm_printing', name: 'FDM Printing', icon: '🖨️' },
    { id: 'sla_printing', name: 'SLA/Resin Printing', icon: '💧' },
    { id: '3d_modeling', name: '3D Modeling', icon: '🎨' },
    { id: 'slicing', name: 'Slicing', icon: '🔪' },
    { id: 'post_processing', name: 'Post Processing', icon: '✨' },
    { id: 'painting', name: 'Painting/Finishing', icon: '🎨' },
    { id: 'assembly', name: 'Assembly', icon: '🔧' },
    { id: 'quality_control', name: 'Quality Control', icon: '✅' },
    { id: 'customer_service', name: 'Customer Service', icon: '💬' },
    { id: 'maintenance', name: 'Printer Maintenance', icon: '🔧' },
  ];

  useEffect(() => {
    if (currentUser) {
      setProfile({
        full_name: currentUser.full_name || '',
        email: currentUser.email || '',
      });
      setWorkInfo({
        job_title: currentUser.job_title || '',
        department: currentUser.department || '',
        hourly_rate: currentUser.hourly_rate || 0,
        start_date: currentUser.start_date || '',
        phone: currentUser.phone || '',
        emergency_contact: currentUser.emergency_contact || '',
        emergency_phone: currentUser.emergency_phone || '',
        skills: currentUser.skills || [],
        certifications: currentUser.certifications || '',
        default_printer: currentUser.default_printer || '',
      });
      if (currentUser.settings) {
        setSettings(prev => ({ ...prev, ...currentUser.settings }));
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      loadSessions();
    }
    if (activeTab === 'stats') {
      loadUserStats();
    }
  }, [activeTab]);

  const loadSessions = async () => {
    try {
      const res = await api.getMyActiveSessions();
      const data = unwrap(res);
      setSessions(data?.data || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const loadUserStats = async () => {
    try {
      // Load user's work statistics
      const timeEntries = localStorage.getItem('polywerk_time_entries');
      const entries = timeEntries ? JSON.parse(timeEntries) : [];
      
      const myEntries = entries.filter(e => e.user === currentUser?.username);
      const thisMonth = myEntries.filter(e => {
        const entryDate = new Date(e.started_at);
        const now = new Date();
        return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
      });

      const totalMinutes = thisMonth.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
      const totalHours = (totalMinutes / 60).toFixed(1);

      setStats({
        totalHoursThisMonth: totalHours,
        entriesThisMonth: thisMonth.length,
        avgEntryMinutes: thisMonth.length > 0 ? Math.round(totalMinutes / thisMonth.length) : 0,
        // These would come from the API in production
        jobsCompleted: 0,
        qualityScore: '-',
        onTimeRate: '-',
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Include title as alias for job_title for TeamManagement compatibility
      const updateData = { 
        ...profile, 
        ...workInfo,
        title: workInfo.job_title // Sync title with job_title
      };
      const res = await api.updateProfile(updateData);
      const updated = unwrap(res);
      
      if (onUserUpdate && updated?.data) {
        // Ensure title is set in the update
        onUserUpdate({ ...updated.data, title: updated.data.job_title || updated.data.title });
      } else if (onUserUpdate) {
        // Fallback: update with local data
        onUserUpdate({ 
          ...currentUser, 
          ...profile, 
          ...workInfo, 
          title: workInfo.job_title 
        });
      }
      
      showMessage('success', t('profile.saved') || 'Profile updated successfully');
    } catch (err) {
      console.error('Failed to update profile:', err);
      showMessage('error', err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwords.new_password !== passwords.confirm_password) {
      showMessage('error', t('profile.passwordMismatch') || 'New passwords do not match');
      return;
    }

    if (passwords.new_password.length < 8) {
      showMessage('error', t('profile.passwordTooShort') || 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await api.changePassword(passwords.old_password, passwords.new_password);
      setPasswords({ old_password: '', new_password: '', confirm_password: '' });
      showMessage('success', t('profile.passwordChanged') || 'Password changed successfully');
    } catch (err) {
      console.error('Failed to change password:', err);
      showMessage('error', err.message || 'Failed to change password. Check your current password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsSave = async () => {
    setLoading(true);

    try {
      const res = await api.updateProfile({ settings });
      const updated = unwrap(res);
      
      if (onUserUpdate && updated?.data) {
        onUserUpdate(updated.data);
      }
      
      showMessage('success', t('profile.settingsSaved') || 'Settings saved');
    } catch (err) {
      console.error('Failed to save settings:', err);
      showMessage('error', 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skillId) => {
    setWorkInfo(prev => {
      const skills = prev.skills || [];
      if (skills.includes(skillId)) {
        return { ...prev, skills: skills.filter(s => s !== skillId) };
      } else {
        return { ...prev, skills: [...skills, skillId] };
      }
    });
  };

  const handleLogoutAllSessions = async () => {
    if (!window.confirm('This will log you out from all devices. Continue?')) {
      return;
    }

    try {
      await api.logoutAllSessions();
      showMessage('success', 'All other sessions have been logged out');
      loadSessions();
    } catch (err) {
      console.error('Failed to logout sessions:', err);
      showMessage('error', 'Failed to logout sessions');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const tabs = [
    { id: 'profile', label: t('profile.personalInfo') || 'Personal Info', icon: '👤' },
    { id: 'work', label: t('profile.workInfo') || 'Work Info', icon: '💼' },
    { id: 'stats', label: t('profile.myStats') || 'My Stats', icon: '📊' },
    { id: 'password', label: t('profile.password') || 'Password', icon: '🔐' },
    { id: 'preferences', label: t('profile.preferences') || 'Preferences', icon: '⚙️' },
    { id: 'sessions', label: t('profile.sessions') || 'Sessions', icon: '📱' },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">{t('profile.accountSettings') || 'Account Settings'}</h2>
        <p className="text-slate-400 mt-1">{t('profile.manageProfile') || 'Manage your profile and preferences'}</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-500/20 border-green-500/30 text-green-400'
            : 'bg-red-500/20 border-red-500/30 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 rounded-lg overflow-x-auto" style={{ backgroundColor: '#1e293b' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-max px-4 py-2.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-white border border-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSave} className="space-y-6">
            <div className="flex items-center gap-6 pb-6 border-b border-slate-700">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                {(profile.full_name || currentUser?.username || 'U')[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">{profile.full_name || currentUser?.username}</h3>
                <p className="text-slate-400">@{currentUser?.username}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">{t('common.name') || 'Full Name'}</label>
                <input
                  type="text"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg text-white"
                  style={{ backgroundColor: '#334155', borderColor: '#475569' }}
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">{t('common.email') || 'Email Address'}</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg text-white"
                  style={{ backgroundColor: '#334155', borderColor: '#475569' }}
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">{t('common.username') || 'Username'}</label>
                <input
                  type="text"
                  value={currentUser?.username || ''}
                  disabled
                  className="w-full px-4 py-3 rounded-lg text-slate-500 cursor-not-allowed"
                  style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                />
                <p className="text-xs text-slate-500 mt-1">{t('profile.usernameFixed') || 'Username cannot be changed'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.userId') || 'User ID'}</label>
                <input
                  type="text"
                  value={currentUser?.user_id || ''}
                  disabled
                  className="w-full px-4 py-3 rounded-lg text-slate-500 cursor-not-allowed font-mono text-sm"
                  style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                {loading ? t('common.saving') || 'Saving...' : t('common.save') || 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Work Info Tab */}
        {activeTab === 'work' && (
          <form onSubmit={handleProfileSave} className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">{t('profile.workDetails') || 'Work Details'}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.jobTitle') || 'Job Title'}</label>
                  <input
                    type="text"
                    value={workInfo.job_title}
                    onChange={(e) => setWorkInfo({ ...workInfo, job_title: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                    placeholder="e.g. Print Technician"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.department') || 'Department'}</label>
                  <select
                    value={workInfo.department}
                    onChange={(e) => setWorkInfo({ ...workInfo, department: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                  >
                    <option value="">Select department</option>
                    <option value="production">Production</option>
                    <option value="design">Design</option>
                    <option value="sales">Sales</option>
                    <option value="management">Management</option>
                    <option value="support">Support</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.hourlyRate') || 'Hourly Rate (€)'}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={workInfo.hourly_rate}
                    onChange={(e) => setWorkInfo({ ...workInfo, hourly_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-slate-500 mt-1">{t('profile.hourlyRateNote') || 'Used for cost calculations'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.startDate') || 'Start Date'}</label>
                  <input
                    type="date"
                    value={workInfo.start_date}
                    onChange={(e) => setWorkInfo({ ...workInfo, start_date: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.workPhone') || 'Work Phone'}</label>
                  <input
                    type="tel"
                    value={workInfo.phone}
                    onChange={(e) => setWorkInfo({ ...workInfo, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                    placeholder="+372 5XXX XXXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.defaultPrinter') || 'Default Printer'}</label>
                  <input
                    type="text"
                    value={workInfo.default_printer}
                    onChange={(e) => setWorkInfo({ ...workInfo, default_printer: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                    placeholder="e.g. K1-001"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">{t('profile.emergencyContact') || 'Emergency Contact'}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.contactName') || 'Contact Name'}</label>
                  <input
                    type="text"
                    value={workInfo.emergency_contact}
                    onChange={(e) => setWorkInfo({ ...workInfo, emergency_contact: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                    placeholder="Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.contactPhone') || 'Contact Phone'}</label>
                  <input
                    type="tel"
                    value={workInfo.emergency_phone}
                    onChange={(e) => setWorkInfo({ ...workInfo, emergency_phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                    placeholder="+372 5XXX XXXX"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">{t('profile.skills') || 'Skills & Certifications'}</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.selectSkills') || 'Select your skills'}</label>
                <div className="flex flex-wrap gap-2">
                  {availableSkills.map(skill => (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => toggleSkill(skill.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        (workInfo.skills || []).includes(skill.id)
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-slate-700 text-slate-400 hover:text-white border border-transparent'
                      }`}
                    >
                      {skill.icon} {skill.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.certifications') || 'Certifications'}</label>
                <textarea
                  value={workInfo.certifications}
                  onChange={(e) => setWorkInfo({ ...workInfo, certifications: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg text-white resize-none"
                  style={{ backgroundColor: '#334155' }}
                  rows={2}
                  placeholder="List any relevant certifications..."
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                {loading ? t('common.saving') || 'Saving...' : t('common.save') || 'Save Work Info'}
              </button>
            </div>
          </form>
        )}

        {/* My Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">{t('profile.performanceStats') || 'Performance Statistics'}</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-sm text-slate-400">{t('profile.hoursThisMonth') || 'Hours This Month'}</p>
                <p className="text-2xl font-bold text-purple-400">{stats?.totalHoursThisMonth || '0'}h</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-sm text-slate-400">{t('profile.timeEntries') || 'Time Entries'}</p>
                <p className="text-2xl font-bold text-cyan-400">{stats?.entriesThisMonth || 0}</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-sm text-slate-400">{t('profile.avgSession') || 'Avg Session'}</p>
                <p className="text-2xl font-bold text-green-400">{stats?.avgEntryMinutes || 0}m</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-sm text-slate-400">{t('profile.jobsCompleted') || 'Jobs Completed'}</p>
                <p className="text-2xl font-bold text-white">{stats?.jobsCompleted || '-'}</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-sm text-slate-400">{t('profile.qualityScore') || 'Quality Score'}</p>
                <p className="text-2xl font-bold text-white">{stats?.qualityScore || '-'}</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-sm text-slate-400">{t('profile.onTimeRate') || 'On-Time Rate'}</p>
                <p className="text-2xl font-bold text-white">{stats?.onTimeRate || '-'}</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-400">
                💡 {t('profile.statsNote') || 'Statistics are calculated from your time tracking entries. More detailed analytics will be available as you log more work.'}
              </p>
            </div>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordChange} className="space-y-6 max-w-md">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.currentPassword') || 'Current Password'}</label>
              <input
                type="password"
                value={passwords.old_password}
                onChange={(e) => setPasswords({ ...passwords, old_password: e.target.value })}
                className="w-full px-4 py-3 rounded-lg text-white"
                style={{ backgroundColor: '#334155', borderColor: '#475569' }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.newPassword') || 'New Password'}</label>
              <input
                type="password"
                value={passwords.new_password}
                onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                className="w-full px-4 py-3 rounded-lg text-white"
                style={{ backgroundColor: '#334155', borderColor: '#475569' }}
                minLength={8}
                required
              />
              <p className="text-xs text-slate-500 mt-1">{t('profile.passwordRequirement') || 'Minimum 8 characters'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">{t('profile.confirmPassword') || 'Confirm New Password'}</label>
              <input
                type="password"
                value={passwords.confirm_password}
                onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                className="w-full px-4 py-3 rounded-lg text-white"
                style={{ backgroundColor: '#334155', borderColor: '#475569' }}
                required
              />
            </div>

            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-sm text-yellow-400">
                ⚠️ {t('profile.passwordWarning') || 'Changing your password will log you out from all other devices.'}
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                {loading ? t('profile.changing') || 'Changing...' : t('profile.changePassword') || 'Change Password'}
              </button>
            </div>
          </form>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">{t('profile.displaySettings') || 'Display Settings'}</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <div>
                    <p className="font-medium text-white">{t('profile.language') || 'Language'}</p>
                    <p className="text-sm text-slate-400">{t('profile.languageDesc') || 'Choose your preferred language'}</p>
                  </div>
                  <select
                    value={settings.language}
                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                    className="px-4 py-2 rounded-lg text-white"
                    style={{ backgroundColor: '#1e293b', borderColor: '#475569' }}
                  >
                    <option value="en">English</option>
                    <option value="et">Eesti</option>
                    <option value="ru">Русский</option>
                    <option value="fi">Suomi</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <div>
                    <p className="font-medium text-white">{t('profile.defaultView') || 'Default View'}</p>
                    <p className="text-sm text-slate-400">{t('profile.defaultViewDesc') || 'Page to show after login'}</p>
                  </div>
                  <select
                    value={settings.default_view}
                    onChange={(e) => setSettings({ ...settings, default_view: e.target.value })}
                    className="px-4 py-2 rounded-lg text-white"
                    style={{ backgroundColor: '#1e293b', borderColor: '#475569' }}
                  >
                    <option value="home">Home</option>
                    <option value="printers">Printers</option>
                    <option value="production">Production</option>
                    <option value="business">Business</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <div>
                    <p className="font-medium text-white">{t('profile.compactMode') || 'Compact Mode'}</p>
                    <p className="text-sm text-slate-400">{t('profile.compactModeDesc') || 'Show more content with less spacing'}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.compact_mode}
                      onChange={(e) => setSettings({ ...settings, compact_mode: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">{t('profile.notifications') || 'Notifications'}</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <div>
                    <p className="font-medium text-white">{t('profile.emailNotifications') || 'Email Notifications'}</p>
                    <p className="text-sm text-slate-400">{t('profile.emailNotificationsDesc') || 'Receive updates via email'}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications_email}
                      onChange={(e) => setSettings({ ...settings, notifications_email: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
                  <div>
                    <p className="font-medium text-white">{t('profile.browserNotifications') || 'Browser Notifications'}</p>
                    <p className="text-sm text-slate-400">{t('profile.browserNotificationsDesc') || 'Show desktop notifications'}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications_browser}
                      onChange={(e) => setSettings({ ...settings, notifications_browser: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSettingsSave}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                {loading ? t('common.saving') || 'Saving...' : t('profile.savePreferences') || 'Save Preferences'}
              </button>
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{t('profile.activeSessions') || 'Active Sessions'}</h3>
                <p className="text-sm text-slate-400">{t('profile.sessionsDesc') || "Devices where you're logged in"}</p>
              </div>
              <button
                onClick={handleLogoutAllSessions}
                className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10"
              >
                {t('profile.logoutAll') || 'Logout All Other Devices'}
              </button>
            </div>

            <div className="space-y-3">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>{t('profile.loadingSessions') || 'Loading sessions...'}</p>
                </div>
              ) : (
                sessions.map((session, idx) => (
                  <div 
                    key={session.session_id || idx}
                    className="p-4 rounded-lg border flex items-center justify-between"
                    style={{ backgroundColor: '#334155', borderColor: '#475569' }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center">
                        {session.user_agent?.includes('Mobile') ? '📱' : '💻'}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {session.user_agent?.split(' ')[0] || 'Unknown Device'}
                        </p>
                        <p className="text-sm text-slate-400">
                          {session.ip_address || 'Unknown IP'} • 
                          Last active: {session.last_activity 
                            ? formatDate(session.last_activity)
                            : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    {session.is_current ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                        {t('profile.currentSession') || 'Current'}
                      </span>
                    ) : (
                      <button
                        className="text-sm text-slate-400 hover:text-red-400"
                      >
                        {t('user.logout') || 'Logout'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-400">
                💡 {t('profile.sessionsHint') || 'If you see any suspicious sessions, logout from all devices and change your password.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserProfile;
