import { User, UserRole, UserPermissions, ModulePermissions } from '../types';

export const INITIAL_MODULE_PERMISSIONS: ModulePermissions = {
  view: false,
  add: false,
  edit: false,
  delete: false,
  upload: false,
  download: false,
  approve: false
};

export const FULL_MODULE_PERMISSIONS: ModulePermissions = {
  view: true,
  add: true,
  edit: true,
  delete: true,
  upload: true,
  download: true,
  approve: true
};

export const VIEW_ONLY_MODULE_PERMISSIONS: ModulePermissions = {
  view: true,
  add: false,
  edit: false,
  delete: false,
  upload: false,
  download: true,
  approve: false
};

export const DEFAULT_CLIENT_PERMISSIONS: UserPermissions = {
  clients: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  journals: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  domains: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  issnRequests: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  tasks: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  invoices: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  expenses: INITIAL_MODULE_PERMISSIONS,
  publishers: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  hecApplications: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  indexingAgencies: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  doiManagement: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  dataTools: INITIAL_MODULE_PERMISSIONS,
  resources: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  notifications: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  trash: INITIAL_MODULE_PERMISSIONS,
  approvalRequests: INITIAL_MODULE_PERMISSIONS,
  settings: INITIAL_MODULE_PERMISSIONS,
  employees: INITIAL_MODULE_PERMISSIONS,
  doajApplications: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  serviceCatalog: { ...INITIAL_MODULE_PERMISSIONS, view: true }
};

export const DEFAULT_EMPLOYEE_PERMISSIONS: UserPermissions = {
  clients: INITIAL_MODULE_PERMISSIONS,
  journals: INITIAL_MODULE_PERMISSIONS,
  domains: INITIAL_MODULE_PERMISSIONS,
  issnRequests: INITIAL_MODULE_PERMISSIONS,
  tasks: INITIAL_MODULE_PERMISSIONS,
  invoices: INITIAL_MODULE_PERMISSIONS,
  expenses: INITIAL_MODULE_PERMISSIONS,
  publishers: INITIAL_MODULE_PERMISSIONS,
  hecApplications: INITIAL_MODULE_PERMISSIONS,
  indexingAgencies: INITIAL_MODULE_PERMISSIONS,
  doiManagement: INITIAL_MODULE_PERMISSIONS,
  dataTools: INITIAL_MODULE_PERMISSIONS,
  resources: INITIAL_MODULE_PERMISSIONS,
  notifications: INITIAL_MODULE_PERMISSIONS,
  trash: INITIAL_MODULE_PERMISSIONS,
  approvalRequests: INITIAL_MODULE_PERMISSIONS,
  settings: INITIAL_MODULE_PERMISSIONS,
  employees: { ...INITIAL_MODULE_PERMISSIONS, view: true },
  doajApplications: INITIAL_MODULE_PERMISSIONS,
  serviceCatalog: { ...INITIAL_MODULE_PERMISSIONS, view: true }
};

export const DEFAULT_MANAGER_PERMISSIONS: UserPermissions = {
  clients: VIEW_ONLY_MODULE_PERMISSIONS,
  journals: VIEW_ONLY_MODULE_PERMISSIONS,
  domains: VIEW_ONLY_MODULE_PERMISSIONS,
  issnRequests: VIEW_ONLY_MODULE_PERMISSIONS,
  tasks: VIEW_ONLY_MODULE_PERMISSIONS,
  invoices: VIEW_ONLY_MODULE_PERMISSIONS,
  expenses: VIEW_ONLY_MODULE_PERMISSIONS,
  publishers: VIEW_ONLY_MODULE_PERMISSIONS,
  hecApplications: VIEW_ONLY_MODULE_PERMISSIONS,
  indexingAgencies: VIEW_ONLY_MODULE_PERMISSIONS,
  doiManagement: VIEW_ONLY_MODULE_PERMISSIONS,
  dataTools: VIEW_ONLY_MODULE_PERMISSIONS,
  resources: VIEW_ONLY_MODULE_PERMISSIONS,
  notifications: VIEW_ONLY_MODULE_PERMISSIONS,
  trash: INITIAL_MODULE_PERMISSIONS,
  approvalRequests: VIEW_ONLY_MODULE_PERMISSIONS,
  settings: INITIAL_MODULE_PERMISSIONS,
  employees: INITIAL_MODULE_PERMISSIONS,
  doajApplications: VIEW_ONLY_MODULE_PERMISSIONS,
  serviceCatalog: VIEW_ONLY_MODULE_PERMISSIONS
};

export const DEFAULT_ADMIN_PERMISSIONS: UserPermissions = {
  clients: FULL_MODULE_PERMISSIONS,
  journals: FULL_MODULE_PERMISSIONS,
  domains: FULL_MODULE_PERMISSIONS,
  issnRequests: FULL_MODULE_PERMISSIONS,
  tasks: FULL_MODULE_PERMISSIONS,
  invoices: FULL_MODULE_PERMISSIONS,
  expenses: FULL_MODULE_PERMISSIONS,
  publishers: FULL_MODULE_PERMISSIONS,
  hecApplications: FULL_MODULE_PERMISSIONS,
  indexingAgencies: FULL_MODULE_PERMISSIONS,
  doiManagement: FULL_MODULE_PERMISSIONS,
  dataTools: FULL_MODULE_PERMISSIONS,
  resources: FULL_MODULE_PERMISSIONS,
  notifications: FULL_MODULE_PERMISSIONS,
  trash: FULL_MODULE_PERMISSIONS,
  approvalRequests: FULL_MODULE_PERMISSIONS,
  settings: FULL_MODULE_PERMISSIONS,
  employees: FULL_MODULE_PERMISSIONS,
  doajApplications: FULL_MODULE_PERMISSIONS,
  serviceCatalog: FULL_MODULE_PERMISSIONS
};

export function getPermissionsForRole(role: UserRole): UserPermissions {
  switch (role) {
    case 'Admin':
      return DEFAULT_ADMIN_PERMISSIONS;
    case 'Manager':
      return DEFAULT_MANAGER_PERMISSIONS;
    case 'Employee':
      return DEFAULT_EMPLOYEE_PERMISSIONS;
    case 'Client':
      return DEFAULT_CLIENT_PERMISSIONS;
    default:
      return DEFAULT_EMPLOYEE_PERMISSIONS;
  }
}

export function hasPermission(
  user: User | null,
  module: keyof UserPermissions,
  action: keyof ModulePermissions
): boolean {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  
  const permissions = user.permissions;
  if (!permissions) {
    // Fallback to role-based defaults if permissions object is missing
    const defaults = getPermissionsForRole(user.role);
    return !!defaults[module]?.[action];
  }

  return !!permissions[module]?.[action];
}

export function canAccessModule(user: User | null, module: keyof UserPermissions): boolean {
  return hasPermission(user, module, 'view');
}
