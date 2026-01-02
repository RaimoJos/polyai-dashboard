/**
 * UserProfile - User's own profile and settings management
 * 
 * Features:
 * - View own profile and permissions
 * - Update personal info
 * - Change password
 * - Notification preferences
 * - Language and theme settings
 * 
 * @version 1.0.0
 */

import React, { useState, useMemo } from 'react';
import { api, unwrap } from '../services/api';
import { useLanguage, SUPPORTED_LANGUAGES } from '../i18n';
import { usePermissions } from './PermissionsContext';
import {
  getRole,
  calculateEffectivePermissions,
  PERMISSIONS,
} from './PermissionsConfig';
import toast from '../utils/toast';

const UserProfile = ({ user, onUpdate, onClose }) => {
  const { t, language, setLanguage } = useLanguage();
  const { role: userRole } = usePermissions();
  
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    display_name: user?.display_name || user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  
  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  
  // Preferences
  const [preferences, setPreferences] = useState({
    language: user?.preferences?.language || language || 'en',
    theme: user?.preferences?.theme || 'dark',
    notifications: {
      email_orders: user?.preferences?.notifications?.email_orders ?? true,
      email_system: user?.preferences?.notifications?.email_system ?? true,
      push_enabled: user?.preferences?.notifications?.push_enabled ?? false,
      sound_enabled: user?.preferences?.notifications?.sound_enabled ?? true,
    },
    dashboard: {
      default_tab: user?.preferences?.dashboard?.default_tab || 'production',
      compact_view: user?.preferences?.dashboard?.compact_view ?? false,
      auto_refresh: user?.preferences?.dashboard?.auto_refresh ?? true,
      refresh_interval: user?.preferences?.dashboard?.refresh_interval || 30,
    }
  });

  // Calculate effective permissions
  const effectivePermissions = useMemo(() => {
    return calculateEffectivePermissions(user);
  }, [user]);

  // Group permissions by module
  const permissionsByModule = useMemo(() => {
    const grouped = {};
    effectivePermissions.forEach(p => {
      const [module] = p.split('.');
      if (!grouped[module]) grouped[module] = [];
      grouped[module].push(p);
    });
    return grouped;
  }, [effectivePermissions]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString();
  };

  const handleProfileSave = async () => {
    setLoading(true);
    try {
      await onUpdate?.({
        ...user,
        display_name: profileForm.display_name,
        email: profileForm.email,
        phone: profileForm.phone,
      });
      toast.success(t('common.saved') || 'Profile saved');
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (passwordForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await api.changePassword?.({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      
      if (response?.error) {
        throw new Error(response.error);
      }
      
      toast.success('Password changed successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesSave = async () => {
    setLoading(true);
    try {
      // Update language immediately
      if (preferences.language !== language) {
        setLanguage(preferences.language);
      }

      await onUpdate?.({
        ...user,
        preferences,
      });
      toast.success(t('common.saved') || 'Preferences saved');
    } catch (err) {
      toast.error('Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  // Profile tab
  const ProfileTab = () => (
    <div className="space-y-6">
      {/* User card */}
      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border border-purple-700/50 rounded-xl">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full flex items-center justify-center text-3xl text-white font-bold">
          {user?.username?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white">{user?.display_name || user?.username}</h3>
          <p className="text-sm text-zinc-400">@{user?.username}</p>
        </div>
        <div className="text-right text-sm text-zinc-500">
          <p>Member since</p>
          <p className="text-white">{formatDate(user?.created_at)}</p>
        </div>
      </div>

      {/* Profile form */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-white mb-4">Personal Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Display Name</label>
            <input
              type="text"
              value={profileForm.display_name}
              onChange={(e) => setProfileForm({...profileForm, display_name: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Username</label>
            <input
              type="text"
              value={user?.username || ''}
              disabled
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-zinc-500"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">{t('common.email') || 'Email'}</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">{t('common.phone') || 'Phone'}</label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
        </div>
        <button
          onClick={handleProfileSave}
          disabled={loading}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 transition"
        >
          {t('common.save') || 'Save'}
        </button>
      </div>

      {/* Password change */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-white mb-4">Change Password</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Current Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">New Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Confirm New Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-zinc-400">Show passwords</span>
          </label>
        </div>
        <button
          onClick={handlePasswordChange}
          disabled={loading || !passwordForm.current_password || !passwordForm.new_password}
          className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50 transition"
        >
          🔐 Change Password
        </button>
      </div>
    </div>
  );

  // Permissions tab
  const PermissionsTab = () => (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-purple-900/30 border border-purple-700 rounded-xl p-4 text-center">
          <div className="text-2xl">{userRole?.icon}</div>
          <div className="text-sm text-purple-300 mt-1">{userRole?.label}</div>
        </div>
        <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-300">{effectivePermissions.size}</div>
          <div className="text-sm text-blue-400">Permissions</div>
        </div>
        <div className="bg-cyan-900/30 border border-cyan-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-cyan-300">{Object.keys(permissionsByModule).length}</div>
          <div className="text-sm text-cyan-400">Modules</div>
        </div>
      </div>

      {/* Permissions by module */}
      <div className="space-y-3">
        {Object.entries(PERMISSIONS).map(([moduleName, moduleMeta]) => {
          const modulePerms = permissionsByModule[moduleName] || [];
          const totalPerms = Object.keys(moduleMeta.permissions).length;
          const hasAny = modulePerms.length > 0;
          
          return (
            <div key={moduleName} className={`border rounded-xl overflow-hidden ${
              hasAny ? 'border-gray-700' : 'border-gray-800'
            }`}>
              <div className={`flex items-center justify-between p-3 ${
                hasAny ? 'bg-gray-800' : 'bg-gray-800/30'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{moduleMeta.icon}</span>
                  <span className={hasAny ? 'text-white font-medium' : 'text-zinc-500'}>
                    {moduleMeta.label}
                  </span>
                  {moduleMeta.premium && (
                    <span className="px-1.5 py-0.5 text-xs bg-amber-900/50 text-amber-400 rounded">Premium</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${modulePerms.length === totalPerms ? 'bg-green-500' : 'bg-purple-500'}`}
                      style={{ width: `${(modulePerms.length / totalPerms) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-zinc-400">{modulePerms.length}/{totalPerms}</span>
                </div>
              </div>
              
              {hasAny && (
                <div className="p-3 bg-gray-850 grid grid-cols-2 md:grid-cols-3 gap-1 text-sm">
                  {Object.entries(moduleMeta.permissions).map(([permKey, permMeta]) => {
                    const fullKey = `${moduleName}.${permKey}`;
                    const hasIt = modulePerms.includes(fullKey);
                    
                    return (
                      <div
                        key={fullKey}
                        className={`px-2 py-1 rounded ${
                          hasIt ? 'text-green-400' : 'text-zinc-600'
                        }`}
                      >
                        {hasIt ? '✓' : '○'} {permMeta.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom overrides */}
      {(user?.custom_permissions?.grant?.length > 0 || user?.custom_permissions?.revoke?.length > 0) && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Custom Permission Overrides</h4>
          {user.custom_permissions.grant?.length > 0 && (
            <div className="mb-2">
              <span className="text-xs text-green-400">✅ Additional:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {user.custom_permissions.grant.map(p => (
                  <span key={p} className="px-2 py-0.5 bg-green-900/30 text-green-300 rounded text-xs">{p}</span>
                ))}
              </div>
            </div>
          )}
          {user.custom_permissions.revoke?.length > 0 && (
            <div>
              <span className="text-xs text-red-400">🚫 Revoked:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {user.custom_permissions.revoke.map(p => (
                  <span key={p} className="px-2 py-0.5 bg-red-900/30 text-red-300 rounded text-xs">{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Preferences tab
  const PreferencesTab = () => (
    <div className="space-y-6">
      {/* Language & Theme */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-white mb-4">Display Settings</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">{t('settings.language') || 'Language'}</label>
            <select
              value={preferences.language}
              onChange={(e) => setPreferences({...preferences, language: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            >
              {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Theme</label>
            <select
              value={preferences.theme}
              onChange={(e) => setPreferences({...preferences, theme: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="dark">🌙 Dark</option>
              <option value="light">☀️ Light</option>
              <option value="system">💻 System</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-white mb-4">🔔 Notifications</h4>
        <div className="space-y-3">
          {[
            { key: 'email_orders', label: 'Email: Order updates', desc: 'Receive emails when orders change status' },
            { key: 'email_system', label: 'Email: System alerts', desc: 'Receive important system notifications' },
            { key: 'push_enabled', label: 'Push notifications', desc: 'Browser push notifications' },
            { key: 'sound_enabled', label: 'Sound effects', desc: 'Play sounds for notifications' },
          ].map(item => (
            <label key={item.key} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750">
              <div>
                <span className="text-white">{item.label}</span>
                <p className="text-xs text-zinc-500">{item.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.notifications[item.key]}
                onChange={(e) => setPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, [item.key]: e.target.checked }
                })}
                className="w-5 h-5 rounded"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Dashboard preferences */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-white mb-4">📊 Dashboard</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Default Tab</label>
            <select
              value={preferences.dashboard.default_tab}
              onChange={(e) => setPreferences({
                ...preferences,
                dashboard: { ...preferences.dashboard, default_tab: e.target.value }
              })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="production">🏭 Production</option>
              <option value="business">💼 Business</option>
              <option value="inventory">📦 Inventory</option>
              <option value="team">👥 Team</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Auto-refresh Interval</label>
            <select
              value={preferences.dashboard.refresh_interval}
              onChange={(e) => setPreferences({
                ...preferences,
                dashboard: { ...preferences.dashboard, refresh_interval: parseInt(e.target.value) }
              })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="15">15 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="120">2 minutes</option>
            </select>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.dashboard.compact_view}
              onChange={(e) => setPreferences({
                ...preferences,
                dashboard: { ...preferences.dashboard, compact_view: e.target.checked }
              })}
              className="rounded"
            />
            <span className="text-white">Compact view</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.dashboard.auto_refresh}
              onChange={(e) => setPreferences({
                ...preferences,
                dashboard: { ...preferences.dashboard, auto_refresh: e.target.checked }
              })}
              className="rounded"
            />
            <span className="text-white">Auto-refresh enabled</span>
          </label>
        </div>
      </div>

      <button
        onClick={handlePreferencesSave}
        disabled={loading}
        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 transition font-medium"
      >
        {t('common.save') || 'Save'} Preferences
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">👤 My Profile</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 overflow-x-auto">
          {[
            { id: 'profile', label: 'Profile', icon: '👤' },
            { id: 'permissions', label: 'My Permissions', icon: '🔑' },
            { id: 'preferences', label: 'Preferences', icon: '⚙️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'text-white border-b-2 border-purple-500 bg-gray-800/50' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'permissions' && <PermissionsTab />}
          {activeTab === 'preferences' && <PreferencesTab />}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
