import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  DollarSign,
  FileText,
  Calendar,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Loader2,
  BookOpen,
  Briefcase
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Invoice, Client } from '../types';

interface InvoiceDetailProps {
  invoiceId: string;
  onBack: () => void;
  onViewJournal?: (id: string) => void;
  onViewTask?: (id: string) => void;
}

export const InvoiceDetail: React.FC<InvoiceDetailProps> = ({ invoiceId, onBack, onViewJournal, onViewTask }) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'invoices', invoiceId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Invoice;
        setInvoice({ id: snapshot.id, ...data });
        
        // Fetch client details
        if (data.clientId) {
          onSnapshot(doc(db, 'users', data.clientId), (clientSnap) => {
            if (clientSnap.exists()) {
              setClient({ id: clientSnap.id, ...clientSnap.data() } as Client);
            }
            setLoading(false);
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${data.clientId}`);
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `invoices/${invoiceId}`);
    });

    return () => unsubscribe();
  }, [invoiceId]);

  const handleMarkAsPaid = async () => {
    if (!invoice) return;
    try {
      await updateDoc(doc(db, 'invoices', invoice.id), { status: 'paid' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'invoices');
    }
  };

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><CheckCircle2 size={14} /> Paid</span>;
      case 'unpaid': return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Clock size={14} /> Unpaid</span>;
      case 'overdue': return <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><AlertTriangle size={14} /> Overdue</span>;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
        <Loader2 className="animate-spin" size={48} />
        <p className="font-bold">Loading invoice details...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
        <AlertTriangle size={48} />
        <p className="font-bold">Invoice not found.</p>
        <button onClick={onBack} className="text-indigo-600 font-bold hover:underline">Go Back</button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto p-8 space-y-8"
    >
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover:border-indigo-300 group-hover:bg-indigo-50 transition-all">
            <ArrowLeft size={18} />
          </div>
          Back to Invoices
        </button>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm">
            <Printer size={18} />
            Print
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm">
            <Download size={18} />
            Download PDF
          </button>
          {invoice.status !== 'paid' && (
            <button 
              onClick={handleMarkAsPaid}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
            >
              <CheckCircle2 size={18} />
              Mark as Paid
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        {/* Invoice Header */}
        <div className="p-12 bg-slate-900 text-white flex justify-between items-start">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <FileText size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">INVOICE</h1>
                <p className="text-indigo-300 font-mono text-sm tracking-widest uppercase">#{invoice.id.toUpperCase()}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-12">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Issue Date</p>
                <p className="font-bold">{new Date(invoice.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Due Date</p>
                <p className="font-bold text-rose-400">{invoice.dueDate}</p>
              </div>
            </div>
          </div>

          <div className="text-right space-y-4">
            <div className="inline-block">
              {getStatusBadge(invoice.status)}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Amount Due</p>
              <p className="text-5xl font-black text-white">${(invoice.total || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="p-12 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <User size={14} className="text-indigo-500" />
                Billed To
              </h3>
              <div className="space-y-2">
                <p className="text-2xl font-black text-slate-900">{client?.name || 'Unknown Client'}</p>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <Mail size={14} /> {client?.email}
                  </p>
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <Phone size={14} /> {client?.phone || 'No phone provided'}
                  </p>
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <MapPin size={14} /> {client?.address || 'No address provided'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Building2 size={14} className="text-indigo-500" />
                From
              </h3>
              <div className="space-y-2">
                <p className="text-2xl font-black text-slate-900">Host A Journal</p>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">Academic Publishing Services</p>
                  <p className="text-sm text-slate-500">info@hostajournal.com</p>
                  <p className="text-sm text-slate-500">www.hostajournal.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="px-12 pb-12">
          <div className="rounded-3xl border border-slate-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-4">Description</th>
                  <th className="px-8 py-4 text-center">Quantity</th>
                  <th className="px-8 py-4 text-right">Unit Price</th>
                  <th className="px-8 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoice.items.map((item, i) => (
                  <tr key={i} className="group hover:bg-slate-50/30 transition-all">
                    <td className="px-8 py-6">
                      <p className="font-bold text-slate-900">{item.description}</p>
                    </td>
                    <td className="px-8 py-6 text-center font-medium text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="px-8 py-6 text-right font-medium text-slate-600">
                      ${(item.unitPrice || 0).toLocaleString()}
                    </td>
                    <td className="px-8 py-6 text-right font-black text-slate-900">
                      ${(item.total || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Summary */}
        <div className="px-12 pb-12 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-4">
            {invoice.notes && (
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Notes</h3>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 italic text-sm text-slate-600 leading-relaxed">
                  "{invoice.notes}"
                </div>
              </div>
            )}
            <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-start gap-4">
              <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-xs font-black text-indigo-900 uppercase tracking-wider">Payment Terms</p>
                <p className="text-xs text-indigo-700 mt-1">Please make payment by the due date to avoid service interruption. For bank transfers, include invoice ID as reference.</p>
              </div>
            </div>

            {(invoice.journalId || invoice.taskId) && (
              <div className="space-y-4 pt-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Related Items</h3>
                <div className="grid grid-cols-1 gap-3">
                  {invoice.journalId && (
                    <button 
                      onClick={() => onViewJournal?.(invoice.journalId!)}
                      className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-left hover:bg-amber-100 transition-all group"
                    >
                      <div className="p-2 bg-white rounded-lg text-amber-600 shadow-sm group-hover:scale-110 transition-transform">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-amber-900 uppercase tracking-wider">Linked Journal</p>
                        <p className="text-sm font-bold text-amber-700 truncate">{invoice.journalTitle || 'View Journal'}</p>
                      </div>
                    </button>
                  )}
                  {invoice.taskId && (
                    <button 
                      onClick={() => onViewTask?.(invoice.taskId!)}
                      className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-left hover:bg-indigo-100 transition-all group"
                    >
                      <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                        <Briefcase size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-indigo-900 uppercase tracking-wider">Linked Task</p>
                        <p className="text-sm font-bold text-indigo-700 truncate">{invoice.taskTitle || 'View Task'}</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-slate-50 rounded-[2rem] p-8 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Subtotal</span>
                <span className="text-lg font-bold text-slate-900">${(invoice.subtotal || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Tax</span>
                <span className="text-lg font-bold text-slate-900">${(invoice.tax || 0).toLocaleString()}</span>
              </div>
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                <span className="text-lg font-black text-slate-900 uppercase tracking-widest">Total</span>
                <div className="text-right">
                  <p className="text-3xl font-black text-indigo-600">${(invoice.total || 0).toLocaleString()}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All prices in USD</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
