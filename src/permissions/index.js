/**
 * PolyAI Permissions System
 * 
 * A comprehensive, future-proof permission management system.
 * 
 * Architecture:
 * - PermissionsConfig: Single source of truth for all permissions and roles
 * - PermissionsContext: React context for app-wide permission checking
 * - RoleManager: UI for viewing and managing roles
 * - UserPermissions: UI for managing individual user permissions
 * - UserProfile: User's own profile and preferences
 * - PermissionAuditLog: Track all permission changes
 * 
 * Usage:
 * 
 * 1. Wrap your app with PermissionsProvider:
 *    ```jsx
 *    import { PermissionsProvider } from './permissions';
 *    
 *    <PermissionsProvider user={currentUser}>
 *      <App />
 *    </PermissionsProvider>
 *    ```
 * 
 * 2. Check permissions in components:
 *    ```jsx
 *    import { usePermissions, PermissionGate } from './permissions';
 *    
 *    // Hook approach
 *    const { can, canAny } = usePermissions();
 *    if (can('business.orders.create')) { ... }
 *    
 *    // Component approach
 *    <PermissionGate permission="business.orders.create">
 *      <CreateOrderButton />
 *    </PermissionGate>
 *    ```
 * 
 * @version 1.0.0
 * @author PolyAI Team
 */

// Core configuration
export {
  PERMISSIONS,
  ROLES,
  PERMISSION_GROUPS,
  getAllPermissionKeys,
  getPermissionMeta,
  getModuleMeta,
  getRole,
  getAllRoles,
  expandWildcards,
  permissionMatchesPattern,
  calculateEffectivePermissions,
  userHasPermission,
  userHasAnyPermission,
  userHasAllPermissions,
} from './PermissionsConfig';

// React context and hooks
export {
  PermissionsProvider,
  PermissionsContext,
  usePermissions,
  usePermission,
  useRole,
  useIsOwner,
  useIsAdmin,
  PermissionGate,
  OwnerOnly,
  AdminOnly,
  AuthenticatedOnly,
  withPermissions,
  withPermissionGate,
  PermissionDebug,
} from './PermissionsContext';

// UI Components
export { default as RoleManager } from './RoleManager';
export { default as UserPermissions } from './UserPermissions';
export { default as UserProfile } from './UserProfile';
export { default as PermissionAuditLog } from './PermissionAuditLog';
