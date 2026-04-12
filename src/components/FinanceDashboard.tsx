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
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, where, getDocs, addDoc } from 'firebase/firestore';
import { Order, User as UserType, Expense, Invoice } from '../types';
import { cn } from '../lib/utils';
import { Modal } from './Modal';

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
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

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

  const stats = {
    totalRevenue: orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0),
    pendingRevenue: orders.reduce((sum, o) => sum + (o.totalAmount - (o.paidAmount || 0)), 0),
    totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
    netProfit: orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0) - expenses.reduce((sum, e) => sum + e.amount, 0)
  };

  const filteredOrders = orders.filter(order => 
    order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Finance Dashboard</h2>
          <p className="text-slate-500 mt-1 font-medium">Monitor revenue, expenses, and order payments.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <DollarSign size={24} />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
              <ArrowUpRight size={12} /> +12%
            </span>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Revenue</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">${stats.totalRevenue.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Clock size={24} />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pending Payments</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">${stats.pendingRevenue.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <TrendingDown size={24} />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Expenses</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">${stats.totalExpenses.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Wallet size={24} />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Net Profit</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">${stats.netProfit.toLocaleString()}</h3>
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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase tracking-wider font-black">
                  <th className="px-6 py-4">Order</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Paid</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900">{order.orderNumber}</span>
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
                      <button 
                        onClick={() => { setSelectedOrder(order); setPaymentAmount(order.totalAmount - (order.paidAmount || 0)); setIsPaymentModalOpen(true); }}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Record Payment"
                      >
                        <Receipt size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900">Recent Expenses</h3>
          <div className="space-y-4">
            {expenses.slice(0, 5).map(expense => (
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
    </div>
  );
};
