import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  FileCheck, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  MoreHorizontal, 
  Search,
  Hash,
  FileText,
  Loader2,
  Building2,
  Globe,
  User as UserIcon,
  AlertCircle,
  Mail,
  CreditCard,
  Calendar,
  Settings2,
  Settings,
  Trash2,
  Printer,
  Filter,
  Tag,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ISSNRequest, Client, Journal, Publisher, User, GlobalSettings, Domain } from '../types';
import { cn, sanitizeUrl } from '../lib/utils';
import { db, handleFirestoreError, OperationType, moveToTrash } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, getDoc, where } from 'firebase/firestore';
import { Modal } from './Modal';
import { ISSNDetail } from './ISSNDetail';
import { ColumnSelector } from './ColumnSelector';
import { ClientDetail } from './ClientDetail';
import { JournalDetail } from './JournalDetail';
import { usePermissions } from '../hooks/usePermissions';
import { ConfigModal } from './ConfigModal';

interface ISSNRequestsProps {
  searchQuery: string;
  currentUser: User;
  onNavigateToPublisher?: (id: string) => void;
  journalId?: string;
}

const AVAILABLE_COLUMNS = [
  { id: 'requestNo', label: 'ISSN Request #' },
  { id: 'journal', label: 'Journal Title' },
  { id: 'client', label: 'Client Name' },
  { id: 'type', label: 'Request Type' },
  { id: 'status', label: 'Request Status' },
  { id: 'payment', label: 'Payments ISSN' },
  { id: 'sentDate', label: 'ISSN Sent Date' },
  { id: 'modifiedDate', label: 'ISSN Modified Date' },
  { id: 'publisher', label: 'Name of Publisher (ISSN)' },
  { id: 'publisherAddress', label: 'Publisher Address (ISSN)' },
  { id: 'frequency', label: 'Frequency_ISSN' },
  { id: 'contact', label: 'Contact name (ISSN)' },
  { id: 'email', label: 'Email Address (ISSN)' },
  { id: 'pIssn', label: 'P-ISSN' },
  { id: 'eIssn', label: 'E-ISSN' },
  { id: 'login', label: 'ISSN_Login' },
  { id: 'password', label: 'ISSN_Password' },
  { id: 'alreadyHaveDetails', label: 'Already Entered Details' },
  { id: 'existingPrintIssn', label: 'Existing P-ISSN' },
  { id: 'existingOnlineIssn', label: 'Existing E-ISSN' },
  { id: 'issnLoginPassword', label: 'ISSN Login Password' },
  { id: 'legacyInvoiceNumber', label: 'Legacy Invoice Number' },
  { id: 'journalUrl', label: 'Journal URL' },
  { id: 'createdAt', label: 'Created At' },
];

export const ISSNRequests: React.FC<ISSNRequestsProps> = ({ searchQuery, currentUser, onNavigateToPublisher, journalId }) => {
  const { check } = usePermissions(currentUser);
  const [requests, setRequests] = useState<ISSNRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubjectConfigOpen, setIsSubjectConfigOpen] = useState(false);
  const [isFrequencyConfigOpen, setIsFrequencyConfigOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ISSNRequest | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [viewingJournal, setViewingJournal] = useState<{ id: string, editMode?: boolean } | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['issn'] || AVAILABLE_COLUMNS.map(c => c.id)
  );
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);

  // Search, Filters & Pagination states
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dynamic creation states
  const [isAddingNewJournal, setIsAddingNewJournal] = useState(false);
  const [customJournalTitle, setCustomJournalTitle] = useState('');
  const [isAddingNewPublisher, setIsAddingNewPublisher] = useState(false);
  const [customPublisherName, setCustomPublisherName] = useState('');

  // Form state
  const [newRequest, setNewRequest] = useState({
    clientId: '',
    journalId: '',
    requestNo: '',
    requestType: 'Assignment',
    printIssn: '',
    onlineIssn: '',
    existingPrintIssn: '',
    existingOnlineIssn: '',
    issnLogin: '',
    issnPassword: '',
    issnLoginPassword: '',
    alreadyHaveDetails: false,
    journalUrl: '',
    publisherName: '',
    publisherAddress: '',
    frequency: '',
    contactName: '',
    emailAddress: '',
    paymentAmountPkr: 0,
    sentDate: '',
    modifiedDate: '',
    legacyInvoiceNumber: '',
    language: 'English',
    subject: '',
    country: 'Pakistan',
    status: 'Not Applied' as any,
  });

  const [duplicates, setDuplicates] = useState<ISSNRequest[][]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const scanForDuplicates = () => {
    setIsScanning(true);
    setHasScanned(true);
    const groups: ISSNRequest[][] = [];
    const processed = new Set<string>();

    requests.forEach(req => {
      if (processed.has(req.id)) return;

      const group = requests.filter(other => {
        if (other.id === req.id) return false;
        
        // Match on same journal ID or same journal URL or same print/online ISSN (if set)
        const sameJournal = req.journalId && other.journalId && req.journalId === other.journalId;
        const sameUrl = req.journalUrl && other.journalUrl && req.journalUrl.toLowerCase().trim() === other.journalUrl.toLowerCase().trim();
        const samePrintIssn = req.printIssn && other.printIssn && req.printIssn.trim() === other.printIssn.trim();
        const sameOnlineIssn = req.onlineIssn && other.onlineIssn && req.onlineIssn.trim() === other.onlineIssn.trim();

        return sameJournal || sameUrl || samePrintIssn || sameOnlineIssn;
      });

      if (group.length > 0) {
        const fullGroup = [req, ...group];
        fullGroup.forEach(item => processed.add(item.id));
        groups.push(fullGroup);
      }
    });

    setDuplicates(groups);
    setIsScanning(false);
    if (groups.length === 0) {
      toast.success("No duplicate ISSN requests found.");
    } else {
      toast.error(`Found ${groups.length} groups of potential duplicate ISSN requests.`);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as GlobalSettings;
          const sanitizedData: GlobalSettings = {
            ...data,
            expenseHeads: Array.isArray(data.expenseHeads) ? data.expenseHeads : [],
            journalCategories: Array.isArray(data.journalCategories) ? data.journalCategories : [],
            issnTypes: Array.isArray(data.issnTypes) ? data.issnTypes : [],
            issnSubjects: Array.isArray(data.issnSubjects) ? data.issnSubjects : [],
            frequencies: Array.isArray(data.frequencies) ? data.frequencies : [],
            departments: Array.isArray(data.departments) ? data.departments : [],
            modes: Array.isArray(data.modes) ? data.modes : [],
            journalScopes: Array.isArray(data.journalScopes) ? data.journalScopes : [],
            officeSubscriptions: Array.isArray(data.officeSubscriptions) ? data.officeSubscriptions : []
          };
          setGlobalSettings(sanitizedData);
          setNewRequest(prev => ({
            ...prev,
            requestType: prev.requestType || sanitizedData.issnTypes?.[0] || 'Assignment',
            frequency: prev.frequency || sanitizedData.frequencies?.[0] || 'Monthly',
            subject: prev.subject || sanitizedData.issnSubjects?.[0] || 'Pluridisciplinary'
          }));
        }
      });
      return unsubscribeSettings;
    };
    const unsubSettings = fetchSettings();

    const q = query(collection(db, 'issn_requests'), orderBy('createdAt', 'desc'));
    const unsubscribeRequests = onSnapshot(q, (snapshot) => {
      const requestData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ISSNRequest[];
      setRequests(requestData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issn_requests');
    });

    const unsubscribeClients = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'Client')), 
      (snapshot) => {
        const clientData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Client[];
        setClients(clientData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    const unsubscribeJournals = onSnapshot(
      collection(db, 'journals'), 
      (snapshot) => {
        const journalData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Journal[];
        setJournals(journalData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'journals')
    );

    const unsubscribePublishers = onSnapshot(
      collection(db, 'publishers'), 
      (snapshot) => {
        const publisherData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Publisher[];
        setPublishers(publisherData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'publishers')
    );

    const unsubscribeDomains = onSnapshot(
      collection(db, 'domains'), 
      (snapshot) => {
        const domainData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
        setDomains(domainData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'domains')
    );

    return () => {
      unsubscribeRequests();
      unsubscribeClients();
      unsubscribeJournals();
      unsubscribePublishers();
      unsubscribeDomains();
    };
  }, []);

  useEffect(() => {
    if (journalId && journals.length > 0) {
      const j = journals.find(x => x.id === journalId);
      if (j) {
        setNewRequest(prev => ({
          ...prev,
          journalId: j.id,
          clientId: j.clientId,
          journalUrl: j.url || '',
          publisherName: publishers.find(p => p.id === j.publisherId)?.name || '',
          existingPrintIssn: j.issnPrint || '',
          existingOnlineIssn: j.issnOnline || ''
        }));
      }
    }
  }, [journalId, journals, publishers]);

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.issn`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [localSearchQuery, statusFilter, typeFilter, clientFilter, publisherFilter, searchQuery]);

  const handleCopyUsername = (e: React.MouseEvent, username: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(username);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const combinedSearchQuery = localSearchQuery || searchQuery;

  const filteredRequests = requests.filter(req => {
    if (journalId && req.journalId !== journalId) return false;
    const client = clients.find(c => c.id === req.clientId);
    const journal = journals.find(j => j.id === req.journalId);
    
    // 1. Search Query
    const matchesSearch = !combinedSearchQuery ? true : (
      journal?.title?.toLowerCase().includes(combinedSearchQuery.toLowerCase()) ||
      client?.name?.toLowerCase().includes(combinedSearchQuery.toLowerCase()) ||
      req.requestNo?.toLowerCase().includes(combinedSearchQuery.toLowerCase()) ||
      req.publisherName?.toLowerCase().includes(combinedSearchQuery.toLowerCase()) ||
      req.contactName?.toLowerCase().includes(combinedSearchQuery.toLowerCase()) ||
      req.printIssn?.toLowerCase().includes(combinedSearchQuery.toLowerCase()) ||
      req.onlineIssn?.toLowerCase().includes(combinedSearchQuery.toLowerCase()) ||
      req.emailAddress?.toLowerCase().includes(combinedSearchQuery.toLowerCase())
    );

    // 2. Status filter
    const matchesStatus = !statusFilter ? true : req.status === statusFilter;

    // 3. Type filter
    const matchesType = !typeFilter ? true : req.requestType === typeFilter;

    // 4. Client filter
    const matchesClient = !clientFilter ? true : req.clientId === clientFilter;

    // 5. Publisher filter
    const matchesPublisher = !publisherFilter ? true : req.publisherName === publisherFilter;

    return matchesSearch && matchesStatus && matchesType && matchesClient && matchesPublisher;
  });

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + itemsPerPage);

  const handleNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Uniqueness check for ISSN Request
      const targetJournalId = isAddingNewJournal ? '' : newRequest.journalId;
      const targetJournalTitle = isAddingNewJournal ? customJournalTitle.trim() : (journals.find(j => j.id === newRequest.journalId)?.title || '');

      const sameJournalReq = requests.find(r => {
        const sameId = targetJournalId && r.journalId && r.journalId === targetJournalId;
        const sameTitle = targetJournalTitle && r.journalTitle && r.journalTitle.toLowerCase().trim() === targetJournalTitle.toLowerCase().trim();
        return sameId || sameTitle;
      });

      if (sameJournalReq) {
        toast.error(`An ISSN application already exists for the journal "${targetJournalTitle}"! Duplicate requests are blocked.`);
        setIsSubmitting(false);
        return;
      }

      const client = clients.find(c => c.id === newRequest.clientId);
      
      let finalJournalId = newRequest.journalId;
      let finalJournalTitle = '';

      if (isAddingNewJournal && customJournalTitle.trim()) {
        const journalDocRef = await addDoc(collection(db, 'journals'), {
          title: customJournalTitle.trim(),
          clientId: newRequest.clientId,
          clientName: client?.name || '',
          status: 'pending_issn',
          lifecycleStatus: 'Onboarding',
          lifecycleHistory: [{
            stage: 'Onboarding',
            status: 'Active',
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.name || 'System'
          }],
          createdAt: new Date().toISOString(),
          createdBy: currentUser?.name || 'System',
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.name || 'System'
        });
        finalJournalId = journalDocRef.id;
        finalJournalTitle = customJournalTitle.trim();
      } else {
        finalJournalTitle = journals.find(j => j.id === finalJournalId)?.title || '';
      }

      let finalPublisherName = newRequest.publisherName;
      if (isAddingNewPublisher && customPublisherName.trim()) {
        await addDoc(collection(db, 'publishers'), {
          clientId: newRequest.clientId,
          name: customPublisherName.trim(),
          createdAt: new Date().toISOString()
        });
        finalPublisherName = customPublisherName.trim();
      }
      
      await addDoc(collection(db, 'issn_requests'), {
        ...newRequest,
        journalId: finalJournalId,
        journalTitle: finalJournalTitle,
        publisherName: finalPublisherName,
        journalUrl: sanitizeUrl(newRequest.journalUrl),
        clientName: client?.name,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        isVerified: false
      });
      setIsModalOpen(false);
      setIsAddingNewJournal(false);
      setCustomJournalTitle('');
      setIsAddingNewPublisher(false);
      setCustomPublisherName('');
      setNewRequest({
        clientId: '',
        journalId: '',
        requestNo: '',
        requestType: 'Assignment',
        printIssn: '',
        onlineIssn: '',
        existingPrintIssn: '',
        existingOnlineIssn: '',
        issnLogin: '',
        issnPassword: '',
        issnLoginPassword: '',
        alreadyHaveDetails: false,
        journalUrl: '',
        publisherName: '',
        publisherAddress: '',
        frequency: '',
        contactName: '',
        emailAddress: '',
        paymentAmountPkr: 0,
        sentDate: '',
        modifiedDate: '',
        legacyInvoiceNumber: '',
        language: 'English',
        subject: 'Pluridisciplinary',
        country: 'Pakistan',
        status: 'Not Applied',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'issn_requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyRequest = async (requestId: string) => {
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Manager') return;
    
    try {
      const requestRef = doc(db, 'issn_requests', requestId);
      await updateDoc(requestRef, {
        isVerified: true,
        verifiedBy: currentUser.name,
        verifiedById: currentUser.id,
        verifiedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'issn_requests');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'rejected': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'Not Applied': return 'bg-slate-50 text-slate-700 border-slate-100';
      case 'Payment Pending': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'Draft': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  if (selectedRequest) {
    return <ISSNDetail request={selectedRequest} onBack={() => setSelectedRequest(null)} currentUser={currentUser} />;
  }

  if (viewingJournal) {
    return (
      <JournalDetail 
        journalId={viewingJournal.id} 
        initialEditMode={viewingJournal.editMode}
        onBack={() => setViewingJournal(null)} 
        currentUser={currentUser}
        onNavigateToPublisher={onNavigateToPublisher}
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

  const uniquePublishers = Array.from(new Set(requests.map(r => r.publisherName).filter(Boolean))) as string[];
  const requestTypes = globalSettings?.issnTypes && globalSettings.issnTypes.length > 0
    ? globalSettings.issnTypes
    : ['Assignment', 'Evaluation', 'Revision'];
  const requestStatuses = ['Not Applied', 'pending', 'approved', 'rejected', 'Payment Pending', 'Draft'];

  return (
    <div className={cn(journalId ? "p-0 space-y-4" : "p-8 space-y-6")}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        {journalId ? (
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">ISSN Requests ({filteredRequests.length})</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Manage applications for this journal</p>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">ISSN Requests</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Manage and track ISSN applications for client journals.</p>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          {currentUser.role !== 'Client' && (
            <div className="flex items-center gap-2 flex-wrap">
              {currentUser.role === 'Admin' && !journalId && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsSubjectConfigOpen(true)}
                    className="p-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm cursor-pointer"
                    title="Configure ISSN Subjects"
                  >
                    <Settings2 size={20} />
                  </button>
                  <button 
                    onClick={() => setIsFrequencyConfigOpen(true)}
                    className="p-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm cursor-pointer"
                    title="Configure Frequencies"
                  >
                    <Settings size={20} />
                  </button>
                </div>
              )}
              {check('issnRequests', 'add') && (
                <>
                  <button 
                    onClick={scanForDuplicates}
                    disabled={isScanning}
                    className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 px-4 py-2.5 rounded-xl font-semibold transition-all shadow-sm cursor-pointer"
                  >
                    {isScanning ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Scan Duplicates
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                  >
                    <Plus size={20} />
                    New Request
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {duplicates.length > 0 && (
        <div className="mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle size={20} />
                <h4 className="font-bold">Potential Duplicate ISSN Requests Found ({duplicates.length} groups)</h4>
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
                    {group.map((req, dIdx) => (
                      <div key={`${req.id}-${dIdx}`} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                        <div className="truncate mr-2">
                          <p className="font-bold text-slate-700 truncate">{req.journalTitle}</p>
                          <p className="text-[10px] text-slate-500 truncate">{req.requestType} • {req.status}</p>
                        </div>
                        <button 
                          onClick={() => setSelectedRequest(req)}
                          className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md font-bold hover:bg-indigo-100 transition-all text-[10px]"
                        >
                          View/Edit
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

      {hasScanned && duplicates.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 size={20} />
            <h4 className="font-bold text-sm text-emerald-700">Scan Complete: No duplicate ISSN requests found.</h4>
          </div>
          <button 
            onClick={() => setHasScanned(false)}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Summary Stats */}
      {!journalId && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Requests</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{requests.length}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Hash size={24} />
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Approved</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{requests.filter(r => r.status === 'approved').length}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Rejected</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{requests.filter(r => r.status === 'rejected').length}</p>
            </div>
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <XCircle size={24} />
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Pending</p>
              <p className="text-2xl font-black text-amber-600 mt-1">{requests.filter(r => r.status === 'pending').length}</p>
            </div>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Clock size={24} />
            </div>
          </motion.div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/55 p-3.5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative group w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search by title, ISSN, or client..."
              className="pl-9 pr-4 py-2 w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={localSearchQuery || ''}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-sm min-w-[140px]">
            <Filter size={12} className="text-slate-400" />
            <select 
              className="text-xs font-bold text-slate-600 outline-none bg-transparent w-full cursor-pointer"
              value={statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {requestStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-sm min-w-[130px]">
            <Tag size={12} className="text-slate-400" />
            <select 
              className="text-xs font-bold text-slate-600 outline-none bg-transparent w-full cursor-pointer"
              value={typeFilter || ''}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {requestTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-sm min-w-[140px]">
            <UserIcon size={12} className="text-slate-400" />
            <select 
              className="text-xs font-bold text-slate-600 outline-none bg-transparent w-full cursor-pointer"
              value={clientFilter || ''}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-sm min-w-[150px]">
            <Building2 size={12} className="text-slate-400" />
            <select 
              className="text-xs font-bold text-slate-600 outline-none bg-transparent w-full cursor-pointer"
              value={publisherFilter || ''}
              onChange={(e) => setPublisherFilter(e.target.value)}
            >
              <option value="">All Publishers</option>
              {uniquePublishers.map(pubName => (
                <option key={pubName} value={pubName}>{pubName}</option>
              ))}
            </select>
          </div>

          {(localSearchQuery || statusFilter || typeFilter || clientFilter || publisherFilter) && (
            <button 
              onClick={() => {
                setLocalSearchQuery('');
                setStatusFilter('');
                setTypeFilter('');
                setClientFilter('');
                setPublisherFilter('');
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-all ml-2"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Loading requests...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                  {selectedColumns.includes('requestNo') && <th className="px-6 py-4">Request No</th>}
                  {selectedColumns.includes('journal') && <th className="px-6 py-4">Journal</th>}
                  {selectedColumns.includes('client') && <th className="px-6 py-4">Client</th>}
                  {selectedColumns.includes('type') && <th className="px-6 py-4">Type</th>}
                  {selectedColumns.includes('status') && <th className="px-6 py-4">Status</th>}
                  {selectedColumns.includes('publisher') && <th className="px-6 py-4">Publisher Name</th>}
                  {selectedColumns.includes('publisherAddress') && <th className="px-6 py-4">Publisher Address</th>}
                  {selectedColumns.includes('payment') && <th className="px-6 py-4">Payment</th>}
                  {selectedColumns.includes('sentDate') && <th className="px-6 py-4">Sent Date</th>}
                  {selectedColumns.includes('modifiedDate') && <th className="px-6 py-4">Modified Date</th>}
                  {selectedColumns.includes('frequency') && <th className="px-6 py-4">Frequency</th>}
                  {selectedColumns.includes('contact') && <th className="px-6 py-4">Contact Name</th>}
                  {selectedColumns.includes('email') && <th className="px-6 py-4">Email</th>}
                  {selectedColumns.includes('pIssn') && <th className="px-6 py-4">P-ISSN</th>}
                  {selectedColumns.includes('eIssn') && <th className="px-6 py-4">E-ISSN</th>}
                  {selectedColumns.includes('login') && <th className="px-6 py-4">ISSN Login</th>}
                  {selectedColumns.includes('password') && <th className="px-6 py-4">ISSN Password</th>}
                  {selectedColumns.includes('alreadyHaveDetails') && <th className="px-6 py-4">Already Entered</th>}
                  {selectedColumns.includes('existingPrintIssn') && <th className="px-6 py-4">Existing P-ISSN</th>}
                  {selectedColumns.includes('existingOnlineIssn') && <th className="px-6 py-4">Existing E-ISSN</th>}
                  {selectedColumns.includes('issnLoginPassword') && <th className="px-6 py-4">Portal Pwd</th>}
                  {selectedColumns.includes('legacyInvoiceNumber') && <th className="px-6 py-4">Invoice #</th>}
                  {selectedColumns.includes('journalUrl') && <th className="px-6 py-4">Journal URL</th>}
                  {selectedColumns.includes('createdAt') && <th className="px-6 py-4">Created At</th>}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {paginatedRequests.map((req) => (
                    <motion.tr 
                      layout
                      key={req.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedRequest(req)}
                      className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                    >
                      {selectedColumns.includes('requestNo') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                              <FileCheck size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-sm text-slate-900">{req.requestNo}</p>
                              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">ISSN APP</p>
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('journal') && (
                        <td className="px-6 py-4">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const journal = journals.find(j => j.id === req.journalId);
                              if (journal) setViewingJournal({ id: journal.id, editMode: false });
                            }}
                            className="font-bold text-sm text-slate-900 hover:text-indigo-600 hover:underline text-left"
                          >
                            {journals.find(j => j.id === req.journalId)?.title || 'Unknown Journal'}
                          </button>
                          <p className="text-[10px] text-slate-400 font-mono">{req.journalId}</p>
                        </td>
                      )}
                      {selectedColumns.includes('client') && (
                        <td className="px-6 py-4">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const client = clients.find(c => c.id === req.clientId);
                              if (client) setViewingClient(client);
                            }}
                            className="text-sm font-medium text-slate-700 hover:text-indigo-600 hover:underline text-left"
                          >
                            {clients.find(c => c.id === req.clientId)?.name || 'Unknown Client'}
                          </button>
                        </td>
                      )}
                      {selectedColumns.includes('type') && (
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                            {req.requestType}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('status') && (
                        <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                        getStatusColor(req.status)
                      )}>
                        {req.status === 'approved' ? <CheckCircle2 size={14} /> : (req.status === 'pending' || req.status === 'Payment Pending') ? <Clock size={14} /> : <XCircle size={14} />}
                        {req.status}
                      </span>
                        </td>
                      )}
                      {selectedColumns.includes('publisher') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-700">{req.publisherName || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('publisherAddress') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600 truncate max-w-[150px]">{req.publisherAddress || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('payment') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-emerald-600">PKR {req.paymentAmountPkr?.toLocaleString()}</p>
                        </td>
                      )}
                      {selectedColumns.includes('sentDate') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{req.sentDate || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('modifiedDate') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{req.modifiedDate || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('frequency') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{req.frequency || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('contact') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{req.contactName || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('email') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{req.emailAddress || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('pIssn') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono font-bold text-slate-900">{req.printIssn || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('eIssn') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono font-bold text-slate-900">{req.onlineIssn || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('login') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono text-slate-600">{req.issnLogin || 'N/A'}</p>
                            {req.issnLogin && req.issnLogin !== 'N/A' && (
                              <button
                                onClick={(e) => handleCopyUsername(e, req.issnLogin || '', req.id)}
                                className={cn(
                                  "p-1 rounded-md hover:bg-slate-100 transition-all",
                                  copiedId === req.id ? "text-emerald-600" : "text-slate-400 hover:text-indigo-600"
                                )}
                                title="Copy Username"
                              >
                                {copiedId === req.id ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('password') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono text-slate-600">••••••••</p>
                        </td>
                      )}
                      {selectedColumns.includes('alreadyHaveDetails') && (
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 text-xs font-bold rounded-lg",
                            req.alreadyHaveDetails ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-600"
                          )}>
                            {req.alreadyHaveDetails ? 'Yes' : 'No'}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('existingPrintIssn') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono text-slate-600">{req.existingPrintIssn || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('existingOnlineIssn') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono text-slate-600">{req.existingOnlineIssn || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('issnLoginPassword') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono text-slate-600">{req.issnLoginPassword ? '••••••••' : 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('legacyInvoiceNumber') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono text-slate-600">{req.legacyInvoiceNumber || '—'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('journalUrl') && (
                        <td className="px-6 py-4">
                          {req.journalUrl ? (
                            <a href={req.journalUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">
                              {req.journalUrl}
                            </a>
                          ) : '—'}
                        </td>
                      )}
                      {selectedColumns.includes('createdAt') && (
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              window.print();
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Print Row"
                          >
                            <Printer size={16} />
                          </button>
                          {currentUser.role === 'Admin' && (
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm('Are you sure you want to delete this request?')) return;
                                try {
                                  await moveToTrash('issn_requests', req.id, req, currentUser.name);
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.DELETE, 'issn_requests');
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Request"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequest(req);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Details"
                          >
                            <FileText size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequest(req);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="More Options"
                          >
                            <MoreHorizontal size={16} />
                          </button>
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
        {!loading && filteredRequests.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-slate-500">
                Showing <span className="text-slate-900">{startIndex + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, filteredRequests.length)}</span> of <span className="text-slate-900">{filteredRequests.length}</span> requests
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Show:</span>
                <select 
                  className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={itemsPerPage || ''}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
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
        title="Add New ISSN Detail"
        maxWidth="4xl"
      >
        <form onSubmit={handleNewRequest} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Basic Information</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">ISSN Request #</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="ISSN-REQ-XXX"
                    value={newRequest.requestNo || ''}
                    onChange={e => setNewRequest(prev => ({ ...prev, requestNo: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Select Client</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newRequest.clientId || ''}
                    onChange={e => setNewRequest(prev => ({ ...prev, clientId: e.target.value, journalId: '' }))}
                  >
                    <option value="">Choose a client...</option>
                    {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                 <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 font-sans">Select Journal</label>
                  <select 
                    required
                    disabled={!newRequest.clientId}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50 text-sm font-medium"
                    value={isAddingNewJournal ? 'add_new_journal_option' : newRequest.journalId || ''}
                    onChange={e => {
                      if (e.target.value === 'add_new_journal_option') {
                        setIsAddingNewJournal(true);
                        setCustomJournalTitle('');
                        setNewRequest(prev => ({ ...prev, journalId: '' }));
                      } else {
                        setIsAddingNewJournal(false);
                        const journalId = e.target.value;
                        const journal = journals.find(j => j.id === journalId);
                        const publisher = publishers.find(p => p.id === journal?.publisherId);
                        const domain = domains.find(d => d.id === journal?.domainId);
                        
                        setNewRequest(prev => ({ 
                          ...prev, 
                          journalId,
                          journalUrl: journal?.url || domain?.domainName || prev.journalUrl,
                          publisherName: publisher?.name || prev.publisherName,
                          publisherAddress: publisher?.address || prev.publisherAddress
                        }));
                      }
                    }}
                  >
                    <option value="">Choose a journal...</option>
                    {newRequest.clientId && (
                      <option value="add_new_journal_option" className="font-bold text-indigo-600">+ Add New Journal...</option>
                    )}
                    {journals
                      .filter(j => j.clientId === newRequest.clientId)
                      .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
                      .map(journal => (
                        <option key={journal.id} value={journal.id}>{journal.title}</option>
                      ))}
                  </select>
                  {isAddingNewJournal && (
                    <div className="mt-2 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 shadow-inner space-y-2">
                      <label className="text-xs font-bold text-indigo-700">New Journal Title</label>
                      <input 
                        required
                        type="text"
                        className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                        placeholder="Type new journal title..."
                        value={customJournalTitle || ''}
                        onChange={e => {
                          setCustomJournalTitle(e.target.value);
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          setIsAddingNewJournal(false);
                          setNewRequest(prev => ({ ...prev, journalId: '' }));
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold transition-all"
                      >
                        Cancel New Journal
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Request Type</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.requestType || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, requestType: e.target.value }))}
                    >
                      {globalSettings?.issnTypes?.map(type => (
                        <option key={type} value={type}>{type}</option>
                      )) || (
                        <>
                          <option value="Claim">Claim</option>
                          <option value="Assignment">Assignment</option>
                          <option value="Modification">Modification</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Frequency_ISSN</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.frequency || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, frequency: e.target.value }))}
                    >
                      {globalSettings?.frequencies?.map(freq => (
                        <option key={freq} value={freq}>{freq}</option>
                      )) || (
                        <>
                          <option value="Monthly">Monthly</option>
                          <option value="Quarterly">Quarterly</option>
                          <option value="Bi-Annual">Bi-Annual</option>
                          <option value="Annual">Annual</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Initial Status</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newRequest.status || ''}
                    onChange={e => setNewRequest(prev => ({ ...prev, status: e.target.value as any }))}
                  >
                    <option value="Not Applied">Not Applied</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="Payment Pending">Payment Pending</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">ISSN Details</h4>
              <div className="space-y-4">
                {/* Already Entered Details Only */}
                <div className="flex items-center gap-2 py-1.5 px-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <input 
                    type="checkbox" 
                    id="alreadyHaveDetails"
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={newRequest.alreadyHaveDetails || false}
                    onChange={e => setNewRequest(prev => ({ ...prev, alreadyHaveDetails: e.target.checked }))}
                  />
                  <label htmlFor="alreadyHaveDetails" className="text-sm font-bold text-slate-700 select-none cursor-pointer">
                    Already Entered Details Only
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">P-ISSN</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="XXXX-XXXX"
                      value={newRequest.printIssn || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, printIssn: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">E-ISSN</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="XXXX-XXXX"
                      value={newRequest.onlineIssn || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, onlineIssn: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Existing ISSNs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Existing P-ISSN</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="XXXX-XXXX"
                      value={newRequest.existingPrintIssn || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, existingPrintIssn: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Existing E-ISSN</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="XXXX-XXXX"
                      value={newRequest.existingOnlineIssn || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, existingOnlineIssn: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">ISSN Login</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.issnLogin || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, issnLogin: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">ISSN Password</label>
                    <input 
                      type="password" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.issnPassword || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, issnPassword: e.target.value }))}
                    />
                  </div>
                </div>

                {/* ISSN Login Password Field */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">ISSN Login Password</label>
                  <input 
                    type="password" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Enter portal password..."
                    value={newRequest.issnLoginPassword || ''}
                    onChange={e => setNewRequest(prev => ({ ...prev, issnLoginPassword: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Language</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.language || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, language: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Country</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.country || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Subject Area</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newRequest.subject || ''}
                    onChange={e => setNewRequest(prev => ({ ...prev, subject: e.target.value }))}
                  >
                    {globalSettings?.issnSubjects?.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    )) || (
                      <>
                        <option value="Pluridisciplinary">Pluridisciplinary</option>
                        <option value="Information and documentation, official publications">Information and documentation, official publications</option>
                        <option value="Philosophy, religion and psychology">Philosophy, religion and psychology</option>
                        <option value="Social sciences">Social sciences</option>
                        <option value="Mathematics and natural sciences">Mathematics and natural sciences</option>
                        <option value="Applied sciences, technology and medicine">Applied sciences, technology and medicine</option>
                        <option value="Arts and recreation">Arts and recreation</option>
                        <option value="Language and Literature">Language and Literature</option>
                        <option value="Geography and History">Geography and History</option>
                        <option value="Other, please specify">Other, please specify</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Journal URL / Domain (Type manually or Select)</label>
                  <div className="space-y-2">
                    <input 
                      type="text"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Type URL or choose below..."
                      value={newRequest.journalUrl || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, journalUrl: e.target.value }))}
                    />
                    <select 
                      className="w-full px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] opacity-70 outline-none"
                      value={newRequest.journalUrl || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, journalUrl: e.target.value }))}
                    >
                      <option value="">Quick select from existing...</option>
                      {Array.from(new Set([
                        ...domains.map(d => d.domainName),
                        ...journals.map(j => j.url)
                      ]))
                        .filter(Boolean)
                        .sort()
                        .map(url => (
                          <option key={url} value={url || ''}>{url}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Publisher & Contact</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Name of Publisher (ISSN)</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                    value={isAddingNewPublisher ? 'add_new_pub_option' : newRequest.publisherName || ''}
                    onChange={e => {
                      if (e.target.value === 'add_new_pub_option') {
                        setIsAddingNewPublisher(true);
                        setCustomPublisherName('');
                        setNewRequest(prev => ({ ...prev, publisherName: '' }));
                      } else {
                        setIsAddingNewPublisher(false);
                        setNewRequest(prev => ({ ...prev, publisherName: e.target.value }));
                      }
                    }}
                  >
                    <option value="">Select publisher</option>
                    <option value="add_new_pub_option" className="font-bold text-indigo-600">+ Add New Publisher...</option>
                    {publishers.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(pub => (
                      <option key={pub.id} value={pub.name}>{pub.name}</option>
                    ))}
                  </select>
                  {isAddingNewPublisher && (
                    <div className="mt-2 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 shadow-inner space-y-2">
                      <label className="text-xs font-bold text-indigo-700">New Publisher Name</label>
                      <input 
                        required
                        type="text"
                        className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                        placeholder="Type new publisher name..."
                        value={customPublisherName || ''}
                        onChange={e => {
                          setCustomPublisherName(e.target.value);
                          setNewRequest(prev => ({ ...prev, publisherName: e.target.value }));
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          setIsAddingNewPublisher(false);
                          setNewRequest(prev => ({ ...prev, publisherName: '' }));
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold transition-all"
                      >
                        Cancel New Publisher
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Publisher Address (ISSN)</label>
                  <textarea 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                    rows={2}
                    value={newRequest.publisherAddress || ''}
                    onChange={e => setNewRequest(prev => ({ ...prev, publisherAddress: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Contact name (ISSN)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.contactName || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, contactName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Email Address (ISSN)</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.emailAddress || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, emailAddress: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Financials & Dates</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Payments ISSN (Amount in PKR)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="0.00"
                    value={newRequest.paymentAmountPkr || ''}
                    onChange={e => setNewRequest(prev => ({ ...prev, paymentAmountPkr: Number(e.target.value) }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">ISSN Sent Date</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.sentDate || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, sentDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">ISSN Modified Date</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.modifiedDate || ''}
                      onChange={e => setNewRequest(prev => ({ ...prev, modifiedDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Invoice Number (Legacy)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="INV-ISSN-XXX"
                    value={newRequest.legacyInvoiceNumber || ''}
                    onChange={e => setNewRequest(prev => ({ ...prev, legacyInvoiceNumber: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-slate-100">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Saving...
                </>
              ) : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {isSubjectConfigOpen && (
        <ConfigModal
          isOpen={isSubjectConfigOpen}
          onClose={() => setIsSubjectConfigOpen(false)}
          title="Configure ISSN Subjects"
          fieldName="issnSubjects"
          type="string-list"
          initialItems={globalSettings?.issnSubjects || []}
        />
      )}

      {isFrequencyConfigOpen && (
        <ConfigModal
          isOpen={isFrequencyConfigOpen}
          onClose={() => setIsFrequencyConfigOpen(false)}
          title="Configure Frequencies"
          fieldName="frequencies"
          type="string-list"
          initialItems={globalSettings?.frequencies || []}
        />
      )}
    </div>
  );
};
