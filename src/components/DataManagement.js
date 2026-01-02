/**
 * DataManagement Component
 * 
 * Admin-only component for:
 * - Data backup/restore
 * - Selective data wipe
 * - System info display
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api, unwrap } from '../services/api';
import toast from '../utils/toast';
import { useLanguage } from '../i18n';

const DataManagement = ({ currentUser }) => {
  const { t } = useLanguage();
  
  // State
  const [loading, setLoading] = useState(true);
  const [dataSummary, setDataSummary] = useState(null);
  const [backups, setBackups] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [backupName, setBackupName] = useState('');
  const [includeUsers, setIncludeUsers] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeCategories, setWipeCategories] = useState([]);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  
  // Check if user is owner
  const isOwner = currentUser?.role === 'owner';
  
  // Load data
  const loadData = useCallback(async () => {
    if (!isOwner) return;
    
    setLoading(true);
    try {
      const [summaryRes, backupsRes, sysInfoRes] = await Promise.all([
        api.getDataSummary(),
        api.listBackups(),
        api.getSystemInfo(),
      ]);
      
      setDataSummary(unwrap(summaryRes) || summaryRes);
      setBackups(Array.isArray(backupsRes) ? backupsRes : (unwrap(backupsRes) || []));
      setSystemInfo(unwrap(sysInfoRes) || sysInfoRes);
    } catch (err) {
      console.error('Failed to load data management info:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [isOwner]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Toggle category selection
  const toggleCategory = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
  
  // Select all categories
  const selectAllCategories = () => {
    if (dataSummary?.categories) {
      setSelectedCategories(Object.keys(dataSummary.categories));
    }
  };
  
  // Create backup
  const handleCreateBackup = async () => {
    if (selectedCategories.length === 0) {
      toast.error('Select at least one category');
      return;
    }
    
    setActionLoading('backup');
    try {
      const result = await api.createBackup({
        categories: selectedCategories,
        include_users: includeUsers,
        name: backupName || undefined,
      });
      
      if (result?.success || result?.backup_file) {
        toast.success(`Backup created: ${result.backup_file}`);
        setBackupName('');
        loadData();
      } else {
        toast.error('Backup failed');
      }
    } catch (err) {
      toast.error('Failed to create backup');
    } finally {
      setActionLoading(null);
    }
  };
  
  // Download backup
  const handleDownloadBackup = async (filename) => {
    try {
      const url = await api.downloadBackup(filename);
      // Get token for auth
      const token = localStorage.getItem('polyai_token');
      
      // Create temporary link with auth
      const link = document.createElement('a');
      link.href = url + (token ? `?token=${token}` : '');
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error('Download failed');
    }
  };
  
  // Restore backup
  const handleRestoreBackup = async (filename) => {
    if (!window.confirm(`Restore backup "${filename}"? This will overwrite current data.`)) {
      return;
    }
    
    setActionLoading(`restore-${filename}`);
    try {
      const result = await api.restoreBackup(filename, { overwrite: true });
      
      if (result?.success || result?.restored?.length > 0) {
        toast.success(`Restored: ${result.restored?.join(', ')}`);
        loadData();
      } else {
        toast.error(result?.error || 'Restore failed');
      }
    } catch (err) {
      toast.error('Failed to restore backup');
    } finally {
      setActionLoading(null);
    }
  };
  
  // Delete backup
  const handleDeleteBackup = async (filename) => {
    if (!window.confirm(`Delete backup "${filename}"?`)) {
      return;
    }
    
    setActionLoading(`delete-${filename}`);
    try {
      const result = await api.deleteBackup(filename);
      
      if (result?.success) {
        toast.success('Backup deleted');
        loadData();
      } else {
        toast.error(result?.error || 'Delete failed');
      }
    } catch (err) {
      toast.error('Failed to delete backup');
    } finally {
      setActionLoading(null);
    }
  };
  
  // Open wipe dialog
  const openWipeDialog = () => {
    if (selectedCategories.length === 0) {
      toast.error('Select categories to wipe');
      return;
    }
    setWipeCategories(selectedCategories);
    setWipeConfirmText('');
    setShowWipeConfirm(true);
  };
  
  // Execute wipe
  const handleWipe = async () => {
    if (wipeConfirmText !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    
    setActionLoading('wipe');
    try {
      const result = await api.wipeData(wipeCategories, true);
      
      if (result?.success || result?.wiped?.length > 0) {
        toast.success(`Wiped: ${result.wiped?.join(', ')}`);
        setShowWipeConfirm(false);
        setSelectedCategories([]);
        loadData();
      } else {
        toast.error(result?.error || 'Wipe failed');
      }
    } catch (err) {
      toast.error('Failed to wipe data');
    } finally {
      setActionLoading(null);
    }
  };
  
  // Format bytes
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  };
  
  // Category icons
  const categoryIcons = {
    orders: '📦',
    clients: '👥',
    invoices: '📄',
    quotes: '💬',
    files: '📁',
    analytics: '📊',
    feedback: '💡',
    datasets: '🗂️',
    printers: '🖨️',
    chat: '💬',
    scheduling: '📅',
  };
  
  if (!isOwner) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🔒</div>
          <h3 className="text-lg font-bold text-white">Access Denied</h3>
          <p className="text-zinc-500 mt-2">Owner access required for data management</p>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="h-40 bg-gray-800 rounded-lg"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🛠️ Data Management
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Backup, restore, and cleanup system data
            </p>
          </div>
          <button
            onClick={loadData}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition"
          >
            🔄
          </button>
        </div>
      </div>
      
      {/* System Info */}
      {systemInfo && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="font-bold text-white mb-3">💻 System Info</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-800 rounded-lg">
              <p className="text-xs text-zinc-500">Platform</p>
              <p className="text-white font-medium">
                {systemInfo.platform?.system} {systemInfo.platform?.release}
              </p>
            </div>
            <div className="p-3 bg-gray-800 rounded-lg">
              <p className="text-xs text-zinc-500">CPU</p>
              <p className="text-white font-medium">
                {systemInfo.resources?.cpu_count} cores @ {systemInfo.resources?.cpu_percent?.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-gray-800 rounded-lg">
              <p className="text-xs text-zinc-500">Memory</p>
              <p className="text-white font-medium">
                {formatBytes(systemInfo.resources?.memory_available)} free
                <span className="text-zinc-500 text-sm ml-1">
                  ({systemInfo.resources?.memory_percent?.toFixed(1)}% used)
                </span>
              </p>
            </div>
            <div className="p-3 bg-gray-800 rounded-lg">
              <p className="text-xs text-zinc-500">Disk</p>
              <p className="text-white font-medium">
                {formatBytes(systemInfo.resources?.disk_free)} free
                <span className="text-zinc-500 text-sm ml-1">
                  ({systemInfo.resources?.disk_percent?.toFixed(1)}% used)
                </span>
              </p>
            </div>
          </div>
          {systemInfo.gpu?.cuda_available && (
            <div className="mt-3 p-3 bg-green-900/30 border border-green-700 rounded-lg">
              <p className="text-green-400 text-sm">
                🎮 GPU: {systemInfo.gpu.cuda_device_name} ({systemInfo.gpu.cuda_device_count} device(s))
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Data Categories */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-white">📂 Data Categories</h3>
          <div className="flex gap-2">
            <button
              onClick={selectAllCategories}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedCategories([])}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-zinc-400"
            >
              Clear
            </button>
          </div>
        </div>
        
        {dataSummary?.categories && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(dataSummary.categories).map(([name, info]) => (
                <label
                  key={name}
                  className={`p-3 rounded-lg cursor-pointer transition border ${
                    selectedCategories.includes(name)
                      ? 'bg-purple-900/30 border-purple-600'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(name)}
                      onChange={() => toggleCategory(name)}
                      className="mt-1 accent-purple-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{categoryIcons[name] || '📁'}</span>
                        <span className="font-medium text-white capitalize">{name}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">{info.description}</p>
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className="text-zinc-400">
                          {info.size_human || formatBytes(info.size_bytes)}
                        </span>
                        {info.record_count > 0 && (
                          <span className="text-cyan-400">{info.record_count} records</span>
                        )}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-gray-800 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-white font-medium">
                  Total: {dataSummary.total_size_human || formatBytes(dataSummary.total_size_bytes)}
                </p>
                <p className="text-xs text-zinc-500">
                  {selectedCategories.length} categories selected
                </p>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Backup Actions */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h3 className="font-bold text-white mb-4">💾 Backup</h3>
        
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="Backup name (optional)"
              className="flex-1 min-w-[200px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={includeUsers}
                onChange={(e) => setIncludeUsers(e.target.checked)}
                className="accent-purple-500"
              />
              Include users
            </label>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleCreateBackup}
              disabled={actionLoading === 'backup' || selectedCategories.length === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 transition"
            >
              {actionLoading === 'backup' ? '⏳ Creating...' : '💾 Create Backup'}
            </button>
            
            <button
              onClick={openWipeDialog}
              disabled={selectedCategories.length === 0}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50 transition"
            >
              🗑️ Wipe Selected
            </button>
          </div>
        </div>
      </div>
      
      {/* Existing Backups */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h3 className="font-bold text-white mb-4">📋 Existing Backups</h3>
        
        {backups.length === 0 ? (
          <p className="text-zinc-500 text-center py-6">No backups found</p>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div
                key={backup.filename}
                className="p-3 bg-gray-800 rounded-lg flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{backup.filename}</p>
                  <div className="flex gap-3 text-xs text-zinc-500 mt-1">
                    <span>{backup.size_human || formatBytes(backup.size_bytes)}</span>
                    <span>{new Date(backup.created_at).toLocaleDateString()}</span>
                    {backup.categories?.length > 0 && (
                      <span className="text-cyan-400">
                        {backup.categories.length} categories
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 ml-3">
                  <button
                    onClick={() => handleDownloadBackup(backup.filename)}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition"
                    title="Download"
                  >
                    ⬇️
                  </button>
                  <button
                    onClick={() => handleRestoreBackup(backup.filename)}
                    disabled={actionLoading === `restore-${backup.filename}`}
                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition disabled:opacity-50"
                    title="Restore"
                  >
                    {actionLoading === `restore-${backup.filename}` ? '⏳' : '♻️'}
                  </button>
                  <button
                    onClick={() => handleDeleteBackup(backup.filename)}
                    disabled={actionLoading === `delete-${backup.filename}`}
                    className="p-2 bg-red-600 hover:bg-red-500 rounded-lg text-white transition disabled:opacity-50"
                    title="Delete"
                  >
                    {actionLoading === `delete-${backup.filename}` ? '⏳' : '🗑️'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Wipe Confirmation Modal */}
      {showWipeConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-red-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-red-400 mb-4">⚠️ Confirm Data Wipe</h3>
            
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4">
              <p className="text-red-300 text-sm">
                This will permanently delete all data in the following categories:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {wipeCategories.map(cat => (
                  <span key={cat} className="px-2 py-1 bg-red-900/50 text-red-300 rounded text-sm">
                    {categoryIcons[cat]} {cat}
                  </span>
                ))}
              </div>
            </div>
            
            <p className="text-zinc-400 text-sm mb-3">
              Type <strong className="text-red-400">DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={wipeConfirmText}
              onChange={(e) => setWipeConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowWipeConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleWipe}
                disabled={wipeConfirmText !== 'DELETE' || actionLoading === 'wipe'}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition disabled:opacity-50"
              >
                {actionLoading === 'wipe' ? '⏳ Wiping...' : '🗑️ Wipe Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataManagement;
