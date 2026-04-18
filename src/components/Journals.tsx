import React, { useState, useEffect, useMemo } from 'react';
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
  Settings2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown
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
  onNavigateToPublisher?: (id: string) => void;
  initialJournalId?: string;
  onClearInitialId?: () => void;
}

const AVAILABLE_COLUMNS = [
  { id: 'title', label: 'Journal Title' },
  { id: 'client', label: 'Client & Editor' },
  { id: 'publisher', label: 'Publisher' },
  { id: 'category', label: 'Category' },
  { id: 'subCategory', label: 'Sub-Category' },
  { id: 'ojs', label: 'OJS / SSL' },
  { id: 'url', label: 'URL' },
  { id: 'issn', label: 'ISSN / pISSN' },
  { id: 'license', label: 'License' },
  { id: 'languages', label: 'Languages' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'apc', label: 'APC Amount' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'status', label: 'Status' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'indexing', label: 'Indexing' },
  { id: 'createdAt', label: 'Created At' },
];

import { MergeModal } from './MergeModal';
import { toast } from 'react-hot-toast';

export const Journals: React.FC<JournalsProps> = ({ 
  searchQuery, 
  currentUser, 
  onNavigateToPublisher,
  initialJournalId,
  onClearInitialId
}) => {
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
  const [viewingJournal, setViewingJournal] = useState<{ id: string, editMode?: boolean } | null>(
    initialJournalId ? { id: initialJournalId } : null
  );

  useEffect(() => {
    if (initialJournalId) {
      setViewingJournal({ id: initialJournalId });
    }
  }, [initialJournalId]);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['journals'] || AVAILABLE_COLUMNS.map(c => c.id)
  );
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'createdAt', direction: 'desc' });
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<Journal | null>(null);
  const [duplicates, setDuplicates] = useState<Journal[][]>([]);
  const [isScanning, setIsScanning] = useState(false);

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
    credentials: [],
    assignedEmployeeId: '',
    status: 'pending_issn' as const,
    isSubscribed: true,
    isOjsSubscribedFromUs: true,
    isIssnSubscribedFromUs: true,
    isHecSubscribedFromUs: true,
    isDoiSubscribedFromUs: true
  });

  const [newCred, setNewCred] = useState({
    label: '',
    email: '',
    password: '',
    loginLink: ''
  });

  const handleAddCredential = () => {
    if (!newCred.email) return;
    setNewJournal(prev => ({
      ...prev,
      credentials: [...(prev.credentials || []), { ...newCred, id: crypto.randomUUID() }]
    }));
    setNewCred({ label: '', email: '', password: '', loginLink: '' });
  };

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

  const sortedJournals = useMemo(() => {
    let sortableItems = [...filteredJournals];
    if (sortConfig.key !== null && sortConfig.direction !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Journal];
        let bValue: any = b[sortConfig.key as keyof Journal];

        if (sortConfig.key === 'client') {
          const clientA = clients.find(c => c.id === a.clientId);
          const clientB = clients.find(c => c.id === b.clientId);
          aValue = clientA?.name || '';
          bValue = clientB?.name || '';
        }

        if (sortConfig.key === 'publisher') {
          const pubA = publishers.find(p => p.id === a.publisherId);
          const pubB = publishers.find(p => p.id === b.publisherId);
          aValue = pubA?.name || '';
          bValue = pubB?.name || '';
        }

        if (aValue === bValue) return 0;
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        const modifier = sortConfig.direction === 'asc' ? 1 : -1;
        if (typeof aValue === 'string') {
          return aValue.localeCompare(bValue) * modifier;
        }
        return (aValue > bValue ? 1 : -1) * modifier;
      });
    }
    return sortableItems;
  }, [filteredJournals, sortConfig, clients, publishers]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey || !sortConfig.direction) return <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="ml-1 text-indigo-600" /> : <ChevronDown size={12} className="ml-1 text-indigo-600" />;
  };

  const uniqueCategories = useMemo(() => {
    const fromData = journals.map(j => j.category).filter(Boolean);
    const fromSettings = journalCategories.map(c => c.name);
    return Array.from(new Set([...fromData, ...fromSettings])).sort();
  }, [journals, journalCategories]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(journals.map(j => j.status).filter(Boolean))).sort();
  }, [journals]);

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
        credentials: (newJournal.credentials || []).map((cred: any) => ({
          ...cred,
          loginLink: sanitizeUrl(cred.loginLink || '')
        })),
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
        credentials: [],
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

  const scanForDuplicates = () => {
    setIsScanning(true);
    const groups: Journal[][] = [];
    const processed = new Set<string>();

    journals.forEach(journal => {
      if (processed.has(journal.id)) return;

      const group = journals.filter(other => {
        if (other.id === journal.id) return false;
        
        const sameTitle = journal.title.toLowerCase() === other.title.toLowerCase();
        const sameIssnPrint = journal.issnPrint && other.issnPrint && journal.issnPrint === other.issnPrint;
        const sameIssnOnline = journal.issnOnline && other.issnOnline && journal.issnOnline === other.issnOnline;
        const sameUrl = journal.url && other.url && sanitizeUrl(journal.url) === sanitizeUrl(other.url);

        return sameTitle || sameIssnPrint || sameIssnOnline || sameUrl;
      });

      if (group.length > 0) {
        const fullGroup = [journal, ...group];
        fullGroup.forEach(item => processed.add(item.id));
        groups.push(fullGroup);
      }
    });

    setDuplicates(groups);
    setIsScanning(false);
    if (groups.length === 0) {
      toast.success("No duplicate journals found.");
    }
  };

  if (viewingJournal) {
    return (
      <JournalDetail 
        journalId={viewingJournal.id} 
        initialEditMode={viewingJournal.editMode}
        onBack={() => {
          setViewingJournal(null);
          if (onClearInitialId) onClearInitialId();
        }} 
        currentUser={currentUser} 
        onNavigateToPublisher={onNavigateToPublisher}
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
                  <button
                    onClick={scanForDuplicates}
                    disabled={isScanning}
                    className="p-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                    title="Scan for duplicate journals"
                  >
                    {isScanning ? <Loader2 size={18} className="animate-spin" /> : <GitMerge size={18} />}
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

      {duplicates.length > 0 && (
        <div className="mx-auto mb-6">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle size={20} />
                <h4 className="font-bold">Potential Duplicate Journals Found ({duplicates.length} groups)</h4>
              </div>
              <button 
                onClick={() => setDuplicates([])}
                className="text-xs font-bold text-amber-600 hover:text-amber-700"
              >
                Dismiss
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {duplicates.map((group, idx) => (
                <div key={`group-${idx}`} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm space-y-3">
                  <p className="text-sm font-bold text-slate-900">Duplicate Group</p>
                  <div className="space-y-2">
                    {group.map((journal, jIdx) => (
                      <div key={`${journal.id}-${jIdx}`} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                        <div className="truncate mr-2">
                          <p className="font-bold text-slate-700 truncate">{journal.title}</p>
                          <p className="text-[10px] text-slate-500 truncate">{journal.issnPrint || journal.url || 'No extra info'}</p>
                        </div>
                        <button 
                          onClick={() => {
                            setMergeSource(journal);
                            setIsMergeModalOpen(true);
                          }}
                          className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md font-bold hover:bg-indigo-100 transition-all shrink-0 flex items-center gap-1"
                        >
                          <GitMerge size={12} />
                          Merge
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

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
            {uniqueCategories.map((cat, idx) => (
              <option key={`unique-cat-${cat || idx}`} value={cat}>{cat}</option>
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
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</option>
            ))}
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

      <div className="crm-card overflow-hidden">
        <div className="crm-table-container">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={40} />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Libraries...</p>
            </div>
          ) : (
            <table className="w-full border-collapse font-sans">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm border-b border-slate-100">
                <tr className="border-b border-slate-100">
                  {selectedColumns.includes('title') && (
                    <th 
                      className="px-6 py-5 text-left cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('title')}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        < BookOpen size={14} />
                        Journal Identity
                        <SortIcon columnKey="title" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('client') && (
                    <th 
                      className="px-6 py-5 text-left cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('client')}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Users size={14} />
                        Ownership & Editorial
                        <SortIcon columnKey="client" />
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
                    <th 
                      className="px-6 py-5 text-left cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('apcAmount')}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <DollarSign size={14} />
                        Financials
                        <SortIcon columnKey="apcAmount" />
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
                    <th 
                      className="px-6 py-5 text-left cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('status')}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Activity size={14} />
                        Lifecycle
                        <SortIcon columnKey="status" />
                      </div>
                    </th>
                  )}
                   {selectedColumns.includes('subscription') && (
                     <th className="px-6 py-5 text-left">
                       <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                         <DollarSign size={14} />
                         Subscription
                       </div>
                     </th>
                   )}
                   <th className="px-6 py-5 text-right">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</span>
                   </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                <AnimatePresence mode="popLayout">
                  {sortedJournals.map((journal) => (
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
                              journal.is_subscribed_with_us 
                                ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                : "bg-slate-50 text-slate-500 border-slate-200"
                            )}>
                              {journal.is_subscribed_with_us ? 'Subscribed' : 'Managed Data'}
                            </span>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('subscription') && (
                        <td className="px-6 py-4">
                           <div className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit shadow-sm border",
                            journal.is_subscribed_with_us ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-200"
                          )}>
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              journal.is_subscribed_with_us ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                            )} />
                            {journal.is_subscribed_with_us ? 'Subscribed' : 'Free Tier'}
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
                {journalCategories.map((cat, idx) => (
                  <option key={cat.id || `journal-cat-${idx}`} value={cat.name}>{cat.name}</option>
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
                {journalCategories.find(c => c.name === newJournal.category)?.subCategories?.map((sub: string, idx: number) => (
                  <option key={`sub-cat-${sub || idx}`} value={sub}>{sub}</option>
                )) || []}
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
                    key={`scope-idx-${index}`}
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

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Mail size={16} className="text-indigo-600" />
              Journal Email Credentials
            </h4>
            
            <div className="space-y-3">
              {newJournal.credentials.map((cred, idx) => (
                <div key={cred.id || idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-tighter">{cred.label || 'Email'}</span>
                    <span className="text-sm font-medium text-slate-900">{cred.email}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setNewJournal(prev => ({ ...prev, credentials: prev.credentials.filter((_, i) => i !== idx) }))}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              
              <div className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Label</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                      placeholder="e.g. Editor Email"
                      value={newCred.label}
                      onChange={e => setNewCred(prev => ({ ...prev, label: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address</label>
                    <input 
                      type="email"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                      placeholder="editor@journal.com"
                      value={newCred.email}
                      onChange={e => setNewCred(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Password</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none"
                      value={newCred.password}
                      onChange={e => setNewCred(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Login Link</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none"
                      value={newCred.loginLink}
                      onChange={e => setNewCred(prev => ({ ...prev, loginLink: e.target.value }))}
                    />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={handleAddCredential}
                  className="w-full py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-700 transition-all flex items-center justify-center gap-1"
                >
                  <Plus size={12} />
                  Add to List
                </button>
              </div>
            </div>
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

      <MergeModal
        isOpen={isMergeModalOpen}
        onClose={() => {
          setIsMergeModalOpen(false);
          setMergeSource(null);
        }}
        type="journals"
        initialSourceItem={mergeSource}
        onSuccess={() => {
          setDuplicates([]);
          scanForDuplicates();
        }}
      />
    </div>
  );
};
