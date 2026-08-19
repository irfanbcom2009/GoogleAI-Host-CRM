import React, { useState, useEffect } from 'react';
import { StatCard } from './StatCard';
import { HelpIcon } from './HelpIcon';
import { 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Trophy,
  Star,
  MessageSquare,
  Loader2,
  TrendingUp,
  Calendar,
  History,
  Award,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, limit, doc } from 'firebase/firestore';
import { Task, User as CRMUser, ActivityLog } from '../types';
import { cn } from '../lib/utils';
import { financeService } from '../services/financeService';

interface EmployeeDashboardProps {
  currentUser: CRMUser;
  setActiveTab: (tab: string) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ currentUser, setActiveTab }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<CRMUser>(currentUser);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [payrollData, setPayrollData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayroll = async () => {
      const now = new Date();
      const data = await financeService.calculatePayroll(currentUser.id, now.getMonth(), now.getFullYear());
      setPayrollData(data);
    };
    fetchPayroll();
  }, [currentUser.id]);

  useEffect(() => {
    const unsubUser = onSnapshot(doc(db, 'users', currentUser.id), (doc) => {
      if (doc.exists()) {
        setUser({ id: doc.id, ...doc.data() } as CRMUser);
      }
    });

    const qTasks = query(
      collection(db, 'tasks'), 
      where('assignedTo', '==', currentUser.id),
      orderBy('createdAt', 'desc')
    );

    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(taskData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    // Fetch real activities for this employee
    const qActivities = query(
      collection(db, 'activity_logs'),
      where('userId', '==', currentUser.id),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      setActivities(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activity_logs');
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubTasks();
      unsubActivities();
    };
  }, [currentUser.id]);

  const stats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    points: user?.points || 0
  };

  const recentTasks = tasks.slice(0, 5);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-sm font-medium tracking-widest uppercase">Loading your workspace...</p>
      </div>
    );
  }

  return (
    <div className="py-4 md:py-8 space-y-6 md:space-y-8 max-w-full mx-auto px-4 md:px-8 lg:px-12">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5 flex-wrap">
            Welcome back, {user?.name}
            <HelpIcon policyTitle="Employee Portal Policy" />
          </h2>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <Calendar size={14} />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 pr-6 rounded-2xl border border-slate-100 shadow-sm w-fit">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
            <Trophy size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Your Performance</p>
            <p className="text-lg sm:text-xl font-black text-indigo-600">{stats.points.toLocaleString()} <span className="text-xs font-bold text-slate-400">PTS</span></p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Pending Tasks" 
          value={stats.pending.toString()} 
          change={0}
          icon={Clock} 
          color="bg-amber-500" 
        />
        <StatCard 
          label="In Progress" 
          value={stats.inProgress.toString()} 
          change={0}
          icon={TrendingUp} 
          color="bg-blue-500" 
        />
        <StatCard 
          label="Completed" 
          value={stats.completed.toString()} 
          change={0}
          icon={CheckCircle2} 
          color="bg-emerald-500" 
        />
        <StatCard 
          label="Success Rate" 
          value={tasks.length > 0 ? `${Math.round((stats.completed / tasks.length) * 100)}%` : '0%'} 
          change={0}
          icon={Star} 
          color="bg-purple-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Briefcase size={20} className="text-indigo-600" />
              Recent Assignments
            </h3>
            <button 
              onClick={() => setActiveTab('tasks')}
              className="text-sm font-bold text-indigo-600 hover:underline"
            >
              View All Tasks
            </button>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {recentTasks.map((task) => (
                <div key={task.id} className="p-4 hover:bg-slate-50 transition-all group flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 sm:mt-0",
                      task.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                    )}>
                      {task.status === 'completed' ? <CheckCircle2 size={20} /> : <Briefcase size={20} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 break-words">{task.title}</p>
                      <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="font-bold uppercase text-[10px] text-indigo-600">{task.serviceType}</span>
                        <span className="hidden xs:inline">•</span>
                        <span>Due {task.dueDate}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-150 shrink-0">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                      task.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                    )}>
                      {task.status.replace('_', ' ')}
                    </span>
                    <button 
                      onClick={() => setActiveTab('tasks')}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <TrendingUp size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {recentTasks.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-sm italic">No tasks assigned to you yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Reward Points Summary */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Award size={120} />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md">
                    <Trophy size={18} />
                  </div>
                  <span className="text-sm font-bold uppercase tracking-widest opacity-80">Reward Points Summary</span>
                </div>
                <h3 className="text-4xl font-black">{stats.points.toLocaleString()} <span className="text-xl font-normal opacity-60">Total Points</span></h3>
                <p className="text-indigo-100 text-sm max-w-md">
                  Complete tasks on time and maintain high quality to earn more points. Points can be redeemed for bonuses and rewards.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">This Month</p>
                  <p className="text-xl font-bold">+1,250</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Rank</p>
                  <p className="text-xl font-bold">#3</p>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          {payrollData && (
            <div className="bg-white rounded-3xl p-8 mt-6 border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-600 group-hover:scale-110 transition-transform">
                <DollarSign size={100} />
              </div>
              <div className="relative z-10 flex flex-col gap-6">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <DollarSign size={18} />
                  </div>
                  <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Monthly Payroll Estimate</span>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gross Salary</p>
                    <p className="text-xl font-black text-slate-900">{payrollData.grossSalary.toLocaleString()} PKR</p>
                    {payrollData.usdEquiv && (
                      <p className="text-xs font-bold text-slate-400">$ {(payrollData.usdEquiv.grossSalary || 0).toLocaleString()}</p>
                    )}
                    <p className="text-[8px] text-slate-400 mt-0.5 italic">Max of (Points: {payrollData.pointsValue.toLocaleString()} or Base: {payrollData.baseSalary.toLocaleString()})</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Paid</p>
                    <p className="text-xl font-black text-emerald-600">-{payrollData.paidAmount.toLocaleString()} PKR</p>
                    {payrollData.usdEquiv && (
                      <p className="text-xs font-bold text-emerald-400">- $ {(payrollData.usdEquiv.paidAmount || 0).toLocaleString()}</p>
                    )}
                    <p className="text-[8px] text-slate-400 mt-0.5 italic">Including advances & partial payments</p>
                  </div>
                  <div className="col-span-2 lg:col-span-1 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1 italic">Remaining Balance</p>
                    <p className="text-2xl font-black text-indigo-600">{payrollData.balance.toLocaleString()} PKR</p>
                    {payrollData.usdEquiv && (
                      <p className="text-sm font-bold text-indigo-400">$ {(payrollData.usdEquiv.balance || 0).toLocaleString()}</p>
                    )}
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Pending Disbursement</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Activity Window */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History size={20} className="text-indigo-600" />
            Activity Window
          </h3>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="space-y-6 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {activities.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs italic">No recent activities recorded.</p>
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="relative pl-6">
                    <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white bg-indigo-500 shadow-sm" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900 leading-tight">{activity.action}</p>
                      <p className="text-xs text-slate-500">{activity.details}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="pt-6 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Monthly Goal</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">Task Completion</span>
                  <span className="text-indigo-600">85%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[85%] transition-all duration-1000" />
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                <Star size={14} className="inline mr-1 mb-1 fill-indigo-200" />
                Keep up the great work! You're currently in the top 3 performers this week.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
