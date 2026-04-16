import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  Clock, 
  MoreHorizontal, 
  FileSearch,
  Search,
  Hash,
  Loader2,
  Building2,
  Globe,
  Shield,
  GraduationCap,
  ExternalLink,
  ArrowLeftRight,
  User,
  Phone,
  Mail,
  Lock,
  Tag,
  Filter,
  Users,
  DollarSign,
  FileSpreadsheet,
  Edit,
  Trash2,
  X,
  AlertCircle,
  Activity,
  Key,
  GitMerge,
  Database,
  Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Journal, Client, Publisher, Domain, User as UserType, HECCategory } from '../types';
import { cn, sanitizeUrl } from '../lib/utils';
import { db, handleFirestoreError, OperationType, moveToTrash } from '../lib/firebase';
import { geminiService } from '../services/geminiService';
import { Sparkles, Wand2 } from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, where, getDocs, getDoc, limit } from 'firebase/firestore';
import { Modal } from './Modal';
import { JournalIndexingManager } from './JournalIndexingManager';
import { GoogleScholarManager } from './GoogleScholarManager';
import { JournalTransferManager } from './JournalTransferManager';
import { JournalDetail } from './JournalDetail';
import { ClientDetail } from './ClientDetail';
import { ColumnSelector } from './ColumnSelector';
import { doc, updateDoc } from 'firebase/firestore';
import { usePermissions } from '../hooks/usePermissions';
import { ConfigModal } from './ConfigModal';

interface JournalsProps {
  searchQuery: string;
  currentUser: UserType;
}

const AVAILABLE_COLUMNS = [
  { id: 'title', label: 'Journal Title' },
  { id: 'client', label: 'Client & Editor' },
  { id: 'ojs', label: 'OJS / SSL' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'status', label: 'Status' },
];

export const Journals: React.FC<JournalsProps> = ({ searchQuery, currentUser }) => {
  const { check } = usePermissions(currentUser);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIndexingModalOpen, setIsIndexingModalOpen] = useState(false);
  const [isScholarModalOpen, setIsScholarModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isScopeConfigOpen, setIsScopeConfigOpen] = useState(false);
  const [journalCategories, setJournalCategories] = useState<any[]>([]);
  const [journalScopes, setJournalScopes] = useState<string[]>([]);
  const [hecCategories, setHecCategories] = useState<HECCategory[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [viewingJournal, setViewingJournal] = useState<{ id: string, editMode?: boolean } | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['journals'] || ['title', 'client', 'ojs', 'pricing', 'status']
  );

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const isEmployee = currentUser.role !== 'Client';

  // Form state
  const [newJournal, setNewJournal] = useState({
    clientId: '',
    publisherId: '',
    domainId: '',
    title: '',
    url: '',
    ojsVersion: '',
    sslStatus: 'None' as Journal['sslStatus'],
    chiefEditorName: '',
    contactPersonName: '',
    issnPrint: '',
    issnOnline: '',
    invoiceNumber: '',
    category: '',
    subCategory: '',
    subjectCategory: '',
    publisherCountry: '',
    languages: '',
    license: 'CC BY' as Journal['license'],
    hecMainCategoryId: '',
    hecSubCategoryId: '',
    hecSubjectCategoryId: '',
    scope: [] as string[],
    apcAmount: 0,
    editorEmail: '',
    credentials: {
      email: '',
      password: '',
      loginLink: ''
    },
    assignedEmployeeId: '',
    status: 'pending_issn' as const,
    isSubscribed: true,
    isOjsSubscribedFromUs: true,
    isIssnSubscribedFromUs: true,
    isHecSubscribedFromUs: true,
    isDoiSubscribedFromUs: true
  });

  useEffect(() => {
    let q = query(collection(db, 'journals'), orderBy('createdAt', 'desc'));
    
    if (!isEmployee) {
      q = query(
        collection(db, 'journals'), 
        where('clientId', '==', currentUser.id),
        orderBy('createdAt', 'desc')
      );
    } else if (currentUser.role === 'Employee') {
      // Employees only see their assigned journals
      q = query(
        collection(db, 'journals'),
        where('assignedEmployeeId', '==', currentUser.id),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribeJournals = onSnapshot(q, (snapshot) => {
      const journalData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Journal[];
      setJournals(journalData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'journals');
      setLoading(false);
    });

    const unsubscribeClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client'), where('status', '==', 'active')), (snapshot) => {
      const clientData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
      setClients(clientData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeHec = onSnapshot(query(collection(db, 'hec_categories'), where('isActive', '==', true)), (snapshot) => {
      setHecCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HECCategory)));
    });

    if (isEmployee) {
      const unsubscribePublishers = onSnapshot(collection(db, 'publishers'), (snapshot) => {
        const pubData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Publisher[];
        setPublishers(pubData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'publishers');
      });

      const unsubscribeDomains = onSnapshot(query(collection(db, 'domains'), where('status', '==', 'active')), (snapshot) => {
        const domainData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Domain[];
        setDomains(domainData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'domains');
      });

      // Fetch employees for assignment
      const fetchEmployees = async () => {
        try {
          const q = query(collection(db, 'users'), where('role', 'in', ['Employee', 'Manager', 'Admin']), where('status', '==', 'active'));
          const snapshot = await getDocs(q);
          const employeeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserType[];
          setEmployees(employeeData);
        } catch (error) {
          console.error("Error fetching employees:", error);
        }
      };
      fetchEmployees();

      const fetchSettings = async () => {
        const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
          if (snapshot.exists()) {
            setJournalCategories(snapshot.data().journalCategories || []);
            setJournalScopes(snapshot.data().journalScopes || []);
          }
        });
        return unsubscribeSettings;
      };
      const unsubSettings = fetchSettings();

      return () => {
        unsubscribeJournals();
        unsubscribeClients();
        unsubscribePublishers();
        unsubscribeDomains();
        unsubscribeHec();
      };
    }

    return () => {
      unsubscribeJournals();
      unsubscribeClients();
      unsubscribeHec();
    };
  }, [currentUser.id, currentUser.role, isEmployee]);

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.journals`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const filteredJournals = journals.filter(journal => {
    const client = clients.find(c => c.id === journal.clientId);
    const matchesSearch = (journal.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         (client?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         (journal.issnPrint?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         (journal.issnOnline?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || journal.category === categoryFilter;
    const matchesStatus = !statusFilter || journal.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const uniqueCategories = Array.from(new Set(journals.map(j => j.category).filter(Boolean)));

  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  const handleAiSuggestCategory = async () => {
    if (!newJournal.title) return;
    setIsAiSuggesting(true);
    const suggestion = await geminiService.suggestJournalCategory(newJournal.title, newJournal.scope);
    if (suggestion) {
      setNewJournal(prev => ({
        ...prev,
        category: suggestion.category,
        subCategory: suggestion.subCategory
      }));
    }
    setIsAiSuggesting(false);
  };

  const handleAiSuggestScope = async () => {
    if (!newJournal.title) return;
    setIsAiSuggesting(true);
    const response = await geminiService.generateTaskDescription(newJournal.title, "Journal Scope & Aims (Provide 5-8 short keywords separated by commas)");
    if (response) {
      const keywords = response.split(',').map(k => k.trim()).filter(Boolean);
      setNewJournal(prev => ({ ...prev, scope: keywords }));
    }
    setIsAiSuggesting(true);
    setIsAiSuggesting(false);
  };

  useEffect(() => {
    if (!newJournal.clientId) return;

    // Fetch latest ISSN Request for this client to auto-fill metadata
    const fetchIssn = async () => {
      const q = query(collection(db, 'issn_requests'), where('clientId', '==', newJournal.clientId), orderBy('createdAt', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const issnData = snapshot.docs[0].data();
        setNewJournal(prev => ({
          ...prev,
          issnPrint: prev.issnPrint || issnData.printIssn || '',
          issnOnline: prev.issnOnline || issnData.onlineIssn || '',
          languages: prev.languages || issnData.language || '',
          publisherCountry: prev.publisherCountry || issnData.country || ''
        }));
      }
    };

    // Fetch latest Invoice for this client to auto-fill invoice number
    const fetchInvoice = async () => {
      const q = query(collection(db, 'invoices'), where('clientId', '==', newJournal.clientId), orderBy('createdAt', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const invoiceData = snapshot.docs[0].data();
        setNewJournal(prev => ({
          ...prev,
          invoiceNumber: prev.invoiceNumber || invoiceData.invoiceNumber || ''
        }));
      }
    };

    fetchIssn();
    fetchInvoice();
  }, [newJournal.clientId]);

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const assignedEmployee = employees.find(e => e.id === newJournal.assignedEmployeeId);
      
      const journalToCreate = {
        ...newJournal,
        url: sanitizeUrl(newJournal.url),
        credentials: {
          ...newJournal.credentials,
          loginLink: sanitizeUrl(newJournal.credentials.loginLink)
        },
        assignedEmployeeName: assignedEmployee?.name || '',
        isSubscribed: newJournal.isSubscribed ?? true,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        isVerified: false
      };

      await addDoc(collection(db, 'journals'), journalToCreate);
      
      // Reset form and close modal
      setNewJournal({
        clientId: '',
        publisherId: '',
        domainId: '',
        title: '',
        url: '',
        ojsVersion: '',
        sslStatus: 'None',
        chiefEditorName: '',
        contactPersonName: '',
        issnPrint: '',
        issnOnline: '',
        invoiceNumber: '',
        category: '',
        subCategory: '',
        subjectCategory: '',
        publisherCountry: '',
        languages: '',
        license: 'CC BY',
        hecMainCategoryId: '',
        hecSubCategoryId: '',
        hecSubjectCategoryId: '',
        scope: [] as string[],
        apcAmount: 0,
        editorEmail: '',
        credentials: {
          email: '',
          password: '',
          loginLink: ''
        },
        assignedEmployeeId: '',
        status: 'pending_issn',
        isSubscribed: true,
        isOjsSubscribedFromUs: true,
        isIssnSubscribedFromUs: true,
        isHecSubscribedFromUs: true,
        isDoiSubscribedFromUs: true
      });
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'journals');
    }
  };

  const handleDeleteJournal = async (journal: Journal) => {
    if (!confirm(`Are you sure you want to move "${journal.title}" to trash?`)) return;
    try {
      await moveToTrash('journals', journal.id, journal, currentUser.name);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'journals');
    }
  };

  const handleVerifyJournal = async (journalId: string) => {
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Manager') return;
    
    try {
      const journalRef = doc(db, 'journals', journalId);
      await updateDoc(journalRef, {
        isVerified: true,
        verifiedBy: currentUser.name,
        verifiedById: currentUser.id,
        verifiedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journals');
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
    return <ClientDetail client={viewingClient} onBack={() => setViewingClient(null)} currentUser={currentUser} />;
  }

  return (
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen">
      {/* Technical Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <BookOpen size={20} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Mission Control</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Journal Repository
            <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-200">
              {filteredJournals.length} Active
            </span>
          </h2>
          <p className="text-slate-500 text-sm font-medium">Global database of academic publications and management metrics.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Search by title, ISSN, or client..."
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all w-64 font-medium"
              value={searchQuery}
              onChange={() => {}} 
              disabled
            />
          </div>
          
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={setSelectedColumns}
          />

          {isEmployee && (
            <div className="flex items-center gap-2">
              {currentUser.role === 'Admin' && (
                <div className="flex gap-2 mr-2">
                  <button 
                    onClick={() => setIsConfigModalOpen(true)}
                    className="p-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                    title="Configure Journal Categories"
                  >
                    <Settings2 size={20} />
                  </button>
                  <button 
                    onClick={() => setIsScopeConfigOpen(true)}
                    className="p-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                    title="Configure Journal Scopes"
                  >
                    <Settings2 size={20} className="text-indigo-600" />
                  </button>
                </div>
              )}
              {check('journals', 'add') && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                >
                  <Plus size={18} />
                  New Journal
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white/50 p-2 rounded-2xl border border-slate-100/50">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Filter size={14} className="text-slate-400" />
          <select 
            className="text-xs font-bold text-slate-600 outline-none bg-transparent"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Tag size={14} className="text-slate-400" />
          <select 
            className="text-xs font-bold text-slate-600 outline-none bg-transparent"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="complete">Complete</option>
            <option value="pending_issn">Pending ISSN</option>
          </select>
        </div>

        {(categoryFilter || statusFilter) && (
          <button 
            onClick={() => { setCategoryFilter(''); setStatusFilter(''); }}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-all"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                <BookOpen className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24} />
              </div>
              <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Synchronizing Repository...</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                <tr className="border-b border-slate-100">
                  {selectedColumns.includes('title') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <BookOpen size={14} />
                        Journal Identity
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('client') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Users size={14} />
                        Ownership & Editorial
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('ojs') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Globe size={14} />
                        Technical Stack
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('pricing') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <DollarSign size={14} />
                        Financials
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('invoice') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Hash size={14} />
                        Billing Ref
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('status') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Activity size={14} />
                        Lifecycle
                      </div>
                    </th>
                  )}
                  <th className="px-6 py-5 text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence mode="popLayout">
                  {filteredJournals.map((journal) => (
                    <motion.tr 
                      layout
                      key={journal.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setViewingJournal({ id: journal.id, editMode: false })}
                      className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                    >
                      {selectedColumns.includes('title') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                              <BookOpen size={20} />
                            </div>
                            <div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingJournal(journal);
                                }}
                                className="font-bold text-sm text-slate-900 hover:text-indigo-600 hover:underline text-left"
                              >
                                {journal.title}
                              </button>
                              <div className="flex items-center gap-2 mt-0.5">
                                {journal.category && (
                                  <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                    {journal.category}
                                  </span>
                                )}
                                {journal.url && (
                                  <a 
                                    href={journal.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-slate-400 hover:text-indigo-600 flex items-center gap-1"
                                  >
                                    <ExternalLink size={8} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('client') && (
                        <td className="px-6 py-4">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const client = clients.find(c => c.id === journal.clientId);
                              if (client) setViewingClient(client);
                            }}
                            className="text-sm font-medium text-slate-700 hover:text-indigo-600 hover:underline text-left"
                          >
                            {clients.find(c => c.id === journal.clientId)?.name || 'Unknown Client'}
                          </button>
                          <div className="flex flex-col gap-0.5 mt-1">
                            {journal.chiefEditorName && (
                              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                <User size={10} className="text-slate-400" />
                                <span className="font-bold text-slate-400 uppercase">Editor:</span> {journal.chiefEditorName}
                              </p>
                            )}
                            {journal.editorEmail && (
                              <p className="text-[10px] text-indigo-600 flex items-center gap-1">
                                <Mail size={10} className="text-indigo-400" />
                                {journal.editorEmail}
                              </p>
                            )}
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('ojs') && (
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Globe size={12} className="text-slate-400" />
                              <span className="text-xs font-medium text-slate-600">OJS {journal.ojsVersion || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Shield size={12} className={cn(
                                journal.sslStatus === 'Active' ? "text-emerald-500" : "text-rose-500"
                              )} />
                              <span className="text-xs font-medium text-slate-600">{journal.sslStatus || 'None'}</span>
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('pricing') && (
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <DollarSign size={12} className="text-emerald-500" />
                              <span className="text-xs font-bold text-slate-700">APC: {journal.apcAmount || 0}</span>
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('invoice') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono text-slate-600">{journal.invoiceNumber || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('status') && (
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                              journal.status === 'complete' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                            )}>
                              {journal.status === 'complete' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                              {journal.status.replace('_', ' ')}
                            </span>
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border self-start",
                              journal.isSubscribed 
                                ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                : "bg-rose-50 text-rose-600 border-rose-100"
                            )}>
                              {journal.isSubscribed ? 'Subscribed' : 'Not Subscribed'}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingJournal({ id: journal.id, editMode: false });
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Details"
                          >
                            <FileSearch size={16} />
                          </button>
                          {check('journals', 'edit') && (
                            <>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingJournal({ id: journal.id, editMode: true });
                                }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Edit Journal"
                              >
                                <Edit size={16} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJournal(journal);
                                  setIsIndexingModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Manage Indexing"
                              >
                                <Building2 size={16} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJournal(journal);
                                  setIsScholarModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Google Scholar History"
                              >
                                <GraduationCap size={16} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJournal(journal);
                                  setIsTransferModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Ownership Transfer"
                              >
                                <ArrowLeftRight size={16} />
                              </button>
                            </>
                          )}
                          {check('journals', 'delete') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteJournal(journal);
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Move to Trash"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create New Journal"
      >
        <form onSubmit={handleCreateJournal} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Select Client</label>
            <select 
              required
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={newJournal.clientId}
              onChange={e => setNewJournal(prev => ({ ...prev, clientId: e.target.value, publisherId: '' }))}
            >
              <option value="">Choose a client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Select Publisher</label>
            <select 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={newJournal.publisherId}
              onChange={e => setNewJournal(prev => ({ ...prev, publisherId: e.target.value }))}
              disabled={!newJournal.clientId}
            >
              <option value="">Choose a publisher...</option>
              {publishers.filter(p => p.clientId === newJournal.clientId).map(pub => (
                <option key={pub.id} value={pub.id}>{pub.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Select Domain</label>
            <select 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={newJournal.domainId}
              onChange={e => setNewJournal(prev => ({ ...prev, domainId: e.target.value }))}
              disabled={!newJournal.clientId}
            >
              <option value="">Choose a domain...</option>
              {domains.filter(d => d.clientId === newJournal.clientId).map(domain => (
                <option key={domain.id} value={domain.id}>{domain.domainName}</option>
              ))}
            </select>
          </div>
          <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 space-y-4">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
              <Shield size={18} />
              Subscription Awareness
            </h3>
            <p className="text-xs text-amber-700">Identify which services are subscribed through us to enable billing and support features.</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox"
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  checked={newJournal.isOjsSubscribedFromUs}
                  onChange={e => setNewJournal(prev => ({ ...prev, isOjsSubscribedFromUs: e.target.checked }))}
                />
                <span className="text-xs font-bold text-slate-700">OJS (Us)</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox"
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  checked={newJournal.isIssnSubscribedFromUs}
                  onChange={e => setNewJournal(prev => ({ ...prev, isIssnSubscribedFromUs: e.target.checked }))}
                />
                <span className="text-xs font-bold text-slate-700">ISSN (Us)</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox"
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  checked={newJournal.isHecSubscribedFromUs}
                  onChange={e => setNewJournal(prev => ({ ...prev, isHecSubscribedFromUs: e.target.checked }))}
                />
                <span className="text-xs font-bold text-slate-700">HEC (Us)</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox"
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  checked={newJournal.isDoiSubscribedFromUs}
                  onChange={e => setNewJournal(prev => ({ ...prev, isDoiSubscribedFromUs: e.target.checked }))}
                />
                <span className="text-xs font-bold text-slate-700">DOI (Us)</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Journal Title</label>
            <input 
              required
              type="text" 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. International Journal of Medical Science"
              value={newJournal.title}
              onChange={e => setNewJournal(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">OJS Version</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. 3.3.0-8"
                value={newJournal.ojsVersion}
                onChange={e => setNewJournal(prev => ({ ...prev, ojsVersion: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">SSL Status</label>
              <select 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newJournal.sslStatus}
                onChange={e => setNewJournal(prev => ({ ...prev, sslStatus: e.target.value as Journal['sslStatus'] }))}
              >
                <option value="None">None</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">License Permitted</label>
              <select 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newJournal.license}
                onChange={e => setNewJournal(prev => ({ ...prev, license: e.target.value as any }))}
              >
                <option value="CC BY">CC BY</option>
                <option value="CC BY-SA">CC BY-SA</option>
                <option value="CC BY-ND">CC BY-ND</option>
                <option value="CC BY-NC">CC BY-NC</option>
                <option value="CC BY-NC-SA">CC BY-NC-SA</option>
                <option value="CC BY-NC-ND">CC BY-NC-ND</option>
                <option value="CC0">CC0</option>
                <option value="Public Domain">Public Domain</option>
                <option value="Publisher’s Own License">Publisher’s Own License</option>
              </select>
            </div>
          </div>

          <div className="p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100 space-y-4">
            <div className="flex items-center gap-2 text-indigo-900 font-bold">
              <Database size={18} />
              HEC Category Management
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">HEC Main Category</label>
                <select 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newJournal.hecMainCategoryId}
                  onChange={e => setNewJournal(prev => ({ ...prev, hecMainCategoryId: e.target.value, hecSubCategoryId: '', hecSubjectCategoryId: '' }))}
                >
                  <option value="">Select Main Category...</option>
                  {hecCategories.filter(c => c.type === 'main').map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">HEC Sub Category</label>
                <select 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newJournal.hecSubCategoryId}
                  onChange={e => setNewJournal(prev => ({ ...prev, hecSubCategoryId: e.target.value, hecSubjectCategoryId: '' }))}
                  disabled={!newJournal.hecMainCategoryId}
                >
                  <option value="">Select Sub Category...</option>
                  {hecCategories.filter(c => c.type === 'sub' && c.parentId === newJournal.hecMainCategoryId).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">HEC Subject Category</label>
                <select 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newJournal.hecSubjectCategoryId}
                  onChange={e => setNewJournal(prev => ({ ...prev, hecSubjectCategoryId: e.target.value }))}
                  disabled={!newJournal.hecSubCategoryId}
                >
                  <option value="">Select Subject Category...</option>
                  {hecCategories.filter(c => c.type === 'subject' && c.parentId === newJournal.hecSubCategoryId).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Subject Category</label>
            <input 
              type="text"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={newJournal.subjectCategory}
              onChange={e => setNewJournal(prev => ({ ...prev, subjectCategory: e.target.value }))}
              placeholder="Enter Subject Category"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Publisher's Country</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newJournal.publisherCountry}
                onChange={e => setNewJournal(prev => ({ ...prev, publisherCountry: e.target.value }))}
                placeholder="e.g. USA, UK"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Languages</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newJournal.languages}
                onChange={e => setNewJournal(prev => ({ ...prev, languages: e.target.value }))}
                placeholder="e.g. English, Spanish"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700">Journal Category (Legacy)</label>
                <button
                  type="button"
                  onClick={handleAiSuggestCategory}
                  disabled={isAiSuggesting || !newJournal.title}
                  className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-700 disabled:opacity-50"
                >
                  <Sparkles size={10} />
                  AI Suggest
                </button>
              </div>
              <select 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newJournal.category}
                onChange={e => setNewJournal(prev => ({ ...prev, category: e.target.value, subCategory: '' }))}
              >
                <option value="">Select Category...</option>
                {journalCategories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Sub-Category</label>
              <select 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newJournal.subCategory}
                onChange={e => setNewJournal(prev => ({ ...prev, subCategory: e.target.value }))}
                disabled={!newJournal.category}
              >
                <option value="">Select Sub-Category...</option>
                {journalCategories.find(c => c.name === newJournal.category)?.subCategories.map((sub: string) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">Journal Scope (Keywords)</label>
              <button
                type="button"
                onClick={handleAiSuggestScope}
                disabled={isAiSuggesting || !newJournal.title}
                className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-700 disabled:opacity-50"
              >
                <Wand2 size={10} />
                AI Generate
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[50px]">
                {newJournal.scope.map((keyword, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold"
                  >
                    {keyword}
                    <button 
                      type="button"
                      onClick={() => setNewJournal(prev => ({ ...prev, scope: prev.scope.filter((_, i) => i !== index) }))}
                      className="hover:text-indigo-900"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input 
                  type="text"
                  className="flex-1 bg-transparent outline-none text-sm min-w-[120px]"
                  placeholder="Type and press Enter..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = e.currentTarget.value.trim();
                      if (val && !newJournal.scope.includes(val)) {
                        setNewJournal(prev => ({ ...prev, scope: [...prev.scope, val] }));
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-400">Press Enter to add multiple keywords.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">APC Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="number" 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newJournal.apcAmount}
                  onChange={e => setNewJournal(prev => ({ ...prev, apcAmount: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Editor Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="email" 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="editor@journal.com"
                value={newJournal.editorEmail}
                onChange={e => setNewJournal(prev => ({ ...prev, editorEmail: e.target.value }))}
              />
            </div>
          </div>

          {newJournal.isOjsSubscribedFromUs && (
            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-4">
              <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                <Key size={14} />
                Access & Credentials
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">Journal Website URL</label>
                  <input 
                    type="url" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="https://journal.example.com"
                    value={newJournal.url}
                    onChange={e => setNewJournal(prev => ({ ...prev, url: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">Admin Login URL</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="https://journal.com/login"
                    value={newJournal.credentials.loginLink}
                    onChange={e => setNewJournal(prev => ({ ...prev, credentials: { ...prev.credentials, loginLink: e.target.value } }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">Login Username</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newJournal.credentials.email}
                    onChange={e => setNewJournal(prev => ({ ...prev, credentials: { ...prev.credentials, email: e.target.value } }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">Password</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newJournal.credentials.password}
                    onChange={e => setNewJournal(prev => ({ ...prev, credentials: { ...prev.credentials, password: e.target.value } }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              Assign Employee
            </label>
            <select 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={newJournal.assignedEmployeeId}
              onChange={e => setNewJournal(prev => ({ ...prev, assignedEmployeeId: e.target.value }))}
            >
              <option value="">Select Employee to Assign</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 italic">Only the assigned employee and managers/admins will be able to see this journal.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Chief Editor Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Full name of Chief Editor"
                value={newJournal.chiefEditorName}
                onChange={e => setNewJournal(prev => ({ ...prev, chiefEditorName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Contact Person Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Primary contact person"
                value={newJournal.contactPersonName}
                onChange={e => setNewJournal(prev => ({ ...prev, contactPersonName: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">ISSN Print (Optional)</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="1234-5678"
                value={newJournal.issnPrint}
                onChange={e => setNewJournal(prev => ({ ...prev, issnPrint: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">ISSN Online (Optional)</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="8765-4321"
                value={newJournal.issnOnline}
                onChange={e => setNewJournal(prev => ({ ...prev, issnOnline: e.target.value }))}
              />
            </div>
          </div>
          {(newJournal.isOjsSubscribedFromUs || newJournal.isIssnSubscribedFromUs || newJournal.isHecSubscribedFromUs || newJournal.isDoiSubscribedFromUs) && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Invoice Number</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="INV-2024-XXX"
                value={newJournal.invoiceNumber}
                onChange={e => setNewJournal(prev => ({ ...prev, invoiceNumber: e.target.value }))}
              />
            </div>
          )}
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <input 
              type="checkbox"
              id="journalIsSubscribed"
              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={newJournal.isSubscribed}
              onChange={e => setNewJournal(prev => ({ ...prev, isSubscribed: e.target.checked }))}
            />
            <label htmlFor="journalIsSubscribed" className="text-sm font-bold text-slate-700 cursor-pointer">
              Client has officially subscribed to this service
              <p className="text-[10px] text-slate-400 font-medium">Unsubscribed services restrict client chat and support access.</p>
            </label>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              Create Journal
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isIndexingModalOpen}
        onClose={() => setIsIndexingModalOpen(false)}
        title="Journal Indexing Management"
        maxWidth="4xl"
      >
        {selectedJournal && (
          <JournalIndexingManager 
            journal={selectedJournal} 
            onClose={() => setIsIndexingModalOpen(false)} 
            currentUser={currentUser}
          />
        )}
      </Modal>
      
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Journal Ownership Transfer"
        maxWidth="4xl"
      >
        {selectedJournal && (
          <JournalTransferManager 
            journal={selectedJournal} 
            clients={clients}
            onClose={() => setIsTransferModalOpen(false)} 
          />
        )}
      </Modal>

      <Modal
        isOpen={isScholarModalOpen}
        onClose={() => setIsScholarModalOpen(false)}
        title="Google Scholar History"
        maxWidth="4xl"
      >
        {selectedJournal && (
          <GoogleScholarManager 
            journal={selectedJournal} 
            onClose={() => setIsScholarModalOpen(false)} 
          />
        )}
      </Modal>

      {isConfigModalOpen && (
        <ConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          title="Configure Journal Categories"
          fieldName="journalCategories"
          type="journal-categories"
          initialItems={journalCategories}
        />
      )}

      {isScopeConfigOpen && (
        <ConfigModal
          isOpen={isScopeConfigOpen}
          onClose={() => setIsScopeConfigOpen(false)}
          title="Configure Journal Scopes"
          fieldName="journalScopes"
          type="string-list"
          initialItems={journalScopes}
        />
      )}
    </div>
  );
};
