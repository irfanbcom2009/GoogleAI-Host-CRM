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
import { cn } from '../lib/utils';

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
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setInvoices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
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
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search by invoice # or client..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <select 
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
        <button 
          onClick={onCreate}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus size={20} />
          Create Invoice
        </button>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-100">
                <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest">Invoice</th>
                <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest">Client</th>
                <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest">Date</th>
                <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest">Amount</th>
                <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest">Balance</th>
                <th className="p-6 text-xs font-black text-slate-500 uppercase tracking-widest">Status</th>
                <th className="p-6 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <FileText size={48} strokeWidth={1} />
                      <p className="font-medium">No invoices found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {inv.invoiceNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {inv.billingType}
                        </span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="font-bold text-slate-700">{inv.clientName}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-600">{inv.issueDate}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Due: {inv.dueDate}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="font-black text-slate-900">PKR {inv.total.toLocaleString()}</span>
                    </td>
                    <td className="p-6">
                      <span className={cn(
                        "font-black",
                        inv.balance > 0 ? "text-rose-500" : "text-emerald-500"
                      )}>
                        PKR {inv.balance.toLocaleString()}
                      </span>
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
                        className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
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
                              className="absolute right-6 top-16 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 overflow-hidden py-2"
                            >
                              <button 
                                onClick={() => { onView(inv); setActiveMenu(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all"
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
