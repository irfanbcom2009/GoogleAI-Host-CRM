import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Globe, 
  Building2, 
  User, 
  Mail, 
  CreditCard, 
  Calendar, 
  Clock, 
  FileText, 
  Hash,
  ExternalLink,
  Printer,
  Download,
  History,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ISSNRequest, User as UserType } from '../types';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType, moveToTrash } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Shield, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

interface ISSNDetailProps {
  request: ISSNRequest;
  onBack: () => void;
  currentUser: UserType;
}

export const ISSNDetail: React.FC<ISSNDetailProps> = ({ request, onBack, currentUser }) => {
  const [isAddingInvoice, setIsAddingInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    invoiceNo: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    amount: 0,
    status: 'unpaid' as const
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'invoices'), {
        clientId: request.clientId,
        journalId: request.journalId,
        issnRequestId: request.id,
        invoiceNo: newInvoice.invoiceNo,
        issueDate: newInvoice.issueDate,
        dueDate: newInvoice.dueDate,
        total: newInvoice.amount,
        status: newInvoice.status,
        items: [{ description: `ISSN Request: ${request.requestNo}`, quantity: 1, unitPrice: newInvoice.amount, total: newInvoice.amount }],
        createdAt: serverTimestamp()
      });
      setIsAddingInvoice(false);
      setNewInvoice({
        invoiceNo: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        amount: 0,
        status: 'unpaid'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invoices');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: ISSNRequest['status']) => {
    switch (status) {
      case 'approved': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">Approved</span>;
      case 'pending': return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wider">Pending</span>;
      case 'rejected': return <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold uppercase tracking-wider">Rejected</span>;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-8 space-y-8 max-w-6xl mx-auto"
    >
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all font-bold group"
        >
          <div className="p-2 bg-white border border-slate-200 rounded-xl group-hover:bg-slate-50 transition-all">
            <ArrowLeft size={20} />
          </div>
          Back to List
        </button>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm">
            <Printer size={18} />
            Print Detail
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
            <Download size={18} />
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Audit & Verification Section */}
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Shield size={20} className="text-indigo-600" />
                Verification Status
              </h3>
              {request.isVerified ? (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  Verified
                </span>
              ) : (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center gap-1">
                  <Clock size={14} />
                  Pending Verification
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entered By</p>
                <p className="text-sm font-bold text-slate-700">{request.createdBy || 'System'}</p>
                <p className="text-[10px] text-slate-500">{request.createdAt ? new Date(request.createdAt).toLocaleString() : 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Updated By</p>
                <p className="text-sm font-bold text-slate-700">{request.updatedBy || 'System'}</p>
                <p className="text-[10px] text-slate-500">{request.updatedAt ? new Date(request.updatedAt).toLocaleString() : 'N/A'}</p>
              </div>
              {request.isVerified && (
                <div className="space-y-1 col-span-full pt-2 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified By</p>
                  <p className="text-sm font-bold text-emerald-600">{request.verifiedBy}</p>
                  <p className="text-[10px] text-slate-500">{request.verifiedAt ? new Date(request.verifiedAt).toLocaleString() : 'N/A'}</p>
                </div>
              )}
            </div>

            {!request.isVerified && (currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
              <button 
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'issn_requests', request.id), {
                      isVerified: true,
                      verifiedBy: currentUser.name,
                      verifiedById: currentUser.id,
                      verifiedAt: new Date().toISOString()
                    });
                  } catch (error) {
                    handleFirestoreError(error, OperationType.UPDATE, 'issn_requests');
                  }
                }}
                className="w-full mt-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Mark as Verified
              </button>
            )}
          </div>

          {/* Header Card */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
              {getStatusBadge(request.status)}
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-indigo-600 font-mono text-sm font-bold tracking-widest uppercase">
                <Hash size={16} />
                ISSN Request #: {request.requestNo}
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                {request.journalTitle || 'Journal Title Not Set'}
              </h1>
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-100 text-sm font-medium">
                  <Globe size={16} className="text-slate-400" />
                  {request.requestType}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-100 text-sm font-medium">
                  <Clock size={16} className="text-slate-400" />
                  Frequency_ISSN: {request.frequency}
                </div>
              </div>
            </div>
          </div>

          {/* ISSN Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} />
                ISSN Information
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">P-ISSN</span>
                  <span className="text-sm font-bold text-slate-900">{request.printIssn || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">E-ISSN</span>
                  <span className="text-sm font-bold text-slate-900">{request.onlineIssn || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Language</span>
                  <span className="text-sm font-bold text-slate-900">{request.language || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Country</span>
                  <span className="text-sm font-bold text-slate-900">{request.country || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Subject</span>
                  <span className="text-sm font-bold text-slate-900">{request.subject || 'N/A'}</span>
                </div>
                <div className="pt-2">
                  <p className="text-xs text-slate-400 font-bold uppercase mb-2">Journal URL</p>
                  <a 
                    href={request.journalUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 font-bold hover:underline flex items-center gap-1"
                  >
                    {request.journalUrl || 'No URL provided'}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Building2 size={14} />
                Publisher Details
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Name of Publisher (ISSN)</span>
                  <span className="text-sm font-bold text-slate-900">{request.publisherName || 'N/A'}</span>
                </div>
                <div className="pt-2">
                  <p className="text-xs text-slate-400 font-bold uppercase mb-2">Publisher Address (ISSN)</p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {request.publisherAddress || 'No address provided'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Login Credentials */}
          <div className="bg-slate-900 p-8 rounded-3xl text-white space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Clock size={14} />
              Portal Access
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-bold uppercase">Login ID</p>
                <p className="text-lg font-mono tracking-wider">{request.issnLogin || 'Not Set'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-bold uppercase">Password</p>
                <p className="text-lg font-mono tracking-wider">••••••••••••</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Contact Information */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contact name (ISSN)</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{request.contactName || 'N/A'}</p>
                  <p className="text-xs text-slate-500">Primary Contact</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <Mail size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{request.emailAddress || 'N/A'}</p>
                  <p className="text-xs text-slate-500">Email Address (ISSN)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 space-y-6">
            <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Payments ISSN</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-emerald-700">Payment Made</span>
                <span className="text-xl font-black text-emerald-800">PKR {request.paymentAmountPkr?.toLocaleString()}</span>
              </div>
              <div className="pt-4 border-t border-emerald-200 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-600">Invoice Number</span>
                  <span className="font-bold text-emerald-800">{request.legacyInvoiceNumber || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">ISSN Sent Date</p>
                  <p className="text-sm font-bold text-slate-900">{request.sentDate || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">ISSN Modified Date</p>
                  <p className="text-sm font-bold text-slate-900">{request.modifiedDate || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice History Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <History size={14} />
                Invoice History
              </h3>
              <button 
                onClick={() => setIsAddingInvoice(true)}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <Plus size={12} />
                Create New
              </button>
            </div>

            <AnimatePresence>
              {isAddingInvoice && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <form onSubmit={handleCreateInvoice} className="p-4 bg-slate-50 rounded-xl border border-indigo-100 space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Invoice No.</label>
                      <input 
                        required
                        type="text" 
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="INV-2024-XXX"
                        value={newInvoice.invoiceNo}
                        onChange={e => setNewInvoice(prev => ({ ...prev, invoiceNo: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Issue Date</label>
                        <input 
                          required
                          type="date" 
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none" 
                          value={newInvoice.issueDate}
                          onChange={e => setNewInvoice(prev => ({ ...prev, issueDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Due Date</label>
                        <input 
                          required
                          type="date" 
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none" 
                          value={newInvoice.dueDate}
                          onChange={e => setNewInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Amount (PKR)</label>
                      <input 
                        required
                        type="number" 
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="0.00"
                        value={newInvoice.amount}
                        onChange={e => setNewInvoice(prev => ({ ...prev, amount: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button 
                        type="button"
                        onClick={() => setIsAddingInvoice(false)}
                        className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isSubmitting ? 'Saving...' : 'Add Invoice'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">{request.legacyInvoiceNumber || 'INV-2024-001'}</p>
                  <p className="text-[10px] text-slate-500">{request.sentDate || '2024-03-15'}</p>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold uppercase">Paid</span>
              </div>
              <p className="text-[10px] text-slate-400 text-center italic">No other invoices found</p>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 space-y-6">
            <h3 className="text-xs font-bold text-rose-600 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle size={14} />
              Danger Zone
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-rose-600 leading-relaxed">
                {request.isVerified 
                  ? "This request is verified. Only administrators can move it to trash."
                  : "Moving this request to trash will remove it from the active list. It can be restored from the Trash Management section."}
              </p>
              <button 
                onClick={async () => {
                  if (request.isVerified && currentUser.role !== 'Admin') {
                    alert('Only administrators can delete verified requests.');
                    return;
                  }
                  if (!confirm('Are you sure you want to move this request to trash?')) return;
                  try {
                    await moveToTrash('issn_requests', request.id, request, currentUser.name);
                    onBack();
                  } catch (error) {
                    handleFirestoreError(error, OperationType.DELETE, 'issn_requests');
                  }
                }}
                disabled={request.isVerified && currentUser.role !== 'Admin'}
                className={cn(
                  "w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                  request.isVerified && currentUser.role !== 'Admin'
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200"
                )}
              >
                <Trash2 size={18} />
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
