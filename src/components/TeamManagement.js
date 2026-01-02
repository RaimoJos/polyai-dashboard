/**
 * TeamManagement - Comprehensive team and user management
 * 
 * Features:
 * - View all team members
 * - Edit user roles and permissions
 * - Manage invitations
 * - View activity logs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api, unwrap } from '../services/api';
import { useLanguage } from '../i18n';
import { usePermissions } from '../permissions';
import { ROLES, getAllRoles } from '../permissions/PermissionsConfig';
import UserPermissions from '../permissions/UserPermissions';
import InviteUserModal from './InviteUserModal';

// User storage key
const USERS_STORAGE_KEY = 'polywerk_team_users';
const AUDIT_LOG_KEY = 'polywerk_permission_audit_log';

/**
 * Get users from localStorage (fallback when backend unavailable)
 */
const getStoredUsers = () => {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to parse stored users:', e);
    return [];
  }
};

/**
 * Save users to localStorage
 */
const saveStoredUsers = (users) => {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save users:', e);
  }
};

/**
 * Log audit event
 */
const logAuditEvent = (event) => {
  try {
    const stored = localStorage.getItem(AUDIT_LOG_KEY);
    const logs = stored ? JSON.parse(stored) : [];
    logs.unshift({
      ...event,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    });
    // Keep last 500 events
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs.slice(0, 500)));
  } catch (e) {
    console.error('Failed to log audit event:', e);
  }
};

function TeamManagement({ currentUser }) {
  const { t } = useLanguage();
  const { can, isOwner } = usePermissions();
  
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('members');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Try to load from backend first
      const [usersRes, invRes] = await Promise.all([
        api.getUsers?.().catch(() => null),
        api.listInvitations?.().catch(() => null),
      ]);

      // Get users from backend or localStorage
      let usersList = [];
      if (usersRes) {
        const data = unwrap(usersRes);
        usersList = data?.users || data?.data || [];
      }
      
      // Merge with localStorage (for custom_permissions)
      const storedUsers = getStoredUsers();
      
      // If we got users from backend, merge in stored custom_permissions
      if (usersList.length > 0) {
        usersList = usersList.map(user => {
          const stored = storedUsers.find(s => s.user_id === user.user_id);
          if (stored?.custom_permissions) {
            return { ...user, custom_permissions: stored.custom_permissions };
          }
          return user;
        });
      } else {
        // Use localStorage users as fallback
        usersList = storedUsers;
      }
      
      // Always ensure current user is in the list
      if (!usersList.find(u => u.user_id === currentUser.user_id)) {
        usersList.unshift({
          user_id: currentUser.user_id,
          username: currentUser.username,
          full_name: currentUser.full_name,
          title: currentUser.title || currentUser.job_title || '',
          email: currentUser.email || `${currentUser.username}@polywerk.ee`,
          role: currentUser.role,
          custom_permissions: currentUser.custom_permissions || { grant: [], revoke: [] },
          created_at: new Date().toISOString(),
          status: 'active',
        });
      } else {
        // Update existing user with current user data (including title)
        usersList = usersList.map(u => {
          if (u.user_id === currentUser.user_id) {
            return { 
              ...u, 
              full_name: currentUser.full_name, 
              title: currentUser.title || currentUser.job_title || u.title || u.job_title || '',
              job_title: currentUser.job_title || currentUser.title || u.job_title || u.title || '',
            };
          }
          // For other users, ensure job_title/title sync
          return {
            ...u,
            title: u.title || u.job_title || '',
            job_title: u.job_title || u.title || '',
          };
        });
      }

      // Save merged list
      saveStoredUsers(usersList);
      setUsers(usersList);

      // Load invitations
      if (invRes) {
        const invData = unwrap(invRes);
        setInvitations(invData?.data || []);
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
      // Fallback to localStorage
      setUsers(getStoredUsers());
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter users based on search
  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      user.username?.toLowerCase().includes(q) ||
      user.full_name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.role?.toLowerCase().includes(q) ||
      user.title?.toLowerCase().includes(q) ||
      user.job_title?.toLowerCase().includes(q)
    );
  });

  // Handle role change
  const handleRoleChange = async (userId, newRole) => {
    const user = users.find(u => u.user_id === userId);
    if (!user) return;

    // Prevent non-owners from changing owner role
    if (user.role === 'owner' && !isOwner) {
      alert('Only owners can modify owner accounts');
      return;
    }

    // Prevent changing to owner unless you're owner
    if (newRole === 'owner' && !isOwner) {
      alert('Only owners can assign owner role');
      return;
    }

    const oldRole = user.role;
    const updatedUsers = users.map(u => 
      u.user_id === userId ? { ...u, role: newRole } : u
    );
    
    setUsers(updatedUsers);
    saveStoredUsers(updatedUsers);
    setEditingRole(null);

    // Log audit event
    logAuditEvent({
      action: 'role_change',
      actor_id: currentUser.user_id,
      actor_name: currentUser.full_name || currentUser.username,
      target_id: userId,
      target_name: user.full_name || user.username,
      details: { old_role: oldRole, new_role: newRole },
    });

    // Try to update backend
    try {
      await api.updateUser?.(userId, { role: newRole });
    } catch (err) {
      console.error('Failed to update role on backend:', err);
    }
  };

  // Handle permission update
  const handlePermissionUpdate = (updatedUser) => {
    const oldUser = users.find(u => u.user_id === updatedUser.user_id);
    
    const updatedUsers = users.map(u => 
      u.user_id === updatedUser.user_id ? { ...u, ...updatedUser } : u
    );
    
    setUsers(updatedUsers);
    saveStoredUsers(updatedUsers);
    setSelectedUser(null);

    // Log audit events for permission changes
    const oldGrants = new Set(oldUser?.custom_permissions?.grant || []);
    const oldRevokes = new Set(oldUser?.custom_permissions?.revoke || []);
    const newGrants = new Set(updatedUser.custom_permissions?.grant || []);
    const newRevokes = new Set(updatedUser.custom_permissions?.revoke || []);

    // Log new grants
    newGrants.forEach(perm => {
      if (!oldGrants.has(perm)) {
        logAuditEvent({
          action: 'permission_grant',
          actor_id: currentUser.user_id,
          actor_name: currentUser.full_name || currentUser.username,
          target_id: updatedUser.user_id,
          target_name: updatedUser.full_name || updatedUser.username,
          details: { permission: perm },
        });
      }
    });

    // Log new revokes
    newRevokes.forEach(perm => {
      if (!oldRevokes.has(perm)) {
        logAuditEvent({
          action: 'permission_revoke',
          actor_id: currentUser.user_id,
          actor_name: currentUser.full_name || currentUser.username,
          target_id: updatedUser.user_id,
          target_name: updatedUser.full_name || updatedUser.username,
          details: { permission: perm },
        });
      }
    });

    // Update current user if we're editing ourselves
    if (updatedUser.user_id === currentUser.user_id) {
      // Update localStorage for current user
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        const current = JSON.parse(stored);
        const updated = { ...current, custom_permissions: updatedUser.custom_permissions };
        localStorage.setItem('currentUser', JSON.stringify(updated));
        sessionStorage.setItem('currentUser', JSON.stringify(updated));
      }
    }
  };

  // Handle user deletion
  const handleDeleteUser = async (userId) => {
    const user = users.find(u => u.user_id === userId);
    if (!user) return;

    if (user.user_id === currentUser.user_id) {
      alert('You cannot delete your own account');
      return;
    }

    if (user.role === 'owner' && !isOwner) {
      alert('Only owners can delete owner accounts');
      return;
    }

    if (!window.confirm(`Delete user "${user.full_name || user.username}"? This cannot be undone.`)) {
      return;
    }

    const updatedUsers = users.filter(u => u.user_id !== userId);
    setUsers(updatedUsers);
    saveStoredUsers(updatedUsers);

    // Log audit event
    logAuditEvent({
      action: 'user_delete',
      actor_id: currentUser.user_id,
      actor_name: currentUser.full_name || currentUser.username,
      target_id: userId,
      target_name: user.full_name || user.username,
      details: { role: user.role, email: user.email },
    });

    // Try to delete from backend
    try {
      await api.deleteUser?.(userId);
    } catch (err) {
      console.error('Failed to delete user from backend:', err);
    }
  };

  // Get role display info
  const getRoleInfo = (roleId) => {
    const role = ROLES[roleId];
    if (!role) return { icon: '👤', label: roleId, color: '#64748b' };
    return {
      icon: role.icon,
      label: role.label,
      color: role.color,
    };
  };

  // Render user card
  const renderUserCard = (user) => {
    const roleInfo = getRoleInfo(user.role);
    const isCurrentUser = user.user_id === currentUser.user_id;
    const canEdit = can('team.users.permissions') || isOwner;
    const canDelete = (can('team.users.delete') || isOwner) && !isCurrentUser;
    const canChangeRole = can('team.users.roles') || isOwner;
    
    // Count custom permissions
    const grantCount = user.custom_permissions?.grant?.length || 0;
    const revokeCount = user.custom_permissions?.revoke?.length || 0;
    const hasCustom = grantCount > 0 || revokeCount > 0;

    return (
      <div 
        key={user.user_id}
        className="p-4 rounded-xl border transition hover:border-purple-500/30"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{ backgroundColor: roleInfo.color + '20', color: roleInfo.color }}
          >
            {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 
             user.username?.slice(0, 2).toUpperCase() || '??'}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white truncate">
                {user.full_name || user.username}
              </span>
              {isCurrentUser && (
                <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                  You
                </span>
              )}
            </div>
            
            <p className="text-slate-400 text-sm truncate">@{user.username}</p>
            {user.email && (
              <p className="text-slate-500 text-xs truncate">{user.email}</p>
            )}

            {/* Role Badge - REMOVED per user request */}
            {/* Role information is still editable via the permissions button */}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && (
              <button
                onClick={() => setSelectedUser(user)}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"
                title="Edit permissions"
              >
                🔐
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => handleDeleteUser(user.user_id)}
                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition"
                title="Delete user"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render invitation card
  const renderInvitationCard = (inv) => {
    const roleInfo = getRoleInfo(inv.role);
    
    const statusColors = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      accepted: 'bg-green-500/20 text-green-400',
      expired: 'bg-red-500/20 text-red-400',
      cancelled: 'bg-slate-600 text-slate-400',
    };

    return (
      <div 
        key={inv.invitation_id}
        className="p-4 rounded-xl border"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white truncate">{inv.email}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[inv.status]}`}>
                {inv.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
              <span 
                className="px-2 py-0.5 rounded text-xs"
                style={{ backgroundColor: roleInfo.color + '20', color: roleInfo.color }}
              >
                {roleInfo.icon} {roleInfo.label}
              </span>
              <span>•</span>
              <span>Invited {new Date(inv.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'members', label: 'Team Members', icon: '👥', count: users.length },
    { id: 'invitations', label: 'Invitations', icon: '✉️', count: invitations.filter(i => i.status === 'pending').length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            👥 Team Management
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Manage team members, roles, and permissions
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2.5 rounded-lg font-medium text-white flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
        >
          <span>➕</span>
          Invite User
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-lg" style={{ backgroundColor: '#1e293b' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search (for members tab) */}
      {activeTab === 'members' && (
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, username, email, or role..."
            className="w-full px-4 py-3 pl-10 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-2">Loading team data...</p>
        </div>
      ) : activeTab === 'members' ? (
        <div className="space-y-3">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <p className="text-4xl mb-2">👥</p>
              <p className="text-slate-400">No team members found</p>
            </div>
          ) : (
            filteredUsers.map(renderUserCard)
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {invitations.length === 0 ? (
            <div className="p-8 text-center rounded-xl border" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <p className="text-4xl mb-2">📭</p>
              <p className="text-slate-400">No invitations yet</p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="mt-4 text-purple-400 hover:underline text-sm"
              >
                Send your first invitation →
              </button>
            </div>
          ) : (
            invitations.map(renderInvitationCard)
          )}
        </div>
      )}

      {/* User Permissions Modal */}
      {selectedUser && (
        <UserPermissions
          user={selectedUser}
          onUpdate={handlePermissionUpdate}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* Invite Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSent={loadData}
        currentUser={currentUser}
      />
    </div>
  );
}

export default TeamManagement;
