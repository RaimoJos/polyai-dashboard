/**
 * PermissionAuditLog - Track all permission and role changes
 * 
 * Features:
 * - View history of permission changes
 * - Filter by user, action type, date
 * - Detailed change information
 * - Export audit log
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';
import { useLanguage } from '../i18n';
import { usePermissions, PermissionGate } from './PermissionsContext';
import { getRole } from './PermissionsConfig';

const AUDIT_LOG_KEY = 'polywerk_permission_audit_log';

const PermissionAuditLog = ({ onClose }) => {
  const { t } = useLanguage();
  const { can } = usePermissions();
  
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('30');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    loadAuditLog();
  }, [filterDateRange]);

  const loadAuditLog = async () => {
    setLoading(true);
    try {
      // Try API first
      const res = await api.getPermissionAuditLog?.({ days: parseInt(filterDateRange) }).catch(() => null);
      let logs = unwrap(res)?.logs || unwrap(res) || [];
      
      // If no API results, load from localStorage
      if (!Array.isArray(logs) || logs.length === 0) {
        const stored = localStorage.getItem(AUDIT_LOG_KEY);
        if (stored) {
          logs = JSON.parse(stored);
        }
      }
      
      // Filter by date range
      const daysAgo = parseInt(filterDateRange);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysAgo);
      
      logs = logs.filter(l => new Date(l.timestamp) >= cutoff);
      
      setAuditLog(logs);
    } catch (err) {
      console.error('Failed to load audit log:', err);
      setAuditLog([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredLog = useMemo(() => {
    let logs = [...auditLog];
    
    if (filterAction !== 'all') {
      logs = logs.filter(l => l.action === filterAction);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      logs = logs.filter(l => {
        const actorName = l.actor?.username || l.actor_name || '';
        const targetName = l.target?.username || l.target_name || '';
        return actorName.toLowerCase().includes(q) ||
               targetName.toLowerCase().includes(q) ||
               l.action?.toLowerCase().includes(q) ||
               JSON.stringify(l.details).toLowerCase().includes(q);
      });
    }
    
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [auditLog, filterAction, searchQuery]);

  const getActionInfo = (action) => {
    const actions = {
      role_change: { icon: '🔄', label: 'Role Changed', color: 'blue' },
      permission_grant: { icon: '✅', label: 'Permission Granted', color: 'green' },
      permission_revoke: { icon: '🚫', label: 'Permission Revoked', color: 'red' },
      user_create: { icon: '👤', label: 'User Created', color: 'cyan' },
      user_delete: { icon: '🗑️', label: 'User Deleted', color: 'red' },
      role_create: { icon: '🛡️', label: 'Role Created', color: 'purple' },
      role_update: { icon: '✏️', label: 'Role Updated', color: 'yellow' },
      impersonate: { icon: '👁️', label: 'User Impersonated', color: 'amber' },
    };
    return actions[action] || { icon: '📋', label: action, color: 'gray' };
  };

  const formatTimestamp = (ts) => {
    const date = new Date(ts);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString('et-EE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExport = () => {
    const csvContent = [
      ['Timestamp', 'Action', 'Actor', 'Target', 'Details', 'IP Address'].join(','),
      ...filteredLog.map(entry => [
        entry.timestamp,
        entry.action,
        entry.actor?.username || entry.actor_name || '',
        entry.target?.username || entry.target_name || '',
        JSON.stringify(entry.details).replace(/,/g, ';'),
        entry.ip_address || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `permission-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const EntryDetailModal = ({ entry }) => {
    const actionInfo = getActionInfo(entry.action);
    const actorName = entry.actor?.username || entry.actor_name || 'System';
    const targetName = entry.target?.username || entry.target_name;
    
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {actionInfo.icon} {actionInfo.label}
            </h3>
            <button onClick={() => setSelectedEntry(null)} className="text-zinc-400 hover:text-white text-xl">×</button>
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <label className="text-xs text-zinc-500">Timestamp</label>
              <p className="text-white">{new Date(entry.timestamp).toLocaleString()}</p>
            </div>
            
            <div>
              <label className="text-xs text-zinc-500">Performed By</label>
              <p className="text-white flex items-center gap-2">
                <span className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-xs">
                  {actorName?.[0]?.toUpperCase() || '?'}
                </span>
                {actorName}
              </p>
            </div>
            
            {targetName && (
              <div>
                <label className="text-xs text-zinc-500">Target User</label>
                <p className="text-white flex items-center gap-2">
                  <span className="w-6 h-6 bg-cyan-600 rounded-full flex items-center justify-center text-xs">
                    {targetName?.[0]?.toUpperCase() || '?'}
                  </span>
                  {targetName}
                </p>
              </div>
            )}
            
            <div>
              <label className="text-xs text-zinc-500">Details</label>
              <div className="bg-gray-800 rounded-lg p-3 mt-1 space-y-2">
                {entry.action === 'role_change' && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">From:</span>
                      <span className="px-2 py-0.5 bg-red-900/30 text-red-300 rounded text-sm">
                        {getRole(entry.details.old_role || entry.details.from_role)?.label || entry.details.old_role || entry.details.from_role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">To:</span>
                      <span className="px-2 py-0.5 bg-green-900/30 text-green-300 rounded text-sm">
                        {getRole(entry.details.new_role || entry.details.to_role)?.label || entry.details.new_role || entry.details.to_role}
                      </span>
                    </div>
                  </>
                )}
                
                {(entry.action === 'permission_grant' || entry.action === 'permission_revoke') && (
                  <div>
                    <span className="text-zinc-400 text-sm">Permission(s):</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {/* Handle both single permission and array of permissions */}
                      {(entry.details.permissions || (entry.details.permission ? [entry.details.permission] : [])).map(p => (
                        <span 
                          key={p} 
                          className={`px-2 py-0.5 rounded text-xs ${
                            entry.action === 'permission_grant' 
                              ? 'bg-green-900/30 text-green-300'
                              : 'bg-red-900/30 text-red-300'
                          }`}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    {entry.details.reason && (
                      <p className="text-sm text-zinc-400 mt-2">
                        <span className="text-zinc-500">Reason:</span> {entry.details.reason}
                      </p>
                    )}
                  </div>
                )}
                
                {entry.action === 'user_create' && (
                  <>
                    <p className="text-sm"><span className="text-zinc-400">Role:</span> <span className="text-white">{entry.details.role}</span></p>
                    <p className="text-sm"><span className="text-zinc-400">Email:</span> <span className="text-white">{entry.details.email}</span></p>
                  </>
                )}
                
                {entry.action === 'role_create' && (
                  <>
                    <p className="text-sm"><span className="text-zinc-400">Role ID:</span> <span className="text-white">{entry.details.role_id}</span></p>
                    <p className="text-sm"><span className="text-zinc-400">Label:</span> <span className="text-white">{entry.details.role_label}</span></p>
                    <p className="text-sm"><span className="text-zinc-400">Permissions:</span> <span className="text-white">{entry.details.permissions_count}</span></p>
                  </>
                )}
              </div>
            </div>
            
            {entry.ip_address && (
              <div>
                <label className="text-xs text-zinc-500">IP Address</label>
                <p className="text-white font-mono text-sm">{entry.ip_address}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'border-blue-700 bg-blue-900/20',
      green: 'border-green-700 bg-green-900/20',
      red: 'border-red-700 bg-red-900/20',
      purple: 'border-purple-700 bg-purple-900/20',
      cyan: 'border-cyan-700 bg-cyan-900/20',
      amber: 'border-amber-700 bg-amber-900/20',
      yellow: 'border-yellow-700 bg-yellow-900/20',
      gray: 'border-gray-700 bg-gray-900/20',
    };
    return colors[color] || colors.gray;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📜 Permission Audit Log
          </h2>
          <p className="text-sm text-zinc-400">
            Track all permission and role changes in the system
          </p>
        </div>
        
        <PermissionGate permission="settings.security.audit">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            📥 Export CSV
          </button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-48 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500"
        />
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
        >
          <option value="all">All Actions</option>
          <option value="role_change">Role Changes</option>
          <option value="permission_grant">Permission Grants</option>
          <option value="permission_revoke">Permission Revokes</option>
          <option value="user_create">User Created</option>
          <option value="impersonate">Impersonations</option>
        </select>
        <select
          value={filterDateRange}
          onChange={(e) => setFilterDateRange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-blue-300">{filteredLog.length}</div>
          <div className="text-xs text-blue-400">Total Events</div>
        </div>
        <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-purple-300">
            {filteredLog.filter(l => l.action === 'role_change').length}
          </div>
          <div className="text-xs text-purple-400">Role Changes</div>
        </div>
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-300">
            {filteredLog.filter(l => l.action === 'permission_grant').length}
          </div>
          <div className="text-xs text-green-400">Granted</div>
        </div>
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-red-300">
            {filteredLog.filter(l => l.action === 'permission_revoke').length}
          </div>
          <div className="text-xs text-red-400">Revoked</div>
        </div>
      </div>

      {/* Log entries */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-zinc-500 mt-2">Loading audit log...</p>
          </div>
        ) : filteredLog.length > 0 ? (
          filteredLog.map(entry => {
            const actionInfo = getActionInfo(entry.action);
            const actorName = entry.actor?.username || entry.actor_name || 'System';
            const targetName = entry.target?.username || entry.target_name;
            
            return (
              <button
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className={`w-full p-3 rounded-lg border text-left transition hover:brightness-110 ${getColorClasses(actionInfo.color)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{actionInfo.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{actionInfo.label}</span>
                        {targetName && (
                          <span className="text-sm text-zinc-400">→ {targetName}</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        by {actorName} • {formatTimestamp(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                  <span className="text-zinc-500">→</span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="text-center py-12 text-zinc-500">
            <span className="text-4xl">📜</span>
            <p className="mt-2">No audit entries found</p>
            <p className="text-xs mt-1">Permission changes will appear here</p>
          </div>
        )}
      </div>

      {selectedEntry && <EntryDetailModal entry={selectedEntry} />}
    </div>
  );
};

export default PermissionAuditLog;
