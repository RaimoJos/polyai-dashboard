/**
 * PolyAI Permissions System - React Context
 * 
 * Provides permission checking throughout the application via React Context.
 * 
 * Usage:
 *   <PermissionsProvider user={currentUser}>
 *     <App />
 *   </PermissionsProvider>
 * 
 *   const { can, canAny, canAll } = usePermissions();
 *   if (can('business.orders.create')) { ... }
 * 
 * @version 1.0.0
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import {
  ROLES,
  PERMISSIONS,
  userHasPermission,
  userHasAnyPermission,
  userHasAllPermissions,
  calculateEffectivePermissions,
  getRole,
  getPermissionMeta,
  getModuleMeta,
  // Tab visibility
  getTabVisibility,
  isTabVisible,
  // Financial data filtering
  canViewFinancials,
  filterFinancialData,
  filterFinancialDataArray,
  SENSITIVE_FINANCIAL_FIELDS,
} from './PermissionsConfig';

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const PermissionsContext = createContext({
  user: null,
  role: null,
  permissions: new Set(),
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  cannot: () => true,
  isOwner: false,
  isAdmin: false,
  isAuthenticated: false,
});

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

/**
 * PermissionsProvider - Wrap your app to provide permission context
 */
export const PermissionsProvider = ({ user, children }) => {
  // Get role configuration
  const role = useMemo(() => {
    return user?.role ? getRole(user.role) : null;
  }, [user?.role]);

  // Calculate effective permissions (memoized for performance)
  const permissions = useMemo(() => {
    if (!user) return new Set();
    return calculateEffectivePermissions(user);
  }, [user]);

  // Permission check functions (memoized)
  const can = useCallback((permission) => {
    return userHasPermission(user, permission);
  }, [user]);

  const canAny = useCallback((permissionList) => {
    return userHasAnyPermission(user, permissionList);
  }, [user]);

  const canAll = useCallback((permissionList) => {
    return userHasAllPermissions(user, permissionList);
  }, [user]);

  const cannot = useCallback((permission) => {
    return !userHasPermission(user, permission);
  }, [user]);

  // Convenience flags
  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin' || isOwner;
  const isAuthenticated = !!user;

  // Context value
  const value = useMemo(() => ({
    user,
    role,
    permissions,
    can,
    canAny,
    canAll,
    cannot,
    isOwner,
    isAdmin,
    isAuthenticated,
    // Expose config helpers
    getRole,
    getPermissionMeta,
    getModuleMeta,
    ROLES,
    PERMISSIONS,
  }), [user, role, permissions, can, canAny, canAll, cannot, isOwner, isAdmin, isAuthenticated]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * usePermissions - Main hook for permission checking
 */
export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    console.warn('usePermissions must be used within PermissionsProvider');
    return {
      user: null,
      role: null,
      permissions: new Set(),
      can: () => false,
      canAny: () => false,
      canAll: () => false,
      cannot: () => true,
      isOwner: false,
      isAdmin: false,
      isAuthenticated: false,
    };
  }
  return context;
};

/**
 * usePermission - Check a single permission
 */
export const usePermission = (permission) => {
  const { can } = usePermissions();
  return useMemo(() => can(permission), [can, permission]);
};

/**
 * useRole - Get current user's role
 */
export const useRole = () => {
  const { role } = usePermissions();
  return role;
};

/**
 * useIsOwner - Check if current user is owner
 */
export const useIsOwner = () => {
  const { isOwner } = usePermissions();
  return isOwner;
};

/**
 * useIsAdmin - Check if current user is admin or owner
 */
export const useIsAdmin = () => {
  const { isAdmin } = usePermissions();
  return isAdmin;
};

/**
 * useCanViewFinancials - Check if user can view financial/cost data
 */
export const useCanViewFinancials = () => {
  const { user } = usePermissions();
  return useMemo(() => canViewFinancials(user), [user]);
};

/**
 * useFilterFinancials - Returns functions to filter financial data
 * 
 * @example
 * const { filterData, filterArray } = useFilterFinancials();
 * const safeOrder = filterData(order);
 * const safeOrders = filterArray(orders);
 */
export const useFilterFinancials = () => {
  const { user } = usePermissions();
  
  const filterData = useCallback((data) => {
    return filterFinancialData(data, user);
  }, [user]);
  
  const filterArray = useCallback((items) => {
    return filterFinancialDataArray(items, user);
  }, [user]);
  
  return { filterData, filterArray, canView: canViewFinancials(user) };
};

/**
 * useTabVisibility - Get visible tabs for current user
 * 
 * @example
 * const { visibleTabs, isTabVisible } = useTabVisibility();
 * const tabs = allTabs.filter(t => visibleTabs[t.id]);
 */
export const useTabVisibility = () => {
  const { user } = usePermissions();
  
  const visibleTabs = useMemo(() => getTabVisibility(user), [user]);
  
  const checkTabVisible = useCallback((tabId) => {
    return isTabVisible(user, tabId);
  }, [user]);
  
  return { visibleTabs, isTabVisible: checkTabVisible };
};

// ============================================================================
// PERMISSION GATE COMPONENT
// ============================================================================

/**
 * PermissionGate - Conditionally render children based on permissions
 * 
 * @example
 * <PermissionGate permission="business.orders.create">
 *   <CreateOrderButton />
 * </PermissionGate>
 * 
 * <PermissionGate permissions={['orders.edit', 'orders.delete']} allOf>
 *   <OrderActions />
 * </PermissionGate>
 */
export const PermissionGate = ({ 
  permission, 
  permissions, 
  allOf = false, 
  fallback = null, 
  children 
}) => {
  const { can, canAny, canAll } = usePermissions();

  const hasAccess = useMemo(() => {
    if (permission) {
      return can(permission);
    }
    
    if (permissions && permissions.length > 0) {
      return allOf ? canAll(permissions) : canAny(permissions);
    }
    
    return true;
  }, [permission, permissions, allOf, can, canAny, canAll]);

  return hasAccess ? children : fallback;
};

/**
 * OwnerOnly - Only render for owner role
 */
export const OwnerOnly = ({ fallback = null, children }) => {
  const { isOwner } = usePermissions();
  return isOwner ? children : fallback;
};

/**
 * AdminOnly - Only render for admin or owner roles
 */
export const AdminOnly = ({ fallback = null, children }) => {
  const { isAdmin } = usePermissions();
  return isAdmin ? children : fallback;
};

/**
 * AuthenticatedOnly - Only render for authenticated users
 */
export const AuthenticatedOnly = ({ fallback = null, children }) => {
  const { isAuthenticated } = usePermissions();
  return isAuthenticated ? children : fallback;
};

/**
 * FinancialsGate - Only render financial content for users with financial access
 * Use this to hide revenue, profit, cost breakdowns from workers
 * 
 * @example
 * <FinancialsGate>
 *   <ProfitMarginDisplay value={order.profit_margin} />
 * </FinancialsGate>
 * 
 * <FinancialsGate fallback={<span>--</span>}>
 *   €{order.cost.toFixed(2)}
 * </FinancialsGate>
 */
export const FinancialsGate = ({ fallback = null, children }) => {
  const canView = useCanViewFinancials();
  return canView ? children : fallback;
};

// ============================================================================
// HIGHER-ORDER COMPONENTS
// ============================================================================

/**
 * withPermissions - HOC to inject permissions into component props
 */
export const withPermissions = (WrappedComponent) => {
  const WithPermissionsComponent = (props) => {
    const permissions = usePermissions();
    return <WrappedComponent {...props} permissions={permissions} />;
  };
  
  WithPermissionsComponent.displayName = `WithPermissions(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  
  return WithPermissionsComponent;
};

/**
 * withPermissionGate - HOC that only renders if user has permission
 */
export const withPermissionGate = (requiredPermissions, options = {}) => {
  const { allOf = false, fallback = null } = options;
  
  return (WrappedComponent) => {
    const GatedComponent = (props) => {
      const permissions = Array.isArray(requiredPermissions) 
        ? requiredPermissions 
        : [requiredPermissions];
      
      return (
        <PermissionGate permissions={permissions} allOf={allOf} fallback={fallback}>
          <WrappedComponent {...props} />
        </PermissionGate>
      );
    };
    
    GatedComponent.displayName = `PermissionGated(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    
    return GatedComponent;
  };
};

// ============================================================================
// DEBUG COMPONENT
// ============================================================================

/**
 * PermissionDebug - Debug component showing current permissions (dev only)
 */
export const PermissionDebug = () => {
  const { user, role, permissions, isOwner, isAdmin } = usePermissions();
  
  if (process.env.NODE_ENV === 'production') return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs max-w-sm max-h-96 overflow-auto z-50 font-mono">
      <div className="font-bold mb-2">🔐 Permission Debug</div>
      <div><strong>User:</strong> {user?.username || 'none'}</div>
      <div><strong>Role:</strong> {role?.label || 'none'} ({user?.role})</div>
      <div><strong>Owner:</strong> {isOwner ? '✅' : '❌'}</div>
      <div><strong>Admin:</strong> {isAdmin ? '✅' : '❌'}</div>
      <div className="mt-2"><strong>Permissions ({permissions.size}):</strong></div>
      <div className="mt-1 pl-2 border-l border-gray-600">
        {Array.from(permissions).slice(0, 20).map(p => (
          <div key={p} className="truncate">{p}</div>
        ))}
        {permissions.size > 20 && <div>...and {permissions.size - 20} more</div>}
      </div>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export { PermissionsContext };

export default {
  PermissionsProvider,
  PermissionsContext,
  usePermissions,
  usePermission,
  useRole,
  useIsOwner,
  useIsAdmin,
  useCanViewFinancials,
  useFilterFinancials,
  useTabVisibility,
  PermissionGate,
  OwnerOnly,
  AdminOnly,
  AuthenticatedOnly,
  FinancialsGate,
  withPermissions,
  withPermissionGate,
  PermissionDebug,
};
