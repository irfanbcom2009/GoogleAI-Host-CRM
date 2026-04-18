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
  ChevronDown
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
import { db, handleFirestoreError, OperationType, logActivity } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, orderBy } from 'firebase/firestore';
import { cn, formatDateForInput } from '../lib/utils';

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
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<Partial<Invoice>>({
    clientId: initialClientId || invoice?.clientId || '',
    invoiceNumber: invoice?.invoiceNumber || '',
    issueDate: invoice?.issueDate || new Date().toISOString().split('T')[0],
    dueDate: invoice?.dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: invoice?.items || [{
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      quantity: 1,
      rate: 0,
      taxRate: 0,
      discountRate: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0
    }],
    notes: invoice?.notes || '',
    terms: invoice?.terms || 'Payment is due within 15 days. Thank you for your business!',
    billingType: invoice?.billingType || 'one-time',
    recurringDetails: invoice?.recurringDetails || {
      interval: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      nextGenerationDate: new Date().toISOString().split('T')[0],
      isActive: true
    }
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
          total: 0
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

  const totals = financeService.calculateInvoiceTotals(formData.items || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const client = clients.find(c => c.id === formData.clientId);
      const invoiceData = {
        ...formData,
        clientName: client?.name,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        discountTotal: totals.discountTotal,
        total: totals.total,
        balance: invoice ? (formData.balance || totals.total) : totals.total,
        status: invoice?.status || 'draft',
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      };

      if (invoice) {
        await updateDoc(doc(db, 'invoices', invoice.id), invoiceData);
      } else {
        await addDoc(collection(db, 'invoices'), {
          ...invoiceData,
          createdAt: serverTimestamp(),
          createdById: currentUser.id,
          createdBy: currentUser.name
        });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'invoices');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {invoice ? `Edit Invoice ${invoice.invoiceNumber}` : 'Create New Invoice'}
              </h2>
              <p className="text-sm text-slate-500 font-medium">Fill in the details to generate a professional invoice.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <SearchableSelect
                label="Select Client"
                options={clients.map(c => ({
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
                value={formData.invoiceNumber}
              />
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
                  value={formData.issueDate}
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
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Billing Type */}
          <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                <Calculator size={18} />
                Billing Configuration
              </h3>
              <div className="flex bg-white p-1 rounded-xl border border-indigo-100">
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, billingType: 'one-time' })}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    formData.billingType === 'one-time' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  One-time
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, billingType: 'recurring' })}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    formData.billingType === 'recurring' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Recurring
                </button>
              </div>
            </div>

            {formData.billingType === 'recurring' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-indigo-100"
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Billing Interval</label>
                  <select 
                    className="w-full p-2.5 bg-white border border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                    value={formData.recurringDetails?.interval}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      recurringDetails: { ...formData.recurringDetails!, interval: e.target.value as any } 
                    })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Start Date</label>
                  <input 
                    type="date"
                    className="w-full p-2.5 bg-white border border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                    value={formData.recurringDetails?.startDate}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      recurringDetails: { ...formData.recurringDetails!, startDate: e.target.value } 
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-indigo-700 uppercase tracking-wider">End Date (Optional)</label>
                  <input 
                    type="date"
                    className="w-full p-2.5 bg-white border border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                    value={formData.recurringDetails?.endDate}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      recurringDetails: { ...formData.recurringDetails!, endDate: e.target.value } 
                    })}
                  />
                </div>
              </motion.div>
            )}
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

            <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Description</th>
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
                            value={item.description}
                            onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                          />
                        </td>
                        <td className="p-4">
                          <input 
                            type="number"
                            className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-700"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-4">
                          <input 
                            type="number"
                            className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-700"
                            value={item.rate}
                            onChange={(e) => handleUpdateItem(item.id, { rate: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-4">
                          <input 
                            type="number"
                            className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-700"
                            value={item.taxRate}
                            onChange={(e) => handleUpdateItem(item.id, { taxRate: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-4">
                          <input 
                            type="number"
                            className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-700"
                            value={item.discountRate}
                            onChange={(e) => handleUpdateItem(item.id, { discountRate: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-black text-slate-900">
                            PKR {item.total.toLocaleString()}
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
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Terms & Conditions</label>
                <textarea 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none text-sm font-medium"
                  placeholder="Terms and conditions..."
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-3xl space-y-4">
              <div className="flex justify-between text-sm font-medium text-slate-500">
                <span>Subtotal</span>
                <span>PKR {totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-rose-500">
                <span className="flex items-center gap-1">
                  <Percent size={14} />
                  Discount
                </span>
                <span>- PKR {totals.discountTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-slate-700">
                <span className="flex items-center gap-1">
                  <Calculator size={14} />
                  Tax
                </span>
                <span>+ PKR {totals.taxTotal.toLocaleString()}</span>
              </div>
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                <span className="text-lg font-black text-slate-900">Total Amount</span>
                <span className="text-2xl font-black text-indigo-600">PKR {totals.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
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
            disabled={loading}
            className="px-8 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save size={18} />}
            {invoice ? 'Update Invoice' : 'Save Invoice'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
