import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Globe, 
  FileText, 
  CheckCircle2, 
  Clock, 
  MessageSquare,
  TrendingUp,
  Package,
  Calendar,
  ChevronRight,
  Loader2,
  Shield,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { User as UserType, Domain, Journal, Task } from '../types';
import { cn } from '../lib/utils';
import { ChatBoard } from './ChatBoard';

interface ClientDashboardProps {
  currentUser: UserType;
  setActiveTab: (tab: string) => void;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ currentUser, setActiveTab }) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'chat'>('overview');

  useEffect(() => {
    if (!currentUser.id) return;

    // Fetch client's domains
    const unsubscribeDomains = onSnapshot(
      query(collection(db, 'domains'), where('clientId', '==', currentUser.id)),
      (snapshot) => {
        setDomains(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Domain[]);
      }
    );

    // Fetch client's journals
    const unsubscribeJournals = onSnapshot(
      query(collection(db, 'journals'), where('clientId', '==', currentUser.id)),
      (snapshot) => {
        setJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Journal[]);
      }
    );

    // Fetch client's tasks (only visible ones)
    const unsubscribeTasks = onSnapshot(
      query(
        collection(db, 'tasks'), 
        where('clientId', '==', currentUser.id),
        where('isClientVisible', '==', true),
        orderBy('createdAt', 'desc'),
        limit(5)
      ),
      (snapshot) => {
        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeDomains();
      unsubscribeJournals();
      unsubscribeTasks();
    };
  }, [currentUser.id]);

  const stats = [
    { label: 'Active Services', value: domains.length + journals.length, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pending Tasks', value: tasks.filter(t => t.status !== 'completed').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'My Points', value: currentUser.points || 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-sm font-medium">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back, {currentUser.name.split(' ')[0]}!</h1>
          <p className="text-slate-500 font-medium">Here's what's happening with your projects today.</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          <button 
            onClick={() => setActiveView('overview')}
            className={cn(
              "px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2",
              activeView === 'overview' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>
          <button 
            onClick={() => setActiveView('chat')}
            className={cn(
              "px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2",
              activeView === 'chat' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <MessageSquare size={18} />
            Live Chat
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'overview' ? (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8 overflow-y-auto pr-2"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={stat.label}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                      <stat.icon size={24} />
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">{stat.label}</p>
                  <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Task Progress */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="text-indigo-600" size={24} />
                    Project Progress
                  </h2>
                  <button className="text-sm font-bold text-indigo-600 hover:underline">View All Tasks</button>
                </div>
                
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                  {tasks.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <AlertCircle size={48} className="mx-auto mb-3 opacity-20" />
                      <p className="font-medium">No active tasks visible to you yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {tasks.map((task) => (
                        <div key={task.id} className="p-6 hover:bg-slate-50 transition-all flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                              task.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                            )}>
                              {task.status === 'completed' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{task.title}</h4>
                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                <span className="font-bold uppercase tracking-wider">{task.serviceType}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Calendar size={12} />
                                  Due: {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                              task.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                            )}>
                              {task.status.replace('_', ' ')}
                            </span>
                            <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-600 transition-all" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* My Services Summary */}
              <div className="space-y-6">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Globe className="text-indigo-600" size={24} />
                  My Assets
                </h2>
                <div className="space-y-4">
                  {/* Domains Card */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold text-slate-900">Active Domains</p>
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg text-xs font-bold">{domains.length}</span>
                    </div>
                    <div className="space-y-3">
                      {domains.slice(0, 3).map(domain => (
                        <div key={domain.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">{domain.domainName}</span>
                          <span className="text-slate-400">{new Date(domain.expirationDate).toLocaleDateString()}</span>
                        </div>
                      ))}
                      {domains.length > 3 && (
                        <button className="w-full text-center text-[10px] font-bold text-indigo-600 hover:underline pt-2">
                          + {domains.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Journals Card */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold text-slate-900">My Journals</p>
                      <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg text-xs font-bold">{journals.length}</span>
                    </div>
                    <div className="space-y-3">
                      {journals.slice(0, 3).map(journal => (
                        <div key={journal.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium truncate max-w-[150px]">{journal.title}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase",
                            journal.status === 'complete' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          )}>
                            {journal.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="chat"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 min-h-0"
          >
            <ChatBoard currentUser={currentUser} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
