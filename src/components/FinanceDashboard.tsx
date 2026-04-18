import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Loader2,
  Search,
  Filter,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Receipt,
  Trophy,
  Save,
  Eye,
  Plus,
  Trash2,
  FileText,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, where, getDocs, addDoc } from 'firebase/firestore';
import { Order, User as UserType, Expense, Invoice } from '../types';
import { cn } from '../lib/utils';
import { Modal } from './Modal';
import { geminiService } from '../services/geminiService';

interface FinanceDashboardProps {
  currentUser: UserType;
}

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ currentUser }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [newExpense, setNewExpense] = useState({ head: '', amount: 0, currency: 'PKR', date: new Date().toISOString().split('T')[0] });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const handleAiAnalysis = async () => {
    setIsAiAnalyzing(true);
    try {
      const summary = `Total Revenue: $${stats.totalRevenue}, Pending: $${stats.pendingRevenue}, Expenses: $${stats.totalExpenses}, Profit: $${stats.netProfit}`;
      const analysis = await geminiService.generateTaskDescription(summary, "Financial Analysis & Recommendations");
      setAiAnalysis(analysis);
    } catch (error) {
      console.error("AI Analysis error:", error);
    }
    setIsAiAnalyzing(false);
  };

  useEffect(() => {
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const expensesQuery = query(collection(db, 'expenses'), orderBy('date', 'desc'));

    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Order));
    });

    const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Expense));
      setLoading(false);
    });

    return () => {
      unsubOrders();
      unsubExpenses();
    };
  }, []);

  const handleRecordPayment = async () => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    try {
      const newPaidAmount = (selectedOrder.paidAmount || 0) + paymentAmount;
      const paymentStatus = newPaidAmount >= selectedOrder.totalAmount ? 'paid' : 'partially_paid';
      
      await updateDoc(doc(db, 'orders', selectedOrder.id), {
        paidAmount: newPaidAmount,
        paymentStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });

      // Also create an activity log
      await addDoc(collection(db, 'activity_logs'), {
        userId: currentUser.id,
        userName: currentUser.name,
        action: 'Payment Recorded',
        details: `Recorded payment of $${paymentAmount} for Order ${selectedOrder.orderNumber}`,
        timestamp: new Date().toISOString()
      });

      setIsPaymentModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRecordExpense = async () => {
    if (!newExpense.head || newExpense.amount <= 0) return;
    setIsUpdating(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        ...newExpense,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id
      });
      setIsExpenseModalOpen(false);
      setNewExpense({ head: '', amount: 0, currency: 'PKR', date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    } finally {
      setIsUpdating(false);
    }
  };

  const stats = {
    totalRevenue: orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0),
    pendingRevenue: orders.reduce((sum, o) => sum + (o.totalAmount - (o.paidAmount || 0)), 0),
    totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
    netProfit: orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0) - expenses.reduce((sum, e) => sum + e.amount, 0),
    totalBilled: orders.reduce((sum, o) => sum + o.totalAmount, 0)
  };

  const filteredOrders = orders.filter(order => 
    (order.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (order.clientName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Finance Dashboard</h2>
          <p className="text-slate-500 mt-1 font-medium">Monitor revenue, expenses, and order payments.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleAiAnalysis}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-600 border border-indigo-100 px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-100 transition-all shadow-sm"
          >
            {isAiAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            AI Insights
          </button>
          <button 
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={20} />
            Add Expense
          </button>
        </div>
      </div>

      {aiAnalysis && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 text-white p-6 rounded-3xl shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-[0.2em]">
                <Sparkles size={16} />
                Financial Intelligence Output
              </div>
              <button onClick={() => setAiAnalysis(null)} className="text-slate-400 hover:text-white transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">{aiAnalysis}</p>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-[100px] -mr-12 -mt-12 transition-transform group-hover:scale-110" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <DollarSign size={24} />
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                <ArrowUpRight size={12} /> +12%
              </span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Total Revenue</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none">${stats.totalRevenue.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-[100px] -mr-12 -mt-12 transition-transform group-hover:scale-110" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <Clock size={24} />
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Pending Payments</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none">${stats.pendingRevenue.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-[100px] -mr-12 -mt-12 transition-transform group-hover:scale-110" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <TrendingDown size={24} />
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Total Expenses</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none">${stats.totalExpenses.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-[100px] -mr-12 -mt-12 transition-transform group-hover:scale-110" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Wallet size={24} />
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Net Profit</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none">${stats.netProfit.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-[100px] -mr-12 -mt-12 transition-transform group-hover:scale-110" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Receipt size={24} />
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Order Payments</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none">${stats.totalRevenue.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders for Payment Tracking */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900">Order Payments</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Search orders..."
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                   <tr className="text-slate-500 text-[10px] uppercase tracking-wider font-black border-b border-slate-100">
                    <th className="px-6 py-4">Order</th>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Paid</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={32} className="opacity-20" />
                          <p className="text-sm font-medium">No orders found matching your search</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{order.orderNumber}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-black">{order.catalogItemName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-700">{order.clientName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900">${order.totalAmount}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-emerald-600">${order.paidAmount || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                          order.paymentStatus === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          order.paymentStatus === 'partially_paid' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          "bg-rose-50 text-rose-600 border-rose-100"
                        )}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }}
                            className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-white hover:border-indigo-200 hover:text-indigo-600 transition-all border border-slate-200 shadow-sm"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => { setSelectedOrder(order); setPaymentAmount(order.totalAmount - (order.paidAmount || 0)); setIsPaymentModalOpen(true); }}
                            className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-white hover:border-emerald-300 transition-all border border-emerald-100 shadow-sm"
                            title="Record Payment"
                          >
                            <Receipt size={16} />
                          </button>
                          {currentUser.role === 'Admin' && (
                            <button 
                              onClick={async () => {
                                if (window.confirm('Delete this order and related data?')) {
                                  try {
                                    await updateDoc(doc(db, 'orders', order.id), { isDeleted: true });
                                  } catch (e) {
                                    handleFirestoreError(e, OperationType.UPDATE, 'orders');
                                  }
                                }
                              }}
                              className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-white hover:border-rose-300 transition-all border border-rose-100 shadow-sm"
                              title="Delete Order"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </table>
          </div>
        </div>
      </div>

        {/* Recent Expenses */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900">Recent Expenses</h3>
            <button 
              onClick={() => setIsExpenseModalOpen(true)}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              title="Add Expense"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-4">
            {expenses.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-400 italic">No expenses recorded yet.</p>
              </div>
            ) : expenses.slice(0, 5).map(expense => (
              <div key={expense.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <TrendingDown size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{expense.head}</p>
                    <p className="text-[10px] text-slate-400">{expense.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-rose-600">-${expense.amount}</p>
                  <p className="text-[10px] text-slate-400 uppercase">{expense.currency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Payment"
      >
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Order Total:</span>
              <span className="font-bold text-slate-900">${selectedOrder?.totalAmount}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Already Paid:</span>
              <span className="font-bold text-emerald-600">${selectedOrder?.paidAmount || 0}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-indigo-200">
              <span className="text-slate-500 font-bold">Remaining Balance:</span>
              <span className="font-black text-indigo-600">${(selectedOrder?.totalAmount || 0) - (selectedOrder?.paidAmount || 0)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Payment Amount ($)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="number"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={paymentAmount}
                onChange={e => setPaymentAmount(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            <button 
              onClick={() => setIsPaymentModalOpen(false)}
              className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleRecordPayment}
              disabled={isUpdating}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Save Payment
            </button>
          </div>
        </div>
      </Modal>

      {/* Expense Modal */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Record New Expense"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Expense Description / Head</label>
              <input 
                type="text"
                placeholder="e.g. Office Rent, Electricity Bill..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newExpense.head}
                onChange={e => setNewExpense(prev => ({ ...prev, head: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Amount</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="number"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newExpense.amount}
                    onChange={e => setNewExpense(prev => ({ ...prev, amount: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Currency</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newExpense.currency}
                  onChange={e => setNewExpense(prev => ({ ...prev, currency: e.target.value as any }))}
                >
                  <option value="PKR">PKR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Date</label>
              <input 
                type="date"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newExpense.date}
                onChange={e => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            <button 
              onClick={() => setIsExpenseModalOpen(false)}
              className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleRecordExpense}
              disabled={isUpdating}
              className="flex-1 flex items-center justify-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Save Expense
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Order Details: ${selectedOrder?.orderNumber}`}
        maxWidth="3xl"
      >
        {selectedOrder && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Client Requirements</h4>
                <div className="space-y-3">
                  {Object.entries(selectedOrder.requirementsData || {}).map(([key, value]) => (
                    <div key={key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">{key}</label>
                      <div className="text-sm text-slate-900 font-bold break-words">
                        {typeof value === 'string' && (value as string).startsWith('http') ? (
                          <a href={value as string} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
                            View File <FileText size={14} />
                          </a>
                        ) : String(value)}
                      </div>
                    </div>
                  ))}
                  {Object.keys(selectedOrder.requirementsData || {}).length === 0 && (
                    <p className="text-sm text-slate-400 italic">No requirements data found.</p>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Deliverables</h4>
                <div className="space-y-3">
                  {Object.entries(selectedOrder.deliverablesData || {}).map(([key, value]) => (
                    <div key={key} className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                      <label className="text-[10px] font-black text-emerald-600 uppercase block mb-1">{key}</label>
                      <div className="text-sm text-slate-900 font-bold break-words">{String(value)}</div>
                    </div>
                  ))}
                  {Object.keys(selectedOrder.deliverablesData || {}).length === 0 && (
                    <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-sm text-slate-400 italic">No deliverables provided yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
