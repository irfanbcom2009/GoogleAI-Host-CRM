import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Mail, 
  Shield, 
  Trophy, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Briefcase,
  Star,
  Award,
  Target,
  Phone,
  MapPin,
  FileText,
  User,
  Hash,
  Building,
  GraduationCap,
  ExternalLink,
  MessageSquare,
  Layers,
  Edit,
  Monitor,
  Lock,
  Loader2,
  ShieldCheck,
  History,
  PlusCircle,
  MinusCircle,
  ChevronRight,
  Info,
  X,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion } from 'motion/react';
import { User as CRMUser, Task, UserRole, EmploymentPeriod, GlobalSettings } from '../types';
import { cn, formatDateForInput } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { Modal } from './Modal';
import { EmployeeEditForm } from './EmployeeEditForm';

import { FloatingActionBar } from './FloatingActionBar';
import { toast } from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';
import { DEFAULT_IMAGES } from '../constants/images';

interface EmployeeDetailProps {
  employee: CRMUser;
  onBack: () => void;
  currentUser: CRMUser;
  onImpersonate?: (user: { id: string, role: UserRole, name: string, email: string }) => void;
}

export const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ employee, onBack, currentUser, onImpersonate }) => {
  const isTaiba = (val: string | undefined) => {
    if (!val) return false;
    return val.toLowerCase().includes('taiba@0045');
  };

  const { check } = usePermissions(currentUser);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingPortal, setIsUpdatingPortal] = useState(false);
  const [isRehiring, setIsRehiring] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMailPassword, setShowMailPassword] = useState(false);
  const [editData, setEditData] = useState<CRMUser>(employee);
  const [history, setHistory] = useState<EmploymentPeriod[]>([]);
  const [isRejoiningModalOpen, setIsRejoiningModalOpen] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [isEditHistoryModalOpen, setIsEditHistoryModalOpen] = useState(false);
  const [isConfirmingDeleteHistory, setIsConfirmingDeleteHistory] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<EmploymentPeriod | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [allDocTasks, setAllDocTasks] = useState<Task[]>([]);
  const [selectedAttachedTaskIds, setSelectedAttachedTaskIds] = useState<string[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);

  useEffect(() => {
    const fetchSettings = () => {
      const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as GlobalSettings;
          setGlobalSettings({
            ...data,
            departments: Array.isArray(data.departments) ? data.departments : []
          });
        }
      });
      return unsubscribe;
    };
    return fetchSettings();
  }, []);

  useEffect(() => {
    if (tasks) {
      setSelectedAttachedTaskIds(tasks.map(t => t.id));
    }
  }, [tasks, isEditing]);

  useEffect(() => {
    if (currentUser.role === 'Admin' || currentUser.role === 'Manager') {
      const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
        setAllDocTasks(list);
      }, (error) => {
        console.error("Error fetching all tasks for assignment selection:", error);
      });
      return () => unsubscribe();
    }
  }, [currentUser.role]);

  useEffect(() => {
    const q = query(
      collection(db, 'employment_history'),
      where('employeeId', '==', employee.id),
      orderBy('joinDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as EmploymentPeriod));
      setHistoryLoading(false);
    });

    return () => unsubscribe();
  }, [employee.id]);

  useEffect(() => {
    setEditData(employee);
  }, [employee]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing) return;
      
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        setIsEditing(false);
        setEditData(employee);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, editData, employee]);

  useEffect(() => {
    if (isEditing) {
      const firstInput = document.querySelector('input, select, textarea');
      if (firstInput) {
        (firstInput as HTMLElement).focus();
      }
    }
  }, [isEditing]);

  const handleSave = async () => {
    setIsSaving(true);
    
    // Restriction: Only admin can add/edit employees with gmail address
    const isSystemAdmin = currentUser.role === 'Admin' || 
                         ['irfanbcom2009@gmail.com', 'ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'].includes(currentUser.email);
    
    if (editData.email.toLowerCase().endsWith('@gmail.com') && !isSystemAdmin) {
      toast.error("Only administrators can manage records with @gmail.com addresses.");
      setIsSaving(false);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', employee.id), {
        ...editData,
        updatedAt: serverTimestamp()
      });

      // Update attached tasks
      const originalTaskIds = tasks.map(t => t.id);
      const tasksToAttach = selectedAttachedTaskIds.filter(id => !originalTaskIds.includes(id));
      const tasksToDetach = originalTaskIds.filter(id => !selectedAttachedTaskIds.includes(id));

      const attachPromises = tasksToAttach.map(async (taskId) => {
        await updateDoc(doc(db, 'tasks', taskId), {
          assignedTo: employee.id,
          assignedToName: employee.name,
          updatedAt: serverTimestamp()
        });
      });

      const detachPromises = tasksToDetach.map(async (taskId) => {
        await updateDoc(doc(db, 'tasks', taskId), {
          assignedTo: '',
          assignedToName: 'Unassigned',
          updatedAt: serverTimestamp()
        });
      });

      await Promise.all([...attachPromises, ...detachPromises]);

      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseEmployment = async (data: { leaveDate: string; reason: string; notes?: string }) => {
    const activeRecord = history.find(h => h.status === 'Active');
    if (!activeRecord) {
      toast.error('No active employment record found to close.');
      return;
    }

    if (new Date(data.leaveDate) < new Date(activeRecord.joinDate)) {
      toast.error('Leave date cannot be earlier than join date.');
      return;
    }

    setIsRehiring(true);
    try {
      await updateDoc(doc(db, 'employment_history', activeRecord.id), {
        leaveDate: data.leaveDate,
        status: 'Closed',
        reason: data.reason,
        notes: data.notes || '',
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'users', employee.id), {
        endingDate: data.leaveDate,
        updatedAt: serverTimestamp()
      });

      toast.success('Employment record closed successfully.');
      setIsClosingModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'employment_history');
    } finally {
      setIsRehiring(false);
    }
  };

  const handleRejoinEmployment = async (data: { joinDate: string; reason: string; notes?: string }) => {
    const hasActive = history.some(h => h.status === 'Active');
    if (hasActive) {
      toast.error('Employee already has an active record.');
      return;
    }

    setIsRehiring(true);
    try {
      await addDoc(collection(db, 'employment_history'), {
        employeeId: employee.id,
        joinDate: data.joinDate,
        leaveDate: null,
        status: 'Active',
        reason: data.reason,
        notes: data.notes || '',
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'users', employee.id), {
        joiningDate: data.joinDate,
        endingDate: '',
        status: 'active',
        updatedAt: serverTimestamp()
      });

      toast.success('Rejoining record created successfully.');
      setIsRejoiningModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'employment_history');
    } finally {
      setIsRehiring(false);
    }
  };

  const handleUpdateHistoryRecord = async (id: string, data: { joinDate: string; leaveDate: string | null; status: 'Active' | 'Closed'; reason: any; notes?: string }) => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'employment_history', id), {
        joinDate: data.joinDate,
        leaveDate: data.leaveDate || null,
        status: data.status,
        reason: data.reason,
        notes: data.notes || '',
        updatedAt: serverTimestamp()
      });

      // Recalculate newest cycle status and update main user document
      const updatedHistory = history.map(h => h.id === id ? {
        ...h,
        joinDate: data.joinDate,
        leaveDate: data.leaveDate || null,
        status: data.status,
        reason: data.reason,
        notes: data.notes || ''
      } : h);

      const sortedHistory = [...updatedHistory].sort((a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime());

      if (sortedHistory.length > 0) {
        const latest = sortedHistory[0];
        await updateDoc(doc(db, 'users', employee.id), {
          joiningDate: latest.joinDate,
          endingDate: latest.status === 'Active' ? '' : (latest.leaveDate || ''),
          status: latest.status === 'Active' ? 'active' : 'inactive',
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, 'users', employee.id), {
          endingDate: '',
          status: 'active',
          updatedAt: serverTimestamp()
        });
      }

      toast.success('Employment record updated successfully.');
      setIsEditHistoryModalOpen(false);
      setSelectedHistoryRecord(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'employment_history');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistoryRecord = async (id: string, bypassConfirm = false) => {
    if (!bypassConfirm && !window.confirm("Are you sure you want to delete this employment history record? This action cannot be undone.")) return false;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'employment_history', id));
      toast.success('Employment history record deleted successfully.');

      // Update main user document based on remaining history
      const remainingHistory = history.filter(h => h.id !== id);
      if (remainingHistory.length > 0) {
        const latest = remainingHistory[0];
        await updateDoc(doc(db, 'users', employee.id), {
          joiningDate: latest.joinDate,
          endingDate: latest.status === 'Active' ? '' : (latest.leaveDate || ''),
          status: latest.status === 'Active' ? 'active' : 'inactive',
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, 'users', employee.id), {
          endingDate: '',
          status: 'active',
          updatedAt: serverTimestamp()
        });
      }
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'employment_history');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePortal = async () => {
    setIsUpdatingPortal(true);
    try {
      await updateDoc(doc(db, 'users', employee.id), {
        portalEnabled: !employee.portalEnabled
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsUpdatingPortal(false);
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', employee.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(taskData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => unsubscribe();
  }, [employee.id]);

  const stats = {
    completed: tasks.filter(t => t.status === 'completed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    total: tasks.length
  };

  const level = Math.floor(employee.points / 1000) + 1;
  const progressToNextLevel = (employee.points % 1000) / 10;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-8 space-y-8 max-w-full mx-auto px-4 md:px-8 lg:px-12"
    >
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all font-bold group"
        >
          <div className="p-2 bg-white border border-slate-200 rounded-xl group-hover:bg-slate-50 transition-all">
            <ArrowLeft size={20} />
          </div>
          Back to Directory
        </button>

        <div className="flex items-center gap-3">
          {check('employees', 'edit') && (
            <button 
              onClick={() => setIsEditing(!isEditing)}
              disabled={isSaving}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg",
                isEditing 
                  ? "bg-indigo-50 text-indigo-600 border border-indigo-200" 
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/20"
              )}
            >
              <Edit size={18} />
              {isEditing ? 'Editing Mode' : 'Edit Profile'}
            </button>
          )}
        </div>

        <Modal 
          isOpen={isEditModalOpen} 
          onClose={() => setIsEditModalOpen(false)} 
          title="Edit Employee Profile"
          maxWidth="4xl"
        >
          <EmployeeEditForm 
            employee={employee} 
            currentUser={currentUser}
            onClose={() => setIsEditModalOpen(false)} 
          />
        </Modal>
      </div>

      <div className={cn(
        "grid grid-cols-1 lg:grid-cols-4 gap-8 transition-all",
        isEditing && "opacity-90"
      )}>
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-6">
            <div className="relative inline-block group">
              <img 
                src={employee.photoURL || employee.attachments?.photo || (employee.gender === 'Female' ? DEFAULT_IMAGES.FEMALE_STAFF : `https://api.dicebear.com/7.x/avataaars/svg?seed=${employee.name}`)} 
                className={cn(
                  "w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-xl mx-auto object-cover transition-all",
                  isEditing && "ring-4 ring-indigo-500 ring-offset-4"
                )} 
                alt={employee.name} 
                referrerPolicy="no-referrer"
              />
              {isEditing ? (
                <div className="absolute inset-0 bg-slate-900/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  <Edit size={24} className="text-white" />
                </div>
              ) : (
                <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg border-2 border-white">
                  <Trophy size={20} />
                </div>
              )}
            </div>
            
            <div>
              {isEditing ? (
                <div className="space-y-3">
                  <input 
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xl font-black text-center"
                    value={editData.name || ''}
                    onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Full Name"
                  />
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center block">Photo URL</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-center font-mono"
                      value={editData.photoURL || ''}
                      onChange={e => setEditData(prev => ({ ...prev, photoURL: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              ) : (
                <h1 className="text-2xl font-black text-slate-900 break-words">{employee.name}</h1>
              )}
              {isEditing ? (
                <input 
                  type="email"
                  className="w-full px-4 py-1 mt-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-center"
                  value={editData.email || ''}
                  onChange={e => setEditData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Email Address"
                />
              ) : (
                <p className="text-slate-500 flex items-center justify-center gap-1 mt-1 break-all">
                  <Mail size={14} />
                  {employee.email}
                </p>
              )}
              {employee.employeeId && (
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-2 bg-indigo-50 px-2 py-1 rounded-full inline-block">
                  ID: {employee.employeeId}
                </p>
              )}
            </div>

            <div className="flex justify-center gap-2">
              {isEditing ? (
                <select 
                  className="px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={editData.role || ''}
                  onChange={e => setEditData(prev => ({ ...prev, role: e.target.value as any }))}
                >
                  <option value="Employee">Employee</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              ) : (
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider",
                  employee.role === 'Manager' ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                )}>
                  {employee.role}
                </span>
              )}
              {isEditing ? (
                <select 
                  className="px-3 py-1 rounded-full text-xs font-bold border border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={editData.modeOfWorking || ''}
                  onChange={e => setEditData(prev => ({ ...prev, modeOfWorking: e.target.value as any }))}
                >
                  <option value="On-site">On-site</option>
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              ) : (
                employee.modeOfWorking && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold border border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider">
                    {employee.modeOfWorking}
                  </span>
                )
              )}
            </div>

            <div className="pt-6 border-t border-slate-100 space-y-4">
              <div className="flex justify-between items-end">
                <div className="text-left">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Level</p>
                  <p className="text-xl font-black text-indigo-600">Level {level}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Points</p>
                  <p className="text-xl font-black text-slate-900">{employee.points.toLocaleString()}</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressToNextLevel}%` }}
                    className="h-full bg-indigo-600 rounded-full"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold text-right uppercase tracking-wider">
                  {1000 - (employee.points % 1000)} pts to Level {level + 1}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-50 pb-3">
              <Shield size={18} className="text-indigo-600" />
              Portal Access
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-700">Portal Login</p>
                  <p className="text-[10px] text-slate-500">Enable/Disable access</p>
                </div>
                <button 
                  onClick={handleTogglePortal}
                  disabled={isUpdatingPortal || !check('employees', 'edit')}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    employee.portalEnabled ? "bg-indigo-600" : "bg-slate-200",
                    !check('employees', 'edit') && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    employee.portalEnabled ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>

              {onImpersonate && (currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                <button 
                  onClick={() => onImpersonate({ id: employee.id, role: employee.role, name: employee.name, email: employee.email })}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 font-bold text-xs hover:bg-indigo-100 transition-all"
                >
                  <Monitor size={16} />
                  Login to Portal As {employee.name.split(' ')[0]}
                </button>
              )}

              {employee.endingDate && check('employees', 'edit') && (
                <button 
                  onClick={() => setIsRejoiningModalOpen(true)}
                  disabled={isRehiring || !check('employees', 'edit')}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 font-bold text-xs hover:bg-emerald-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isRehiring ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                  Rehire Employee
                </button>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-50 pb-3">
              <FileText size={18} className="text-indigo-600" />
              Documents
            </h3>
            <div className="space-y-2">
              {employee.attachments?.cv && (
                <a href={employee.attachments.cv} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-all group">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-slate-400 group-hover:text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700">Curriculum Vitae</span>
                  </div>
                  <ExternalLink size={14} className="text-slate-300 group-hover:text-indigo-400" />
                </a>
              )}
              {employee.attachments?.photo && (
                <a href={employee.attachments.photo} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-all group">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-slate-400 group-hover:text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700">Employee Photo</span>
                  </div>
                  <ExternalLink size={14} className="text-slate-300 group-hover:text-indigo-400" />
                </a>
              )}
              {employee.attachments?.cnicScanned && (
                <a href={employee.attachments.cnicScanned} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-all group">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-slate-400 group-hover:text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700">CNIC Scanned</span>
                  </div>
                  <ExternalLink size={14} className="text-slate-300 group-hover:text-indigo-400" />
                </a>
              )}
              {employee.attachments?.otherDocs?.map((doc, idx) => (
                <a key={idx} href={doc} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-all group">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-slate-400 group-hover:text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700">Document {idx + 1}</span>
                  </div>
                  <ExternalLink size={14} className="text-slate-300 group-hover:text-indigo-400" />
                </a>
              ))}
              {!employee.attachments?.cv && !employee.attachments?.cnicScanned && !employee.attachments?.photo && (!employee.attachments?.otherDocs || employee.attachments.otherDocs.length === 0) && (
                <p className="text-xs text-slate-400 italic text-center py-4">No documents attached</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Progress & Tasks */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-6">
                <Briefcase size={24} className="text-indigo-600" />
                Professional Profile
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Building size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Department</p>
                      {isEditing ? (
                        <select 
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={editData.department || ''}
                          onChange={e => setEditData(prev => ({ ...prev, department: e.target.value }))}
                        >
                          <option value="">Select Department</option>
                          {((globalSettings?.departments && globalSettings.departments.length > 0)
                            ? globalSettings.departments
                            : ['Management', 'Editorial', 'Technical', 'Sales', 'Support', 'Finance', 'HR', 'IT', 'Marketing', 'Operations']
                          ).map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm font-bold text-slate-900">{employee.department || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Target size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assignments</p>
                      {isEditing ? (
                        <div className="space-y-2 mt-1 min-w-[300px] max-w-md border border-slate-200 rounded-xl p-3 bg-white shadow-inner max-h-60 overflow-y-auto">
                          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Attach System Tasks</p>
                          {allDocTasks.map((t) => {
                            return (
                              <label key={t.id} className="flex items-start gap-3 py-1.5 px-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border-b border-slate-50 last:border-0">
                                <input 
                                  type="checkbox"
                                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-1"
                                  checked={selectedAttachedTaskIds.includes(t.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedAttachedTaskIds(prev => [...prev, t.id]);
                                    } else {
                                      setSelectedAttachedTaskIds(prev => prev.filter(id => id !== t.id));
                                    }
                                  }}
                                />
                                <div className="text-xs">
                                  <p className="font-bold text-slate-800">{t.title}</p>
                                  <p className="text-[10px] text-slate-500 font-mono uppercase">
                                    {t.serviceType} • {t.dueDate}
                                    {t.assignedTo && t.assignedTo !== employee.id ? ` (Currently: ${t.assignedToName})` : ''}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                          {allDocTasks.length === 0 && (
                            <p className="text-xs text-slate-400 italic font-medium">No tasks found in the system</p>
                          )}
                          <div className="pt-2 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Custom Description Note (Fallback)</p>
                            <input 
                              type="text"
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
                              value={editData.assignments || ''}
                              onChange={e => setEditData(prev => ({ ...prev, assignments: e.target.value }))}
                              placeholder="Optional free-form notes..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 mt-1">
                          {employee.assignments && (
                            <p className="text-sm font-semibold text-slate-700">{employee.assignments}</p>
                          )}
                          <div className="flex flex-col gap-1">
                            {tasks.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {tasks.map(t => (
                                  <span key={t.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">
                                    <Briefcase size={12} className="shrink-0 text-indigo-500" />
                                    {t.title}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No attached system tasks</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <GraduationCap size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qualification</p>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={editData.qualification || ''}
                          onChange={e => setEditData(prev => ({ ...prev, qualification: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-900">{employee.qualification || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Joining Date</p>
                      {isEditing ? (
                        <input 
                          type="date"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={formatDateForInput(editData.joiningDate) || ''}
                          onChange={e => setEditData(prev => ({ ...prev, joiningDate: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-900">{employee.joiningDate || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ending Date</p>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="date"
                            className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                            value={formatDateForInput(editData.endingDate) || ''}
                            onChange={e => setEditData(prev => ({ ...prev, endingDate: e.target.value }))}
                          />
                          {editData.endingDate && (
                            <button
                              type="button"
                              onClick={() => setEditData(prev => ({ ...prev, endingDate: '' }))}
                              className="p-1 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0"
                              title="Clear Ending Date"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-slate-900">{employee.endingDate || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Experience</p>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={editData.experience || ''}
                          onChange={e => setEditData(prev => ({ ...prev, experience: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-900">{employee.experience || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gender</p>
                      {isEditing ? (
                        <select 
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={editData.gender || ''}
                          onChange={e => setEditData(prev => ({ ...prev, gender: e.target.value as any }))}
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      ) : (
                        <p className="text-sm font-bold text-slate-900">{employee.gender || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Official Mail</p>
                      {isEditing ? (
                        <input 
                          type="email"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={editData.officialMail || ''}
                          onChange={e => setEditData(prev => ({ ...prev, officialMail: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">
                          {employee.officialMail ? (
                            <a href={`mailto:${employee.officialMail}`} className="hover:text-indigo-600 transition-colors">
                              {employee.officialMail}
                            </a>
                          ) : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                  {(employee.officialMailPassword || isEditing) && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                        <Lock size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mail Password</p>
                        {isEditing ? (
                          <div className="relative max-w-xs">
                            <input 
                              type={showMailPassword ? "text" : "password"}
                              className="w-full pl-2 pr-8 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                              value={editData.officialMailPassword || ''}
                              onChange={e => setEditData(prev => ({ ...prev, officialMailPassword: e.target.value }))}
                            />
                            <button
                              type="button"
                              onClick={() => setShowMailPassword(prev => !prev)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {showMailPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900 font-mono">
                              {showMailPassword ? (
                                isTaiba(employee.officialMailPassword) && currentUser.role !== 'Admin' ? '••••••••' : employee.officialMailPassword
                              ) : (
                                '••••••••'
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                if (isTaiba(employee.officialMailPassword) && currentUser.role !== 'Admin') {
                                  toast.error('Access Denied');
                                  return;
                                }
                                setShowMailPassword(prev => !prev);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                              title={showMailPassword ? "Hide password" : "Show password"}
                            >
                              {showMailPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personal Email</p>
                      {isEditing ? (
                        <input 
                          type="email"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={editData.personalEmail || ''}
                          onChange={e => setEditData(prev => ({ ...prev, personalEmail: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">
                          {employee.personalEmail ? (
                            <a href={`mailto:${employee.personalEmail}`} className="hover:text-indigo-600 transition-colors">
                              {employee.personalEmail}
                            </a>
                          ) : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Hash size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CNIC</p>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={editData.cnic || ''}
                          onChange={e => setEditData(prev => ({ ...prev, cnic: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-900">{employee.cnic || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <MessageSquare size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WhatsApp</p>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={editData.whatsappPersonal || ''}
                          onChange={e => setEditData(prev => ({ ...prev, whatsappPersonal: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-900">
                          {employee.whatsappPersonal ? (
                            <a 
                              href={`https://wa.me/${employee.whatsappPersonal.replace(/[^0-9]/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="hover:text-indigo-600 transition-colors"
                            >
                              {employee.whatsappPersonal}
                            </a>
                          ) : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Phone size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Home Phone</p>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={editData.homePhone || ''}
                          onChange={e => setEditData(prev => ({ ...prev, homePhone: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-900">
                          {employee.homePhone ? (
                            <a href={`tel:${employee.homePhone}`} className="hover:text-indigo-600 transition-colors">
                              {employee.homePhone}
                            </a>
                          ) : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-50">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                    <MapPin size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Home Address</p>
                    {isEditing ? (
                      <textarea 
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium h-20 resize-none"
                        value={editData.address || ''}
                        onChange={e => setEditData(prev => ({ ...prev, address: e.target.value }))}
                      />
                    ) : (
                      <p className="text-sm text-slate-600 leading-relaxed">{employee.address || 'N/A'}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                    <FileText size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remarks</p>
                    {isEditing ? (
                      <textarea 
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium h-20 resize-none"
                        value={editData.remarks || ''}
                        onChange={e => setEditData(prev => ({ ...prev, remarks: e.target.value }))}
                      />
                    ) : (
                      <p className="text-sm text-slate-600 leading-relaxed italic">"{employee.remarks || 'No remarks provided.'}"</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">PC Details</h4>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white text-slate-400 rounded-lg shadow-sm">
                    <Monitor size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PC Allotted</p>
                    {isEditing ? (
                      <input 
                        type="text"
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                        value={editData.pcAllotted || ''}
                        onChange={e => setEditData(prev => ({ ...prev, pcAllotted: e.target.value }))}
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-900">{employee.pcAllotted || 'N/A'}</p>
                    )}
                  </div>
                </div>
                {(employee.pcUsername || isEditing) && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white text-slate-400 rounded-lg shadow-sm">
                      <User size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PC Username</p>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={editData.pcUsername || ''}
                          onChange={e => setEditData(prev => ({ ...prev, pcUsername: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-900">{employee.pcUsername}</p>
                      )}
                    </div>
                  </div>
                )}
                {(employee.pcPassword || isEditing) && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white text-slate-400 rounded-lg shadow-sm">
                      <Lock size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PC Password</p>
                      {isEditing ? (
                        <input 
                          type="text"
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                          value={editData.pcPassword || ''}
                          onChange={e => setEditData(prev => ({ ...prev, pcPassword: e.target.value }))}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <p 
                            onClick={() => {
                              if (currentUser.role !== 'Admin') {
                                toast.error('Only Admins can copy passwords');
                                return;
                              }
                              if (employee.pcPassword) {
                                if (isTaiba(employee.pcPassword)) {
                                  toast.error('Access Denied');
                                  return;
                                }
                                navigator.clipboard.writeText(employee.pcPassword);
                                toast.success('PC Password copied!');
                              }
                            }}
                            className={`text-sm font-bold text-slate-900 transition-colors flex items-center gap-2 group ${currentUser.role === 'Admin' ? 'cursor-pointer hover:text-indigo-600' : 'cursor-not-allowed'}`}
                            title={currentUser.role === 'Admin' ? "Click to copy password" : "Copy restricted to Admin"}
                          >
                            <span className="font-mono">••••••••</span>
                            {currentUser.role === 'Admin' && (
                              <span className="text-[8px] font-black uppercase text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-100 px-1.5 py-0.5 rounded">Click to Copy</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Employment History Section */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <History size={24} className="text-indigo-600" />
                  Employment History
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Full tracking of joining and leaving cycles</p>
              </div>
              <div className="flex items-center gap-2">
                {history.some(h => h.status === 'Active') ? (
                  <button 
                    onClick={() => setIsClosingModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs hover:bg-rose-100 transition-all border border-rose-100 shadow-sm shadow-rose-100"
                  >
                    <MinusCircle size={18} />
                    Close Employment
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsRejoiningModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xs hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm shadow-emerald-100"
                  >
                    <PlusCircle size={18} />
                    Add Rejoin Date
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto -mx-8 px-8">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">Join Date</th>
                    <th className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">Leave Date</th>
                    <th className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">Duration</th>
                    <th className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">Status</th>
                    <th className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">Reason</th>
                    <th className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">Notes</th>
                    {currentUser.role === 'Admin' && (
                      <th className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.map((record) => {
                    const join = new Date(record.joinDate);
                    const leave = record.leaveDate ? new Date(record.leaveDate) : new Date();
                    const diffTime = Math.abs(leave.getTime() - join.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const months = Math.floor(diffDays / 30.44);
                    const days = Math.floor(diffDays % 30.44);
                    const durationStr = `${months > 0 ? `${months}m ` : ''}${days}d`;

                    return (
                      <tr key={record.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border transition-all",
                              record.status === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
                            )}>
                              {record.status === 'Active' ? <TrendingUp size={16} /> : <Clock size={16} />}
                            </div>
                            <div>
                              <span className="text-sm font-black text-slate-900 block leading-none">{record.joinDate}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Joined</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {record.leaveDate ? (
                            <div>
                              <span className="text-sm font-black text-slate-900 block leading-none">{record.leaveDate}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Left</span>
                            </div>
                          ) : (
                            <span className="text-emerald-500 font-black text-[10px] uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">Active Now</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                            {durationStr}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                            record.status === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", record.status === 'Active' ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                            {record.status}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm font-black text-slate-900">{record.reason}</span>
                        </td>
                        <td className="py-4 px-4">
                          {record.notes ? (
                            <div className="flex items-center gap-2 group/note relative">
                              <Info size={14} className="text-slate-300 cursor-help" />
                              <span className="text-xs text-slate-500 max-w-[150px] truncate">{record.notes}</span>
                              <div className="absolute bottom-full left-0 mb-2 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover/note:opacity-100 transition-all pointer-events-none z-10 w-48 shadow-2xl font-medium">
                                {record.notes}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-[10px]">--</span>
                          )}
                        </td>
                        {currentUser.role === 'Admin' && (
                          <td className="py-4 px-4 text-right space-x-1">
                            <button 
                              onClick={() => {
                                setSelectedHistoryRecord(record);
                                setIsEditHistoryModalOpen(true);
                                setIsConfirmingDeleteHistory(false);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all inline-flex items-center justify-center"
                              title="Edit Record"
                            >
                              <Edit size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {history.length === 0 && !historyLoading && (
                    <tr>
                      <td colSpan={currentUser.role === 'Admin' ? 7 : 6} className="py-20 text-center text-slate-400 bg-slate-50/30 rounded-3xl">
                        <History size={48} className="mx-auto mb-4 opacity-10" />
                        <p className="text-sm font-black text-slate-500">No employment history found.</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Maintenance records will appear here</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {history.length > 0 && (
              <div className="pt-6 border-t border-slate-50 flex items-center justify-between bg-slate-50/50 p-6 -mx-8 -mb-8 rounded-b-3xl">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <History size={24} />
                   </div>
                   <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Cumulative Service</p>
                    <p className="text-xl font-black text-slate-900">
                      {(() => {
                        let totalDays = 0;
                        history.forEach(h => {
                          const j = new Date(h.joinDate);
                          const l = h.leaveDate ? new Date(h.leaveDate) : new Date();
                          totalDays += Math.ceil(Math.abs(l.getTime() - j.getTime()) / (1000 * 60 * 60 * 24));
                        });
                        const y = Math.floor(totalDays / 365);
                        const m = Math.floor((totalDays % 365) / 30.44);
                        const d = Math.floor((totalDays % 365) % 30.44);
                        return `${y > 0 ? `${y}y ` : ''}${m > 0 ? `${m}m ` : ''}${d}d`;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Cycles</p>
                  <p className="text-sm font-black text-slate-900">{history.length} Distinct Period{history.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Completed</p>
              </div>
              <p className="text-3xl font-black text-slate-900">{stats.completed}</p>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Tasks Finished</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <TrendingUp size={20} />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">In Progress</p>
              </div>
              <p className="text-3xl font-black text-slate-900">{stats.inProgress}</p>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Active Tasks</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Target size={20} />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Efficiency</p>
              </div>
              <p className="text-3xl font-black text-slate-900">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </p>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Success Rate</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Briefcase size={20} className="text-indigo-600" />
                Assigned Tasks
              </h3>
              <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-100">
                {tasks.length} Total
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {tasks.map((task) => (
                <div key={task.id} className="p-6 hover:bg-slate-50 transition-all group flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all",
                      task.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                    )}>
                      {task.status === 'completed' ? <CheckCircle2 size={24} /> : <Briefcase size={24} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{task.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{task.serviceType}</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={12} />
                          Due {task.dueDate}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase border tracking-wider",
                    task.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                    task.status === 'in_progress' ? "bg-blue-50 text-blue-700 border-blue-100" :
                    "bg-amber-50 text-amber-700 border-amber-100"
                  )}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="py-20 text-center text-slate-400">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Briefcase size={32} />
                  </div>
                  <p className="text-sm italic">No tasks assigned to this employee yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <FloatingActionBar 
        isVisible={isEditing}
        onSave={handleSave}
        onCancel={() => {
          setIsEditing(false);
          setEditData(employee);
        }}
        isSaving={isSaving}
      />

      {/* Rejoining Modal */}
      <Modal
        isOpen={isRejoiningModalOpen}
        onClose={() => setIsRejoiningModalOpen(false)}
        title="Employee Rejoining"
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          handleRejoinEmployment({
            joinDate: formData.get('joinDate') as string,
            reason: formData.get('reason') as string,
            notes: formData.get('notes') as string
          });
        }} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Rejoining Date</label>
              <input 
                name="joinDate"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Reason</label>
              <select 
                name="reason"
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              >
                <option value="Rejoined">Rejoined</option>
                <option value="First Join">First Join (Manual Correction)</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Notes (Optional)</label>
            <textarea 
              name="notes"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium h-24 resize-none"
              placeholder="Add any specific notes about the rejoining..."
            />
          </div>
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => setIsRejoiningModalOpen(false)}
              className="flex-1 p-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isRehiring}
              className="flex-1 p-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              {isRehiring ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              Confirm Rejoining
            </button>
          </div>
        </form>
      </Modal>

      {/* Closing Employment Modal */}
      <Modal
        isOpen={isClosingModalOpen}
        onClose={() => setIsClosingModalOpen(false)}
        title="Close Employment"
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          handleCloseEmployment({
            leaveDate: formData.get('leaveDate') as string,
            reason: formData.get('reason') as string,
            notes: formData.get('notes') as string
          });
        }} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Last Working Day</label>
              <input 
                name="leaveDate"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Reason for Leaving</label>
              <select 
                name="reason"
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              >
                <option value="Resigned">Resigned</option>
                <option value="Terminated">Terminated</option>
                <option value="Contract End">Contract End</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Leaving Notes</label>
            <textarea 
              name="notes"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium h-24 resize-none"
              placeholder="Details about the resignation/termination..."
            />
          </div>
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => setIsClosingModalOpen(false)}
              className="flex-1 p-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isRehiring}
              className="flex-1 p-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2"
            >
              {isRehiring ? <Loader2 className="animate-spin" size={18} /> : <X size={18} />}
              Close Employment
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Employment History Modal */}
      <Modal
        isOpen={isEditHistoryModalOpen}
        onClose={() => {
          setIsEditHistoryModalOpen(false);
          setSelectedHistoryRecord(null);
          setIsConfirmingDeleteHistory(false);
        }}
        title="Edit Employment Record"
      >
        {selectedHistoryRecord && (
          <form 
            key={selectedHistoryRecord.id}
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleUpdateHistoryRecord(selectedHistoryRecord.id, {
                joinDate: formData.get('joinDate') as string,
                leaveDate: (formData.get('leaveDate') as string) || null,
                status: formData.get('status') as 'Active' | 'Closed',
                reason: formData.get('reason') as any,
                notes: formData.get('notes') as string
              });
            }} 
            className="p-6 space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Join Date</label>
                <input 
                  name="joinDate"
                  type="date"
                  required
                  defaultValue={selectedHistoryRecord.joinDate}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Leave Date</label>
                <input 
                  name="leaveDate"
                  type="date"
                  defaultValue={selectedHistoryRecord.leaveDate || ''}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                <select 
                  name="status"
                  required
                  defaultValue={selectedHistoryRecord.status}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900"
                >
                  <option value="Active">Active</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Reason</label>
                <select 
                  name="reason"
                  required
                  defaultValue={selectedHistoryRecord.reason}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900"
                >
                  <option value="First Join">First Join</option>
                  <option value="Rejoined">Rejoined</option>
                  <option value="Resigned">Resigned</option>
                  <option value="Terminated">Terminated</option>
                  <option value="Contract End">Contract End</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Notes</label>
              <textarea 
                name="notes"
                defaultValue={selectedHistoryRecord.notes || ''}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium h-24 resize-none text-slate-900"
                placeholder="Details about this employment cycle..."
              />
            </div>

            <div className="flex gap-3">
              {currentUser.role === 'Admin' && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!isConfirmingDeleteHistory) {
                      setIsConfirmingDeleteHistory(true);
                    } else {
                      const success = await handleDeleteHistoryRecord(selectedHistoryRecord.id, true);
                      if (success) {
                        setIsEditHistoryModalOpen(false);
                        setSelectedHistoryRecord(null);
                        setIsConfirmingDeleteHistory(false);
                      }
                    }
                  }}
                  disabled={isSaving}
                  className={`px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border ${
                    isConfirmingDeleteHistory 
                      ? "bg-rose-600 text-white hover:bg-rose-700 border-rose-600 shadow-lg shadow-rose-500/20" 
                      : "bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-100"
                  }`}
                >
                  <Trash2 size={18} />
                  {isConfirmingDeleteHistory ? "Confirm Delete?" : "Delete"}
                </button>
              )}
              <button 
                type="button"
                onClick={() => {
                  setIsEditHistoryModalOpen(false);
                  setSelectedHistoryRecord(null);
                  setIsConfirmingDeleteHistory(false);
                }}
                className="flex-1 p-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-center"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSaving}
                className="flex-1 p-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>
    </motion.div>
  );
};
