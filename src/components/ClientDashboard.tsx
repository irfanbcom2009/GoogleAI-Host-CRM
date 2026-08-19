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
  AlertCircle,
  Receipt
} from 'lucide-react';
import { HelpIcon } from './HelpIcon';
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
import { User as UserType, Domain, Journal, Task, Invoice, PaymentReceived } from '../types';
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
  const [payments, setPayments] = useState<PaymentReceived[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'chat'>('overview');

  useEffect(() => {
    if (!currentUser.id) return;

    // Fetch client's domains
    const unsubscribeDomains = onSnapshot(
      query(collection(db, 'domains'), where('clientId', '==', currentUser.id)),
      (snapshot) => {
        setDomains(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Domain[]);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'domains')
    );

    // Fetch client's journals
    const unsubscribeJournals = onSnapshot(
      query(collection(db, 'journals'), where('clientId', '==', currentUser.id)),
      (snapshot) => {
        setJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Journal[]);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'journals')
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
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'tasks')
    );

    // Fetch client's payments received
    const unsubscribePayments = onSnapshot(
      query(
        collection(db, 'paymentsReceived'),
        where('clientId', '==', currentUser.id),
        orderBy('date', 'desc')
      ),
      (snapshot) => {
        setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PaymentReceived[]);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'paymentsReceived');
        setLoading(false);
      }
    );

    return () => {
      unsubscribeDomains();
      unsubscribeJournals();
      unsubscribeTasks();
      unsubscribePayments();
    };
  }, [currentUser.id]);

  const totalPaid = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const stats = [
    { label: 'Active Services', value: domains.filter(d => d.status === 'active').length + journals.filter(j => j.status === 'complete').length, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pending Tasks', value: tasks.filter(t => t.status !== 'completed').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Payments Received (+)', value: `+$${totalPaid.toLocaleString()}`, icon: Receipt, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Live Points', value: currentUser.points || 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
    <div className={cn(
      "max-w-full mx-auto px-4 md:px-8 lg:px-12 flex flex-col w-full transition-all",
      activeView === 'chat' ? "h-full overflow-hidden p-3 sm:p-4" : "p-4 sm:p-8 space-y-6 sm:space-y-8"
    )}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 flex-wrap">
            Welcome, {currentUser.name.split(' ')[0]}!
            <HelpIcon policyTitle="Client Portal Access Policy" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Manage your active services and new requests here.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab('dynamic-service')}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-black text-xs sm:text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <Package size={16} className="group-hover:rotate-12 transition-transform" />
            Place New Order
          </button>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 justify-between w-full sm:w-auto">
            <button 
              onClick={() => setActiveView('overview')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 flex-1 sm:flex-initial",
                activeView === 'overview' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <LayoutDashboard size={16} />
              Overview
            </button>
            <button 
              onClick={() => setActiveView('chat')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 flex-1 sm:flex-initial",
                activeView === 'chat' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <MessageSquare size={16} />
              Support
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'overview' ? (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8 overflow-y-auto pr-2 pb-8"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {stats.map((stat, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={stat.label}
                  onClick={() => {
                    if (stat.label === 'Unpaid Invoices') setActiveTab('invoices');
                    if (stat.label === 'Pending Tasks') setActiveTab('tasks');
                  }}
                  className={cn(
                    "bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50/50 transition-all group",
                    (stat.label === 'Unpaid Invoices' || stat.label === 'Pending Tasks') && "cursor-pointer"
                  )}
                >
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <div className={cn("p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                      <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    {stat.label === 'Live Points' && (
                      <span className="hidden xs:inline-block text-[8px] sm:text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Real-time</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] mb-0.5 sm:mb-1 truncate">{stat.label}</p>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{stat.value}</h3>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Task Hub */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <Clock className="text-indigo-600" size={24} />
                    Active Tasks
                  </h2>
                  <button onClick={() => setActiveTab('tasks')} className="text-xs font-bold text-indigo-600 hover:underline px-3 py-1 bg-indigo-50 rounded-lg">Manage All Tasks</button>
                </div>
                
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                  {tasks.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                        <CheckCircle2 size={32} className="opacity-20" />
                      </div>
                      <p className="font-bold text-sm">All clear! No pending tasks right now.</p>
                      <button onClick={() => setActiveTab('dynamic-service')} className="mt-4 text-xs font-bold text-indigo-600 hover:underline">Start a new project</button>
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <div key={task.id} className="p-4 sm:p-5 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border shrink-0 mt-0.5 sm:mt-0",
                            task.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                          )}>
                            {task.status === 'completed' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm break-words">{task.title}</h4>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">
                              <span className="text-indigo-600">{task.serviceType}</span>
                              <span className="opacity-30 hidden xs:inline">|</span>
                              <span className="flex items-center gap-1">
                                <Calendar size={10} />
                                Due: {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100/60 shrink-0">
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                            task.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                          )}>
                            {task.status.replace('_', ' ')}
                          </span>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-all hidden sm:block" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Unified Services Hub */}
              <div className="space-y-6">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Package className="text-indigo-600" size={24} />
                  My Services
                </h2>
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Inventory</span>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{domains.length + journals.length} TOTAL</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto max-h-[400px] p-2 space-y-2">
                    {[...domains, ...journals].map((service: any) => {
                      const isDomain = 'domainName' in service;
                      const isActive = isDomain ? service.status === 'active' : service.status === 'complete';
                      
                      return (
                        <div key={service.id} className="p-3 bg-white border border-slate-50 hover:border-indigo-100 rounded-2xl transition-all group">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center",
                                isDomain ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                              )}>
                                {isDomain ? <Globe size={16} /> : <FileText size={16} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {isDomain ? service.domainName : service.title}
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                  {isDomain ? 'Domain Registration' : 'Journal Management'}
                                </p>
                              </div>
                            </div>
                            <span className={cn(
                              "w-2 h-2 rounded-full mt-1.5",
                              isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300"
                            )}></span>
                          </div>
                        </div>
                      );
                    })}
                    
                    {domains.length === 0 && journals.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                        <Package size={32} className="text-slate-200 mb-2" />
                        <p className="text-xs font-bold text-slate-400">No services found</p>
                        <button onClick={() => setActiveTab('dynamic-service')} className="mt-2 text-[10px] font-black text-indigo-600 uppercase hover:underline">Get Started</button>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 bg-indigo-50/50 border-t border-slate-100">
                    <button 
                      onClick={() => setActiveTab('dynamic-service')}
                      className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      New Request
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Billing Alert Card */}
                {currentUser.subscriptions && currentUser.subscriptions.some(s => !s.invoiceId) && (
                  <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 shadow-sm">
                    <div className="flex items-center gap-3 text-rose-600 mb-3">
                      <AlertCircle size={20} />
                      <p className="text-sm font-bold">Pending Invoices</p>
                    </div>
                    <p className="text-xs text-rose-500 leading-relaxed mb-4">
                      You have services subscribed that are pending invoice generation. Please contact support.
                    </p>
                    <button 
                      onClick={() => setActiveView('chat')}
                      className="w-full py-2 bg-rose-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-rose-700 transition-all"
                    >
                      Contact Support
                    </button>
                  </div>
                )}

                {/* Quick Support Card */}
                <div className="bg-indigo-900 rounded-[2rem] p-6 text-white overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                    <MessageSquare size={80} />
                  </div>
                  <div className="relative z-10">
                    <h4 className="font-black text-lg mb-2">Need help?</h4>
                    <p className="text-xs text-indigo-200 leading-relaxed mb-4">Our dedicated team is ready to assist you.</p>
                    <button 
                      onClick={() => setActiveView('chat')}
                      className="px-4 py-2 bg-white text-indigo-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all"
                    >
                      Open Live Chat
                    </button>
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
