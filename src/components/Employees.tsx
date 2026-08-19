import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  TrendingUp, 
  Award, 
  Clock, 
  CheckCircle2,
  MoreHorizontal,
  MoreVertical,
  Mail,
  Shield,
  Trophy,
  Loader2,
  LogIn,
  FileSearch,
  MessageSquare,
  Edit,
  Trash2,
  DollarSign,
  Upload,
  Paperclip,
  X,
  ShieldCheck,
  Settings2,
  Settings,
  BarChart2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Sparkles as SparklesIcon,
  GitMerge,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { User as CRMUser, UserRole, User as UserType, GlobalSettings, UserPermissions } from '../types';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType, moveToTrash, logActivity } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { Modal } from './Modal';
import { EmployeeDetail } from './EmployeeDetail';
import { EmployeeEditForm } from './EmployeeEditForm';
import { ColumnSelector } from './ColumnSelector';
import { BulkEmployeeAddModal } from './BulkEmployeeAddModal';
import { PermissionsDashboard } from './PermissionsDashboard';
import { HelpIcon } from './HelpIcon';
import { usePermissions } from '../hooks/usePermissions';
import { DEFAULT_EMPLOYEE_PERMISSIONS } from '../lib/permissions';
import { ConfigModal } from './ConfigModal';
import { ConfirmModal } from './ConfirmModal';
import { MergeModal } from './MergeModal';
import { SearchableSelect } from './ui/SearchableSelect';
import { toast } from 'react-hot-toast';

interface EmployeesProps {
  currentUser: UserType;
  onImpersonate?: (user: { id: string, role: UserRole, name: string, email: string }) => void;
  onOpenChat?: (userId: string) => void;
}

const AVAILABLE_COLUMNS = [
  { id: 'employee', label: 'Employee' },
  { id: 'status', label: 'Status' },
  { id: 'employeeId', label: 'Employee ID' },
  { id: 'joiningDate', label: 'Joining Date' },
  { id: 'modeOfWorking', label: 'Mode' },
  { id: 'department', label: 'Department' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'assignedTasks', label: 'Assigned Tasks' },
  { id: 'latestCompletedTask', label: 'Latest Completed Task' },
  { id: 'officialMail', label: 'Official Mail' },
  { id: 'officialMailPassword', label: 'Email Password' },
  { id: 'personalEmail', label: 'Personal Email' },
  { id: 'cnic', label: 'CNIC' },
  { id: 'whatsappPersonal', label: 'WhatsApp' },
  { id: 'phone', label: 'Phone' },
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
  { id: 'pcAllotted', label: 'PC Allotted' },
  { id: 'pcUsername', label: 'PC Username' },
  { id: 'pcPassword', label: 'PC Password' },
  { id: 'portalEnabled', label: 'Portal Access' },
  { id: 'createdAt', label: 'Created At' },
];

import { DEFAULT_IMAGES } from '../constants/images';

export const Employees: React.FC<EmployeesProps> = ({ currentUser, onImpersonate, onOpenChat }) => {
  const { check, isAdmin } = usePermissions(currentUser);
  const [employees, setEmployees] = useState<CRMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeptConfigOpen, setIsDeptConfigOpen] = useState(false);
  const [isModeConfigOpen, setIsModeConfigOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeeToEdit, setEmployeeToEdit] = useState<CRMUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<CRMUser | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['employees'] || AVAILABLE_COLUMNS.map(c => c.id)
  );
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'permissions'>('list');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<CRMUser | null>(null);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<CRMUser | null>(null);
  const [duplicates, setDuplicates] = useState<CRMUser[][]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'createdAt', direction: 'desc' });
  const [showNewMailPassword, setShowNewMailPassword] = useState(false);
  const [showNewPcPassword, setShowNewPcPassword] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'tasks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const getEmployeeTaskStats = (employeeId: string) => {
    const employeeTasks = allTasks.filter(t => t.assignedTo === employeeId);
    const assignedCount = employeeTasks.filter(t => t.status !== 'completed').length;
    const completedTasks = employeeTasks
      .filter(t => t.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.updatedAt).getTime() - new Date(a.completedAt || a.updatedAt).getTime());
    
    return {
      assignedCount,
      latestCompleted: completedTasks[0]?.title || 'None'
    };
  };

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
    baseSalary: 0,
    officialMailPassword: '',
    portalEnabled: false,
    isActive: true,
    isHidden: false,
    pcAllotted: '',
    pcUsername: '',
    pcPassword: '',
    permissions: DEFAULT_EMPLOYEE_PERMISSIONS,
    attachments: {
      cv: '',
      photo: '',
      cnicScanned: '',
      otherDocs: [] as string[]
    }
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as GlobalSettings;
          const sanitizedData: GlobalSettings = {
            ...data,
            expenseHeads: Array.isArray(data.expenseHeads) ? data.expenseHeads : [],
            journalCategories: Array.isArray(data.journalCategories) ? data.journalCategories : [],
            issnTypes: Array.isArray(data.issnTypes) ? data.issnTypes : [],
            issnSubjects: Array.isArray(data.issnSubjects) ? data.issnSubjects : [],
            frequencies: Array.isArray(data.frequencies) ? data.frequencies : [],
            departments: Array.isArray(data.departments) ? data.departments : [],
            modes: Array.isArray(data.modes) ? data.modes : [],
            journalScopes: Array.isArray(data.journalScopes) ? data.journalScopes : [],
            officeSubscriptions: Array.isArray(data.officeSubscriptions) ? data.officeSubscriptions : []
          };
          setGlobalSettings(sanitizedData);
          // Set defaults for new employee form
          setNewEmployee(prev => ({
            ...prev,
            modeOfWorking: prev.modeOfWorking || sanitizedData.modes?.[0] || 'Office',
            department: prev.department || sanitizedData.departments?.[0] || ''
          }));
        }
      });
      return unsubscribeSettings;
    };
    const unsubSettings = fetchSettings();

    const q = query(
      collection(db, 'users'), 
      where('role', 'in', ['Employee', 'Manager', 'Admin']),
      orderBy('points', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const empData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CRMUser[];

      // Proactive migration/fix for Tayyaba Riasat (employeeId: "52", name, or email)
      const tayyaba = empData.find(e => 
        e.employeeId === '52' || 
        e.name === 'Tayyaba Riasat' || 
        (e.email && e.email.toLowerCase() === 'taiba000120@gmail.com')
      );
      if (tayyaba && (tayyaba.endingDate || tayyaba.status !== 'active' || tayyaba.portalEnabled === false || tayyaba.isActive === false || tayyaba.isHidden === true)) {
        updateDoc(doc(db, 'users', tayyaba.id), {
          endingDate: '',
          status: 'active',
          portalEnabled: true,
          isActive: true,
          isHidden: false,
          updatedAt: serverTimestamp()
        }).catch(err => console.error("Error activating Tayyaba:", err));
      }

      setEmployees(empData);
      setLoading(false);

      // Keep selected employee in sync
      setSelectedEmployee(prev => {
        if (!prev) return null;
        const updated = empData.find(e => e.id === prev.id);
        return updated || null;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isModalOpen && !newEmployee.employeeId) {
      generateEmployeeId();
    }
  }, [isModalOpen]);

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

  const handleDeleteEmployee = async (employee: CRMUser) => {
    try {
      await moveToTrash('users', employee.id, employee, currentUser.name);
      toast.success(`Employee "${employee.name}" moved to trash`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
      toast.error('Failed to delete employee');
    }
  };

  const scanForDuplicates = () => {
    setIsScanning(true);
    setHasScanned(true);
    const groups: CRMUser[][] = [];
    const processedIds = new Set<string>();

    employees.forEach((emp, index) => {
      if (processedIds.has(emp.id)) return;

      const group: CRMUser[] = [emp];
      const name = emp.name.toLowerCase().trim();
      const email = emp.email?.toLowerCase().trim();
      const personalEmail = emp.personalEmail?.toLowerCase().trim();
      const cnic = emp.cnic?.trim();
      
      employees.forEach((other, otherIndex) => {
        if (index === otherIndex || processedIds.has(other.id)) return;

        const otherName = other.name.toLowerCase().trim();
        const otherEmail = other.email?.toLowerCase().trim();
        const otherPersonalEmail = other.personalEmail?.toLowerCase().trim();
        const otherCnic = other.cnic?.trim();

        const nameMatch = name && otherName && name === otherName;
        const emailMatch = (email && otherEmail && email === otherEmail) || 
                          (email && otherPersonalEmail && email === otherPersonalEmail) ||
                          (personalEmail && otherEmail && personalEmail === otherEmail) ||
                          (personalEmail && otherPersonalEmail && personalEmail === otherPersonalEmail);
        const cnicMatch = cnic && otherCnic && cnic === otherCnic;

        if (nameMatch || emailMatch || cnicMatch) {
          group.push(other);
          processedIds.add(other.id);
        }
      });

      if (group.length > 1) {
        groups.push(group);
        processedIds.add(emp.id);
      }
    });

    setDuplicates(groups);
    setIsScanning(false);
    if (groups.length === 0) {
      toast.success('No duplicate employees found');
    } else {
      toast.error(`Found ${groups.length} potential duplicate groups`);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    // Restriction: Only admin can add employees with gmail address
    const isSystemAdmin = currentUser?.role === 'Admin' || ['irfanbcom2009@gmail.com', 'ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'].includes(currentUser?.email || '');
    if (newEmployee.email.toLowerCase().endsWith('@gmail.com') && !isSystemAdmin) {
      setError("Only administrators can add employees with @gmail.com addresses.");
      setIsSaving(false);
      return;
    }

    try {
      // Check for unique Employee ID
      const idQuery = query(collection(db, 'users'), where('employeeId', '==', newEmployee.employeeId));
      const idSnapshot = await getDocs(idQuery);
      if (!idSnapshot.empty) {
        setError("Employee ID already exists. Please use a unique ID.");
        setIsSaving(false);
        return;
      }

      // Check for unique CNIC if provided
      if (newEmployee.cnic) {
        const cnicQuery = query(collection(db, 'users'), where('cnic', '==', newEmployee.cnic));
        const cnicSnapshot = await getDocs(cnicQuery);
        if (!cnicSnapshot.empty) {
          setError("CNIC already exists in the directory.");
          setIsSaving(false);
          return;
        }
      }

      const docRef = await addDoc(collection(db, 'users'), {
        ...newEmployee,
        photoURL: newEmployee.attachments.photo || (newEmployee.gender === 'Female' ? DEFAULT_IMAGES.FEMALE_STAFF : ''),
        createdAt: serverTimestamp()
      });

      // Create initial employment history record
      await addDoc(collection(db, 'employment_history'), {
        employeeId: docRef.id,
        joinDate: newEmployee.joiningDate || new Date().toISOString().split('T')[0],
        leaveDate: null,
        status: 'Active',
        reason: 'First Join',
        notes: 'Initial joining record created automatically.',
        createdAt: serverTimestamp()
      });

      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error("Error adding employee:", err);
      setError(err.message || "Failed to add employee. Please try again.");
      try {
        handleFirestoreError(err, OperationType.CREATE, 'users');
      } catch (e) {}
    } finally {
      setIsSaving(false);
    }
  };



  const generateEmployeeId = async () => {
    try {
      // Get all employees to determine the next sequence number by finding the highest ID
      const q = query(
        collection(db, 'users'), 
        where('role', 'in', ['Employee', 'Manager'])
      );
      const snapshot = await getDocs(q);
      
      let nextNumber = 1;
      const existingIds = snapshot.docs
        .map(doc => {
          const id = doc.data().employeeId as string;
          if (id && id.startsWith('Emp-')) {
            const numPart = id.replace('Emp-', '');
            return parseInt(numPart, 10);
          }
          return null;
        })
        .filter((num): num is number => num !== null && !isNaN(num));

      if (existingIds.length > 0) {
        nextNumber = Math.max(...existingIds) + 1;
      }
      
      const newId = `Emp-${nextNumber.toString().padStart(3, '0')}`;
      
      setNewEmployee(prev => ({ ...prev, employeeId: newId }));
    } catch (error) {
      console.error("Error generating Employee ID:", error);
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
      baseSalary: 0,
      officialMailPassword: '',
      portalEnabled: false,
      isActive: true,
      isHidden: false,
      pcAllotted: '',
      pcUsername: '',
      pcPassword: '',
      permissions: DEFAULT_EMPLOYEE_PERMISSIONS,
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
      baseSalary: emp.baseSalary || 0,
      officialMailPassword: emp.officialMailPassword || '',
      portalEnabled: emp.portalEnabled ?? false,
      isActive: emp.isActive ?? true,
      isHidden: emp.isHidden ?? false,
      pcAllotted: emp.pcAllotted || '',
      pcUsername: emp.pcUsername || '',
      pcPassword: emp.pcPassword || '',
      permissions: emp.permissions || DEFAULT_EMPLOYEE_PERMISSIONS,
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

    if (file.size > 500 * 1024) {
      setError("File is too large. Please upload files smaller than 500KB.");
      return;
    }

    setError(null);
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

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const name = (emp.name || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const search = searchQuery.toLowerCase();

      const matchesSearch = name.includes(search) || email.includes(search);
      
      const isActive = (!emp.endingDate || emp.status === 'active') && emp.isActive !== false;
      const isHidden = emp.isHidden === true;
      const canSeeHidden = currentUser.role === 'Admin';
      
      if (isHidden && !canSeeHidden) return false;

      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'active' && isActive) || 
                           (statusFilter === 'inactive' && !isActive);
      
      return matchesSearch && matchesStatus;
    });
  }, [employees, searchQuery, statusFilter, currentUser.role]);

  const sortedEmployees = useMemo(() => {
    let sortableItems = [...filteredEmployees];
    if (sortConfig.key !== null && sortConfig.direction !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof CRMUser];
        let bValue: any = b[sortConfig.key as keyof CRMUser];

        // Handle points separately as they are numbers
        if (sortConfig.key === 'points') {
          aValue = a.points || 0;
          bValue = b.points || 0;
        }

        if (aValue === bValue) return 0;
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        const modifier = sortConfig.direction === 'asc' ? 1 : -1;
        if (typeof aValue === 'string') {
          return aValue.localeCompare(bValue) * modifier;
        }
        return (aValue > bValue ? 1 : -1) * modifier;
      });
    }
    return sortableItems;
  }, [filteredEmployees, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey || !sortConfig.direction) return <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="ml-1 text-indigo-600" /> : <ChevronDown size={12} className="ml-1 text-indigo-600" />;
  };

  const performanceData = useMemo(() => {
    return employees
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 10)
      .map(emp => ({
        name: emp.name.split(' ')[0],
        points: emp.points || 0,
        fullName: emp.name
      }));
  }, [employees]);

  if (selectedEmployee) {
    return <EmployeeDetail employee={selectedEmployee} onBack={() => setSelectedEmployee(null)} currentUser={currentUser} onImpersonate={onImpersonate} />;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {activeTab === 'list' ? 'Employee Directory' : 'Access Control Dashboard'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {activeTab === 'list' 
              ? 'Monitor employee performance, points, and assigned tasks.' 
              : 'Manage granular permissions and view-only access for staff.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl mr-2">
            <button
              onClick={() => setActiveTab('list')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'list' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Users size={18} />
              List
            </button>
            {(currentUser.role === 'Admin' || ['ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'].includes(currentUser.email)) && (
              <button
                onClick={() => setActiveTab('permissions')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === 'permissions' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Shield size={18} />
                Permissions
              </button>
            )}
          </div>

          {activeTab === 'list' && (
            <div className="flex flex-wrap items-center gap-3">
              {(currentUser.role === 'Admin' || ['ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'].includes(currentUser.email)) && (
                <div className="flex gap-2 mr-2">
                  <button 
                    onClick={() => setIsDeptConfigOpen(true)}
                    className="p-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                    title="Configure Departments"
                  >
                    <Settings2 size={20} />
                  </button>
                  <button 
                    onClick={() => setIsModeConfigOpen(true)}
                    className="p-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                    title="Configure Modes of Working"
                  >
                    <Settings size={20} />
                  </button>
                </div>
              )}
              <ColumnSelector 
                availableColumns={AVAILABLE_COLUMNS}
                selectedColumns={selectedColumns}
                onChange={handleColumnChange}
                maxSelection={12}
              />
              {((isAdmin || ['ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'].includes(currentUser.email)) || check('employees', 'add')) && (
                <div className="relative">
                  <button
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                    title="More Options"
                  >
                    <MoreVertical size={20} />
                  </button>
                  
                  <AnimatePresence>
                    {isMoreMenuOpen && (
                      <>
                        {/* Invisible backdrop to dismiss menu */}
                        <div className="fixed inset-0 z-10" onClick={() => setIsMoreMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800"
                        >
                          {check('employees', 'add') && (
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setIsModalOpen(true);
                                  setIsMoreMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center gap-2.5 cursor-pointer"
                              >
                                <Plus size={18} className="text-slate-400 dark:text-slate-500" />
                                Add Employee
                              </button>
                              <button
                                onClick={() => {
                                  setIsBulkModalOpen(true);
                                  setIsMoreMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center gap-2.5 cursor-pointer"
                              >
                                <Upload size={18} className="text-slate-400 dark:text-slate-500" />
                                Bulk Add
                              </button>
                            </div>
                          )}
                          {(isAdmin || ['ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'].includes(currentUser.email)) && (
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  scanForDuplicates();
                                  setIsMoreMenuOpen(false);
                                }}
                                disabled={isScanning}
                                className="w-full text-left px-4 py-2.5 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center gap-2.5 disabled:opacity-50 cursor-pointer"
                              >
                                {isScanning ? (
                                  <Loader2 size={18} className="animate-spin text-indigo-600" />
                                ) : (
                                  <Search size={18} className="text-slate-400 dark:text-slate-500" />
                                )}
                                Scan Duplicates
                              </button>
                            </div>
                          )}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                <Trophy size={18} />
                <span className="text-sm font-bold uppercase tracking-wider">Leaderboard</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {duplicates.length > 0 && (
        <div className="max-w-full mx-auto px-4 md:px-8 lg:px-12 mb-6">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle size={20} />
                <h4 className="font-bold">Potential Duplicate Groups Found ({duplicates.length} groups)</h4>
              </div>
              <button 
                onClick={() => {
                  setDuplicates([]);
                  setHasScanned(false);
                }}
                className="text-xs font-bold text-amber-600 hover:text-amber-700"
              >
                Dismiss
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {duplicates.map((group, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm space-y-3">
                  <p className="text-sm font-bold text-slate-900">Duplicate Group</p>
                  <div className="space-y-2">
                    {group.map(emp => (
                      <div key={emp.id} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                        <div className="truncate mr-2">
                          <p className="font-medium text-slate-700 truncate">{emp.email}</p>
                          <p className="text-[10px] text-slate-400">{emp.employeeId || 'No ID'}</p>
                        </div>
                        <button 
                          onClick={() => {
                            setMergeSource(emp);
                            setIsMergeModalOpen(true);
                          }}
                          className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md font-bold hover:bg-indigo-100 transition-all shrink-0 flex items-center gap-1"
                        >
                          <GitMerge size={12} />
                          Merge
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {hasScanned && duplicates.length === 0 && (
        <div className="max-w-full mx-auto px-4 md:px-8 lg:px-12 mb-6">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 size={20} />
              <h4 className="font-bold text-sm text-emerald-700">Scan Complete: No duplicate employees found.</h4>
            </div>
            <button 
              onClick={() => setHasScanned(false)}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
            >
              Dismiss
            </button>
          </motion.div>
        </div>
      )}

      {activeTab === 'permissions' ? (
        <PermissionsDashboard />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart2 className="text-indigo-600" size={20} />
              <h3 className="font-bold text-lg">Top 10 Performers</h3>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">By Points</span>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }} 
                />
                <Bar dataKey="points" radius={[4, 4, 0, 0]} barSize={32}>
                  {performanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : '#818cf8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
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
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Staff</p>
              <p className="text-2xl font-bold text-slate-900">{employees.filter(e => !e.endingDate).length}</p>
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
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full max-w-2xl">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search employees..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={searchQuery || ''}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 w-full md:w-auto">
              {(['active', 'inactive', 'all'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                    statusFilter === status 
                      ? "bg-indigo-600 text-white shadow-sm" 
                      : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>


          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Loading staff...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-sans">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm border-b border-slate-100">
                <tr className="text-slate-500 text-[10px] uppercase tracking-widest font-black">
                  {selectedColumns.includes('employee') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('name')}
                    >
                      <div className="flex items-center">
                        Employee
                        <SortIcon columnKey="name" />
                      </div>
                    </th>
                  )}
                  <th className="px-6 py-4 text-xs font-bold text-slate-400">#</th>
                  {selectedColumns.includes('status') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('status')}
                    >
                      <div className="flex items-center">
                        Status
                        <SortIcon columnKey="status" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('employeeId') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('employeeId')}
                    >
                      <div className="flex items-center">
                        Employee ID
                        <SortIcon columnKey="employeeId" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('joiningDate') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('joiningDate')}
                    >
                      <div className="flex items-center">
                        Joining Date
                        <SortIcon columnKey="joiningDate" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('modeOfWorking') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('modeOfWorking')}
                    >
                      <div className="flex items-center">
                        Mode
                        <SortIcon columnKey="modeOfWorking" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('department') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('department')}
                    >
                      <div className="flex items-center">
                        Department
                        <SortIcon columnKey="department" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('assignments') && <th className="px-6 py-4">Assignments</th>}
                  {selectedColumns.includes('assignedTasks') && <th className="px-6 py-4">Assigned Tasks</th>}
                  {selectedColumns.includes('latestCompletedTask') && <th className="px-6 py-4">Latest Completed</th>}
                  {selectedColumns.includes('officialMail') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('email')}
                    >
                      <div className="flex items-center">
                        Official Mail
                        <SortIcon columnKey="email" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('officialMailPassword') && <th className="px-6 py-4">Email Pass</th>}
                  {selectedColumns.includes('personalEmail') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('personalEmail')}
                    >
                      <div className="flex items-center">
                        Personal Email
                        <SortIcon columnKey="personalEmail" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('cnic') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('cnic')}
                    >
                      <div className="flex items-center">
                        CNIC
                        <SortIcon columnKey="cnic" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('whatsappPersonal') && <th className="px-6 py-4">WhatsApp</th>}
                  {selectedColumns.includes('phone') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('phone')}
                    >
                      <div className="flex items-center">
                        Phone
                        <SortIcon columnKey="phone" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('homePhone') && <th className="px-6 py-4">Home Phone</th>}
                  {selectedColumns.includes('address') && <th className="px-6 py-4">Address</th>}
                  {selectedColumns.includes('qualification') && <th className="px-6 py-4">Qualification</th>}
                  {selectedColumns.includes('gender') && <th className="px-6 py-4">Gender</th>}
                  {selectedColumns.includes('remarks') && <th className="px-6 py-4">Remarks</th>}
                  {selectedColumns.includes('endingDate') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('endingDate')}
                    >
                      <div className="flex items-center">
                        Ending Date
                        <SortIcon columnKey="endingDate" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('experience') && <th className="px-6 py-4">Work Experience</th>}
                  {selectedColumns.includes('role') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('role')}
                    >
                      <div className="flex items-center">
                        Role
                        <SortIcon columnKey="role" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('performance') && <th className="px-6 py-4">Performance</th>}
                  {selectedColumns.includes('points') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('points')}
                    >
                      <div className="flex items-center">
                        Points
                        <SortIcon columnKey="points" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('pcAllotted') && <th className="px-6 py-4">PC</th>}
                  {selectedColumns.includes('pcUsername') && <th className="px-6 py-4">PC User</th>}
                  {selectedColumns.includes('pcPassword') && <th className="px-6 py-4">PC Pass</th>}
                  {selectedColumns.includes('portalEnabled') && <th className="px-6 py-4">Portal</th>}
                  {selectedColumns.includes('createdAt') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('createdAt')}
                    >
                      <div className="flex items-center">
                        Created
                        <SortIcon columnKey="createdAt" />
                      </div>
                    </th>
                  )}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {sortedEmployees.map((emp, index) => (
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
                                src={emp.photoURL || emp.attachments?.photo || (emp.gender === 'Female' ? DEFAULT_IMAGES.FEMALE_STAFF : `https://api.dicebear.com/7.x/avataaars/svg?seed=${emp.name}`)} 
                                className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 object-cover" 
                                alt="" 
                                referrerPolicy="no-referrer"
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
                                  className="font-bold text-sm text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline text-left transition-colors"
                                >
                                  {emp.name}
                                </button>
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                                  emp.isOnline ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
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
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">{index + 1}</td>
                      {selectedColumns.includes('status') && (
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            (!emp.endingDate || emp.status === 'active') ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                          )}>
                            {(!emp.endingDate || emp.status === 'active') ? 'Active' : 'Inactive'}
                          </span>
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
                      {selectedColumns.includes('assignedTasks') && (
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
                            {getEmployeeTaskStats(emp.id).assignedCount}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('latestCompletedTask') && (
                        <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">
                          {getEmployeeTaskStats(emp.id).latestCompleted}
                        </td>
                      )}
                      {selectedColumns.includes('officialMail') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.officialMail}</td>
                      )}
                      {selectedColumns.includes('officialMailPassword') && (
                        <td className="px-6 py-4 text-sm text-slate-600 font-mono">
                          {emp.officialMailPassword ? '••••••••' : '—'}
                        </td>
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
                      {selectedColumns.includes('phone') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.phone}</td>
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
                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                          <div className="w-full max-w-[100px] bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-indigo-500 h-full rounded-full" 
                              style={{ width: `${Math.min((emp.points / 5000) * 100, 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-wider">Level {Math.floor(emp.points / 1000) + 1}</p>
                        </td>
                      )}
                      {selectedColumns.includes('points') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{emp.points.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">+12%</span>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('pcAllotted') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.pcAllotted}</td>
                      )}
                      {selectedColumns.includes('pcUsername') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{emp.pcUsername}</td>
                      )}
                      {selectedColumns.includes('pcPassword') && (
                        <td className="px-6 py-4 text-sm text-slate-600 font-mono">
                          {emp.pcPassword ? '••••••••' : '—'}
                        </td>
                      )}
                      {selectedColumns.includes('portalEnabled') && (
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            emp.portalEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}>
                            {emp.portalEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('createdAt') && (
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {emp.createdAt && emp.createdAt.toDate ? emp.createdAt.toDate().toLocaleDateString() : 'N/A'}
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
                          {check('employees', 'edit') && (
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
                          )}
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
                          {check('employees', 'delete') && emp.id !== currentUser.id && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEmployeeToDelete(emp);
                                setIsDeleteConfirmOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Employee"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
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
      </>
      )}

      <BulkEmployeeAddModal 
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={() => {
          // Success notification or refresh logic if needed
        }}
      />

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setEmployeeToDelete(null);
        }}
        onConfirm={() => {
          if (employeeToDelete) {
            handleDeleteEmployee(employeeToDelete);
          }
        }}
        title="Delete Employee"
        message={`Are you sure you want to move "${employeeToDelete?.name}" to trash? This will remove their access to the portal.`}
        confirmText="Move to Trash"
        variant="danger"
      />

      <MergeModal
        isOpen={isMergeModalOpen}
        onClose={() => {
          setIsMergeModalOpen(false);
          setMergeSource(null);
        }}
        type="employees"
        initialSourceItem={mergeSource}
        onSuccess={() => {
          setDuplicates([]);
          scanForDuplicates();
        }}
      />

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
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-600">
            <ShieldCheck size={20} className="shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}
        {isEditModalOpen && employeeToEdit ? (
          <EmployeeEditForm 
            employee={employeeToEdit} 
            currentUser={currentUser}
            onClose={() => {
              setIsEditModalOpen(false);
              setEmployeeToEdit(null);
            }} 
          />
        ) : (
          <form onSubmit={handleAddEmployee} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center">
                  Employee ID
                  <HelpIcon policyTitle="Employee ID Policy" />
                </label>
                <button 
                  type="button"
                  onClick={() => generateEmployeeId()}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase tracking-wider transition-colors"
                >
                  Regenerate
                </button>
              </div>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                placeholder="Emp-001"
                value={newEmployee.employeeId || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, employeeId: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="crm-label">Joining Date</label>
              <input 
                required
                type="date" 
                className="crm-input"
                value={newEmployee.joiningDate || ''}
                onChange={e => {
                  const date = e.target.value;
                  setNewEmployee(prev => ({ ...prev, joiningDate: date }));
                }}
              />
            </div>
            <div className="space-y-2">
              <SearchableSelect
                label="Mode of Working"
                required
                options={globalSettings?.modes?.map(mode => ({ label: mode, value: mode })) || [
                  { label: "Office", value: "Office" },
                  { label: "Remotely", value: "Remotely" },
                  { label: "Hybrid", value: "Hybrid" }
                ]}
                value={newEmployee.modeOfWorking}
                onChange={value => setNewEmployee(prev => ({ ...prev, modeOfWorking: value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="crm-label">Full Name</label>
              <input 
                required
                type="text" 
                className="crm-input"
                placeholder="e.g. John Doe"
                value={newEmployee.name || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <SearchableSelect
                label="Gender"
                required
                options={[
                  { label: "Male", value: "Male" },
                  { label: "Female", value: "Female" }
                ]}
                value={newEmployee.gender}
                onChange={value => setNewEmployee(prev => ({ ...prev, gender: value as any }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <SearchableSelect
                label="Department"
                required
                options={globalSettings?.departments?.map(dept => ({ label: dept, value: dept })) || [
                  { label: "IT", value: "IT" },
                  { label: "HR", value: "HR" },
                  { label: "Finance", value: "Finance" },
                  { label: "Marketing", value: "Marketing" },
                  { label: "Operations", value: "Operations" }
                ]}
                value={newEmployee.department}
                onChange={value => setNewEmployee(prev => ({ ...prev, department: value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="crm-label">Assignments</label>
              <input 
                type="text" 
                className="crm-input"
                placeholder="e.g. Journal Management"
                value={newEmployee.assignments || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, assignments: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="crm-label">Portal Access</label>
              <div className="flex items-center gap-3 h-[42px]">
                <button
                  type="button"
                  onClick={() => setNewEmployee(prev => ({ ...prev, portalEnabled: !prev.portalEnabled }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                    newEmployee.portalEnabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      newEmployee.portalEnabled ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {newEmployee.portalEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="crm-label">Salary Configuration (Base Salary)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="number"
                  placeholder="Base Salary"
                  className="crm-input pl-10"
                  value={newEmployee.baseSalary || ''}
                  onChange={e => setNewEmployee(prev => ({ ...prev, baseSalary: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="crm-label">Official Mail</label>
              <input 
                required
                type="email" 
                className="crm-input"
                placeholder="john@hostajournal.com"
                value={newEmployee.officialMail || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, officialMail: e.target.value, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="crm-label">Official Mail Password</label>
              <div className="relative">
                <input 
                  type={showNewMailPassword ? "text" : "password"} 
                  className="crm-input pr-10"
                  placeholder="Password123"
                  value={newEmployee.officialMailPassword || ''}
                  onChange={e => setNewEmployee(prev => ({ ...prev, officialMailPassword: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowNewMailPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  {showNewMailPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="crm-label">Personal E-Mail Id</label>
              <input 
                type="email" 
                className="crm-input"
                placeholder="john.personal@gmail.com"
                value={newEmployee.personalEmail || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, personalEmail: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="crm-label">PC Allotted (ID/Name)</label>
              <input 
                type="text" 
                className="crm-input"
                placeholder="PC-001"
                value={newEmployee.pcAllotted || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, pcAllotted: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="crm-label">PC Username</label>
              <input 
                type="text" 
                className="crm-input"
                placeholder="admin"
                value={newEmployee.pcUsername || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, pcUsername: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="crm-label">PC Password</label>
              <div className="relative">
                <input 
                  type={showNewPcPassword ? "text" : "password"} 
                  className="crm-input pr-10"
                  placeholder="pc-pass-123"
                  value={newEmployee.pcPassword || ''}
                  onChange={e => setNewEmployee(prev => ({ ...prev, pcPassword: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPcPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  {showNewPcPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="crm-label flex items-center">
                CNIC
                <HelpIcon policyTitle="CNIC Verification Policy" />
              </label>
              <input 
                type="text" 
                className="crm-input"
                placeholder="42101-XXXXXXX-X"
                value={newEmployee.cnic || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, cnic: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="crm-label">WhatsApp Personal</label>
              <input 
                type="tel" 
                className="crm-input"
                placeholder="+92 XXX XXXXXXX"
                value={newEmployee.whatsappPersonal || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, whatsappPersonal: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="crm-label">Home Phone No</label>
              <input 
                type="tel" 
                className="crm-input"
                placeholder="021-XXXXXXXX"
                value={newEmployee.homePhone || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, homePhone: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="crm-label">Address</label>
            <textarea 
              className="crm-input min-h-[80px]"
              placeholder="Full residential address"
              rows={2}
              value={newEmployee.address || ''}
              onChange={e => setNewEmployee(prev => ({ ...prev, address: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="crm-label">Qualification</label>
              <input 
                type="text" 
                className="crm-input"
                placeholder="e.g. MS Computer Science"
                value={newEmployee.qualification || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, qualification: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="crm-label">Already Work Experience</label>
              <input 
                type="text" 
                className="crm-input"
                placeholder="e.g. 2 Years at XYZ Corp"
                value={newEmployee.experience || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, experience: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <SearchableSelect
                label="Role"
                required
                options={[
                  { label: "Employee", value: "Employee" },
                  { label: "Manager", value: "Manager" }
                ]}
                value={newEmployee.role}
                onChange={value => setNewEmployee(prev => ({ ...prev, role: value as any }))}
              />
            </div>
            <div className="space-y-2">
              <label className="crm-label">Initial Points</label>
              <input 
                required
                type="number" 
                className="crm-input"
                value={newEmployee.points || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, points: parseInt(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="crm-label">Ending Date (Optional)</label>
              <input 
                type="date" 
                className="crm-input"
                value={newEmployee.endingDate || ''}
                onChange={e => setNewEmployee(prev => ({ ...prev, endingDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="crm-label">Remarks</label>
            <textarea 
              className="crm-input min-h-[80px]"
              placeholder="Any additional remarks..."
              rows={2}
              value={newEmployee.remarks || ''}
              onChange={e => setNewEmployee(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={16} />
              Feature Permissions
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
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
                      value ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                    )} />
                    <div className={cn(
                      "absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all duration-200",
                      value ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">Attachments</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="crm-label">CV / Resume</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer group">
                    <Upload size={18} className="text-slate-400 group-hover:text-indigo-500" />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
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
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <Paperclip size={18} />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="crm-label">Employee Photo</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer group">
                    <Upload size={18} className="text-slate-400 group-hover:text-indigo-500" />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
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
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                      <img src={newEmployee.attachments.photo} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="crm-label">CNIC Scanned Copy</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer group">
                    <Upload size={18} className="text-slate-400 group-hover:text-indigo-500" />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
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
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <Paperclip size={18} />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="crm-label">Other Documents</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer group">
                    <Plus size={18} className="text-slate-400 group-hover:text-indigo-500" />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">Add Document</span>
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
                        <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px] font-bold">
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
              disabled={isSaving}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Adding...
                </>
              ) : (
                <>
                  <Plus size={20} />
                  Add Employee
                </>
              )}
            </button>
          </div>
        </form>
        )}
      </Modal>

      {isDeptConfigOpen && (
        <ConfigModal
          isOpen={isDeptConfigOpen}
          onClose={() => setIsDeptConfigOpen(false)}
          title="Configure Departments"
          fieldName="departments"
          type="string-list"
          initialItems={globalSettings?.departments || []}
        />
      )}

      {isModeConfigOpen && (
        <ConfigModal
          isOpen={isModeConfigOpen}
          onClose={() => setIsModeConfigOpen(false)}
          title="Configure Modes of Working"
          fieldName="modes"
          type="string-list"
          initialItems={globalSettings?.modes || []}
        />
      )}
    </div>
  );
};
