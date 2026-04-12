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
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { User as CRMUser, Task, UserRole } from '../types';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Modal } from './Modal';
import { EmployeeEditForm } from './EmployeeEditForm';

interface EmployeeDetailProps {
  employee: CRMUser;
  onBack: () => void;
  currentUser: CRMUser;
  onImpersonate?: (user: { id: string, role: UserRole, name: string, email: string }) => void;
}

export const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ employee, onBack, currentUser, onImpersonate }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingPortal, setIsUpdatingPortal] = useState(false);
  const [isRehiring, setIsRehiring] = useState(false);

  const handleRehire = async () => {
    if (!window.confirm('Are you sure you want to rehire this employee? This will clear the ending date and set a new joining date to today.')) return;
    setIsRehiring(true);
    try {
      await updateDoc(doc(db, 'users', employee.id), {
        endingDate: '',
        joiningDate: new Date().toISOString().split('T')[0],
        remarks: (employee.remarks || '') + `\n[Rehired on ${new Date().toLocaleDateString()}]`
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsRehiring(false);
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
      className="p-8 space-y-8 max-w-7xl mx-auto"
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

        <button 
          onClick={() => setIsEditModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
        >
          <Edit size={18} />
          Edit Profile
        </button>

        <Modal 
          isOpen={isEditModalOpen} 
          onClose={() => setIsEditModalOpen(false)} 
          title="Edit Employee Profile"
          maxWidth="4xl"
        >
          <EmployeeEditForm employee={employee} onClose={() => setIsEditModalOpen(false)} />
        </Modal>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-6">
            <div className="relative inline-block">
              <img 
                src={employee.attachments?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${employee.name}`} 
                className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-xl mx-auto object-cover" 
                alt={employee.name} 
              />
              <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg border-2 border-white">
                <Trophy size={20} />
              </div>
            </div>
            
            <div>
              <h1 className="text-2xl font-black text-slate-900 break-words">{employee.name}</h1>
              <p className="text-slate-500 flex items-center justify-center gap-1 mt-1 break-all">
                <Mail size={14} />
                {employee.email}
              </p>
              {employee.employeeId && (
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-2 bg-indigo-50 px-2 py-1 rounded-full inline-block">
                  ID: {employee.employeeId}
                </p>
              )}
            </div>

            <div className="flex justify-center gap-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider",
                employee.role === 'Manager' ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
              )}>
                {employee.role}
              </span>
              {employee.modeOfWorking && (
                <span className="px-3 py-1 rounded-full text-xs font-bold border border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider">
                  {employee.modeOfWorking}
                </span>
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
                  disabled={isUpdatingPortal}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    employee.portalEnabled ? "bg-indigo-600" : "bg-slate-200"
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

              {employee.endingDate && (currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                <button 
                  onClick={handleRehire}
                  disabled={isRehiring}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 font-bold text-xs hover:bg-emerald-100 transition-all"
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
              {!employee.attachments?.cv && !employee.attachments?.cnicScanned && (
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
                      <p className="text-sm font-bold text-slate-900">{employee.department || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Target size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assignments</p>
                      <p className="text-sm font-bold text-slate-900">{employee.assignments || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <GraduationCap size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qualification</p>
                      <p className="text-sm font-bold text-slate-900">{employee.qualification || 'N/A'}</p>
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
                      <p className="text-sm font-bold text-slate-900">{employee.joiningDate || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ending Date</p>
                      <p className="text-sm font-bold text-slate-900">{employee.endingDate || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Experience</p>
                      <p className="text-sm font-bold text-slate-900">{employee.experience || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gender</p>
                      <p className="text-sm font-bold text-slate-900">{employee.gender || 'N/A'}</p>
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
                      <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{employee.officialMail || 'N/A'}</p>
                    </div>
                  </div>
                  {employee.officialMailPassword && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                        <Lock size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mail Password</p>
                        <p className="text-sm font-bold text-slate-900">{employee.officialMailPassword}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personal Email</p>
                      <p className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{employee.personalEmail || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Hash size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CNIC</p>
                      <p className="text-sm font-bold text-slate-900">{employee.cnic || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <MessageSquare size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WhatsApp</p>
                      <p className="text-sm font-bold text-slate-900">{employee.whatsappPersonal || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                      <Phone size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Home Phone</p>
                      <p className="text-sm font-bold text-slate-900">{employee.homePhone || 'N/A'}</p>
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
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Home Address</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{employee.address || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                    <FileText size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remarks</p>
                    <p className="text-sm text-slate-600 leading-relaxed italic">"{employee.remarks || 'No remarks provided.'}"</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">PC Details</h4>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white text-slate-400 rounded-lg shadow-sm">
                    <Monitor size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PC Allotted</p>
                    <p className="text-sm font-bold text-slate-900">{employee.pcAllotted || 'N/A'}</p>
                  </div>
                </div>
                {employee.pcUsername && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white text-slate-400 rounded-lg shadow-sm">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PC Username</p>
                      <p className="text-sm font-bold text-slate-900">{employee.pcUsername}</p>
                    </div>
                  </div>
                )}
                {employee.pcPassword && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white text-slate-400 rounded-lg shadow-sm">
                      <Lock size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PC Password</p>
                      <p className="text-sm font-bold text-slate-900">{employee.pcPassword}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
    </motion.div>
  );
};
