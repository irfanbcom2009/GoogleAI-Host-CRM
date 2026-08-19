import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Minus, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  DollarSign, 
  Users, 
  Briefcase, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  X, 
  ArrowUpRight, 
  ArrowDownRight, 
  Trash2, 
  Edit3, 
  PieChart, 
  ShieldCheck, 
  Receipt,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { PaymentReceived, TaskCostRecord, Client, Task, Journal, User } from '../types';
import { cn } from '../lib/utils';
import { Modal } from './Modal';
import { toast } from 'react-hot-toast';

interface PaymentTaskLedgerProps {
  currentUser: User;
  clientIdFilter?: string; // If embedded inside a specific Client Detail view
}

// Helper function to extract subscribed services for a client
const getClientSubscribedServices = (client?: User): string[] => {
  if (!client) return [];
  const services: string[] = [];
  
  if (client.serviceSubscriptions?.ojs) services.push('OJS Setup');
  if (client.serviceSubscriptions?.issn) services.push('ISSN Application');
  if (client.serviceSubscriptions?.doi) services.push('DOI Registration');
  if (client.serviceSubscriptions?.hec) services.push('HEC Indexing');

  if (Array.isArray(client.subscriptions)) {
    client.subscriptions.forEach(s => {
      if (s.status === 'active' || !s.status) {
        if (s.service === 'Hosting' || s.service === 'Domain') {
          if (!services.includes('Hosting / Domain')) services.push('Hosting / Domain');
        } else if (s.service === 'OJS' && !services.includes('OJS Setup')) {
          services.push('OJS Setup');
        } else if (s.service === 'ISSN' && !services.includes('ISSN Application')) {
          services.push('ISSN Application');
        } else if (s.service === 'DOI' && !services.includes('DOI Registration')) {
          services.push('DOI Registration');
        } else if (s.service === 'Editorial' && !services.includes('Editorial Services')) {
          services.push('Editorial Services');
        } else if (!services.includes(s.service)) {
          services.push(s.service);
        }
      }
    });
  }

  return services;
};

export const PaymentTaskLedger: React.FC<PaymentTaskLedgerProps> = ({ 
  currentUser,
  clientIdFilter 
}) => {
  const [payments, setPayments] = useState<PaymentReceived[]>([]);
  const [taskCosts, setTaskCosts] = useState<TaskCostRecord[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'payments' | 'costs' | 'client_scores'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>(clientIdFilter || 'all');
  const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'year'>('all');

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);

  // Form State - Record Payment Received (+)
  const [paymentForm, setPaymentForm] = useState({
    clientId: clientIdFilter || '',
    journalId: '',
    taskId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'Bank Transfer' as PaymentReceived['method'],
    category: 'Subscription' as PaymentReceived['category'],
    reference: '',
    notes: ''
  });

  // Form State - Log Task Cost (-)
  const [costForm, setCostForm] = useState({
    taskId: '',
    taskTitle: '',
    clientId: clientIdFilter || '',
    journalId: '',
    assignedEmployeeId: '',
    costAmount: '',
    costDate: new Date().toISOString().split('T')[0],
    category: 'Employee Task Fee' as TaskCostRecord['category'],
    notes: ''
  });

  // Load Firestore collections
  useEffect(() => {
    const unsubPayments = onSnapshot(
      query(collection(db, 'paymentsReceived'), orderBy('date', 'desc')),
      (snapshot) => {
        setPayments(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as PaymentReceived));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'paymentsReceived')
    );

    const unsubCosts = onSnapshot(
      query(collection(db, 'taskCosts'), orderBy('costDate', 'desc')),
      (snapshot) => {
        setTaskCosts(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as TaskCostRecord));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'taskCosts')
    );

    const unsubClients = onSnapshot(collection(db, 'users'), (snapshot) => {
      const clientDocs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }) as User)
        .filter(u => u.role === 'Client' || (u as any).isClient === true);
      setClients(clientDocs);
    });

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Task));
    });

    const unsubJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      setJournals(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Journal));
      setLoading(false);
    });

    return () => {
      unsubPayments();
      unsubCosts();
      unsubClients();
      unsubTasks();
      unsubJournals();
    };
  }, []);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (clientIdFilter && p.clientId !== clientIdFilter) return false;
      if (selectedClientId !== 'all' && p.clientId !== selectedClientId) return false;
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const clientName = (p.clientName || '').toLowerCase();
        const ref = (p.reference || '').toLowerCase();
        const notes = (p.notes || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        if (!clientName.includes(q) && !ref.includes(q) && !notes.includes(q) && !cat.includes(q)) {
          return false;
        }
      }

      if (dateFilter === 'month') {
        const pDate = new Date(p.date);
        const now = new Date();
        if (pDate.getMonth() !== now.getMonth() || pDate.getFullYear() !== now.getFullYear()) return false;
      } else if (dateFilter === 'year') {
        const pDate = new Date(p.date);
        const now = new Date();
        if (pDate.getFullYear() !== now.getFullYear()) return false;
      }

      return true;
    });
  }, [payments, clientIdFilter, selectedClientId, searchQuery, dateFilter]);

  // Filtered Task Costs
  const filteredCosts = useMemo(() => {
    return taskCosts.filter(c => {
      if (clientIdFilter && c.clientId !== clientIdFilter) return false;
      if (selectedClientId !== 'all' && c.clientId !== selectedClientId) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const taskTitle = (c.taskTitle || '').toLowerCase();
        const clientName = (c.clientName || '').toLowerCase();
        const notes = (c.notes || '').toLowerCase();
        const cat = (c.category || '').toLowerCase();
        if (!taskTitle.includes(q) && !clientName.includes(q) && !notes.includes(q) && !cat.includes(q)) {
          return false;
        }
      }

      if (dateFilter === 'month') {
        const cDate = new Date(c.costDate);
        const now = new Date();
        if (cDate.getMonth() !== now.getMonth() || cDate.getFullYear() !== now.getFullYear()) return false;
      } else if (dateFilter === 'year') {
        const cDate = new Date(c.costDate);
        const now = new Date();
        if (cDate.getFullYear() !== now.getFullYear()) return false;
      }

      return true;
    });
  }, [taskCosts, clientIdFilter, selectedClientId, searchQuery, dateFilter]);

  // Financial Metrics
  const totalPaymentReceived = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  const totalTaskCost = useMemo(() => {
    return filteredCosts.reduce((acc, c) => acc + (Number(c.costAmount) || 0), 0);
  }, [filteredCosts]);

  // Final Financial Score (+ or -)
  const finalScore = useMemo(() => {
    return totalPaymentReceived - totalTaskCost;
  }, [totalPaymentReceived, totalTaskCost]);

  // Combined Ledger List
  const combinedLedger = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'payment' | 'cost';
      title: string;
      subtitle: string;
      date: string;
      amount: number;
      isPositive: boolean;
      category?: string;
      reference?: string;
      raw: PaymentReceived | TaskCostRecord;
    }> = [];

    filteredPayments.forEach(p => {
      list.push({
        id: p.id,
        type: 'payment',
        title: p.clientName || 'Payment Received',
        subtitle: p.journalTitle ? `Journal: ${p.journalTitle}` : (p.notes || 'Client Payment'),
        date: p.date,
        amount: Number(p.amount) || 0,
        isPositive: true,
        category: p.category || 'Payment',
        reference: p.reference,
        raw: p
      });
    });

    filteredCosts.forEach(c => {
      list.push({
        id: c.id,
        type: 'cost',
        title: c.taskTitle || 'Task Performance Cost',
        subtitle: c.clientName ? `Client: ${c.clientName}` : (c.notes || 'Task Expense'),
        date: c.costDate,
        amount: Number(c.costAmount) || 0,
        isPositive: false,
        category: c.category || 'Task Expense',
        raw: c
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredPayments, filteredCosts]);

  // Grouped Scores by Client
  const clientScores = useMemo(() => {
    const map = new Map<string, { clientName: string; received: number; cost: number; netScore: number; count: number }>();

    filteredPayments.forEach(p => {
      const cId = p.clientId || 'unassigned';
      const name = p.clientName || 'General Client';
      const existing = map.get(cId) || { clientName: name, received: 0, cost: 0, netScore: 0, count: 0 };
      existing.received += Number(p.amount) || 0;
      existing.netScore = existing.received - existing.cost;
      existing.count += 1;
      map.set(cId, existing);
    });

    filteredCosts.forEach(c => {
      const cId = c.clientId || 'unassigned';
      const name = c.clientName || 'General Expense';
      const existing = map.get(cId) || { clientName: name, received: 0, cost: 0, netScore: 0, count: 0 };
      existing.cost += Number(c.costAmount) || 0;
      existing.netScore = existing.received - existing.cost;
      existing.count += 1;
      map.set(cId, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.netScore - a.netScore);
  }, [filteredPayments, filteredCosts]);

  // Subscribed Services & Filtered Tasks for Cost Logging
  const selectedCostClient = useMemo(() => {
    return clients.find(c => c.id === costForm.clientId);
  }, [clients, costForm.clientId]);

  const costClientSubscribedServices = useMemo(() => {
    return getClientSubscribedServices(selectedCostClient);
  }, [selectedCostClient]);

  const availableCostTasks = useMemo(() => {
    let filtered = tasks;
    if (costForm.clientId) {
      filtered = tasks.filter(t => !t.clientId || t.clientId === costForm.clientId);
    }

    const subs = costClientSubscribedServices.map(s => s.toLowerCase());

    return filtered.map(t => {
      const sType = (t.serviceType || '').toLowerCase();
      const title = t.title.toLowerCase();
      const isSubscribedMatch = subs.some(sub => 
        (sType && sub.includes(sType)) || 
        (sType && sType.includes(sub.replace(' setup', '').replace(' application', '').replace(' registration', ''))) ||
        title.includes(sub.replace(' setup', '').replace(' application', ''))
      );
      return { ...t, isSubscribedMatch };
    }).sort((a, b) => {
      if (a.isSubscribedMatch && !b.isSubscribedMatch) return -1;
      if (!a.isSubscribedMatch && b.isSubscribedMatch) return 1;
      return 0;
    });
  }, [tasks, costForm.clientId, costClientSubscribedServices]);

  // Subscribed Services for Payment Received
  const selectedPaymentClient = useMemo(() => {
    return clients.find(c => c.id === paymentForm.clientId);
  }, [clients, paymentForm.clientId]);

  const paymentClientSubscribedServices = useMemo(() => {
    return getClientSubscribedServices(selectedPaymentClient);
  }, [selectedPaymentClient]);

  // Handlers
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      toast.error('Please enter a valid positive payment amount.');
      return;
    }

    const matchedClient = clients.find(c => c.id === paymentForm.clientId);
    const matchedJournal = journals.find(j => j.id === paymentForm.journalId);
    const matchedTask = tasks.find(t => t.id === paymentForm.taskId);

    try {
      const newDoc: Omit<PaymentReceived, 'id'> = {
        clientId: paymentForm.clientId || undefined,
        clientName: matchedClient?.name || undefined,
        journalId: paymentForm.journalId || undefined,
        journalTitle: matchedJournal?.title || undefined,
        taskId: paymentForm.taskId || undefined,
        taskTitle: matchedTask?.title || undefined,
        amount: Number(paymentForm.amount),
        currency: 'USD',
        date: paymentForm.date,
        method: paymentForm.method,
        category: paymentForm.category,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
        recordedBy: currentUser.name || currentUser.email,
        recordedById: currentUser.id,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id
      };

      await addDoc(collection(db, 'paymentsReceived'), newDoc);
      toast.success(`Payment of +$${paymentForm.amount} successfully recorded!`);
      setIsPaymentModalOpen(false);
      setPaymentForm({
        clientId: clientIdFilter || '',
        journalId: '',
        taskId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        method: 'Bank Transfer',
        category: 'Subscription',
        reference: '',
        notes: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'paymentsReceived');
    }
  };

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costForm.costAmount || Number(costForm.costAmount) <= 0) {
      toast.error('Please enter a valid cost amount.');
      return;
    }

    const matchedTask = tasks.find(t => t.id === costForm.taskId);
    const matchedClient = clients.find(c => c.id === (costForm.clientId || matchedTask?.clientId));
    const matchedJournal = journals.find(j => j.id === (costForm.journalId || matchedTask?.journalId));

    try {
      const newDoc: Omit<TaskCostRecord, 'id'> = {
        taskId: costForm.taskId || undefined,
        taskTitle: costForm.taskTitle || matchedTask?.title || 'General Task Expense',
        clientId: costForm.clientId || matchedTask?.clientId || undefined,
        clientName: matchedClient?.name || matchedTask?.clientName || undefined,
        journalId: costForm.journalId || matchedTask?.journalId || undefined,
        journalTitle: matchedJournal?.title || matchedTask?.journalTitle || undefined,
        assignedEmployeeId: costForm.assignedEmployeeId || matchedTask?.assignedTo || undefined,
        costAmount: Number(costForm.costAmount),
        costDate: costForm.costDate,
        category: costForm.category,
        notes: costForm.notes,
        recordedBy: currentUser.name || currentUser.email,
        recordedById: currentUser.id,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id
      };

      await addDoc(collection(db, 'taskCosts'), newDoc);

      // If tied to a task, update the task's taskCost field as well
      if (costForm.taskId) {
        await updateDoc(doc(db, 'tasks', costForm.taskId), {
          taskCost: Number(costForm.costAmount)
        });
      }

      toast.success(`Task cost of -$${costForm.costAmount} logged!`);
      setIsCostModalOpen(false);
      setCostForm({
        taskId: '',
        taskTitle: '',
        clientId: clientIdFilter || '',
        journalId: '',
        assignedEmployeeId: '',
        costAmount: '',
        costDate: new Date().toISOString().split('T')[0],
        category: 'Employee Task Fee',
        notes: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'taskCosts');
    }
  };

  const handleDeleteLedgerItem = async (item: { id: string; type: 'payment' | 'cost' }) => {
    if (!window.confirm('Are you sure you want to delete this ledger entry?')) return;
    try {
      if (item.type === 'payment') {
        await deleteDoc(doc(db, 'paymentsReceived', item.id));
        toast.success('Payment entry removed');
      } else {
        await deleteDoc(doc(db, 'taskCosts', item.id));
        toast.success('Task cost entry removed');
      }
    } catch (err) {
      toast.error('Failed to delete entry');
    }
  };

  const exportLedgerToCSV = () => {
    const headers = ['Date', 'Type', 'Title/Client', 'Category', 'Reference/Notes', 'Amount (USD)'];
    const rows = combinedLedger.map(item => [
      item.date,
      item.type === 'payment' ? 'Payment Received (+)' : 'Task Cost (-)',
      `"${item.title.replace(/"/g, '""')}"`,
      `"${(item.category || '').replace(/"/g, '""')}"`,
      `"${(item.subtitle || '').replace(/"/g, '""')}"`,
      item.isPositive ? `+${item.amount}` : `-${item.amount}`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payment_and_Task_Cost_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Receipt size={22} />
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Payment & Task Cost Ledger
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium pl-11">
            Realtime revenue received history, task expense tracking, and final net balance score (+ / -).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>Record Payment (+)</span>
          </button>
          
          <button
            onClick={() => setIsCostModalOpen(true)}
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer"
          >
            <Minus size={16} />
            <span>Log Task Cost (-)</span>
          </button>

          <button
            onClick={exportLedgerToCSV}
            type="button"
            title="Export Ledger to CSV"
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* 3 Metric Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total Payments Received (+) */}
        <div className="p-6 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <ArrowUpRight size={16} className="text-emerald-600 dark:text-emerald-400" />
              Payments Received (+)
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
              {filteredPayments.length} Entries
            </span>
          </div>
          <div>
            <h3 className="text-3xl font-black tracking-tight text-emerald-950 dark:text-emerald-100">
              +${totalPaymentReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-400 mt-1">
              Verified client funds & subscription fees received
            </p>
          </div>
        </div>

        {/* Card 2: Total Task & Performance Costs (-) */}
        <div className="p-6 rounded-3xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 relative overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <ArrowDownRight size={16} className="text-rose-600 dark:text-rose-400" />
              Task & Operation Costs (-)
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-200/80 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200">
              {filteredCosts.length} Entries
            </span>
          </div>
          <div>
            <h3 className="text-3xl font-black tracking-tight text-rose-950 dark:text-rose-100">
              -${totalTaskCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-medium text-rose-700/80 dark:text-rose-400 mt-1">
              Task fees, employee payouts & service expenses
            </p>
          </div>
        </div>

        {/* Card 3: Final Score (+ or -) */}
        <div className={cn(
          "p-6 rounded-3xl border relative overflow-hidden space-y-3 transition-all",
          finalScore >= 0 
            ? "bg-slate-900 dark:bg-slate-950 text-white border-slate-800 shadow-xl" 
            : "bg-rose-900 text-white border-rose-800 shadow-xl"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
              <DollarSign size={16} className={finalScore >= 0 ? "text-emerald-400" : "text-amber-400"} />
              Final Financial Score (+ / -)
            </span>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest",
              finalScore >= 0 
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                : "bg-rose-500/20 text-rose-200 border border-rose-500/30"
            )}>
              {finalScore >= 0 ? 'Surplus (+)' : 'Deficit (-)'}
            </span>
          </div>

          <div>
            <h3 className={cn(
              "text-3xl font-black tracking-tight flex items-center gap-1",
              finalScore >= 0 ? "text-emerald-400" : "text-rose-300"
            )}>
              {finalScore >= 0 ? '+' : ''}${finalScore.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-medium text-slate-400 mt-1">
              {finalScore >= 0 
                ? 'Net financial surplus across selected period' 
                : 'Expenses exceed payments received'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Tab Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                activeTab === 'all'
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              All Transactions ({combinedLedger.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                activeTab === 'payments'
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Payments Received (+) ({filteredPayments.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('costs')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                activeTab === 'costs'
                  ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Task Costs (-) ({filteredCosts.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('client_scores')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                activeTab === 'client_scores'
                  ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Scores by Client
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search ledger..."
                value={searchQuery || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* Client Select Filter */}
            {!clientIdFilter && (
              <select
                value={selectedClientId || ''}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Clients</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.email}</option>
                ))}
              </select>
            )}

            {/* Date Range Filter */}
            <select
              value={dateFilter || ''}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      {activeTab !== 'client_scores' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-6">Entry Date</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-6">Title / Client</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-6">Notes / Ref</th>
                  <th className="py-3.5 px-6 text-right">Amount (USD)</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {combinedLedger
                  .filter(item => {
                    if (activeTab === 'payments') return item.isPositive;
                    if (activeTab === 'costs') return !item.isPositive;
                    return true;
                  })
                  .map((item) => (
                    <tr 
                      key={`${item.type}-${item.id}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-4 px-6 font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.date}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1",
                          item.isPositive 
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" 
                            : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                        )}>
                          {item.isPositive ? <Plus size={12} /> : <Minus size={12} />}
                          {item.type === 'payment' ? 'Payment Received' : 'Task Cost'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {item.subtitle}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px]">
                          {item.category || 'General'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {item.reference ? `Ref: ${item.reference}` : (item.subtitle || '-')}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <span className={cn(
                          "text-sm font-black tracking-tight",
                          item.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}>
                          {item.isPositive ? '+' : '-'}${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteLedgerItem(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                          title="Delete entry"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}

                {combinedLedger.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <Receipt size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="font-bold">No ledger entries found</p>
                      <p className="text-xs mt-1">Record a payment received (+) or log a task cost (-) to start.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Scores by Client View */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Client Financial Net Scores (+ / -)
            </h3>
            <span className="text-xs text-slate-400 font-bold">
              Total Clients Tracked: {clientScores.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientScores.map((cs, idx) => (
              <div 
                key={idx}
                className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate max-w-[200px]">
                    {cs.clientName}
                  </h4>
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                    cs.netScore >= 0 
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" 
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  )}>
                    {cs.netScore >= 0 ? 'Surplus +' : 'Deficit -'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Received (+)</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      +${cs.received.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Task Costs (-)</span>
                    <span className="font-black text-rose-600 dark:text-rose-400">
                      -${cs.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Net Client Score:</span>
                  <span className={cn(
                    "text-base font-black tracking-tight",
                    cs.netScore >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {cs.netScore >= 0 ? '+' : ''}${cs.netScore.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}

            {clientScores.length === 0 && (
              <div className="col-span-full py-8 text-center text-slate-400">
                No client financial scores computed yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Record Payment Received (+) */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Payment Received (+)"
      >
        <form onSubmit={handleAddPayment} className="space-y-4 text-slate-900 dark:text-white">
          <div className="space-y-1">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Client</label>
            <select
              value={paymentForm.clientId || ''}
              onChange={(e) => setPaymentForm(prev => ({ ...prev, clientId: e.target.value }))}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:outline-none"
            >
              <option value="">-- Select Client --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.email}</option>
              ))}
            </select>
          </div>

          {/* Subscribed Services Banner */}
          {selectedPaymentClient && (
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
                <ShieldCheck size={13} />
                Subscribed Services ({selectedPaymentClient.name || selectedPaymentClient.email})
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {paymentClientSubscribedServices.length > 0 ? (
                  paymentClientSubscribedServices.map(s => (
                    <span key={s} className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No specific service subscriptions flagged</span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Amount received ($)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 500.00"
                value={paymentForm.amount || ''}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black text-emerald-600 dark:text-emerald-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Payment Date</label>
              <input
                type="date"
                required
                value={paymentForm.date || ''}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Payment Method</label>
              <select
                value={paymentForm.method || ''}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, method: e.target.value as any }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:outline-none"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Online/Stripe">Online / Credit Card</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Adjustment">Adjustment</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Category</label>
              <select
                value={paymentForm.category || ''}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, category: e.target.value as any }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:outline-none"
              >
                <option value="Subscription">Subscription</option>
                <option value="OJS Setup">OJS Setup</option>
                <option value="ISSN Application">ISSN Application</option>
                <option value="DOI Registration">DOI Registration</option>
                <option value="Hosting / Domain">Hosting / Domain</option>
                <option value="Editorial Services">Editorial Services</option>
                <option value="Other Revenue">Other Revenue</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Reference / Txn ID</label>
            <input
              type="text"
              placeholder="e.g. TXN-984210"
              value={paymentForm.reference || ''}
              onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Notes</label>
            <textarea
              rows={2}
              placeholder="Optional payment details or receipt notes..."
              value={paymentForm.notes || ''}
              onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Save Payment (+)
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Log Task Cost (-) */}
      <Modal
        isOpen={isCostModalOpen}
        onClose={() => setIsCostModalOpen(false)}
        title="Log Task & Operation Cost (-)"
      >
        <form onSubmit={handleAddCost} className="space-y-4 text-slate-900 dark:text-white">
          <div className="space-y-1">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Client (Filter Tasks)</label>
            <select
              value={costForm.clientId || ''}
              onChange={(e) => {
                const cId = e.target.value;
                setCostForm(prev => ({ ...prev, clientId: cId, taskId: '', taskTitle: '' }));
              }}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:outline-none"
            >
              <option value="">-- General / All Clients --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.email}</option>
              ))}
            </select>
          </div>

          {/* Subscribed Services Banner */}
          {selectedCostClient && (
            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-700 dark:text-indigo-400 mb-1 flex items-center gap-1.5">
                <ShieldCheck size={13} />
                Subscribed Services ({selectedCostClient.name || selectedCostClient.email})
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {costClientSubscribedServices.length > 0 ? (
                  costClientSubscribedServices.map(s => (
                    <span key={s} className="px-2.5 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No specific service subscriptions flagged</span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Select Task (Matches Subscribed Services)</label>
            <select
              value={costForm.taskId || ''}
              onChange={(e) => {
                const tId = e.target.value;
                if (tId.startsWith('virtual-')) {
                  const servName = tId.replace('virtual-', '');
                  setCostForm(prev => ({
                    ...prev,
                    taskId: '',
                    taskTitle: `${servName} Task`,
                    category: servName.includes('OJS') ? 'OJS Setup' :
                              servName.includes('ISSN') ? 'ISSN Application' :
                              servName.includes('DOI') ? 'DOI Registration' :
                              servName.includes('Hosting') ? 'Hosting / Domain' :
                              servName.includes('Editorial') ? 'Editorial Services' : 'Employee Task Fee'
                  }));
                } else {
                  const t = tasks.find(x => x.id === tId);
                  setCostForm(prev => ({ 
                    ...prev, 
                    taskId: tId,
                    taskTitle: t?.title || prev.taskTitle,
                    clientId: t?.clientId || prev.clientId,
                    journalId: t?.journalId || prev.journalId,
                    assignedEmployeeId: t?.assignedTo || prev.assignedEmployeeId,
                    category: t?.serviceType === 'OJS' ? 'OJS Setup' :
                              t?.serviceType === 'ISSN' ? 'ISSN Application' :
                              t?.serviceType === 'DOI' ? 'DOI Registration' :
                              t?.serviceType === 'Hosting' || t?.serviceType === 'Domain' ? 'Hosting / Domain' :
                              t?.serviceType === 'Editorial' ? 'Editorial Services' : 'Employee Task Fee'
                  }));
                }
              }}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:outline-none"
            >
              <option value="">-- General Expense / No Specific Task --</option>
              {costClientSubscribedServices.map(s => (
                <option key={`virtual-${s}`} value={`virtual-${s}`}>
                  ✨ [Subscribed Service Preset] {s} Task
                </option>
              ))}
              {availableCostTasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.isSubscribedMatch ? '⭐ ' : ''}{t.title} ({t.clientName || 'General'}{t.serviceType ? ` • ${t.serviceType}` : ''})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Expense Title / Description</label>
            <input
              type="text"
              required
              placeholder="e.g. Employee execution fee, Indexing fee, Domain renewal"
              value={costForm.taskTitle || ''}
              onChange={(e) => setCostForm(prev => ({ ...prev, taskTitle: e.target.value }))}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Cost Amount ($)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 150.00"
                value={costForm.costAmount || ''}
                onChange={(e) => setCostForm(prev => ({ ...prev, costAmount: e.target.value }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black text-rose-600 dark:text-rose-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Expense Date</label>
              <input
                type="date"
                required
                value={costForm.costDate || ''}
                onChange={(e) => setCostForm(prev => ({ ...prev, costDate: e.target.value }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Expense Category</label>
            <select
              value={costForm.category || ''}
              onChange={(e) => setCostForm(prev => ({ ...prev, category: e.target.value as any }))}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:outline-none"
            >
              <option value="Employee Task Fee">Employee Task Fee</option>
              <option value="OJS Setup">OJS Setup</option>
              <option value="ISSN Application">ISSN Application</option>
              <option value="DOI Registration">DOI Registration</option>
              <option value="Hosting / Domain">Hosting / Domain</option>
              <option value="Editorial Services">Editorial Services</option>
              <option value="Indexing Fee">Indexing Fee</option>
              <option value="Outsourcing">Outsourcing</option>
              <option value="Other">Other Expense</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Notes / Details</label>
            <textarea
              rows={2}
              placeholder="Optional cost explanation or vendor details..."
              value={costForm.notes || ''}
              onChange={(e) => setCostForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCostModalOpen(false)}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Log Task Cost (-)
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
