import React, { useState, useEffect } from 'react';
import { ClientDashboard } from './dashboards/ClientDashboard';
import { EmployeeDashboard } from './dashboards/EmployeeDashboard';
import { 
  Users, 
  Globe, 
  BookOpen, 
  FileCheck, 
  Plus, 
  AlertTriangle,
  Clock,
  Loader2,
  Star,
  Trophy,
  DollarSign,
  CreditCard,
  TrendingDown,
  Sparkles,
  ArrowRight,
  ClipboardList,
  CheckCircle2,
  Zap,
  Calendar,
  History,
  Eye,
  Check,
  EyeOff,
  Building2,
  GraduationCap
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { Client, Journal, User as CRMUser, Invoice, ActivityLog, Domain, ISSNRequest, Task } from '../types';
import { geminiService } from '../services/geminiService';
import { usePermissions } from '../hooks/usePermissions';
import { cn } from '../lib/utils';
import { StatCard } from './StatCard';
import { RevenueGrowthChart, TaskCompletionChart, JournalDistribution } from './Charts';
import { HelpIcon } from './HelpIcon';
import { Modal } from './Modal';

interface DashboardProps {
  currentUser: CRMUser;
  setActiveTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, setActiveTab }) => {
  const { canView } = usePermissions(currentUser);

  if (currentUser.role === 'Client') {
    return <ClientDashboard currentUser={currentUser} setActiveTab={setActiveTab} />;
  }

  if (currentUser.role === 'Employee') {
    return <EmployeeDashboard currentUser={currentUser} setActiveTab={setActiveTab} />;
  }

  // Admin Dashboard Content (Integrated directly or separated)
  return <AdminDashboard currentUser={currentUser} setActiveTab={setActiveTab} />;
};

const AdminDashboard: React.FC<DashboardProps> = ({ currentUser, setActiveTab }) => {
  const { canView } = usePermissions(currentUser);
  const [stats, setStats] = useState({
    clients: 0,
    domains: 0,
    journals: 0,
    pendingISSN: 0,
    pendingInvoices: 0,
    totalRevenue: 0,
    outstandingInvoices: 0,
    totalExpenses: 0,
    pendingRegistrations: 0
  });
  const [topEmployee, setTopEmployee] = useState<CRMUser | null>(null);
  const [topClient, setTopClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // New states for requested dashboard sections
  const [expiringSubscriptions, setExpiringSubscriptions] = useState<{client: Client, sub: any}[]>([]);
  const [latestDomains, setLatestDomains] = useState<Domain[]>([]);
  const [recentAccessedDomains, setRecentAccessedDomains] = useState<Domain[]>([]);
  const [latestJournals, setLatestJournals] = useState<Journal[]>([]);
  const [recentAccessedJournals, setRecentAccessedJournals] = useState<Journal[]>([]);
  const [latestApprovedISSN, setLatestApprovedISSN] = useState<ISSNRequest[]>([]);
  const [latestAddedISSN, setLatestAddedISSN] = useState<ISSNRequest[]>([]);
  const [latestOJS, setLatestOJS] = useState<Journal[]>([]);
  const [latestCompletedTasks, setLatestCompletedTasks] = useState<Task[]>([]);
  const [latestHECJournals, setLatestHECJournals] = useState<Journal[]>([]);
  const [latestPublishers, setLatestPublishers] = useState<any[]>([]);
  const [latestClients, setLatestClients] = useState<Client[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);

  useEffect(() => {
    // Latest Clients
    const qClients = query(collection(db, 'users'), where('role', '==', 'Client'), orderBy('createdAt', 'desc'), limit(5));
    const unsubClientsLatest = onSnapshot(qClients, (snapshot) => {
      setLatestClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Client));
    });

    // Latest HEC Approved Journals
    const qHEC = query(collection(db, 'journals'), where('hecCategory', 'in', ['W', 'X', 'Y', 'Z']), orderBy('createdAt', 'desc'), limit(5));
    const unsubHEC = onSnapshot(qHEC, (snapshot) => {
      setLatestHECJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Journal));
    });

    // Latest Publishers
    const qPubs = query(collection(db, 'publishers'), orderBy('createdAt', 'desc'), limit(5));
    const unsubPubs = onSnapshot(qPubs, (snapshot) => {
      setLatestPublishers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch recent activities
    const qActivities = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      const activityData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];
      setActivities(activityData);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'activity_logs'));

    // 1. Subscriptions Expiring in 30 Days (from Clients collection subscriptions array)
    const unsubExpiring = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snapshot) => {
      const expiring: {client: Client, sub: any}[] = [];
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const now = new Date();

      snapshot.docs.forEach(docSnap => {
        const client = { id: docSnap.id, ...docSnap.data() } as Client;
        if (client.subscriptions) {
          client.subscriptions.forEach(sub => {
            const expiryDate = new Date(sub.expiryDate);
            if (expiryDate <= thirtyDaysFromNow && expiryDate >= now && sub.status === 'active') {
              expiring.push({ client, sub });
            }
          });
        }
      });
      setExpiringSubscriptions(expiring.sort((a, b) => new Date(a.sub.expiryDate).getTime() - new Date(b.sub.expiryDate).getTime()));
    });

    // 2. Latest Added Domains
    const qLatestDomains = query(collection(db, 'domains'), orderBy('createdAt', 'desc'), limit(20));
    const unsubLatestDomains = onSnapshot(qLatestDomains, (snapshot) => {
      setLatestDomains(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Domain));
    });

    // 3. Recently Accessed Domains (proxy via activity logs)
    const unsubRecentDomains = onSnapshot(
      query(collection(db, 'activity_logs'), where('details', '>=', 'Domain:'), orderBy('details'), orderBy('timestamp', 'desc'), limit(10)),
      (snapshot) => {
        // This is a heuristic - we'll filter actual domains if we had a separate 'access_logs' for entities
        const uniqueDomains = new Set();
        snapshot.docs.forEach(d => {
          const data = d.data();
          if (data.details && !uniqueDomains.has(data.details)) {
            uniqueDomains.add(data.details);
          }
        });
      }
    );

    // 4. Latest Added Journals
    const qLatestJournals = query(collection(db, 'journals'), orderBy('createdAt', 'desc'), limit(20));
    const unsubLatestJournals = onSnapshot(qLatestJournals, (snapshot) => {
      setLatestJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Journal));
    });

    // 5. Latest Approved ISSN
    const qLatestAppISSN = query(collection(db, 'issn_requests'), where('status', '==', 'approved'), orderBy('modifiedDate', 'desc'), limit(20));
    const unsubLatestAppISSN = onSnapshot(qLatestAppISSN, (snapshot) => {
      setLatestApprovedISSN(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ISSNRequest));
    });

    // 6. Latest Added ISSN
    const qLatestAddISSN = query(collection(db, 'issn_requests'), orderBy('createdAt', 'desc'), limit(20));
    const unsubLatestAddISSN = onSnapshot(qLatestAddISSN, (snapshot) => {
      setLatestAddedISSN(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ISSNRequest));
    });

    // 7. Latest Installed OJS (Journals with ojsVersion and sorted)
    const qLatestOJS = query(collection(db, 'journals'), where('ojsVersion', '!=', ''), orderBy('ojsVersion', 'desc'), limit(20));
    const unsubLatestOJS = onSnapshot(qLatestOJS, (snapshot) => {
      setLatestOJS(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Journal));
    });

    // 8. Latest Completed Editorial task on Journals
    const qLatestTasks = query(collection(db, 'tasks'), where('serviceType', '==', 'Editorial'), where('status', '==', 'completed'), orderBy('completedAt', 'desc'), limit(20));
    const unsubLatestTasks = onSnapshot(qLatestTasks, (snapshot) => {
      setLatestCompletedTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Task));
    });

    // Real-time stats
    const unsubClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snapshot) => {
      setStats(prev => ({ ...prev, clients: snapshot.size }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const unsubDomains = onSnapshot(collection(db, 'domains'), (snapshot) => {
      setStats(prev => ({ ...prev, domains: snapshot.size }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'domains'));

    const unsubJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      setStats(prev => ({ ...prev, journals: snapshot.size }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'journals'));

    const qISSN = query(collection(db, 'issn_requests'), where('status', '==', 'pending'));
    const unsubISSN = onSnapshot(qISSN, (snapshot) => {
      setStats(prev => ({ ...prev, pendingISSN: snapshot.size }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'issn_requests'));

    const unsubPendingInvoices = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'Client')), 
      (snapshot) => {
        let pendingCount = 0;
        snapshot.docs.forEach(doc => {
          const data = doc.data() as any;
          if (data.subscriptions) {
            pendingCount += data.subscriptions.filter((s: any) => !s.invoiceId).length;
          }
        });
        setStats(prev => ({ ...prev, pendingInvoices: pendingCount }));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'users')
    );

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
    }, (error) => handleFirestoreError(error, OperationType.GET, 'invoices'));

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      let total = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data() as any;
        total += data.amount || 0;
      });
      setStats(prev => ({ ...prev, totalExpenses: total }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'expenses'));

    const unsubRegistrations = onSnapshot(
      query(collection(db, 'registration_requests'), where('status', '==', 'pending')),
      (snapshot) => {
        setStats(prev => ({ ...prev, pendingRegistrations: snapshot.size }));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'registration_requests')
    );

    // Fetch Recently Accessed via simpler activity log query
    const qAccessed = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubAccessed = onSnapshot(qAccessed, (snapshot) => {
      const domainActivities = snapshot.docs
        .map(d => d.data())
        .filter(a => a.action.toLowerCase().includes('domain') || a.details.toLowerCase().includes('domain'))
        .slice(0, 5);
      
      const journalActivities = snapshot.docs
        .map(d => d.data())
        .filter(a => a.action.toLowerCase().includes('journal') || a.details.toLowerCase().includes('journal'))
        .slice(0, 5);
      
      // We'll store these in a way the UI can render
      (window as any)._recentlyAccessedDomains = domainActivities;
      (window as any)._recentlyAccessedJournals = journalActivities;
    });

    // Top performers
    const qTopEmp = query(collection(db, 'users'), orderBy('points', 'desc'), limit(1));
    const unsubTopEmp = onSnapshot(qTopEmp, (snapshot) => {
      if (!snapshot.empty) {
        setTopEmployee({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CRMUser);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const qTopClient = query(collection(db, 'users'), where('role', '==', 'Client'), orderBy('points', 'desc'), limit(1));
    const unsubTopClient = onSnapshot(qTopClient, (snapshot) => {
      if (!snapshot.empty) {
        setTopClient({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Client);
      }
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    return () => {
      unsubClientsLatest();
      unsubHEC();
      unsubPubs();
      unsubActivities();
      unsubExpiring();
      unsubLatestDomains();
      unsubRecentDomains();
      unsubLatestJournals();
      unsubLatestAppISSN();
      unsubLatestAddISSN();
      unsubLatestOJS();
      unsubLatestTasks();
      unsubClients();
      unsubDomains();
      unsubJournals();
      unsubISSN();
      unsubPendingInvoices();
      unsubInvoices();
      unsubExpenses();
      unsubRegistrations();
      unsubAccessed();
      unsubTopEmp();
      unsubTopClient();
    };
  }, []);

  const handleGenerateSummary = async () => {
    if (activities.length === 0) return;
    setIsSummarizing(true);
    const summary = await geminiService.summarizeActivity(activities);
    setAiSummary(summary);
    setIsSummarizing(false);
  };

  const handleMarkRead = async (activityId: string) => {
    try {
      await updateDoc(doc(db, 'activity_logs', activityId), { isRead: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'activity_logs');
    }
  };

  const handleHideActivity = async (activityId: string) => {
    try {
      await updateDoc(doc(db, 'activity_logs', activityId), { isHidden: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'activity_logs');
    }
  };

  const activeActivities = activities.filter(a => !a.isHidden).slice(0, 20);

  return (
    <div className="p-8 space-y-8">
      {/* Welcome Section */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome back, {currentUser.name.split(' ')[0]}!
            <HelpIcon policyTitle="Admin Dashboard Overview" />
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

      {/* NEW: Subscriptions Expiring Section */}
      {expiringSubscriptions.length > 0 && (
        <section className="bg-rose-50 border border-rose-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-rose-500 text-white rounded-xl">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-rose-900 leading-none">Subscriptions Expiring in 30 Days</h3>
              <p className="text-xs text-rose-600 mt-1">Proactively manage upcoming renewals to ensure service continuity.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {expiringSubscriptions.map(({client, sub}, idx) => (
              <div key={`${client.id}-${idx}`} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between group hover:border-rose-300 transition-all">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold uppercase">{sub.service}</span>
                    <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                      <Clock size={10} /> {Math.ceil((new Date(sub.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 truncate">{client.name}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <Calendar size={12} /> {new Date(sub.expiryDate).toLocaleDateString()}
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTab('invoices')}
                  className="mt-4 w-full py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-all opacity-0 group-hover:opacity-100"
                >
                  Create Invoice
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm font-medium">Loading dashboard data...</p>
        </div>
      ) : (
        <>
          {/* New Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Latest Clients */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Users size={20} className="text-indigo-600" />
                  Latest Clients
                </h3>
                <button onClick={() => setActiveTab('clients')} className="text-xs font-bold text-indigo-600 hover:underline">View All</button>
              </div>
              <div className="space-y-4">
                {latestClients.length > 0 ? latestClients.map(client => (
                  <div key={client.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('clients')}>
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                      {client.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{client.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-black">{client.phone || 'Individual'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400">{new Date(client.createdAt as any).toLocaleDateString()}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-center py-4 text-slate-400 text-sm italic">No recent clients.</p>
                )}
              </div>
            </div>

            {/* Latest Publishers */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Building2 size={20} className="text-emerald-600" />
                  Latest Publishers
                </h3>
                <button onClick={() => setActiveTab('publishers')} className="text-xs font-bold text-emerald-600 hover:underline">View All</button>
              </div>
              <div className="space-y-4">
                {latestPublishers.length > 0 ? latestPublishers.map(pub => (
                  <div key={pub.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('publishers')}>
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold border border-emerald-100 uppercase">
                      {pub.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-emerald-600 transition-colors">{pub.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-black">{pub.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400">{new Date(pub.createdAt as any).toLocaleDateString()}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-center py-4 text-slate-400 text-sm italic">No recent publishers.</p>
                )}
              </div>
            </div>

            {/* HEC Approved Journals */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <GraduationCap size={20} className="text-amber-600" />
                  HEC Approved Journals
                </h3>
                <button onClick={() => setActiveTab('hec')} className="text-xs font-bold text-amber-600 hover:underline">View All</button>
              </div>
              <div className="space-y-4">
                {latestHECJournals.length > 0 ? latestHECJournals.map(journal => (
                  <div key={journal.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('hec')}>
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-extrabold border border-amber-100">
                      {journal.category || 'HEC'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-amber-600 transition-colors">{journal.title}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-black">{journal.issnOnline || journal.issnPrint || 'No ISSN'}</p>
                    </div>
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-amber-500 transition-all shrink-0" />
                  </div>
                )) : (
                  <p className="text-center py-4 text-slate-400 text-sm italic">No HEC journals found.</p>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <StatCard 
              label="Total Clients" 
              value={stats.clients.toString()} 
              change={12.5} 
              icon={Users} 
              color="bg-indigo-500" 
            />
            {canView('domains') && (
              <StatCard 
                label="Total Domains" 
                value={stats.domains.toString()} 
                change={8.2} 
                icon={Globe} 
                color="bg-emerald-500" 
              />
            )}
            {canView('journals') && (
              <StatCard 
                label="Total Journals" 
                value={stats.journals.toString()} 
                change={5.4} 
                icon={BookOpen} 
                color="bg-amber-500" 
              />
            )}
            {canView('issnRequests') && (
              <StatCard 
                label="Pending ISSN" 
                value={stats.pendingISSN.toString()} 
                change={-15.0} 
                icon={FileCheck} 
                color="bg-rose-500" 
              />
            )}
            {canView('invoices') && (
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
            {canView('expenses') && (
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
                  {activeActivities.length > 0 ? (
                    activeActivities.map((activity, idx) => (
                      <div key={`${activity.id}-${idx}`} className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all group relative",
                        activity.isRead ? "bg-white border-slate-100 opacity-60" : "bg-slate-50 border-slate-100 hover:border-indigo-200"
                      )}>
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center border shadow-sm font-bold text-xs overflow-hidden",
                            activity.isRead ? "bg-slate-50 text-slate-400 border-slate-100" : "bg-white text-indigo-600 border-slate-100"
                          )}>
                            {activity.userPhotoURL ? (
                              <img src={activity.userPhotoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              activity.userName.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className={cn(
                              "font-bold text-sm",
                              activity.isRead ? "text-slate-500" : "text-slate-900"
                            )}>
                              <span className="text-indigo-600">{activity.userName}</span> {activity.action}
                            </p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock size={12} /> {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-4 hidden group-hover:block">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{activity.details}</p>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setSelectedActivity(activity)}
                              title="View Details"
                              className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-400 transition-all border border-transparent hover:border-slate-100 shadow-sm"
                            >
                              <Eye size={14} />
                            </button>
                            {!activity.isRead && (
                              <button 
                                onClick={() => handleMarkRead(activity.id)}
                                title="Mark as Read"
                                className="p-1.5 hover:bg-white hover:text-emerald-600 rounded-lg text-slate-400 transition-all border border-transparent hover:border-slate-100 shadow-sm"
                              >
                                <Check size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleHideActivity(activity.id)}
                              title="Hide from Homepage"
                              className="p-1.5 hover:bg-white hover:text-rose-600 rounded-lg text-slate-400 transition-all border border-transparent hover:border-slate-100 shadow-sm"
                            >
                              <EyeOff size={14} />
                            </button>
                          </div>
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
                    { id: 1, type: 'domain', title: 'Domain renewals pending', date: 'Check Domains Module', priority: 'high', permission: 'domains' },
                    { id: 2, type: 'issn', title: `${stats.pendingISSN} ISSN Requests pending`, date: 'Action Required', priority: 'high', permission: 'issnRequests' },
                    { id: 6, type: 'registration', title: `${stats.pendingRegistrations} Registration Requests`, date: 'Review Required', priority: 'high', roles: ['Admin', 'Manager'] },
                    { id: 5, type: 'invoice', title: `${stats.pendingInvoices} Services pending invoice`, date: 'Action Required', priority: 'high', permission: 'invoices' },
                    { id: 3, type: 'task', title: 'New tasks assigned today', date: 'Check Tasks', priority: 'medium' },
                    { id: 4, type: 'subscription', title: 'Monthly reports generated', date: 'Ready for Review', priority: 'medium' },
                  ].filter(alert => {
                    if (alert.permission && !canView(alert.permission as any)) return false;
                    if (alert.roles && !alert.roles.includes(currentUser.role)) return false;
                    return true;
                  }).map((alert) => (
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
                          if (alert.type === 'invoice') setActiveTab('invoices');
                          if (alert.type === 'task') setActiveTab('tasks');
                          if (alert.type === 'subscription') setActiveTab('clients');
                          if (alert.type === 'registration') setActiveTab('registration-requests');
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
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase border border-slate-200 overflow-hidden">
                        {topEmployee.photoURL ? (
                          <img src={topEmployee.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          topEmployee.name.charAt(0)
                        )}
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
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase border border-slate-200 overflow-hidden">
                        {topClient.photoURL ? (
                          <img src={topClient.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          topClient.name.charAt(0)
                        )}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-lg">Revenue Growth</h3>
                  <p className="text-xs text-slate-500">Monthly breakdown of registered clients</p>
                </div>
              </div>
              <RevenueGrowthChart />
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-lg">Task Distribution</h3>
                  <p className="text-xs text-slate-500">Current workflow status allocation</p>
                </div>
              </div>
              <TaskCompletionChart />
            </div>
          </div>

          {canView('journals') && (
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

              {/* Latest Added Journals & Recently Accessed */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <BookOpen size={20} className="text-indigo-600" />
                    Latest Added Journals
                  </h3>
                  <div className="space-y-3">
                    {latestJournals.length > 0 ? latestJournals.map(journal => (
                      <div key={journal.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-600 border border-slate-100 font-bold text-xs uppercase">
                            {journal.title.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[200px]">{journal.title}</p>
                            <p className="text-[10px] text-slate-500">Added {new Date(journal.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-all" />
                      </div>
                    )) : (
                      <p className="text-center py-4 text-slate-400 text-sm italic">No journals found.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <History size={20} className="text-indigo-600" />
                    Recently Accessed Journals (By employee)
                  </h3>
                  <div className="space-y-3">
                    {((window as any)._recentlyAccessedJournals || []).length > 0 ? (window as any)._recentlyAccessedJournals.map((act: any, idx: number) => (
                      <div key={`rec-j-${idx}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-indigo-400 border border-slate-100 font-bold text-[10px]">
                          {act.userName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-[11px] text-slate-900">{act.userName}</p>
                          <p className="text-[10px] text-slate-500">{act.action} - {act.details}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-center py-4 text-slate-400 text-sm italic">No recent access logs.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ISSN & Domains Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ISSN Management */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <FileCheck size={20} className="text-rose-600" />
                  Latest Approved ISSN
                </h3>
                <div className="space-y-3">
                  {latestApprovedISSN.map((issn, idx) => (
                    <div key={`${issn.id}-${idx}`} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                      <div>
                        <p className="font-bold text-xs text-slate-900">{issn.journalTitle}</p>
                        <div className="flex gap-2 items-center mt-1">
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase">Approved</span>
                          <span className="text-[10px] text-slate-500 font-medium">#{issn.requestNo}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{issn.printIssn || issn.onlineIssn || 'ISSN Set'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Plus size={20} className="text-indigo-600" />
                  Latest Added ISSN
                </h3>
                <div className="space-y-3">
                  {latestAddedISSN.map((issn, idx) => (
                    <div key={`${issn.id}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="font-bold text-xs text-slate-900">{issn.journalTitle}</p>
                        <div className="flex gap-2 items-center mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${issn.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                            {issn.status}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">By {issn.clientName}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold">{new Date(issn.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Domains Management */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Globe size={20} className="text-emerald-600" />
                  Latest Added Domains
                </h3>
                  <div className="space-y-3">
                    {latestDomains.map((domain, idx) => (
                      <div key={`${domain.id}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group cursor-pointer hover:border-emerald-200 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-emerald-600 border border-slate-100">
                            <Globe size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-900 group-hover:text-emerald-600 transition-colors">{domain.domainName}</p>
                            <p className="text-[10px] text-slate-500">{domain.registrar} • Exp: {new Date(domain.expirationDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-500" />
                      </div>
                    ))}
                  </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <History size={20} className="text-emerald-600" />
                    Recently Accessed Domains (By employee)
                  </h3>
                  <div className="space-y-3">
                    {((window as any)._recentlyAccessedDomains || []).length > 0 ? (window as any)._recentlyAccessedDomains.map((act: any, idx: number) => (
                      <div key={`rec-d-${idx}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-emerald-400 border border-slate-100 font-bold text-[10px]">
                          {act.userName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-[11px] text-slate-900">{act.userName}</p>
                          <p className="text-[10px] text-slate-500">{act.action} - {act.details}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-center py-4 text-slate-400 text-sm italic">No recent access logs.</p>
                    )}
                  </div>
                </div>
            </div>
          </div>

          {/* OJS & Tasks Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Zap size={20} className="text-amber-600" />
                Latest Installed OJS
              </h3>
              <div className="space-y-3">
                {latestOJS.map((journal, idx) => (
                  <div key={`${journal.id}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{journal.title}</p>
                      <p className="text-[10px] text-slate-500">Version: <span className="text-amber-600 font-bold">{journal.ojsVersion}</span></p>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-black uppercase decoration-amber-100">Installed</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-indigo-600" />
                Latest Completed Editorial task on Journals
              </h3>
              <div className="space-y-3">
                {latestCompletedTasks.map((task, idx) => (
                  <div key={`${task.id}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{task.title}</p>
                      <p className="text-[10px] text-slate-500">Completed by {task.assignedToName} • {new Date(task.completedAt!).toLocaleDateString()}</p>
                    </div>
                    <ClipboardList size={14} className="text-slate-300" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Invoices Section */}
          {canView('invoices') && (
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
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                    <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
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

      {/* Activity Details Modal */}
      <Modal
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        title="Activity Details"
        maxWidth="lg"
      >
        {selectedActivity && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200 overflow-hidden">
                {selectedActivity.userPhotoURL ? (
                  <img src={selectedActivity.userPhotoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  selectedActivity.userName.charAt(0)
                )}
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-lg">{selectedActivity.userName}</h4>
                <p className="text-sm font-bold text-indigo-600">{selectedActivity.action}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 bg-white border border-slate-100 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</span>
                <p className="text-slate-700 font-medium">{selectedActivity.details}</p>
              </div>
              
              <div className="p-4 bg-white border border-slate-100 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</span>
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <Clock size={16} className="text-slate-400" />
                  {new Date(selectedActivity.timestamp).toLocaleString()}
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-100 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User ID</span>
                <p className="text-slate-500 font-mono text-xs">{selectedActivity.userId}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-50">
              {!selectedActivity.isRead && (
                <button 
                  onClick={() => {
                    handleMarkRead(selectedActivity.id);
                    setSelectedActivity(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  <Check size={18} />
                  Mark Read
                </button>
              )}
              <button 
                onClick={() => {
                  handleHideActivity(selectedActivity.id);
                  setSelectedActivity(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold hover:bg-rose-100 transition-all"
              >
                <EyeOff size={18} />
                Hide
              </button>
              <button 
                onClick={() => setSelectedActivity(null)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
