import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
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
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { HECEntry, Journal, Client, User as UserType } from '../types';
import { ColumnSelector } from './ColumnSelector';
import { JournalDetail } from './JournalDetail';
import { ClientDetail } from './ClientDetail';
import { moveToTrash } from '../lib/firebase';
import { Shield } from 'lucide-react';

interface HECProps {
  searchQuery?: string;
  currentUser: UserType;
}

const AVAILABLE_COLUMNS = [
  { id: 'journal', label: 'Journal' },
  { id: 'app_psid', label: 'App No / PSID' },
  { id: 'year_freq', label: 'Year / Freq' },
  { id: 'status', label: 'Status' },
  { id: 'expiration', label: 'Expiration' },
];

const HEC_DISCIPLINES: Record<string, Record<string, string[]>> = {
  'Social Sciences': {
    'Psychology': ['Clinical Psychology', 'Social Psychology', 'Developmental Psychology'],
    'Sociology': ['Urban Sociology', 'Rural Sociology', 'Medical Sociology'],
    'Education': ['Higher Education', 'Primary Education', 'Special Education']
  },
  'Natural Sciences': {
    'Physics': ['Quantum Physics', 'Astrophysics', 'Nuclear Physics'],
    'Chemistry': ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry'],
    'Biology': ['Molecular Biology', 'Genetics', 'Botany']
  },
  'Engineering & Technology': {
    'Computer Science': ['Artificial Intelligence', 'Software Engineering', 'Cyber Security'],
    'Electrical Engineering': ['Power Systems', 'Electronics', 'Telecommunications'],
    'Civil Engineering': ['Structural Engineering', 'Environmental Engineering', 'Transportation Engineering']
  },
  'Medical Sciences': {
    'Medicine': ['Internal Medicine', 'Surgery', 'Pediatrics'],
    'Pharmacy': ['Pharmacology', 'Pharmaceutics', 'Clinical Pharmacy'],
    'Dentistry': ['Orthodontics', 'Periodontics', 'Prosthodontics']
  }
};

export const HEC: React.FC<HECProps> = ({ searchQuery = '', currentUser }) => {
  const [entries, setEntries] = useState<HECEntry[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [viewingJournal, setViewingJournal] = useState<{ id: string, editMode?: boolean } | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['hec'] || ['journal', 'app_psid', 'year_freq', 'status', 'expiration']
  );
  const [newEntry, setNewEntry] = useState({
    journalId: '',
    year: new Date().getFullYear(),
    frequency: 'Quarterly',
    loginCredentials: {
      username: '',
      password: ''
    },
    appNo: '',
    psid: '',
    ownerInfo: '',
    discipline: '',
    subjectArea: '',
    subCategory: '',
    status: 'active' as 'active' | 'expiring' | 'missing',
    expirationDate: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'hec_entries'), orderBy('expirationDate', 'asc'));
    const unsubscribeEntries = onSnapshot(q, (snapshot) => {
      const entryData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          expirationDate: data.expirationDate instanceof Timestamp 
            ? data.expirationDate.toDate().toISOString().split('T')[0]
            : data.expirationDate
        };
      }) as HECEntry[];
      setEntries(entryData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'hec_entries');
    });

    const unsubscribeJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      const journalData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Journal[];
      setJournals(journalData);
    });

    const unsubscribeClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const clientData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientData);
    });

    return () => {
      unsubscribeEntries();
      unsubscribeJournals();
      unsubscribeClients();
    };
  }, []);

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.hec`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'hec_entries'), {
        ...newEntry,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        isVerified: false
      });
      setIsModalOpen(false);
      setNewEntry({
        journalId: '',
        year: new Date().getFullYear(),
        frequency: 'Quarterly',
        loginCredentials: { username: '', password: '' },
        appNo: '',
        psid: '',
        ownerInfo: '',
        discipline: '',
        subjectArea: '',
        subCategory: '',
        status: 'active',
        expirationDate: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'hec_entries');
    }
  };

  const handleVerifyEntry = async (entryId: string) => {
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Manager') return;
    
    try {
      const entryRef = doc(db, 'hec_entries', entryId);
      await updateDoc(entryRef, {
        isVerified: true,
        verifiedBy: currentUser.name,
        verifiedById: currentUser.id,
        verifiedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hec_entries');
    }
  };

  const handleDeleteEntry = async (entry: HECEntry) => {
    if (entry.isVerified && currentUser.role !== 'Admin') {
      alert('Only administrators can delete verified HEC applications.');
      return;
    }

    if (!confirm('Are you sure you want to move this application to trash?')) return;

    try {
      await moveToTrash('hec_entries', entry.id, entry, currentUser.name);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'hec_entries');
    }
  };

  const getJournalTitle = (journalId: string) => {
    return journals.find(j => j.id === journalId)?.title || 'Unknown Journal';
  };

  const filteredEntries = entries.filter(entry => 
    getJournalTitle(entry.journalId).toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.appNo.includes(searchQuery) ||
    entry.psid.includes(searchQuery)
  );

  const getStatusBadge = (status: HECEntry['status']) => {
    switch (status) {
      case 'active': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Active</span>;
      case 'expiring': return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Expiring</span>;
      case 'missing': return <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Missing</span>;
    }
  };

  if (viewingJournal) {
    return (
      <JournalDetail 
        journalId={viewingJournal.id} 
        initialEditMode={viewingJournal.editMode}
        onBack={() => setViewingJournal(null)} 
        currentUser={currentUser}
      />
    );
  }

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
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">HEC Applications</h2>
          <p className="text-slate-500 mt-1">Track HEC approvals, credentials, and compliance for journals.</p>
        </div>
        <div className="flex gap-3">
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={20} />
            New HEC Application
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {selectedColumns.includes('journal') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Journal</th>}
                {selectedColumns.includes('app_psid') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">App No / PSID</th>}
                {selectedColumns.includes('year_freq') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Year / Freq</th>}
                {selectedColumns.includes('status') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>}
                {selectedColumns.includes('expiration') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Expiration</th>}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Loader2 className="animate-spin" size={32} />
                      <p className="text-sm font-medium">Loading applications...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <GraduationCap size={32} />
                      <p className="text-sm font-medium">No HEC applications found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                    {selectedColumns.includes('journal') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const journal = journals.find(j => j.id === entry.journalId);
                              if (journal) setViewingJournal({ id: journal.id, editMode: false });
                            }}
                            className="font-bold text-slate-900 hover:text-indigo-600 hover:underline text-left flex items-center gap-1"
                          >
                            {getJournalTitle(entry.journalId)}
                            {entry.isVerified && (
                              <span title="Verified"><CheckCircle2 size={14} className="text-emerald-500" /></span>
                            )}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const journal = journals.find(j => j.id === entry.journalId);
                              const client = clients.find(c => c.id === journal?.clientId);
                              if (client) setViewingClient(client);
                            }}
                            className="text-xs text-slate-500 hover:text-indigo-600 hover:underline text-left"
                          >
                            {journals.find(j => j.id === entry.journalId)?.clientName || 'Unknown Client'}
                          </button>
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('app_psid') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-slate-400">APP:</span>
                            <span className="text-slate-600">{entry.appNo}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-slate-400">PSID:</span>
                            <span className="text-slate-600">{entry.psid}</span>
                          </div>
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('year_freq') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">{entry.year}</span>
                          <span className="text-xs text-slate-500">{entry.frequency}</span>
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('status') && (
                      <td className="px-6 py-4">
                        {getStatusBadge(entry.status)}
                      </td>
                    )}
                    {selectedColumns.includes('expiration') && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <span title="Expiration Date"><Calendar size={14} className="text-slate-400" /></span>
                          <span className="text-sm">{entry.expirationDate}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => {
                            alert(`Credentials for ${getJournalTitle(entry.journalId)}:\nUsername: ${entry.loginCredentials.username}\nPassword: ${entry.loginCredentials.password}`);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View Credentials"
                        >
                          <Key size={18} />
                        </button>
                        {!entry.isVerified && (currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                          <button 
                            onClick={() => handleVerifyEntry(entry.id)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Mark as Verified"
                          >
                            <Shield size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteEntry(entry)}
                          disabled={entry.isVerified && currentUser.role !== 'Admin'}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            entry.isVerified && currentUser.role !== 'Admin'
                              ? "text-slate-200 cursor-not-allowed"
                              : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          )}
                          title={entry.isVerified && currentUser.role !== 'Admin' ? "Only Admins can delete verified entries" : "Delete Application"}
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

      {/* Add HEC Entry Modal */}
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
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">New HEC Application</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleCreateEntry} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Journal</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newEntry.journalId}
                      onChange={e => setNewEntry(prev => ({ ...prev, journalId: e.target.value }))}
                    >
                      <option value="">Select Journal</option>
                      {journals.map(j => (
                        <option key={j.id} value={j.id}>{j.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Year</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newEntry.year}
                      onChange={e => setNewEntry(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">App No</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newEntry.appNo}
                      onChange={e => setNewEntry(prev => ({ ...prev, appNo: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">PSID</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newEntry.psid}
                      onChange={e => setNewEntry(prev => ({ ...prev, psid: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Discipline</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newEntry.discipline}
                      onChange={e => setNewEntry(prev => ({ ...prev, discipline: e.target.value, subjectArea: '', subCategory: '' }))}
                    >
                      <option value="">Select Discipline</option>
                      {Object.keys(HEC_DISCIPLINES).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Subject Area</label>
                    <select 
                      required
                      disabled={!newEntry.discipline}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                      value={newEntry.subjectArea}
                      onChange={e => setNewEntry(prev => ({ ...prev, subjectArea: e.target.value, subCategory: '' }))}
                    >
                      <option value="">Select Subject Area</option>
                      {newEntry.discipline && Object.keys(HEC_DISCIPLINES[newEntry.discipline]).map(sa => (
                        <option key={sa} value={sa}>{sa}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Sub Category</label>
                    <select 
                      required
                      disabled={!newEntry.subjectArea}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                      value={newEntry.subCategory}
                      onChange={e => setNewEntry(prev => ({ ...prev, subCategory: e.target.value }))}
                    >
                      <option value="">Select Sub Category</option>
                      {newEntry.discipline && newEntry.subjectArea && HEC_DISCIPLINES[newEntry.discipline][newEntry.subjectArea].map(sc => (
                        <option key={sc} value={sc}>{sc}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Expiration Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newEntry.expirationDate}
                      onChange={e => setNewEntry(prev => ({ ...prev, expirationDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="font-bold text-slate-900">Login Credentials</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Username</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={newEntry.loginCredentials.username}
                        onChange={e => setNewEntry(prev => ({ 
                          ...prev, 
                          loginCredentials: { ...prev.loginCredentials, username: e.target.value } 
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Password</label>
                      <input 
                        type="password" 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={newEntry.loginCredentials.password}
                        onChange={e => setNewEntry(prev => ({ 
                          ...prev, 
                          loginCredentials: { ...prev.loginCredentials, password: e.target.value } 
                        }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
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
                    Create Application
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
