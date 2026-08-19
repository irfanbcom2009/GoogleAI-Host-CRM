import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Activity,
  Plus,
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  User as UserIcon,
  DollarSign,
  ArrowRight,
  Send,
  MessageSquare,
  History,
  Trash2,
  FileText,
  Package
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, moveToTrash } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, getDocs, where, deleteDoc } from 'firebase/firestore';
import { User, WorkflowMainTask, WorkflowSubTask, Client, ServiceTemplate } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from './Modal';
import { ServiceFlowForm } from './ServiceFlowForm';
import { ServiceOnboardingFlow } from './ServiceOnboardingFlow';
import { SERVICE_TEMPLATES } from '../constants/serviceTemplates';

interface WorkflowHubProps {
  currentUser: User;
  activeSection?: string;
}

export const WorkflowHub: React.FC<WorkflowHubProps> = ({ currentUser, activeSection: externalSection }) => {
  const [activeTab, setActiveTab] = useState(externalSection || 'dashboard');
  const [tasks, setTasks] = useState<WorkflowMainTask[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [newTask, setNewTask] = useState<Partial<WorkflowMainTask>>({
    title: '',
    clientId: '',
    clientName: '',
    clientInstructions: '',
    employeeInstructions: '',
    subTasks: [],
    status: 'Pending',
    totalPrice: 0,
    progress: 0
  });

  useEffect(() => {
    const unsubTasks = onSnapshot(
      query(collection(db, 'workflow_tasks'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowMainTask)));
      }
    );

    const unsubEmployees = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'Employee')),
      (snapshot) => {
        setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      }
    );

    const unsubClients = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'Client')),
      (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      }
    );

    return () => {
      unsubTasks();
      unsubEmployees();
      unsubClients();
    };
  }, []);

  const handleCreateTaskData = async (taskData: Partial<WorkflowMainTask>) => {
    setIsSubmitting(true);
    try {
      const finalTaskData: any = {
        ...taskData,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        activityLog: [{
          timestamp: new Date().toISOString(),
          user: currentUser.name,
          action: 'Task Created',
          details: `Order for ${taskData.title} initialized with mode: ${taskData.userSelectionMode}.`
        }]
      };

      await addDoc(collection(db, 'workflow_tasks'), finalTaskData);
      setIsCreateModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'workflow_tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSubTask = () => {
    const subTask: WorkflowSubTask = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      description: '',
      assignedEmployeeId: '',
      assignedEmployeeName: '',
      price: 0,
      status: 'Pending',
      updatedAt: new Date().toISOString()
    };
    setNewTask(prev => ({
      ...prev,
      subTasks: [...(prev.subTasks || []), subTask]
    }));
  };

  const updateSubTask = (id: string, updates: Partial<WorkflowSubTask>) => {
    setNewTask(prev => ({
      ...prev,
      subTasks: prev.subTasks?.map(st => {
        if (st.id === id) {
          const emp = employees.find(e => e.id === updates.assignedEmployeeId);
          return { 
            ...st, 
            ...updates, 
            assignedEmployeeName: emp?.name || st.assignedEmployeeName 
          };
        }
        return st;
      })
    }));
  };

  const removeSubTask = (id: string) => {
    setNewTask(prev => ({
      ...prev,
      subTasks: prev.subTasks?.filter(st => st.id !== id)
    }));
  };

  const updateMainTaskStatus = async (taskId: string, newStatus: WorkflowMainTask['status']) => {
    try {
      await updateDoc(doc(db, 'workflow_tasks', taskId), {
        status: newStatus,
        activityLog: [
          ...tasks.find(t => t.id === taskId)?.activityLog || [],
          {
            timestamp: new Date().toISOString(),
            user: currentUser.name,
            action: 'Status Updated',
            details: `Main task status changed to ${newStatus}`
          }
        ]
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, 'workflow_tasks');
    }
  };

  const updateSubTaskStatus = async (taskId: string, subTaskId: string, newStatus: WorkflowSubTask['status']) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedSubTasks = task.subTasks.map(st => {
      if (st.id === subTaskId) {
        return { ...st, status: newStatus, updatedAt: new Date().toISOString() };
      }
      return st;
    });

    const completedCount = updatedSubTasks.filter(st => st.status === 'Completed').length;
    const progress = Math.round((completedCount / updatedSubTasks.length) * 100);
    const overallStatus = progress === 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Pending';

    try {
      await updateDoc(doc(db, 'workflow_tasks', taskId), {
        subTasks: updatedSubTasks,
        progress,
        status: overallStatus,
        activityLog: [
          ...task.activityLog,
          {
            timestamp: new Date().toISOString(),
            user: currentUser.name,
            action: 'Sub-task Updated',
            details: `Sub-task "${updatedSubTasks.find(st => st.id === subTaskId)?.name}" marked as ${newStatus}`
          }
        ]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'workflow_tasks');
    }
  };

  const forwardSubTask = async (taskId: string, subTaskId: string, newEmployeeId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const emp = employees.find(e => e.id === newEmployeeId);
    if (!emp) return;

    const updatedSubTasks = task.subTasks.map(st => {
      if (st.id === subTaskId) {
        return { ...st, assignedEmployeeId: emp.id, assignedEmployeeName: emp.name, updatedAt: new Date().toISOString() };
      }
      return st;
    });

    try {
      await updateDoc(doc(db, 'workflow_tasks', taskId), {
        subTasks: updatedSubTasks,
        activityLog: [
          ...task.activityLog,
          {
            timestamp: new Date().toISOString(),
            user: currentUser.name,
            action: 'Sub-task Forwarded',
            details: `Sub-task forwarded to ${emp.name}`
          }
        ]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'workflow_tasks');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to move this task to trash?')) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      await moveToTrash('workflow_tasks', taskId, task, currentUser.name);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'workflow_tasks');
    }
  };

  const renderDashboard = () => {
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'Pending').length,
      inProgress: tasks.filter(t => t.status === 'In Progress').length,
      completed: tasks.filter(t => t.status === 'Completed').length,
    };

    const userTasks = currentUser.role === 'Employee' 
      ? tasks.filter(t => t.subTasks.some(st => st.assignedEmployeeId === currentUser.id))
      : currentUser.role === 'Client'
      ? tasks.filter(t => t.clientId === currentUser.id)
      : tasks;

    return (
      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Total Orders', value: stats.total, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'In Progress', value: stats.inProgress, icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((stat, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
                <stat.icon className={stat.color} size={24} />
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{stat.value}</h3>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Recent Activity</h3>
              <Activity size={18} className="text-slate-400" />
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {tasks.flatMap(t => t.activityLog).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5).map((log, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                      <History size={18} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{log.action}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{log.details}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{log.user}</span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Critical Tasks</h3>
              <AlertCircle size={18} className="text-rose-500" />
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {userTasks.filter(t => t.status !== 'Completed').slice(0, 4).map((task) => (
                  <div key={task.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-indigo-200 transition-all cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <Briefcase size={18} className="text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{task.title}</h4>
                        <p className="text-xs text-slate-500">{task.clientName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-indigo-600">{task.progress}%</div>
                      <div className="w-20 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${task.progress}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOrders = () => {
    const filteredTasks = tasks.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search orders, clients..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
              value={searchQuery || ''}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
             {currentUser.role !== 'Employee' && (
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                <Plus size={20} />
                Create Order
              </button>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredTasks.map((task) => (
            <motion.div 
              layout
              key={task.id}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                    <Briefcase size={22} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 lowercase first-letter:uppercase">{task.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <UserIcon size={14} />
                        {task.clientName}
                      </span>
                      <span className="text-[10px] text-slate-300">|</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                        task.userSelectionMode === 'need' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        task.userSelectionMode === 'already_have' ? "bg-blue-50 text-blue-600 border-blue-100" :
                        "bg-amber-50 text-amber-600 border-amber-100"
                      )}>
                        {task.userSelectionMode?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Price</p>
                    <p className="text-sm font-black text-emerald-600">${task.totalPrice}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600" style={{ width: `${task.progress}%` }} />
                      </div>
                      <span className="text-sm font-black text-slate-900">{task.progress}%</span>
                    </div>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border",
                    task.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                    task.status === 'In Progress' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                    "bg-slate-50 text-slate-700 border-slate-100"
                  )}>
                    {task.status}
                  </div>
                  {currentUser.role === 'Admin' && (
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 divide-x divide-slate-50 border-t border-slate-50">
                <div className="p-6 space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <FileText size={16} className="text-amber-500" />
                      Client Requirements
                    </h4>
                    <div className="space-y-2">
                      {task.requirements?.map((req, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-xs font-bold text-slate-700">{req.label}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border",
                            req.status === 'Received' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            req.status === 'Rejected' ? "bg-rose-50 text-rose-600 border-rose-100" :
                            "bg-amber-50 text-amber-600 border-amber-100"
                          )}>
                            {req.status}
                          </span>
                        </div>
                      ))}
                      {(!task.requirements || task.requirements.length === 0) && (
                        <p className="text-[10px] text-slate-400 font-bold italic">No specific requirements tracked.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Package size={16} className="text-emerald-500" />
                      Delivery Progress
                    </h4>
                    <div className="space-y-2">
                      {task.deliverables?.map((del, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-xs font-bold text-slate-700">{del.label}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border",
                            del.status === 'Delivered' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            "bg-slate-200 text-slate-500 border-slate-300"
                          )}>
                            {del.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MessageSquare size={16} />
                    Instructions & Context
                  </h4>
                  <div className="space-y-4">
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Client Required</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.clientInstructions || 'No instructions provided.'}</p>
                    </div>
                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Internal Instructions</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.employeeInstructions || 'No instructions provided.'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50/30">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <LayoutDashboard size={16} />
                    Sub-tasks Workflow
                  </h4>
                  <div className="space-y-3">
                    {task.subTasks.map((st) => {
                      const isAssignedToUser = st.assignedEmployeeId === currentUser.id;
                      const canManage = currentUser.role === 'Admin' || currentUser.role === 'Manager' || isAssignedToUser;

                      return (
                        <div key={st.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2",
                              st.status === 'Completed' ? "bg-emerald-500 border-emerald-500 text-white" :
                              st.status === 'In Progress' ? "bg-indigo-50 color-indigo-600 border-indigo-200 animate-pulse" :
                              "bg-slate-50 border-slate-200"
                            )}>
                              {st.status === 'Completed' ? <CheckCircle2 size={16} /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                            </div>
                            <div>
                              <h5 className={cn("text-sm font-bold", st.status === 'Completed' ? "text-slate-400 line-through" : "text-slate-900")}>
                                {st.name}
                              </h5>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{st.assignedEmployeeName}</span>
                                <span className="text-[10px] text-slate-300">•</span>
                                <span className="text-[10px] text-slate-400 font-bold">${st.price}</span>
                                <span className="text-[10px] text-slate-300">•</span>
                                <span className="text-[10px] text-slate-400 uppercase">{st.status}</span>
                              </div>
                            </div>
                          </div>

                          {canManage && (
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              {st.status !== 'Completed' && (
                                <>
                                  <button 
                                    onClick={() => updateSubTaskStatus(task.id, st.id, st.status === 'Pending' ? 'In Progress' : 'Completed')}
                                    className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-100"
                                  >
                                    {st.status === 'Pending' ? 'Start' : 'Done'}
                                  </button>
                                  {(currentUser.role === 'Admin' || isAssignedToUser) && (
                                    <div className="relative group/forward">
                                      <button className="p-1 px-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase hover:bg-slate-200">
                                        Forward
                                      </button>
                                      <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-10 hidden group-hover/forward:block">
                                        <div className="p-2 space-y-1">
                                          {employees.filter(e => e.id !== st.assignedEmployeeId).map(e => (
                                            <button 
                                              key={e.id}
                                              onClick={() => forwardSubTask(task.id, st.id, e.id)}
                                              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700"
                                            >
                                              {e.name}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  const renderLogs = () => {
    const allLogs = tasks.flatMap(t => t.activityLog.map(l => ({ ...l, taskTitle: t.title })))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
      <div className="p-8">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {allLogs.map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-slate-900">{new Date(log.timestamp).toLocaleTimeString()}</div>
                    <div className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-indigo-600 uppercase">{(log as any).taskTitle}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                        <UserIcon size={12} className="text-slate-400" />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{log.user}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black uppercase text-slate-600">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTeam = () => {
    return (
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {employees.map((emp) => {
            const activeEffort = tasks.filter(t => t.subTasks.some(st => st.assignedEmployeeId === emp.id && st.status !== 'Completed')).length;
            return (
              <div key={emp.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  {emp.photoURL ? (
                    <img src={emp.photoURL} alt={emp.name} className="w-16 h-16 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <UserIcon size={32} className="text-indigo-600" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{emp.name}</h3>
                    <p className="text-xs text-indigo-600 font-black uppercase tracking-widest">{emp.department || 'Employee'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Orders</p>
                    <p className="text-xl font-black text-slate-900 mt-1">{activeEffort}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Points earned</p>
                    <p className="text-xl font-black text-emerald-600 mt-1">{emp.points?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                <Activity size={24} />
              </div>
              Flow-Control Engine
            </h1>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">Enterprise Workflow Management</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'onboarding', label: 'Onboarding', icon: Send },
              { id: 'orders', label: 'Orders & Tasks', icon: Briefcase },
              { id: 'team', label: 'Team', icon: Users },
              { id: 'logs', label: 'Activity Logs', icon: Activity },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    isActive 
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-100" 
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'onboarding' && <ServiceOnboardingFlow />}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'team' && renderTeam()}
            {activeTab === 'logs' && renderLogs()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Create Order Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Initialize Flow-Control Engine Order"
        maxWidth="5xl"
      >
        <ServiceFlowForm 
          clients={clients}
          employees={employees}
          currentUser={currentUser}
          isSubmitting={isSubmitting}
          onSuccess={handleCreateTaskData}
        />
      </Modal>
    </div>
  );
};
