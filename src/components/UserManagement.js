import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { safeJsonParse } from '../utils/safeJson';
import toast from '../utils/toast';

/**
 * User Management Component
 * Allows owners to manage users with role-based access control
 */
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
    role: 'worker',
  });

  // Note: Client-side permission checks are for UI display only.
  // Server must always validate permissions on API calls.
  const currentUserData = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
  const permissionsData = sessionStorage.getItem('userPermissions');
  const currentUser = safeJsonParse(currentUserData, {});
  const permissions = safeJsonParse(permissionsData, null) || currentUser.permissions;
  const canManageUsers = permissions?.users || currentUser.role === 'owner';

  const fetchUsers = useCallback(async () => {
    if (!canManageUsers) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const userData = await api.listUsers();
      // API now returns array directly or throws on auth error
      setUsers(Array.isArray(userData) ? userData : []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      // Check if it's an auth error
      if (err?.status === 401 || err?.status === 403) {
        setError('Not authorized to manage users');
      } else {
        setError('Failed to load users');
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [canManageUsers]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setActionLoading('add');
    setError(null);

    try {
      await api.createUser(formData);
      setShowAddUser(false);
      setFormData({
        username: '',
        full_name: '',
        email: '',
        password: '',
        role: 'worker',
      });
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setActionLoading('update');
    setError(null);

    try {
      const updates = {
        full_name: formData.full_name,
        email: formData.email,
        role: formData.role,
      };
      await api.updateUser(editingUser.user_id, updates);
      setEditingUser(null);
      setFormData({
        username: '',
        full_name: '',
        email: '',
        password: '',
        role: 'worker',
      });
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm('Deactivate this user?')) return;

    setActionLoading(`deactivate-${userId}`);
    try {
      await api.deactivateUser(userId);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to deactivate user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (userId) => {
    setActionLoading(`activate-${userId}`);
    try {
      await api.activateUser(userId);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to activate user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (userId) => {
    const newPassword = window.prompt('Enter new password (min 8 characters):');
    if (!newPassword || newPassword.length < 8) {
      if (newPassword) toast.error('Password must be at least 8 characters');
      return;
    }

    setActionLoading(`reset-${userId}`);
    try {
      await api.resetUserPassword(userId, newPassword);
      toast.success('Password reset successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setActionLoading(null);
    }
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      full_name: user.full_name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'worker',
    });
    setShowAddUser(false);
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      full_name: '',
      email: '',
      password: '',
      role: 'worker',
    });
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner': return '👑';
      case 'partner': return '🤝';
      case 'worker': return '🔧';
      default: return '👤';
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-700';
      case 'partner': return 'bg-blue-100 text-blue-700';
      case 'worker': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!canManageUsers) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-gray-600">You don't have permission to manage users</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-4xl mb-4">⏳</p>
        <p className="text-gray-600">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">👥 User Management</h2>
        <button
          onClick={() => {
            setShowAddUser(!showAddUser);
            cancelEdit();
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showAddUser ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded flex justify-between">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Add User Form */}
      {showAddUser && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-bold mb-4">Add New User</h3>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username *</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Full Name *</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password *</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="worker">🔧 Worker</option>
                <option value="partner">🤝 Partner</option>
                <option value="owner">👑 Owner</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={actionLoading === 'add'}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {actionLoading === 'add' ? '⏳ Creating...' : '✅ Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Form */}
      {editingUser && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-bold mb-4">Edit User: {editingUser.username}</h3>
          <form onSubmit={handleUpdateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="worker">🔧 Worker</option>
                <option value="partner">🤝 Partner</option>
                <option value="owner">👑 Owner</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={actionLoading === 'update'}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {actionLoading === 'update' ? '⏳ Saving...' : '💾 Save'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      {users.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-4xl mb-4">👥</p>
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2">User</th>
                <th className="text-left py-3 px-2">Email</th>
                <th className="text-center py-3 px-2">Role</th>
                <th className="text-center py-3 px-2">Status</th>
                <th className="text-center py-3 px-2">Last Login</th>
                <th className="text-right py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.user_id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <div>
                      <p className="font-medium">{user.full_name || user.username}</p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-600">
                    {user.email || '-'}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                      {getRoleIcon(user.role)} {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {user.is_active !== false ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Active</span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Inactive</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => startEdit(user)}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.user_id)}
                        disabled={!!actionLoading}
                        className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                        title="Reset Password"
                      >
                        🔑
                      </button>
                      {user.is_active !== false ? (
                        <button
                          onClick={() => handleDeactivate(user.user_id)}
                          disabled={!!actionLoading || user.user_id === currentUser.user_id}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                          title="Deactivate"
                        >
                          🚫
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(user.user_id)}
                          disabled={!!actionLoading}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          title="Activate"
                        >
                          ✅
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Role Permissions Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm">
        <h4 className="font-bold mb-2">Role Permissions</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="font-medium">👑 Owner</p>
            <p className="text-gray-600 text-xs">Full access to all features including user management, config, reports</p>
          </div>
          <div>
            <p className="font-medium">🤝 Partner</p>
            <p className="text-gray-600 text-xs">Access to printers, orders, clients, reports. No user management</p>
          </div>
          <div>
            <p className="font-medium">🔧 Worker</p>
            <p className="text-gray-600 text-xs">Basic access to printers and production. Limited business data</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
