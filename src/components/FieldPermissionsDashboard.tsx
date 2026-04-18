import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { User as CRMUser, EmployeeFieldPermission } from '../types';
import { MODULE_FIELDS, PermissionModuleName } from '../constants/permissions';
import { 
  Shield, 
  Loader2, 
  Save, 
  X, 
  Check, 
  AlertCircle,
  Search,
  Users,
  Eye,
  Edit,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

export const FieldPermissionsDashboard: React.FC = () => {
  const [employees, setEmployees] = useState<CRMUser[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<PermissionModuleName>('clients');
  const [permissions, setPermissions] = useState<EmployeeFieldPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all employees/managers/admins
  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', 'in', ['Admin', 'Manager', 'Employee']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CRMUser[];
      setEmployees(emps);
      setLoading(false);
      if (emps.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(emps[0].id);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch permissions for selected employee
  useEffect(() => {
    if (!selectedEmployeeId) return;

    const q = query(collection(db, 'field_permissions'), where('employeeId', '==', selectedEmployeeId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const perms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EmployeeFieldPermission[];
      setPermissions(perms);
    });

    return () => unsubscribe();
  }, [selectedEmployeeId]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => 
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [employees, searchQuery]);

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  const togglePermission = async (fieldName: string, action: 'canView' | 'canEdit' | 'canDelete') => {
    if (!selectedEmployeeId) return;

    const permissionId = `${selectedEmployeeId}_${selectedModule}_${fieldName}`;
    const existing = permissions.find(p => p.fieldName === fieldName && p.moduleName === selectedModule);
    
    // Default to true if not found, then toggle
    const currentValue = existing ? existing[action] : true;
    const newValue = !currentValue;

    setSaving(permissionId);

    try {
      const permissionData: Partial<EmployeeFieldPermission> = {
        employeeId: selectedEmployeeId,
        moduleName: selectedModule,
        fieldName: fieldName,
        canView: existing?.canView ?? true,
        canEdit: existing?.canEdit ?? true,
        canDelete: existing?.canDelete ?? true,
        [action]: newValue,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin' // Should be current user name
      };

      await setDoc(doc(db, 'field_permissions', permissionId), permissionData, { merge: true });
      toast.success('Permission updated');
    } catch (error) {
      handleFirestoreError(error as any, OperationType.UPDATE, 'field_permissions');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-200px)]">
      {/* Sidebar: Employee Selection */}
      <div className="w-full lg:w-80 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search employees..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredEmployees.map((emp) => (
            <button
              key={emp.id}
              onClick={() => setSelectedEmployeeId(emp.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-all text-left group",
                selectedEmployeeId === emp.id ? "bg-indigo-50 border-r-4 border-indigo-600" : "border-r-4 border-transparent"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200 shadow-sm">
                {emp.photoURL ? (
                  <img src={emp.photoURL} alt={emp.name} className="w-full h-full object-cover" />
                ) : (
                  <Users size={20} className="text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className={cn(
                  "text-sm font-bold truncate",
                  selectedEmployeeId === emp.id ? "text-indigo-900" : "text-slate-700"
                )}>{emp.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                   <p className="text-[10px] font-medium text-slate-500 truncate">{emp.role}</p>
                   <span className="w-1 h-1 bg-slate-300 rounded-full" />
                   <p className="text-[10px] font-medium text-slate-400 truncate">{emp.department || 'No Dept'}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Module and Field Permissions */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
        {selectedEmployee ? (
          <>
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Field-Level Permissions</h3>
                  <p className="text-sm text-slate-500">Managing access for <span className="font-bold text-indigo-600">{selectedEmployee.name}</span></p>
                </div>
              </div>
            </div>

            <div className="flex flex-col h-full overflow-hidden">
              {/* Module Selector (Horizontal) */}
              <div className="px-8 pt-6 flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-50 pb-4 shrink-0">
                {(Object.keys(MODULE_FIELDS) as PermissionModuleName[]).map((moduleId) => (
                  <button
                    key={moduleId}
                    onClick={() => setSelectedModule(moduleId)}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-sm border",
                      selectedModule === moduleId 
                        ? "bg-indigo-600 text-white border-indigo-600" 
                        : "bg-white text-slate-600 border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                    )}
                  >
                    {moduleId.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Fields Table */}
              <div className="flex-1 overflow-y-auto p-8 pt-4">
                <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden shadow-inner">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100/50 border-b border-slate-200">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Field Name</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">View</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Edit</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {MODULE_FIELDS[selectedModule].map((field) => {
                        const perm = permissions.find(p => p.fieldName === field.id && p.moduleName === selectedModule);
                        const canView = perm?.canView ?? true;
                        const canEdit = perm?.canEdit ?? true;
                        const canDelete = perm?.canDelete ?? true;
                        const isSaving = saving === `${selectedEmployeeId}_${selectedModule}_${field.id}`;

                        return (
                          <tr key={field.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-700">{field.label}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{field.id}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => togglePermission(field.id, 'canView')}
                                disabled={!!saving}
                                className={cn(
                                  "p-2 rounded-xl transition-all border shadow-sm",
                                  canView 
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100" 
                                    : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                                )}
                              >
                                {isSaving ? <Loader2 className="animate-spin" size={18} /> : (canView ? <Eye size={18} /> : <X size={18} />)}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => togglePermission(field.id, 'canEdit')}
                                disabled={!!saving}
                                className={cn(
                                  "p-2 rounded-xl transition-all border shadow-sm",
                                  canEdit 
                                    ? "bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100" 
                                    : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                                )}
                              >
                                {isSaving ? <Loader2 className="animate-spin" size={18} /> : (canEdit ? <Edit size={18} /> : <X size={18} />)}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => togglePermission(field.id, 'canDelete')}
                                disabled={!!saving}
                                className={cn(
                                  "p-2 rounded-xl transition-all border shadow-sm",
                                  canDelete 
                                    ? "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100" 
                                    : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                                )}
                              >
                                {isSaving ? <Loader2 className="animate-spin" size={18} /> : (canDelete ? <Trash2 size={18} /> : <X size={18} />)}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
               <Users size={32} />
            </div>
            <h4 className="text-lg font-bold text-slate-900">No Employee Selected</h4>
            <p className="text-sm text-slate-500 max-w-xs mt-1">Please select an employee from the left panel to manage their field permissions.</p>
          </div>
        )}
      </div>
    </div>
  );
};
