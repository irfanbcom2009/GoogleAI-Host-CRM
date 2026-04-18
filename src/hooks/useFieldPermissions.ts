import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User as CRMUser, EmployeeFieldPermission } from '../types';

export function useFieldPermissions(user: CRMUser | null) {
  const [permissions, setPermissions] = useState<EmployeeFieldPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    // Admins always have full access
    if (user.role === 'Admin') {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'field_permissions'), where('employeeId', '==', user.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const perms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EmployeeFieldPermission[];
      setPermissions(perms);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching field permissions:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const canView = (moduleName: string, fieldName: string) => {
    if (user?.role === 'Admin') return true;
    const perm = permissions.find(p => p.moduleName === moduleName && p.fieldName === fieldName);
    return perm ? perm.canView : true; 
  };

  const canEdit = (moduleName: string, fieldName: string) => {
    if (user?.role === 'Admin') return true;
    const perm = permissions.find(p => p.moduleName === moduleName && p.fieldName === fieldName);
    return perm ? perm.canEdit : true;
  };

  const canDelete = (moduleName: string, fieldName: string) => {
    if (user?.role === 'Admin') return true;
    const perm = permissions.find(p => p.moduleName === moduleName && p.fieldName === fieldName);
    return perm ? perm.canDelete : true;
  };

  return { canView, canEdit, canDelete, loadingPermissions: loading };
}
