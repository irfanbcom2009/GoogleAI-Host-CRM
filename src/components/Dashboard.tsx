import React, { useState, useEffect } from 'react';
import { StatCard } from './StatCard';
import { JournalDistribution } from './Charts';
import { 
  Users, 
  Globe, 
  BookOpen, 
  FileCheck, 
  Plus, 
  AlertTriangle,
  Clock,
  CheckCircle2,
  MoreHorizontal,
  Loader2,
  Star,
  Trophy,
  DollarSign,
  CreditCard,
  TrendingDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Client, Domain, Journal, ISSNRequest, User as CRMUser, Invoice, ActivityLog, UserPermissions } from '../types';
import { geminiService } from '../services/geminiService';
import { Sparkles, Wand2 } from 'lucide-react';

interface DashboardProps {
  currentUser: CRMUser;
  setActiveTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, setActiveTab }) => {
  const [stats, setStats] = useState({
    clients: 0,
    domains: 0,
    journals: 0,
    pendingISSN: 0,
    totalRevenue: 0,
    outstandingInvoices: 0,
    totalExpenses: 0
  });
  const [topEmployee, setTopEmployee] = useState<CRMUser | null>(null);
  const [topClient, setTopClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    // Fetch recent activities
    const qActivities = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(20));
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      const activityData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];
      setActivities(activityData);
    });
    // Real-time stats
    const unsubClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snapshot) => {
      setStats(prev => ({ ...prev, clients: snapshot.size }));
    });

    const unsubDomains = onSnapshot(collection(db, 'domains'), (snapshot) => {
      setStats(prev => ({ ...prev, domains: snapshot.size }));
    });

    const unsubJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      setStats(prev => ({ ...prev, journals: snapshot.size }));
    });

    const qISSN = query(collection(db, 'issn_requests'), where('status', '==', 'pending'));
    const unsubISSN = onSnapshot(qISSN, (snapshot) => {
      setStats(prev => ({ ...prev, pendingISSN: snapshot.size }));
    });

    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snapshot) => {
      let revenue = 0;
      let outstanding = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data() as Invoice;
        if (data.status === 'paid') {
          revenue += data.total || 0;
        } else {
          outstanding += data.total || 0;
        }
      });
      setStats(prev => ({ ...prev, totalRevenue: revenue, outstandingInvoices: outstanding }));
    });

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      let total = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data() as any;
        total += data.amount || 0;
      });
      setStats(prev => ({ ...prev, totalExpenses: total }));
    });

    // Top performers
    const qTopEmp = query(collection(db, 'users'), orderBy('points', 'desc'), limit(1));
    const unsubTopEmp = onSnapshot(qTopEmp, (snapshot) => {
      if (!snapshot.empty) {
        setTopEmployee({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CRMUser);
      }
    });

    const qTopClient = query(collection(db, 'users'), where('role', '==', 'Client'), orderBy('points', 'desc'), limit(1));
    const unsubTopClient = onSnapshot(qTopClient, (snapshot) => {
      if (!snapshot.empty) {
        setTopClient({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Client);
      }
      setLoading(false);
    });

    return () => {
      unsubClients();
      unsubDomains();
      unsubJournals();
      unsubISSN();
      unsubTopEmp();
      unsubTopClient();
      unsubActivities();
      unsubExpenses();
    };
  }, []);

  const handleGenerateSummary = async () => {
    if (activities.length === 0) return;
    setIsSummarizing(true);
    const summary = await geminiService.summarizeActivity(activities);
    setAiSummary(summary);
    setIsSummarizing(false);
  };

  const hasPermission = (key: keyof UserPermissions) => {
    if (!currentUser.permissions) return true;
    return currentUser.permissions[key] !== false;
  };

  return (
    <div className="p-8 space-y-8">
      {/* Welcome Section */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome back, {currentUser.name.split(' ')[0]}!
          </h2>
          <p className="text-slate-500 mt-1">Real-time insights for Host A Journal Pvt Ltd.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
          >
            Export Report
          </button>
          <button 
            onClick={() => setActiveTab('workflow')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={20} />
            Quick Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm font-medium">Loading dashboard data...</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard 
              label="Total Clients" 
              value={stats.clients.toString()} 
              change={12.5} 
              icon={Users} 
              color="bg-indigo-500" 
            />
            {hasPermission('dataTools') && (
              <StatCard 
                label="Total Domains" 
                value={stats.domains.toString()} 
                change={8.2} 
                icon={Globe} 
                color="bg-emerald-500" 
              />
            )}
            {hasPermission('journals') && (
              <StatCard 
                label="Total Journals" 
                value={stats.journals.toString()} 
                change={5.4} 
                icon={BookOpen} 
                color="bg-amber-500" 
              />
            )}
            {hasPermission('issnRequests') && (
              <StatCard 
                label="Pending ISSN" 
                value={stats.pendingISSN.toString()} 
                change={-15.0} 
                icon={FileCheck} 
                color="bg-rose-500" 
              />
            )}
            {hasPermission('invoices') && (
              <>
                <StatCard 
                  label="Total Revenue" 
                  value={`$${(stats.totalRevenue || 0).toLocaleString()}`} 
                  change={0}
                  icon={DollarSign} 
                  color="bg-emerald-600" 
                />
                <StatCard 
                  label="Outstanding" 
                  value={`$${(stats.outstandingInvoices || 0).toLocaleString()}`} 
                  change={0}
                  icon={Clock} 
                  color="bg-amber-600" 
                />
              </>
            )}
            {hasPermission('expenses') && (
              <StatCard 
                label="Total Expenses" 
                value={`Rs. ${(stats.totalExpenses || 0).toLocaleString()}`} 
                change={0}
                icon={TrendingDown} 
                color="bg-rose-600" 
              />
            )}
          </div>

          {/* Alerts & AI Summary Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg">Recent Activity</h3>
                    <button 
                      onClick={handleGenerateSummary}
                      disabled={isSummarizing || activities.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold border border-indigo-100 hover:bg-indigo-100 transition-all disabled:opacity-50"
                    >
                      {isSummarizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      AI Summarize
                    </button>
                  </div>
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-bold border border-rose-100 uppercase tracking-widest">
                    Live Feed
                  </span>
                </div>

                {aiSummary && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2 text-[10px] font-black uppercase tracking-widest text-indigo-100">
                        <Sparkles size={14} />
                        AI Executive Summary
                      </div>
                      <p className="text-sm leading-relaxed font-medium">
                        {aiSummary}
                      </p>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-4">
                  {activities.length > 0 ? (
                    activities.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 border border-slate-100 shadow-sm font-bold text-xs">
                            {activity.userName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900">
                              <span className="text-indigo-600">{activity.userName}</span> {activity.action}
                            </p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock size={12} /> {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{activity.details}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center text-slate-400 italic text-sm">
                      No recent activities logged.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg">Critical Alerts</h3>
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-bold border border-rose-100 uppercase tracking-widest">
                    Real-time Monitoring
                  </span>
                </div>
                <div className="space-y-4">
                  {[
                    { id: 1, type: 'domain', title: 'Domain renewals pending', date: 'Check Domains Module', priority: 'high', permission: 'dataTools' },
                    { id: 2, type: 'issn', title: `${stats.pendingISSN} ISSN Requests pending`, date: 'Action Required', priority: 'high', permission: 'issnRequests' },
                    { id: 3, type: 'task', title: 'New tasks assigned today', date: 'Check Tasks', priority: 'medium' },
                    { id: 4, type: 'subscription', title: 'Monthly reports generated', date: 'Ready for Review', priority: 'medium' },
                  ].filter(alert => !alert.permission || hasPermission(alert.permission as keyof UserPermissions)).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${alert.priority === 'high' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{alert.title}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={12} /> {alert.date}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (alert.type === 'domain') setActiveTab('domains');
                          if (alert.type === 'issn') setActiveTab('issn');
                          if (alert.type === 'task') setActiveTab('tasks');
                          if (alert.type === 'subscription') setActiveTab('clients');
                        }}
                        className="text-indigo-600 text-sm font-bold opacity-0 group-hover:opacity-100 transition-all"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-lg mb-6">Points Summary</h3>
              <div className="space-y-6">
                {topEmployee && (
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-2">
                      <span className="flex items-center gap-1"><Star size={14} className="text-amber-400" /> Top Employee</span>
                      <span className="text-indigo-600">{(topEmployee.points || 0).toLocaleString()} pts</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase border border-slate-200">
                        {topEmployee.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900">{topEmployee.name}</p>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-indigo-500 w-[85%]"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {topClient && (
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-2">
                      <span className="flex items-center gap-1"><Trophy size={14} className="text-amber-400" /> Top Client</span>
                      <span className="text-emerald-600">{(topClient.points || 0).toLocaleString()} pts</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase border border-slate-200">
                        {topClient.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900">{topClient.name}</p>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-emerald-500 w-[65%]"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 text-center leading-relaxed italic">
                    Points are dynamically calculated based on task performance and client loyalty metrics.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          {hasPermission('journals') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg">Journal Distribution</h3>
                  <button 
                    onClick={() => setActiveTab('journals')}
                    className="text-indigo-600 text-sm font-semibold hover:underline"
                  >
                    View All
                  </button>
                </div>
                <JournalDistribution />
              </div>
            </div>
          )}

          {/* Recent Invoices Section */}
          {hasPermission('invoices') && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
              <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Recent Billing Activity</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-xs text-slate-500 font-medium">Paid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <span className="text-xs text-slate-500 font-medium">Unpaid</span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-8 py-4">Invoice ID</th>
                      <th className="px-8 py-4">Total Amount</th>
                      <th className="px-8 py-4 text-center">Status</th>
                      <th className="px-8 py-4 text-right">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <tr className="text-sm">
                      <td colSpan={4} className="px-8 py-16 text-center text-slate-400 italic">
                        <div className="flex flex-col items-center gap-2">
                          <CreditCard size={32} className="text-slate-200" />
                          <p>Access the Invoices module to manage all client billing and payments.</p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
