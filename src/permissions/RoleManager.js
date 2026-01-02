/**
 * RoleManager - UI for viewing and managing role definitions
 * 
 * Features:
 * - View all roles and their permissions
 * - Create custom roles
 * - Edit custom role permissions
 * - Visual permission matrix
 * 
 * @version 1.0.0
 */

import React, { useState, useMemo } from 'react';
import { useLanguage } from '../i18n';
import { usePermissions, PermissionGate } from './PermissionsContext';
import {
  ROLES,
  PERMISSIONS,
  getAllRoles,
  expandWildcards,
  getAllPermissionKeys,
  getPermissionMeta,
} from './PermissionsConfig';

const RoleManager = ({ onRoleUpdate, onRoleCreate, customRoles = [] }) => {
  const { t } = useLanguage();
  const { can } = usePermissions();
  
  const [selectedRole, setSelectedRole] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedModules, setExpandedModules] = useState(new Set(['business', 'production']));
  const [newRole, setNewRole] = useState({
    id: '',
    label: '',
    description: '',
    icon: '🔹',
    color: 'cyan',
    permissions: [],
  });
  
  // Combine system roles with custom roles
  const allRoles = useMemo(() => {
    const systemRoles = getAllRoles();
    const custom = customRoles.map(r => ({ ...r, isCustom: true }));
    return [...systemRoles, ...custom].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }, [customRoles]);

  const getRoleColor = (role) => {
    const colors = {
      amber: 'bg-amber-900/50 text-amber-300 border-amber-700',
      purple: 'bg-purple-900/50 text-purple-300 border-purple-700',
      blue: 'bg-blue-900/50 text-blue-300 border-blue-700',
      green: 'bg-green-900/50 text-green-300 border-green-700',
      gray: 'bg-gray-700 text-gray-300 border-gray-600',
      cyan: 'bg-cyan-900/50 text-cyan-300 border-cyan-700',
      red: 'bg-red-900/50 text-red-300 border-red-700',
    };
    return colors[role.color] || colors.gray;
  };

  const toggleModule = (moduleName) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleName)) {
        next.delete(moduleName);
      } else {
        next.add(moduleName);
      }
      return next;
    });
  };

  const getRolePermissionSet = (role) => {
    return new Set(expandWildcards(role.permissions || []));
  };

  const countModulePermissions = (role, moduleName) => {
    const rolePerms = getRolePermissionSet(role);
    const modulePerms = Object.keys(PERMISSIONS[moduleName]?.permissions || {})
      .map(p => `${moduleName}.${p}`);
    const granted = modulePerms.filter(p => rolePerms.has(p)).length;
    return { granted, total: modulePerms.length };
  };

  const handleCreateRole = () => {
    if (!newRole.id || !newRole.label) return;
    
    onRoleCreate?.({
      ...newRole,
      id: newRole.id.toLowerCase().replace(/\s+/g, '_'),
      priority: 30,
      isCustom: true,
    });
    
    setNewRole({
      id: '',
      label: '',
      description: '',
      icon: '🔹',
      color: 'cyan',
      permissions: [],
    });
    setIsCreating(false);
  };

  const togglePermissionInNewRole = (permission) => {
    setNewRole(prev => {
      const has = prev.permissions.includes(permission);
      return {
        ...prev,
        permissions: has 
          ? prev.permissions.filter(p => p !== permission)
          : [...prev.permissions, permission]
      };
    });
  };

  const toggleModuleInNewRole = (moduleName) => {
    const modulePerms = Object.keys(PERMISSIONS[moduleName]?.permissions || {})
      .map(p => `${moduleName}.${p}`);
    
    setNewRole(prev => {
      const hasAll = modulePerms.every(p => prev.permissions.includes(p));
      if (hasAll) {
        return {
          ...prev,
          permissions: prev.permissions.filter(p => !modulePerms.includes(p))
        };
      } else {
        const newPerms = new Set([...prev.permissions, ...modulePerms]);
        return { ...prev, permissions: Array.from(newPerms) };
      }
    });
  };

  // Role card component
  const RoleCard = ({ role }) => {
    const isSelected = selectedRole?.id === role.id;
    const permCount = getRolePermissionSet(role).size;
    
    return (
      <button
        onClick={() => setSelectedRole(isSelected ? null : role)}
        className={`w-full p-4 rounded-lg border text-left transition-all ${
          isSelected 
            ? 'bg-purple-900/30 border-purple-500 ring-2 ring-purple-500/50' 
            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{role.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{role.label}</span>
                {role.isSystem && (
                  <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">System</span>
                )}
                {role.isCustom && (
                  <span className="px-1.5 py-0.5 text-xs bg-cyan-900/50 text-cyan-400 rounded">Custom</span>
                )}
              </div>
              <p className="text-sm text-zinc-500">{role.description}</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`px-2 py-1 rounded text-sm border ${getRoleColor(role)}`}>
              {role.permissions?.includes('*') ? 'Full Access' : `${permCount} permissions`}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Priority: {role.priority}</div>
          </div>
        </div>
      </button>
    );
  };

  // Permission matrix view
  const PermissionMatrix = ({ role }) => {
    if (!role) return null;
    
    const rolePerms = getRolePermissionSet(role);
    const hasWildcard = role.permissions?.includes('*');
    
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{role.icon}</span>
            <div>
              <h3 className="text-lg font-bold text-white">{role.label}</h3>
              <p className="text-sm text-zinc-400">{role.description}</p>
            </div>
          </div>
          
          {role.isCustom && can('team.users.permissions') && (
            <div className="flex gap-2">
              <button
                onClick={() => onRoleUpdate?.(role)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition"
              >
                ✏️ Edit
              </button>
            </div>
          )}
        </div>

        {hasWildcard ? (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 text-center">
            <span className="text-3xl">👑</span>
            <p className="text-amber-300 font-semibold mt-2">Full System Access</p>
            <p className="text-amber-400/70 text-sm">This role has unrestricted access to all features</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(PERMISSIONS).map(([moduleName, moduleConfig]) => {
              const { granted, total } = countModulePermissions(role, moduleName);
              const isExpanded = expandedModules.has(moduleName);
              const hasAny = granted > 0;
              
              return (
                <div key={moduleName} className="border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleModule(moduleName)}
                    className={`w-full flex items-center justify-between p-3 transition ${
                      hasAny ? 'bg-gray-800 hover:bg-gray-750' : 'bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{moduleConfig.icon}</span>
                      <span className={`font-medium ${hasAny ? 'text-white' : 'text-zinc-500'}`}>
                        {moduleConfig.label}
                      </span>
                      {moduleConfig.premium && (
                        <span className="px-1.5 py-0.5 text-xs bg-amber-900/50 text-amber-400 rounded">Premium</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              granted === total ? 'bg-green-500' : granted > 0 ? 'bg-blue-500' : 'bg-gray-600'
                            }`}
                            style={{ width: `${(granted / total) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-zinc-400">{granted}/{total}</span>
                      </div>
                      <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="p-3 bg-gray-850 border-t border-gray-700 grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(moduleConfig.permissions).map(([permKey, permMeta]) => {
                        const fullKey = `${moduleName}.${permKey}`;
                        const hasPermission = rolePerms.has(fullKey);
                        
                        return (
                          <div
                            key={fullKey}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                              hasPermission 
                                ? 'bg-green-900/30 text-green-300' 
                                : 'bg-gray-800/50 text-zinc-500'
                            }`}
                            title={permMeta.description}
                          >
                            <span>{hasPermission ? '✓' : '○'}</span>
                            <span className="truncate">{permMeta.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-400">
            View raw permission list ({role.permissions?.length || 0} entries)
          </summary>
          <div className="mt-2 p-3 bg-gray-800 rounded-lg font-mono text-xs text-zinc-400 max-h-40 overflow-auto">
            {role.permissions?.map((p, i) => (
              <div key={i}>{p}</div>
            ))}
          </div>
        </details>
      </div>
    );
  };

  // Create role modal
  const CreateRoleModal = () => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">🛡️ Create Custom Role</h2>
          <button onClick={() => setIsCreating(false)} className="text-zinc-400 hover:text-white text-xl">×</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Role ID (unique)</label>
              <input
                type="text"
                value={newRole.id}
                onChange={(e) => setNewRole({...newRole, id: e.target.value})}
                placeholder="e.g., sales_rep"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Display Label</label>
              <input
                type="text"
                value={newRole.label}
                onChange={(e) => setNewRole({...newRole, label: e.target.value})}
                placeholder="e.g., Sales Representative"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Description</label>
            <input
              type="text"
              value={newRole.description}
              onChange={(e) => setNewRole({...newRole, description: e.target.value})}
              placeholder="Brief description of this role's purpose"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Icon</label>
              <div className="flex gap-2">
                {['🔹', '⭐', '🎯', '📌', '🔑', '🎖️', '💎', '🏅'].map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewRole({...newRole, icon})}
                    className={`p-2 rounded-lg text-xl ${
                      newRole.icon === icon ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Color</label>
              <div className="flex gap-2">
                {['cyan', 'purple', 'blue', 'green', 'amber', 'red'].map(color => (
                  <button
                    key={color}
                    onClick={() => setNewRole({...newRole, color})}
                    className={`w-8 h-8 rounded-lg ${
                      newRole.color === color ? 'ring-2 ring-white' : ''
                    } bg-${color}-600`}
                  />
                ))}
              </div>
            </div>
          </div>
          
          {/* Permissions */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Permissions ({newRole.permissions.length} selected)</label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(PERMISSIONS).map(([moduleName, moduleConfig]) => {
                const modulePerms = Object.keys(moduleConfig.permissions).map(p => `${moduleName}.${p}`);
                const selectedCount = modulePerms.filter(p => newRole.permissions.includes(p)).length;
                const isExpanded = expandedModules.has(moduleName);
                
                return (
                  <div key={moduleName} className="border border-gray-700 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-2 bg-gray-800">
                      <button
                        onClick={() => toggleModule(moduleName)}
                        className="flex items-center gap-2"
                      >
                        <span>{moduleConfig.icon}</span>
                        <span className="text-white">{moduleConfig.label}</span>
                        <span className="text-xs text-zinc-500">({selectedCount}/{modulePerms.length})</span>
                      </button>
                      <button
                        onClick={() => toggleModuleInNewRole(moduleName)}
                        className={`px-2 py-1 text-xs rounded ${
                          selectedCount === modulePerms.length 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-700 text-zinc-400'
                        }`}
                      >
                        {selectedCount === modulePerms.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    
                    {isExpanded && (
                      <div className="p-2 bg-gray-850 grid grid-cols-2 gap-1">
                        {Object.entries(moduleConfig.permissions).map(([permKey, permMeta]) => {
                          const fullKey = `${moduleName}.${permKey}`;
                          const isSelected = newRole.permissions.includes(fullKey);
                          
                          return (
                            <label
                              key={fullKey}
                              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${
                                isSelected ? 'bg-green-900/30 text-green-300' : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePermissionInNewRole(fullKey)}
                                className="rounded"
                              />
                              <span className="text-sm truncate">{permMeta.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 p-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={() => setIsCreating(false)}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateRole}
            disabled={!newRole.id || !newRole.label}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50"
          >
            Create Role
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🛡️ Role Management
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            View and manage user roles and their permissions
          </p>
        </div>
        
        <PermissionGate permission="team.users.permissions">
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:from-purple-500 hover:to-cyan-500 transition"
          >
            + Create Custom Role
          </button>
        </PermissionGate>
      </div>

      {/* Role list */}
      <div className="grid gap-3">
        {allRoles.map(role => (
          <RoleCard key={role.id} role={role} />
        ))}
      </div>

      {/* Selected role details */}
      {selectedRole && <PermissionMatrix role={selectedRole} />}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{allRoles.length}</div>
          <div className="text-sm text-zinc-400">Total Roles</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{Object.keys(PERMISSIONS).length}</div>
          <div className="text-sm text-zinc-400">Modules</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{getAllPermissionKeys().length}</div>
          <div className="text-sm text-zinc-400">Permissions</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{customRoles.length}</div>
          <div className="text-sm text-zinc-400">Custom Roles</div>
        </div>
      </div>

      {/* Create modal */}
      {isCreating && <CreateRoleModal />}
    </div>
  );
};

export default RoleManager;
