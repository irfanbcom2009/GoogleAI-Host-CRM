import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Globe, 
  Shield, 
  Key, 
  User, 
  Calendar, 
  ExternalLink, 
  Copy, 
  Check,
  Settings2,
  BookOpen,
  Edit,
  Trash2,
  AlertTriangle,
  Save,
  X,
  History,
  GraduationCap,
  Plus,
  Clock,
  User as UserIcon,
  Activity,
  DollarSign,
  Database,
  Hash,
  CheckCircle2,
  XCircle,
  UserCheck,
  ChevronRight,
  Mail,
  Users,
  Phone,
  FileText,
  Briefcase,
  Link as LinkIcon,
  Zap,
  LayoutDashboard,
  Server,
  HardDrive,
  Cloud,
  Building2,
  Volume2
} from 'lucide-react';
import { 
  Journal, 
  User as UserType, 
  JournalIndexing, 
  IndexingAgency, 
  Client, 
  Publisher,
  Invoice,
  ServiceType,
  Subscription,
  HECCategory,
  ISSNRequest,
  CatalogItem,
  ClientService,
  ServiceTier
} from '../types';
import { db, handleFirestoreError, OperationType, auth, moveToTrash, getErrorMessage } from '../lib/firebase';
import { doc, updateDoc, onSnapshot, serverTimestamp, collection, query, where, addDoc, orderBy, limit, getDocs, arrayUnion } from 'firebase/firestore';
import { cn, formatDateForInput, generateJournalAbbreviation, generateJournalInitials, getHostname } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService } from '../services/geminiService';
import { ConfigModal } from './ConfigModal';
import { ConfirmModal } from './ConfirmModal';
import { toast } from 'react-hot-toast';
import { checkCoreFieldUniqueness } from '../services/uniquenessService';
import { Sparkles, Loader2, Package } from 'lucide-react';

import { SmartRecommendations } from './SmartRecommendations';
import { recommendationService } from '../services/recommendationService';
import { JournalIndexingManager } from './JournalIndexingManager';
import { generateTasksForService } from '../lib/taskUtils';
import { Modal } from './Modal';
import { SearchableSelect } from './ui/SearchableSelect';
import { FloatingActionBar } from './FloatingActionBar';
import { usePermissions } from '../hooks/usePermissions';
import { CredentialVault } from './CredentialVault';
import { ScholarHistory } from './ScholarHistory';
import { ISSNRequests } from './ISSNRequests';
import { DOIManagement } from './DOIManagement';
import { HEC } from './HEC';
import { DOAJApplications } from './DOAJApplications';

export const ALL_AVAILABLE_TABS = [
  { id: 'issn', label: 'ISSN', icon: Hash, service: 'ISSN' },
  { id: 'doi', label: 'DOI', icon: LinkIcon, service: 'DOI' },
  { id: 'publisher', label: 'Publisher', icon: Briefcase, service: 'Publisher' },
  { id: 'hec', label: 'HEC', icon: Shield, service: 'HEC' },
  { id: 'doaj', label: 'DOAJ', icon: CheckCircle2, service: 'DOAJ' },
  { id: 'ojs', label: 'OJS', icon: Globe, service: 'OJS' },
  { id: 'indexing', label: 'Indexing', icon: Database, service: 'Indexing' },
  { id: 'history', label: 'Scholar', icon: History, service: 'Scholar' },
  { id: 'domain', label: 'Domain', icon: Globe, service: 'Domain' },
  { id: 'hosting', label: 'Hosting', icon: Server, service: 'Hosting' }
];

interface JournalDetailProps {
  journalId: string;
  onBack: () => void;
  currentUser: UserType | null;
  initialEditMode?: boolean;
  onNavigateToPublisher?: (id: string) => void;
}

export const JournalDetail: React.FC<JournalDetailProps> = ({ 
  journalId, 
  onBack, 
  currentUser,
  initialEditMode = false,
  onNavigateToPublisher
}) => {
  const { check, isAdmin, isManager } = usePermissions(currentUser);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Journal>>({});
  const [indexingRecords, setIndexingRecords] = useState<JournalIndexing[]>([]);
  const [agencies, setAgencies] = useState<IndexingAgency[]>([]);
  const [isIndexingModalOpen, setIsIndexingModalOpen] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [scholarHistory, setScholarHistory] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [hecCategories, setHecCategories] = useState<HECCategory[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [newScholarLog, setNewScholarLog] = useState({ status: 'Indexed', tagOptimization: '' });
  const [isScholarModalOpen, setIsScholarModalOpen] = useState(false);
  const [isActivateServiceModalOpen, setIsActivateServiceModalOpen] = useState(false);
  const [serviceToActivate, setServiceToActivate] = useState<ServiceType | ''>('');
  const [activationData, setActivationData] = useState({
    invoiceNumber: '',
    invoiceId: '',
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    subscriptionType: 'annual' as 'one-time' | 'annual' | 'monthly',
    salePrice: 0,
    costPrice: 0
  });

  const journalClient = clients.find(c => c.id === journal?.clientId);
  const recommendations = journalClient && journal 
    ? recommendationService.getRecommendations(journalClient, publishers, domains, [journal], journal.id)
    : [];

  const [isSuggestingKeywords, setIsSuggestingKeywords] = useState(false);
  const [journalIssnRequests, setJournalIssnRequests] = useState<ISSNRequest[]>([]);
  const [isScopeConfigOpen, setIsScopeConfigOpen] = useState(false);
  const [activeServiceTab, setActiveServiceTab] = useState<'issn' | 'doi' | 'publisher' | 'hec' | 'doaj' | 'ojs' | 'indexing' | 'vault' | 'catalog' | 'history' | 'work-history' | 'domain' | 'hosting'>('issn');
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [selectedCsId, setSelectedCsId] = useState<string | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newScopeTag, setNewScopeTag] = useState('');
  const [newBoardMember, setNewBoardMember] = useState('');

  const [isAddTabModalOpen, setIsAddTabModalOpen] = useState(false);
  const [selectedTabToActivate, setSelectedTabToActivate] = useState<string>('');
  const [activationCondition, setActivationCondition] = useState<'subscribed' | 'unsubscribed'>('subscribed');

  const [quickDataModalType, setQuickDataModalType] = useState<'issn' | 'doi' | 'publisher' | 'hec' | 'doaj' | 'ojs' | 'domain' | 'hosting' | null>(null);
  const [quickFormData, setQuickFormData] = useState<any>({});
  const [isSavingQuickData, setIsSavingQuickData] = useState(false);

  const handleOpenQuickDataModal = (tabType: any) => {
    if (!journal) return;
    setQuickDataModalType(tabType);
    if (tabType === 'issn') {
      setQuickFormData({
        issnPrint: journal.issnPrint || '',
        issnOnline: journal.issnOnline || ''
      });
    } else if (tabType === 'doi') {
      setQuickFormData({
        doiPrefix: journal.doiId || '',
        url: journal.url || ''
      });
    } else if (tabType === 'publisher') {
      setQuickFormData({
        publisherId: journal.publisherId || '',
        newPublisherName: '',
        newPublisherCity: '',
        newPublisherCountry: ''
      });
    } else if (tabType === 'hec') {
      setQuickFormData({
        category: journal.hec_details?.category || 'Y',
        recognitionStatus: journal.hec_details?.recognitionStatus || 'Recognized',
        approvalDate: journal.hec_details?.approvalDate || '',
        expiryDate: journal.hec_details?.expiryDate || ''
      });
    } else if (tabType === 'doaj') {
      setQuickFormData({
        inclusionDate: journal.doaj_details?.inclusionDate || '',
        link: journal.doaj_details?.link || '',
        metadataCompliance: journal.doaj_details?.metadataCompliance ?? true
      });
    } else if (tabType === 'ojs') {
      setQuickFormData({
        ojsVersion: journal.ojsVersion || '3.3.0.20',
        url: journal.ojs_details?.url || journal.url || '',
        adminUrl: journal.ojs_details?.adminUrl || '',
        adminUsername: journal.ojs_details?.adminCredentials?.username || '',
        adminPassword: journal.ojs_details?.adminCredentials?.password || '',
        supportStatus: journal.ojs_details?.supportStatus || 'Community Support',
        hostingStatus: journal.ojs_details?.hostingStatus || 'Active',
        phpVersion: journal.ojs_details?.phpVersion || '8.1',
        databaseName: journal.ojs_details?.databaseName || '',
        notes: journal.ojs_details?.notes || ''
      });
    } else if (tabType === 'domain') {
      const existingDomain = domains?.find((d: any) => d.id === journal.domainId);
      setQuickFormData({
        domainId: journal.domainId || '',
        domainName: journal.domain_details?.domainName || existingDomain?.domainName || '',
        registrar: journal.domain_details?.registrar || existingDomain?.registrar || 'Namecheap',
        expirationDate: journal.domain_details?.expirationDate || existingDomain?.expirationDate || '',
        nameservers: journal.domain_details?.nameservers || 'ns1.hosta.com, ns2.hosta.com',
        autoRenew: journal.domain_details?.autoRenew ?? true,
        annualCost: journal.domain_details?.annualCost || 15,
        notes: journal.domain_details?.notes || ''
      });
    } else if (tabType === 'hosting') {
      setQuickFormData({
        provider: journal.hosting_details?.provider || 'Hesta Enterprise Server',
        ipAddress: journal.hosting_details?.ipAddress || '',
        serverSpecs: journal.hosting_details?.serverSpecs || '4 vCPU / 8GB RAM / 100GB NVMe SSD',
        status: journal.hosting_details?.status || 'Running',
        renewalDate: journal.hosting_details?.renewalDate || '',
        annualCost: journal.hosting_details?.annualCost || 120,
        controlPanelUrl: journal.hosting_details?.controlPanelUrl || '',
        notes: journal.hosting_details?.notes || ''
      });
    }
  };

  const handleSaveQuickData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journal || isSavingQuickData) return;
    setIsSavingQuickData(true);

    try {
      const updateObj: any = { updatedAt: serverTimestamp() };

      if (quickDataModalType === 'issn') {
        updateObj.issnPrint = quickFormData.issnPrint || '';
        updateObj.issnOnline = quickFormData.issnOnline || '';
      } else if (quickDataModalType === 'doi') {
        updateObj.doiId = quickFormData.doiPrefix || '';
        if (quickFormData.url) updateObj.url = quickFormData.url;
      } else if (quickDataModalType === 'publisher') {
        if (quickFormData.publisherId) {
          updateObj.publisherId = quickFormData.publisherId;
        } else if (quickFormData.newPublisherName) {
          const newPubRef = await addDoc(collection(db, 'publishers'), {
            clientId: journal.clientId,
            name: quickFormData.newPublisherName,
            city: quickFormData.newPublisherCity || '',
            country: quickFormData.newPublisherCountry || '',
            ownerName: journal.clientName || 'Client Owner',
            secpRegistration: 'Pending',
            ntn: 'N/A',
            documents: {},
            createdAt: new Date().toISOString()
          });
          updateObj.publisherId = newPubRef.id;
        }
      } else if (quickDataModalType === 'hec') {
        updateObj.hec_details = {
          category: quickFormData.category,
          recognitionStatus: quickFormData.recognitionStatus,
          approvalDate: quickFormData.approvalDate,
          expiryDate: quickFormData.expiryDate,
          documents: journal.hec_details?.documents || []
        };
      } else if (quickDataModalType === 'doaj') {
        updateObj.doaj_details = {
          inclusionDate: quickFormData.inclusionDate,
          link: quickFormData.link,
          metadataCompliance: quickFormData.metadataCompliance
        };
      } else if (quickDataModalType === 'ojs') {
        updateObj.ojsVersion = quickFormData.ojsVersion;
        if (quickFormData.url) updateObj.url = quickFormData.url;
        updateObj.ojs_details = {
          url: quickFormData.url,
          adminUrl: quickFormData.adminUrl,
          version: quickFormData.ojsVersion,
          hostingStatus: quickFormData.hostingStatus,
          supportStatus: quickFormData.supportStatus,
          phpVersion: quickFormData.phpVersion,
          databaseName: quickFormData.databaseName,
          notes: quickFormData.notes,
          adminCredentials: {
            username: quickFormData.adminUsername,
            password: quickFormData.adminPassword
          }
        };
      } else if (quickDataModalType === 'domain') {
        if (quickFormData.domainId) {
          updateObj.domainId = quickFormData.domainId;
        }
        updateObj.domain_details = {
          domainName: quickFormData.domainName,
          registrar: quickFormData.registrar,
          expirationDate: quickFormData.expirationDate,
          nameservers: quickFormData.nameservers,
          autoRenew: quickFormData.autoRenew,
          annualCost: Number(quickFormData.annualCost) || 0,
          notes: quickFormData.notes
        };
      } else if (quickDataModalType === 'hosting') {
        updateObj.hosting_details = {
          provider: quickFormData.provider,
          ipAddress: quickFormData.ipAddress,
          serverSpecs: quickFormData.serverSpecs,
          status: quickFormData.status,
          renewalDate: quickFormData.renewalDate,
          annualCost: Number(quickFormData.annualCost) || 0,
          controlPanelUrl: quickFormData.controlPanelUrl,
          notes: quickFormData.notes
        };
      }

      await updateDoc(doc(db, 'journals', journal.id), updateObj);
      toast.success(`Data saved successfully`);
      setQuickDataModalType(null);
    } catch (err) {
      console.error("Error saving tab data:", err);
      toast.error("Failed to save tab data");
    } finally {
      setIsSavingQuickData(false);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCsId || !newChecklistItem.trim()) return;

    try {
      const cs = journalClientServices.find(c => c.id === selectedCsId);
      if (!cs) return;

      const newItemId = crypto.randomUUID();
      const updatedChecklist = {
        ...(cs.clientChecklistProgress || {}),
        [newItemId]: {
          label: newChecklistItem,
          status: 'pending',
          type: 'text',
          createdAt: new Date().toISOString()
        }
      };

      await updateDoc(doc(db, 'client_services', selectedCsId), {
        clientChecklistProgress: updatedChecklist,
        updatedAt: serverTimestamp()
      });

      toast.success('Checklist item added');
      setNewChecklistItem('');
      setIsChecklistModalOpen(false);
    } catch (error) {
      toast.error('Failed to add item');
      console.error(error);
    }
  };

  const toggleChecklistItem = async (csId: string, itemId: string, currentStatus: string) => {
    try {
      const cs = journalClientServices.find(c => c.id === csId);
      if (!cs) return;

      const updatedChecklist = {
        ...cs.clientChecklistProgress,
        [itemId]: {
          ...cs.clientChecklistProgress[itemId],
          status: currentStatus === 'completed' ? 'pending' : 'completed',
          updatedAt: new Date().toISOString()
        }
      };

      await updateDoc(doc(db, 'client_services', csId), {
        clientChecklistProgress: updatedChecklist,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleAddActiveTab = async (tabId: string, condition: 'subscribed' | 'unsubscribed') => {
    if (!journal) return;
    const tabInfo = ALL_AVAILABLE_TABS.find(t => t.id === tabId);
    if (!tabInfo) return;

    try {
      const currentActive = journal.active_tabs || [];
      if (!currentActive.includes(tabId)) {
        const updatedActive = [...currentActive, tabId];
        await updateDoc(doc(db, 'journals', journal.id), {
          active_tabs: updatedActive,
          updatedAt: serverTimestamp()
        });
        toast.success(`Tab "${tabInfo.label}" added successfully`);
      }

      // Handle subscription status condition:
      if (condition === 'subscribed') {
        // Activate subscription
        await handleToggleSubscription(tabInfo.service, true);
      } else {
        // Activate without subscription (disable subscription)
        await handleToggleSubscription(tabInfo.service, false);
      }
      setIsAddTabModalOpen(false);
      setSelectedTabToActivate('');
    } catch (err) {
      console.error("Error activating tab:", err);
      toast.error("Failed to activate service tab");
    }
  };

  const handleRemoveActiveTab = async (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!journal) return;
    const tabInfo = ALL_AVAILABLE_TABS.find(t => t.id === tabId);
    const label = tabInfo?.label || tabId;

    try {
      const currentActive = journal.active_tabs || [];
      const updatedActive = currentActive.filter(id => id !== tabId);
      
      await updateDoc(doc(db, 'journals', journal.id), {
        active_tabs: updatedActive,
        updatedAt: serverTimestamp()
      });

      if (activeServiceTab === tabId) {
        if (updatedActive.length > 0) {
          setActiveServiceTab(updatedActive[0] as any);
        } else {
          setActiveServiceTab('' as any);
        }
      }

      toast.success(`Tab "${label}" hidden`);
    } catch (err) {
      console.error("Error hiding tab:", err);
      toast.error("Failed to hide tab");
    }
  };

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [journalTasks, setJournalTasks] = useState<any[]>([]);
  const [journalClientServices, setJournalClientServices] = useState<ClientService[]>([]);

  useEffect(() => {
    const activeTabs = journal?.active_tabs || [];
    const visibleServiceTabs = ALL_AVAILABLE_TABS.filter(tab => activeTabs.includes(tab.id));

    if (visibleServiceTabs.length > 0 && !visibleServiceTabs.some(t => t.id === activeServiceTab)) {
      setActiveServiceTab(visibleServiceTabs[0].id as any);
    } else if (visibleServiceTabs.length === 0) {
      setActiveServiceTab('' as any);
    }
  }, [journal?.active_tabs]);

  useEffect(() => {
    if (!journalId) return;

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('journalId', '==', journalId), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setJournalTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubClientServices = onSnapshot(
      query(collection(db, 'client_services'), where('journalId', '==', journalId), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setJournalClientServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ClientService));
      }
    );

    return () => {
      unsubTasks();
      unsubClientServices();
    };
  }, [journalId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing) return;
      
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        setIsEditing(false);
        setEditData(journal || {});
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, editData, journal]);

  useEffect(() => {
    if (isEditing) {
      const firstInput = document.querySelector('input, select, textarea');
      if (firstInput) {
        (firstInput as HTMLElement).focus();
        firstInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isEditing]);

  const handleActivateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalClient || !serviceToActivate || !journal || isSaving) return;

    setIsSaving(true);
    try {
      const newSubscription: Subscription = {
        service: serviceToActivate as ServiceType,
        startDate: activationData.startDate,
        expiryDate: activationData.expiryDate,
        status: 'active',
        invoiceNumber: activationData.invoiceNumber,
        invoiceId: activationData.invoiceId,
        subscriptionType: activationData.subscriptionType
      };

      const updatedSubscriptions = [...(journalClient.subscriptions || []), newSubscription];
      
      // Update journal's subscribed_services
      const currentSubscribedServices = journal.subscribed_services || [];
      const updatedSubscribedServices = [...new Set([...currentSubscribedServices, serviceToActivate])];

      await updateDoc(doc(db, 'users', journalClient.id), {
        subscriptions: updatedSubscriptions
      });

      await updateDoc(doc(db, 'journals', journal.id), {
        subscribed_services: updatedSubscribedServices
      });

      // Handle Invoice Line Item
      if (activationData.invoiceId) {
        const invoiceRef = doc(db, 'invoices', activationData.invoiceId);
        const invoice = invoices.find(i => i.id === activationData.invoiceId);
        if (invoice) {
          const newItem = {
            id: crypto.randomUUID(),
            description: `${serviceToActivate} Subscription for ${journal.title}`,
            amount: serviceToActivate === 'Publisher' ? activationData.salePrice : 0,
            quantity: 1,
            journalId: journal.id,
            serviceType: serviceToActivate
          };
          await updateDoc(invoiceRef, {
            items: [...(invoice.items || []), newItem],
            total: invoice.total + newItem.amount,
            balance: (invoice.balance || 0) + newItem.amount,
            updatedAt: serverTimestamp()
          });
        }
      }

      // Handle Publisher Cost Price (Expense to Unpaid Lawyer)
      if (serviceToActivate === 'Publisher' && activationData.costPrice > 0) {
        await addDoc(collection(db, 'expenses'), {
          head: 'Unpaid Lawyer',
          date: new Date().toISOString().split('T')[0],
          amount: activationData.costPrice,
          currency: 'PKR',
          amountPKR: activationData.costPrice,
          amountUSD: activationData.costPrice / (globalSettings?.usdPkrRate || 280),
          usdPkrRate: globalSettings?.usdPkrRate || 280,
          notes: `Cost for Publisher registration for ${journal.title} (Client: ${journalClient.name})`,
          createdAt: serverTimestamp(),
          createdById: currentUser.id,
          createdBy: currentUser.name,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name
        });
      }

      // Generate tasks for the service
      await generateTasksForService(journalClient.id, journalClient.name, serviceToActivate as ServiceType, journal.id);

      setIsActivateServiceModalOpen(false);
      setServiceToActivate('');
      setActivationData({
        invoiceNumber: '',
        invoiceId: '',
        startDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subscriptionType: 'annual',
        salePrice: 0,
        costPrice: 0
      });
      toast.success(`${serviceToActivate} activated successfully`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsSaving(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteJournal = async () => {
    if (!journal) return;
    
    const loadingToast = toast.loading(`Moving "${journal.title}" to trash...`);
    try {
      await moveToTrash('journals', journal.id, journal, currentUser?.name || 'Admin');
      toast.success(`"${journal.title}" moved to trash.`, { id: loadingToast });
      onBack();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  useEffect(() => {
    setIsEditing(initialEditMode);
  }, [initialEditMode]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'journals', journalId), (doc) => {
      if (doc.exists()) {
        const data = { id: doc.id, ...doc.data() } as Journal;
        setJournal(data);
        // Initialize editData on first load or when not editing
        setEditData(prev => {
          if (Object.keys(prev).length === 0 || !isEditing) {
            return data;
          }
          return prev;
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'journals');
      setLoading(false);
    });

    const unsubIndexing = onSnapshot(
      query(collection(db, 'journal_indexing'), where('journalId', '==', journalId)), 
      (snapshot) => {
        setIndexingRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalIndexing)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'journal_indexing')
    );

    const unsubAgencies = onSnapshot(
      collection(db, 'indexing_agencies'), 
      (snapshot) => {
        setAgencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IndexingAgency)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'indexing_agencies')
    );

    const unsubActivities = onSnapshot(
      query(collection(db, 'journal_activities'), where('journalId', '==', journalId), orderBy('timestamp', 'desc'), limit(20)),
      (snapshot) => {
        setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'journal_activities')
    );

    const unsubScholar = onSnapshot(
      query(collection(db, 'google_scholar_history'), where('journalId', '==', journalId), orderBy('timestamp', 'desc')),
      (snapshot) => {
        setScholarHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'google_scholar_history')
    );

    const unsubIssnRequests = onSnapshot(
      query(collection(db, 'issn_requests'), where('journalId', '==', journalId), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setJournalIssnRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ISSNRequest)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'issn_requests')
    );

    const unsubInvoices = onSnapshot(
      query(collection(db, 'invoices'), where('journalId', '==', journalId)),
      (snapshot) => {
        setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
      }
    );

    const unsubEmployees = onSnapshot(
      query(collection(db, 'users'), where('role', 'in', ['Admin', 'Manager', 'Employee']), where('status', '==', 'active')),
      (snapshot) => {
        setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserType)));
      }
    );

    const unsubClients = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'Client'), where('status', '==', 'active')),
      (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      }
    );

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setGlobalSettings(doc.data());
      }
    });

    return () => {
      unsub();
      unsubIndexing();
      unsubAgencies();
      unsubActivities();
      unsubScholar();
      unsubIssnRequests();
      unsubEmployees();
      unsubClients();
      unsubSettings();
    };
  }, [journalId]);

  useEffect(() => {
    if (!journal?.clientId) return;

    const unsubDomains = onSnapshot(
      query(collection(db, 'domains'), where('clientId', '==', journal.clientId), where('status', '==', 'active')),
      (snapshot) => {
        setDomains(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubPublishers = onSnapshot(
      query(collection(db, 'publishers'), where('clientId', '==', journal.clientId)),
      (snapshot) => {
        setPublishers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Publisher)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'publishers')
    );

    const unsubHec = onSnapshot(
      query(collection(db, 'hec_categories'), where('isActive', '==', true)),
      (snapshot) => {
        setHecCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HECCategory)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'hec_categories')
    );

    const unsubCatalog = onSnapshot(
      query(collection(db, 'catalog'), where('isActive', '==', true)),
      (snapshot) => {
        setCatalogItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CatalogItem)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'catalog')
    );

    return () => {
      unsubDomains();
      unsubPublishers();
      unsubHec();
      unsubCatalog();
    };
  }, [journal?.clientId]);

  useEffect(() => {
    if (!journalId || !isEditing) return;

    // Fetch latest ISSN Request for this journal to auto-fill metadata
    const unsubIssn = onSnapshot(
      query(collection(db, 'issn_requests'), where('journalId', '==', journalId), orderBy('createdAt', 'desc'), limit(1)),
      (snapshot) => {
        if (!snapshot.empty) {
          const issnData = snapshot.docs[0].data();
          setEditData(prev => ({
            ...prev,
            issnPrint: prev.issnPrint || issnData.printIssn || '',
            issnOnline: prev.issnOnline || issnData.onlineIssn || '',
            languages: prev.languages || issnData.language || '',
            publisherCountry: prev.publisherCountry || issnData.country || ''
          }));
        }
      }
    );

    // Fetch latest Invoice for this journal to auto-fill invoice number
    const unsubInvoice = onSnapshot(
      query(collection(db, 'invoices'), where('journalId', '==', journalId), orderBy('createdAt', 'desc'), limit(1)),
      (snapshot) => {
        if (!snapshot.empty) {
          const invoiceData = snapshot.docs[0].data();
          setEditData(prev => ({
            ...prev,
            invoiceNumber: prev.invoiceNumber || invoiceData.invoiceNumber || ''
          }));
        }
      }
    );

    return () => {
      unsubIssn();
      unsubInvoice();
    };
  }, [journalId, isEditing]);

  const logActivity = async (action: string) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'journal_activities'), {
        journalId,
        employeeName: currentUser.name,
        action,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const handleAddScholarLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || isSaving) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'google_scholar_history'), {
        journalId,
        ...newScholarLog,
        employeeName: currentUser.name,
        timestamp: serverTimestamp()
      });
      setIsScholarModalOpen(false);
      setNewScholarLog({ status: 'Indexed', tagOptimization: '' });
      logActivity(`Updated Google Scholar History: ${newScholarLog.status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'google_scholar_history');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuggestKeywords = async () => {
    if (!journal?.title) return;
    setIsSuggestingKeywords(true);
    try {
      const prompt = `Suggest 5-8 relevant academic keywords/scopes for a journal titled "${journal.title}". Return ONLY a comma-separated list of keywords.`;
      const result = await geminiService.generateText(prompt);
      const suggested = result.split(',').map(s => s.trim()).filter(Boolean);
      
      const currentScope = Array.isArray(editData.scope) ? editData.scope : [];
      const newScope = [...new Set([...currentScope, ...suggested])];
      setEditData({ ...editData, scope: newScope });
      toast.success('Keywords suggested by AI');
    } catch (error) {
      console.error('Error suggesting keywords:', error);
      toast.error('Failed to suggest keywords');
    } finally {
      setIsSuggestingKeywords(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleToggleSubscription = async (serviceName: string, isEnabling: boolean) => {
    if (!journal || isSaving) return;
    
    setIsSaving(true);
    try {
      const updatedServices = isEnabling 
        ? [...(journal.subscribed_services || []), serviceName]
        : (journal.subscribed_services || []).filter(s => s !== serviceName);

      const updates: any = {
        subscribed_services: updatedServices,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.name,
        is_subscribed_with_us: updatedServices.length > 0
      };

      if (isEnabling) {
        // Find matching catalog item
        const catalogItem = catalogItems.find(item => 
          item.name.toLowerCase().includes(serviceName.toLowerCase()) ||
          serviceName.toLowerCase().includes(item.name.toLowerCase())
        );

        let clientServiceId = '';
        if (catalogItem) {
          // Create Client Service (Assignment Layer)
          const clientServiceData = {
            clientId: journal.clientId,
            clientName: journal.clientName || 'Valued Client',
            serviceId: catalogItem.id,
            serviceName: catalogItem.name,
            tierId: catalogItem.pricingTiers?.[0]?.priority?.toLowerCase() || 'standard',
            tierName: catalogItem.pricingTiers?.[0]?.priority || 'Standard',
            status: 'Pending',
            journalId: journal.id,
            journalTitle: journal.title,
            progress: 0,
            isActivated: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdById: currentUser?.id,
            createdBy: currentUser?.name
          };
          const csRef = await addDoc(collection(db, 'client_services'), clientServiceData);
          clientServiceId = csRef.id;
        }

        // Create Draft Invoice
        const invoiceNumber = `INV-AUTO-${Date.now().toString().slice(-6)}`;
        const issueDate = new Date().toISOString().split('T')[0];
        const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        let hecStageDetails = "";
        if (serviceName === 'HEC') {
          try {
            const hecQuery = query(collection(db, 'hec_workflows'), where('journalId', '==', journal.id), limit(1));
            const hecSnap = await getDocs(hecQuery);
            if (!hecSnap.empty) {
              const hecData = hecSnap.docs[0].data();
              hecStageDetails = ` | Stage: ${hecData.currentStage || 1} (${hecData.status || 'Active'})`;
            }
          } catch (e) {
            console.warn("Could not fetch HEC workflow for invoice", e);
          }
        }

        const invoiceData = {
          invoiceNumber,
          clientId: journal.clientId,
          clientName: journal.clientName || 'Valued Client',
          journalId: journal.id,
          journalTitle: journal.title,
          clientServiceId: clientServiceId, // Link to assignment layer
          issueDate,
          dueDate,
          date: issueDate,
          status: 'draft',
          billingType: catalogItem ? 'one-time' : 'one-time',
          currency: 'PKR',
          subscription_source: 'Journal',
          items: [
            {
              id: Math.random().toString(36).substr(2, 9),
              description: catalogItem 
                ? `${catalogItem.name} for ${journal.title}${hecStageDetails}`
                : `Managed Subscription: ${serviceName} for ${journal.title}${hecStageDetails}`,
              quantity: 1,
              rate: catalogItem?.basePrice || 0,
              taxRate: 0,
              discountRate: 0,
              taxAmount: 0,
              discountAmount: 0,
              total: catalogItem?.basePrice || 0,
              serviceType: serviceName as any,
              catalogItemId: catalogItem?.id || null
            }
          ],
          subtotal: catalogItem?.basePrice || 0,
          taxTotal: 0,
          discountTotal: 0,
          total: catalogItem?.basePrice || 0,
          balance: catalogItem?.basePrice || 0,
          createdAt: new Date().toISOString(),
          createdById: currentUser?.id,
          createdBy: currentUser?.name
        };

        const docRef = await addDoc(collection(db, 'invoices'), invoiceData);
        updates.active_invoice_id = docRef.id;
        toast.success(`Draft Invoice Generated: ${invoiceNumber}`, { duration: 5000 });
      }

      await updateDoc(doc(db, 'journals', journalId), updates);
      toast.success(isEnabling ? `${serviceName} Activated` : `${serviceName} Deactivated`);
      logActivity(`${isEnabling ? 'Activated' : 'Deactivated'} ${serviceName} subscription`);
    } catch (error) {
      console.error('Error toggling subscription:', error);
      toast.error('Failed to update subscription status');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!journal) return;
    setIsSaving(true);
    try {
      // Uniqueness checks
      if (globalSettings?.uniquenessSettings?.journalTitle && editData.title !== journal.title) {
        const isTitleUnique = await checkCoreFieldUniqueness('journals', 'title', editData.title, journalId);
        if (!isTitleUnique) {
          toast.error('Journal title is already in use by another journal');
          setIsSaving(false);
          return;
        }
      }
      
      if (globalSettings?.uniquenessSettings?.issnNumber) {
        if (editData.issnPrint && (editData as any).issnPrint !== journal.issnPrint) {
          const isUnique = await checkCoreFieldUniqueness('journals', 'issnPrint', (editData as any).issnPrint, journalId);
          if (!isUnique) {
            toast.error('Print ISSN is already in use');
            setIsSaving(false);
            return;
          }
        }
        if (editData.issnOnline && (editData as any).issnOnline !== journal.issnOnline) {
          const isUnique = await checkCoreFieldUniqueness('journals', 'issnOnline', (editData as any).issnOnline, journalId);
          if (!isUnique) {
            toast.error('Online ISSN is already in use');
            setIsSaving(false);
            return;
          }
        }
      }

      await updateDoc(doc(db, 'journals', journalId), {
        ...editData,
        updatedAt: serverTimestamp()
      });
      setIsSaved(true);
      toast.success('Journal updated successfully');
      setTimeout(() => {
        setIsSaved(false);
        setIsEditing(false);
      }, 500);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journals');
      toast.error('Failed to update journal');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!journal) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Journal not found.</p>
        <button onClick={onBack} className="mt-4 text-indigo-600 font-bold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="p-8 w-full px-4 md:px-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all font-bold group"
        >
          <div className="p-2 bg-white border border-slate-200 rounded-xl group-hover:border-slate-300 shadow-sm">
            <ArrowLeft size={20} />
          </div>
          Back
        </button>
        <div className="flex gap-3">
          {!isEditing && (isAdmin || isManager || check('journals', 'delete')) && (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="px-5 py-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-all flex items-center gap-2 shadow-sm"
              title="Move Journal to Trash"
            >
              <Trash2 size={18} />
              Delete Journal
            </button>
          )}
          {isEditing ? (
            <button 
              onClick={() => {
                setIsEditing(false);
                setEditData(journal || {});
              }}
              className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
          ) : (
            check('journals', 'edit') && (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <Edit size={18} />
                Edit Journal
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={cn(
        "transition-all",
        isEditing && "ring-4 ring-indigo-50 rounded-[2rem] p-2 -m-2 bg-indigo-50/10"
      )}>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Context Content */}
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-8">
                {/* Journal Basic Info Section */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative group/photo">
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden border-2 shadow-sm transition-all",
                        (journal.subscribed_services?.includes('Hosting') || journal.subscribed_services?.includes('Domain'))
                          ? "bg-indigo-600 border-indigo-100 text-white" 
                          : "bg-slate-100 border-slate-200 text-slate-400 grayscale"
                      )}>
                        {journal.url ? (
                          <img 
                            src={`https://www.google.com/s2/favicons?sz=64&domain=${getHostname(journal.url)}`} 
                            alt="Journal"
                            className={cn(
                              "w-full h-full object-cover",
                              !(journal.subscribed_services?.includes('Hosting') || journal.subscribed_services?.includes('Domain')) && "grayscale opacity-50 transition-all group-hover/photo:grayscale-0 group-hover/photo:opacity-100"
                            )}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <BookOpen size={32} />
                        )}
                      </div>
                    </div>
                    <div>
                      {isEditing ? (
                        <div className="space-y-4 w-full">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Journal Title</label>
                            <input 
                              type="text"
                              className="text-2xl font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                              value={editData.title || ''}
                              onChange={(e) => {
                                const title = e.target.value;
                                setEditData({ 
                                  ...editData, 
                                  title,
                                  abbreviation: generateJournalAbbreviation(title),
                                  initials: generateJournalInitials(title)
                                });
                              }}
                              placeholder="Journal Title"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abbreviation</label>
                              <input 
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold"
                                value={editData.abbreviation || ''}
                                onChange={(e) => setEditData({ ...editData, abbreviation: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initials</label>
                              <input 
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold"
                                value={editData.initials || ''}
                                onChange={(e) => setEditData({ ...editData, initials: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-slate-900">{journal.title}</h1>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-tight" title="Abbreviation">
                                {journal.abbreviation || 'N/A'}
                              </span>
                              <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-tight" title="Initials">
                                {journal.initials || 'N/A'}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-500 font-medium">Subject: {journal.subjectCategory || 'Not set'}</p>
                        </div>
                      )}
                    </div>
                    {/* Service Status Icons */}
                    <div className="hidden md:flex items-center gap-2 ml-4">
                      {[
                        { id: 'Domain', label: 'Domain', icon: Globe, checkId: 'Domain' },
                        { id: 'Domain (External)', label: 'Domain (E)', icon: Globe, checkId: 'Domain (External)' },
                        { id: 'Hosting', label: 'Hosting', icon: Server, checkId: 'Hosting' },
                        { id: 'Hosting (External)', label: 'Hosting (E)', icon: Cloud, checkId: 'Hosting (External)' },
                        { id: 'ISSN', label: 'ISSN', icon: Hash, checkId: 'ISSN' },
                        { id: 'DOI', label: 'DOI', icon: LinkIcon, checkId: 'DOI' },
                        { id: 'Publisher', label: 'Publisher', icon: Building2, checkId: 'Publisher' },
                        { id: 'HEC', label: 'HEC', icon: Shield, checkId: 'HEC' },
                        { id: 'DOAJ', label: 'DOAJ', icon: CheckCircle2, checkId: 'DOAJ' },
                        { id: 'OJS', label: 'OJS', icon: BookOpen, checkId: 'OJS' },
                        { id: 'Indexing', label: 'Indexing', icon: Database, checkId: 'Indexing' },
                        { id: 'Vault', label: 'Vault', icon: Key, checkId: 'Vault' },
                        { id: 'Catalog', label: 'Catalog', icon: Package, checkId: 'Catalog' },
                        { id: 'Scholar', label: 'Scholar', icon: History, checkId: 'Scholar' },
                        { id: 'Work', label: 'Work', icon: Activity, checkId: 'Work' },
                      ].filter((s) => {
                        if (s.checkId === 'Domain') return journal.subscribed_services?.includes('Domain');
                        if (s.checkId === 'Domain (External)') return journal.subscribed_services?.includes('Domain (External)');
                        if (s.checkId === 'Hosting') return journal.subscribed_services?.includes('Hosting');
                        if (s.checkId === 'Hosting (External)') return journal.subscribed_services?.includes('Hosting (External)');
                        if (s.checkId === 'ISSN') return journal.subscribed_services?.includes('ISSN');
                        if (s.checkId === 'DOI') return journal.subscribed_services?.includes('DOI');
                        if (s.checkId === 'Publisher') return journal.subscribed_services?.includes('Publisher');
                        if (s.checkId === 'HEC') return journal.subscribed_services?.includes('HEC') || journal.subscribed_services?.includes('HEC Recognition');
                        if (s.checkId === 'DOAJ') return journal.subscribed_services?.includes('DOAJ');
                        if (s.checkId === 'OJS') return journal.subscribed_services?.includes('OJS');
                        if (s.checkId === 'Indexing') return journal.subscribed_services?.includes('Indexing');
                        if (s.checkId === 'Vault') return journal.subscribed_services?.includes('Vault') || journal.subscribed_services?.includes('Security');
                        if (s.checkId === 'Catalog') return journal.subscribed_services?.includes('Catalog') || (journalClientServices && journalClientServices.length > 0);
                        if (s.checkId === 'Scholar') return journal.subscribed_services?.includes('Scholar') || journal.subscribed_services?.includes('Google Scholar') || journal.subscribed_services?.includes('Google Scholar Indexing');
                        if (s.checkId === 'Work') return journal.subscribed_services?.includes('Work') || journal.subscribed_services?.includes('Work History') || journal.subscribed_services?.includes('Tasks');
                        return false;
                      }).map((s) => {
                        return (
                          <div key={s.id} className="group relative">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-all border shadow-sm bg-white border-indigo-100 text-indigo-600 shadow-indigo-100"
                            )}>
                              <s.icon size={16} />
                            </div>
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[8px] font-bold px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-10">
                              {s.label}: Active
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="w-48">
                      <SearchableSelect
                        options={[
                          { label: "Complete", value: "complete" },
                          { label: "Pending ISSN", value: "pending_issn" }
                        ]}
                        value={editData.status || 'pending_issn'}
                        onChange={(value) => setEditData({ ...editData, status: value as any })}
                      />
                    </div>
                  ) : (
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider",
                      journal.status === 'complete' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                    )}>
                      {journal.status ? journal.status.replace('_', ' ') : 'active'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-50">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ownership & Management</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-slate-600">
                        <User size={18} className="text-slate-400" />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Owner / Client</span>
                          <span className="text-sm font-medium">{journal.clientName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-slate-600">
                        <UserCheck size={18} className="text-slate-400" />
                        <span className="text-sm font-medium">Assigned: {journal.assignedEmployeeName || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Technical Infrastructure</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Domain Status */}
                      <div className={cn(
                        "p-4 rounded-2xl border flex items-center gap-4 transition-all",
                        journal.subscribed_services?.includes('Domain') 
                          ? "bg-indigo-50/50 border-indigo-100 shadow-sm" 
                          : "bg-slate-50 border-slate-100"
                      )}>
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                          journal.subscribed_services?.includes('Domain')
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "bg-slate-100 text-slate-400 grayscale"
                        )}>
                          <Globe size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Web Domain</p>
                          <p className="text-sm font-bold text-slate-700">
                            {domains.find(d => d.id === journal.domainId)?.domainName || 'External Domain'}
                          </p>
                        </div>
                        {journal.subscribed_services?.includes('Domain (External)') && (
                          <div className="ml-auto px-2 py-0.5 bg-slate-200 text-slate-600 text-[8px] font-black rounded uppercase tracking-tighter">
                            External
                          </div>
                        )}
                      </div>

                      {/* Hosting Status */}
                      <div className={cn(
                        "p-4 rounded-2xl border flex items-center gap-4 transition-all",
                        journal.subscribed_services?.includes('Hosting') 
                          ? "bg-indigo-50/50 border-indigo-100 shadow-sm" 
                          : "bg-slate-50 border-slate-100"
                      )}>
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                          journal.subscribed_services?.includes('Hosting')
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "bg-slate-100 text-slate-400 grayscale"
                        )}>
                          <Server size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Server Hosting</p>
                          <p className="text-sm font-bold text-slate-700">
                            {journal.subscribed_services?.includes('Hosting') ? 'Hosta Enterprise' : 'External Host'}
                          </p>
                        </div>
                        {journal.subscribed_services?.includes('Hosting (External)') && (
                          <div className="ml-auto px-2 py-0.5 bg-slate-200 text-slate-600 text-[8px] font-black rounded uppercase tracking-tighter">
                            External
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-3 text-slate-600">
                        <Settings2 size={18} className="text-slate-400" />
                        <span className="text-sm font-medium">Platform: {journal.ojsVersion ? `OJS ${journal.ojsVersion}` : 'No CMS Recorded'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACADEMIC PROFILE & ASSOCIATIONS SECTION */}
              <div id="academic-associations-card" className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-8 animate-in fade-in slide-in-from-left-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Academic Profile & Core Associations</h2>
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">Configure metadata, fees, discovery scopes, Call For Papers and editorial board</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Category, APC & Scopes */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <BookOpen size={14} className="text-indigo-500" />
                        Classification & Financials
                      </h3>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Category selection */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Journal Category</label>
                          {isEditing ? (
                            <select
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                              value={editData.category || ''}
                              onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                            >
                              <option value="">Select Category</option>
                              {((globalSettings?.journalCategories || [
                                'Multidisciplinary', 'Computer Science', 'Medicine', 'Engineering', 
                                'Social Sciences', 'Business & Management', 'Arts & Humanities'
                              ]) as string[]).map((cat: string) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="px-3 py-2 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 border border-slate-100">
                              {journal.category || 'Not Classified'}
                            </div>
                          )}
                        </div>

                        {/* Subject category input */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject Sector</label>
                          {isEditing ? (
                            <input
                              type="text"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                              value={editData.subjectCategory || ''}
                              onChange={(e) => setEditData({ ...editData, subjectCategory: e.target.value })}
                              placeholder="e.g. Artificial Intelligence"
                            />
                          ) : (
                            <div className="px-3 py-2 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 border border-slate-100">
                              {journal.subjectCategory || 'Not set'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* APC amount input */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">APC Amount ($ USD)</label>
                          {isEditing ? (
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                              <input
                                type="number"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                value={editData.apcAmount ?? ''}
                                onChange={(e) => setEditData({ ...editData, apcAmount: e.target.value ? Number(e.target.value) : undefined })}
                                placeholder="0"
                              />
                            </div>
                          ) : (
                            <div className="px-3 py-2 bg-emerald-50/50 rounded-xl text-xs font-bold text-emerald-700 border border-emerald-100 flex items-center gap-1.5">
                              <DollarSign size={14} className="text-emerald-500" />
                              <span>APC: ${journal.apcAmount || 0} USD</span>
                            </div>
                          )}
                        </div>

                        {/* OJS platform version selection */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OJS Platform Version</label>
                          {isEditing ? (
                            <select
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                              value={editData.ojsVersion || ''}
                              onChange={(e) => setEditData({ ...editData, ojsVersion: e.target.value })}
                            >
                              <option value="">Select Version</option>
                              {['3.3.0.8', '3.3.0.10', '3.3.0.12', '3.3.0.14', '3.3.0.15', '3.3.0.16', '3.3.0.17', '3.4.0.1', '3.4.0.2', '3.4.0.3', '3.x'].map(v => (
                                <option key={v} value={v}>OJS {v}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="px-3 py-2 bg-indigo-50/50 rounded-xl text-xs font-bold text-indigo-700 border border-indigo-100 flex items-center gap-1.5">
                              <Settings2 size={14} className="text-indigo-400" />
                              <span>Version: {journal.ojsVersion || 'No CMS Recorded'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Scope Keywords with AI Suggester */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Sparkles size={14} className="text-indigo-500" />
                          Scope & Keywords
                        </h3>
                        {isEditing && (
                          <button
                            type="button"
                            disabled={isSuggestingKeywords}
                            onClick={handleSuggestKeywords}
                            className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg transition-all flex items-center gap-1 hover:scale-105 active:scale-95 disabled:opacity-50 border border-indigo-100 shadow-sm"
                          >
                            <Sparkles size={12} className={cn(isSuggestingKeywords ? "animate-spin" : "")} />
                            {isSuggestingKeywords ? 'Analyzing...' : 'Suggest with AI'}
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[100px]">
                        {((isEditing ? editData.scope : journal.scope) || []).length > 0 ? (
                          ((isEditing ? editData.scope : journal.scope) || []).map((tag: string) => (
                            <span 
                              key={tag} 
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-100 text-slate-600 rounded-full text-xs font-bold shadow-sm transition-all hover:border-indigo-100 hover:text-slate-800"
                            >
                              {tag}
                              {isEditing && (
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const currentScope = editData.scope || [];
                                    setEditData({ ...editData, scope: currentScope.filter(t => t !== tag) });
                                  }}
                                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-colors text-[9px] font-black"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))
                        ) : (
                          <div className="text-slate-400 text-xs italic m-auto">No scope/keyword tags defined yet.</div>
                        )}
                      </div>

                      {isEditing && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add scope tag (Press Enter...)"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                            value={newScopeTag || ''}
                            onChange={(e) => setNewScopeTag(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const tagStr = newScopeTag.trim();
                                if (tagStr) {
                                  const currentScope = editData.scope || [];
                                  if (!currentScope.includes(tagStr)) {
                                    setEditData({ ...editData, scope: [...currentScope, tagStr] });
                                  }
                                  setNewScopeTag('');
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const tagStr = newScopeTag.trim();
                              if (tagStr) {
                                const currentScope = editData.scope || [];
                                if (!currentScope.includes(tagStr)) {
                                  setEditData({ ...editData, scope: [...currentScope, tagStr] });
                                }
                                setNewScopeTag('');
                              }
                            }}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: CFP settings & Editorial Board */}
                  <div className="space-y-6">
                    {/* Call for Papers profile */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Volume2 size={14} className="text-indigo-500" />
                        Call For Papers (CFP) Profile
                      </h3>

                      <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black text-slate-700 uppercase">Use for CFP</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Indicate if this journal is actively accepting paper submissions</p>
                          </div>
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={() => setEditData({ ...editData, useForCfp: !editData.useForCfp })}
                              className={cn(
                                "w-12 h-6 rounded-full p-1 transition-all duration-200 outline-none flex items-center",
                                editData.useForCfp ? "bg-indigo-600 justify-end" : "bg-slate-300 justify-start"
                              )}
                            >
                              <span className="w-4 h-4 rounded-full bg-white shadow-md block" />
                            </button>
                          ) : (
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                              journal.useForCfp 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            )}>
                              {journal.useForCfp ? "Active CFP" : "No CFP Enlisted"}
                            </span>
                          )}
                        </div>

                        {((isEditing ? editData.useForCfp : journal.useForCfp)) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/50 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CFP Discipline / Subject</label>
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                  value={editData.cfpDiscipline || ''}
                                  onChange={(e) => setEditData({ ...editData, cfpDiscipline: e.target.value })}
                                  placeholder="e.g. Science & Tech"
                                />
                              ) : (
                                <div className="text-xs font-bold text-slate-700">{journal.cfpDiscipline || 'General Multi-disciplinary'}</div>
                              )}
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Submission Deadline</label>
                              {isEditing ? (
                                <input
                                  type="date"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                  value={editData.cfpDeadline || ''}
                                  onChange={(e) => setEditData({ ...editData, cfpDeadline: e.target.value })}
                                />
                              ) : (
                                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                  <Calendar size={12} className="text-slate-400" />
                                  {journal.cfpDeadline ? journal.cfpDeadline : 'No Deadline Assigned'}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Editorial team board members */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Users size={14} className="text-indigo-500" />
                        Editorial Team & Board Members
                      </h3>

                      <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl space-y-4">
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 no-scrollbar">
                          {((isEditing ? editData.editorialBoardMembers : journal.editorialBoardMembers) || []).length > 0 ? (
                            ((isEditing ? editData.editorialBoardMembers : journal.editorialBoardMembers) || []).map((member: string, index: number) => (
                              <div key={`${member}-${index}`} className="flex justify-between items-center p-2.5 bg-white border border-slate-100 rounded-xl shadow-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black">
                                    {index + 1}
                                  </div>
                                  <span className="text-xs font-bold text-slate-700">{member}</span>
                                </div>
                                {isEditing && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentBoard = editData.editorialBoardMembers || [];
                                      setEditData({ ...editData, editorialBoardMembers: currentBoard.filter(m => m !== member) });
                                    }}
                                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-slate-400 text-xs italic py-4 text-center">No team members listed yet.</div>
                          )}
                        </div>

                        {isEditing && (
                          <div className="flex gap-2 pt-2 border-t border-slate-200/50">
                            <input
                              type="text"
                              placeholder="Enter board member name..."
                              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                              value={newBoardMember || ''}
                              onChange={(e) => setNewBoardMember(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const memberName = newBoardMember.trim();
                                  if (memberName) {
                                    const currentBoard = editData.editorialBoardMembers || [];
                                    if (!currentBoard.includes(memberName)) {
                                      setEditData({ ...editData, editorialBoardMembers: [...currentBoard, memberName] });
                                    }
                                    setNewBoardMember('');
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const memberName = newBoardMember.trim();
                                if (memberName) {
                                  const currentBoard = editData.editorialBoardMembers || [];
                                  if (!currentBoard.includes(memberName)) {
                                    setEditData({ ...editData, editorialBoardMembers: [...currentBoard, memberName] });
                                  }
                                  setNewBoardMember('');
                                }
                              }}
                              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm"
                            >
                              Add
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Google Scholar & Indexing Summaries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
                  {/* Google Scholar Quick Status */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <GraduationCap size={14} className="text-indigo-500" />
                      Google Scholar Status
                    </h3>
                    <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex justify-between items-center">
                      <div>
                        <p className="text-xs font-black text-slate-700 uppercase">Scholar Indexing Status</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Define overall Google Scholar state</p>
                      </div>

                      {isEditing ? (
                        <select
                          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editData.googleScholarStatus || journal.googleScholarStatus || 'Not Indexed'}
                          onChange={(e) => setEditData({ ...editData, googleScholarStatus: e.target.value })}
                        >
                          <option value="Not Indexed">Not Indexed</option>
                          <option value="Indexed">Indexed</option>
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      ) : (
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                          (journal.googleScholarStatus || (scholarHistory.length > 0 ? scholarHistory[0].status : 'Not Indexed')) === "Indexed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : (journal.googleScholarStatus || (scholarHistory.length > 0 ? scholarHistory[0].status : 'Not Indexed')) === "Pending" || (journal.googleScholarStatus || (scholarHistory.length > 0 ? scholarHistory[0].status : 'Not Indexed')) === "In Progress"
                              ? "bg-amber-50 text-amber-700 border-amber-100"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          {journal.googleScholarStatus || (scholarHistory.length > 0 ? scholarHistory[0].status : 'Not Indexed')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Indexing Summary quick status */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Globe size={14} className="text-indigo-500" />
                      Registry Indexing Status
                    </h3>
                    <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex justify-between items-center">
                      <div>
                        <p className="text-xs font-black text-slate-700 uppercase">Indexing Presence</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                          Currently present in <strong className="text-indigo-600">{indexingRecords.filter(r => r.status === 'indexed').length}</strong> active registry indexes.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsIndexingModalOpen(true)}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-black transition-all active:scale-95 shadow-xs"
                      >
                        Manage Indexing
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SERVICE TABS INTERFACE */}
              {(() => {
                const visibleServiceTabs = ALL_AVAILABLE_TABS.filter(tab => 
                  journal?.active_tabs?.includes(tab.id)
                );

                return (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex gap-1 overflow-x-auto no-scrollbar">
                        {visibleServiceTabs.map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveServiceTab(tab.id as any)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-t-xl font-bold transition-all whitespace-nowrap text-xs group relative",
                              activeServiceTab === tab.id 
                                ? "bg-white text-indigo-600 border-x border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]" 
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            )}
                          >
                            <tab.icon size={14} />
                            {tab.label}
                            {/* Option to remove active tab */}
                            <span 
                              onClick={(e) => handleRemoveActiveTab(tab.id, e)}
                              className="ml-1.5 p-0.5 rounded-full hover:bg-rose-50 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title={`Hide ${tab.label} Tab`}
                            >
                              <X size={10} />
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* "+" Button to add tab */}
                      <button
                        onClick={() => setIsAddTabModalOpen(true)}
                        className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider"
                        title="Add Service Tab"
                      >
                        <Plus size={16} />
                        <span className="hidden sm:inline">Add Tab</span>
                      </button>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 min-h-[400px]">
                      {visibleServiceTabs.length === 0 ? (
                        <div className="py-20 text-center space-y-4">
                          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
                            <Plus size={32} />
                          </div>
                          <div>
                            <p className="text-slate-500 font-bold text-sm">No service tabs active yet.</p>
                            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto mt-1">
                              Click the "+ Add Tab" button above to activate and configure your journal services.
                            </p>
                          </div>
                          <button
                            onClick={() => setIsAddTabModalOpen(true)}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-sm shadow-indigo-100"
                          >
                            Activate First Tab
                          </button>
                        </div>
                      ) : (
                        /* Service Render Logic */
                        <ServiceTabContent 
                          tab={activeServiceTab}
                          journal={journal}
                          isEditing={isEditing}
                          editData={editData}
                          setEditData={setEditData}
                          indexingRecords={indexingRecords}
                          agencies={agencies}
                          journalTasks={journalTasks}
                          journalClientServices={journalClientServices}
                          scholarHistory={scholarHistory}
                          publishers={publishers}
                          currentUser={currentUser}
                          setIsActivateServiceModalOpen={setIsActivateServiceModalOpen}
                          setServiceToActivate={setServiceToActivate}
                          isAdmin={isAdmin}
                          check={check}
                          setIsIndexingModalOpen={setIsIndexingModalOpen}
                          setIsScholarModalOpen={setIsScholarModalOpen}
                          copiedField={copiedField}
                          setCopiedField={setCopiedField}
                          formatDateForInput={formatDateForInput}
                          onNavigateToPublisher={onNavigateToPublisher}
                          employees={employees}
                          onToggleSubscription={handleToggleSubscription}
                          setSelectedCsId={setSelectedCsId}
                          setIsChecklistModalOpen={setIsChecklistModalOpen}
                          toggleChecklistItem={toggleChecklistItem}
                          domains={domains}
                          onOpenQuickDataModal={handleOpenQuickDataModal}
                        />
                      )}
                    </div>

                    {/* Separate Card for Vault */}
                    {(isAdmin || check('journals', 'edit')) && journal && (
                      <div id="vault-card" className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-6 animate-in fade-in slide-in-from-left-4 mt-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <Key size={20} />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-slate-900 uppercase">Credential Vault</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Secure access credentials storage</p>
                          </div>
                        </div>
                        <CredentialVault journalId={journal.id} currentUser={currentUser} />
                      </div>
                    )}

                    {/* Separate Card for Work Performance */}
                    {journal && (
                      <div id="work-history-card" className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-6 animate-in fade-in slide-in-from-left-4 mt-8">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                              <Activity size={20} />
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-slate-900 uppercase">Task Performance</h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operational task history</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                            {journalTasks.length} Tasks
                          </span>
                        </div>
                        <div className="space-y-3">
                          {journalTasks.map((task: any) => (
                            <div key={task.id} className="p-4 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-100 rounded-2xl shadow-xs transition-all group">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{task.title}</p>
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                      task.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                    )}>{task.status}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Assigned to: {(employees.find((e: any) => e.id === task.assignedTo))?.name || 'Unassigned'}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-black text-slate-900">+{task.points}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Points</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {journalTasks.length === 0 && (
                            <div className="text-center py-12 text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                              No operational tasks found.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Journal Publication Lifecycle module removed */}
            </div>
        </div>

        {/* Right Column: Discovery & AI */}
          {recommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <SmartRecommendations 
                recommendations={recommendations}
                onSelectService={(service) => {
                  setServiceToActivate(service);
                  setIsActivateServiceModalOpen(true);
                }}
              />
            </motion.div>
          )}

          <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 text-center space-y-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 mx-auto shadow-sm">
                <Sparkles size={24} />
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-indigo-900">Discovery Engine</h4>
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Available to Unlock</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['Hosting', 'Indexing', 'Editorial', 'OJS'].filter(s => !journal.subscribed_services?.includes(s)).slice(0, 4).map((s, idx) => (
                    <div key={`${s}-${idx}`} className="px-3 py-2 bg-white/50 rounded-xl text-[10px] font-bold text-indigo-700 border border-indigo-100 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>

            </div>
        </div>
      </div>



      {/* Custom Add Service Tab Modal */}
      <Modal
        isOpen={isAddTabModalOpen}
        onClose={() => {
          setIsAddTabModalOpen(false);
          setSelectedTabToActivate('');
        }}
        title="Activate Service Tab"
        maxWidth="lg"
      >
        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Select Tab to Activate</p>
            <div className="grid grid-cols-2 gap-3">
              {ALL_AVAILABLE_TABS.map(tab => {
                const isActive = journal?.active_tabs?.includes(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={isActive}
                    onClick={() => setSelectedTabToActivate(tab.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-2xl border text-left transition-all relative",
                      isActive 
                        ? "bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed text-slate-400"
                        : selectedTabToActivate === tab.id
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm shadow-indigo-50/50"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      isActive 
                        ? "bg-slate-100 text-slate-400"
                        : selectedTabToActivate === tab.id
                          ? "bg-indigo-100 text-indigo-600"
                          : "bg-slate-50 text-slate-500"
                    )}>
                      <tab.icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-tight truncate leading-none">{tab.label}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5 truncate font-medium">
                        {isActive ? 'Already Active' : 'Available'}
                      </p>
                    </div>
                    {selectedTabToActivate === tab.id && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedTabToActivate && (
            <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Choose Activation Condition</p>
                <div className="space-y-3">
                  <label className={cn(
                    "flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all",
                    activationCondition === 'subscribed'
                      ? "bg-indigo-50/30 border-indigo-200 text-indigo-950"
                      : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                  )}>
                    <input 
                      type="radio" 
                      name="activationCondition" 
                      value="subscribed"
                      checked={activationCondition === 'subscribed'}
                      onChange={() => setActivationCondition('subscribed')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-xs font-black uppercase">1. Subscribed and Active</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                        Activate this service tab and link as an active billed subscription for the journal client.
                      </p>
                    </div>
                  </label>

                  <label className={cn(
                    "flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all",
                    activationCondition === 'unsubscribed'
                      ? "bg-indigo-50/30 border-indigo-200 text-indigo-950"
                      : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                  )}>
                    <input 
                      type="radio" 
                      name="activationCondition" 
                      value="unsubscribed"
                      checked={activationCondition === 'unsubscribed'}
                      onChange={() => setActivationCondition('unsubscribed')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-xs font-black uppercase">2. Active without Subscription</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                        Activate this service tab for technical/manual configuration details, without creating any client billing subscriptions.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddTabModalOpen(false);
                    setSelectedTabToActivate('');
                  }}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl text-xs font-black hover:bg-slate-50 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAddActiveTab(selectedTabToActivate, activationCondition)}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm shadow-indigo-100"
                >
                  Confirm Activation
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal 
        isOpen={isIndexingModalOpen} 
        onClose={() => setIsIndexingModalOpen(false)}
        title="Journal Indexing Manager"
        maxWidth="4xl"
      >
        <JournalIndexingManager 
          journal={journal} 
          onClose={() => setIsIndexingModalOpen(false)} 
          currentUser={currentUser}
        />
      </Modal>

      {/* Google Scholar Log Modal */}
      <Modal
        isOpen={isScholarModalOpen}
        onClose={() => setIsScholarModalOpen(false)}
        title="Add Scholar History Log"
      >
        <form onSubmit={handleAddScholarLog} className="space-y-4">
          <div className="space-y-2">
            <SearchableSelect
              label="Indexing Status"
              options={[
                { label: "Indexed", value: "Indexed" },
                { label: "Pending", value: "Pending" },
                { label: "Rejected", value: "Rejected" },
                { label: "Tag Optimization", value: "Tag Optimization" }
              ]}
              value={newScholarLog.status || 'Indexed'}
              onChange={(value) => setNewScholarLog({ ...newScholarLog, status: value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Tag Optimization / Notes</label>
            <textarea 
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
              placeholder="Enter tag optimization details or status notes..."
              value={newScholarLog.tagOptimization || ''}
              onChange={(e) => setNewScholarLog({ ...newScholarLog, tagOptimization: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsScholarModalOpen(false)}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              Add Log
            </button>
          </div>
        </form>
      </Modal>

      {/* Activate Service Modal */}
      <Modal 
        isOpen={isActivateServiceModalOpen} 
        onClose={() => setIsActivateServiceModalOpen(false)} 
        title="Activate Service"
      >
        <form onSubmit={handleActivateService} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Service to Activate</label>
            <SearchableSelect
              label="Service to Activate"
              required
              options={globalSettings?.activatableServices?.length > 0 ? (
                Array.from(new Set(globalSettings.activatableServices as string[])).map((service: string) => ({ label: service, value: service }))
              ) : [
                { label: "Hosting", value: "Hosting" },
                { label: "Hosting (External)", value: "Hosting (External)" },
                { label: "DOI", value: "DOI" },
                { label: "ISSN", value: "ISSN" },
                { label: "OJS Setup", value: "OJS" },
                { label: "Editorial", value: "Editorial" },
                { label: "Indexing", value: "Indexing" },
                { label: "Publisher", value: "Publisher" },
                { label: "Domain", value: "Domain" },
                { label: "Domain (External)", value: "Domain (External)" },
                { label: "Marketing & Boost", value: "Marketing" },
                { label: "Call for Papers", value: "Call for Papers" },
                { label: "Editorial Team Setup", value: "Editorial Setup" },
                { label: "Reviewer Recruitment", value: "Reviewer Recruitment" },
                { label: "HEC Indexing", value: "HEC Indexing" },
                { label: "DOAJ Indexing", value: "DOAJ Indexing" },
                { label: "Scopus Indexing", value: "Scopus Indexing" },
                { label: "Journal Evaluation", value: "Journal Evaluation" },
                { label: "Impact Factor Evaluation", value: "Impact Factor" },
                { label: "Site Score Analysis", value: "Site Score" }
              ]}
              value={serviceToActivate}
              onChange={(value) => setServiceToActivate(value as ServiceType)}
              placeholder="Select Service..."
            />
          </div>

          <div className="space-y-2">
            <SearchableSelect
              label="Link Invoice (Optional)"
              options={[
                { label: "Select Invoice", value: "" },
                ...invoices
                  .sort((a, b) => (b.invoiceNumber || '').localeCompare(a.invoiceNumber || ''))
                  .map(inv => ({ 
                    label: `${inv.invoiceNumber} - ${inv.total} ${inv.status}`, 
                    value: inv.id 
                  }))
              ]}
              value={activationData.invoiceId}
              onChange={(value) => {
                const inv = invoices.find(i => i.id === value);
                setActivationData({ 
                  ...activationData, 
                  invoiceId: value,
                  invoiceNumber: inv?.invoiceNumber || ''
                });
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Manual Invoice Number (If no invoice linked)</label>
            <input 
              type="text"
              placeholder="e.g. INV-2024-001"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={activationData.invoiceNumber || ''}
              onChange={(e) => setActivationData({ ...activationData, invoiceNumber: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Start Date</label>
              <input 
                type="date"
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={activationData.startDate || ''}
                onChange={(e) => setActivationData({ ...activationData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Expiry Date</label>
              <input 
                type="date"
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={activationData.expiryDate || ''}
                onChange={(e) => setActivationData({ ...activationData, expiryDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <SearchableSelect
              label="Subscription Type"
              options={[
                { label: "One-time", value: "one-time" },
                { label: "Monthly", value: "monthly" },
                { label: "Annual", value: "annual" }
              ]}
              value={activationData.subscriptionType || 'annual'}
              onChange={(value) => setActivationData({ ...activationData, subscriptionType: value as any })}
            />
          </div>

          {serviceToActivate === 'Publisher' && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Sale Price (PKR)</label>
                <input 
                  type="number"
                  required
                  className="w-full p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  value={activationData.salePrice || 0 || ''}
                  onChange={(e) => setActivationData({ ...activationData, salePrice: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Cost Price (PKR)</label>
                <input 
                  type="number"
                  required
                  className="w-full p-2.5 bg-rose-50 border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                  value={activationData.costPrice || 0 || ''}
                  onChange={(e) => setActivationData({ ...activationData, costPrice: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsActivateServiceModalOpen(false)}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              Activate
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Checklist Item Modal */}
      <Modal
        isOpen={isChecklistModalOpen}
        onClose={() => setIsChecklistModalOpen(false)}
        title="Add Checklist Item"
      >
        <form onSubmit={handleAddChecklistItem} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700">Requirement / Task Name</label>
                <div className="flex gap-2">
                   <button 
                    type="button"
                    onClick={() => setNewChecklistItem('TEMP')}
                    className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded hover:bg-amber-100 transition-all uppercase tracking-tight"
                  >
                    Set Temp
                  </button>
                </div>
              </div>
              <input 
                required
                type="text"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. Scanned copy of ISSN certificate"
                value={newChecklistItem || ''}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                autoFocus
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { label: 'Journal', value: journal.title },
                  { label: 'Client', value: journal.clientName },
                  { label: 'Publisher', value: publishers.find(p => p.id === journal.publisherId)?.name || 'Publisher' },
                  { label: 'Domain', value: domains.find(d => d.id === journal.domainId)?.domainName || 'Domain' },
                  { label: 'No Link', value: 'NO LINK' }
                ].map(chip => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setNewChecklistItem(prev => prev ? `${prev} - ${chip.value}` : chip.value)}
                    className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded hover:bg-indigo-50 hover:text-indigo-600 transition-all uppercase tracking-wider border border-slate-200"
                  >
                    + {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               {[
                 { label: 'Text', color: 'bg-blue-50 text-blue-600 border-blue-100' },
                 { label: 'New Requirement', color: 'bg-purple-50 text-purple-600 border-purple-100' },
                 { label: 'Important', color: 'bg-rose-50 text-rose-600 border-rose-100' },
                 { label: 'Template', color: 'bg-amber-50 text-amber-600 border-amber-100' }
               ].map(badge => (
                 <button
                   key={badge.label}
                   type="button"
                   onClick={() => setNewChecklistItem(prev => `${badge.label}: ${prev}`)}
                   className={cn(
                     "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all hover:scale-105 active:scale-95",
                     badge.color
                   )}
                 >
                   Prepend {badge.label}
                 </button>
               ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsChecklistModalOpen(false)}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newChecklistItem.trim()}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              Add Item
            </button>
          </div>
        </form>
      </Modal>

      <FloatingActionBar 
        isVisible={isEditing}
        onSave={handleSave}
        onCancel={() => {
          setIsEditing(false);
          setEditData(journal || {});
        }}
        isSaving={isSaving}
      />

      {isScopeConfigOpen && (
        <ConfigModal
          isOpen={isScopeConfigOpen}
          onClose={() => setIsScopeConfigOpen(false)}
          title="Configure Global Scopes"
          fieldName="journalScopes"
          type="string-list"
          initialItems={globalSettings?.journalScopes || []}
        />
      )}
      {/* Quick Data Modal for Active Service Tabs */}
      <Modal
        isOpen={!!quickDataModalType}
        onClose={() => setQuickDataModalType(null)}
        title={
          quickDataModalType === 'issn' ? 'Add / Update ISSN Data' :
          quickDataModalType === 'doi' ? 'Update DOI Infrastructure' :
          quickDataModalType === 'publisher' ? 'Link / Select Publisher' :
          quickDataModalType === 'hec' ? 'Add / Update HEC Recognition Details' :
          quickDataModalType === 'doaj' ? 'Add / Update DOAJ Indexing Details' :
          quickDataModalType === 'ojs' ? 'Add / Update OJS Platform Details' :
          quickDataModalType === 'domain' ? 'Add / Update Domain Infrastructure' :
          quickDataModalType === 'hosting' ? 'Add / Update Hosting Environment' : 'Tab Data'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveQuickData} className="space-y-4">
          {quickDataModalType === 'issn' && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">Print ISSN</label>
                <input 
                  type="text"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                  placeholder="e.g. 1234-5678"
                  value={quickFormData.issnPrint || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, issnPrint: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">Online ISSN</label>
                <input 
                  type="text"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                  placeholder="e.g. 8765-4321"
                  value={quickFormData.issnOnline || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, issnOnline: e.target.value })}
                />
              </div>
            </>
          )}

          {quickDataModalType === 'doi' && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">DOI Prefix</label>
                <input 
                  type="text"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                  placeholder="e.g. 10.12345"
                  value={quickFormData.doiPrefix || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, doiPrefix: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">Journal Public URL</label>
                <input 
                  type="url"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                  placeholder="https://..."
                  value={quickFormData.url || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, url: e.target.value })}
                />
              </div>
            </>
          )}

          {quickDataModalType === 'publisher' && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">Select Existing Publisher</label>
                <select
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                  value={quickFormData.publisherId || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, publisherId: e.target.value, newPublisherName: '' })}
                >
                  <option value="">-- Choose Publisher --</option>
                  {publishers.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.city}, {p.country})</option>
                  ))}
                </select>
              </div>

              {!quickFormData.publisherId && (
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                  <p className="text-xs font-black text-indigo-900 uppercase">Or Create New Publisher</p>
                  <input 
                    type="text"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                    placeholder="Publisher Name"
                    value={quickFormData.newPublisherName || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, newPublisherName: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                      placeholder="City"
                      value={quickFormData.newPublisherCity || ''}
                      onChange={(e) => setQuickFormData({ ...quickFormData, newPublisherCity: e.target.value })}
                    />
                    <input 
                      type="text"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                      placeholder="Country"
                      value={quickFormData.newPublisherCountry || ''}
                      onChange={(e) => setQuickFormData({ ...quickFormData, newPublisherCountry: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {quickDataModalType === 'hec' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">HEC Category</label>
                  <select
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    value={quickFormData.category || 'Y'}
                    onChange={(e) => setQuickFormData({ ...quickFormData, category: e.target.value })}
                  >
                    <option value="W">W Category</option>
                    <option value="X">X Category</option>
                    <option value="Y">Y Category</option>
                    <option value="Z">Z Category</option>
                    <option value="Uncategorized">Uncategorized</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Recognition Status</label>
                  <input 
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="e.g. Recognized"
                    value={quickFormData.recognitionStatus || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, recognitionStatus: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Approval Date</label>
                  <input 
                    type="date"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    value={quickFormData.approvalDate || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, approvalDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Expiry Date</label>
                  <input 
                    type="date"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    value={quickFormData.expiryDate || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, expiryDate: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {quickDataModalType === 'doaj' && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">DOAJ Inclusion Date</label>
                <input 
                  type="date"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                  value={quickFormData.inclusionDate || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, inclusionDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">DOAJ Profile Link</label>
                <input 
                  type="url"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                  placeholder="https://doaj.org/toc/..."
                  value={quickFormData.link || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, link: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input 
                  type="checkbox"
                  id="metadataCompliance"
                  checked={quickFormData.metadataCompliance ?? true}
                  onChange={(e) => setQuickFormData({ ...quickFormData, metadataCompliance: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="metadataCompliance" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Metadata Compliant with DOAJ Standards
                </label>
              </div>
            </>
          )}

          {quickDataModalType === 'ojs' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">OJS Version</label>
                  <input 
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="e.g. 3.3.0.20"
                    value={quickFormData.ojsVersion || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, ojsVersion: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Support Plan</label>
                  <select
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    value={quickFormData.supportStatus || 'Community Support'}
                    onChange={(e) => setQuickFormData({ ...quickFormData, supportStatus: e.target.value })}
                  >
                    <option value="Community Support">Community Support</option>
                    <option value="Managed OJS Standard">Managed OJS Standard</option>
                    <option value="Enterprise OJS Premium">Enterprise OJS Premium</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Public URL</label>
                  <input 
                    type="url"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="https://journal.org/index.php"
                    value={quickFormData.url || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Admin URL</label>
                  <input 
                    type="url"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="https://journal.org/index.php/admin"
                    value={quickFormData.adminUrl || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, adminUrl: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Admin Username</label>
                  <input 
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="admin"
                    value={quickFormData.adminUsername || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, adminUsername: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">PHP Version / DB</label>
                  <input 
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="e.g. 8.1 / MySQL"
                    value={quickFormData.phpVersion || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, phpVersion: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">Notes</label>
                <textarea 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs h-20 resize-none"
                  placeholder="Additional technical setup details..."
                  value={quickFormData.notes || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, notes: e.target.value })}
                />
              </div>
            </>
          )}

          {quickDataModalType === 'domain' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Domain Name</label>
                  <input 
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="e.g. journaldomain.org"
                    value={quickFormData.domainName || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, domainName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Registrar</label>
                  <input 
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="e.g. Namecheap"
                    value={quickFormData.registrar || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, registrar: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Expiration Date</label>
                  <input 
                    type="date"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    value={quickFormData.expirationDate || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, expirationDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Nameservers</label>
                  <input 
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="ns1.hosta.com, ns2.hosta.com"
                    value={quickFormData.nameservers || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, nameservers: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">Notes</label>
                <textarea 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs h-20 resize-none"
                  placeholder="DNS records or domain transfer notes..."
                  value={quickFormData.notes || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, notes: e.target.value })}
                />
              </div>
            </>
          )}

          {quickDataModalType === 'hosting' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Provider / Server</label>
                  <input 
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="e.g. Hesta Managed Cloud"
                    value={quickFormData.provider || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, provider: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Server Status</label>
                  <select
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    value={quickFormData.status || 'Running'}
                    onChange={(e) => setQuickFormData({ ...quickFormData, status: e.target.value })}
                  >
                    <option value="Running">Running</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Server IP</label>
                  <input 
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="e.g. 192.168.1.10"
                    value={quickFormData.ipAddress || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, ipAddress: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Server Specs</label>
                  <input 
                    type="text"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                    placeholder="e.g. 4 vCPU / 8GB RAM"
                    value={quickFormData.serverSpecs || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, serverSpecs: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">Control Panel / Access URL</label>
                <input 
                  type="url"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs"
                  placeholder="https://cpanel.domain.com"
                  value={quickFormData.controlPanelUrl || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, controlPanelUrl: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">Notes</label>
                <textarea 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs h-20 resize-none"
                  placeholder="Technical hosting details..."
                  value={quickFormData.notes || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, notes: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setQuickDataModalType(null)}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all text-xs"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSavingQuickData}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 text-xs flex items-center justify-center gap-2"
            >
              {isSavingQuickData ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Data
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteJournal}
        title="Move to Trash"
        message={`Are you sure you want to move "${journal.title}" to trash?`}
        confirmText="Move to Trash"
        variant="danger"
      />
    </div>
  );
};

const ServiceUpsell = ({ service, description, onSubscribe }: { service: string, description: string, onSubscribe: () => void }) => (
  <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-6 animate-in fade-in zoom-in-95">
    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shadow-inner">
      <Sparkles size={40} />
    </div>
    <div className="space-y-2 max-w-sm">
      <h3 className="text-xl font-black text-slate-900">Unlock {service} Management</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
    <button 
      onClick={onSubscribe}
      className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
    >
      <Zap size={18} />
      Subscribe Service
    </button>
  </div>
);

const SubscriptionBadge = ({ isSubscribed, onToggle, serviceName, isAdmin }: { isSubscribed: boolean, onToggle: (enabled: boolean) => void, serviceName: string, isAdmin: boolean }) => (
  <div className={cn(
    "flex items-center justify-between p-4 rounded-2xl border transition-all mb-6",
    isSubscribed ? "bg-emerald-50 border-emerald-100 shadow-sm" : "bg-slate-50 border-slate-200"
  )}>
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-3 h-3 rounded-full animate-pulse",
        isSubscribed ? "bg-emerald-500" : "bg-slate-300"
      )} />
      <div>
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
          {isSubscribed ? 'Subscribed with Us' : 'Not Subscribed with Us'}
        </h4>
        <p className="text-[10px] text-slate-500 font-bold">
          {isSubscribed ? `Billing & Workflow tracking active for ${serviceName}` : `Data used for informational purposes only.`}
        </p>
      </div>
    </div>
    {isAdmin && (
      <button 
        onClick={() => onToggle(!isSubscribed)}
        className={cn(
          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95",
          isSubscribed 
            ? "bg-white text-rose-600 border border-rose-100 hover:bg-rose-50" 
            : "bg-indigo-600 text-white hover:bg-indigo-700"
        )}
      >
        {isSubscribed ? 'Deactivate Managed' : 'Activate Managed'}
      </button>
    )}
  </div>
);

const ServiceTabContent = ({ 
  tab, 
  journal, 
  isEditing, 
  editData, 
  setEditData, 
  indexingRecords, 
  agencies, 
  journalTasks, 
  scholarHistory, 
  publishers,
  currentUser,
  setIsActivateServiceModalOpen,
  setServiceToActivate,
  isAdmin,
  check,
  setIsIndexingModalOpen,
  setIsScholarModalOpen,
  copiedField,
  setCopiedField,
  formatDateForInput,
  onNavigateToPublisher,
  employees,
  onToggleSubscription,
  journalClientServices,
  setSelectedCsId,
  setIsChecklistModalOpen,
  toggleChecklistItem,
  domains,
  onOpenQuickDataModal
}: any) => {
  const isSubscribed = (service: string) => journal.subscribed_services?.includes(service);
  
  const handleToggle = (service: string) => (enabled: boolean) => {
    onToggleSubscription(service, enabled);
  };

  switch (tab) {
    case 'issn':
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
          <SubscriptionBadge 
            isSubscribed={isSubscribed('ISSN')} 
            onToggle={handleToggle('ISSN')} 
            serviceName="ISSN"
            isAdmin={isAdmin}
          />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">ISSN Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Print ISSN</p>
              {isEditing ? (
                <input 
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1"
                  value={editData.issnPrint || ''}
                  onChange={(e) => setEditData({ ...editData, issnPrint: e.target.value })}
                />
              ) : (
                <p className="text-lg font-black text-slate-900">{journal.issnPrint || 'N/A'}</p>
              )}
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Online ISSN</p>
              {isEditing ? (
                <input 
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1"
                  value={editData.issnOnline || ''}
                  onChange={(e) => setEditData({ ...editData, issnOnline: e.target.value })}
                />
              ) : (
                <p className="text-lg font-black text-slate-900">{journal.issnOnline || 'N/A'}</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 mt-6">
            <ISSNRequests 
              currentUser={currentUser}
              journalId={journal.id}
              onNavigateToPublisher={onNavigateToPublisher}
              searchQuery=""
            />
          </div>
        </div>
      );

    case 'doi':
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
          <SubscriptionBadge 
            isSubscribed={isSubscribed('DOI')} 
            onToggle={handleToggle('DOI')} 
            serviceName="DOI"
            isAdmin={isAdmin}
          />
          
          <div className="border-t border-slate-100 pt-2">
            <DOIManagement 
              currentUser={currentUser}
              journalId={journal.id}
            />
          </div>
        </div>
      );

    case 'publisher':
      const publisher = publishers.find((p: any) => p.id === journal.publisherId);
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Publisher Information</h3>
          </div>
          {publisher ? (
            <div 
              onClick={() => onNavigateToPublisher?.(publisher.id)}
              className="p-6 bg-slate-50 rounded-3xl border border-slate-100 cursor-pointer hover:bg-slate-100 hover:border-indigo-200 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-2xl border border-slate-200 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                  {publisher.logoUrl ? (
                    <img src={publisher.logoUrl} alt={publisher.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <Briefcase size={24} className="text-indigo-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-slate-900 text-lg uppercase">{publisher.name}</h4>
                  <p className="text-sm text-slate-500">{publisher.city}, {publisher.country}</p>
                </div>
                <ChevronRight className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ) : (
            <div className="p-12 border-2 border-dashed border-slate-200 rounded-[2rem] text-center text-slate-400 font-bold">
              No publisher linked. Click Edit to select.
            </div>
          )}
        </div>
      );

    case 'hec':
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
          <SubscriptionBadge 
            isSubscribed={isSubscribed('HEC')} 
            onToggle={handleToggle('HEC')} 
            serviceName="HEC"
            isAdmin={isAdmin}
          />
          <div className="flex items-center gap-2 mb-4">
            <Shield className="text-indigo-600" size={24} />
            <h3 className="text-lg font-bold text-slate-900">HEC Recognition Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-400 uppercase">Current Category</p>
                <p className="text-2xl font-black text-indigo-700">{journal.hec_details?.category || 'No Category Assigned'}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Recognition Status</p>
                {isEditing ? (
                   <input 
                   type="text"
                   className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm"
                   value={editData.hec_details?.recognitionStatus || ''}
                   onChange={(e) => setEditData({ 
                     ...editData, 
                     hec_details: { ...(editData.hec_details || {}), recognitionStatus: e.target.value } 
                   })}
                 />
                ) : (
                  <p className="text-sm font-bold text-slate-700">{journal.hec_details?.recognitionStatus || 'N/A'}</p>
                )}
              </div>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                <span className="text-xs font-bold text-slate-500 uppercase">Approval Date</span>
                {isEditing ? (
                  <input 
                    type="date"
                    className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-bold"
                    value={editData.hec_details?.approvalDate || ''}
                    onChange={(e) => setEditData({ 
                      ...editData, 
                      hec_details: { ...(editData.hec_details || {}), approvalDate: e.target.value } 
                    })}
                  />
                ) : (
                  <span className="text-sm font-bold text-slate-900">{journal.hec_details?.approvalDate || 'N/A'}</span>
                )}
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                <span className="text-xs font-bold text-slate-500 uppercase">Expiry Date</span>
                {isEditing ? (
                  <input 
                    type="date"
                    className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-bold"
                    value={editData.hec_details?.expiryDate || ''}
                    onChange={(e) => setEditData({ 
                      ...editData, 
                      hec_details: { ...(editData.hec_details || {}), expiryDate: e.target.value } 
                    })}
                  />
                ) : (
                  <span className="text-sm font-bold text-rose-600">{journal.hec_details?.expiryDate || 'N/A'}</span>
                )}
              </div>
              {journal.hec_details?.documents && journal.hec_details.documents.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <FileText size={10} /> Attachments
                  </p>
                  {journal.hec_details?.documents?.map((doc: string, idx: number) => (
                    <a 
                      key={idx}
                      href={doc} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:underline"
                    >
                      <ExternalLink size={12} />
                      Document {idx + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 mt-6">
            <HEC 
              currentUser={currentUser}
              journalId={journal.id}
              onNavigateToPublisher={onNavigateToPublisher}
            />
          </div>
        </div>
      );

    case 'doaj':
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
          <SubscriptionBadge 
            isSubscribed={isSubscribed('DOAJ')} 
            onToggle={handleToggle('DOAJ')} 
            serviceName="DOAJ"
            isAdmin={isAdmin}
          />
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="text-indigo-600" size={24} />
            <h3 className="text-lg font-bold text-slate-900">DOAJ Details</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Inclusion Date</p>
              {isEditing ? (
                <input 
                  type="date"
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold"
                  value={editData.doaj_details?.inclusionDate || ''}
                  onChange={(e) => setEditData({ 
                    ...editData, 
                    doaj_details: { ...(editData.doaj_details || {}), inclusionDate: e.target.value } 
                  })}
                />
              ) : (
                <p className="text-sm font-bold text-slate-900">{journal.doaj_details?.inclusionDate || 'N/A'}</p>
              )}
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Compliance</span>
                <span className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold uppercase",
                  journal.doaj_details?.metadataCompliance ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                )}>
                  {journal.doaj_details?.metadataCompliance ? 'Compliant' : 'Non-Compliant'}
                </span>
              </div>
              {journal.doaj_details?.link ? (
                <a 
                  href={journal.doaj_details.link} 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                >
                  <ExternalLink size={14} />
                  View DOAJ Profile
                </a>
              ) : (
                <p className="text-[10px] text-slate-400 italic text-center">No DOAJ profile link found.</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 mt-6">
            <DOAJApplications 
              currentUser={currentUser}
              journalId={journal.id}
            />
          </div>
        </div>
      );

    case 'ojs':
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
          <SubscriptionBadge 
            isSubscribed={isSubscribed('OJS')} 
            onToggle={handleToggle('OJS')} 
            serviceName="OJS"
            isAdmin={isAdmin}
          />
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-900">OJS Platform</h3>
            {isEditing ? (
              <select 
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-[10px] uppercase outline-none focus:ring-1 focus:ring-indigo-500"
                value={editData.ojsVersion || ''}
                onChange={(e) => setEditData({ ...editData, ojsVersion: e.target.value })}
              >
                <option value="">Version</option>
                {[
                  '3.3.0.8', '3.3.0.9', '3.3.0.10', '3.3.0.11', '3.3.0.12', 
                  '3.3.0.13', '3.3.0.14', '3.3.0.15', '3.3.0.16', '3.3.0.17', 
                  '3.3.0.18', '3.3.0.19', '3.3.0.20', '3.3.0.21'
                ].sort((a, b) => a.localeCompare(b)).map(v => (
                  <option key={v} value={v}>OJS {v}</option>
                ))}
              </select>
            ) : (
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[10px] uppercase">
                Version {journal.ojsVersion || '3.x'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Support Plan</p>
              <p className="text-sm font-bold text-slate-700">{journal.ojs_details?.supportStatus || 'Community Support'}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Hosting Status</p>
              <p className="text-sm font-bold text-emerald-600">{journal.ojs_details?.hostingStatus || 'Active'}</p>
            </div>
          </div>
        </div>
      );

    case 'indexing':
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
          <SubscriptionBadge 
            isSubscribed={isSubscribed('Indexing')} 
            onToggle={handleToggle('Indexing')} 
            serviceName="Indexing"
            isAdmin={isAdmin}
          />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="text-emerald-600" size={20} />
              <h3 className="text-lg font-bold text-slate-900">Indexing Status</h3>
            </div>
            {check('indexingAgencies', 'edit') && (
              <button 
                onClick={() => setIsIndexingModalOpen(true)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
              >
                Manage Indexing
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-emerald-600 uppercase">Indexed</p>
                <p className="text-2xl font-black text-emerald-700">{indexingRecords.filter(r => r.status === 'indexed').length}</p>
              </div>
              <CheckCircle2 className="text-emerald-200" size={32} />
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase">Pending</p>
                <p className="text-2xl font-black text-amber-700">{indexingRecords.filter(r => r.status === 'pending' || r.status === 'applied').length}</p>
              </div>
              <Activity className="text-amber-200" size={32} />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Agency Records</h4>
            {indexingRecords.filter((r: any) => r.status !== 'not_indexed').map((record: any) => {
              const agency = agencies.find((a: any) => a.id === record.agencyId);
              return (
                <div key={`idx-record-${record.id}`} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between hover:border-indigo-100 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100">
                      {agency?.logoUrl ? (
                         <img src={agency.logoUrl} alt={agency.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                         <Globe size={20} className="text-slate-300" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{agency?.name || 'Unknown Agency'}</p>
                      <p className="text-[10px] text-slate-500 font-medium">Applied: {record.appliedAt || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      record.status === 'indexed' ? "bg-emerald-100 text-emerald-700" :
                      record.status === 'not_indexed' ? "bg-rose-100 text-rose-700" :
                      "bg-amber-100 text-amber-700"
                    )}>
                      {(record.status && typeof record.status === 'string') ? record.status.replace('_', ' ') : 'Pending'}
                    </span>
                    {record.journalPageUrl && (
                      <a href={record.journalPageUrl} target="_blank" rel="noreferrer" className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {indexingRecords.filter((r: any) => r.status !== 'not_indexed').length === 0 && <div className="text-center py-12 text-slate-400 italic">No indexing records found.</div>}
          </div>
        </div>
      );

    case 'vault':
      if (!(isAdmin || check('journals', 'edit'))) return <div className="text-center py-20 text-slate-400 italic">Restricted Access</div>;
      return <CredentialVault journalId={journal.id} currentUser={currentUser} />;

    case 'catalog':
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-black text-slate-900 uppercase">Service Catalog Subscriptions</h3>
            <button 
              onClick={() => setIsActivateServiceModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
            >
              <Plus size={14} /> New Subscription
            </button>
          </div>
          
          <div className="space-y-4">
            {journalClientServices.length === 0 ? (
              <div className="py-20 text-center space-y-4 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-300 mx-auto shadow-sm">
                  <Package size={32} />
                </div>
                <div>
                  <p className="text-slate-500 font-bold">No catalog services linked to this journal.</p>
                  <p className="text-[10px] text-slate-400 font-medium">Activate professional services via the Service Catalog system.</p>
                </div>
              </div>
            ) : (
              journalClientServices.map(cs => (
                <div key={cs.id} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:border-indigo-100 transition-all space-y-4 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Package size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-lg uppercase leading-none">{cs.serviceName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded">{cs.tierName}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">• Subscribed {new Date(cs.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                          cs.status === 'Completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          cs.status === 'In Progress' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                          "bg-slate-50 text-slate-500 border-slate-100"
                        )}>
                          {cs.status}
                        </span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600" style={{ width: `${cs.progress}%` }} />
                        </div>
                        <span className="text-xs font-black text-slate-900">{cs.progress}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                         <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Client Checklist
                         </h5>
                         <button 
                           onClick={() => {
                             setSelectedCsId(cs.id);
                             setIsChecklistModalOpen(true);
                           }}
                           className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-all uppercase tracking-tight flex items-center gap-1"
                         >
                           <Plus size={10} /> Add Item
                         </button>
                       </div>
                       <div className="space-y-2">
                         {cs.clientChecklistProgress && Object.entries(cs.clientChecklistProgress).length > 0 ? (
                            Object.entries(cs.clientChecklistProgress).map(([id, item]: [string, any]) => (
                              <div 
                               key={id} 
                               onClick={() => toggleChecklistItem(cs.id, id, item.status)}
                               className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg group/item cursor-pointer hover:bg-slate-100 transition-all"
                             >
                               <div className={cn(
                                 "mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all",
                                 item.status === 'completed' ? "bg-emerald-500 border-emerald-500" : "bg-white border-slate-300"
                               )}>
                                 {item.status === 'completed' && <Check size={10} className="text-white" />}
                               </div>
                               <div className="flex-1">
                                 <p className={cn(
                                   "text-[11px] font-bold leading-tight",
                                   item.status === 'completed' ? "text-slate-400 line-through" : "text-slate-700"
                                 )}>
                                   {item.label}
                                 </p>
                                 {item.updatedAt && (
                                   <p className="text-[8px] text-slate-400 mt-0.5">Updated {new Date(item.updatedAt).toLocaleDateString()}</p>
                                 )}
                               </div>
                             </div>
                           ))
                         ) : (
                           <p className="text-[10px] text-slate-500 italic">No checklist items defined yet.</p>
                         )}
                       </div>
                    </div>
                    <div className="space-y-4">
                       <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Employee Tasks
                       </h5>
                       <div className="space-y-2">
                         {journalTasks.filter(t => t.clientServiceId === cs.id).slice(0, 3).map(task => (
                           <div key={task.id} className="flex items-center justify-between text-[10px] font-bold p-2 bg-slate-50 rounded-lg">
                             <span className="text-slate-700 truncate max-w-[150px]">{task.title}</span>
                             <span className={cn(
                               "px-1.5 py-0.5 rounded uppercase",
                               task.status === 'completed' ? "text-emerald-600 bg-emerald-100" : "text-amber-600 bg-amber-100"
                             )}>{task.status}</span>
                           </div>
                         ))}
                         {journalTasks.filter(t => t.clientServiceId === cs.id).length === 0 && (
                           <p className="text-[10px] text-slate-400 italic">No tasks active yet.</p>
                         )}
                       </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );

    case 'history':
      return (
        <ScholarHistory journalId={journal.id} currentUser={currentUser} />
      );

    case 'domain':
      const linkedDomain = domains?.find((d: any) => d.id === journal.domainId);
      const domainName = journal.domain_details?.domainName || linkedDomain?.domainName || 'External Domain';
      const registrar = journal.domain_details?.registrar || linkedDomain?.registrar || 'Namecheap';
      const expDate = journal.domain_details?.expirationDate || linkedDomain?.expirationDate || 'N/A';
      const nameservers = journal.domain_details?.nameservers || 'ns1.hosta.com, ns2.hosta.com';

      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
          <SubscriptionBadge 
            isSubscribed={isSubscribed('Domain')} 
            onToggle={handleToggle('Domain')} 
            serviceName="Domain"
            isAdmin={isAdmin}
          />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe className="text-indigo-600" size={20} />
              <h3 className="text-lg font-bold text-slate-900">Domain Infrastructure</h3>
            </div>
            {onOpenQuickDataModal && (
              <button 
                onClick={() => onOpenQuickDataModal('domain')}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Edit size={14} />
                Add / Edit Domain Data
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Registered Domain</p>
              <p className="text-base font-black text-indigo-900">{domainName}</p>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Registrar</p>
              <p className="text-base font-bold text-slate-800">{registrar}</p>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Expiration Date</p>
              <p className="text-sm font-bold text-slate-800">{expDate}</p>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nameservers</p>
              <p className="text-xs font-mono font-bold text-slate-700">{nameservers}</p>
            </div>
          </div>

          {journal.domain_details?.notes && (
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
              <p className="text-[10px] font-black text-indigo-900 uppercase tracking-wider mb-1">Domain Notes</p>
              <p className="text-xs text-slate-700 font-medium">{journal.domain_details.notes}</p>
            </div>
          )}
        </div>
      );

    case 'hosting':
      const hostingProvider = journal.hosting_details?.provider || (isSubscribed('Hosting') ? 'Hesta Enterprise Server' : 'External Hosting');
      const hostingStatus = journal.hosting_details?.status || 'Running';
      const serverSpecs = journal.hosting_details?.serverSpecs || '4 vCPU / 8GB RAM / 100GB NVMe SSD';
      const ipAddress = journal.hosting_details?.ipAddress || '192.168.1.1';

      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
          <SubscriptionBadge 
            isSubscribed={isSubscribed('Hosting')} 
            onToggle={handleToggle('Hosting')} 
            serviceName="Hosting"
            isAdmin={isAdmin}
          />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Server className="text-indigo-600" size={20} />
              <h3 className="text-lg font-bold text-slate-900">Hosting Environment</h3>
            </div>
            {onOpenQuickDataModal && (
              <button 
                onClick={() => onOpenQuickDataModal('hosting')}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Edit size={14} />
                Add / Edit Hosting Data
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Provider / Machine</p>
              <p className="text-base font-black text-slate-900">{hostingProvider}</p>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</p>
              <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase">
                {hostingStatus}
              </span>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Server Specs</p>
              <p className="text-xs font-bold text-slate-800">{serverSpecs}</p>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Server IP</p>
              <p className="text-xs font-mono font-bold text-slate-800">{ipAddress}</p>
            </div>
          </div>

          {journal.hosting_details?.controlPanelUrl && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Control Panel Link</p>
                <p className="text-xs font-bold text-slate-800">{journal.hosting_details.controlPanelUrl}</p>
              </div>
              <a 
                href={journal.hosting_details.controlPanelUrl} 
                target="_blank" 
                rel="noreferrer"
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-700 transition-all"
              >
                <ExternalLink size={14} /> Open Control Panel
              </a>
            </div>
          )}

          {journal.hosting_details?.notes && (
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
              <p className="text-[10px] font-black text-indigo-900 uppercase tracking-wider mb-1">Hosting Notes</p>
              <p className="text-xs text-slate-700 font-medium">{journal.hosting_details.notes}</p>
            </div>
          )}
        </div>
      );

    case 'work-history':
      return (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="text-indigo-600" size={20} />
              <h3 className="text-lg font-bold text-slate-900">Task Performance</h3>
            </div>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold uppercase tracking-widest">
              {journalTasks.length} Completed Tasks
            </span>
          </div>
          <div className="space-y-3">
            {journalTasks.map((task: any) => (
              <div key={task.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-indigo-100 transition-all group">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{task.title}</p>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        task.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>{task.status}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Assigned to: {(employees.find((e: any) => e.id === task.assignedTo))?.name || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">+{task.points}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Points</p>
                  </div>
                </div>
              </div>
            ))}
            {journalTasks.length === 0 && (
              <div className="text-center py-12 text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No operational tasks found.
              </div>
            )}
          </div>
        </div>
      );

    default:
      return null;
  }
};
