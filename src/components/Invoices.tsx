import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Calendar,
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  Edit,
  Loader2,
  X,
  DollarSign,
  Printer,
  ChevronRight,
  Trash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, Timestamp, where } from 'firebase/firestore';
import { Invoice, Client, InvoiceItem, User as UserType, Journal, Task } from '../types';
import { Importer } from './Importer';
import { useServices } from '../hooks/useServices';
import { FileSpreadsheet, Shield } from 'lucide-react';
import { ColumnSelector } from './ColumnSelector';
import { moveToTrash } from '../lib/firebase';
import { InvoiceDetail } from './InvoiceDetail';
import { JournalDetail } from './JournalDetail';
import { Modal } from './Modal';
import { Briefcase, MessageSquare, Send } from 'lucide-react';

interface InvoicesProps {
  searchQuery?: string;
  currentUser: UserType;
}

const AVAILABLE_COLUMNS = [
  { id: 'id', label: 'Invoice ID' },
  { id: 'client', label: 'Client' },
  { id: 'total', label: 'Total Amount' },
  { id: 'status', label: 'Status' },
  { id: 'dueDate', label: 'Due Date' },
];

export const Invoices: React.FC<InvoicesProps> = ({ searchQuery = '', currentUser }) => {
  const { catalog: SERVICES_CATALOG } = useServices();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);
  const [viewingJournalId, setViewingJournalId] = useState<string | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['invoices'] || ['id', 'client', 'total', 'status', 'dueDate']
  );
  
  // Form state for new invoice
  const [newInvoice, setNewInvoice] = useState({
    clientId: '',
    journalId: '',
    taskId: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }] as InvoiceItem[],
    tax: 0,
    status: 'unpaid' as 'paid' | 'unpaid' | 'overdue',
    dueDate: '',
    notes: ''
  });

  useEffect(() => {
    let q;
    if (currentUser.role === 'Client') {
      q = query(
        collection(db, 'invoices'), 
        where('clientId', '==', currentUser.id),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    }

    const unsubscribeInvoices = onSnapshot(q, (snapshot) => {
      const invoiceData = snapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate().toISOString()
          : data.createdAt || new Date().toISOString();
          
        return {
          id: doc.id,
          ...data,
          createdAt,
          items: data.items || [],
          subtotal: data.subtotal || 0,
          tax: data.tax || 0,
          total: data.total || 0,
          status: data.status || 'unpaid',
          dueDate: data.dueDate instanceof Timestamp 
            ? data.dueDate.toDate().toISOString().split('T')[0]
            : data.dueDate || ''
        };
      }) as Invoice[];
      setInvoices(invoiceData);
      setLoading(false);
    }, (error) => {
      console.error('Invoices fetch error:', error);
      // If index is missing or permissions fail, try a simpler query for clients
      if (currentUser.role === 'Client') {
        const simpleQ = query(collection(db, 'invoices'), where('clientId', '==', currentUser.id));
        onSnapshot(simpleQ, (snapshot) => {
          const invoiceData = snapshot.docs.map(doc => {
            const data = doc.data();
            const createdAt = data.createdAt instanceof Timestamp 
              ? data.createdAt.toDate().toISOString()
              : data.createdAt || new Date().toISOString();
              
            return {
              id: doc.id,
              ...data,
              createdAt,
              items: data.items || [],
              dueDate: data.dueDate instanceof Timestamp 
                ? data.dueDate.toDate().toISOString().split('T')[0]
                : data.dueDate || ''
            };
          }) as Invoice[];
          setInvoices(invoiceData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          setLoading(false);
        });
      } else {
        handleFirestoreError(error, OperationType.LIST, 'invoices');
        setLoading(false);
      }
    });

    const unsubscribeClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snapshot) => {
      const clientData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      setJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal)));
    });

    const unsubscribeTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    return () => {
      unsubscribeInvoices();
      unsubscribeClients();
      unsubscribeJournals();
      unsubscribeTasks();
    };
  }, []);

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.invoices`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const calculateTotals = (items: InvoiceItem[], taxRate: number) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleAddItem = () => {
    setNewInvoice(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unitPrice: 0, total: 0 }]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setNewInvoice(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        newItems[index].total = Number(newItems[index].quantity) * Number(newItems[index].unitPrice);
      }
      return { ...prev, items: newItems };
    });
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { subtotal, tax, total } = calculateTotals(newInvoice.items, newInvoice.tax);
      const selectedJournal = journals.find(j => j.id === newInvoice.journalId);
      const selectedTask = tasks.find(t => t.id === newInvoice.taskId);
      
      await addDoc(collection(db, 'invoices'), {
        ...newInvoice,
        journalTitle: selectedJournal?.title || '',
        taskTitle: selectedTask?.title || '',
        subtotal,
        tax,
        total,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        isVerified: false
      });
      setIsModalOpen(false);
      setNewInvoice({
        clientId: '',
        journalId: '',
        taskId: '',
        items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }],
        tax: 0,
        status: 'unpaid',
        dueDate: '',
        notes: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invoices');
    }
  };

  const handleVerifyInvoice = async (invoiceId: string) => {
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Manager') return;
    
    try {
      const invoiceRef = doc(db, 'invoices', invoiceId);
      await updateDoc(invoiceRef, {
        isVerified: true,
        verifiedBy: currentUser.name,
        verifiedById: currentUser.id,
        verifiedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'invoices');
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (invoice.isVerified && currentUser.role !== 'Admin') {
      alert('Only administrators can delete verified invoices.');
      return;
    }

    if (!confirm('Are you sure you want to move this invoice to trash?')) return;

    try {
      await moveToTrash('invoices', invoice.id, invoice, currentUser.name);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'invoices');
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    try {
      await updateDoc(doc(db, 'invoices', id), { status: 'paid' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'invoices');
    }
  };

  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.name || 'Unknown Client';
  };

  const filteredInvoices = invoices.filter(inv => 
    getClientName(inv.clientId).toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.id.includes(searchQuery)
  );

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Paid</span>;
      case 'unpaid': return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Unpaid</span>;
      case 'overdue': return <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Overdue</span>;
    }
  };

  if (viewingJournalId) {
    return <JournalDetail journalId={viewingJournalId} onBack={() => setViewingJournalId(null)} currentUser={currentUser} />;
  }

  if (viewingInvoiceId) {
    return (
      <div className="h-full">
        <InvoiceDetail 
          invoiceId={viewingInvoiceId} 
          onBack={() => setViewingInvoiceId(null)} 
          onViewJournal={(id) => setViewingJournalId(id)}
          onViewTask={(id) => setViewingTaskId(id)}
        />
        
        {/* Modals for linked items */}
        {viewingTaskId && (
          <Modal 
            isOpen={!!viewingTaskId} 
            onClose={() => setViewingTaskId(null)} 
            title="Task Details"
          >
            <div className="space-y-6">
              {tasks.find(t => t.id === viewingTaskId) ? (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{tasks.find(t => t.id === viewingTaskId)?.title}</h3>
                      <p className="text-sm text-slate-500 mt-1">Service: {tasks.find(t => t.id === viewingTaskId)?.serviceType}</p>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase",
                      tasks.find(t => t.id === viewingTaskId)?.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {tasks.find(t => t.id === viewingTaskId)?.status}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {tasks.find(t => t.id === viewingTaskId)?.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white border border-slate-100 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</p>
                      <p className="text-sm font-bold text-slate-700 mt-1">
                        {tasks.find(t => t.id === viewingTaskId)?.dueDate ? new Date(tasks.find(t => t.id === viewingTaskId)!.dueDate).toLocaleDateString() : 'No date'}
                      </p>
                    </div>
                    <div className="p-4 bg-white border border-slate-100 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned To</p>
                      <p className="text-sm font-bold text-slate-700 mt-1">{tasks.find(t => t.id === viewingTaskId)?.assignedToName || 'Unassigned'}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-slate-400">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  <p>Loading task details...</p>
                </div>
              )}
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Invoices</h2>
          <p className="text-slate-500 mt-1">Manage client billing, payments, and overdue accounts.</p>
        </div>
        <div className="flex gap-3">
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          <button 
            onClick={() => setIsImporterOpen(true)}
            className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <FileSpreadsheet size={20} className="text-emerald-600" />
            Import Zoho
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={20} />
            Create Invoice
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {selectedColumns.includes('id') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice ID</th>}
                {selectedColumns.includes('client') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>}
                {selectedColumns.includes('total') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total Amount</th>}
                {selectedColumns.includes('status') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>}
                {selectedColumns.includes('dueDate') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Due Date</th>}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Loader2 className="animate-spin" size={32} />
                      <p className="text-sm font-medium">Loading invoices...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <CreditCard size={32} />
                      <p className="text-sm font-medium">No invoices found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                    {selectedColumns.includes('id') && (
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-slate-500">#{inv.id.substring(0, 8).toUpperCase()}</span>
                      </td>
                    )}
                    {selectedColumns.includes('client') && (
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900">{getClientName(inv.clientId)}</span>
                      </td>
                    )}
                    {selectedColumns.includes('total') && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-slate-900 font-bold">
                          <DollarSign size={14} className="text-slate-400" />
                          <span>{(inv.total || 0).toLocaleString()}</span>
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('status') && (
                      <td className="px-6 py-4">
                        {getStatusBadge(inv.status)}
                      </td>
                    )}
                    {selectedColumns.includes('dueDate') && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="text-sm">{inv.dueDate}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => setViewingInvoiceId(inv.id)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View Details"
                        >
                          <FileText size={18} />
                        </button>
                        {inv.status !== 'paid' && (
                          <button 
                            onClick={() => handleMarkAsPaid(inv.id)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Mark as Paid"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                        {!inv.isVerified && (currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                          <button 
                            onClick={() => handleVerifyInvoice(inv.id)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Mark as Verified"
                          >
                            <Shield size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteInvoice(inv)}
                          disabled={inv.isVerified && currentUser.role !== 'Admin'}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            inv.isVerified && currentUser.role !== 'Admin'
                              ? "text-slate-200 cursor-not-allowed"
                              : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          )}
                          title={inv.isVerified && currentUser.role !== 'Admin' ? "Only Admins can delete verified entries" : "Delete Invoice"}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      <AnimatePresence>
        {viewingTaskId && (
          <Modal 
            isOpen={!!viewingTaskId} 
            onClose={() => setViewingTaskId(null)} 
            title="Task Details"
          >
            {(() => {
              const task = tasks.find(t => t.id === viewingTaskId);
              if (!task) return <p>Task not found</p>;
              return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        task.priority === 'urgent' ? "bg-rose-100 text-rose-600" :
                        task.priority === 'high' ? "bg-amber-100 text-amber-600" :
                        "bg-slate-100 text-slate-600"
                      )}>
                        <Briefcase size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{task.title}</h4>
                        <p className="text-xs text-slate-500">{task.serviceType}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      task.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                      task.status === 'overdue' ? "bg-rose-100 text-rose-700" :
                      "bg-amber-100 text-amber-700"
                    )}>
                      {task.status.replace('_', ' ')}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed">{task.description || 'No description provided.'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date</p>
                      <p className="text-sm font-bold text-slate-700 mt-1">{task.dueDate}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points</p>
                      <p className="text-sm font-bold text-indigo-600 mt-1">{task.points} pts</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Modal>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900">Create New Invoice</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleCreateInvoice} className="p-8 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Client</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newInvoice.clientId}
                      onChange={e => setNewInvoice(prev => ({ ...prev, clientId: e.target.value }))}
                    >
                      <option value="">Select Client</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Due Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newInvoice.dueDate}
                      onChange={e => setNewInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Link to Journal (Optional)</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newInvoice.journalId}
                      onChange={e => setNewInvoice(prev => ({ ...prev, journalId: e.target.value }))}
                      disabled={!newInvoice.clientId}
                    >
                      <option value="">No Journal</option>
                      {journals.filter(j => j.clientId === newInvoice.clientId).map(j => (
                        <option key={j.id} value={j.id}>{j.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Link to Task (Optional)</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newInvoice.taskId}
                      onChange={e => setNewInvoice(prev => ({ ...prev, taskId: e.target.value }))}
                      disabled={!newInvoice.clientId}
                    >
                      <option value="">No Task</option>
                      {tasks.filter(t => t.clientId === newInvoice.clientId).map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h4 className="font-bold text-slate-900">Invoice Items</h4>
                      <select 
                        className="text-xs px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const [catId, itemTitle] = e.target.value.split('|');
                          const category = SERVICES_CATALOG.find(c => c.id === catId);
                          const item = category?.items.find(i => i.title === itemTitle);
                          if (item) {
                            setNewInvoice(prev => ({
                              ...prev,
                              items: [...prev.items, { description: item.title, quantity: 1, unitPrice: item.price, total: item.price }]
                            }));
                          }
                          e.target.value = '';
                        }}
                      >
                        <option value="">+ Quick Add Service</option>
                        {SERVICES_CATALOG.map(cat => (
                          <optgroup key={cat.id} label={cat.category}>
                            {cat.items.map(item => (
                              <option key={item.title} value={`${cat.id}|${item.title}`}>
                                {item.title} - PKR {(item.price || 0).toLocaleString()}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <button 
                      type="button"
                      onClick={handleAddItem}
                      className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-700"
                    >
                      <Plus size={14} />
                      Add Custom Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newInvoice.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="col-span-6 space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
                          <input 
                            required
                            type="text" 
                            placeholder="Service or product description"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            value={item.description}
                            onChange={e => handleItemChange(index, 'description', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Qty</label>
                          <input 
                            required
                            type="number" 
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            value={item.quantity}
                            onChange={e => {
                          const val = parseInt(e.target.value);
                          handleItemChange(index, 'quantity', isNaN(val) ? 0 : val);
                        }}
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Price</label>
                          <input 
                            required
                            type="number" 
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            value={item.unitPrice}
                            onChange={e => {
                          const val = parseFloat(e.target.value);
                          handleItemChange(index, 'unitPrice', isNaN(val) ? 0 : val);
                        }}
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button 
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-2 text-slate-400 hover:text-rose-600 transition-all"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Notes</label>
                      <textarea 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                        placeholder="Additional notes for the client..."
                        value={newInvoice.notes}
                        onChange={e => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-bold text-slate-900">${(calculateTotals(newInvoice.items, newInvoice.tax).subtotal || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Tax (%)</span>
                      <input 
                        type="number" 
                        className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-right text-sm font-bold"
                        value={newInvoice.tax}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          setNewInvoice(prev => ({ ...prev, tax: isNaN(val) ? 0 : val }));
                        }}
                      />
                    </div>
                    <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-xl font-black text-indigo-600">${(calculateTotals(newInvoice.items, newInvoice.tax).total || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    Create Invoice
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Invoice Details Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInvoice(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Invoice Details</h3>
                    <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">#{selectedInvoice.id.toUpperCase()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-600">
                    <Printer size={20} />
                  </button>
                  <button 
                    onClick={() => setSelectedInvoice(null)}
                    className="p-2 hover:bg-slate-200 rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Billed To</p>
                    <p className="text-lg font-black text-slate-900">{getClientName(selectedInvoice.clientId)}</p>
                    <p className="text-sm text-slate-500">Client ID: {selectedInvoice.clientId}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</p>
                    <div className="flex justify-end">{getStatusBadge(selectedInvoice.status)}</div>
                    <p className="text-sm text-slate-500 mt-2">Due Date: <span className="font-bold text-slate-700">{selectedInvoice.dueDate}</span></p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                        <th className="px-6 py-3">Description</th>
                        <th className="px-6 py-3 text-center">Qty</th>
                        <th className="px-6 py-3 text-right">Unit Price</th>
                        <th className="px-6 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {selectedInvoice.items?.map((item, i) => (
                        <tr key={i} className="text-sm">
                          <td className="px-6 py-4 font-medium text-slate-900">{item.description}</td>
                          <td className="px-6 py-4 text-center text-slate-600">{item.quantity}</td>
                          <td className="px-6 py-4 text-right text-slate-600">${(item.unitPrice || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">${(item.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between gap-8">
                  <div className="flex-1">
                    {selectedInvoice.notes && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Notes</p>
                        <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                          "{selectedInvoice.notes}"
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="w-64 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-bold text-slate-900">${selectedInvoice.subtotal?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Tax</span>
                      <span className="font-bold text-slate-900">${selectedInvoice.tax?.toLocaleString()}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-2xl font-black text-indigo-600">${selectedInvoice.total?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                <button 
                  onClick={() => setSelectedInvoice(null)}
                  className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-all"
                >
                  Close
                </button>
                <div className="flex gap-3">
                  {selectedInvoice.status !== 'paid' && (
                    <button 
                      onClick={() => {
                        handleMarkAsPaid(selectedInvoice.id);
                        setSelectedInvoice(null);
                      }}
                      className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                    >
                      <CheckCircle2 size={18} />
                      Mark as Paid
                    </button>
                  )}
                  <button className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                    <Download size={18} />
                    Download PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Importer 
        isOpen={isImporterOpen} 
        onClose={() => setIsImporterOpen(false)} 
        type="invoices" 
      />
    </div>
  );
};
