import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  TrendingUp, 
  Award, 
  Clock, 
  CheckCircle2,
  MoreHorizontal,
  Mail,
  Shield,
  Trophy,
  Loader2,
  LogIn,
  FileSearch,
  MessageSquare,
  Edit,
  Upload,
  Paperclip,
  X,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User as CRMUser, UserRole, User as UserType, GlobalSettings, UserPermissions } from '../types';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Modal } from './Modal';
import { EmployeeDetail } from './EmployeeDetail';
import { EmployeeEditForm } from './EmployeeEditForm';
import { ColumnSelector } from './ColumnSelector';

interface EmployeesProps {
  currentUser: UserType;
  onImpersonate?: (user: { id: string, role: UserRole, name: string, email: string }) => void;
  onOpenChat?: (userId: string) => void;
}

const AVAILABLE_COLUMNS = [
  { id: 'employee', label: 'Employee' },
  { id: 'employeeId', label: 'Employee ID' },
  { id: 'joiningDate', label: 'Joining Date' },
  { id: 'modeOfWorking', label: 'Mode' },
  { id: 'department', label: 'Department' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'officialMail', label: 'Official Mail' },
  { id: 'personalEmail', label: 'Personal Email' },
  { id: 'cnic', label: 'CNIC' },
  { id: 'whatsappPersonal', label: 'WhatsApp' },
  { id: 'homePhone', label: 'Home Phone' },
  { id: 'address', label: 'Address' },
  { id: 'qualification', label: 'Qualification' },
  { id: 'gender', label: 'Gender' },
  { id: 'remarks', label: 'Remarks' },
  { id: 'endingDate', label: 'Ending Date' },
  { id: 'experience', label: 'Work Experience' },
  { id: 'role', label: 'Role' },
  { id: 'performance', label: 'Performance' },
  { id: 'points', label: 'Points' },
];

export const Employees: React.FC<EmployeesProps> = ({ currentUser, onImpersonate, onOpenChat }) => {
  const [employees, setEmployees] = useState<CRMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<CRMUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<CRMUser | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['employees'] || ['employee', 'role', 'performance', 'points']
  );
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);

  // Form state
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    role: 'Employee' as 'Employee' | 'Manager',
    points: 0,
    employeeId: '',
    joiningDate: new Date().toISOString().split('T')[0],
    modeOfWorking: '',
    department: '',
    assignments: '',
    officialMail: '',
    personalEmail: '',
    cnic: '',
    whatsappPersonal: '',
    homePhone: '',
    address: '',
    qualification: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    remarks: '',
    endingDate: '',
    experience: '',
    officialMailPassword: '',
    pcAllotted: '',
    pcUsername: '',
    pcPassword: '',
    permissions: {
      approvalRequests: true,
      journals: true,
      indexingAgencies: true,
      publishers: true,
      hecApplications: true,
      issnRequests: true,
      doiManagement: true,
      dataTools: true,
      invoices: true,
      expenses: true,
      resources: true,
      notifications: true,
      trash: true
    } as UserPermissions,
    attachments: {
      cv: '',
      photo: '',
      cnicScanned: '',
      otherDocs: [] as string[]
    }
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as GlobalSettings;
          setGlobalSettings(data);
          // Set defaults for new employee form
          setNewEmployee(prev => ({
            ...prev,
            modeOfWorking: data.modes?.[0] || 'Office',
            department: data.departments?.[0] || ''
          }));
        }
      } catch (error) {
        console.error('Error fetching global settings:', error);
      }
    };
    fetchSettings();

    const q = query(
      collection(db, 'users'), 
      where('role', 'in', ['Employee', 'Manager']),
      orderBy('points', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const empData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CRMUser[];
      setEmployees(empData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.employees`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'users'), {
        ...newEmployee,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeToEdit) return;
    try {
      const empRef = doc(db, 'users', employeeToEdit.id);
      await updateDoc(empRef, {
        ...newEmployee,
        updatedAt: serverTimestamp()
      });
      setIsEditModalOpen(false);
      setEmployeeToEdit(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const resetForm = () => {
    setNewEmployee({
      name: '',
      email: '',
      role: 'Employee',
      points: 0,
      employeeId: '',
      joiningDate: new Date().toISOString().split('T')[0],
      modeOfWorking: globalSettings?.modes?.[0] || 'Office',
      department: globalSettings?.departments?.[0] || '',
      assignments: '',
      officialMail: '',
      personalEmail: '',
      cnic: '',
      whatsappPersonal: '',
      homePhone: '',
      address: '',
      qualification: '',
      gender: 'Male',
      remarks: '',
      endingDate: '',
      experience: '',
      officialMailPassword: '',
      pcAllotted: '',
      pcUsername: '',
      pcPassword: '',
      permissions: {
        approvalRequests: true,
        journals: true,
        indexingAgencies: true,
        publishers: true,
        hecApplications: true,
        issnRequests: true,
        doiManagement: true,
        dataTools: true,
        invoices: true,
        expenses: true,
        resources: true,
        notifications: true,
        trash: true
      } as UserPermissions,
      attachments: {
        cv: '',
        photo: '',
        cnicScanned: '',
        otherDocs: []
      }
    });
  };

  const openEditModal = (emp: CRMUser) => {
    setEmployeeToEdit(emp);
    setNewEmployee({
      name: emp.name || '',
      email: emp.email || '',
      role: emp.role as any || 'Employee',
      points: emp.points || 0,
      employeeId: emp.employeeId || '',
      joiningDate: emp.joiningDate || new Date().toISOString().split('T')[0],
      modeOfWorking: emp.modeOfWorking || '',
      department: emp.department || '',
      assignments: emp.assignments || '',
      officialMail: emp.officialMail || '',
      personalEmail: emp.personalEmail || '',
      cnic: emp.cnic || '',
      whatsappPersonal: emp.whatsappPersonal || '',
      homePhone: emp.homePhone || '',
      address: emp.address || '',
      qualification: emp.qualification || '',
      gender: emp.gender || 'Male',
      remarks: emp.remarks || '',
      endingDate: emp.endingDate || '',
      experience: emp.experience || '',
      officialMailPassword: emp.officialMailPassword || '',
      pcAllotted: emp.pcAllotted || '',
      pcUsername: emp.pcUsername || '',
      pcPassword: emp.pcPassword || '',
      permissions: emp.permissions || {
        approvalRequests: true,
        journals: true,
        indexingAgencies: true,
        publishers: true,
        hecApplications: true,
        issnRequests: true,
        doiManagement: true,
        dataTools: true,
        invoices: true,
        expenses: true,
        resources: true,
        notifications: true,
        trash: true
      } as UserPermissions,
      attachments: emp.attachments || {
        cv: '',
        photo: '',
        cnicScanned: '',
        otherDocs: []
      } as any
    });
    setIsEditModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // In a real app, we would upload to Firebase Storage.
    // Here we'll use a FileReader to get a base64 string for demo purposes,
    // but we should be mindful of the 1MB Firestore document limit.
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (field === 'otherDocs') {
        setNewEmployee(prev => ({
          ...prev,
          attachments: {
            ...prev.attachments,
            otherDocs: [...prev.attachments.otherDocs, base64String]
          }
        }));
      } else {
        setNewEmployee(prev => ({
          ...prev,
          attachments: {
            ...prev.attachments,
            [field]: base64String
          }
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedEmployee) {
    return <EmployeeDetail employee={selectedEmployee} onBack={() => setSelectedEmployee(null)} currentUser={currentUser} onImpersonate={onImpersonate} />;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Employee Directory</h2>
          <p className="text-slate-500 mt-1">Monitor employee performance, points, and assigned tasks.</p>
        </div>
        <div className="flex gap-3">
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={20} />
            Add Employee
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
            <Trophy size={18} />
            <span className="text-sm font-bold uppercase tracking-wider">Leaderboard</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Staff</p>
            <p className="text-2xl font-bold text-slate-900">{employees.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg. Points</p>
            <p className="text-2xl font-bold text-slate-900">
              {employees.length > 0 
                ? Math.round(employees.reduce((acc, curr) => acc + curr.points, 0) / employees.length) 
                : 0}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Top Performer</p>
            <p className="text-2xl font-bold text-slate-900 truncate max-w-[150px]">
              {employees[0]?.name || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search employees..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Loading staff...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  {selectedColumns.includes('employee') && <th className="px-6 py-4">Employee</th>}
                  {selectedColumns.includes('employeeId') && <th className="px-6 py-4">Employee ID</th>}
                  {selectedColumns.includes('joiningDate') && <th className="px-6 py-4">Joining Date</th>}
                  {selectedColumns.includes('modeOfWorking') && <th className="px-6 py-4">Mode</th>}
                  {selectedColumns.includes('department') && <th className="px-6 py-4">Department</th>}
                  {selectedColumns.includes('assignments') && <th className="px-6 py-4">Assignments</th>}
                  {selectedColumns.includes('officialMail') && <th className="px-6 py-4">Official Mail</th>}
                  {selectedColumns.includes('personalEmail') && <th className="px-6 py-4">Personal Email</th>}
                  {selectedColumns.includes('cnic') && <th className="px-6 py-4">CNIC</th>}
                  {selectedColumns.includes('whatsappPersonal') && <th className="px-6 py-4">WhatsApp</th>}
                  {selectedColumns.includes('homePhone') && <th className="px-6 py-4">Home Phone</th>}
                  {selectedColumns.includes('address') && <th className="px-6 py-4">Address</th>}
                  {selectedColumns.includes('qualification') && <th className="px-6 py-4">Qualification</th>}
                  {selectedColumns.includes('gender') && <th className="px-6 py-4">Gender</th>}
                  {selectedColumns.includes('remarks') && <th className="px-6 py-4">Remarks</th>}
                  {selectedColumns.includes('endingDate') && <th className="px-6 py-4">Ending Date</th>}
                  {selectedColumns.includes('experience') && <th className="px-6 py-4">Work Experience</th>}
                  {selectedColumns.includes('role') && <th className="px-6 py-4">Role</th>}
                  {selectedColumns.includes('performance') && <th className="px-6 py-4">Performance</th>}
                  {selectedColumns.includes('points') && <th className="px-6 py-4">Points</th>}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {filteredEmployees.map((emp, index) => (
                    <motion.tr 
                      layout
                      key={emp.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedEmployee(emp)}
                      className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                    >
                      {selectedColumns.includes('employee') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img 
                                src={emp.attachments?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${emp.name}`} 
                                className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 object-cover" 
                                alt="" 
                              />
                              <div className={cn(
                                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm",
                                emp.isOnline ? "bg-emerald-500" : "bg-slate-300"
                              )} />
                              {index === 0 && (
                                <div className="absolute -top-1 -right-1 bg-amber-400 text-white p-0.5 rounded-full border-2 border-white shadow-sm">
                                  <Trophy size={10} />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEmployee(emp);
                                  }}
                                  className="font-bold text-sm text-slate-900 hover:text-indigo-600 hover:underline text-left"
                                >
                                  {emp.name}
                                </button>
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                                  emp.isOnline ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                )}>
                                  {emp.isOnline ? 'Online' : 'Offline'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Mail size={12} /> {emp.email}
                              </p>
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('employeeId') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.employeeId}</td>
                      )}
                      {selectedColumns.includes('joiningDate') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.joiningDate}</td>
                      )}
                      {selectedColumns.includes('modeOfWorking') && (
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            emp.modeOfWorking === 'Office' ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-orange-50 text-orange-700 border border-orange-100"
                          )}>
                            {emp.modeOfWorking}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('department') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.department}</td>
                      )}
                      {selectedColumns.includes('assignments') && (
                        <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">{emp.assignments}</td>
                      )}
                      {selectedColumns.includes('officialMail') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.officialMail}</td>
                      )}
                      {selectedColumns.includes('personalEmail') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.personalEmail}</td>
                      )}
                      {selectedColumns.includes('cnic') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.cnic}</td>
                      )}
                      {selectedColumns.includes('whatsappPersonal') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.whatsappPersonal}</td>
                      )}
                      {selectedColumns.includes('homePhone') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.homePhone}</td>
                      )}
                      {selectedColumns.includes('address') && (
                        <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">{emp.address}</td>
                      )}
                      {selectedColumns.includes('qualification') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.qualification}</td>
                      )}
                      {selectedColumns.includes('gender') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.gender}</td>
                      )}
                      {selectedColumns.includes('remarks') && (
                        <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">{emp.remarks}</td>
                      )}
                      {selectedColumns.includes('endingDate') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.endingDate}</td>
                      )}
                      {selectedColumns.includes('experience') && (
                        <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">{emp.experience}</td>
                      )}
                      {selectedColumns.includes('role') && (
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                            emp.role === 'Manager' ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                          )}>
                            <Shield size={12} />
                            {emp.role}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('performance') && (
                        <td className="px-6 py-4">
                          <div className="w-full max-w-[100px] bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-indigo-500 h-full rounded-full" 
                              style={{ width: `${Math.min((emp.points / 5000) * 100, 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Level {Math.floor(emp.points / 1000) + 1}</p>
                        </td>
                      )}
                      {selectedColumns.includes('points') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{emp.points.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+12%</span>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChat?.(emp.id);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Start Chat"
                          >
                            <MessageSquare size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmployee(emp);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Details"
                          >
                            <FileSearch size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(emp);
                            }}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Edit Employee"
                          >
                            <Edit size={16} />
                          </button>
                          {onImpersonate && currentUser?.role === 'Admin' && emp.role !== 'Admin' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onImpersonate({ id: emp.id, role: emp.role, name: emp.name, email: emp.email });
                              }}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              title="Login As"
                            >
                              <LogIn size={16} />
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmployee(emp);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="More Options"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>
      <Modal 
        isOpen={isModalOpen || isEditModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setIsEditModalOpen(false);
          setEmployeeToEdit(null);
          resetForm();
        }} 
        title={isEditModalOpen ? "Edit Employee" : "Add New Employee"}
        maxWidth="4xl"
      >
        {isEditModalOpen && employeeToEdit ? (
          <EmployeeEditForm 
            employee={employeeToEdit} 
            onClose={() => {
              setIsEditModalOpen(false);
              setEmployeeToEdit(null);
            }} 
          />
        ) : (
          <form onSubmit={handleAddEmployee} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Employee ID</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="EMP-001"
                value={newEmployee.employeeId}
                onChange={e => setNewEmployee(prev => ({ ...prev, employeeId: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Joining Date</label>
              <input 
                required
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newEmployee.joiningDate}
                onChange={e => setNewEmployee(prev => ({ ...prev, joiningDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Mode of Working</label>
              <select 
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newEmployee.modeOfWorking}
                onChange={e => setNewEmployee(prev => ({ ...prev, modeOfWorking: e.target.value }))}
              >
                {globalSettings?.modes?.map(mode => (
                  <option key={mode} value={mode}>{mode}</option>
                )) || (
                  <>
                    <option value="Office">Office</option>
                    <option value="Remotely">Remotely</option>
                    <option value="Hybrid">Hybrid</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Full Name</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. John Doe"
                value={newEmployee.name}
                onChange={e => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Gender</label>
              <select 
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newEmployee.gender}
                onChange={e => setNewEmployee(prev => ({ ...prev, gender: e.target.value as any }))}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Department</label>
              <select 
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newEmployee.department}
                onChange={e => setNewEmployee(prev => ({ ...prev, department: e.target.value }))}
              >
                {globalSettings?.departments?.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                )) || (
                  <>
                    <option value="IT">IT</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Operations">Operations</option>
                  </>
                )}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Assignments</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. Journal Management"
                value={newEmployee.assignments}
                onChange={e => setNewEmployee(prev => ({ ...prev, assignments: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Official Mail</label>
              <input 
                required
                type="email" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="john@hostajournal.com"
                value={newEmployee.officialMail}
                onChange={e => setNewEmployee(prev => ({ ...prev, officialMail: e.target.value, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Official Mail Password</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Password123"
                value={newEmployee.officialMailPassword}
                onChange={e => setNewEmployee(prev => ({ ...prev, officialMailPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Personal E-Mail Id</label>
              <input 
                type="email" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="john.personal@gmail.com"
                value={newEmployee.personalEmail}
                onChange={e => setNewEmployee(prev => ({ ...prev, personalEmail: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">PC Allotted (ID/Name)</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="PC-001"
                value={newEmployee.pcAllotted}
                onChange={e => setNewEmployee(prev => ({ ...prev, pcAllotted: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">PC Username</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="admin"
                value={newEmployee.pcUsername}
                onChange={e => setNewEmployee(prev => ({ ...prev, pcUsername: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">PC Password</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="pc-pass-123"
                value={newEmployee.pcPassword}
                onChange={e => setNewEmployee(prev => ({ ...prev, pcPassword: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">CNIC</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="42101-XXXXXXX-X"
                value={newEmployee.cnic}
                onChange={e => setNewEmployee(prev => ({ ...prev, cnic: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">WhatsApp Personal</label>
              <input 
                type="tel" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="+92 XXX XXXXXXX"
                value={newEmployee.whatsappPersonal}
                onChange={e => setNewEmployee(prev => ({ ...prev, whatsappPersonal: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Home Phone No</label>
              <input 
                type="tel" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="021-XXXXXXXX"
                value={newEmployee.homePhone}
                onChange={e => setNewEmployee(prev => ({ ...prev, homePhone: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Address</label>
            <textarea 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Full residential address"
              rows={2}
              value={newEmployee.address}
              onChange={e => setNewEmployee(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Qualification</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. MS Computer Science"
                value={newEmployee.qualification}
                onChange={e => setNewEmployee(prev => ({ ...prev, qualification: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Already Work Experience</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. 2 Years at XYZ Corp"
                value={newEmployee.experience}
                onChange={e => setNewEmployee(prev => ({ ...prev, experience: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Role</label>
              <select 
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newEmployee.role}
                onChange={e => setNewEmployee(prev => ({ ...prev, role: e.target.value as any }))}
              >
                <option value="Employee">Employee</option>
                <option value="Manager">Manager</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Initial Points</label>
              <input 
                required
                type="number" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newEmployee.points}
                onChange={e => setNewEmployee(prev => ({ ...prev, points: parseInt(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Ending Date (Optional)</label>
              <input 
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newEmployee.endingDate}
                onChange={e => setNewEmployee(prev => ({ ...prev, endingDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Remarks</label>
            <textarea 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Any additional remarks..."
              rows={2}
              value={newEmployee.remarks}
              onChange={e => setNewEmployee(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={16} />
              Feature Permissions
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
              {Object.entries(newEmployee.permissions).map(([key, value]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox"
                      className="sr-only"
                      checked={value}
                      onChange={() => setNewEmployee(prev => ({
                        ...prev,
                        permissions: {
                          ...prev.permissions,
                          [key]: !prev.permissions[key as keyof UserPermissions]
                        }
                      }))}
                    />
                    <div className={cn(
                      "w-10 h-6 rounded-full transition-all duration-200",
                      value ? "bg-indigo-600" : "bg-slate-300"
                    )} />
                    <div className={cn(
                      "absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all duration-200",
                      value ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Attachments</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">CV / Resume</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                    <Upload size={18} className="text-slate-400 group-hover:text-indigo-500" />
                    <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">
                      {newEmployee.attachments.cv ? 'Change CV' : 'Upload CV'}
                    </span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileUpload(e, 'cv')}
                    />
                  </label>
                  {newEmployee.attachments.cv && (
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Paperclip size={18} />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Employee Photo</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                    <Upload size={18} className="text-slate-400 group-hover:text-indigo-500" />
                    <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">
                      {newEmployee.attachments.photo ? 'Change Photo' : 'Upload Photo'}
                    </span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'photo')}
                    />
                  </label>
                  {newEmployee.attachments.photo && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200">
                      <img src={newEmployee.attachments.photo} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">CNIC Scanned Copy</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                    <Upload size={18} className="text-slate-400 group-hover:text-indigo-500" />
                    <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">
                      {newEmployee.attachments.cnicScanned ? 'Change CNIC' : 'Upload CNIC'}
                    </span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload(e, 'cnicScanned')}
                    />
                  </label>
                  {newEmployee.attachments.cnicScanned && (
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Paperclip size={18} />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Other Documents</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                    <Plus size={18} className="text-slate-400 group-hover:text-indigo-500" />
                    <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">Add Document</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      multiple
                      onChange={(e) => handleFileUpload(e, 'otherDocs')}
                    />
                  </label>
                  {newEmployee.attachments.otherDocs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newEmployee.attachments.otherDocs.map((doc, idx) => (
                        <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                          <Paperclip size={10} />
                          Doc {idx + 1}
                          <button 
                            type="button"
                            onClick={() => setNewEmployee(prev => ({
                              ...prev,
                              attachments: {
                                ...prev.attachments,
                                otherDocs: prev.attachments.otherDocs.filter((_, i) => i !== idx)
                              }
                            }))}
                            className="ml-1 text-rose-500 hover:text-rose-700"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              Add Employee
            </button>
          </div>
        </form>
        )}
      </Modal>
    </div>
  );
};
