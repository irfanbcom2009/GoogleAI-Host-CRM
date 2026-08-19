import React, { useState, useEffect } from 'react';
import { ClientDashboard } from './dashboards/ClientDashboard';
import { EmployeeDashboard } from './dashboards/EmployeeDashboard';
import { DEFAULT_IMAGES } from '../constants/images';
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
  GraduationCap,
  Settings,
  ChevronUp,
  ChevronDown,
  Save,
  Layout as LayoutIcon,
  X,
  Activity,
  RefreshCw,
  FileText,
  User
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { Client, Journal, User as CRMUser, Invoice, ActivityLog, Domain, ISSNRequest, Task, DashboardCardConfig } from '../types';
import { geminiService } from '../services/geminiService';
import { usePermissions } from '../hooks/usePermissions';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { StatCard } from './StatCard';
import { RevenueGrowthChart, TaskCompletionChart, JournalDistribution } from './Charts';
import { HelpIcon } from './HelpIcon';
import { Modal } from './Modal';

const formatTimeAgo = (dateInput: any): string => {
  if (!dateInput) return 'just now';
  
  let date: Date;
  if (typeof dateInput.toDate === 'function') {
    date = dateInput.toDate();
  } else if (dateInput.seconds !== undefined) {
    date = new Date(dateInput.seconds * 1000);
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) {
    return 'unknown';
  }

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  
  return `${Math.floor(months / 12)}y ago`;
};

interface DashboardProps {
  currentUser: CRMUser;
  setActiveTab: (tab: string) => void;
  onSelectClient?: (clientId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, setActiveTab, onSelectClient }) => {
  const { canView } = usePermissions(currentUser);

  if (currentUser.role === 'Client') {
    return <ClientDashboard currentUser={currentUser} setActiveTab={setActiveTab} />;
  }

  if (currentUser.role === 'Employee') {
    return <EmployeeDashboard currentUser={currentUser} setActiveTab={setActiveTab} />;
  }

  // Admin Dashboard Content (Integrated directly or separated)
  return <AdminDashboard currentUser={currentUser} setActiveTab={setActiveTab} onSelectClient={onSelectClient} />;
};

const DASHBOARD_CARDS = [
  { id: 'expiringSubscriptions', label: 'Expiring Subscriptions' },
  { id: 'summaryGrid', label: 'Overview Grid (Clients, Publishers, HEC)' },
  { id: 'statsGrid', label: 'Key Stats Cards' },
  { id: 'alertsActivityGrid', label: 'Activity, Alerts & Points Hub' },
  { id: 'chartsSection', label: 'Performance Charts' },
  { id: 'journalDistribution', label: 'Journal Distribution Graph' },
  { id: 'journalsManagement', label: 'Latest Journals List' },
  { id: 'issnManagement', label: 'ISSN Approval Tracking' },
  { id: 'domainsManagement', label: 'Domain & Hosting Status' },
  { id: 'ojsTasksSection', label: 'OJS & Editorial Tasks' },
  { id: 'recentBilling', label: 'Recent Billing activity' },
];

const AdminDashboard: React.FC<DashboardProps> = ({ currentUser, setActiveTab, onSelectClient }) => {
  const { canView } = usePermissions(currentUser);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardCardConfig[]>(() => {
    const base = currentUser.dashboardConfig || DASHBOARD_CARDS.map((card, idx) => ({ id: card.id, isVisible: true, order: idx }));
    const uniqueMap = new Map();
    base.forEach(item => {
      if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
    });
    return Array.from(uniqueMap.values());
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [stats, setStats] = useState({
    clients: 0,
    domains: 0,
    journals: 0,
    pendingISSN: 0,
    pendingInvoices: 0,
    totalRevenuePKR: 0,
    totalRevenueUSD: 0,
    outstandingInvoicesPKR: 0,
    outstandingInvoicesUSD: 0,
    totalExpensesPKR: 0,
    totalExpensesUSD: 0,
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
  const [clientJournalNames, setClientJournalNames] = useState<{[clientId: string]: string}>({});
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);

  useEffect(() => {
    if (currentUser.dashboardConfig) {
      const uniqueMap = new Map();
      currentUser.dashboardConfig.forEach((item: any) => {
        if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
      });
      setDashboardConfig(Array.from(uniqueMap.values()));
    }
  }, [currentUser.dashboardConfig]);

  useEffect(() => {
    // Latest Clients
    const qClients = query(collection(db, 'users'), where('role', '==', 'Client'), orderBy('createdAt', 'desc'), limit(8));
    const unsubClientsLatest = onSnapshot(qClients, (snapshot) => {
      setLatestClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Client));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    // Latest HEC Approved Journals
    const qHEC = query(collection(db, 'journals'), where('hecCategory', 'in', ['W', 'X', 'Y', 'Z']), orderBy('createdAt', 'desc'), limit(8));
    const unsubHEC = onSnapshot(qHEC, (snapshot) => {
      setLatestHECJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Journal));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'journals'));

    // Latest Publishers
    const qPubs = query(collection(db, 'publishers'), orderBy('createdAt', 'desc'), limit(8));
    const unsubPubs = onSnapshot(qPubs, (snapshot) => {
      setLatestPublishers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'publishers'));

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
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    // 2. Latest Added Domains
    const qLatestDomains = query(collection(db, 'domains'), orderBy('createdAt', 'desc'), limit(5));
    const unsubLatestDomains = onSnapshot(qLatestDomains, (snapshot) => {
      setLatestDomains(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Domain));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'domains'));

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
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'activity_logs')
    );

    // 4. Latest Added Journals
    const qLatestJournals = query(collection(db, 'journals'), orderBy('createdAt', 'desc'), limit(8));
    const unsubLatestJournals = onSnapshot(qLatestJournals, (snapshot) => {
      setLatestJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Journal));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'journals'));

    // 5. Latest Approved ISSN
    const qLatestAppISSN = query(collection(db, 'issn_requests'), where('status', '==', 'approved'), orderBy('modifiedDate', 'desc'), limit(8));
    const unsubLatestAppISSN = onSnapshot(qLatestAppISSN, (snapshot) => {
      setLatestApprovedISSN(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ISSNRequest));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'issn_requests'));

    // 6. Latest Added ISSN
    const qLatestAddISSN = query(collection(db, 'issn_requests'), orderBy('createdAt', 'desc'), limit(8));
    const unsubLatestAddISSN = onSnapshot(qLatestAddISSN, (snapshot) => {
      setLatestAddedISSN(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ISSNRequest));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'issn_requests'));

    // 7. Latest Installed OJS (Journals with ojsVersion and sorted)
    const qLatestOJS = query(collection(db, 'journals'), where('ojsVersion', '!=', ''), orderBy('ojsVersion', 'desc'), limit(8));
    const unsubLatestOJS = onSnapshot(qLatestOJS, (snapshot) => {
      setLatestOJS(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Journal));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'journals'));

    // 8. Latest Completed Editorial task on Journals
    const qLatestTasks = query(collection(db, 'tasks'), where('serviceType', '==', 'Editorial'), where('status', '==', 'completed'), orderBy('completedAt', 'desc'), limit(8));
    const unsubLatestTasks = onSnapshot(qLatestTasks, (snapshot) => {
      setLatestCompletedTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Task));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'tasks'));

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

    const unsubPaymentsReceived = onSnapshot(collection(db, 'paymentsReceived'), (snapshot) => {
      onSnapshot(doc(db, 'settings', 'global'), (settingsSnap) => {
        const settings = settingsSnap.exists() ? settingsSnap.data() as any : {};
        const usdPkrRate = settings.usdPkrRate || 280;

        let revenuePKR = 0;
        let revenueUSD = 0;

        snapshot.docs.forEach(doc => {
          const data = doc.data() as any;
          const isUSD = data.currency !== 'PKR';
          const amount = data.amount || 0;

          revenueUSD += isUSD ? amount : amount / usdPkrRate;
          revenuePKR += isUSD ? amount * usdPkrRate : amount;
        });

        setStats(prev => ({ 
          ...prev, 
          totalRevenuePKR: revenuePKR, 
          totalRevenueUSD: revenueUSD
        }));
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'paymentsReceived'));

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      onSnapshot(doc(db, 'settings', 'global'), (settingsSnap) => {
        const settings = settingsSnap.exists() ? settingsSnap.data() as any : {};
        const usdPkrRate = settings.usdPkrRate || 280;

        let totalPKR = 0;
        let totalUSD = 0;

        snapshot.docs.forEach(doc => {
          const data = doc.data() as any;
          const isUSD = data.currency === 'USD';
          const amount = data.amount || 0;
          totalPKR += isUSD ? amount * usdPkrRate : amount;
          totalUSD += isUSD ? amount : amount / usdPkrRate;
        });
        setStats(prev => ({ ...prev, totalExpensesPKR: totalPKR, totalExpensesUSD: totalUSD }));
      });
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
        .filter(a => a.action && a.details && (a.action.toLowerCase().includes('domain') || a.details.toLowerCase().includes('domain')))
        .slice(0, 5);
      
      const journalActivities = snapshot.docs
        .map(d => d.data())
        .filter(a => a.action && a.details && (a.action.toLowerCase().includes('journal') || a.details.toLowerCase().includes('journal')))
        .slice(0, 5);
      
      // We'll store these in a way the UI can render
      (window as any)._recentlyAccessedDomains = domainActivities;
      (window as any)._recentlyAccessedJournals = journalActivities;
    }, (error) => console.error("Error fetching accessed logs:", error));

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
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
      setLoading(false);
    });

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
      unsubPaymentsReceived();
      unsubExpenses();
      unsubRegistrations();
      unsubAccessed();
      unsubTopEmp();
      unsubTopClient();
    };
  }, []);

  useEffect(() => {
    if (latestClients.length > 0) {
      const clientIds = latestClients.map(c => c.id).filter(id => !!id);
      if (clientIds.length > 0) {
        const q = query(collection(db, 'journals'), where('clientId', 'in', clientIds));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const names: {[clientId: string]: string} = {};
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!names[data.clientId]) {
              names[data.clientId] = data.title;
            } else if (!names[data.clientId].includes(data.title)) {
              names[data.clientId] += `, ${data.title}`;
            }
          });
          setClientJournalNames(names);
        }, (error) => console.error("Error fetching journals for clients:", error));
        return () => unsubscribe();
      }
    }
  }, [latestClients]);

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

  const handleSaveConfig = async () => {
    if (!currentUser?.id) {
      toast.error('User session expired. Please refresh.');
      return;
    }
    setIsSavingConfig(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.id), {
        dashboardConfig: dashboardConfig
      });
      toast.success('Dashboard layout saved');
      setIsCustomizeModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const moveCard = (index: number, direction: 'up' | 'down') => {
    const sortedConfig = [...dashboardConfig].sort((a, b) => a.order - b.order);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedConfig.length) return;
    
    [sortedConfig[index], sortedConfig[targetIndex]] = [sortedConfig[targetIndex], sortedConfig[index]];
    
    const updated = sortedConfig.map((item, i) => ({ ...item, order: i }));
    setDashboardConfig(updated);
  };

  const toggleCard = (id: string) => {
    setDashboardConfig(prev => prev.map(card => 
      card.id === id ? { ...card, isVisible: !card.isVisible } : card
    ));
  };

  const renderStatsGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        label="Active Clients"
        value={stats.clients}
        icon={Users}
        color="bg-indigo-600"
        change={12}
      />
      <StatCard
        label="Managed Domains"
        value={stats.domains}
        icon={Globe}
        color="bg-emerald-600"
        change={8}
      />
      <StatCard
        label="Journal Catalog"
        value={stats.journals}
        icon={BookOpen}
        color="bg-amber-600"
        change={5}
      />
      <StatCard
        label="Pending ISSN"
        value={stats.pendingISSN}
        icon={FileCheck}
        color="bg-rose-600"
        change={-2}
      />
    </div>
  );

  const renderExpiringSubscriptions = () => (
    expiringSubscriptions.length > 0 && (
      <section className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-3xl p-6 shadow-sm mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-rose-500 text-white rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-rose-900 dark:text-rose-400 leading-none">Subscriptions Expiring in 30 Days</h3>
            <p className="text-xs text-rose-600 dark:text-rose-500/80 mt-1">Proactively manage upcoming renewals to ensure service continuity.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {expiringSubscriptions.map(({client, sub}, idx) => (
            <div key={`${client.id}-${idx}`} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-100 dark:border-rose-800/50 shadow-sm flex flex-col justify-between group hover:border-rose-300 dark:hover:border-rose-600 transition-all">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded text-[10px] font-bold uppercase">{sub.service}</span>
                  <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                    <Clock size={10} /> {Math.ceil((new Date(sub.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white truncate">{client.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
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
    )
  );

  const renderSummaryGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
      {/* Latest Clients */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
            <Users size={20} className="text-indigo-600" />
            Latest Clients
          </h3>
          <button onClick={() => setActiveTab('clients')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">View All</button>
        </div>
        <div className="space-y-4">
          {latestClients.length > 0 ? latestClients.map(client => (
            <div key={client.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => {
              if (onSelectClient) {
                onSelectClient(client.id);
              }
              setActiveTab('clients');
            }}>
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-100 dark:border-indigo-800">
                {client.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {client.salutation && `${client.salutation} `}{client.name}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black truncate">
                  {clientJournalNames[client.id] || 'No Journal'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{formatTimeAgo(client.createdAt)}</p>
              </div>
            </div>
          )) : (
            <p className="text-center py-4 text-slate-400 dark:text-slate-600 text-sm italic">No recent clients.</p>
          )}
        </div>
      </div>

      {/* Latest Publishers */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
            <Building2 size={20} className="text-emerald-600" />
            Latest Publishers
          </h3>
          <button onClick={() => setActiveTab('publishers')} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">View All</button>
        </div>
        <div className="space-y-4">
          {latestPublishers.length > 0 ? latestPublishers.map(pub => (
            <div key={pub.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('publishers')}>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-100 dark:border-emerald-800 uppercase">
                {pub.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{pub.name}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black">{pub.type}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{formatTimeAgo(pub.createdAt)}</p>
              </div>
            </div>
          )) : (
            <p className="text-center py-4 text-slate-400 dark:text-slate-600 text-sm italic">No recent publishers.</p>
          )}
        </div>
      </div>

      {/* HEC Approved Journals */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
            <GraduationCap size={20} className="text-amber-600" />
            HEC Approved Journals
          </h3>
          <button onClick={() => setActiveTab('hec')} className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline">View All</button>
        </div>
        <div className="space-y-4">
          {latestHECJournals.length > 0 ? latestHECJournals.map(journal => (
            <div key={journal.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('hec')}>
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-extrabold border border-amber-100 dark:border-amber-800">
                {journal.category || 'HEC'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{journal.title}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black">{journal.issnOnline || journal.issnPrint || 'No ISSN'}</p>
              </div>
              <ArrowRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-amber-500 transition-all shrink-0" />
            </div>
          )) : (
            <p className="text-center py-4 text-slate-400 dark:text-slate-600 text-sm italic">No HEC journals found.</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderAlertsActivityGrid = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-slate-900 dark:text-white">Live Activity Logs</h3>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                Real-time
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleGenerateSummary}
                disabled={isSummarizing || activities.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {isSummarizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {aiSummary ? 'Regenerate Insight' : 'AI Summary'}
              </button>
            </div>
          </div>
          
          {aiSummary && (
            <div className="px-8 py-4 bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-900/30">
              <div className="flex gap-3">
                <div className="mt-1 p-1 bg-indigo-600 text-white rounded-lg shrink-0 h-fit">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-widest mb-1">AI Daily Pulse</h4>
                  <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{aiSummary}</div>
                </div>
              </div>
            </div>
          )}

          <div className="max-h-[500px] overflow-y-auto overflow-x-hidden">
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {activeActivities.length > 0 ? activeActivities.map((activity) => (
                <div 
                  key={activity.id} 
                  className={cn(
                    "px-8 py-4 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                    !activity.isRead && "bg-indigo-50/30 dark:bg-indigo-900/5"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border border-slate-100 dark:border-slate-800">
                      {activity.userName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{activity.userName}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{new Date(activity.timestamp as any).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{activity.action}</span>
                        <span className="mx-1">•</span>
                        {activity.details}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!activity.isRead && (
                      <button 
                        onClick={() => handleMarkRead(activity.id)}
                        className="p-1.5 text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-indigo-100"
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button 
                      onClick={() => handleHideActivity(activity.id)}
                      className="p-1.5 text-slate-400 hover:bg-white rounded-lg border border-transparent hover:border-slate-100"
                      title="Hide activity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Activity size={32} />
                  <p className="text-sm italic">No recent activity logs found.</p>
                </div>
              )}
            </div>
          </div>
          <div className="px-8 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
            <button className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors">View All Application Logs</button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-3xl text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all duration-700"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Dashboard Insights</h4>
              <button 
                onClick={handleGenerateSummary}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="text-2xl font-black mb-2 flex items-baseline gap-2">
              Daily Impact <Zap size={20} className="text-amber-400 fill-amber-400" />
            </div>
            <p className="text-indigo-100/80 text-sm leading-relaxed mb-8">
              You've handled <span className="font-bold text-white">48 operations</span> today with <span className="font-bold text-white">99.8% precision</span>. Your efficiency is up 12%.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                <div className="text-xl font-black mb-0.5">85%</div>
                <div className="text-[10px] uppercase font-bold opacity-70">Focus Time</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                <div className="text-xl font-black mb-0.5">4.9/5</div>
                <div className="text-[10px] uppercase font-bold opacity-70">SLA Rating</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Spotlight Summary</h4>
          <div className="space-y-6">
            {topEmployee && (
              <div>
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="flex items-center gap-1 text-slate-900 dark:text-white"><Zap size={14} className="text-indigo-500" /> Top Performer</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{(topEmployee.points || 0).toLocaleString()} pts</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {topEmployee.photoURL ? (
                      <img src={topEmployee.photoURL || DEFAULT_IMAGES.FEMALE_STAFF} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      topEmployee.name.charAt(0)
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{topEmployee.name}</p>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-indigo-500 w-[85%]"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {topClient && (
              <div>
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="flex items-center gap-1 text-slate-900 dark:text-white"><Trophy size={14} className="text-amber-400" /> Top Client</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{(topClient.points || 0).toLocaleString()} pts</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {topClient.photoURL ? (
                      <img src={topClient.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      topClient.name.charAt(0)
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{topClient.name}</p>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-emerald-500 w-[65%]"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed italic">
                Points are dynamically calculated based on task performance and client loyalty metrics.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderChartsSection = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Revenue Growth</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Monthly breakdown of registered clients</p>
          </div>
        </div>
        <RevenueGrowthChart />
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Task Distribution</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Current workflow status allocation</p>
          </div>
        </div>
        <TaskCompletionChart />
      </div>
    </div>
  );

  const renderJournalDistribution = () => (
    canView('journals') && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
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
    )
  );

  const renderJournalsManagement = () => (
    canView('journals') && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Empty space for grid alignment or we can span icons */}
        <div className="hidden lg:block" />
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
    )
  );

  const renderIssnManagement = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8" key="issnManagement">
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <FileCheck size={20} className="text-rose-600" />
              Latest Approved ISSN
            </h3>
            <button 
              onClick={() => setActiveTab('issn')}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              View All
            </button>
          </div>
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Plus size={20} className="text-indigo-600" />
              Latest Added ISSN
            </h3>
            <button 
              onClick={() => setActiveTab('issn')}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              View All
            </button>
          </div>
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
    </div>
  );

  const renderDomainsManagement = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8" key="domainsManagement">
      <div className="hidden lg:block invisible" />
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Globe size={20} className="text-emerald-600" />
              Latest Added Domains
            </h3>
            <button 
              onClick={() => setActiveTab('domains')}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              View All
            </button>
          </div>
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
            Recently Accessed Domains
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
              <p className="text-center py-4 text-slate-400 text-sm italic">No recent domain logs.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderOjsTasksSection = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8" key="ojsTasksSection">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
          <Settings size={20} className="text-slate-600" />
          Latest Installed OJS Versions
        </h3>
        <div className="space-y-4">
          {latestOJS.map((journal, idx) => (
            <div key={`${journal.id}-${idx}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-600 shadow-sm">
                  <BookOpen size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900">{journal.title}</p>
                  <p className="text-xs text-slate-500">Managed by CRM</p>
                </div>
              </div>
              <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-indigo-600 shadow-sm">
                v{journal.ojsVersion || '3.x'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
          <CheckCircle2 size={20} className="text-emerald-500" />
          Latest Completed Editorial Tasks
        </h3>
        <div className="space-y-4">
          {latestCompletedTasks.map((task, idx) => (
            <div key={`${task.id}-${idx}`} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 truncate max-w-[200px]">{task.title}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <User size={10} /> {task.assignedToName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Completed</p>
                <p className="text-[10px] text-slate-400 font-bold">{new Date(task.completedAt as any).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRecentBilling = () => (
    canView('invoices') && (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8" key="recentBilling">
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
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                <th className="px-8 py-4">Invoice ID</th>
                <th className="px-8 py-4">Total Amount</th>
                <th className="px-8 py-4 text-center">Status</th>
                <th className="px-8 py-4 text-right">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              <tr className="text-sm">
                <td colSpan={4} className="px-8 py-16 text-center text-slate-400 dark:text-slate-600 italic">
                  <div className="flex flex-col items-center gap-2">
                    <CreditCard size={32} className="text-slate-200 dark:text-slate-800" />
                    <p>Access the Invoices module to manage all client billing and payments.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  );

  return (
    <div className="py-4 md:py-8 space-y-6 md:space-y-8 w-full px-4 md:px-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
            Welcome back, {currentUser.name.split(' ')[0]}!
            <HelpIcon policyTitle="Admin Dashboard Overview" />
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time insights for Host A Journal Pvt Ltd.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setIsCustomizeModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm cursor-pointer"
          >
            <Settings size={16} />
            Customize
          </button>
          <button 
            onClick={() => setActiveTab('workflow')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
          >
            <Plus size={18} />
            Quick Add
          </button>
        </div>
      </div>

      {/* Dynamic Dashboard Content */}
      <div className="space-y-8">
        {[...dashboardConfig]
          .sort((a, b) => a.order - b.order)
          .map((config) => {
            if (!config.isVisible) return null;

            if (config.id === 'expiringSubscriptions') return <React.Fragment key={config.id}>{renderExpiringSubscriptions()}</React.Fragment>;

            if (loading) {
              return config.id === 'summaryGrid' ? (
                <div key="loading" className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
                  <Loader2 className="animate-spin" size={32} />
                  <p className="text-sm font-medium">Loading dashboard data...</p>
                </div>
              ) : null;
            }

            switch (config.id) {
              case 'summaryGrid': return <React.Fragment key={config.id}>{renderSummaryGrid()}</React.Fragment>;
              case 'statsGrid': return <React.Fragment key={config.id}>{renderStatsGrid()}</React.Fragment>;
              case 'alertsActivityGrid': return <React.Fragment key={config.id}>{renderAlertsActivityGrid()}</React.Fragment>;
              case 'chartsSection': return <React.Fragment key={config.id}>{renderChartsSection()}</React.Fragment>;
              case 'journalDistribution': return <React.Fragment key={config.id}>{renderJournalDistribution()}</React.Fragment>;
              case 'journalsManagement': return <React.Fragment key={config.id}>{renderJournalsManagement()}</React.Fragment>;
              case 'issnManagement': return <React.Fragment key={config.id}>{renderIssnManagement()}</React.Fragment>;
              case 'domainsManagement': return <React.Fragment key={config.id}>{renderDomainsManagement()}</React.Fragment>;
              case 'ojsTasksSection': return <React.Fragment key={config.id}>{renderOjsTasksSection()}</React.Fragment>;
              case 'recentBilling': return <React.Fragment key={config.id}>{renderRecentBilling()}</React.Fragment>;
              default: return null;
            }
          })}
      </div>

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

      {/* Customize Dashboard Modal */}
      <Modal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
        title="Customize Your Dashboard"
        maxWidth="2xl"
      >
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <p className="text-sm text-indigo-700 font-medium">
              Choose which sections you want to see and rearrange them to your preference.
            </p>
          </div>

          <div className="space-y-3">
            {[...dashboardConfig].sort((a, b) => a.order - b.order).map((config, index) => {
              const cardInfo = DASHBOARD_CARDS.find(c => c.id === config.id);
              if (!cardInfo) return null;

              return (
                <div 
                  key={config.id} 
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all",
                    config.isVisible ? "bg-white border-slate-200 shadow-sm" : "bg-slate-50 border-slate-100 opacity-60"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => moveCard(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button 
                        onClick={() => moveCard(index, 'down')}
                        disabled={index === dashboardConfig.length - 1}
                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{cardInfo.label}</h4>
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Section {index + 1}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleCard(config.id)}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        config.isVisible 
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100" 
                          : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                      )}
                    >
                      {config.isVisible ? 'Visible' : 'Hidden'}
                    </button>
                    <LayoutIcon size={18} className="text-slate-300" />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 pt-6 border-t border-slate-100">
            <button 
              onClick={() => setIsCustomizeModalOpen(false)}
              className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
            >
              {isSavingConfig ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save Configuration
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
