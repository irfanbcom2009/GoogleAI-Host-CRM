import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  Edit, 
  Trash2, 
  Mail, 
  Download,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Invoice, InvoiceStatus, Client } from '../types';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { cn, formatDateForInput } from '../lib/utils';

interface InvoiceListProps {
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({ onView, onEdit, onDelete, onCreate }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'subscription'>('all');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setInvoices(snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          issueDate: formatDateForInput(data.issueDate),
          dueDate: formatDateForInput(data.dueDate)
        } as Invoice;
      }));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'unpaid': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'overdue': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'partially_paid': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'draft': return 'bg-slate-50 text-slate-500 border-slate-100';
      case 'sent': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'viewed': return 'bg-purple-50 text-purple-600 border-purple-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.clientName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || inv.subscription_source === 'Journal';
    return matchesSearch && matchesStatus && matchesSource;
  });

  return (
    <div className="space-y-6 bg-white dark:bg-slate-900">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input 
              type="text"
              placeholder="Search by invoice # or client..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white"
              value={searchTerm || ''}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400 dark:text-slate-500" />
            <select 
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              value={statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all" className="dark:bg-slate-900">All Status</option>
              {['draft', 'sent', 'unpaid', 'partially_paid', 'paid', 'overdue'].map(s => (
                <option key={s} value={s} className="dark:bg-slate-900 uppercase">{s.replace('_', ' ')}</option>
              ))}
            </select>

            <select 
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              value={sourceFilter || ''}
              onChange={(e) => setSourceFilter(e.target.value as any)}
            >
              <option value="all" className="dark:bg-slate-900">All Sources</option>
              <option value="subscription" className="dark:bg-slate-900">Subscriptions Only</option>
            </select>
          </div>
        </div>
        <button 
          onClick={onCreate}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <Plus size={20} />
          Create Invoice
        </button>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 shadow-sm">
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="p-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Invoice</th>
                <th className="p-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Client</th>
                <th className="p-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Date</th>
                <th className="p-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Amount (USD/PKR)</th>
                <th className="p-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Balance (USD/PKR)</th>
                <th className="p-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                <th className="p-6 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                      <FileText size={48} strokeWidth={1} />
                      <p className="font-medium">No invoices found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-all">
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                          {inv.invoiceNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {inv.billingType}
                        </span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{inv.clientName}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{inv.issueDate}</span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Due: {inv.dueDate}</span>
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex flex-col">
                        <span className="font-black text-indigo-600 dark:text-indigo-400">
                          $ {(inv.amountUSD || (inv.currency === 'USD' ? inv.total : inv.total / (inv.usdPkrRate || 280))).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                          Rs. {(inv.amountPKR || (inv.currency === 'PKR' ? inv.total : inv.total * (inv.usdPkrRate || 280))).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex flex-col">
                        <span className={cn(
                          "font-black",
                          (inv.balance || 0) > 0 ? "text-rose-500" : "text-emerald-500"
                        )}>
                          $ {(inv.balanceUSD || (inv.currency === 'USD' ? inv.balance : (inv.balance || 0) / (inv.usdPkrRate || 280))).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                          Rs. {(inv.balancePKR || (inv.currency === 'PKR' ? inv.balance : (inv.balance || 0) * (inv.usdPkrRate || 280))).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                        getStatusColor(inv.status)
                      )}>
                        {inv.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-6 relative">
                      <button 
                        onClick={() => setActiveMenu(activeMenu === inv.id ? null : inv.id)}
                        className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all shadow-sm"
                      >
                        <MoreVertical size={18} />
                      </button>

                      <AnimatePresence>
                        {activeMenu === inv.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setActiveMenu(null)} 
                            />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-6 top-16 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 overflow-hidden py-2"
                            >
                              <button 
                                onClick={() => { onView(inv); setActiveMenu(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all font-sans"
                              >
                                <Eye size={16} />
                                View Details
                              </button>
                              <button 
                                onClick={() => { onEdit(inv); setActiveMenu(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all"
                              >
                                <Edit size={16} />
                                Edit Invoice
                              </button>
                              <button 
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all"
                              >
                                <Mail size={16} />
                                Send Email
                              </button>
                              <button 
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all"
                              >
                                <Download size={16} />
                                Download PDF
                              </button>
                              <div className="h-px bg-slate-50 my-1" />
                              <button 
                                onClick={() => { onDelete(inv.id); setActiveMenu(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-rose-500 hover:bg-rose-50 transition-all"
                              >
                                <Trash2 size={16} />
                                Delete
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
