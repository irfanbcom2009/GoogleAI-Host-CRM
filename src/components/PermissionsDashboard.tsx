import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Eye, 
  Edit3, 
  PlusCircle, 
  CheckCircle, 
  Trash2, 
  Search,
  Lock,
  Unlock,
  Save,
  Loader2,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Upload,
  Download
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { User as CRMUser, UserPermissions, ModulePermissions } from '../types';
import { cn } from '../lib/utils';
import { INITIAL_MODULE_PERMISSIONS } from '../lib/permissions';

export const PermissionsDashboard: React.FC = () => {
  const [employees, setEmployees] = useState<CRMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<keyof UserPermissions>('clients');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  const modules: { id: keyof UserPermissions; label: string }[] = [
    { id: 'clients', label: 'Clients' },
    { id: 'journals', label: 'Journals' },
    { id: 'domains', label: 'Domains' },
    { id: 'issnRequests', label: 'ISSN Requests' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'publishers', label: 'Publishers' },
    { id: 'hecApplications', label: 'HEC Applications' },
    { id: 'doajApplications', label: 'DOAJ Applications' },
    { id: 'indexingAgencies', label: 'Indexing Agencies' },
    { id: 'doiManagement', label: 'DOI Management' },
    { id: 'dataTools', label: 'Data Tools' },
    { id: 'resources', label: 'Resources' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'trash', label: 'Trash' },
    { id: 'approvalRequests', label: 'Approval Requests' },
    { id: 'settings', label: 'Settings' },
    { id: 'employees', label: 'Employees' },
  ];

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', 'in', ['Employee', 'Manager']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CRMUser[];
      setEmployees(emps);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const togglePermission = async (employeeId: string, module: keyof UserPermissions, action: keyof ModulePermissions) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    // Use the actual document ID (which should be the UID now)
    const docId = employee.uid || employee.id;

    const currentPermissions = employee.permissions || {} as UserPermissions;
    const modulePerms = currentPermissions[module] || { ...INITIAL_MODULE_PERMISSIONS };

    setSavingId(`${employeeId}-${module}-${action}`);
    setError(null);

    try {
      const newModulePerms = {
        ...modulePerms,
        [action]: !modulePerms[action]
      };

      const newPermissions = {
        ...currentPermissions,
        [module]: newModulePerms
      };

      await updateDoc(doc(db, 'users', docId), {
        permissions: newPermissions,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error("Error updating permissions for doc:", docId, err);
      setError(`Failed to update permissions for ${employee.name}. Please ensure you have Admin rights.`);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `users/${docId}`);
      } catch (e) {}
    } finally {
      setSavingId(null);
    }
  };

  const toggleAllView = async () => {
    setError(null);
    setLoading(true);
    try {
      const updates = filteredEmployees.map(async (emp) => {
        const docId = emp.uid || emp.id;
        const currentPermissions = emp.permissions || {} as UserPermissions;
        const modulePerms = currentPermissions[selectedModule] || { ...INITIAL_MODULE_PERMISSIONS };
        
        // Toggle based on the first employee's state or just set to true if any are false
        const anyFalse = filteredEmployees.some(e => !(e.permissions?.[selectedModule]?.view));
        
        const newPermissions = {
          ...currentPermissions,
          [selectedModule]: {
            ...modulePerms,
            view: anyFalse
          }
        };

        return updateDoc(doc(db, 'users', docId), {
          permissions: newPermissions,
          updatedAt: serverTimestamp()
        });
      });

      await Promise.all(updates);
    } catch (err: any) {
      console.error("Error bulk updating permissions:", err);
      setError("Failed to bulk update permissions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && (!emp.status || emp.status === 'active') && !emp.endingDate) ||
      (statusFilter === 'inactive' && (emp.status === 'inactive' || !!emp.endingDate));
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-slate-500 font-medium">Loading permissions dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 w-full lg:w-auto">
            {modules.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedModule(m.id)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                  selectedModule === m.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            {(['active', 'inactive', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest",
                  statusFilter === status 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search employees..."
            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl w-full md:w-80 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-600 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-350px)] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Employee</th>
                <th className="px-4 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>View</span>
                    <button 
                      onClick={toggleAllView}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-bold"
                    >
                      Toggle All
                    </button>
                  </div>
                </th>
                <th className="px-4 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Add</th>
                <th className="px-4 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Edit</th>
                <th className="px-4 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Delete</th>
                <th className="px-4 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Approve</th>
                <th className="px-4 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Upload</th>
                <th className="px-4 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => {
                const perms = (emp.permissions?.[selectedModule] || { ...INITIAL_MODULE_PERMISSIONS }) as ModulePermissions;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm shadow-sm">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{emp.name}</span>
                            {emp.endingDate ? (
                              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-bold rounded-md uppercase tracking-wider">Inactive</span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-bold rounded-md uppercase tracking-wider">Active</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">{emp.employeeId} • {emp.department}</div>
                        </div>
                        {savingId?.startsWith(emp.id) && (
                          <Loader2 className="animate-spin text-indigo-600 ml-2" size={16} />
                        )}
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 text-center">
                      <PermissionToggle 
                        active={perms.view} 
                        onClick={() => togglePermission(emp.id, selectedModule, 'view')}
                        icon={<Eye size={20} />}
                        color="indigo"
                      />
                    </td>

                    <td className="px-4 py-4 text-center">
                      <PermissionToggle 
                        active={perms.add} 
                        onClick={() => togglePermission(emp.id, selectedModule, 'add')}
                        icon={<PlusCircle size={20} />}
                        color="emerald"
                      />
                    </td>

                    <td className="px-4 py-4 text-center">
                      <PermissionToggle 
                        active={perms.edit} 
                        onClick={() => togglePermission(emp.id, selectedModule, 'edit')}
                        icon={<Edit3 size={20} />}
                        color="blue"
                      />
                    </td>

                    <td className="px-4 py-4 text-center">
                      <PermissionToggle 
                        active={perms.delete} 
                        onClick={() => togglePermission(emp.id, selectedModule, 'delete')}
                        icon={<Trash2 size={20} />}
                        color="rose"
                      />
                    </td>

                    <td className="px-4 py-4 text-center">
                      <PermissionToggle 
                        active={perms.approve} 
                        onClick={() => togglePermission(emp.id, selectedModule, 'approve')}
                        icon={<CheckCircle size={20} />}
                        color="violet"
                      />
                    </td>

                    <td className="px-4 py-4 text-center">
                      <PermissionToggle 
                        active={perms.upload} 
                        onClick={() => togglePermission(emp.id, selectedModule, 'upload')}
                        icon={<Upload size={20} />}
                        color="indigo"
                      />
                    </td>

                    <td className="px-4 py-4 text-center">
                      <PermissionToggle 
                        active={perms.download} 
                        onClick={() => togglePermission(emp.id, selectedModule, 'download')}
                        icon={<Download size={20} />}
                        color="emerald"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredEmployees.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Search size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No employees found</h3>
            <p className="text-slate-500">Try adjusting your search query</p>
          </div>
        )}
      </div>

      <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-start gap-4">
        <div className="p-3 bg-white rounded-2xl text-indigo-600 shadow-sm shrink-0">
          <Shield size={24} />
        </div>
        <div>
          <h4 className="font-bold text-indigo-900 mb-1">Security Note</h4>
          <p className="text-sm text-indigo-700 leading-relaxed">
            These permissions are applied in real-time for the <strong>{modules.find(m => m.id === selectedModule)?.label}</strong> module. 
            Admins always have full access regardless of these settings.
          </p>
        </div>
      </div>
    </div>
  );
};

interface PermissionToggleProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  color: 'indigo' | 'blue' | 'emerald' | 'violet' | 'rose';
}

const PermissionToggle: React.FC<PermissionToggleProps> = ({ active, onClick, icon, color }) => {
  const colorClasses = {
    indigo: active ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400",
    blue: active ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400",
    emerald: active ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400",
    violet: active ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-400",
    rose: active ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-400",
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 rounded-xl transition-all hover:scale-110 active:scale-95",
        colorClasses[color]
      )}
    >
      {active ? icon : <div className="opacity-40 grayscale">{icon}</div>}
    </button>
  );
};
