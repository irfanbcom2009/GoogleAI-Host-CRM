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
  DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';
import { ClientService, User as CRMUser, ActivityLog, EmployeeTaskTemplate } from '../../types';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

interface EmployeeDashboardProps {
  currentUser: CRMUser;
  setActiveTab: (tab: string) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ currentUser, setActiveTab }) => {
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    completedToday: 0,
    earningsCount: 0,
    points: currentUser.points || 0
  });

  useEffect(() => {
    // In a real system, we'd query client_services that have tasks assigned to this employee's department
    // For now, let's fetch all active services and filter by department if applicable
    const unsub = onSnapshot(query(collection(db, 'client_services'), where('status', '==', 'In Progress')), (snapshot) => {
      const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ClientService);
      
      // Flatten tasks from services
      const allTasks: any[] = [];
      services.forEach(service => {
        // Logic to extract tasks assigned to currentUser's department would go here
        allTasks.push({
          id: service.id,
          serviceName: service.serviceName,
          clientName: service.clientName,
          status: service.status,
          progress: service.progress,
          updatedAt: service.updatedAt
        });
      });

      setAssignedTasks(allTasks);
      setStats(prev => ({ ...prev, pending: allTasks.length }));
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  return (
    <div className="space-y-8 p-4">
      {/* Header & Performance */}
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-2">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Focus Mode, {currentUser.name.split(' ')[0]}!</h2>
          <p className="text-slate-500 font-medium">You have {stats.pending} projects awaiting action today.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 flex items-center gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100 mb-1">Total Points</p>
              <p className="text-2xl font-black">{stats.points.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Star size={24} className="text-amber-300 fill-amber-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Task Execution Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Task List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Briefcase size={20} className="text-indigo-600" />
              Assigned Tasks
            </h3>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-tight">Priority: High</span>
            </div>
          </div>

          <div className="space-y-4">
            {assignedTasks.length === 0 ? (
              <div className="py-20 text-center bg-white border border-slate-100 rounded-3xl shadow-sm">
                <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-slate-900 font-bold">All caught up!</h4>
                <p className="text-slate-400 text-sm">New tasks will appear here as orders are placed.</p>
              </div>
            ) : (
              assignedTasks.map((task, idx) => (
                <motion.div 
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <Clock size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 underline decoration-indigo-200 underline-offset-4">{task.serviceName}</h4>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-tight mt-1">{task.clientName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</p>
                      <p className="text-sm font-black text-indigo-600">{task.progress}%</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('catalog')} // In reality redirected to Workflow tab
                      className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-100"
                    >
                      Process <ChevronRight size={14} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Status & Notifications */}
        <div className="space-y-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 overflow-hidden relative">
            <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2">
              <Timer size={18} className="text-rose-500" />
              Daily Quota
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600">Tasks Completed</span>
                <span className="text-sm font-black text-slate-900">{stats.completedToday}/10</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(stats.completedToday / 10) * 100}%` }}
                  className="h-full bg-emerald-500" 
                />
              </div>
              <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                Complete your daily quota to earn bonus performance points and multipliers.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-black text-slate-900 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-indigo-600" />
                Department Brief
              </div>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase">{currentUser.department || 'General'}</span>
            </h3>
            <div className="space-y-4">
               {[
                 { title: 'New ISO standards applied', date: '2h ago', icon: FileText },
                 { title: 'Peer review deadline pending', date: '5h ago', icon: AlertCircle },
                 { title: 'Support escalation #421', date: '1d ago', icon: MessageSquare }
               ].map((item, idx) => (
                 <div key={idx} className="flex gap-4">
                   <div className="w-8 h-8 shrink-0 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center">
                     <item.icon size={14} />
                   </div>
                   <div>
                     <p className="text-xs font-bold text-slate-800 leading-tight">{item.title}</p>
                     <p className="text-[10px] text-slate-400 font-medium mt-0.5">{item.date}</p>
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
