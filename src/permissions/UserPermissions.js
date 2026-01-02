/**
 * UserPermissions - UI for managing individual user permission overrides
 * 
 * Features:
 * - View user's effective permissions
 * - Grant additional permissions beyond role
 * - Revoke specific permissions from role
 * - Change user role
 * 
 * @version 1.0.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../i18n';
import { usePermissions, PermissionGate } from './PermissionsContext';
import {
  PERMISSIONS,
  getAllRoles,
  getRole,
  expandWildcards,
  getAllPermissionKeys,
  calculateEffectivePermissions,
  getPermissionMeta,
  getModuleMeta,
} from './PermissionsConfig';
import toast from '../utils/toast';

const UserPermissions = ({ 
  user, 
  onUpdate, 
  onClose,
}) => {
  const { t } = useLanguage();
  const { can, isOwner } = usePermissions();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [pendingChanges, setPendingChanges] = useState({
    role: user?.role,
    grant: [...(user?.custom_permissions?.grant || [])],
    revoke: [...(user?.custom_permissions?.revoke || [])],
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calculate what permissions the user would have with pending changes
  const effectivePermissions = useMemo(() => {
    const mockUser = {
      role: pendingChanges.role,
      custom_permissions: {
        grant: pendingChanges.grant,
        revoke: pendingChanges.revoke,
      }
    };
    return calculateEffectivePermissions(mockUser);
  }, [pendingChanges]);

  const baseRolePermissions = useMemo(() => {
    const role = getRole(pendingChanges.role);
    if (!role) return new Set();
    return new Set(expandWildcards(role.permissions));
  }, [pendingChanges.role]);

  // Track changes
  useEffect(() => {
    const originalRole = user?.role;
    const originalGrant = user?.custom_permissions?.grant || [];
    const originalRevoke = user?.custom_permissions?.revoke || [];
    
    const changed = 
      pendingChanges.role !== originalRole ||
      JSON.stringify(pendingChanges.grant.sort()) !== JSON.stringify([...originalGrant].sort()) ||
      JSON.stringify(pendingChanges.revoke.sort()) !== JSON.stringify([...originalRevoke].sort());
    
    setHasChanges(changed);
  }, [pendingChanges, user]);

  const handleRoleChange = (newRole) => {
    setPendingChanges(prev => ({ ...prev, role: newRole }));
  };

  const handleToggleGrant = (permission) => {
    setPendingChanges(prev => {
      const isGranted = prev.grant.includes(permission);
      if (isGranted) {
        return { ...prev, grant: prev.grant.filter(p => p !== permission) };
      } else {
        return { 
          ...prev, 
          grant: [...prev.grant, permission],
          revoke: prev.revoke.filter(p => p !== permission)
        };
      }
    });
  };

  const handleToggleRevoke = (permission) => {
    setPendingChanges(prev => {
      const isRevoked = prev.revoke.includes(permission);
      if (isRevoked) {
        return { ...prev, revoke: prev.revoke.filter(p => p !== permission) };
      } else {
        return { 
          ...prev, 
          revoke: [...prev.revoke, permission],
          grant: prev.grant.filter(p => p !== permission)
        };
      }
    });
  };

  const handleSave = async () => {
    if (!can('team.users.permissions')) {
      toast.error('No permission to modify user permissions');
      return;
    }

    setSaving(true);
    const updateData = {
      ...user,
      role: pendingChanges.role,
      custom_permissions: {
        grant: pendingChanges.grant,
        revoke: pendingChanges.revoke,
      }
    };

    try {
      await onUpdate?.(updateData);
      toast.success('Permissions updated successfully');
      onClose?.();
    } catch (err) {
      toast.error('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPendingChanges({
      role: user?.role,
      grant: [...(user?.custom_permissions?.grant || [])],
      revoke: [...(user?.custom_permissions?.revoke || [])],
    });
  };

  const currentRole = getRole(pendingChanges.role);
  const allPermissions = getAllPermissionKeys();
  
  // Filter permissions
  const filteredPermissions = useMemo(() => {
    let perms = allPermissions;
    
    if (selectedModule !== 'all') {
      perms = perms.filter(p => p.startsWith(selectedModule + '.'));
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      perms = perms.filter(p => {
        const meta = getPermissionMeta(p);
        return p.toLowerCase().includes(q) || 
               meta?.label?.toLowerCase().includes(q) ||
               meta?.description?.toLowerCase().includes(q);
      });
    }
    
    return perms;
  }, [allPermissions, selectedModule, searchQuery]);

  // Group permissions by module
  const permissionsByModule = useMemo(() => {
    const grouped = {};
    filteredPermissions.forEach(p => {
      const [module] = p.split('.');
      if (!grouped[module]) grouped[module] = [];
      grouped[module].push(p);
    });
    return grouped;
  }, [filteredPermissions]);

  // Permission row component
  const PermissionRow = ({ permission }) => {
    const meta = getPermissionMeta(permission);
    const [module] = permission.split('.');
    const moduleMeta = getModuleMeta(module);
    
    const fromRole = baseRolePermissions.has(permission);
    const isGranted = pendingChanges.grant.includes(permission);
    const isRevoked = pendingChanges.revoke.includes(permission);
    const hasPermission = effectivePermissions.has(permission);
    
    let status = 'none';
    let statusColor = 'text-zinc-500';
    let statusBg = 'bg-gray-800/50';
    
    if (hasPermission) {
      if (fromRole && !isRevoked) {
        status = 'role';
        statusColor = 'text-blue-400';
        statusBg = 'bg-blue-900/30';
      } else if (isGranted) {
        status = 'granted';
        statusColor = 'text-green-400';
        statusBg = 'bg-green-900/30';
      }
    } else if (isRevoked) {
      status = 'revoked';
      statusColor = 'text-red-400';
      statusBg = 'bg-red-900/30';
    }

    return (
      <div className={`flex items-center justify-between p-3 rounded-lg ${statusBg} hover:bg-gray-800 transition`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${hasPermission ? 'text-white' : 'text-zinc-400'}`}>
              {meta?.label || permission.split('.').slice(1).join('.')}
            </span>
            {moduleMeta?.premium && (
              <span className="px-1 py-0.5 text-xs bg-amber-900/50 text-amber-400 rounded">AI</span>
            )}
          </div>
          <p className="text-xs text-zinc-500 truncate">{permission}</p>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <div className={`text-xs px-2 py-1 rounded ${statusColor}`}>
            {status === 'role' && '📋 From Role'}
            {status === 'granted' && '✅ Granted'}
            {status === 'revoked' && '🚫 Revoked'}
            {status === 'none' && '○ No Access'}
          </div>
          
          <PermissionGate permission="team.users.permissions">
            <div className="flex gap-1">
              {(!fromRole || isRevoked) && (
                <button
                  onClick={() => handleToggleGrant(permission)}
                  className={`p-1.5 rounded transition ${
                    isGranted 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-700 text-zinc-400 hover:bg-green-900/50 hover:text-green-400'
                  }`}
                  title={isGranted ? 'Remove grant' : 'Grant permission'}
                >
                  +
                </button>
              )}
              
              {fromRole && (
                <button
                  onClick={() => handleToggleRevoke(permission)}
                  className={`p-1.5 rounded transition ${
                    isRevoked 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-700 text-zinc-400 hover:bg-red-900/50 hover:text-red-400'
                  }`}
                  title={isRevoked ? 'Remove revoke' : 'Revoke permission'}
                >
                  −
                </button>
              )}
            </div>
          </PermissionGate>
        </div>
      </div>
    );
  };

  // Overview tab
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* User card */}
      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border border-purple-700/50 rounded-xl">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full flex items-center justify-center text-2xl text-white font-bold">
          {user?.username?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{user?.display_name || user?.username}</h3>
          <p className="text-sm text-zinc-400">@{user?.username}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl">{currentRole?.icon}</span>
            <span className={`px-2 py-0.5 rounded text-sm ${
              currentRole?.color === 'amber' ? 'bg-amber-900/50 text-amber-300' :
              currentRole?.color === 'purple' ? 'bg-purple-900/50 text-purple-300' :
              currentRole?.color === 'blue' ? 'bg-blue-900/50 text-blue-300' :
              currentRole?.color === 'green' ? 'bg-green-900/50 text-green-300' :
              'bg-gray-700 text-gray-300'
            }`}>
              {currentRole?.label || pendingChanges.role}
            </span>
          </div>
        </div>
      </div>

      {/* Role selector */}
      <PermissionGate permission="team.users.roles">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Change Role</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {getAllRoles().map(role => {
              if (role.id === 'owner' && !isOwner) return null;
              
              const isSelected = pendingChanges.role === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => handleRoleChange(role.id)}
                  disabled={user?.role === 'owner' && !isOwner}
                  className={`p-3 rounded-lg border text-left transition ${
                    isSelected 
                      ? 'bg-purple-900/30 border-purple-500' 
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{role.icon}</span>
                    <span className="font-medium text-white">{role.label}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{role.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </PermissionGate>

      {/* Permission summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-300">{baseRolePermissions.size}</div>
          <div className="text-sm text-blue-400">From Role</div>
        </div>
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-300">+{pendingChanges.grant.length}</div>
          <div className="text-sm text-green-400">Granted</div>
        </div>
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-300">−{pendingChanges.revoke.length}</div>
          <div className="text-sm text-red-400">Revoked</div>
        </div>
      </div>

      {/* Custom overrides */}
      {(pendingChanges.grant.length > 0 || pendingChanges.revoke.length > 0) && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Custom Overrides</h4>
          
          {pendingChanges.grant.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-green-400 mb-2">✅ Granted ({pendingChanges.grant.length})</p>
              <div className="flex flex-wrap gap-1">
                {pendingChanges.grant.map(p => (
                  <span 
                    key={p} 
                    className="px-2 py-1 bg-green-900/30 text-green-300 rounded text-xs cursor-pointer hover:bg-green-900/50"
                    onClick={() => handleToggleGrant(p)}
                    title="Click to remove"
                  >
                    {p} ×
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {pendingChanges.revoke.length > 0 && (
            <div>
              <p className="text-xs text-red-400 mb-2">🚫 Revoked ({pendingChanges.revoke.length})</p>
              <div className="flex flex-wrap gap-1">
                {pendingChanges.revoke.map(p => (
                  <span 
                    key={p} 
                    className="px-2 py-1 bg-red-900/30 text-red-300 rounded text-xs cursor-pointer hover:bg-red-900/50"
                    onClick={() => handleToggleRevoke(p)}
                    title="Click to remove"
                  >
                    {p} ×
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Permissions tab
  const PermissionsTab = () => (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search permissions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-48 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500"
        />
        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
        >
          <option value="all">All Modules</option>
          {Object.entries(PERMISSIONS).map(([key, mod]) => (
            <option key={key} value={key}>{mod.icon} {mod.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {Object.entries(permissionsByModule).map(([moduleName, perms]) => {
          const moduleMeta = getModuleMeta(moduleName);
          return (
            <div key={moduleName}>
              <div className="flex items-center gap-2 mb-2 sticky top-0 bg-gray-900 py-1 z-10">
                <span className="text-xl">{moduleMeta?.icon}</span>
                <span className="font-semibold text-white">{moduleMeta?.label || moduleName}</span>
                <span className="text-sm text-zinc-500">({perms.length})</span>
              </div>
              <div className="space-y-1">
                {perms.map(p => <PermissionRow key={p} permission={p} />)}
              </div>
            </div>
          );
        })}
        
        {filteredPermissions.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            No permissions match your search
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            🔐 User Permissions
            {hasChanges && <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded">Unsaved</span>}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {[
            { id: 'overview', label: 'Overview', icon: '📋' },
            { id: 'permissions', label: 'All Permissions', icon: '🔑' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition ${
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
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'permissions' && <PermissionsTab />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-800/50">
          <div className="text-sm text-zinc-400">
            Effective: <span className="text-white font-medium">{effectivePermissions.size}</span> permissions
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={!hasChanges}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition"
            >
              Reset
            </button>
            <PermissionGate permission="team.users.permissions">
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 transition"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </PermissionGate>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPermissions;
