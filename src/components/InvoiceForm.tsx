import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Calculator, 
  Calendar,
  User,
  FileText,
  Percent,
  DollarSign,
  Search,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SearchableSelect } from './ui/SearchableSelect';
import { 
  Invoice, 
  InvoiceItem, 
  Client, 
  ServiceType, 
  RecurringDetails,
  User as UserType
} from '../types';
import { financeService } from '../services/financeService';
import { db, handleFirestoreError, OperationType, logActivity, getErrorMessage } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, orderBy } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { cn, formatDateForInput } from '../lib/utils';
import { Modal } from './Modal';

interface InvoiceFormProps {
  invoice?: Invoice;
  onClose: () => void;
  currentUser: UserType;
  initialClientId?: string;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ 
  invoice, 
  onClose, 
  currentUser,
  initialClientId 
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [usdPkrRate, setUsdPkrRate] = useState(280);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.usdPkrRate) setUsdPkrRate(data.usdPkrRate);
      }
    });
  }, []);

  const [formData, setFormData] = useState<Partial<Invoice>>({
    clientId: initialClientId || invoice?.clientId || '',
    invoiceNumber: invoice?.invoiceNumber || '',
    issueDate: invoice?.issueDate || new Date().toISOString().split('T')[0],
    dueDate: invoice?.dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: invoice?.items?.map(item => ({
      ...item,
      billingType: item.billingType || 'one-time',
      isActive: item.isActive ?? true
    })) || [{
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      quantity: 1,
      rate: 0,
      taxRate: 0,
      discountRate: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      billingType: 'one-time',
      isActive: true
    }],
    notes: invoice?.notes || '',
    terms: invoice?.terms || 'Payment is due within 15 days. Thank you for your business!',
    currency: invoice?.currency || 'PKR'
  });

  useEffect(() => {
    // Correctly fetch clients from users collection with role Client
    const q = query(
      collection(db, 'users'), 
      where('role', '==', 'Client'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
    }, (err) => {
      console.error("Error fetching clients for invoice:", err);
    });
    
    if (invoice) {
      setFormData({
        ...formData,
        ...invoice,
        issueDate: formatDateForInput(invoice.issueDate),
        dueDate: formatDateForInput(invoice.dueDate),
        recurringDetails: invoice.recurringDetails ? {
          ...invoice.recurringDetails,
          startDate: formatDateForInput(invoice.recurringDetails.startDate),
          endDate: formatDateForInput(invoice.recurringDetails.endDate),
          nextGenerationDate: formatDateForInput(invoice.recurringDetails.nextGenerationDate)
        } : undefined
      });
    }
    
    if (!invoice?.invoiceNumber) {
      financeService.generateInvoiceNumber().then(num => {
        setFormData(prev => ({ ...prev, invoiceNumber: num }));
      });
    }

    return () => unsub();
  }, [invoice]);

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          id: Math.random().toString(36).substr(2, 9),
          description: '',
          quantity: 1,
          rate: 0,
          taxRate: 0,
          discountRate: 0,
          taxAmount: 0,
          discountAmount: 0,
          total: 0,
          billingType: 'one-time',
          isActive: true
        }
      ]
    }));
  };

  const handleRemoveItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items?.filter(item => item.id !== id)
    }));
  };

  const handleUpdateItem = (id: string, updates: Partial<InvoiceItem>) => {
    setFormData(prev => {
      const newItems = prev.items?.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, ...updates };
          
          // Set initial nextRenewalDate if switching to recurring
          if (updates.billingType === 'recurring' && !updatedItem.nextRenewalDate) {
            updatedItem.interval = updatedItem.interval || 'monthly';
            const date = new Date(formData.issueDate || new Date());
            if (updatedItem.interval === 'monthly') date.setMonth(date.getMonth() + 1);
            if (updatedItem.interval === 'quarterly') date.setMonth(date.getMonth() + 3);
            if (updatedItem.interval === 'annually') date.setFullYear(date.getFullYear() + 1);
            updatedItem.nextRenewalDate = date.toISOString().split('T')[0];
          }

          // Recalculate item total
          const subtotal = updatedItem.rate * updatedItem.quantity;
          const discount = subtotal * (updatedItem.discountRate / 100);
          const tax = (subtotal - discount) * (updatedItem.taxRate / 100);
          updatedItem.discountAmount = discount;
          updatedItem.taxAmount = tax;
          updatedItem.total = subtotal - discount + tax;
          return updatedItem;
        }
        return item;
      });
      return { ...prev, items: newItems };
    });
  };

  const totals = financeService.calculateInvoiceTotals(formData.items || [], formData.currency || 'PKR', usdPkrRate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLoading(true);
    setError(null);
    try {
      const client = clients.find(c => c.id === formData.clientId);
      const invoiceData = {
        ...formData,
        clientName: client?.name,
        usdPkrRate,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        discountTotal: totals.discountTotal,
        total: totals.total,
        amountUSD: totals.amountUSD,
        amountPKR: totals.amountPKR,
        balance: invoice ? (formData.balance || totals.total) : totals.total,
        balanceUSD: invoice ? (formData.balanceUSD || totals.amountUSD) : totals.amountUSD,
        balancePKR: invoice ? (formData.balancePKR || totals.amountPKR) : totals.amountPKR,
        status: invoice?.status || 'draft',
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      };

      if (invoice) {
        await updateDoc(doc(db, 'invoices', invoice.id), invoiceData);
        toast.success('Invoice updated successfully');
      } else {
        await addDoc(collection(db, 'invoices'), {
          ...invoiceData,
          createdAt: serverTimestamp(),
          createdById: currentUser.id,
          createdBy: currentUser.name
        });
        toast.success('Invoice created successfully');
      }
      onClose();
    } catch (err: any) {
      const friendlyMessage = getErrorMessage(err);
      setError(friendlyMessage);
      toast.error(friendlyMessage);
      handleFirestoreError(err, OperationType.WRITE, 'invoices');
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={invoice ? `Edit Invoice ${invoice.invoiceNumber}` : 'Create New Invoice'}
      maxWidth="5xl"
    >
      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-600 mb-6"
            >
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <SearchableSelect
                label="Select Client"
                options={clients
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                  .map(c => ({
                    label: c.name,
                    value: c.id,
                    subLabel: c.email
                  }))}
                value={formData.clientId || ''}
                onChange={value => setFormData({ ...formData, clientId: value })}
                placeholder="Choose a client..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <FileText size={14} className="text-indigo-500" />
                Invoice Number
              </label>
              <input 
                type="text"
                readOnly
                className="w-full p-3 bg-slate-100 border border-slate-200 rounded-2xl outline-none text-slate-500 font-bold"
                value={formData.invoiceNumber || ''}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <DollarSign size={14} className="text-indigo-500" />
                Currency
              </label>
              <select 
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                value={formData.currency || ''}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value as 'USD' | 'PKR' })}
              >
                <option value="PKR">PKR (Rs.)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Calendar size={14} className="text-indigo-500" />
                  Issue Date
                </label>
                <input 
                  type="date"
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  value={formData.issueDate || ''}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Calendar size={14} className="text-indigo-500" />
                  Due Date
                </label>
                <input 
                  type="date"
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  value={formData.dueDate || ''}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Invoice Items</h3>
              <button 
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all"
              >
                <Plus size={16} />
                Add Item
              </button>
            </div>

            <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Description</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest w-32">Billing</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest w-24">Qty</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest w-32">Rate</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest w-24">Tax %</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest w-24">Disc %</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest w-32">Total</th>
                    <th className="p-4 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {formData.items?.map((item) => (
                      <motion.tr 
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="border-b border-slate-50 group"
                      >
                        <td className="p-4">
                          <input 
                            type="text"
                            placeholder="Item description..."
                            className="w-full bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300"
                            value={item.description || ''}
                            onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5">
                            <select 
                              className="bg-transparent border-none outline-none text-xs font-bold text-indigo-600 cursor-pointer"
                              value={item.billingType || ''}
                              onChange={(e) => handleUpdateItem(item.id, { billingType: e.target.value as any })}
                            >
                              <option value="one-time">One-time</option>
                              <option value="recurring">Recurring</option>
                            </select>
                            {item.billingType === 'recurring' && (
                              <select 
                                className="bg-slate-100 border-none outline-none text-[10px] font-bold text-slate-600 rounded px-1.5 py-0.5"
                                value={item.interval || ''}
                                onChange={(e) => handleUpdateItem(item.id, { interval: e.target.value as any })}
                              >
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="annually">Annually</option>
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <input 
                            type="number"
                            className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-700"
                            value={item.quantity || ''}
                            onChange={(e) => handleUpdateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-4">
                          <input 
                            type="number"
                            className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-700"
                            value={item.rate || ''}
                            onChange={(e) => handleUpdateItem(item.id, { rate: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-4">
                          <input 
                            type="number"
                            className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-700"
                            value={item.taxRate || ''}
                            onChange={(e) => handleUpdateItem(item.id, { taxRate: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-4">
                          <input 
                            type="number"
                            className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-700"
                            value={item.discountRate || ''}
                            onChange={(e) => handleUpdateItem(item.id, { discountRate: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-black text-slate-900">
                            {formData.currency} {item.total.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4">
                          <button 
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer: Notes & Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Notes</label>
                <textarea 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none text-sm font-medium"
                  placeholder="Additional notes for the client..."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Terms & Conditions</label>
                <textarea 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none text-sm font-medium"
                  placeholder="Terms and conditions..."
                  value={formData.terms || ''}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-3xl space-y-4 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between text-sm font-medium text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span>{formData.currency} {totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-rose-500">
                <span className="flex items-center gap-1">
                  <Percent size={14} />
                  Discount
                </span>
                <span>- {formData.currency} {totals.discountTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <Calculator size={14} />
                  Tax
                </span>
                <span>+ {formData.currency} {totals.taxTotal.toLocaleString()}</span>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col items-end gap-1">
                <div className="w-full flex justify-between items-center">
                  <span className="text-lg font-black text-slate-900 dark:text-white">Total Amount</span>
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{formData.currency} {totals.total.toLocaleString()}</span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Equivalent: {formData.currency === 'PKR' ? 'USD' : 'PKR'} {formData.currency === 'PKR' ? totals.amountUSD.toLocaleString() : totals.amountPKR.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </form>

      <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
        <button 
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
        >
          Cancel
        </button>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting || loading}
          className="px-8 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-50"
        >
          {isSubmitting || loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save size={18} />}
          {isSubmitting ? 'Saving...' : (invoice ? 'Update Invoice' : 'Save Invoice')}
        </button>
      </div>
    </Modal>
  );
};
