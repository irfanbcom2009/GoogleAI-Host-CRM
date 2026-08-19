import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Calendar,
  Key,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit,
  Loader2,
  X,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Download,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDateForInput } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, Timestamp, where } from 'firebase/firestore';
import { DOAJApplication, Client, User as UserType } from '../types';
import { ColumnSelector } from './ColumnSelector';
import { ClientDetail } from './ClientDetail';
import { moveToTrash } from '../lib/firebase';
import { Shield } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import * as XLSX from 'xlsx';

interface DOAJApplicationsProps {
  searchQuery?: string;
  currentUser: UserType;
  journalId?: string;
}

const AVAILABLE_COLUMNS = [
  { id: 'sr', label: 'Sr' },
  { id: 'invoice', label: 'Invoice No' },
  { id: 'client', label: 'Client' },
  { id: 'journal', label: 'Journal' },
  { id: 'submission', label: 'Submission' },
  { id: 'status', label: 'Status' },
  { id: 'credentials', label: 'Credentials' },
];

export const DOAJApplications: React.FC<DOAJApplicationsProps> = ({ searchQuery = '', currentUser, journalId }) => {
  const { check } = usePermissions(currentUser);
  const [applications, setApplications] = useState<DOAJApplication[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<DOAJApplication | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['doaj'] || AVAILABLE_COLUMNS.map(c => c.id)
  );

  const [formData, setFormData] = useState({
    invoiceNo: '',
    clientId: '',
    journalName: '',
    journalLink: '',
    submissionDate: new Date().toISOString().split('T')[0],
    doajLoginEmail: '',
    doajPassword: '',
    editorEmailLogin: '',
    editorPassword: '',
    status: 'Pending' as DOAJApplication['status'],
    objectionReason: '',
    objectionDate: '',
    remarks: '',
    journalId: ''
  });

  const [journal, setJournal] = useState<any | null>(null);

  useEffect(() => {
    if (!journalId) return;
    const unsubscribeJournal = onSnapshot(doc(db, 'journals', journalId), (snapshot) => {
      if (snapshot.exists()) {
        setJournal({ id: snapshot.id, ...snapshot.data() });
      }
    });
    return () => unsubscribeJournal();
  }, [journalId]);

  useEffect(() => {
    if (journal) {
      setFormData(prev => ({
        ...prev,
        journalName: journal.title || journal.name || '',
        journalLink: journal.url || '',
        clientId: journal.clientId || '',
        journalId: journal.id
      }));
    }
  }, [journal]);

  useEffect(() => {
    let q = query(collection(db, 'doaj_applications'), orderBy('submissionDate', 'desc'));
    
    if (currentUser.role === 'Client') {
      if (journalId) {
        q = query(collection(db, 'doaj_applications'), where('clientId', '==', currentUser.id), where('journalId', '==', journalId), orderBy('submissionDate', 'desc'));
      } else {
        q = query(collection(db, 'doaj_applications'), where('clientId', '==', currentUser.id), orderBy('submissionDate', 'desc'));
      }
    } else if (journalId) {
      q = query(collection(db, 'doaj_applications'), where('journalId', '==', journalId), orderBy('submissionDate', 'desc'));
    }

    const unsubscribeApps = onSnapshot(q, (snapshot) => {
      const appData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          submissionDate: formatDateForInput(data.submissionDate),
          objectionDate: formatDateForInput(data.objectionDate)
        };
      }) as DOAJApplication[];
      setApplications(appData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'doaj_applications');
    });

    const unsubscribeClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snapshot) => {
      const clientData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientData);
    });

    return () => {
      unsubscribeApps();
      unsubscribeClients();
    };
  }, [currentUser, journalId]);

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.doaj`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.status === 'Rejected' && (!formData.objectionReason || !formData.objectionDate)) {
      alert('Objection reason and date are required for rejected status.');
      return;
    }

    try {
      const client = clients.find(c => c.id === formData.clientId);
      const payload = {
        ...formData,
        clientName: client?.name || '',
        journalId: journalId || formData.journalId || '',
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      };

      if (editingApp) {
        await updateDoc(doc(db, 'doaj_applications', editingApp.id), payload);
      } else {
        await addDoc(collection(db, 'doaj_applications'), {
          ...payload,
          createdAt: new Date().toISOString(),
          createdById: currentUser.id,
          createdBy: currentUser.name
        });
      }

      setIsModalOpen(false);
      setEditingApp(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingApp ? OperationType.UPDATE : OperationType.CREATE, 'doaj_applications');
    }
  };

  const resetForm = () => {
    setFormData({
      invoiceNo: '',
      clientId: journal ? journal.clientId || '' : '',
      journalName: journal ? journal.title || journal.name || '' : '',
      journalLink: journal ? journal.url || '' : '',
      submissionDate: new Date().toISOString().split('T')[0],
      doajLoginEmail: '',
      doajPassword: '',
      editorEmailLogin: '',
      editorPassword: '',
      status: 'Pending',
      objectionReason: '',
      objectionDate: '',
      remarks: '',
      journalId: journal ? journal.id || '' : ''
    });
  };

  const handleEdit = (app: DOAJApplication) => {
    setEditingApp(app);
    setFormData({
      invoiceNo: app.invoiceNo,
      clientId: app.clientId,
      journalName: app.journalName,
      journalLink: app.journalLink,
      submissionDate: app.submissionDate,
      doajLoginEmail: app.doajLoginEmail,
      doajPassword: app.doajPassword || '',
      editorEmailLogin: app.editorEmailLogin,
      editorPassword: app.editorPassword || '',
      status: app.status,
      objectionReason: app.objectionReason || '',
      objectionDate: app.objectionDate || '',
      remarks: app.remarks || '',
      journalId: app.journalId || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (app: DOAJApplication) => {
    if (!confirm('Are you sure you want to move this application to trash?')) return;
    try {
      await moveToTrash('doaj_applications', app.id, app, currentUser.name);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'doaj_applications');
    }
  };

  const exportToExcel = () => {
    const data = applications.map((app, index) => ({
      Sr: index + 1,
      'Invoice No': app.invoiceNo,
      'Client Name': app.clientName,
      'Journal Name': app.journalName,
      'Journal Link': app.journalLink,
      'Submission Date': app.submissionDate,
      Status: app.status,
      'DOAJ Email': app.doajLoginEmail,
      'Editor Email': app.editorEmailLogin,
      Remarks: app.remarks,
      'Objection Reason': app.objectionReason,
      'Objection Date': app.objectionDate
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DOAJ Applications');
    XLSX.writeFile(wb, 'DOAJ_Applications.xlsx');
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredApps = applications.filter(app => 
    (app.journalName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (app.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (app.invoiceNo || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: DOAJApplication['status']) => {
    const styles = {
      Pending: 'bg-slate-100 text-slate-700',
      Submitted: 'bg-blue-100 text-blue-700',
      'Under Review': 'bg-amber-100 text-amber-700',
      Accepted: 'bg-emerald-100 text-emerald-700',
      Rejected: 'bg-rose-100 text-rose-700'
    };
    return (
      <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", styles[status])}>
        {status}
      </span>
    );
  };

  if (viewingClient) {
    return (
      <ClientDetail 
        client={viewingClient} 
        onBack={() => setViewingClient(null)} 
        currentUser={currentUser}
      />
    );
  }

  return (
    <div className={cn(journalId ? "p-0 space-y-4" : "p-8 space-y-6")}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {journalId ? (
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Globe className="text-indigo-600" size={18} />
              DOAJ Applications ({filteredApps.length})
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Manage DOAJ indexing applications for this journal
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <Globe className="text-indigo-600 dark:text-indigo-400" size={32} />
              DOAJ Applications
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage journal indexing applications for Directory of Open Access Journals.</p>
          </div>
        )}
        <div className="flex gap-3">
          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={20} />
            Export
          </button>
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          {check('doajApplications', 'add') && (
            <button 
              onClick={() => {
                setEditingApp(null);
                resetForm();
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Plus size={20} />
              New Application
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-200">
                {selectedColumns.includes('sr') && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sr</th>}
                {selectedColumns.includes('invoice') && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice</th>}
                {selectedColumns.includes('client') && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>}
                {selectedColumns.includes('journal') && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Journal</th>}
                {selectedColumns.includes('submission') && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Submission</th>}
                {selectedColumns.includes('status') && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>}
                {selectedColumns.includes('credentials') && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Credentials</th>}
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Loader2 className="animate-spin" size={32} />
                      <p className="text-sm font-bold">Loading applications...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Globe size={32} />
                      <p className="text-sm font-bold">No DOAJ applications found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredApps.map((app, index) => (
                  <tr key={app.id} className="hover:bg-slate-50/50 transition-colors group">
                    {selectedColumns.includes('sr') && (
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-slate-400">{(index + 1).toString().padStart(2, '0')}</span>
                      </td>
                    )}
                    {selectedColumns.includes('invoice') && (
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-600">{app.invoiceNo}</span>
                      </td>
                    )}
                    {selectedColumns.includes('client') && (
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => {
                            const client = clients.find(c => c.id === app.clientId);
                            if (client) setViewingClient(client);
                          }}
                          className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                        >
                          {app.clientName}
                        </button>
                      </td>
                    )}
                    {selectedColumns.includes('journal') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{app.journalName}</span>
                          <a 
                            href={app.journalLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-500 hover:underline flex items-center gap-1 font-bold"
                          >
                            Visit Journal <ExternalLink size={10} />
                          </a>
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('submission') && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="text-sm font-medium">{app.submissionDate}</span>
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('status') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(app.status)}
                          {app.status === 'Rejected' && app.objectionDate && (
                            <span className="text-[10px] text-rose-500 font-bold">
                              Rejected on {app.objectionDate}
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('credentials') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase">DOAJ:</span>
                            <span className="text-xs font-medium text-slate-600 truncate max-w-[120px]">{app.doajLoginEmail}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Editor:</span>
                            <span className="text-xs font-medium text-slate-600 truncate max-w-[120px]">{app.editorEmailLogin}</span>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        {currentUser.role === 'Admin' && (
                          <button 
                            onClick={() => {
                              const hasTaiba = (app.doajPassword?.toLowerCase().includes('taiba@0045') || app.editorPassword?.toLowerCase().includes('taiba@0045'));
                              if (hasTaiba) {
                                alert('Access Denied');
                                return;
                              }
                              const msg = `DOAJ Credentials:\nEmail: ${app.doajLoginEmail}\nPassword: ${app.doajPassword}\n\nEditor Credentials:\nEmail: ${app.editorEmailLogin}\nPassword: ${app.editorPassword}`;
                              alert(msg);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="View Credentials"
                          >
                            <Key size={18} />
                          </button>
                        )}
                        {check('doajApplications', 'edit') && (
                          <button 
                            onClick={() => handleEdit(app)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Edit Application"
                          >
                            <Edit size={18} />
                          </button>
                        )}
                        {check('doajApplications', 'delete') && (
                          <button 
                            onClick={() => handleDelete(app)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            title="Delete Application"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
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
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    {editingApp ? 'Edit DOAJ Application' : 'New DOAJ Application'}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">Fill in the details for the indexing request</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Invoice No</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                      value={formData.invoiceNo || ''}
                      onChange={e => setFormData(prev => ({ ...prev, invoiceNo: e.target.value }))}
                      placeholder="Enter invoice number"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Client</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold appearance-none"
                      value={formData.clientId || ''}
                      onChange={e => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                    >
                      <option value="">Select Client</option>
                      {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Submission Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                      value={formData.submissionDate || ''}
                      onChange={e => setFormData(prev => ({ ...prev, submissionDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Journal Name</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                      value={formData.journalName || ''}
                      onChange={e => setFormData(prev => ({ ...prev, journalName: e.target.value }))}
                      placeholder="Enter journal title"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Journal Link</label>
                    <input 
                      required
                      type="url"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                      value={formData.journalLink || ''}
                      onChange={e => setFormData(prev => ({ ...prev, journalLink: e.target.value }))}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div className="space-y-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Key size={16} className="text-indigo-600" />
                    Login Credentials
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DOAJ Login Email</label>
                        <input 
                          required
                          type="email"
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                          value={formData.doajLoginEmail || ''}
                          onChange={e => setFormData(prev => ({ ...prev, doajLoginEmail: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DOAJ Password</label>
                        <div className="relative">
                          <input 
                            type={showPasswords['doaj'] ? 'text' : 'password'}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium pr-10"
                            value={formData.doajPassword || ''}
                            onChange={e => setFormData(prev => ({ ...prev, doajPassword: e.target.value }))}
                          />
                          <button 
                            type="button"
                            onClick={() => togglePasswordVisibility('doaj')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPasswords['doaj'] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Editor Email Login</label>
                        <input 
                          required
                          type="email"
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                          value={formData.editorEmailLogin || ''}
                          onChange={e => setFormData(prev => ({ ...prev, editorEmailLogin: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Editor Password</label>
                        <div className="relative">
                          <input 
                            type={showPasswords['editor'] ? 'text' : 'password'}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium pr-10"
                            value={formData.editorPassword || ''}
                            onChange={e => setFormData(prev => ({ ...prev, editorPassword: e.target.value }))}
                          />
                          <button 
                            type="button"
                            onClick={() => togglePasswordVisibility('editor')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPasswords['editor'] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Application Status</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold appearance-none"
                      value={formData.status || ''}
                      onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as DOAJApplication['status'] }))}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                  {formData.status === 'Rejected' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                      <label className="text-xs font-black text-rose-500 uppercase tracking-wider">Objection Date</label>
                      <input 
                        required
                        type="date" 
                        className="w-full px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none transition-all font-bold text-rose-700"
                        value={formData.objectionDate || ''}
                        onChange={e => setFormData(prev => ({ ...prev, objectionDate: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                {formData.status === 'Rejected' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-black text-rose-500 uppercase tracking-wider">Objection Reason</label>
                    <textarea 
                      required
                      rows={3}
                      className="w-full px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none transition-all font-medium text-rose-700 placeholder:text-rose-300"
                      value={formData.objectionReason || ''}
                      onChange={e => setFormData(prev => ({ ...prev, objectionReason: e.target.value }))}
                      placeholder="Explain why the application was rejected..."
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Remarks</label>
                  <textarea 
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                    value={formData.remarks || ''}
                    onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder="Add any additional notes..."
                  />
                </div>

                <div className="sticky bottom-0 bg-white/80 backdrop-blur-md py-4 flex justify-end gap-4 border-t border-slate-100 -mx-8 px-8">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-10 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2"
                  >
                    {editingApp ? 'Update Application' : 'Create Application'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
