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
  AlertTriangle,
  X,
  AlertCircle,
  Activity,
  Key,
  GitMerge,
  Database,
  Settings2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Journal, Client, Publisher, Domain, User as UserType, HECCategory } from '../types';
import { cn, sanitizeUrl, generateJournalAbbreviation, generateJournalInitials } from '../lib/utils';
import { db, handleFirestoreError, OperationType, moveToTrash, getErrorMessage } from '../lib/firebase';
import { geminiService } from '../services/geminiService';
import { Sparkles, Wand2 } from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, where, getDocs, getDoc, limit } from 'firebase/firestore';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import { JournalForm } from './JournalForm';
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
  { id: 'abbreviation', label: 'Abbreviation' },
  { id: 'initials', label: 'Initials' },
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
  const { check, isAdmin, isManager } = usePermissions(currentUser);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [hasScanned, setHasScanned] = useState(false);
  const [selectedJournalIds, setSelectedJournalIds] = useState<string[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

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
    abbreviation: '',
    initials: '',
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

  // Auto-save logic for Journal Creation Form
  useEffect(() => {
    const savedDraft = localStorage.getItem('journal_creation_draft');
    if (savedDraft && !isModalOpen) {
      try {
        const draft = JSON.parse(savedDraft);
        setNewJournal(prev => ({ ...prev, ...draft }));
      } catch (e) {
        console.error("Failed to parse journal draft", e);
      }
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (isModalOpen) {
      localStorage.setItem('journal_creation_draft', JSON.stringify(newJournal));
    }
  }, [newJournal, isModalOpen]);

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

  const paginatedJournals = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedJournals.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedJournals, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedJournals.length / itemsPerPage);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, statusFilter, itemsPerPage]);

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
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Uniqueness checks on creation
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      const globalSettings = settingsDoc.exists() ? settingsDoc.data() : null;

      if (globalSettings?.uniquenessSettings?.journalTitle && newJournal.title) {
        const cleanTitle = newJournal.title.toLowerCase().trim();
        const titleQuery = query(collection(db, 'journals'), where('title', '==', cleanTitle), limit(1));
        const titleSnapshot = await getDocs(titleQuery);
        if (!titleSnapshot.empty) {
          toast.error('A journal with this title already exists in the system registry! Duplicates are strictly blocked.');
          setIsSubmitting(false);
          return;
        }
      }

      if (globalSettings?.uniquenessSettings?.issnNumber) {
        if (newJournal.issnPrint) {
          const issnPrintQuery = query(collection(db, 'journals'), where('issnPrint', '==', newJournal.issnPrint.trim()), limit(1));
          const issnPrintSnapshot = await getDocs(issnPrintQuery);
          if (!issnPrintSnapshot.empty) {
            toast.error('A journal with this Print ISSN already exists in the system registry! Duplicates are strictly blocked.');
            setIsSubmitting(false);
            return;
          }
        }
        if (newJournal.issnOnline) {
          const issnOnlineQuery = query(collection(db, 'journals'), where('issnOnline', '==', newJournal.issnOnline.trim()), limit(1));
          const issnOnlineSnapshot = await getDocs(issnOnlineQuery);
          if (!issnOnlineSnapshot.empty) {
            toast.error('A journal with this Online ISSN already exists in the system registry! Duplicates are strictly blocked.');
            setIsSubmitting(false);
            return;
          }
        }
      }

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
      
      // Clear draft
      localStorage.removeItem('journal_creation_draft');

      // Reset form and close modal
      setNewJournal({
        clientId: '',
        publisherId: '',
        domainId: '',
        title: '',
        abbreviation: '',
        initials: '',
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
  const [cleanupModal, setCleanupModal] = useState(false);
  const [confirmingJournalId, setConfirmingJournalId] = useState<string | null>(null);

  const handleDeleteJournal = async (journal: Journal) => {
    const loadingToast = toast.loading(`Moving "${journal.title}" to trash...`);
    try {
      await moveToTrash('journals', journal.id, journal, currentUser?.name || 'Admin');
      toast.success(`"${journal.title}" moved to trash.`, { id: loadingToast });
      setConfirmingJournalId(null);
    } catch (error) {
      toast.error(getErrorMessage(error), { id: loadingToast });
    }
  };

  const executeBulkDelete = async () => {
    const loadingToast = toast.loading(`Moving ${selectedJournalIds.length} journals to trash...`);
    try {
      const selectedItems = journals.filter(j => selectedJournalIds.includes(j.id));
      for (const j of selectedItems) {
        await moveToTrash('journals', j.id, j, currentUser?.name || 'Admin');
      }
      setSelectedJournalIds([]);
      toast.success(`Moved ${selectedItems.length} journals to trash.`, { id: loadingToast });
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
    }
  };

  const executeCleanup = async () => {
    const invalid = journals.filter(j => !j.title || j.title.toLowerCase().includes('untitled') || j.title.toLowerCase().includes('new journal'));
    if (invalid.length === 0) {
      toast.success("No invalid journals found.");
      return;
    }
    const loadingToast = toast.loading(`Moving ${invalid.length} journals to trash...`);
    try {
      for (const j of invalid) {
        await moveToTrash('journals', j.id, j, currentUser?.name || 'Admin');
      }
      toast.success(`Moved ${invalid.length} invalid journals to trash.`, { id: loadingToast });
    } catch (error) {
      console.error("Cleanup error:", error);
      toast.error("Cleanup failed. Check permissions.", { id: loadingToast });
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
    setHasScanned(true);
    const groups: Journal[][] = [];
    const processed = new Set<string>();

    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

    journals.forEach(journal => {
      if (processed.has(journal.id)) return;

      const normTitle = normalize(journal.title);

      const group = journals.filter(other => {
        if (other.id === journal.id) return false;
        
        const otherNormTitle = normalize(other.title);
        const sameTitle = normTitle === otherNormTitle;
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
      toast.success("No duplicate journals found based on Title, ISSN or URL.");
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
    <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen max-w-full mx-auto px-4 md:px-8 lg:px-12">
      {/* Technical Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
            <BookOpen size={20} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Mission Control</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Journal Repository
            <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full border border-slate-200 dark:border-slate-700">
              {filteredJournals.length} Active
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Global database of academic publications and management metrics.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Search by title, ISSN, or client..."
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all w-64 font-medium"
              value={searchQuery || ''}
              onChange={() => {}} 
              disabled
            />
          </div>
          
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />

          {isEmployee && (
            <div className="flex items-center gap-2">
              {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
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
                  {(isAdmin || isManager || check('journals', 'delete')) && (
                    <>
                      <button
                        onClick={() => setCleanupModal(true)}
                        className="p-2.5 bg-white text-rose-600 border border-slate-200 rounded-xl hover:bg-rose-50 transition-all shadow-sm"
                        title="Cleanup invalid journals"
                      >
                        <Trash2 size={18} />
                      </button>
                      {selectedJournalIds.length > 0 && (
                        <button
                          onClick={() => setBulkDeleteModal(true)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                        >
                          <Trash2 size={18} />
                          Delete ({selectedJournalIds.length})
                        </button>
                      )}
                    </>
                  )}
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
                onClick={() => {
                  setDuplicates([]);
                  setHasScanned(false);
                }}
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
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setMergeSource(journal);
                              setIsMergeModalOpen(true);
                            }}
                            className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md font-bold hover:bg-indigo-100 transition-all shrink-0 flex items-center gap-1"
                            title="Merge this into another journal"
                          >
                            <GitMerge size={12} />
                            Merge
                          </button>
                          <button 
                            onClick={() => handleDeleteJournal(journal)}
                            className="p-1.5 bg-rose-50 text-rose-600 rounded-md hover:bg-rose-100 transition-all shadow-sm"
                            title="Delete this duplicate"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {hasScanned && duplicates.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-sm mb-6"
        >
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 size={20} />
            <h4 className="font-bold text-sm text-emerald-700">Scan Complete: No duplicate journals found.</h4>
          </div>
          <button 
            onClick={() => setHasScanned(false)}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white/50 p-2 rounded-2xl border border-slate-100/50">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Filter size={14} className="text-slate-400" />
          <select 
            className="text-xs font-bold text-slate-600 outline-none bg-transparent"
            value={categoryFilter || ''}
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
            value={statusFilter || ''}
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
        <div className="crm-table-container max-h-[60vh] overflow-y-auto overflow-x-auto relative scrollbar-thin">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={40} />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Libraries...</p>
            </div>
          ) : (
            <table className="w-full border-collapse font-sans">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 shadow-sm border-b border-slate-100 dark:border-slate-800">
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-5 text-left w-10">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                      checked={sortedJournals.length > 0 && selectedJournalIds.length === sortedJournals.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedJournalIds(sortedJournals.map(j => j.id));
                        } else {
                          setSelectedJournalIds([]);
                        }
                      }}
                    />
                  </th>
                  {selectedColumns.includes('title') && (
                    <th 
                      className="px-6 py-5 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                      onClick={() => requestSort('title')}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        < BookOpen size={14} />
                        Journal Identity
                        <SortIcon columnKey="title" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('abbreviation') && (
                    <th 
                      className="px-6 py-5 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                      onClick={() => requestSort('abbreviation')}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Tag size={14} />
                        Abbr.
                        <SortIcon columnKey="abbreviation" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('initials') && (
                    <th 
                      className="px-6 py-5 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                      onClick={() => requestSort('initials')}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Hash size={14} />
                        Initials
                        <SortIcon columnKey="initials" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('client') && (
                    <th 
                      className="px-6 py-5 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                      onClick={() => requestSort('client')}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Users size={14} />
                        Ownership & Editorial
                        <SortIcon columnKey="client" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('publisher') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Building2 size={14} />
                        Publisher
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('category') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Tag size={14} />
                        Category
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('subCategory') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Tag size={14} />
                        Sub-Category
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('ojs') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Globe size={14} />
                        Technical Stack
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('url') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Globe size={14} />
                        URL
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('issn') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Hash size={14} />
                        ISSN / pISSN
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('license') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Shield size={14} />
                        License
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('languages') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Globe size={14} />
                        Languages
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('pricing') && (
                    <th 
                      className="px-6 py-5 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                      onClick={() => requestSort('apcAmount')}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <DollarSign size={14} />
                        Financials
                        <SortIcon columnKey="apcAmount" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('apc') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <DollarSign size={14} />
                        APC Amount
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('invoice') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Hash size={14} />
                        Billing Ref
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('status') && (
                    <th 
                      className="px-6 py-5 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                      onClick={() => requestSort('status')}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Activity size={14} />
                        Onboarding Status
                        <SortIcon columnKey="status" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('subscription') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <DollarSign size={14} />
                        Subscription
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('indexing') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <GraduationCap size={14} />
                        Scholar Status
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('createdAt') && (
                    <th className="px-6 py-5 text-left">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <Clock size={14} />
                        Created At
                      </div>
                    </th>
                  )}
                   <th className="px-6 py-5 text-right">
                     <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Actions</span>
                   </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-sm">
                <AnimatePresence mode="popLayout">
                  {paginatedJournals.map((journal) => (
                    <motion.tr 
                      layout
                      key={journal.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setViewingJournal({ id: journal.id, editMode: false })}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-all group cursor-pointer"
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedJournalIds.includes(journal.id)}
                          onChange={() => {
                            setSelectedJournalIds(prev => 
                              prev.includes(journal.id) 
                                ? prev.filter(id => id !== journal.id)
                                : [...prev, journal.id]
                            );
                          }}
                        />
                      </td>
                      {selectedColumns.includes('title') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/30">
                              <BookOpen size={20} />
                            </div>
                            <div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingJournal(journal);
                                }}
                                className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline text-left"
                              >
                                {journal.title}
                              </button>
                              <div className="flex items-center gap-2 mt-0.5">
                                {journal.category && (
                                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                    {journal.category}
                                  </span>
                                )}
                                {journal.url && (
                                  <a 
                                    href={journal.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1"
                                  >
                                    <ExternalLink size={8} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('abbreviation') && (
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                            {journal.abbreviation || '—'}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('initials') && (
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md border border-indigo-100 dark:border-indigo-900/30">
                            {journal.initials || '—'}
                          </span>
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
                            className={cn(
                              "text-sm font-medium hover:underline text-left",
                              journal.clientId ? "text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400" : "text-amber-600 dark:text-amber-400 italic font-normal"
                            )}
                          >
                            {clients.find(c => c.id === journal.clientId)?.name || 'No Client Linked'}
                          </button>
                          <div className="flex flex-col gap-0.5 mt-1">
                            {journal.chiefEditorName && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <User size={10} className="text-slate-400" />
                                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase">Editor:</span> {journal.chiefEditorName}
                              </p>
                            )}
                            {journal.editorEmail && (
                              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                <Mail size={10} className="text-indigo-400 dark:text-indigo-500" />
                                {journal.editorEmail}
                              </p>
                            )}
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('publisher') && (
                        <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                          {publishers.find(p => p.id === journal.publisherId)?.name || '—'}
                        </td>
                      )}
                      {selectedColumns.includes('category') && (
                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                          {journal.category || '—'}
                        </td>
                      )}
                      {selectedColumns.includes('subCategory') && (
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                          {journal.subCategory || '—'}
                        </td>
                      )}
                      {selectedColumns.includes('ojs') && (
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Globe size={12} className="text-slate-400 dark:text-slate-500" />
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">OJS {journal.ojsVersion || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Shield size={12} className={cn(
                                journal.sslStatus === 'Active' ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                              )} />
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{journal.sslStatus || 'None'}</span>
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('url') && (
                        <td className="px-6 py-4 text-xs font-mono max-w-xs truncate text-indigo-600 dark:text-indigo-400">
                          {journal.url ? (
                            <a href={journal.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                              {journal.url} <ExternalLink size={10} />
                            </a>
                          ) : '—'}
                        </td>
                      )}
                      {selectedColumns.includes('issn') && (
                        <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-slate-300">
                          <div className="space-y-0.5">
                            {journal.issnPrint && <div>P: {journal.issnPrint}</div>}
                            {journal.issnOnline && <div>E: {journal.issnOnline}</div>}
                            {!journal.issnPrint && !journal.issnOnline && '—'}
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('license') && (
                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                          {journal.license || '—'}
                        </td>
                      )}
                      {selectedColumns.includes('languages') && (
                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                          {journal.languages || '—'}
                        </td>
                      )}
                      {selectedColumns.includes('pricing') && (
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <DollarSign size={12} className="text-emerald-500 dark:text-emerald-400" />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">APC: {journal.apcAmount || 0}</span>
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('apc') && (
                        <td className="px-6 py-4 text-xs text-slate-700 dark:text-slate-300 font-bold">
                          {journal.apcAmount ? `$${journal.apcAmount}` : '—'}
                        </td>
                      )}
                      {selectedColumns.includes('invoice') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono text-slate-600 dark:text-slate-300">{journal.invoiceNumber || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('status') && (
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                              journal.status === 'complete' ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/30"
                            )}>
                              {journal.status === 'complete' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                              {journal.status ? journal.status.replace('_', ' ') : 'Pending'}
                            </span>
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border self-start",
                              journal.is_subscribed_with_us 
                                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" 
                                : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
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
                            journal.is_subscribed_with_us ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30" : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                          )}>
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              journal.is_subscribed_with_us ? "bg-emerald-500 animate-pulse" : "bg-slate-400 dark:bg-slate-600"
                            )} />
                            {journal.is_subscribed_with_us ? 'Subscribed' : 'Free Tier'}
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('indexing') && (
                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                          {journal.googleScholarStatus || '—'}
                        </td>
                      )}
                      {selectedColumns.includes('createdAt') && (
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                          {journal.createdAt ? new Date(journal.createdAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingJournal({ id: journal.id, editMode: false });
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-all"
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
                          {(isAdmin || isManager || check('journals', 'delete')) && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJournal(journal);
                                  setIsMergeModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Merge Duplicates"
                              >
                                <ArrowLeftRight size={16} />
                              </button>
                              <div className="relative">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmingJournalId(confirmingJournalId === journal.id ? null : journal.id);
                                  }}
                                  className={cn(
                                    "p-2 rounded-lg transition-all border",
                                    confirmingJournalId === journal.id 
                                      ? "bg-rose-50 text-rose-700 border-rose-200" 
                                      : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-transparent"
                                  )}
                                  title="Move to Trash"
                                >
                                  <Trash2 size={16} />
                                </button>

                                <AnimatePresence>
                                  {confirmingJournalId === journal.id && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                      className="absolute right-0 bottom-full mb-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-start gap-3 mb-4 text-left">
                                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
                                          <AlertTriangle size={18} />
                                        </div>
                                        <div>
                                          <h4 className="font-bold text-slate-900 text-xs">Move to Trash?</h4>
                                          <p className="text-[10px] text-slate-500 mt-1">Are you sure you want to move this journal to trash?</p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => setConfirmingJournalId(null)}
                                          className="flex-1 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-100 transition-all"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => handleDeleteJournal(journal)}
                                          className="flex-1 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-700 transition-all shadow-sm"
                                        >
                                          Confirm
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
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
        
        {/* Pagination Controls */}
        {!loading && filteredJournals.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-slate-500">
                Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, filteredJournals.length)}</span> of <span className="text-slate-900">{filteredJournals.length}</span> journals
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Show:</span>
                <select 
                  className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={itemsPerPage || ''}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-8 h-8 rounded-xl text-xs font-bold transition-all",
                        currentPage === pageNum 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create New Journal"
      >
        <JournalForm 
          currentUser={currentUser} 
          onClose={() => setIsModalOpen(false)} 
        />
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
      <ConfirmModal
        isOpen={bulkDeleteModal}
        onClose={() => setBulkDeleteModal(false)}
        onConfirm={executeBulkDelete}
        title="Bulk Move to Trash"
        message={`Are you sure you want to move ${selectedJournalIds.length} selected journals to trash?`}
        confirmText="Move to Trash"
        variant="danger"
      />

      <ConfirmModal
        isOpen={cleanupModal}
        onClose={() => setCleanupModal(false)}
        onConfirm={executeCleanup}
        title="Journal Cleanup"
        message="Are you sure you want to move all journals with 'Untitled' or empty titles to trash?"
        confirmText="Clean Up"
        variant="danger"
      />
    </div>
  );
};
