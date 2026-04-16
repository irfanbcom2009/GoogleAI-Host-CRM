import { useMemo } from 'react';
import { User, UserPermissions, ModulePermissions } from '../types';
import { hasPermission, canAccessModule, getPermissionsForRole } from '../lib/permissions';

export function usePermissions(user: User | null) {
  const permissions = useMemo(() => {
    if (!user) return null;
    return user.permissions || getPermissionsForRole(user.role);
  }, [user]);

  const check = (module: keyof UserPermissions, action: keyof ModulePermissions) => {
    return hasPermission(user, module, action);
  };

  const canView = (module: keyof UserPermissions) => canAccessModule(user, module);
  
  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'Manager' || isAdmin;
  const isEmployee = user?.role === 'Employee' || isManager;
  const isClient = user?.role === 'Client';

  return {
    permissions,
    check,
    canView,
    isAdmin,
    isManager,
    isEmployee,
    isClient
  };
}
