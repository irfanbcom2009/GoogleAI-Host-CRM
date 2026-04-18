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
  LayoutDashboard
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
  ISSNRequest
} from '../types';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { doc, updateDoc, onSnapshot, serverTimestamp, collection, query, where, addDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { cn, formatDateForInput } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService } from '../services/geminiService';
import { ConfigModal } from './ConfigModal';
import { toast } from 'react-hot-toast';
import { Sparkles, Loader2 } from 'lucide-react';

import { SmartRecommendations } from './SmartRecommendations';
import { recommendationService } from '../services/recommendationService';
import { JournalIndexingManager } from './JournalIndexingManager';
import { generateTasksForService } from '../lib/taskUtils';
import { Modal } from './Modal';
import { SearchableSelect } from './ui/SearchableSelect';
import { FloatingActionBar } from './FloatingActionBar';
import { usePermissions } from '../hooks/usePermissions';
import { JournalHealthDashboard } from './JournalHealthDashboard';
import { CredentialVault } from './CredentialVault';

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
  const { check, isAdmin } = usePermissions(currentUser);
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
  const [newScholarLog, setNewScholarLog] = useState({ status: 'Indexed', tagOptimization: '' });
  const [isScholarModalOpen, setIsScholarModalOpen] = useState(false);
  const [isActivateServiceModalOpen, setIsActivateServiceModalOpen] = useState(false);
  const [serviceToActivate, setServiceToActivate] = useState<ServiceType | ''>('');
  const [activationData, setActivationData] = useState({
    invoiceNumber: '',
    invoiceId: '',
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    subscriptionType: 'annual' as 'one-time' | 'annual' | 'monthly'
  });

  const journalClient = clients.find(c => c.id === journal?.clientId);
  const recommendations = journalClient && journal 
    ? recommendationService.getRecommendations(journalClient, publishers, domains, [journal], journal.id)
    : [];

  const [aiHealth, setAiHealth] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSuggestingKeywords, setIsSuggestingKeywords] = useState(false);
  const [journalIssnRequests, setJournalIssnRequests] = useState<ISSNRequest[]>([]);
  const [isScopeConfigOpen, setIsScopeConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'health'>('overview');
  const [activeServiceTab, setActiveServiceTab] = useState<'issn' | 'doi' | 'publisher' | 'hec' | 'doaj' | 'ojs' | 'indexing' | 'vault' | 'history' | 'work-history'>('issn');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [journalTasks, setJournalTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!journalId) return;

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('journalId', '==', journalId), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setJournalTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => unsubTasks();
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
    if (!journalClient || !serviceToActivate || !journal) return;

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
            amount: 0, // Should probably be configurable
            quantity: 1,
            journalId: journal.id,
            serviceType: serviceToActivate
          };
          await updateDoc(invoiceRef, {
            items: [...(invoice.items || []), newItem],
            total: invoice.total + newItem.amount,
            updatedAt: serverTimestamp()
          });
        }
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
        subscriptionType: 'annual'
      });
      toast.success(`${serviceToActivate} activated successfully`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleGetAiHealth = async () => {
    if (!journal) return;
    setIsAiLoading(true);
    setIsAiModalOpen(true);
    try {
      const health = await geminiService.getJournalHealth({
        title: journal.title,
        status: journal.status,
        category: journal.category,
        ojsVersion: journal.ojsVersion,
        issnPrint: journal.issnPrint,
        issnOnline: journal.issnOnline,
        indexingCount: indexingRecords.length
      });
      setAiHealth(health);
    } catch (error) {
      setAiHealth("Failed to generate health check.");
    } finally {
      setIsAiLoading(false);
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

    return () => {
      unsubDomains();
      unsubPublishers();
      unsubHec();
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
    if (!currentUser) return;
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
    if (!journal) return;
    
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
        // Create Draft Invoice
        const invoiceNumber = `INV-AUTO-${Date.now().toString().slice(-6)}`;
        const issueDate = new Date().toISOString().split('T')[0];
        const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        let hecStageDetails = "";
        if (serviceName === 'HEC') {
          try {
            const hecQuery = query(collection(db, 'hec_applications'), where('journalId', '==', journal.id), limit(1));
            const hecSnap = await getDocs(hecQuery);
            if (!hecSnap.empty) {
              const hecData = hecSnap.docs[0].data();
              hecStageDetails = ` | Stage: ${hecData.currentStage || 1} (${hecData.status || 'Active'})`;
            }
          } catch (e) {
            console.warn("Could not fetch HEC application for invoice", e);
          }
        }

        const invoiceData = {
          invoiceNumber,
          clientId: journal.clientId,
          clientName: journal.clientName || 'Valued Client',
          journalId: journal.id,
          journalTitle: journal.title,
          issueDate,
          dueDate,
          date: issueDate,
          status: 'draft',
          billingType: 'one-time',
          currency: 'PKR',
          subscription_source: 'Journal',
          items: [
            {
              id: Math.random().toString(36).substr(2, 9),
              description: `Managed Subscription: ${serviceName} for ${journal.title}${hecStageDetails}`,
              quantity: 1,
              rate: 0,
              taxRate: 0,
              discountRate: 0,
              taxAmount: 0,
              discountAmount: 0,
              total: 0,
              serviceType: serviceName as any
            }
          ],
          subtotal: 0,
          taxTotal: 0,
          discountTotal: 0,
          total: 0,
          balance: 0,
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
    }
  };

  const handleSave = async () => {
    if (!journal) return;
    setIsSaving(true);
    try {
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
    <div className="p-8 max-w-5xl mx-auto space-y-8">
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
          {!isEditing && (
            <button 
              onClick={handleGetAiHealth}
              className="px-5 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-bold hover:bg-indigo-100 transition-all shadow-sm flex items-center gap-2"
            >
              <Sparkles size={18} />
              AI Health Check
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

      {/* Dynamic Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar border-b border-slate-100 mb-8">
        {[
          { id: 'overview', label: 'Journal Overview', icon: LayoutDashboard, show: true },
          { id: 'health', label: 'Journal Health Check', icon: Shield, show: true },
        ].filter(tab => tab.show).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap border-b-2",
              activeTab === tab.id 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 border-indigo-600" 
                : "bg-white text-slate-500 border-transparent hover:bg-slate-50"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Context Content */}
        <div className="lg:col-span-2 space-y-8">
          {activeTab === 'health' && (
            <div className="animate-in fade-in slide-in-from-left-4">
              <JournalHealthDashboard journal={journal} />
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-8">
                {/* Journal Basic Info Section */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative group/photo">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                        {journal.url ? (
                          <img 
                            src={`https://www.google.com/s2/favicons?sz=64&domain=${new URL(journal.url).hostname}`} 
                            alt="Journal"
                            className="w-full h-full object-cover"
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
                          <input 
                            type="text"
                            className="text-2xl font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                            value={editData.title || ''}
                            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                            placeholder="Journal Title"
                          />
                        </div>
                      ) : (
                        <div>
                          <h1 className="text-2xl font-black text-slate-900">{journal.title}</h1>
                          <p className="text-slate-500 font-medium">Subject: {journal.subjectCategory || 'Not set'}</p>
                        </div>
                      )}
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
                      {journal.status.replace('_', ' ')}
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
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Technical Hub</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-slate-600">
                        <Globe size={18} className="text-slate-400" />
                        <span className="text-sm font-medium">Domain: {domains.find(d => d.id === journal.domainId)?.domainName || 'Default'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-600">
                        <Settings2 size={18} className="text-slate-400" />
                        <span className="text-sm font-medium">Platform: {journal.ojsVersion ? `OJS ${journal.ojsVersion}` : 'No CMS Recorded'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SERVICE TABS INTERFACE */}
              <div className="space-y-6">
                <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar border-b border-slate-100">
                  {[
                    { id: 'issn', label: 'ISSN', icon: Hash },
                    { id: 'doi', label: 'DOI', icon: LinkIcon },
                    { id: 'publisher', label: 'Publisher', icon: Briefcase },
                    { id: 'hec', label: 'HEC', icon: Shield },
                    { id: 'doaj', label: 'DOAJ', icon: CheckCircle2 },
                    { id: 'ojs', label: 'OJS', icon: Globe },
                    { id: 'indexing', label: 'Indexing', icon: Database },
                    { id: 'vault', label: 'Vault', icon: Key },
                    { id: 'history', label: 'Scholar', icon: History },
                    { id: 'work-history', label: 'Work', icon: Activity }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveServiceTab(tab.id as any)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-t-xl font-bold transition-all whitespace-nowrap text-xs",
                        activeServiceTab === tab.id 
                          ? "bg-white text-indigo-600 border-x border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]" 
                          : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <tab.icon size={14} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 min-h-[400px]">
                  {/* Service Render Logic */}
                  <ServiceTabContent 
                    tab={activeServiceTab}
                    journal={journal}
                    isEditing={isEditing}
                    editData={editData}
                    setEditData={setEditData}
                    indexingRecords={indexingRecords}
                    agencies={agencies}
                    journalTasks={journalTasks}
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
                  />
                </div>
              </div>
            </div>
          )}
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
                  {['Hosting', 'Indexing', 'Editorial', 'OJS'].filter(s => !journal.subscribed_services?.includes(s)).slice(0, 4).map(s => (
                    <div key={s} className="px-3 py-2 bg-white/50 rounded-xl text-[10px] font-bold text-indigo-700 border border-indigo-100 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onClick={handleGetAiHealth}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
              >
                AI Insights Analysis
              </button>
            </div>
        </div>
      </div>

      {/* AI Health Modal */}
      <Modal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        title="Gemini AI Health Check"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <div className="p-3 bg-white text-indigo-600 rounded-xl shadow-sm">
              <Sparkles size={24} />
            </div>
            <div>
              <h4 className="font-bold text-indigo-900">Journal Health Analysis</h4>
              <p className="text-xs text-indigo-600">Powered by Gemini 1.5 Flash</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 min-h-[200px] relative">
            {isAiLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-sm font-medium">Analyzing journal data...</p>
              </div>
            ) : (
              <div className="prose prose-slate prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {aiHealth}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsAiModalOpen(false)}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            Close Health Check
          </button>
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
              value={newScholarLog.status}
              onChange={(value) => setNewScholarLog({ ...newScholarLog, status: value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Tag Optimization / Notes</label>
            <textarea 
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
              placeholder="Enter tag optimization details or status notes..."
              value={newScholarLog.tagOptimization}
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
                globalSettings.activatableServices.map((service: string) => ({ label: service, value: service }))
              ) : [
                { label: "Hosting", value: "Hosting" },
                { label: "DOI", value: "DOI" },
                { label: "ISSN", value: "ISSN" },
                { label: "OJS Setup", value: "OJS" },
                { label: "Editorial", value: "Editorial" },
                { label: "Indexing", value: "Indexing" },
                { label: "Plagiarism Check", value: "Plagiarism" },
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
                ...invoices.map(inv => ({ 
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
              value={activationData.invoiceNumber}
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
                value={activationData.startDate}
                onChange={(e) => setActivationData({ ...activationData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Expiry Date</label>
              <input 
                type="date"
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={activationData.expiryDate}
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
              value={activationData.subscriptionType}
              onChange={(value) => setActivationData({ ...activationData, subscriptionType: value as any })}
            />
          </div>

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
  onToggleSubscription
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
          <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl text-center space-y-4">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mx-auto">
              <LinkIcon size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">DOI Management Portal</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {isSubscribed('DOI') 
                ? 'Your DOI subscription is active. Advanced prefix management and article metadata submission portal is tracked.' 
                : 'DOI data can be stored here for reference. Subscribe to activate automatic metadata deposits.'}
            </p>
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
              onClick={() => onNavigateToPublisher(publisher.id)}
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
                  {journal.hec_details.documents.map((doc: string, idx: number) => (
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
              <input 
                type="text"
                placeholder="Version e.g. 3.3.0.14"
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-[10px] uppercase outline-none focus:ring-1 focus:ring-indigo-500"
                value={editData.ojsVersion || ''}
                onChange={(e) => setEditData({ ...editData, ojsVersion: e.target.value })}
              />
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
            {indexingRecords.map((record: any) => {
              const agency = agencies.find((a: any) => a.id === record.agencyId);
              return (
                <div key={record.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between hover:border-indigo-100 transition-all">
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
                      {record.status.replace('_', ' ')}
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
            {indexingRecords.length === 0 && <div className="text-center py-12 text-slate-400 italic">No indexing records found.</div>}
          </div>
        </div>
      );

    case 'vault':
      if (!(isAdmin || check('journals', 'edit'))) return <div className="text-center py-20 text-slate-400 italic">Restricted Access</div>;
      return <CredentialVault journalId={journal.id} currentUser={currentUser} />;

    case 'history':
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="text-indigo-600" size={24} />
              <h3 className="text-lg font-bold text-slate-900">Google Scholar History</h3>
            </div>
            <button 
              onClick={() => setIsScholarModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm"
            >
              <Plus size={16} /> Update History
            </button>
          </div>
          <div className="space-y-3">
            {scholarHistory.map((item: any) => (
              <div key={item.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2 rounded-xl",
                    item.status === 'Indexed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  )}>
                    <Activity size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.status}</p>
                    <p className="text-[10px] text-slate-500 font-medium">Recorded: {new Date(item.timestamp?.toDate?.() || item.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tag optimization</p>
                  <p className="text-xs font-black text-indigo-600">{item.tagOptimization || 'Standard'}</p>
                </div>
              </div>
            ))}
            {scholarHistory.length === 0 && (
              <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <History className="mx-auto text-slate-300 mb-3" size={32} />
                <p className="text-sm text-slate-400 italic">No Google Scholar logs recorded yet.</p>
              </div>
            )}
          </div>
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
