import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  FileText, 
  Upload, 
  Trash2, 
  MoreHorizontal, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Image as ImageIcon,
  ExternalLink,
  X,
  PieChart as PieChartIcon,
  BarChart3,
  TrendingDown,
  Settings2,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, User as UserType, GlobalSettings, OfficeSubscription } from '../types';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType, moveToTrash } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, Timestamp, updateDoc, getDoc } from 'firebase/firestore';
import { Modal } from './Modal';
import { ColumnSelector } from './ColumnSelector';
import { SearchableSelect } from './ui/SearchableSelect';
import { Shield } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ConfigModal } from './ConfigModal';

interface ExpensesProps {
  currentUser: UserType;
}

const AVAILABLE_COLUMNS = [
  { id: 'head', label: 'Expense Head' },
  { id: 'date', label: 'Date' },
  { id: 'endDate', label: 'End Date' },
  { id: 'amount', label: 'Amount' },
  { id: 'tax', label: 'Tax' },
  { id: 'total', label: 'Total' },
  { id: 'nextDueDate', label: 'Next Due' },
  { id: 'attachment', label: 'Attachment' },
];

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const Expenses: React.FC<ExpensesProps> = ({ currentUser }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [headFilter, setHeadFilter] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'summary' | 'subscriptions'>('list');
  const [expenseHeads, setExpenseHeads] = useState<string[]>([]);
  const [officeSubscriptions, setOfficeSubscriptions] = useState<OfficeSubscription[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['expenses'] || AVAILABLE_COLUMNS.map(c => c.id)
  );

  // Form state
  const [newExpense, setNewExpense] = useState({
    head: '',
    date: new Date().toISOString().split('T')[0],
    endDate: '',
    amount: 0,
    currency: 'USD' as 'USD' | 'PKR',
    taxAmount: 0,
    attachmentUrl: '',
    notes: '',
    isRecurring: false,
    recurringInterval: 'monthly' as 'monthly' | 'quarterly' | 'yearly' | 'custom',
    recurringCustomDays: 30
  });

  const [uploading, setUploading] = useState(false);

  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Manager';

  useEffect(() => {
    const fetchSettings = async () => {
      const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as GlobalSettings;
          setExpenseHeads(Array.isArray(data.expenseHeads) ? data.expenseHeads : []);
          setOfficeSubscriptions(Array.isArray(data.officeSubscriptions) ? data.officeSubscriptions : []);
        }
      });
      return unsubscribeSettings;
    };
    const unsubSettings = fetchSettings();

    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expenseData = snapshot.docs.map(doc => {
        const data = doc.data();
        const expenseDate = data.date instanceof Timestamp 
          ? data.date.toDate().toISOString().split('T')[0]
          : data.date;
        
        return {
          id: doc.id,
          ...data,
          date: expenseDate
        };
      }) as Expense[];
      setExpenses(expenseData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    return () => unsubscribe();
  }, []);

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.expenses`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    if (file.size > 500000) {
      alert("File too large for demo upload. Using placeholder URL.");
      setNewExpense(prev => ({ ...prev, attachmentUrl: `https://picsum.photos/seed/${Math.random()}/800/600` }));
      setUploading(false);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewExpense(prev => ({ ...prev, attachmentUrl: reader.result as string }));
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const calculateNextDueDate = (startDate: string, interval: 'monthly' | 'quarterly' | 'yearly' | 'custom', customDays?: number): string => {
    const date = new Date(startDate);
    switch (interval) {
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      case 'custom':
        if (customDays) {
          date.setDate(date.getDate() + customDays);
        } else {
          date.setMonth(date.getMonth() + 1);
        }
        break;
    }
    return date.toISOString().split('T')[0];
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nextDueDate = newExpense.isRecurring 
        ? calculateNextDueDate(newExpense.date, newExpense.recurringInterval, newExpense.recurringCustomDays)
        : null;

      await addDoc(collection(db, 'expenses'), {
        ...newExpense,
        date: Timestamp.fromDate(new Date(newExpense.date)),
        nextDueDate,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        isVerified: false
      });
      setIsModalOpen(false);
      setNewExpense({
        head: '',
        date: new Date().toISOString().split('T')[0],
        endDate: '',
        amount: 0,
        currency: 'USD',
        taxAmount: 0,
        attachmentUrl: '',
        notes: '',
        isRecurring: false,
        recurringInterval: 'monthly',
        recurringCustomDays: 30
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    }
  };

  const handleRenewExpense = async (expense: Expense) => {
    if (!confirm(`Renew this expense? A new entry will be generated for ${expense.nextDueDate || 'the next period'}.`)) return;

    try {
      const nextStartDate = expense.nextDueDate || new Date().toISOString().split('T')[0];
      const nextDueDate = calculateNextDueDate(
        nextStartDate, 
        expense.recurringInterval || 'monthly', 
        expense.recurringCustomDays
      );

      await addDoc(collection(db, 'expenses'), {
        head: expense.head,
        amount: expense.amount,
        currency: expense.currency,
        taxAmount: expense.taxAmount,
        notes: `Renewal of ${expense.id}. ${expense.notes || ''}`,
        isRecurring: true,
        recurringInterval: expense.recurringInterval,
        recurringCustomDays: expense.recurringCustomDays,
        date: Timestamp.fromDate(new Date(nextStartDate)),
        nextDueDate,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        isVerified: false
      });
      alert('Renewal expense generated successfully.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    }
  };

  const handleVerifyExpense = async (expenseId: string) => {
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Manager') return;
    
    try {
      const expenseRef = doc(db, 'expenses', expenseId);
      await updateDoc(expenseRef, {
        isVerified: true,
        verifiedBy: currentUser.name,
        verifiedById: currentUser.id,
        verifiedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'expenses');
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (expense.isVerified && currentUser.role !== 'Admin') {
      alert('Only administrators can delete verified expenses.');
      return;
    }

    if (!confirm('Are you sure you want to move this expense to trash?')) return;

    try {
      await moveToTrash('expenses', expense.id, expense, currentUser.name);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'expenses');
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.head.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          expense.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesHead = !headFilter || expense.head === headFilter;
    return matchesSearch && matchesHead;
  });

  const expiringSubscriptions = officeSubscriptions.filter(sub => {
    const expiry = new Date(sub.expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30; // Expiring within 30 days
  });

  const expiringExpenses = expenses.filter(expense => {
    if (!expense.endDate) return false;
    const expDate = new Date(expense.endDate);
    const today = new Date();
    const diff = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 30; // Count as expiring within 30 days for summary
  });

  const totalUSD = filteredExpenses
    .filter(e => e.currency === 'USD')
    .reduce((sum, e) => sum + e.amount + e.taxAmount, 0);
  
  const totalPKR = filteredExpenses
    .filter(e => e.currency === 'PKR')
    .reduce((sum, e) => sum + e.amount + e.taxAmount, 0);

  // Chart Data
  const categoryData = expenseHeads.map(head => ({
    name: head,
    value: filteredExpenses
      .filter(e => e.head === head)
      .reduce((sum, e) => sum + (e.currency === 'USD' ? e.amount + e.taxAmount : (e.amount + e.taxAmount) / 280), 0) // Normalize to USD for chart
  })).filter(d => d.value > 0);

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthName = date.toLocaleString('default', { month: 'short' });
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    return {
      name: monthName,
      amount: filteredExpenses
        .filter(e => e.date.startsWith(monthYear))
        .reduce((sum, e) => sum + (e.currency === 'USD' ? e.amount + e.taxAmount : (e.amount + e.taxAmount) / 280), 0)
    };
  }).reverse();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Expense Tracking</h2>
          <p className="text-slate-500 mt-1">Manage daily business expenses, taxes, and attachments.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'list' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <FileText size={16} />
              List
            </button>
            <button 
              onClick={() => setViewMode('summary')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'summary' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <BarChart3 size={16} />
              Summary
            </button>
            <button 
              onClick={() => setViewMode('subscriptions')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'subscriptions' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Clock size={16} />
              Subscriptions
              {(expiringSubscriptions.length > 0 || expiringExpenses.length > 0) && (
                <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
              )}
            </button>
          </div>
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          {isAdmin && (
            <div className="flex gap-2">
              <button 
                onClick={() => setIsConfigModalOpen(true)}
                className="p-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                title="Configure Expense Heads"
              >
                <Settings2 size={20} />
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                <Plus size={20} />
                Add Expense
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Expenses (USD)</p>
            <h4 className="text-xl font-bold text-slate-900">${(totalUSD || 0).toLocaleString()}</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Expenses (PKR)</p>
            <h4 className="text-xl font-bold text-slate-900">Rs. {(totalPKR || 0).toLocaleString()}</h4>
          </div>
        </div>
      </div>

      {viewMode === 'summary' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PieChartIcon size={20} className="text-indigo-600" />
              Expenses by Category (USD Equiv.)
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `$${(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingDown size={20} className="text-rose-600" />
              Monthly Spending Trend (USD Equiv.)
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip 
                    formatter={(value: number) => `$${(value || 0).toLocaleString()}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : viewMode === 'subscriptions' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Office Subscriptions</h3>
            <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-xs font-bold">
              {expiringSubscriptions.length} Expiring Soon
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {officeSubscriptions.map(sub => {
              const isExpiring = expiringSubscriptions.some(s => s.id === sub.id);
              return (
                <div key={sub.id} className={cn(
                  "p-6 bg-white rounded-3xl border shadow-sm space-y-4 relative overflow-hidden",
                  isExpiring ? "border-rose-200" : "border-slate-100"
                )}>
                  {isExpiring && (
                    <div className="absolute top-0 right-0 bg-rose-500 text-white px-3 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-wider">
                      Expiring Soon
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      isExpiring ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
                    )}>
                      <Clock size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900">{sub.name}</h4>
                      <p className="text-xs text-slate-400 font-medium">Office Subscription</p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiry Date</p>
                      <p className={cn("text-sm font-bold", isExpiring ? "text-rose-600" : "text-slate-900")}>
                        {sub.expiryDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cost</p>
                      <p className="text-sm font-black text-indigo-600">
                        {(sub.cost || 0).toLocaleString()} {sub.currency}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {officeSubscriptions.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                <Clock size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold">No office subscriptions found.</p>
                <p className="text-xs mt-1">Configure subscriptions in System Settings.</p>
              </div>
            )}
          </div>

          {expenses.filter(e => e.isRecurring).length > 0 && (
            <div className="space-y-6 pt-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Service & Recurring Expenses</h3>
                <div className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-bold">
                  {expiringExpenses.length} Expiring Soon
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {expenses.filter(e => e.isRecurring).map(expense => {
                  const isExpiring = expense.endDate && (() => {
                    const expDate = new Date(expense.endDate);
                    const today = new Date();
                    const diff = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return diff >= 0 && diff <= 30;
                  })();
                  const isExpired = expense.endDate && new Date(expense.endDate) < new Date();

                  return (
                    <div key={expense.id} className={cn(
                      "p-6 bg-white rounded-3xl border shadow-sm space-y-4 relative overflow-hidden",
                      isExpired ? "border-rose-200 bg-rose-50/10" : isExpiring ? "border-amber-200" : "border-slate-100"
                    )}>
                      {isExpired ? (
                        <div className="absolute top-0 right-0 bg-rose-500 text-white px-3 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-wider">
                          Expired
                        </div>
                      ) : isExpiring && (
                        <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-wider">
                          Expiring
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center",
                          isExpired ? "bg-rose-100 text-rose-600" : isExpiring ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"
                        )}>
                          <FileText size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900">{expense.head}</h4>
                          <p className="text-xs text-slate-400 font-medium">Recurring Expense</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interval</p>
                          <p className="text-sm font-bold text-slate-700 capitalize">{expense.recurringInterval}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Due</p>
                          <p className="text-sm font-black text-indigo-600">{expense.nextDueDate || '-'}</p>
                        </div>
                      </div>

                      {(isExpired || isExpiring || expense.nextDueDate) && isAdmin && (
                        <button
                          onClick={() => handleRenewExpense(expense)}
                          className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCw size={14} />
                          Renew Subscription
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search expenses..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select 
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={headFilter}
              onChange={e => setHeadFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {expenseHeads.map(head => (
                <option key={head} value={head}>{head}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
                  <Loader2 className="animate-spin" size={32} />
                  <p className="text-sm font-medium">Loading expenses...</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                    <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                      {selectedColumns.includes('head') && <th className="px-6 py-4">Expense Head</th>}
                      {selectedColumns.includes('date') && <th className="px-6 py-4">Date</th>}
                      {selectedColumns.includes('amount') && <th className="px-6 py-4">Amount</th>}
                      {selectedColumns.includes('tax') && <th className="px-6 py-4">Tax</th>}
                      {selectedColumns.includes('total') && <th className="px-6 py-4">Total</th>}
                      {selectedColumns.includes('attachment') && <th className="px-6 py-4">Attachment</th>}
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <AnimatePresence mode="popLayout">
                      {filteredExpenses.map((expense) => {
                        const isExpiring = expense.endDate && (() => {
                          const expDate = new Date(expense.endDate);
                          const today = new Date();
                          const diff = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          return diff >= 0 && diff <= 7;
                        })();

                        const isExpired = expense.endDate && new Date(expense.endDate) < new Date();

                        return (
                          <motion.tr 
                            layout
                            key={expense.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={cn(
                              "hover:bg-slate-50/50 transition-all group border-l-4",
                              isExpired ? "border-l-rose-500 bg-rose-50/20" : 
                              isExpiring ? "border-l-amber-500 bg-amber-50/20" : "border-l-transparent"
                            )}
                          >
                            {selectedColumns.includes('head') && (
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    isExpired ? "bg-rose-100 text-rose-600" : 
                                    isExpiring ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"
                                  )}>
                                    <FileText size={16} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-sm text-slate-900">{expense.head}</p>
                                      {expense.isRecurring && (
                                        <div title={`Recurring: ${expense.recurringInterval}`}>
                                          <Clock size={12} className="text-indigo-500" />
                                        </div>
                                      )}
                                    </div>
                                    {expense.notes && <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{expense.notes}</p>}
                                  </div>
                                </div>
                              </td>
                            )}
                            {selectedColumns.includes('date') && (
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                  <Calendar size={14} className="text-slate-400" />
                                  {expense.date}
                                </div>
                              </td>
                            )}
                            {selectedColumns.includes('endDate') && (
                              <td className="px-6 py-4">
                                {expense.endDate ? (
                                  <div className={cn(
                                    "flex items-center gap-2 text-sm font-bold",
                                    isExpired ? "text-rose-600" : isExpiring ? "text-amber-600" : "text-slate-600"
                                  )}>
                                    <Clock size={14} className="opacity-50" />
                                    {expense.endDate}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-300">-</span>
                                )}
                              </td>
                            )}
                            {selectedColumns.includes('amount') && (
                              <td className="px-6 py-4">
                                <span className="text-sm font-bold text-slate-900">
                                  {expense.currency === 'USD' ? '$' : 'Rs. '}{(expense.amount || 0).toLocaleString()}
                                </span>
                              </td>
                            )}
                            {selectedColumns.includes('tax') && (
                              <td className="px-6 py-4">
                                <span className="text-sm text-slate-500">
                                  {expense.currency === 'USD' ? '$' : 'Rs. '}{(expense.taxAmount || 0).toLocaleString()}
                                </span>
                              </td>
                            )}
                            {selectedColumns.includes('total') && (
                              <td className="px-6 py-4">
                                <span className="text-sm font-bold text-indigo-600">
                                  {expense.currency === 'USD' ? '$' : 'Rs. '}{((expense.amount || 0) + (expense.taxAmount || 0)).toLocaleString()}
                                </span>
                              </td>
                            )}
                            {selectedColumns.includes('nextDueDate') && (
                              <td className="px-6 py-4">
                                {expense.nextDueDate ? (
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-indigo-400">Next Due</span>
                                    <span className="text-xs font-bold text-slate-600">{expense.nextDueDate}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-300">-</span>
                                )}
                              </td>
                            )}
                            {selectedColumns.includes('attachment') && (
                              <td className="px-6 py-4">
                                {expense.attachmentUrl ? (
                                  <a 
                                    href={expense.attachmentUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg transition-all"
                                  >
                                    <ImageIcon size={14} />
                                    View
                                    <ExternalLink size={10} />
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">No attachment</span>
                                )}
                              </td>
                            )}
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {(isExpiring || isExpired || expense.nextDueDate) && isAdmin && (
                                  <button 
                                    onClick={() => handleRenewExpense(expense)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Renew / Regenerate Expense"
                                  >
                                    <RefreshCw size={16} />
                                  </button>
                                )}
                                {!expense.isVerified && (currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                                  <button 
                                    onClick={() => handleVerifyExpense(expense.id)}
                                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                    title="Mark as Verified"
                                  >
                                    <Shield size={16} />
                                  </button>
                                )}
                                {isAdmin && (
                                  <button 
                                    onClick={() => handleDeleteExpense(expense)}
                                    disabled={expense.isVerified && currentUser.role !== 'Admin'}
                                    className={cn(
                                      "p-2 rounded-lg transition-all",
                                      expense.isVerified && currentUser.role !== 'Admin'
                                        ? "text-slate-200 cursor-not-allowed"
                                        : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                    )}
                                    title={expense.isVerified && currentUser.role !== 'Admin' ? "Only Admins can delete verified entries" : "Delete Expense"}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => {
                                    // For now, we'll just show the notes in an alert if they exist
                                    if (expense.notes) {
                                      alert(`Expense Notes: ${expense.notes}`);
                                    } else {
                                      alert('No additional notes for this expense.');
                                    }
                                  }}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="View Notes"
                                >
                                  <MoreHorizontal size={16} />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Add New Expense"
      >
        <form onSubmit={handleAddExpense} className="space-y-4">
          <div className="space-y-2">
            <SearchableSelect
              label="Expense Head (Category)"
              required
              options={expenseHeads.map(head => ({ label: head, value: head }))}
              value={newExpense.head}
              onChange={value => setNewExpense(prev => ({ ...prev, head: value }))}
              placeholder="Select Category"
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-indigo-600" />
                <span className="text-sm font-bold text-slate-700">Recurring Expense</span>
              </div>
              <button 
                type="button"
                onClick={() => setNewExpense(prev => ({ ...prev, isRecurring: !prev.isRecurring }))}
                className={cn(
                  "w-12 h-6 rounded-full relative transition-all",
                  newExpense.isRecurring ? "bg-indigo-600" : "bg-slate-200"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  newExpense.isRecurring ? "left-7" : "left-1"
                )} />
              </button>
            </div>

            {newExpense.isRecurring && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Interval</label>
                  <div className="flex flex-wrap gap-2">
                    {['monthly', 'quarterly', 'yearly', 'custom'].map((interval) => (
                      <button
                        key={interval}
                        type="button"
                        onClick={() => setNewExpense(prev => ({ ...prev, recurringInterval: interval as any }))}
                        className={cn(
                          "flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                          newExpense.recurringInterval === interval 
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {interval}
                      </button>
                    ))}
                  </div>
                </div>

                {newExpense.recurringInterval === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom Frequency (Days)</label>
                    <input 
                      type="number"
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="e.g. 15"
                      value={newExpense.recurringCustomDays}
                      onChange={e => setNewExpense(prev => ({ ...prev, recurringCustomDays: Number(e.target.value) }))}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Start Date</label>
              <input 
                required
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newExpense.date}
                onChange={e => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">End Date (Expiry)</label>
              <input 
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newExpense.endDate}
                onChange={e => setNewExpense(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <SearchableSelect
              label="Currency"
              required
              options={[
                { label: "USD ($)", value: "USD" },
                { label: "PKR (Rs.)", value: "PKR" }
              ]}
              value={newExpense.currency}
              onChange={value => setNewExpense(prev => ({ ...prev, currency: value as 'USD' | 'PKR' }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Amount</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                  {newExpense.currency === 'USD' ? '$' : 'Rs.'}
                </div>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="0.00"
                  value={newExpense.amount}
                  onChange={e => setNewExpense(prev => ({ ...prev, amount: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Tax Amount</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                  {newExpense.currency === 'USD' ? '$' : 'Rs.'}
                </div>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="0.00"
                  value={newExpense.taxAmount}
                  onChange={e => setNewExpense(prev => ({ ...prev, taxAmount: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Attachment (Screenshot/PDF)</label>
            <div className="flex items-center gap-4">
              <label className="flex-1 flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                {uploading ? (
                  <Loader2 className="animate-spin text-indigo-600" size={24} />
                ) : (
                  <Upload className="text-slate-400 group-hover:text-indigo-600" size={24} />
                )}
                <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">
                  {newExpense.attachmentUrl ? 'Change Attachment' : 'Upload Screenshot or PDF'}
                </span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                />
              </label>
              {newExpense.attachmentUrl && (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                  {newExpense.attachmentUrl.startsWith('data:image') ? (
                    <img src={newExpense.attachmentUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                      <FileText size={24} />
                    </div>
                  )}
                  <button 
                    type="button"
                    onClick={() => setNewExpense(prev => ({ ...prev, attachmentUrl: '' }))}
                    className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Notes (Optional)</label>
            <textarea 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[80px]"
              placeholder="Add any additional details..."
              value={newExpense.notes}
              onChange={e => setNewExpense(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={uploading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              Save Expense
            </button>
          </div>
        </form>
      </Modal>

      {isConfigModalOpen && (
        <ConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          title="Configure Expense Heads"
          fieldName="expenseHeads"
          type="string-list"
          initialItems={expenseHeads}
        />
      )}
    </div>
  );
};
