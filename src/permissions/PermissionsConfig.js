/**
 * PolyAI Permissions System - Core Configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for all permissions in the system.
 * 
 * Permission Format: module.resource.action
 * Examples:
 *   - business.orders.create
 *   - production.printers.control
 *   - ai.training.manage
 * 
 * Wildcards:
 *   - '*' = full access to everything
 *   - 'module.*' = full access to module
 *   - 'module.resource.*' = all actions on resource
 * 
 * @version 1.0.0
 * @author PolyAI Team
 */

// ============================================================================
// PERMISSION DEFINITIONS
// ============================================================================

/**
 * All available permissions organized by module
 * Each permission has metadata for UI display and grouping
 */
export const PERMISSIONS = {
  // -------------------------------------------------------------------------
  // BUSINESS MODULE - Quotes, Orders, Clients, Invoicing
  // -------------------------------------------------------------------------
  business: {
    label: 'Business',
    icon: '💼',
    description: 'Customer-facing business operations',
    permissions: {
      // Quotes
      'quotes.view': { label: 'View Quotes', description: 'See quote history and details' },
      'quotes.create': { label: 'Create Quotes', description: 'Generate new quotes for customers' },
      'quotes.edit': { label: 'Edit Quotes', description: 'Modify existing quotes' },
      'quotes.delete': { label: 'Delete Quotes', description: 'Remove quotes from system' },
      'quotes.convert': { label: 'Convert to Order', description: 'Turn quotes into orders' },
      
      // Orders
      'orders.view': { label: 'View Orders', description: 'See all orders and their status' },
      'orders.create': { label: 'Create Orders', description: 'Create new orders directly' },
      'orders.edit': { label: 'Edit Orders', description: 'Modify order details' },
      'orders.delete': { label: 'Delete Orders', description: 'Cancel and remove orders' },
      'orders.status': { label: 'Update Status', description: 'Change order workflow status' },
      'orders.assign': { label: 'Assign Orders', description: 'Assign orders to team members' },
      'orders.rush': { label: 'Mark Rush', description: 'Set orders as rush/priority' },
      
      // Clients
      'clients.view': { label: 'View Clients', description: 'See client list and details' },
      'clients.create': { label: 'Add Clients', description: 'Register new clients' },
      'clients.edit': { label: 'Edit Clients', description: 'Update client information' },
      'clients.delete': { label: 'Delete Clients', description: 'Remove clients from system' },
      'clients.pricing': { label: 'Manage Pricing', description: 'Set custom pricing tiers and discounts' },
      'clients.history': { label: 'View History', description: 'Access full client order history' },
      
      // Invoices & Payments
      'invoices.view': { label: 'View Invoices', description: 'See all invoices' },
      'invoices.create': { label: 'Generate Invoices', description: 'Create new invoices' },
      'invoices.send': { label: 'Send Invoices', description: 'Email invoices to clients' },
      'invoices.void': { label: 'Void Invoices', description: 'Cancel issued invoices' },
      'payments.view': { label: 'View Payments', description: 'See payment records' },
      'payments.record': { label: 'Record Payments', description: 'Log received payments' },
      'payments.refund': { label: 'Process Refunds', description: 'Issue refunds to clients' },
    }
  },

  // -------------------------------------------------------------------------
  // PRODUCTION MODULE - Printers, Jobs, Queue, Maintenance
  // -------------------------------------------------------------------------
  production: {
    label: 'Production',
    icon: '🏭',
    description: 'Printing operations and equipment management',
    permissions: {
      // Printers
      'printers.view': { label: 'View Printers', description: 'See printer status and info' },
      'printers.add': { label: 'Add Printers', description: 'Register new printers' },
      'printers.edit': { label: 'Edit Printers', description: 'Modify printer settings' },
      'printers.delete': { label: 'Remove Printers', description: 'Delete printers from system' },
      'printers.control': { label: 'Control Printers', description: 'Start, stop, pause operations' },
      'printers.calibrate': { label: 'Calibrate', description: 'Run calibration routines' },
      
      // Print Jobs
      'jobs.view': { label: 'View Jobs', description: 'See print job queue and history' },
      'jobs.create': { label: 'Create Jobs', description: 'Start new print jobs' },
      'jobs.edit': { label: 'Edit Jobs', description: 'Modify job parameters' },
      'jobs.delete': { label: 'Cancel Jobs', description: 'Cancel queued or running jobs' },
      'jobs.priority': { label: 'Set Priority', description: 'Change job queue priority' },
      'jobs.assign': { label: 'Assign to Printer', description: 'Route jobs to specific printers' },
      
      // Queue Management
      'queue.view': { label: 'View Queue', description: 'See production queue' },
      'queue.manage': { label: 'Manage Queue', description: 'Reorder and manage queue' },
      'queue.clear': { label: 'Clear Queue', description: 'Remove all queued jobs' },
      
      // Failures & Quality
      'failures.view': { label: 'View Failures', description: 'See failure logs' },
      'failures.log': { label: 'Log Failures', description: 'Record print failures' },
      'failures.analyze': { label: 'Analyze Failures', description: 'Access failure analytics' },
      
      // Maintenance
      'maintenance.view': { label: 'View Maintenance', description: 'See maintenance schedules' },
      'maintenance.schedule': { label: 'Schedule Maintenance', description: 'Plan maintenance tasks' },
      'maintenance.perform': { label: 'Perform Maintenance', description: 'Execute and log maintenance' },
      
      // Time Tracking
      'time.view': { label: 'View Time Logs', description: 'See time tracking data' },
      'time.log': { label: 'Log Time', description: 'Record work time' },
      'time.edit': { label: 'Edit Time', description: 'Modify time entries' },
      'time.approve': { label: 'Approve Time', description: 'Approve team time entries' },
    }
  },

  // -------------------------------------------------------------------------
  // INVENTORY MODULE - Materials, Supplies, Stock Management
  // -------------------------------------------------------------------------
  inventory: {
    label: 'Inventory',
    icon: '📦',
    description: 'Materials and supply chain management',
    permissions: {
      // Materials (Filament, Resin, etc.)
      'materials.view': { label: 'View Materials', description: 'See material inventory' },
      'materials.add': { label: 'Add Materials', description: 'Register new materials' },
      'materials.edit': { label: 'Edit Materials', description: 'Update material info' },
      'materials.delete': { label: 'Delete Materials', description: 'Remove materials' },
      'materials.adjust': { label: 'Adjust Stock', description: 'Manual stock adjustments' },
      
      // Supplies (Nozzles, Build plates, etc.)
      'supplies.view': { label: 'View Supplies', description: 'See supply inventory' },
      'supplies.manage': { label: 'Manage Supplies', description: 'Add/edit supplies' },
      
      // Stock Operations
      'stock.receive': { label: 'Receive Stock', description: 'Log incoming shipments' },
      'stock.consume': { label: 'Consume Stock', description: 'Record material usage' },
      'stock.transfer': { label: 'Transfer Stock', description: 'Move between locations' },
      'stock.audit': { label: 'Audit Stock', description: 'Perform inventory audits' },
      
      // Purchasing
      'purchasing.view': { label: 'View Orders', description: 'See purchase orders' },
      'purchasing.create': { label: 'Create PO', description: 'Create purchase orders' },
      'purchasing.approve': { label: 'Approve PO', description: 'Approve purchase orders' },
    }
  },

  // -------------------------------------------------------------------------
  // TEAM MODULE - Users, Shifts, Communication
  // -------------------------------------------------------------------------
  team: {
    label: 'Team',
    icon: '👥',
    description: 'Team management and collaboration',
    permissions: {
      // User Management
      'users.view': { label: 'View Users', description: 'See team member list' },
      'users.create': { label: 'Create Users', description: 'Add new team members' },
      'users.edit': { label: 'Edit Users', description: 'Modify user profiles' },
      'users.delete': { label: 'Delete Users', description: 'Remove team members' },
      'users.roles': { label: 'Assign Roles', description: 'Change user roles' },
      'users.permissions': { label: 'Manage Permissions', description: 'Edit individual permissions' },
      'users.impersonate': { label: 'Impersonate', description: 'Login as another user (audit logged)' },
      
      // Shifts & Scheduling
      'shifts.view': { label: 'View Shifts', description: 'See shift schedules' },
      'shifts.create': { label: 'Create Shifts', description: 'Add new shifts' },
      'shifts.edit': { label: 'Edit Shifts', description: 'Modify shift assignments' },
      'shifts.delete': { label: 'Delete Shifts', description: 'Remove shifts' },
      
      // Communication
      'chat.view': { label: 'View Chat', description: 'Read team chat' },
      'chat.send': { label: 'Send Messages', description: 'Post to team chat' },
      'chat.moderate': { label: 'Moderate Chat', description: 'Delete messages, manage chat' },
      'notes.view': { label: 'View Notes', description: 'Read shift notes' },
      'notes.create': { label: 'Create Notes', description: 'Add shift notes' },
      'notes.edit': { label: 'Edit Notes', description: 'Modify any notes' },
      
      // Activity & Audit
      'activity.view': { label: 'View Activity', description: 'See team activity logs' },
      'activity.export': { label: 'Export Activity', description: 'Download activity reports' },
    }
  },

  // -------------------------------------------------------------------------
  // AI/ML MODULE - Generation, Training, Datasets (Premium features)
  // -------------------------------------------------------------------------
  ai: {
    label: 'AI & ML',
    icon: '🤖',
    description: 'Artificial intelligence and machine learning features',
    premium: true,
    permissions: {
      // 3D Generation
      'generation.view': { label: 'View Generator', description: 'Access AI generation UI' },
      'generation.create': { label: 'Generate Models', description: 'Create AI-generated 3D models' },
      'generation.queue': { label: 'Queue Generation', description: 'Add to generation queue' },
      
      // Training
      'training.view': { label: 'View Training', description: 'See training status and history' },
      'training.start': { label: 'Start Training', description: 'Launch training runs' },
      'training.stop': { label: 'Stop Training', description: 'Cancel training runs' },
      'training.configure': { label: 'Configure Training', description: 'Set hyperparameters' },
      
      // Datasets
      'datasets.view': { label: 'View Datasets', description: 'Browse training datasets' },
      'datasets.create': { label: 'Create Datasets', description: 'Build new datasets' },
      'datasets.edit': { label: 'Edit Datasets', description: 'Modify dataset contents' },
      'datasets.delete': { label: 'Delete Datasets', description: 'Remove datasets' },
      'datasets.export': { label: 'Export Datasets', description: 'Download datasets' },
      
      // Feedback & Improvement
      'feedback.view': { label: 'View Feedback', description: 'See user feedback' },
      'feedback.submit': { label: 'Submit Feedback', description: 'Rate AI outputs' },
      'feedback.process': { label: 'Process Feedback', description: 'Convert feedback to training data' },
      
      // Models
      'models.view': { label: 'View Models', description: 'See trained models' },
      'models.deploy': { label: 'Deploy Models', description: 'Put models into production' },
      'models.rollback': { label: 'Rollback Models', description: 'Revert to previous model' },
    }
  },

  // -------------------------------------------------------------------------
  // ANALYTICS MODULE - Reports, Dashboards, Exports
  // -------------------------------------------------------------------------
  analytics: {
    label: 'Analytics',
    icon: '📊',
    description: 'Business intelligence and reporting',
    permissions: {
      // Dashboards
      'dashboard.view': { label: 'View Dashboard', description: 'Access main dashboard' },
      'dashboard.customize': { label: 'Customize Dashboard', description: 'Personalize dashboard layout' },
      
      // Reports
      'reports.view': { label: 'View Reports', description: 'Access standard reports' },
      'reports.create': { label: 'Create Reports', description: 'Build custom reports' },
      'reports.schedule': { label: 'Schedule Reports', description: 'Set up recurring reports' },
      
      // Financial
      'financial.view': { label: 'View Financials', description: 'See revenue and costs' },
      'financial.detailed': { label: 'Detailed Financials', description: 'Access full financial data' },
      'financial.export': { label: 'Export Financials', description: 'Download financial reports' },
      
      // Export
      'export.basic': { label: 'Basic Export', description: 'Export to CSV' },
      'export.advanced': { label: 'Advanced Export', description: 'Export to multiple formats' },
      'export.api': { label: 'API Access', description: 'Access data via API' },
    }
  },

  // -------------------------------------------------------------------------
  // SETTINGS MODULE - System Configuration
  // -------------------------------------------------------------------------
  settings: {
    label: 'Settings',
    icon: '⚙️',
    description: 'System configuration and administration',
    permissions: {
      // General Settings
      'general.view': { label: 'View Settings', description: 'See system settings' },
      'general.edit': { label: 'Edit Settings', description: 'Modify system settings' },
      
      // Pricing Configuration
      'pricing.view': { label: 'View Pricing', description: 'See pricing configuration' },
      'pricing.edit': { label: 'Edit Pricing', description: 'Modify pricing rules' },
      
      // Integrations
      'integrations.view': { label: 'View Integrations', description: 'See connected services' },
      'integrations.manage': { label: 'Manage Integrations', description: 'Connect/disconnect services' },
      'integrations.configure': { label: 'Configure Integrations', description: 'Edit integration settings' },
      
      // Backup & Recovery
      'backup.view': { label: 'View Backups', description: 'See backup status' },
      'backup.create': { label: 'Create Backup', description: 'Trigger manual backup' },
      'backup.restore': { label: 'Restore Backup', description: 'Restore from backup' },
      
      // System Administration
      'system.logs': { label: 'View Logs', description: 'Access system logs' },
      'system.debug': { label: 'Debug Mode', description: 'Enable debug features' },
      'system.maintenance': { label: 'Maintenance Mode', description: 'Enable maintenance mode' },
      
      // Security
      'security.view': { label: 'View Security', description: 'See security settings' },
      'security.audit': { label: 'Audit Log', description: 'View security audit log' },
      'security.configure': { label: 'Configure Security', description: 'Modify security settings' },
    }
  },

  // -------------------------------------------------------------------------
  // FILES MODULE - File Management
  // -------------------------------------------------------------------------
  files: {
    label: 'Files',
    icon: '📁',
    description: 'File and document management',
    permissions: {
      'files.view': { label: 'View Files', description: 'Browse uploaded files' },
      'files.upload': { label: 'Upload Files', description: 'Upload new files' },
      'files.download': { label: 'Download Files', description: 'Download files' },
      'files.delete': { label: 'Delete Files', description: 'Remove files' },
      'files.organize': { label: 'Organize Files', description: 'Create folders, move files' },
      'files.share': { label: 'Share Files', description: 'Share files externally' },
    }
  },
};

// ============================================================================
// ROLE DEFINITIONS
// ============================================================================

/**
 * Predefined roles with their permission sets
 * These serve as templates - users can have custom overrides
 */
export const ROLES = {
  // -------------------------------------------------------------------------
  // OWNER - Full system access
  // -------------------------------------------------------------------------
  owner: {
    id: 'owner',
    label: 'Owner',
    description: 'Full system access including AI features and administration',
    icon: '👑',
    color: 'amber',
    priority: 100,
    isSystem: true,
    permissions: ['*'],
  },

  // -------------------------------------------------------------------------
  // ADMIN - Administrative access without AI
  // -------------------------------------------------------------------------
  admin: {
    id: 'admin',
    label: 'Administrator',
    description: 'Full business and team management, no AI access',
    icon: '🔧',
    color: 'purple',
    priority: 90,
    isSystem: true,
    permissions: [
      'business.*',
      'production.*',
      'inventory.*',
      'team.*',
      'analytics.*',
      'settings.general.*',
      'settings.pricing.*',
      'settings.integrations.*',
      'settings.backup.*',
      'files.*',
    ],
  },

  // -------------------------------------------------------------------------
  // PARTNER - Business operations
  // -------------------------------------------------------------------------
  partner: {
    id: 'partner',
    label: 'Partner',
    description: 'Business operations access, no AI or admin features',
    icon: '🤝',
    color: 'blue',
    priority: 70,
    isSystem: true,
    permissions: [
      'business.*',
      'production.printers.view',
      'production.jobs.*',
      'production.queue.*',
      'production.failures.view',
      'production.failures.log',
      'production.time.view',
      'production.time.log',
      'inventory.materials.view',
      'inventory.supplies.view',
      'inventory.stock.view',
      'team.users.view',
      'team.shifts.view',
      'team.chat.*',
      'team.notes.*',
      'analytics.dashboard.view',
      'analytics.reports.view',
      'analytics.financial.view',
      'files.view',
      'files.upload',
      'files.download',
    ],
  },

  // -------------------------------------------------------------------------
  // WORKER - Production operations
  // -------------------------------------------------------------------------
  worker: {
    id: 'worker',
    label: 'Worker',
    description: 'Day-to-day production operations',
    icon: '👷',
    color: 'green',
    priority: 50,
    isSystem: true,
    permissions: [
      'business.quotes.view',
      'business.quotes.create',
      'business.orders.view',
      'business.orders.status',
      'business.clients.view',
      'business.clients.history',
      'business.invoices.view',
      'business.payments.view',
      'business.payments.record',
      'production.printers.view',
      'production.printers.control',
      'production.jobs.*',
      'production.queue.view',
      'production.queue.manage',
      'production.failures.*',
      'production.maintenance.view',
      'production.maintenance.perform',
      'production.time.view',
      'production.time.log',
      'inventory.materials.view',
      'inventory.materials.adjust',
      'inventory.supplies.view',
      'inventory.stock.consume',
      'team.users.view',
      'team.shifts.view',
      'team.chat.*',
      'team.notes.*',
      'analytics.dashboard.view',
      'files.view',
      'files.upload',
      'files.download',
    ],
  },

  // -------------------------------------------------------------------------
  // VIEWER - Read-only access
  // -------------------------------------------------------------------------
  viewer: {
    id: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to view system data',
    icon: '👁️',
    color: 'gray',
    priority: 10,
    isSystem: true,
    permissions: [
      'business.quotes.view',
      'business.orders.view',
      'business.clients.view',
      'business.invoices.view',
      'business.payments.view',
      'production.printers.view',
      'production.jobs.view',
      'production.queue.view',
      'production.failures.view',
      'production.maintenance.view',
      'production.time.view',
      'inventory.materials.view',
      'inventory.supplies.view',
      'inventory.stock.view',
      'team.users.view',
      'team.shifts.view',
      'team.chat.view',
      'team.notes.view',
      'analytics.dashboard.view',
      'files.view',
    ],
  },
};

// ============================================================================
// PERMISSION GROUPS (for UI organization)
// ============================================================================

export const PERMISSION_GROUPS = {
  'Full Access': {
    description: 'Complete access to all features',
    permissions: ['*'],
  },
  'Business Manager': {
    description: 'Manage all business operations',
    permissions: ['business.*'],
  },
  'Production Manager': {
    description: 'Manage all production operations',
    permissions: ['production.*'],
  },
  'Inventory Manager': {
    description: 'Manage all inventory operations',
    permissions: ['inventory.*'],
  },
  'Team Manager': {
    description: 'Manage team and users',
    permissions: ['team.*'],
  },
  'AI Operator': {
    description: 'Use AI features without admin access',
    permissions: [
      'ai.generation.*',
      'ai.feedback.view',
      'ai.feedback.submit',
    ],
  },
  'AI Administrator': {
    description: 'Full AI/ML management',
    permissions: ['ai.*'],
  },
  'Report Viewer': {
    description: 'View all reports and analytics',
    permissions: [
      'analytics.dashboard.view',
      'analytics.reports.view',
      'analytics.financial.view',
    ],
  },
  'System Administrator': {
    description: 'System configuration and maintenance',
    permissions: ['settings.*'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get flat list of all permission keys
 */
export const getAllPermissionKeys = () => {
  const keys = [];
  Object.entries(PERMISSIONS).forEach(([module, config]) => {
    Object.keys(config.permissions).forEach(perm => {
      keys.push(`${module}.${perm}`);
    });
  });
  return keys;
};

/**
 * Get permission metadata
 */
export const getPermissionMeta = (permissionKey) => {
  const [module, ...rest] = permissionKey.split('.');
  const permKey = rest.join('.');
  return PERMISSIONS[module]?.permissions?.[permKey] || null;
};

/**
 * Get module metadata
 */
export const getModuleMeta = (moduleName) => {
  const mod = PERMISSIONS[moduleName];
  if (!mod) return null;
  return {
    label: mod.label,
    icon: mod.icon,
    description: mod.description,
    premium: mod.premium || false,
  };
};

/**
 * Get role by ID
 */
export const getRole = (roleId) => ROLES[roleId] || null;

/**
 * Get all roles sorted by priority
 */
export const getAllRoles = () => {
  return Object.values(ROLES).sort((a, b) => b.priority - a.priority);
};

/**
 * Expand wildcard permissions
 */
export const expandWildcards = (permissions) => {
  const allPermissions = getAllPermissionKeys();
  const expanded = new Set();
  
  permissions.forEach(perm => {
    if (perm === '*') {
      allPermissions.forEach(p => expanded.add(p));
    } else if (perm.endsWith('.*')) {
      const prefix = perm.slice(0, -2);
      allPermissions.forEach(p => {
        if (p.startsWith(prefix + '.') || p === prefix) {
          expanded.add(p);
        }
      });
    } else {
      expanded.add(perm);
    }
  });
  
  return Array.from(expanded);
};

/**
 * Check if permission matches pattern
 */
export const permissionMatchesPattern = (permission, pattern) => {
  if (pattern === '*') return true;
  if (pattern === permission) return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return permission.startsWith(prefix + '.') || permission === prefix;
  }
  return false;
};

/**
 * Calculate effective permissions for a user
 */
export const calculateEffectivePermissions = (user) => {
  const role = ROLES[user?.role];
  if (!role) return new Set();
  
  const effective = new Set(expandWildcards(role.permissions));
  
  if (user.custom_permissions?.grant) {
    expandWildcards(user.custom_permissions.grant).forEach(p => effective.add(p));
  }
  
  if (user.custom_permissions?.revoke) {
    expandWildcards(user.custom_permissions.revoke).forEach(p => effective.delete(p));
  }
  
  return effective;
};

/**
 * Check if user has permission
 */
export const userHasPermission = (user, permission) => {
  if (!user || !permission) return false;
  
  const role = ROLES[user.role];
  if (!role) return false;
  
  const hasRolePermission = role.permissions.some(p => permissionMatchesPattern(permission, p));
  const hasGranted = user.custom_permissions?.grant?.some(p => permissionMatchesPattern(permission, p)) || false;
  const isRevoked = user.custom_permissions?.revoke?.some(p => permissionMatchesPattern(permission, p)) || false;
  
  return (hasRolePermission || hasGranted) && !isRevoked;
};

/**
 * Check if user has ANY permission
 */
export const userHasAnyPermission = (user, permissions) => {
  return permissions.some(p => userHasPermission(user, p));
};

/**
 * Check if user has ALL permissions
 */
export const userHasAllPermissions = (user, permissions) => {
  return permissions.every(p => userHasPermission(user, p));
};

// ============================================================================
// TAB VISIBILITY (for App.js tab filtering - backward compatibility)
// ============================================================================

/**
 * Maps fine-grained permissions to tab visibility.
 * This bridges the new permission system with the legacy tab-based UI.
 * 
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for tab visibility.
 * App.js should import and use getTabVisibility() instead of ROLE_PERMISSIONS.
 */
const TAB_PERMISSION_MAPPING = {
  home: [], // Always visible
  business: ['business.orders.view', 'business.quotes.view', 'business.clients.view'],
  printers: ['production.printers.view'],
  production: ['production.jobs.view', 'production.queue.view'],
  calendar: ['production.maintenance.view', 'team.shifts.view'],
  files: ['files.view'],
  inventory: ['inventory.materials.view', 'inventory.supplies.view'],
  reports: ['analytics.reports.view', 'analytics.financial.view'],
  ai: ['ai.generation.view', 'ai.training.view'],
  marketing: ['business.clients.view'], // Marketing needs client access
  config: ['settings.general.view'],
  manageUsers: ['team.users.create', 'team.users.roles'],
};

/**
 * Get tab visibility for a user based on their permissions.
 * Returns object matching legacy ROLE_PERMISSIONS format for backward compatibility.
 * 
 * @param {Object} user - User object with role and custom_permissions
 * @returns {Object} Tab visibility object { home: true, business: false, ... }
 */
export const getTabVisibility = (user) => {
  const visibility = {};
  
  Object.entries(TAB_PERMISSION_MAPPING).forEach(([tab, requiredPermissions]) => {
    if (requiredPermissions.length === 0) {
      // Tab with no required permissions is always visible
      visibility[tab] = true;
    } else {
      // Tab visible if user has ANY of the required permissions
      visibility[tab] = userHasAnyPermission(user, requiredPermissions);
    }
  });
  
  return visibility;
};

/**
 * Check if a specific tab should be visible for a user.
 * 
 * @param {Object} user - User object
 * @param {string} tabId - Tab identifier (home, business, printers, etc.)
 * @returns {boolean}
 */
export const isTabVisible = (user, tabId) => {
  const requiredPermissions = TAB_PERMISSION_MAPPING[tabId];
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }
  return userHasAnyPermission(user, requiredPermissions);
};

// ============================================================================
// FINANCIAL DATA VISIBILITY (worker role restrictions)
// ============================================================================

/**
 * Fields that should be hidden from workers/non-financial roles.
 * Use this to filter sensitive data before displaying.
 */
export const SENSITIVE_FINANCIAL_FIELDS = [
  'profit',
  'margin',
  'profit_margin',
  'cost',
  'material_cost',
  'labor_cost',
  'overhead_cost',
  'total_cost',
  'unit_cost',
  'hourly_rate',
  'discount_amount',
  'discount_percent',
  'revenue',
  'net_revenue',
  'gross_profit',
];

/**
 * Check if user can view financial/sensitive data.
 * 
 * @param {Object} user - User object
 * @returns {boolean}
 */
export const canViewFinancials = (user) => {
  return userHasAnyPermission(user, [
    'analytics.financial.view',
    'analytics.financial.detailed',
    'business.clients.pricing',
  ]);
};

/**
 * Filter sensitive financial fields from an object.
 * Use this when displaying data to workers.
 * 
 * @param {Object} data - Data object to filter
 * @param {Object} user - User object
 * @returns {Object} Filtered data
 */
export const filterFinancialData = (data, user) => {
  if (!data || canViewFinancials(user)) {
    return data;
  }
  
  const filtered = { ...data };
  SENSITIVE_FINANCIAL_FIELDS.forEach(field => {
    if (field in filtered) {
      delete filtered[field];
    }
  });
  
  return filtered;
};

/**
 * Filter an array of objects, removing sensitive financial fields.
 * 
 * @param {Array} items - Array of data objects
 * @param {Object} user - User object
 * @returns {Array} Filtered array
 */
export const filterFinancialDataArray = (items, user) => {
  if (!Array.isArray(items) || canViewFinancials(user)) {
    return items;
  }
  return items.map(item => filterFinancialData(item, user));
};

export default {
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
  // Tab visibility (backward compatibility with App.js)
  TAB_PERMISSION_MAPPING,
  getTabVisibility,
  isTabVisible,
  // Financial data filtering
  SENSITIVE_FINANCIAL_FIELDS,
  canViewFinancials,
  filterFinancialData,
  filterFinancialDataArray,
};
