import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Mail, 
  Printer, 
  CreditCard, 
  History, 
  Calendar, 
  User, 
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Plus,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Invoice, Payment, User as UserType } from '../types';
import { financeService } from '../services/financeService';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Modal } from './Modal';

interface InvoiceDetailProps {
  invoice: Invoice;
  onClose: () => void;
  currentUser: UserType;
}

export const InvoiceDetail: React.FC<InvoiceDetailProps> = ({ invoice, onClose, currentUser }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(invoice.balance);
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'PKR'>(invoice.currency || 'PKR');
  const [paymentMethod, setPaymentMethod] = useState<Payment['method']>('Bank Transfer');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'payments'), 
      where('invoiceId', '==', invoice.id),
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setPayments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
    });
    return () => unsub();
  }, [invoice.id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await financeService.recordPayment({
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        amount: paymentAmount,
        currency: paymentCurrency,
        date: new Date().toISOString().split('T')[0],
        method: paymentMethod,
        reference: paymentRef,
        notes: paymentNotes,
        recordedBy: currentUser.name,
        recordedById: currentUser.id
      });
      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      setPaymentRef('');
      setPaymentNotes('');
    } catch (error) {
      console.error('Error recording payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'unpaid': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'overdue': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'partially_paid': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <FileText size={24} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">{invoice.invoiceNumber}</h2>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                  getStatusColor(invoice.status)
                )}>
                  {invoice.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium font-sans">Issued to {invoice.clientName} on {invoice.issueDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-all" title="Print">
              <Printer size={20} />
            </button>
            <button className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-all" title="Download PDF">
              <Download size={20} />
            </button>
            <button className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-all" title="Email Client">
              <Mail size={20} />
            </button>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2" />
            <button 
              onClick={onClose}
              className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 text-slate-900 dark:text-white">
            {/* Left Column: Invoice Details */}
            <div className="lg:col-span-2 space-y-12">
              {/* Invoice Header Section */}
              <div className="flex justify-between items-start">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Billed To</h3>
                    <p className="font-black text-slate-900 dark:text-white text-lg">{invoice.clientName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-xs">Client ID: {invoice.clientId}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-8 text-slate-900 dark:text-white">
                    <div>
                      <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Issue Date</h3>
                      <p className="font-bold text-slate-700 dark:text-slate-300">{invoice.issueDate}</p>
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Due Date</h3>
                      <p className="font-bold text-slate-700 dark:text-slate-300">{invoice.dueDate}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Amount Due</h3>
                  <div className="space-y-1">
                    <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">
                      $ {(invoice.balanceUSD || (invoice.currency === 'USD' ? invoice.balance : invoice.balance / (invoice.usdPkrRate || 280))).toLocaleString()}
                    </p>
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                      Rs. {(invoice.balancePKR || (invoice.currency === 'PKR' ? invoice.balance : invoice.balance * (invoice.usdPkrRate || 280))).toLocaleString()}
                    </p>
                  </div>
                  {invoice.status === 'overdue' && (
                    <div className="mt-2 flex items-center justify-end gap-1 text-rose-500 font-bold text-xs uppercase tracking-wider">
                      <AlertCircle size={14} />
                      Overdue
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="p-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Description</th>
                      <th className="p-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Qty</th>
                      <th className="p-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Rate</th>
                      <th className="p-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {(invoice.items || []).map((item, i) => (
                      <tr key={i} className="dark:bg-slate-900">
                        <td className="p-4">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{item.description}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {item.serviceType && (
                              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg">
                                {item.serviceType}
                              </span>
                            )}
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg",
                              item.billingType === 'recurring' ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            )}>
                              {item.billingType === 'recurring' ? `Recurring (${item.interval})` : 'One-time'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center font-medium text-slate-600 dark:text-slate-400">{item.quantity}</td>
                        <td className="p-4 text-right font-medium text-slate-600 dark:text-slate-400">
                          {invoice.currency === 'USD' ? '$' : 'Rs.'} {item.rate.toLocaleString()}
                        </td>
                        <td className="p-4 text-right font-black text-slate-900 dark:text-white">
                          {invoice.currency === 'USD' ? '$' : 'Rs.'} {item.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={3} className="p-4 text-right text-sm font-bold text-slate-500 dark:text-slate-400">Subtotal</td>
                      <td className="p-4 text-right font-bold text-slate-700 dark:text-slate-300">
                        {invoice.currency === 'USD' ? '$' : 'Rs.'} {invoice.subtotal.toLocaleString()}
                      </td>
                    </tr>
                    {invoice.discountTotal > 0 && (
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                        <td colSpan={3} className="p-4 text-right text-sm font-bold text-rose-500">Discount</td>
                        <td className="p-4 text-right font-bold text-rose-500">- {invoice.currency === 'USD' ? '$' : 'Rs.'} {invoice.discountTotal.toLocaleString()}</td>
                      </tr>
                    )}
                    {invoice.taxTotal > 0 && (
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                        <td colSpan={3} className="p-4 text-right text-sm font-bold text-slate-500 dark:text-slate-400">Tax</td>
                        <td className="p-4 text-right font-bold text-slate-700 dark:text-slate-300">+ {invoice.currency === 'USD' ? '$' : 'Rs.'} {invoice.taxTotal.toLocaleString()}</td>
                      </tr>
                    )}
                    <tr className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                      <td colSpan={3} className="p-6 text-right text-lg font-black text-slate-900 dark:text-white">Total</td>
                      <td className="p-6 text-right text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        {invoice.currency === 'USD' ? '$' : 'Rs.'} {invoice.total.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-2 gap-8 text-slate-900 dark:text-white">
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Notes</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                    {invoice.notes || 'No additional notes.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Terms & Conditions</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                    {invoice.terms || 'Standard terms apply.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Payment History & Actions */}
            <div className="space-y-8">
              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Actions</h3>
                {invoice.balance > 0 && (
                  <button 
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                  >
                    <CreditCard size={20} />
                    Record Payment
                  </button>
                )}
                <button className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-2xl font-black hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                  <Mail size={20} />
                  Send Reminder
                </button>
              </div>

              {/* Payment History */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Payment History</h3>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border dark:border-slate-700">
                    {payments.length} Payments
                  </span>
                </div>
                
                <div className="space-y-3">
                  {payments.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                      <History size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sans">No payments yet</p>
                    </div>
                  ) : (
                    payments.map((payment) => (
                      <div key={payment.id} className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {payment.currency === 'USD' ? '$' : 'Rs.'} {payment.amount.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-lg">
                            {payment.method}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                          <div className="flex justify-between">
                            <span>{payment.date}</span>
                            <span>Ref: {payment.reference || 'N/A'}</span>
                          </div>
                          {(payment.amountUSD && payment.amountPKR) && (
                            <div className="flex gap-2 text-indigo-500/80">
                              <span>$ {payment.amountUSD.toLocaleString()}</span>
                              <span>•</span>
                              <span>Rs. {payment.amountPKR.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        {payment.notes && (
                          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 italic font-sans border-t dark:border-slate-700 pt-2">
                            "{payment.notes}"
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Summary Card */}
              <div className="p-8 bg-slate-900 dark:bg-slate-800 rounded-[32px] text-white space-y-6 shadow-xl border dark:border-slate-700">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 dark:text-slate-500 font-medium">Total Amount</span>
                    <span className="font-bold">{invoice.currency === 'USD' ? '$' : 'Rs.'} {invoice.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 dark:text-slate-500 font-medium">Total Paid</span>
                    <span className="font-bold text-emerald-400 tracking-tight">
                      {invoice.currency === 'USD' ? '$' : 'Rs.'} {(invoice.total - invoice.balance).toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-slate-800 dark:border-slate-700 flex flex-col gap-1">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase">Balance Due</span>
                      <span className="text-3xl font-black text-indigo-400">
                        {invoice.currency === 'USD' ? '$' : 'Rs.'} {invoice.balance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2 text-[10px] font-bold text-slate-500 uppercase mt-1">
                      <span>$ {(invoice.balanceUSD || 0).toLocaleString()}</span>
                      <span>•</span>
                      <span>Rs. {(invoice.balancePKR || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Record Payment Modal */}
        <Modal 
          isOpen={isPaymentModalOpen} 
          onClose={() => setIsPaymentModalOpen(false)} 
          title="Record Payment"
        >
          <form onSubmit={handleRecordPayment} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Currency</label>
                <select 
                  required
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold dark:text-white"
                  value={paymentCurrency || ''}
                  onChange={(e) => setPaymentCurrency(e.target.value as 'USD' | 'PKR')}
                >
                  <option value="PKR" className="dark:bg-slate-900">PKR (Rs.)</option>
                  <option value="USD" className="dark:bg-slate-900">USD ($)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Amount Received</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold text-xs pointer-events-none">
                    {paymentCurrency === 'USD' ? '$' : 'Rs.'}
                  </div>
                  <input 
                    type="number"
                    required
                    step="0.01"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold dark:text-white"
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2 md:col-span-1">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Payment Method</label>
                <select 
                  required
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold dark:text-white"
                  value={paymentMethod || ''}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                >
                  <option value="Bank Transfer" className="dark:bg-slate-900">Bank Transfer</option>
                  <option value="Cash" className="dark:bg-slate-900">Cash</option>
                  <option value="Online" className="dark:bg-slate-900">Online</option>
                  <option value="Cheque" className="dark:bg-slate-900">Cheque</option>
                  <option value="Adjustment" className="dark:bg-slate-900">Adjustment</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Reference / Transaction ID</label>
              <input 
                type="text"
                placeholder="e.g. TXN-123456"
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium dark:text-white"
                value={paymentRef || ''}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Notes</label>
              <textarea 
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none text-sm font-medium dark:text-white"
                placeholder="Any internal notes about this payment..."
                value={paymentNotes || ''}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button 
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-6 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-sans"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="px-8 py-2.5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <CreditCard size={18} />}
                Record Payment
              </button>
            </div>
          </form>
        </Modal>
      </motion.div>
    </div>
  );
};
