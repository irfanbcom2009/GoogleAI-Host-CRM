import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MoreHorizontal, 
  Search,
  User,
  Calendar,
  Trophy,
  Loader2,
  MessageSquare,
  Eye,
  EyeOff,
  Flag,
  ChevronRight,
  Trash2,
  X,
  Send,
  Download,
  Pause,
  Play,
  FileSpreadsheet,
  LayoutList,
  LayoutGrid,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Client, User as CRMUser, TaskStatus, TaskPriority, TaskComment, Domain, Journal, TaskLog } from '../types';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType, auth, moveToTrash } from '../lib/firebase';
import { pointsService } from '../services/pointsService';
import { geminiService } from '../services/geminiService';
import { financeService } from '../services/financeService';
import { InvoiceItem, Invoice, SubTask } from '../types';
import { Sparkles } from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, updateDoc, doc, getDoc, where } from 'firebase/firestore';
import { Modal } from './Modal';
import { ClientDetail } from './ClientDetail';
import { EmployeeDetail } from './EmployeeDetail';

import { ColumnSelector } from './ColumnSelector';
import { usePermissions } from '../hooks/usePermissions';
import { KanbanBoard } from './KanbanBoard';

interface TasksProps {
  searchQuery: string;
  currentUser: CRMUser;
}

const AVAILABLE_COLUMNS = [
  { id: 'title', label: 'Task & Service' },
  { id: 'serviceType', label: 'Service Type' },
  { id: 'client', label: 'Client' },
  { id: 'department', label: 'Department' },
  { id: 'assignedTo', label: 'Assigned To' },
  { id: 'priority', label: 'Priority' },
  { id: 'status', label: 'Status' },
  { id: 'price', label: 'Price' },
  { id: 'points', label: 'Points' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'isClientVisible', label: 'Client Visible' },
  { id: 'createdAt', label: 'Created At' },
  { id: 'completedAt', label: 'Completed At' },
];

export const Tasks: React.FC<TasksProps> = ({ searchQuery, currentUser }) => {
  const { check } = usePermissions(currentUser);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<CRMUser | null>(null);
  const [clientServices, setClientServices] = useState<{ domains: Domain[], journals: Journal[] }>({ domains: [], journals: [] });
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [viewScope, setViewScope] = useState<'all' | 'today' | 'overdue'>('all');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');

  useEffect(() => {
    if (!selectedTask) {
      setTaskLogs([]);
      return;
    }

    const q = query(
      collection(db, 'task_logs'),
      where('taskId', '==', selectedTask.id),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTaskLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskLog)));
    });

    return () => unsubscribe();
  }, [selectedTask?.id]);

  useEffect(() => {
    if (currentUser.role !== 'Client') return;

    const unsubDomains = onSnapshot(
      query(collection(db, 'domains'), where('clientId', '==', currentUser.id)),
      (snapshot) => {
        const domains = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Domain));
        setClientServices(prev => ({ ...prev, domains }));
      }
    );

    const unsubJournals = onSnapshot(
      query(collection(db, 'journals'), where('clientId', '==', currentUser.id)),
      (snapshot) => {
        const journals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal));
        setClientServices(prev => ({ ...prev, journals }));
      }
    );

    return () => {
      unsubDomains();
      unsubJournals();
    };
  }, [currentUser.id, currentUser.role]);

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['tasks'] || AVAILABLE_COLUMNS.map(c => c.id)
  );
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'createdAt', direction: 'desc' });

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.tasks`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  // Form state
  const [newTask, setNewTask] = useState({
    clientId: '',
    journalId: '',
    domainId: '',
    serviceType: 'Hosting' as any,
    title: '',
    description: '',
    department: 'General' as any,
    assignedTo: '',
    status: 'pending' as TaskStatus,
    priority: 'medium' as TaskPriority,
    points: 0,
    dueDate: '',
    isClientVisible: true,
    estimatedTimeMinutes: 0,
    price: 0,
    subTasks: [] as SubTask[]
  });

  useEffect(() => {
    let q;
    if (currentUser.role === 'Client') {
      q = query(
        collection(db, 'tasks'), 
        where('clientId', '==', currentUser.id),
        where('isClientVisible', '==', true),
        orderBy('createdAt', 'desc')
      );
    } else if (currentUser.role === 'Employee') {
      q = query(
        collection(db, 'tasks'), 
        where('assignedTo', '==', currentUser.id),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    }

    const unsubscribeTasks = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(taskData);
      setLoading(false);
    }, (error) => {
      console.error('Tasks fetch error:', error);
      // Fallback for missing index
      if (currentUser.role === 'Client') {
        const simpleQ = query(collection(db, 'tasks'), where('clientId', '==', currentUser.id));
        onSnapshot(simpleQ, (snapshot) => {
          const taskData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Task[];
          setTasks(taskData.filter(t => t.isClientVisible).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          setLoading(false);
        });
      } else {
        handleFirestoreError(error, OperationType.LIST, 'tasks');
        setLoading(false);
      }
    });

    const unsubscribeClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snapshot) => {
      const clientData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CRMUser[];
      setUsers(userData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      setJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal)));
    });

    const unsubscribeDomains = onSnapshot(collection(db, 'domains'), (snapshot) => {
      setDomains(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Domain)));
    });

    return () => {
      unsubscribeTasks();
      unsubscribeClients();
      unsubscribeUsers();
      unsubscribeJournals();
      unsubscribeDomains();
    };
  }, []);

  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  const handleAiSuggestDescription = async () => {
    if (!newTask.title) return;
    setIsAiSuggesting(true);
    const response = await geminiService.generateTaskDescription(newTask.title, newTask.serviceType);
    if (response) {
      setNewTask(prev => ({ ...prev, description: response }));
    }
    setIsAiSuggesting(false);
  };

  const filteredTasks = tasks.filter(task => {
    const client = clients.find(c => c.id === task.clientId);
    const assignedUser = users.find(u => u.id === task.assignedTo);
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         assignedUser?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;

    // View Scope Logic
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const dueDate = task.dueDate;
    
    let matchesScope = true;
    if (viewScope === 'today') {
      matchesScope = dueDate === todayStr || (task.status === 'in_progress');
    } else if (viewScope === 'overdue') {
      matchesScope = dueDate < todayStr && task.status !== 'completed';
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesScope;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    
    let aValue: any = a[sortConfig.key as keyof Task];
    let bValue: any = b[sortConfig.key as keyof Task];

    if (sortConfig.key === 'client') {
      const clientA = clients.find(c => c.id === a.clientId);
      const clientB = clients.find(c => c.id === b.clientId);
      aValue = clientA?.name || '';
      bValue = clientB?.name || '';
    }

    if (sortConfig.key === 'assignedTo') {
      const userA = users.find(u => u.id === a.assignedTo);
      const userB = users.find(u => u.id === b.assignedTo);
      aValue = userA?.name || '';
      bValue = userB?.name || '';
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

  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Are you sure you want to move this task to trash?`)) return;
    try {
      await moveToTrash('tasks', task.id, task, currentUser.name);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tasks');
    }
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    if (currentUser.role === 'Client') {
      const isSubscribed = (type: string) => {
        if (type === 'Domain') {
          return clientServices.domains.some(d => d.isSubscribed);
        }
        if (['ISSN', 'OJS', 'Editorial', 'Indexing', 'Publisher'].includes(type)) {
          return clientServices.journals.some(j => j.isSubscribed);
        }
        if (type === 'Hosting' || type === 'DOI') {
          // These are usually linked to journals or domains
          return clientServices.journals.some(j => j.isSubscribed) || clientServices.domains.some(d => d.isSubscribed);
        }
        return false;
      };

      if (!isSubscribed(newTask.serviceType)) {
        alert(`You are not officially subscribed to ${newTask.serviceType} services. Please subscribe to enable support tickets for this service.`);
        return;
      }
    }

    try {
      const assignedUser = users.find(u => u.id === newTask.assignedTo);
      const client = clients.find(c => c.id === newTask.clientId);
      
      // Calculate expected completion
      let expectedCompletionDate = newTask.dueDate;
      if (newTask.estimatedTimeMinutes) {
        const today = new Date();
        const daysNeeded = Math.ceil(newTask.estimatedTimeMinutes / 480); // Assuming 8h work day
        today.setDate(today.getDate() + daysNeeded);
        expectedCompletionDate = today.toISOString().split('T')[0];
      }

      if (newTask.price > 0 && newTask.clientId) {
        try {
          await addDoc(collection(db, 'taskCosts'), {
            taskTitle: newTask.title,
            clientId: newTask.clientId,
            clientName: client?.name || 'Unknown Client',
            assignedEmployeeId: newTask.assignedTo,
            costAmount: newTask.price,
            costDate: new Date().toISOString().split('T')[0],
            category: 'Task Execution Fee',
            notes: `Auto-logged cost for Task: ${newTask.title}`,
            createdAt: new Date().toISOString(),
            createdBy: currentUser.id
          });
        } catch (err) {
          console.error("Failed to auto-log task cost:", err);
        }
      }

      await addDoc(collection(db, 'tasks'), {
        ...newTask,
        assignedToName: assignedUser?.name || 'Unassigned',
        clientName: client?.name || 'Unknown Client',
        expectedCompletionDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        timeLogs: []
      });

      // Deduct points from client if it's a client-driven request or reassignment
      if (currentUser.role === 'Client') {
        await pointsService.deductClientPoints(
          currentUser.id,
          currentUser.name,
          20, // Base penalty for client-initiated task/support
          `Support Ticket/Task Creation: ${newTask.title}`,
          { performedById: currentUser.id, performedByName: currentUser.name }
        );
      }

      setIsModalOpen(false);
      setNewTask({
        clientId: '',
        journalId: '',
        domainId: '',
        serviceType: 'Hosting',
        title: '',
        description: '',
        department: 'General',
        assignedTo: '',
        status: 'pending',
        priority: 'medium',
        points: 0,
        dueDate: '',
        isClientVisible: true,
        estimatedTimeMinutes: 0,
        price: 0,
        subTasks: []
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  const logTaskAction = async (taskId: string, action: TaskLog['action'], details?: string) => {
    try {
      await addDoc(collection(db, 'task_logs'), {
        taskId,
        action,
        by: currentUser.id,
        userName: currentUser.name,
        timestamp: serverTimestamp(),
        details
      });
    } catch (error) {
      console.error('Error logging task action:', error);
    }
  };

  const isSubTaskVisible = (subTask: any, role: string) => {
    if (role === 'Admin') return true;
    if (!subTask.visibility || subTask.visibility === 'all') return true;
    if (subTask.visibility === 'client' && role === 'Client') return true;
    if (subTask.visibility === 'employee' && role === 'Employee') return true;
    if (subTask.visibility === 'admin' && role === 'Admin') return true;
    return false;
  };

  const handleToggleSubTaskStatus = async (taskId: string, subTaskId: string) => {
    if (!selectedTask) return;
    const currentSubTasks = selectedTask.subTasks || [];
    const updatedSubTasks: SubTask[] = currentSubTasks.map(st => {
      if (st.id === subTaskId) {
        return { ...st, status: st.status === 'completed' ? 'pending' : 'completed' };
      }
      return st;
    });

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        subTasks: updatedSubTasks,
        updatedAt: serverTimestamp()
      });
      setSelectedTask(prev => prev ? { ...prev, subTasks: updatedSubTasks } : null);
    } catch (err) {
      console.error("Error toggling subtask status:", err);
    }
  };

  const handleAddSubTaskToExisting = async (taskId: string, title: string, visibility: any) => {
    if (!selectedTask || !title.trim()) return;
    const newSt: SubTask = {
      id: crypto.randomUUID(),
      title: title.trim(),
      status: 'pending',
      visibility
    };

    const updatedSubTasks = [...(selectedTask.subTasks || []), newSt];

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        subTasks: updatedSubTasks,
        updatedAt: serverTimestamp()
      });
      setSelectedTask(prev => prev ? { ...prev, subTasks: updatedSubTasks } : null);
    } catch (err) {
      console.error("Error adding subtask to task:", err);
    }
  };

  const handleRemoveSubTaskFromExisting = async (taskId: string, subTaskId: string) => {
    if (!selectedTask) return;
    const updatedSubTasks = (selectedTask.subTasks || []).filter(st => st.id !== subTaskId);

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        subTasks: updatedSubTasks,
        updatedAt: serverTimestamp()
      });
      setSelectedTask(prev => prev ? { ...prev, subTasks: updatedSubTasks } : null);
    } catch (err) {
      console.error("Error removing subtask from task:", err);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus, details?: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const updateData: any = { 
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      const now = new Date();
      const timeLogs = task.timeLogs || [];

      if (newStatus === 'in_progress' && task.status !== 'in_progress') {
        updateData.startedAt = serverTimestamp();
        timeLogs.push({
          action: 'start',
          timestamp: now.toISOString(),
          userId: currentUser.id,
          userName: currentUser.name
        });
      }

      if (newStatus === 'completed' && task.status !== 'completed') {
        updateData.completedAt = serverTimestamp();
        timeLogs.push({
          action: 'complete',
          timestamp: now.toISOString(),
          userId: currentUser.id,
          userName: currentUser.name
        });

        // Calculate actual time based on logs
        let totalMs = 0;
        let lastStart: number | null = null;
        
        [...timeLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).forEach(log => {
          if (log.action === 'start' || log.action === 'resume') {
            lastStart = new Date(log.timestamp).getTime();
          } else if ((log.action === 'pause' || log.action === 'complete') && lastStart) {
            totalMs += (new Date(log.timestamp).getTime() - lastStart);
            lastStart = null;
          }
        });
        
        updateData.actualTimeMinutes = Math.round(totalMs / 60000);

        if (task.assignedTo) {
          await pointsService.awardEmployeePoints(
            task.assignedTo,
            task.assignedToName || 'Employee',
            task.points || 100,
            `Task Completed: ${task.title} (${updateData.actualTimeMinutes}m spent)`,
            { taskId: task.id, journalId: task.journalId }
          );
        }
      }

      if (newStatus === 'rework') {
        timeLogs.push({
          action: 'pause',
          timestamp: now.toISOString(),
          userId: currentUser.id,
          userName: currentUser.name
        });
      }

      updateData.timeLogs = timeLogs;
      await updateDoc(doc(db, 'tasks', taskId), updateData);
      
      // Log the transition
      const logAction: TaskLog['action'] = 
        newStatus === 'completed' ? 'completed' : 
        newStatus === 'in_progress' ? 'started' : 
        newStatus === 'rework' ? 'revision' : 'created' as any;

      await logTaskAction(taskId, logAction, details || `Status changed to ${newStatus}`);

      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim() || !auth.currentUser) return;

    try {
      const currentUser = users.find(u => u.id === auth.currentUser?.uid);
      const comment: TaskComment = {
        id: Math.random().toString(36).substring(7),
        taskId: selectedTask.id,
        userId: auth.currentUser.uid,
        userName: currentUser?.name || 'Unknown User',
        userPhotoURL: currentUser?.photoURL || undefined,
        text: newComment,
        createdAt: new Date().toISOString()
      };

      const taskRef = doc(db, 'tasks', selectedTask.id);
      const taskDoc = await getDoc(taskRef);
      const currentComments = taskDoc.data()?.comments || [];

      await updateDoc(taskRef, {
        comments: [...currentComments, comment],
        updatedAt: serverTimestamp()
      });

      setNewComment('');
      // Update local state for immediate feedback
      setSelectedTask(prev => prev ? { ...prev, comments: [...(prev.comments || []), comment] } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'review': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'rework': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'in_progress': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'overdue': return 'bg-rose-50 text-rose-700 border-rose-100';
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent': return 'text-rose-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-amber-600';
      case 'low': return 'text-slate-400';
    }
  };

  const stats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    rework: tasks.filter(t => t.status === 'rework').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  const averageMetrics = tasks.filter(t => t.status === 'completed' && t.actualTimeMinutes).reduce((acc: any, curr) => {
    const type = curr.serviceType;
    if (!acc[type]) acc[type] = { total: 0, count: 0 };
    acc[type].total += curr.actualTimeMinutes || 0;
    acc[type].count += 1;
    return acc;
  }, {});

  const openTaskDetails = (task: Task) => {
    setSelectedTask(task);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Services & Workflow</h2>
          <p className="text-slate-500 mt-1">Manage employee tasks and client service delivery.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl mr-2">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'table' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
              title="Table View"
            >
              <LayoutList size={18} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'kanban' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
              title="Kanban Board"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          <button 
            onClick={() => setIsAnalyticsOpen(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all"
            title="Efficiency Analytics"
          >
            <TrendingUp size={20} />
          </button>
          {check('tasks', 'add') && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              <Plus size={20} />
              Assign Task
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Pending</p>
          <div className="flex items-end justify-between mt-2">
            <h4 className="text-2xl font-bold text-slate-900">{stats.pending}</h4>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md uppercase">Queue</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">In Progress</p>
          <div className="flex items-end justify-between mt-2">
            <h4 className="text-2xl font-bold text-slate-900">{stats.inProgress}</h4>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase">Active</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Under Review</p>
          <div className="flex items-end justify-between mt-2">
            <h4 className="text-2xl font-bold text-slate-900">{stats.review}</h4>
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-md uppercase">QA</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Rework</p>
          <div className="flex items-end justify-between mt-2">
            <h4 className="text-2xl font-bold text-rose-600">{stats.rework}</h4>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md uppercase">Fixing</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Completed</p>
          <div className="flex items-end justify-between mt-2">
            <h4 className="text-2xl font-bold text-slate-900">{stats.completed}</h4>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase">Done</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center shadow-inner">
            <button 
              onClick={() => setViewScope('all')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                viewScope === 'all' ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
              )}
            >
              All Boards
            </button>
            <button 
              onClick={() => setViewScope('today')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                viewScope === 'today' ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Calendar size={12} />
              Today's Focus
            </button>
            <button 
              onClick={() => setViewScope('overdue')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                viewScope === 'overdue' ? "bg-rose-50 text-rose-600 shadow-sm border border-rose-100" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <AlertCircle size={12} />
              Overdue
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block" />

          <select 
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            value={filterStatus || ''}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="rework">Rework</option>
            <option value="completed">Completed</option>
          </select>

          <select 
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            value={filterPriority || ''}
            onChange={(e) => setFilterPriority(e.target.value as any)}
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing</p>
          <p className="text-sm font-black text-indigo-600">{filteredTasks.length} Active Tasks</p>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-sm font-medium">Loading tasks...</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse font-sans">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm border-b border-slate-100">
                  <tr className="text-slate-500 text-[10px] uppercase tracking-widest font-black">
                    {selectedColumns.includes('title') && (
                      <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => requestSort('title')}
                      >
                        <div className="flex items-center">
                          Task & Service
                          <SortIcon columnKey="title" />
                        </div>
                      </th>
                    )}
                    {selectedColumns.includes('serviceType') && (
                      <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => requestSort('serviceType')}
                      >
                        <div className="flex items-center">
                          Service
                          <SortIcon columnKey="serviceType" />
                        </div>
                      </th>
                    )}
                    {selectedColumns.includes('client') && (
                      <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => requestSort('client')}
                      >
                        <div className="flex items-center">
                          Client
                          <SortIcon columnKey="client" />
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
                    {selectedColumns.includes('assignedTo') && (
                      <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => requestSort('assignedTo')}
                      >
                        <div className="flex items-center">
                          Assigned To
                          <SortIcon columnKey="assignedTo" />
                        </div>
                      </th>
                    )}
                    {selectedColumns.includes('priority') && (
                      <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => requestSort('priority')}
                      >
                        <div className="flex items-center">
                          Priority
                          <SortIcon columnKey="priority" />
                        </div>
                      </th>
                    )}
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
                    {selectedColumns.includes('price') && (
                      <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => requestSort('price')}
                      >
                        <div className="flex items-center">
                          Price
                          <SortIcon columnKey="price" />
                        </div>
                      </th>
                    )}
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
                    {selectedColumns.includes('dueDate') && (
                      <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => requestSort('dueDate')}
                      >
                        <div className="flex items-center">
                          Due Date
                          <SortIcon columnKey="dueDate" />
                        </div>
                      </th>
                    )}
                    {selectedColumns.includes('isClientVisible') && <th className="px-6 py-4">Visible</th>}
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
                    {selectedColumns.includes('completedAt') && (
                      <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                        onClick={() => requestSort('completedAt')}
                      >
                        <div className="flex items-center">
                          Completed
                          <SortIcon columnKey="completedAt" />
                        </div>
                      </th>
                    )}
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence mode="popLayout">
                    {sortedTasks.map((task) => (
                      <motion.tr 
                        layout
                        key={task.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                        onClick={() => openTaskDetails(task)}
                      >
                        {selectedColumns.includes('title') && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                                <Briefcase size={20} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm text-slate-900">{task.title}</p>
                                  {task.isClientVisible ? <span title="Visible to Client"><Eye size={12} className="text-slate-400" /></span> : <span title="Hidden from Client"><EyeOff size={12} className="text-slate-300" /></span>}
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100 uppercase">
                                  {task.serviceType}
                                </span>
                              </div>
                            </div>
                          </td>
                        )}
                        {selectedColumns.includes('serviceType') && (
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-600">{task.serviceType}</span>
                          </td>
                        )}
                        {selectedColumns.includes('client') && (
                          <td className="px-6 py-4">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const client = clients.find(c => c.id === task.clientId);
                                if (client) setViewingClient(client);
                              }}
                              className="text-sm font-medium text-slate-700 hover:text-indigo-600 hover:underline text-left"
                            >
                              {clients.find(c => c.id === task.clientId)?.name || 'Unknown Client'}
                            </button>
                          </td>
                        )}
                        {selectedColumns.includes('department') && (
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                              task.department === 'Technical' ? "bg-indigo-50 text-indigo-600" :
                              task.department === 'Accounts' ? "bg-emerald-50 text-emerald-600" :
                              task.department === 'Editorial' ? "bg-amber-50 text-amber-600" :
                              "bg-slate-50 text-slate-600"
                            )}>
                              {task.department || 'General'}
                            </span>
                          </td>
                        )}
                        {selectedColumns.includes('assignedTo') && (
                          <td className="px-6 py-4">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const user = users.find(u => u.id === task.assignedTo);
                                if (user) setViewingEmployee(user);
                              }}
                              className="flex items-center gap-2 hover:text-indigo-600 group/emp"
                            >
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-200 shrink-0 overflow-hidden">
                                {users.find(u => u.id === task.assignedTo)?.photoURL ? (
                                  <img 
                                    src={users.find(u => u.id === task.assignedTo)?.photoURL} 
                                    alt="" 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  users.find(u => u.id === task.assignedTo)?.name.charAt(0) || (task.assignedRole ? task.assignedRole.charAt(0) : '?')
                                )}
                              </div>
                              <div className="flex flex-col text-left">
                                <span className={cn(
                                  "text-sm group-hover/emp:underline",
                                  !task.assignedTo && "text-slate-400 italic"
                                )}>
                                  {users.find(u => u.id === task.assignedTo)?.name || 'Unassigned'}
                                </span>
                                {task.assignedRole && !task.assignedTo && (
                                  <span className="text-[8px] font-black uppercase text-indigo-500">Role: {task.assignedRole}</span>
                                )}
                              </div>
                            </button>
                          </td>
                        )}
                        {selectedColumns.includes('priority') && (
                          <td className="px-6 py-4">
                            <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase", getPriorityColor(task.priority))}>
                              <Flag size={12} fill="currentColor" />
                              {task.priority}
                            </div>
                          </td>
                        )}
                        {selectedColumns.includes('status') && (
                          <td className="px-6 py-4">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                              getStatusColor(task.status)
                            )}>
                              {task.status === 'completed' ? <CheckCircle2 size={14} /> : task.status === 'in_progress' ? <Clock size={14} /> : <AlertCircle size={14} />}
                              {task.status.replace('_', ' ')}
                            </span>
                          </td>
                        )}
                        {selectedColumns.includes('price') && (
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-emerald-600 font-mono">
                              ${task.price || 0}
                            </div>
                          </td>
                        )}
                        {selectedColumns.includes('points') && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1 text-sm font-bold text-slate-700">
                              <Trophy size={14} className="text-amber-500" />
                              {task.points}
                            </div>
                          </td>
                        )}
                        {selectedColumns.includes('dueDate') && (
                          <td className="px-6 py-4 text-xs font-bold text-slate-600">
                            {task.dueDate}
                          </td>
                        )}
                        {selectedColumns.includes('isClientVisible') && (
                          <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                            {task.isClientVisible ? 'Visible' : 'Hidden'}
                          </td>
                        )}
                        {selectedColumns.includes('createdAt') && (
                          <td className="px-6 py-4 text-xs text-slate-400">
                             {task.createdAt && (task.createdAt as any).toDate ? (task.createdAt as any).toDate().toLocaleDateString() : 'N/A'}
                          </td>
                        )}
                        {selectedColumns.includes('completedAt') && (
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : '-'}
                          </td>
                        )}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTask(task);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="View Details"
                            >
                              <ChevronRight size={16} />
                            </button>
                            {check('tasks', 'delete') && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task);
                                }}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Delete Task"
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
      ) : (
        <KanbanBoard 
          tasks={filteredTasks} 
          onTaskClick={(task) => openTaskDetails(task)} 
          onStatusChange={handleUpdateStatus}
        />
      )}

      <Modal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        title="Operational Efficiency Report"
      >
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-3xl space-y-2">
            <h4 className="text-sm font-black text-indigo-900 uppercase">Average Timeline (ByType)</h4>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(averageMetrics as any).map(([type, data]: [any, any]) => (
                <div key={type} className="bg-white p-3 rounded-2xl border border-indigo-50 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{type}</p>
                  <p className="text-xl font-black text-indigo-600">
                    {Math.round(data.total / data.count)} <span className="text-xs font-bold text-slate-400">MIN</span>
                  </p>
                  <p className="text-[8px] font-bold text-slate-300 uppercase mt-1">Based on {data.count} tasks</p>
                </div>
              ))}
              {Object.keys(averageMetrics).length === 0 && (
                <div className="col-span-2 text-center py-6 text-slate-400 italic text-xs">
                  Awaiting completion data for initial reports.
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-black text-slate-900 uppercase">Employee Benchmarks</h4>
            <div className="space-y-2">
              {users.filter(u => u.role === 'Employee' || u.role === 'Admin').map(user => {
                const userTasks = tasks.filter(t => t.assignedTo === user.id && t.status === 'completed' && t.actualTimeMinutes);
                if (userTasks.length === 0) return null;
                const avg = userTasks.reduce((s, t) => s + (t.actualTimeMinutes || 0), 0) / userTasks.length;
                return (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400 overflow-hidden">
                        {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : user.name.charAt(0)}
                      </div>
                      <span className="text-xs font-bold text-slate-700">{user.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{Math.round(avg)}m/task</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{userTasks.length} Done</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Assign Task Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Assign New Task"
      >
        <form onSubmit={handleAssignTask} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Client</label>
              <select 
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newTask.clientId || ''}
                onChange={e => {
                  const client = clients.find(c => c.id === e.target.value);
                  setNewTask(prev => ({ 
                    ...prev, 
                    clientId: e.target.value,
                    clientName: client?.name,
                    journalId: '',
                    domainId: ''
                  }));
                }}
              >
                <option value="">Choose client...</option>
                {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            
            {(newTask.serviceType === 'OJS' || newTask.serviceType === 'ISSN' || newTask.serviceType === 'DOI' || newTask.serviceType === 'Editorial') && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Relates to Journal</label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newTask.journalId || ''}
                  onChange={e => {
                    const journal = journals.find(j => j.id === e.target.value);
                    setNewTask(prev => ({ 
                      ...prev, 
                      journalId: e.target.value,
                      journalTitle: journal?.title
                    }));
                  }}
                  disabled={!newTask.clientId}
                >
                  <option value="">Select journal (optional)...</option>
                  {journals
                    .filter(j => j.clientId === newTask.clientId)
                    .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
                    .map(journal => (
                      <option key={journal.id} value={journal.id}>{journal.title}</option>
                    ))}
                </select>
              </div>
            )}

            {(newTask.serviceType === 'Hosting' || newTask.serviceType === 'Domain') && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Relates to Domain</label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newTask.domainId || ''}
                  onChange={e => {
                    const domain = domains.find(d => d.id === e.target.value);
                    setNewTask(prev => ({ 
                      ...prev, 
                      domainId: e.target.value,
                      domainName: domain?.domainName
                    }));
                  }}
                  disabled={!newTask.clientId}
                >
                  <option value="">Select domain (optional)...</option>
                  {domains
                    .filter(d => d.clientId === newTask.clientId)
                    .sort((a, b) => (a.domainName || '').localeCompare(b.domainName || ''))
                    .map(domain => (
                      <option key={domain.id} value={domain.id}>{domain.domainName}</option>
                    ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Service Type</label>
              <select 
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newTask.serviceType || ''}
                onChange={e => setNewTask(prev => ({ ...prev, serviceType: e.target.value as any }))}
              >
                <option value="Hosting">Hosting</option>
                <option value="DOI">DOI</option>
                <option value="ISSN">ISSN</option>
                <option value="OJS">OJS Setup</option>
                <option value="Editorial">Editorial</option>
                <option value="Domain">Domain</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Department</label>
              <select 
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newTask.department || ''}
                onChange={e => setNewTask(prev => ({ ...prev, department: e.target.value as any }))}
              >
                <option value="General">General</option>
                <option value="Technical">Technical</option>
                <option value="Accounts">Accounts</option>
                <option value="Editorial">Editorial</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Task Title</label>
            <input 
              required
              type="text" 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. OJS Setup for Medical Journal"
              value={newTask.title || ''}
              onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">Description</label>
              <button
                type="button"
                onClick={handleAiSuggestDescription}
                disabled={isAiSuggesting || !newTask.title}
                className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-700 disabled:opacity-50"
              >
                <Sparkles size={10} />
                AI Generate
              </button>
            </div>
            <textarea 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
              placeholder="Detailed task instructions..."
              value={newTask.description || ''}
              onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Assign Employee</label>
              <select 
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newTask.assignedTo || ''}
                onChange={e => setNewTask(prev => ({ ...prev, assignedTo: e.target.value }))}
              >
                <option value="">Select employee...</option>
                {users
                  .filter(u => u.role === 'Employee' || u.role === 'Admin')
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                  .map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Priority</label>
              <select 
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newTask.priority || ''}
                onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value as any }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Est. Time (Minutes)</label>
              <input 
                type="number"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. 60"
                value={newTask.estimatedTimeMinutes || ''}
                onChange={e => setNewTask(prev => ({ ...prev, estimatedTimeMinutes: parseInt(e.target.value) }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Due Date</label>
              <input 
                required
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newTask.dueDate || ''}
                onChange={e => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 font-mono uppercase tracking-tighter">Price ($ USD)</label>
              <input 
                type="number" 
                className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all placeholder-slate-400"
                placeholder="0"
                value={newTask.price || ''}
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  setNewTask(prev => ({ 
                    ...prev, 
                    price: val, 
                    points: Math.floor(val * 0.5) 
                  }));
                }}
              />
              <p className="text-[10px] text-emerald-600 font-bold">Client will be charged ${newTask.price || 0}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 font-mono uppercase tracking-tighter">Points / Reward Earned</label>
            <input 
              required
              type="number" 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold"
              value={newTask.points || ''}
              onChange={e => setNewTask(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
            />
            <p className="text-[10px] text-indigo-600 font-bold">Employee earns 50% reward: {newTask.points} PTS</p>
          </div>

          {/* Subtasks Creation Area */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-2 uppercase tracking-wide">
              <LayoutList size={14} className="text-indigo-600" />
              Main Task's Sub-Tasks
            </h4>
            
            {/* List current ones */}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {newTask.subTasks.map((st, i) => (
                <div key={st.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl shadow-xs text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{st.title}</p>
                    <span className="text-[10px] uppercase font-black px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                      Visibility: {st.visibility}
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setNewTask(prev => ({
                        ...prev,
                        subTasks: prev.subTasks.filter((_, idx) => idx !== i)
                      }));
                    }}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {newTask.subTasks.length === 0 && (
                <p className="text-[11px] text-slate-400 italic">No sub-tasks added yet</p>
              )}
            </div>

            {/* Subtask input creator */}
            <div className="flex flex-col md:flex-row gap-2 pt-2 border-t border-slate-200/60 font-sans">
              <input 
                id="temp-subtask-title"
                type="text"
                placeholder="Sub-task title..."
                className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none text-xs"
              />
              <select 
                id="temp-subtask-visibility"
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none text-xs"
                defaultValue="all"
              >
                <option value="all">Visible to All</option>
                <option value="client">Client & Admin</option>
                <option value="employee">Employee & Admin</option>
                <option value="admin">Admin Only</option>
              </select>
              <button
                type="button"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
                onClick={() => {
                  const titleInput = document.getElementById('temp-subtask-title') as HTMLInputElement;
                  const visibilitySelect = document.getElementById('temp-subtask-visibility') as HTMLSelectElement;
                  if (titleInput && titleInput.value.trim()) {
                    const st: SubTask = {
                      id: crypto.randomUUID(),
                      title: titleInput.value.trim(),
                      status: 'pending',
                      visibility: visibilitySelect.value as any
                    };
                    setNewTask(prev => ({
                      ...prev,
                      subTasks: [...prev.subTasks, st]
                    }));
                    titleInput.value = '';
                  }
                }}
              >
                Add Sub-Task
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox" 
              id="clientVisible"
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              checked={newTask.isClientVisible}
              onChange={e => setNewTask(prev => ({ ...prev, isClientVisible: e.target.checked }))}
            />
            <label htmlFor="clientVisible" className="text-sm font-medium text-slate-600">Visible to Client</label>
          </div>
          <div className="pt-4">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Creating Task...
                </>
              ) : 'Create Workflow Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Task Details & Workflow Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                    <Briefcase size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{selectedTask.title}</h3>
                    <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Workflow Task #{selectedTask.id.substring(0, 8).toUpperCase()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Description</h4>
                    <p className="text-slate-600 leading-relaxed">
                      {selectedTask.description || 'No description provided for this task.'}
                    </p>
                  </div>

                  {/* Sub-Tasks Interactive Section */}
                  <div className="space-y-4 p-6 bg-slate-50/50 border border-slate-150 rounded-2xl">
                    <div className="flex items-center justify-between border-b border-rose-105/30 pb-2">
                      <div className="flex items-center gap-2">
                        <LayoutList size={18} className="text-indigo-600" />
                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Sub-Tasks & Workload Milestones</h4>
                      </div>
                      <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                        {(selectedTask.subTasks || []).filter(st => st.status === 'completed').length} / {(selectedTask.subTasks || []).length} Done
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {(selectedTask.subTasks || []).map((st) => {
                        const isVisible = isSubTaskVisible(st, currentUser.role);
                        if (!isVisible) return null;

                        return (
                          <div 
                            key={st.id} 
                            className="flex items-start justify-between p-3.5 bg-white border border-slate-100 hover:border-indigo-100 rounded-xl shadow-xs transition-all gap-3"
                          >
                            <label className="flex items-start gap-3 flex-1 cursor-pointer">
                              <input 
                                type="checkbox"
                                className="w-4.5 h-4.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-0.5"
                                checked={st.status === 'completed'}
                                onChange={() => handleToggleSubTaskStatus(selectedTask.id, st.id)}
                              />
                              <div className="text-sm">
                                <p className={cn(
                                  "font-bold text-slate-800",
                                  st.status === 'completed' && "line-through text-slate-400"
                                )}>
                                  {st.title}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className={cn(
                                    "text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md",
                                    st.visibility === 'all' ? "bg-slate-100 text-slate-600" :
                                    st.visibility === 'client' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                    st.visibility === 'employee' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                    "bg-rose-50 text-rose-600 border border-rose-100"
                                  )}>
                                    Scope: {st.visibility}
                                  </span>
                                  <span className={cn(
                                    "text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md",
                                    st.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                  )}>
                                    {st.status}
                                  </span>
                                </div>
                              </div>
                            </label>

                            {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                              <button 
                                onClick={() => handleRemoveSubTaskFromExisting(selectedTask.id, st.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors mt-0.5"
                                title="Remove subtask"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {(!selectedTask.subTasks || selectedTask.subTasks.length === 0) && (
                        <p className="text-xs text-slate-400 italic font-medium p-2">This parent task currently has no sub-tasks setup.</p>
                      )}
                    </div>

                    {/* Admin subtask adder */}
                    {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                      <div className="pt-3 border-t border-slate-200/50 space-y-2 mt-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Add New Sub-Task (Admin Tool)</p>
                        <div className="flex flex-col md:flex-row gap-2">
                          <input 
                            id="detail-subtask-title"
                            type="text"
                            placeholder="Type milestone/task title..."
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-800"
                          />
                          <select 
                            id="detail-subtask-visibility"
                            className="px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-700 font-bold"
                            defaultValue="all"
                          >
                            <option value="all">Visible to All</option>
                            <option value="client">Client & Admin</option>
                            <option value="employee">Employee & Admin</option>
                            <option value="admin">Admin Only</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const tInput = document.getElementById('detail-subtask-title') as HTMLInputElement;
                              const vSelect = document.getElementById('detail-subtask-visibility') as HTMLSelectElement;
                              if (tInput && tInput.value.trim()) {
                                handleAddSubTaskToExisting(selectedTask.id, tInput.value.trim(), vSelect.value);
                                tInput.value = '';
                              }
                            }}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 shadow-sm"
                          >
                            Add Subtask
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedTask.timeLogs && selectedTask.timeLogs.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Task Activity Timeline & Progression History</h4>
                        <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                          <Clock size={12} />
                          Precision Tracking
                        </div>
                      </div>
                      <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        {selectedTask.timeLogs.map((log, idx) => (
                          <div key={idx} className="relative">
                            <div className={cn(
                              "absolute -left-[26px] w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center",
                              log.action === 'start' || log.action === 'resume' ? "bg-emerald-500 scale-110 shadow-emerald-100" :
                              log.action === 'pause' ? "bg-amber-500" : "bg-indigo-600"
                            )}>
                              {log.action === 'start' || log.action === 'resume' ? <Play size={8} className="text-white" fill="white" /> : 
                               log.action === 'pause' ? <Pause size={8} className="text-white" fill="white" /> : 
                               <CheckCircle2 size={8} className="text-white" />}
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-black text-slate-700 uppercase tracking-tighter">
                                  {log.action.replace('_', ' ')}
                                  {idx > 0 && log.action === 'start' && <span className="ml-2 text-[10px] text-slate-400 normal-case font-medium">(Re-started)</span>}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">by {log.userName}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-900">{new Date(log.timestamp).toLocaleTimeString()}</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">System Audit Trail</h4>
                    <div className="space-y-3">
                      {taskLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                          <div className={cn(
                            "w-2 h-2 rounded-full mt-1.5",
                            log.action === 'created' ? "bg-indigo-500" :
                            log.action === 'completed' ? "bg-emerald-500" :
                            log.action === 'started' ? "bg-blue-500" : "bg-slate-400"
                          )} />
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black text-slate-900 uppercase">{log.action}</span>
                              <span className="text-[10px] text-slate-400">
                                {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Just now'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Action by <span className="font-bold text-slate-700">{log.userName}</span>
                              {log.details && <span className="block mt-1 italic">"{log.details}"</span>}
                            </p>
                          </div>
                        </div>
                      ))}
                      {taskLogs.length === 0 && (
                        <p className="text-xs text-slate-400 italic">No system audit logs found.</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Discussion & Activity</h4>
                    <div className="space-y-4">
                      {(selectedTask.comments || []).map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-200 shrink-0 overflow-hidden">
                            {comment.userPhotoURL ? (
                              <img src={comment.userPhotoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              comment.userName.charAt(0)
                            )}
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-slate-900">{comment.userName}</span>
                              <span className="text-[10px] text-slate-400">{new Date(comment.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-slate-600">{comment.text}</p>
                          </div>
                        </div>
                      ))}
                      {(!selectedTask.comments || selectedTask.comments.length === 0) && (
                        <p className="text-sm text-slate-400 italic">No activity logs yet.</p>
                      )}
                    </div>
                    <form onSubmit={handleAddComment} className="flex gap-2 pt-4">
                      <input 
                        type="text" 
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        placeholder="Add a comment or update..."
                        value={newComment || ''}
                        onChange={e => setNewComment(e.target.value)}
                      />
                      <button 
                        type="submit"
                        className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                      >
                        <Send size={18} />
                      </button>
                    </form>
                  </div>
                </div>

                <div className="w-full lg:w-72 space-y-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(['pending', 'in_progress', 'review', 'completed'] as TaskStatus[]).map((status) => (
                          <button
                            key={status}
                            onClick={() => handleUpdateStatus(selectedTask.id, status)}
                            className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border",
                              selectedTask.status === status 
                                ? getStatusColor(status)
                                : "bg-white text-slate-400 border-slate-200 hover:border-indigo-200"
                            )}
                          >
                            {status.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</p>
                      <div className={cn("flex items-center gap-2 font-bold text-sm", getPriorityColor(selectedTask.priority))}>
                        <Flag size={14} fill="currentColor" />
                        {selectedTask.priority.toUpperCase()}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assigned To</p>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 border border-indigo-200">
                          {users.find(u => u.id === selectedTask.assignedTo)?.name.charAt(0) || '?'}
                        </div>
                        <span className="text-sm font-bold text-slate-700">{users.find(u => u.id === selectedTask.assignedTo)?.name || 'Unassigned'}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client</p>
                      <p className="text-sm font-bold text-slate-700">{clients.find(c => c.id === selectedTask.clientId)?.name || 'Unknown'}</p>
                    </div>

                    {selectedTask.actualTimeMinutes !== undefined && (
                      <div className="space-y-1 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Time Tracking</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-emerald-700">Total Spent</span>
                          <span className="text-sm font-black text-emerald-900">{selectedTask.actualTimeMinutes} min</span>
                        </div>
                        {selectedTask.estimatedTimeMinutes && (
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] font-bold text-emerald-600">Efficiency</span>
                            <span className={cn(
                              "text-[10px] font-bold",
                              selectedTask.actualTimeMinutes <= selectedTask.estimatedTimeMinutes ? "text-emerald-700" : "text-rose-600"
                            )}>
                              {Math.round((selectedTask.estimatedTimeMinutes / selectedTask.actualTimeMinutes) * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5 pt-2 border-t border-slate-200">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Date</p>
                        <p className="text-sm font-bold text-slate-700">{selectedTask.dueDate}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client Price</p>
                        <p className="text-sm font-bold text-emerald-600">${selectedTask.price || 0} USD</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee Reward</p>
                        <p className="text-sm font-bold text-indigo-600">{selectedTask.points || 0} PTS</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {selectedTask.status === 'pending' && selectedTask.assignedTo === currentUser.id && (
                      <button 
                        onClick={() => handleUpdateStatus(selectedTask.id, 'in_progress')}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                      >
                        <Clock size={18} />
                        Start Working
                      </button>
                    )}
                    
                    {selectedTask.status === 'in_progress' && selectedTask.assignedTo === currentUser.id && (
                      <button 
                        onClick={() => {
                          const now = new Date().toISOString();
                          const timeLogs = selectedTask.timeLogs || [];
                          timeLogs.push({
                            action: 'pause',
                            timestamp: now,
                            userId: currentUser.id,
                            userName: currentUser.name
                          });
                          updateDoc(doc(db, 'tasks', selectedTask.id), { timeLogs, updatedAt: serverTimestamp() });
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-200"
                      >
                        <Pause size={18} />
                        Pause Timer
                      </button>
                    )}

                    {selectedTask.timeLogs && selectedTask.timeLogs[selectedTask.timeLogs.length - 1].action === 'pause' && selectedTask.assignedTo === currentUser.id && (
                      <button 
                        onClick={() => {
                          const now = new Date().toISOString();
                          const timeLogs = selectedTask.timeLogs || [];
                          timeLogs.push({
                            action: 'resume',
                            timestamp: now,
                            userId: currentUser.id,
                            userName: currentUser.name
                          });
                          updateDoc(doc(db, 'tasks', selectedTask.id), { timeLogs, updatedAt: serverTimestamp() });
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200"
                      >
                        <Play size={18} />
                        Resume Timer
                      </button>
                    )}
                    
                    {selectedTask.status === 'in_progress' && selectedTask.assignedTo === currentUser.id && (
                      <button 
                        onClick={() => handleUpdateStatus(selectedTask.id, 'review')}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
                      >
                        <CheckCircle2 size={18} />
                        Submit for Review
                      </button>
                    )}

                    {selectedTask.status === 'review' && (currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => handleUpdateStatus(selectedTask.id, 'completed')}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                        >
                          <Trophy size={18} />
                          Approve & Award Points
                        </button>
                        <button 
                          onClick={() => {
                            const reason = prompt('Enter revision feedback:');
                            if (reason) handleUpdateStatus(selectedTask.id, 'rework', reason);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all border border-rose-100"
                        >
                          <AlertCircle size={18} />
                          Request Revision
                        </button>
                      </div>
                    )}

                    <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
                      <Download size={16} />
                      Export Task Report
                    </button>
                    {check('tasks', 'delete') && (
                      <button 
                        onClick={() => {
                          handleDeleteTask(selectedTask);
                          setIsDetailsModalOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all"
                      >
                        <Trash2 size={16} />
                        Delete Task
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {viewingClient && (
        <ClientDetail 
          client={viewingClient} 
          onBack={() => setViewingClient(null)} 
          currentUser={currentUser}
        />
      )}

      {viewingEmployee && (
        <EmployeeDetail 
          employee={viewingEmployee} 
          onBack={() => setViewingEmployee(null)} 
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
