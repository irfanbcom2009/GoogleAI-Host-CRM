import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  MessageSquare,
  Users,
  Timer,
  ChevronRight,
  Shield,
  Star,
  FileText,
  DollarSign,
  TrendingUp,
  Award,
  Zap,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, User as CRMUser, ActivityLog } from '../../types';
import { db, handleFirestoreError, OperationType, logActivity } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import { pointsService } from '../../services/pointsService';
import { format } from 'date-fns';

interface EmployeeDashboardProps {
  currentUser: CRMUser;
  setActiveTab: (tab: string) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ currentUser, setActiveTab }) => {
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    completedToday: 0,
    points: currentUser.points || 0,
    rank: 0
  });

  useEffect(() => {
    // Fetch assigned tasks (pending or in_progress)
    const qTasks = query(
      collection(db, 'tasks'), 
      where('assignedTo', '==', currentUser.id),
      orderBy('createdAt', 'desc')
    );

    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setAssignedTasks(taskData);
      
      const today = new Date().toISOString().split('T')[0];
      const completedToday = taskData.filter(t => t.status === 'completed' && t.completedAt?.toString().includes(today)).length;
      
      setStats(prev => ({ 
        ...prev, 
        pending: taskData.filter(t => t.status === 'pending').length,
        inProgress: taskData.filter(t => t.status === 'in_progress').length,
        completedToday
      }));
      setLoading(false);
    });

    // Fetch notifications
    const qNotify = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.id),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubNotify = onSnapshot(qNotify, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch user points/rank real-time
    const unsubUser = onSnapshot(doc(db, 'users', currentUser.id), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setStats(prev => ({ ...prev, points: data.points || 0 }));
      }
    });

    // Fetch ranking
    const unsubRank = onSnapshot(query(collection(db, 'users'), orderBy('points', 'desc')), (snapshot) => {
      const rank = snapshot.docs.findIndex(d => d.id === currentUser.id) + 1;
      setStats(prev => ({ ...prev, rank }));
    });

    return () => {
      unsubTasks();
      unsubNotify();
      unsubUser();
      unsubRank();
    };
  }, [currentUser.id]);

  const handleUpdateStatus = async (taskId: string, currentStatus: string, newStatus: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const task = assignedTasks.find(t => t.id === taskId);
      if (!task) return;

      const updateData: any = { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      };

      const now = new Date();
      const timeLogs = task.timeLogs || [];

      if (newStatus === 'in_progress') {
        updateData.startedAt = serverTimestamp();
        timeLogs.push({
          action: currentStatus === 'pending' ? 'start' : 'resume',
          timestamp: now.toISOString(),
          userId: currentUser.id,
          userName: currentUser.name
        });
      } else if (newStatus === 'completed') {
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

        // award points
        await pointsService.awardEmployeePoints(
          currentUser.id,
          currentUser.name,
          task.points || 100,
          `Task Completed: ${task.title} (${updateData.actualTimeMinutes}m spent)`,
          { taskId }
        );
      }

      updateData.timeLogs = timeLogs;
      await updateDoc(taskRef, updateData);
      await logActivity(currentUser.id, currentUser.name, `updated task status to ${newStatus}`, `Task ID: ${taskId}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      console.error("Error marking read:", error);
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'high': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'medium': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  return (
    <div className="space-y-8 p-4">
      {/* Performance Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Focus Flow, {currentUser.name.split(' ')[0]}!</h2>
            <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">Live Dashboard</div>
          </div>
          <p className="text-slate-500 font-medium">You have <span className="text-indigo-600 font-bold">{stats.inProgress} tasks active</span> and <span className="text-amber-600 font-bold">{stats.pending} in queue</span>.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1 bg-slate-900 rounded-[2rem] p-6 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-500/40 transition-all duration-700" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Employee Rating</p>
                <div className="px-2 py-0.5 bg-indigo-500 text-white rounded-lg text-[8px] font-black uppercase">Rank #{stats.rank}</div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-black">{stats.points.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">Lifetime Achievement</p>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <Award size={24} className="text-amber-300 fill-amber-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Workspace */}
        <div className="lg:col-span-8 space-y-8">
          {/* Notifications / Alerts - Simplified */}
          <AnimatePresence>
            {notifications.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Zap size={14} className="text-amber-500" />
                    Priority Alerts
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {notifications.map(notify => (
                    <div key={notify.id} className="bg-white p-4 rounded-2xl border-l-4 border-l-indigo-500 border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                          <MessageSquare size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900">{notify.title}</p>
                          <p className="text-[10px] font-medium text-slate-500">{notify.message}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleMarkRead(notify.id)}
                        className="p-1 px-3 bg-slate-50 hover:bg-indigo-50 text-[10px] font-black text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <Briefcase size={22} className="text-indigo-600" />
                Active Focus List
              </h3>
              <div className="flex items-center gap-2">
                <div className="text-right mr-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Target Daily Points</p>
                  <p className="text-xs font-black text-slate-900">1,500 / 2,000</p>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-indigo-600 flex items-center justify-center text-[10px] font-black text-indigo-600">
                  75%
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Resuming Session...</p>
                </div>
              ) : assignedTasks.length === 0 ? (
                <div className="py-20 text-center bg-white border border-slate-100 rounded-[2.5rem] shadow-sm">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={40} />
                  </div>
                  <h4 className="text-xl font-black text-slate-900">Full Clearance!</h4>
                  <p className="text-slate-400 font-medium">Relax or pick up unassigned tasks from the catalog.</p>
                </div>
              ) : (
                assignedTasks.filter(t => t.status !== 'completed').map((task, idx) => (
                  <motion.div 
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-200 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-14 h-14 rounded-3xl flex items-center justify-center transition-transform group-hover:scale-110",
                        task.status === 'in_progress' ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100 rotate-3" : "bg-slate-50 text-slate-400"
                      )}>
                        {task.status === 'in_progress' ? <Zap size={28} /> : <Clock size={28} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                            getPriorityColor(task.priority)
                          )}>
                            {task.priority || 'Medium'}
                          </span>
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{task.serviceType}</span>
                        </div>
                        <h4 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase leading-tight">{task.title}</h4>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-tight mt-1 flex items-center gap-1">
                          <Users size={12} />
                          {task.clientName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 border-t md:border-t-0 pt-4 md:pt-0">
                      <div className="text-center px-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reward</p>
                        <div className="flex items-center gap-1 text-emerald-600">
                          <Star size={12} className="fill-emerald-600" />
                          <span className="text-sm font-black underline underline-offset-4 decoration-emerald-200">{task.points || 100} PTS</span>
                        </div>
                      </div>

                      {task.status === 'pending' ? (
                        <button 
                          onClick={() => handleUpdateStatus(task.id, 'pending', 'in_progress')}
                          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100"
                        >
                          Start Sprint <Zap size={14} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleUpdateStatus(task.id, 'in_progress', 'completed')}
                          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-emerald-100"
                        >
                          Mark Done <CheckCircle size={14} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Ops */}
        <div className="lg:col-span-4 space-y-8">
           {/* Performance Snapshot */}
           <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-1000" />
            <h3 className="font-black text-slate-900 mb-8 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-500" />
                Performance KPIs
              </div>
            </h3>
            
            <div className="space-y-8 relative z-10">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Task Velocity</span>
                  <span className="text-emerald-600">{stats.completedToday}/10 Done</span>
                </div>
                <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.completedToday / 10) * 100}%` }}
                    className="h-full bg-indigo-600 shadow-lg shadow-indigo-200" 
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed italic">
                  Keep maintaining <span className="text-indigo-600">80%+ daily quota</span> to unlock Senior Manager promotion path.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Efficiency</p>
                  <p className="text-xl font-black text-slate-900">94.2%</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Accuracy</p>
                  <p className="text-xl font-black text-slate-900">High</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payroll Estimate */}
          <div className="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-indigo-500">
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)]" />
            <h3 className="font-black mb-6 flex items-center gap-2 relative z-10">
              <DollarSign size={18} className="text-emerald-300" />
              Settlement Ledger
            </h3>
            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest opacity-80 mb-1">Expected Payout</p>
                  <p className="text-3xl font-black italic">PKR 74,500</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest opacity-80 mb-1">USD Eq</p>
                  <p className="text-sm font-black">$265</p>
                </div>
              </div>
              <div className="pt-4 border-t border-indigo-500/50">
                <button 
                  onClick={() => setActiveTab('finance')}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                >
                  View Full Statement
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
