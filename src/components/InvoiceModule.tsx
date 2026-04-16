import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  CreditCard, 
  Settings, 
  Plus,
  Search,
  Filter,
  Download,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InvoiceDashboard } from './InvoiceDashboard';
import { InvoiceList } from './InvoiceList';
import { InvoiceForm } from './InvoiceForm';
import { InvoiceDetail } from './InvoiceDetail';
import { Invoice, User as UserType } from '../types';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { usePermissions } from '../hooks/usePermissions';

interface InvoiceModuleProps {
  currentUser: UserType;
}

export const InvoiceModule: React.FC<InvoiceModuleProps> = ({ currentUser }) => {
  const { check } = usePermissions(currentUser);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'payments'>('dashboard');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const handleDeleteInvoice = async (id: string) => {
    if (!check('invoices', 'delete')) {
      alert('You do not have permission to delete invoices.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'invoices', id));
      } catch (error) {
        console.error('Error deleting invoice:', error);
      }
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600 text-white rounded-3xl shadow-xl shadow-indigo-200">
            <FileText size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">Finance & Invoicing</h1>
            <p className="text-slate-500 font-medium">Manage your revenue, invoices, and payments in one place.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {check('invoices', 'add') && (
            <button 
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Plus size={20} />
              New Invoice
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'dashboard' && <InvoiceDashboard />}
          {activeTab === 'invoices' && (
            <InvoiceList 
              onView={setSelectedInvoice}
              onEdit={setEditingInvoice}
              onDelete={handleDeleteInvoice}
              onCreate={() => setIsFormOpen(true)}
            />
          )}
          {activeTab === 'payments' && (
            <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center">
              <CreditCard size={48} className="text-slate-200 mx-auto mb-4" />
              <h3 className="text-xl font-black text-slate-900">Payments Module</h3>
              <p className="text-slate-500 max-w-md mx-auto mt-2">
                This section will show a comprehensive list of all payments received across all invoices.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modals */}
      {isFormOpen && (
        <InvoiceForm 
          onClose={() => setIsFormOpen(false)} 
          currentUser={currentUser} 
        />
      )}
      {editingInvoice && (
        <InvoiceForm 
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)} 
          currentUser={currentUser} 
        />
      )}
      {selectedInvoice && (
        <InvoiceDetail 
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
