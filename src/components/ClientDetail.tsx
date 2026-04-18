import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Shield, 
  CheckCircle2, 
  XCircle,
  Clock,
  BookOpen,
  FileText,
  DollarSign,
  Plus,
  Loader2,
  Trash2,
  Edit,
  Copy,
  Key,
  Building2,
  Globe2,
  MessageSquare,
  Smartphone
} from 'lucide-react';
import { motion } from 'motion/react';
import { Client, Journal, Task, Invoice, User as UserType, Publisher, Domain, UserRole } from '../types';
import { useFieldPermissions } from '../hooks/useFieldPermissions';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType, moveToTrash } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import { ClientEditForm } from './ClientEditForm';
import { InvoiceDetail } from './InvoiceDetail';
import { ServiceType, JournalStatus, TaskStatus, TaskPriority } from '../types';

import { SmartRecommendations } from './SmartRecommendations';
import { recommendationService } from '../services/recommendationService';
import { JournalDetail } from './JournalDetail';
import { Publishers } from './Publishers';
import { Domains } from './Domains';
import { HierarchyWorkflow } from './HierarchyWorkflow';
import { generateTasksForService } from '../lib/taskUtils';
import { Subscription } from '../types';
import { geminiService } from '../services/geminiService';
import { Sparkles, Monitor } from 'lucide-react';

import { FloatingActionBar } from './FloatingActionBar';
import { toast } from 'react-hot-toast';

interface ClientDetailProps {
  client: Client;
  onBack: () => void;
  currentUser: UserType | null;
  initialEdit?: boolean;
  onImpersonate?: (user: { id: string, role: UserRole, name: string, email: string }) => void;
}

const SALUTATIONS = ['Mr.', 'Miss', 'Mrs.', 'Dr.', 'Prof.', 'Dr. Prof.'];

export const ClientDetail: React.FC<ClientDetailProps> = ({ client, onBack, currentUser, initialEdit = false, onImpersonate }) => {
  const { canView, canEdit, canDelete } = useFieldPermissions(currentUser);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'journals' | 'publishers' | 'domains' | 'hierarchy' | 'tasks' | 'invoices'>('journals');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUpdatingPortal, setIsUpdatingPortal] = useState(false);
  const [isEditing, setIsEditing] = useState(initialEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [editedClient, setEditedClient] = useState<Client>(client);
  const [activatableServices, setActivatableServices] = useState<string[]>([]);

  useEffect(() => {
    setEditedClient(client);
  }, [client]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing) return;
      
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveInline();
      }
      if (e.key === 'Escape') {
        handleCancelInline();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, editedClient]);

  useEffect(() => {
    if (isEditing) {
      const firstInput = document.querySelector('input, select, textarea');
      if (firstInput) {
        (firstInput as HTMLElement).focus();
        firstInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isEditing]);

  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setActivatableServices(data.activatableServices || []);
        }
      } catch (error) {
        console.error('Error fetching global settings:', error);
      }
    };
    fetchGlobalSettings();
  }, []);

  const handleSaveInline = async () => {
    // Restriction: Only admin can add/edit clients with gmail address
    const isSystemAdmin = currentUser?.role === 'Admin' || 
                         ['irfanbcom2009@gmail.com', 'ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'].includes(currentUser?.email || '');
    
    if (editedClient.email.toLowerCase().endsWith('@gmail.com') && !isSystemAdmin) {
      toast.error("Only administrators can manage records with @gmail.com addresses.");
      return;
    }

    setIsSaving(true);
    try {
      const clientRef = doc(db, 'users', client.id);
      await updateDoc(clientRef, {
        salutation: editedClient.salutation || '',
        name: editedClient.name,
        photoURL: editedClient.photoURL || '',
        careOf: editedClient.careOf || '',
        email: editedClient.email,
        phone: editedClient.phone || '',
        address: editedClient.address || '',
        status: editedClient.status,
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelInline = () => {
    setEditedClient(client);
    setIsEditing(false);
  };

  const handleTogglePortal = async () => {
    if (currentUser?.role !== 'Admin') return;
    setIsUpdatingPortal(true);
    try {
      await updateDoc(doc(db, 'users', client.id), {
        portalEnabled: !client.portalEnabled
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsUpdatingPortal(false);
    }
  };

  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const handleGetAiInsights = async () => {
    setIsAiLoading(true);
    setIsAiModalOpen(true);
    try {
      const insights = await geminiService.getClientInsights({
        name: client.name,
        status: client.status,
        points: client.points,
        subscriptions: client.subscriptions,
        journalsCount: journals.length,
        tasksCount: tasks.length
      });
      setAiInsights(insights);
    } catch (error) {
      setAiInsights("Failed to generate insights.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const [isNewJournalModalOpen, setIsNewJournalModalOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isActivateServiceModalOpen, setIsActivateServiceModalOpen] = useState(false);
  const [serviceToActivate, setServiceToActivate] = useState<ServiceType | ''>('');
  const [activationData, setActivationData] = useState({
    invoiceNumber: '',
    invoiceId: '',
    startDate: '',
    expiryDate: '',
    subscriptionType: 'annual' as 'one-time' | 'annual' | 'monthly'
  });
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [selectedJournalId, setSelectedJournalId] = useState<{ id: string, editMode?: boolean } | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [viewingJournalId, setViewingJournalId] = useState<string | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);

  const recommendations = recommendationService.getRecommendations(client, publishers, domains, journals);

  const [newJournal, setNewJournal] = useState({
    title: '',
    category: '',
    ojsVersion: '3.3.0',
    status: 'pending_issn' as JournalStatus,
    url: ''
  });

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    serviceType: 'Hosting' as ServiceType,
    priority: 'medium' as TaskPriority,
    status: 'pending' as TaskStatus,
    dueDate: '',
    assignedTo: '',
    assignedToName: '',
    isClientVisible: true
  });

  useEffect(() => {
    if (initialEdit) {
      setIsEditModalOpen(true);
    }
  }, [initialEdit]);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', 'in', ['Admin', 'Manager', 'Employee']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UserType));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const journalsQuery = query(collection(db, 'journals'), where('clientId', '==', client.id));
    const tasksQuery = query(collection(db, 'tasks'), where('clientId', '==', client.id), orderBy('createdAt', 'desc'));
    const invoicesQuery = query(collection(db, 'invoices'), where('clientId', '==', client.id), orderBy('createdAt', 'desc'));

    const unsubJournals = onSnapshot(journalsQuery, (snapshot) => {
      setJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal)));
    });

    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    const unsubInvoices = onSnapshot(invoicesQuery, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
    });

    const publishersQuery = query(collection(db, 'publishers'), where('clientId', '==', client.id));
    const unsubPublishers = onSnapshot(publishersQuery, (snapshot) => {
      setPublishers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Publisher)));
    });

    const domainsQuery = query(collection(db, 'domains'), where('clientId', '==', client.id));
    const unsubDomains = onSnapshot(domainsQuery, (snapshot) => {
      setDomains(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Domain)));
      setLoading(false);
    });

    return () => {
      unsubJournals();
      unsubTasks();
      unsubInvoices();
      unsubPublishers();
      unsubDomains();
    };
  }, [client.id]);

  const handleDeleteClient = async () => {
    try {
      await moveToTrash('users', client.id, client, currentUser?.name || 'Unknown');
      onBack();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'clients');
    }
  };

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'journals'), {
        ...newJournal,
        clientId: client.id,
        clientName: client.name,
        createdAt: serverTimestamp()
      });
      setIsNewJournalModalOpen(false);
      setNewJournal({
        title: '',
        category: '',
        ojsVersion: '3.3.0',
        status: 'pending_issn',
        url: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'journals');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'tasks'), {
        ...newTask,
        clientId: client.id,
        clientName: client.name,
        points: newTask.priority === 'urgent' ? 50 : newTask.priority === 'high' ? 30 : 10,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsNewTaskModalOpen(false);
      setNewTask({
        title: '',
        description: '',
        serviceType: 'Hosting',
        priority: 'medium',
        status: 'pending',
        dueDate: '',
        assignedTo: '',
        assignedToName: '',
        isClientVisible: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const handleActivateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceToActivate) return;

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

      const updatedSubscriptions = [...(client.subscriptions || []), newSubscription];

      await updateDoc(doc(db, 'users', client.id), {
        subscriptions: updatedSubscriptions
      });

      // Automatically generate tasks
      await generateTasksForService(client.id, client.name, serviceToActivate as ServiceType);

      setIsActivateServiceModalOpen(false);
      setServiceToActivate('');
      setActivationData({
        invoiceNumber: '',
        invoiceId: '',
        startDate: '',
        expiryDate: '',
        subscriptionType: 'annual'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'clients');
    }
  };

  const stats = [
    { label: 'Journals', value: journals.length, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pending Tasks', value: tasks.filter(t => t.status !== 'completed').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Total Invoices', value: invoices.length, icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Reward Points', value: client.points || 0, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  if (selectedJournalId) {
    return (
      <JournalDetail 
        journalId={selectedJournalId.id} 
        initialEditMode={selectedJournalId.editMode}
        onBack={() => setSelectedJournalId(null)} 
        currentUser={currentUser} 
      />
    );
  }

  if (viewingInvoice) {
    return (
      <InvoiceDetail 
        invoice={viewingInvoice} 
        onClose={() => setViewingInvoice(null)} 
        currentUser={currentUser}
      />
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all font-bold group"
        >
          <div className="p-2 bg-white border border-slate-200 rounded-xl group-hover:border-slate-300 shadow-sm">
            <ArrowLeft size={20} />
          </div>
          Back to Clients
        </button>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsEditing(true)}
            disabled={isEditing}
            className={cn(
              "px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2",
              isEditing && "opacity-50 cursor-not-allowed"
            )}
          >
            <Edit size={18} />
            Edit Profile
          </button>
          {canDelete('clients', 'status') && (
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={isEditing}
              className={cn(
                "px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 flex items-center gap-2",
                isEditing && "opacity-50 cursor-not-allowed"
              )}
            >
              <Trash2 size={18} />
              Delete Client
            </button>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className={cn(
        "bg-white rounded-3xl border shadow-sm overflow-hidden transition-all",
        isEditing ? "border-indigo-300 ring-4 ring-indigo-50 shadow-xl" : "border-slate-100"
      )}>
        <div className="h-32 bg-gradient-to-r from-indigo-600 to-purple-600"></div>
        <div className="px-8 pb-8">
          <div className="relative flex items-end justify-between -mt-12 mb-6">
            <div className="flex items-end gap-6 w-full">
              <div className="w-32 h-32 rounded-3xl bg-white p-2 shadow-xl shrink-0 group relative">
                {client.photoURL ? (
                  <img 
                    src={client.photoURL} 
                    alt={client.name} 
                    className="w-full h-full rounded-2xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 text-4xl font-black uppercase">
                    {client.name.charAt(0)}
                  </div>
                )}
                {isEditing && (
                  <div className="absolute inset-0 bg-slate-900/40 rounded-3xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-white p-2">
                    <Edit size={20} className="mb-1" />
                    <span className="text-[10px] font-bold uppercase">Change Photo</span>
                  </div>
                )}
              </div>
              <div className="pb-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  {isEditing ? (
                    canEdit('clients', 'name') ? (
                      <div className="flex flex-col gap-2 w-full max-w-2xl">
                        <div className="flex items-center gap-2">
                          <select
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
                            value={editedClient.salutation}
                            onChange={e => setEditedClient(prev => ({ ...prev, salutation: e.target.value }))}
                          >
                            <option value="">None</option>
                            {SALUTATIONS.map(sal => (
                              <option key={sal} value={sal}>{sal}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-2xl font-black text-slate-900"
                            value={editedClient.name}
                            onChange={e => setEditedClient(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Full Name"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Profile Photo URL</p>
                          <input
                            type="text"
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={editedClient.photoURL || ''}
                            onChange={e => setEditedClient(prev => ({ ...prev, photoURL: e.target.value }))}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    ) : (
                      <h1 className="text-3xl font-black text-slate-900 tracking-tight break-words">
                        {client.salutation && <span className="text-slate-400 mr-2">{client.salutation}</span>}
                        {client.name}
                      </h1>
                    )
                  ) : (
                    canView('clients', 'name') ? (
                      <h1 className="text-3xl font-black text-slate-900 tracking-tight break-words">
                        {client.salutation && <span className="text-slate-400 mr-2">{client.salutation}</span>}
                        {client.name}
                      </h1>
                    ) : (
                      <h1 className="text-3xl font-black text-slate-300 tracking-tight italic">Hidden</h1>
                    )
                  )}
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input
                        type="text"
                        className="px-3 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-500 uppercase tracking-tight"
                        value={editedClient.careOf}
                        onChange={e => setEditedClient(prev => ({ ...prev, careOf: e.target.value }))}
                        placeholder="C/O / Referred by"
                      />
                    ) : (
                      client.careOf && (
                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded-lg border border-slate-200 uppercase tracking-tight whitespace-nowrap">
                          C/O {client.careOf}
                        </span>
                      )
                    )}
                    {isEditing ? (
                      <select
                        className="px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={editedClient.status}
                        onChange={e => setEditedClient(prev => ({ ...prev, status: e.target.value as any }))}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    ) : (
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider whitespace-nowrap",
                        client.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {client.status}
                      </span>
                    )}
                  </div>
                </div>
                 {isEditing ? (
                   canEdit('clients', 'email') ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Mail size={16} className="text-slate-400" />
                      <input
                        type="email"
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm text-slate-600"
                        value={editedClient.email}
                        onChange={e => setEditedClient(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Email Address"
                      />
                    </div>
                   ) : (
                      <p className="text-slate-500 font-medium flex items-center gap-2 mt-1 break-all">
                        <Mail size={16} className="flex-shrink-0" /> 
                        {client.email}
                      </p>
                   )
                ) : (
                  canView('clients', 'email') ? (
                    <p className="text-slate-500 font-medium flex items-center gap-2 mt-1 break-all">
                      <Mail size={16} className="flex-shrink-0" /> 
                      <a href={`mailto:${client.email}`} className="hover:text-indigo-600 transition-colors">
                        {client.email}
                      </a>
                    </p>
                  ) : (
                    <p className="text-slate-300 font-medium flex items-center gap-2 mt-1 italic">
                      <Mail size={16} className="flex-shrink-0" /> 
                      Hidden
                    </p>
                  )
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pb-2">
              <button 
                onClick={handleGetAiInsights}
                disabled={isEditing}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-bold hover:bg-indigo-100 transition-all shadow-sm",
                  isEditing && "opacity-50 cursor-not-allowed"
                )}
              >
                <Sparkles size={18} />
                AI Insights
              </button>
              <button 
                onClick={() => setIsEditing(true)}
                disabled={isEditing}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm",
                  isEditing && "opacity-50 cursor-not-allowed"
                )}
              >
                <Edit size={18} />
                Edit Profile
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={isEditing}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-red-50 hover:text-red-600 transition-all shadow-sm",
                  isEditing && "opacity-50 cursor-not-allowed"
                )}
              >
                <Trash2 size={18} />
                Delete Client
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-600">
                  <div className="p-2 bg-slate-50 rounded-lg"><Phone size={18} /></div>
                  {isEditing ? (
                    <input
                      type="text"
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                      value={editedClient.phone}
                      onChange={e => setEditedClient(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Phone Number"
                    />
                  ) : (
                    <span className="font-medium">
                      {client.phone ? (
                        <div className="flex flex-col gap-1">
                          <a href={`tel:${client.phone}`} className="hover:text-indigo-600 transition-colors">
                            {client.phone}
                          </a>
                          <a 
                            href={`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-[10px] text-emerald-600 font-bold hover:underline flex items-center gap-1"
                          >
                            <MessageSquare size={10} /> WhatsApp
                          </a>
                        </div>
                      ) : 'No phone provided'}
                    </span>
                  )}
                </div>
                <div className="flex items-start gap-3 text-slate-600 min-w-0">
                  <div className="p-2 bg-slate-50 rounded-lg flex-shrink-0"><MapPin size={18} /></div>
                  {isEditing ? (
                    <textarea
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium h-20"
                      value={editedClient.address}
                      onChange={e => setEditedClient(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Address"
                    />
                  ) : (
                    <span className="font-medium break-words flex-1">{client.address || 'No address provided'}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <div className="p-2 bg-slate-50 rounded-lg"><Calendar size={18} /></div>
                  <span className="font-medium">Joined {client.createdAt ? (typeof client.createdAt === 'string' ? new Date(client.createdAt).toLocaleDateString() : new Date(client.createdAt.seconds * 1000).toLocaleDateString()) : 'Recently'}</span>
                </div>
                {(client.endingDate || isEditing) && (
                  <div className={cn("flex items-center gap-3", isEditing ? "text-indigo-600" : "text-rose-600")}>
                    <div className={cn("p-2 rounded-lg", isEditing ? "bg-indigo-50" : "bg-rose-50")}><Calendar size={18} /></div>
                    {isEditing ? (
                      <div className="flex-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest block mb-1">Ending Date</label>
                        <input
                          type="date"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                          value={editedClient.endingDate}
                          onChange={e => setEditedClient(prev => ({ ...prev, endingDate: e.target.value }))}
                        />
                      </div>
                    ) : (
                      <span className="font-bold">Ended {new Date(client.endingDate!).toLocaleDateString()}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Active Subscriptions</h3>
                <button 
                  onClick={() => setIsActivateServiceModalOpen(true)}
                  className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  title="Activate New Service"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {client.subscriptions?.map(sub => (
                  <div key={sub.service} className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white text-indigo-600 flex items-center justify-center font-bold text-xs">
                        {sub.service.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-indigo-900">{sub.service}</p>
                        <div className="flex flex-col">
                          {(sub.startDate || sub.expiryDate) && (
                            <p className="text-[10px] text-indigo-500 font-medium">
                              {sub.startDate || 'N/A'} to {sub.expiryDate || 'N/A'}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            {sub.invoiceNumber ? (
                              <p className="text-[8px] bg-white px-1.5 py-0.5 rounded border border-indigo-100 text-indigo-600 font-bold">
                                {sub.invoiceNumber}
                              </p>
                            ) : (
                              <p className="text-[8px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 text-indigo-600 font-bold">
                                Active Subscription
                              </p>
                            )}
                            {sub.subscriptionType && (
                              <p className="text-[8px] bg-indigo-600 px-1.5 py-0.5 rounded text-white font-bold uppercase tracking-tighter">
                                {sub.subscriptionType}
                              </p>
                            )}
                          </div>
                          {sub.domainName && (
                            <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                              <Globe2 size={10} />
                              {sub.domainName}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        sub.expiryDate && new Date(sub.expiryDate) < new Date() ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                      )}>
                        {sub.expiryDate && new Date(sub.expiryDate) < new Date() ? 'Expired' : 'Active'}
                      </span>
                    </div>
                  </div>
                ))}
                {(!client.subscriptions || client.subscriptions.length === 0) && (
                  <p className="text-slate-400 italic text-sm">No active subscriptions</p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Portal Access</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                  <div>
                    <p className="text-[10px] font-bold text-slate-700">Portal Login</p>
                    <p className="text-[8px] text-slate-500 uppercase tracking-tight">Enable/Disable access</p>
                  </div>
                  <button 
                    onClick={handleTogglePortal}
                    disabled={isUpdatingPortal || currentUser?.role !== 'Admin'}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                      client.portalEnabled ? "bg-indigo-600" : "bg-slate-200",
                      currentUser?.role !== 'Admin' && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                      client.portalEnabled ? "translate-x-5" : "translate-x-1"
                    )} />
                  </button>
                </div>

                {onImpersonate && currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                  <button 
                    onClick={() => onImpersonate({ id: client.id, role: 'Client', name: client.name, email: client.email })}
                    className="w-full flex items-center justify-center gap-2 p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 font-bold text-[10px] hover:bg-indigo-100 transition-all min-w-0"
                  >
                    <Monitor size={14} className="flex-shrink-0" />
                    <span className="truncate">Login to Portal As {client.name.split(' ')[0]}</span>
                  </button>
                )}
              </div>
            </div>

            {currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setIsNewJournalModalOpen(true)}
                    className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-all flex flex-col items-center gap-2"
                  >
                    <Plus size={18} />
                    New Journal
                  </button>
                  <button 
                    onClick={() => setIsNewTaskModalOpen(true)}
                    className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-all flex flex-col items-center gap-2"
                  >
                    <Plus size={18} />
                    New Task
                  </button>
                  <button 
                    onClick={() => setIsActivateServiceModalOpen(true)}
                    className="p-3 bg-indigo-600 border border-indigo-600 rounded-xl text-xs font-bold text-white hover:bg-indigo-700 transition-all flex flex-col items-center gap-2 col-span-2"
                  >
                    <Shield size={18} />
                    Activate Service
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Smart Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <SmartRecommendations 
          recommendations={recommendations}
          onSelectService={(service) => {
            setServiceToActivate(service);
            setIsActivateServiceModalOpen(true);
          }}
        />
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg, stat.color)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <FloatingActionBar 
        isVisible={isEditing}
        onSave={handleSaveInline}
        onCancel={handleCancelInline}
        isSaving={isSaving}
      />

      {/* Tabs Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 p-1 bg-slate-100 w-fit rounded-2xl border border-slate-200">
          {(['hierarchy', 'journals', 'publishers', 'domains', 'tasks', 'invoices'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-8 py-2.5 rounded-xl text-sm font-bold transition-all capitalize",
                activeTab === tab ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
            >
              {tab === 'hierarchy' ? 'Workflow Hierarchy' : tab}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="font-medium">Loading details...</p>
            </div>
          ) : (
            <div className="p-6">
              {activeTab === 'hierarchy' && (
                <HierarchyWorkflow client={client} currentUser={currentUser!} />
              )}

              {activeTab === 'publishers' && (
                <Publishers searchQuery="" currentUser={currentUser!} clientId={client.id} />
              )}

              {activeTab === 'domains' && (
                <Domains searchQuery="" currentUser={currentUser!} clientId={client.id} />
              )}

              {activeTab === 'journals' && (
                <div className="space-y-4">
                  {journals.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                      <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">No journals found for this client</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {journals.map(journal => (
                        <div 
                          key={journal.id} 
                          onClick={() => setSelectedJournalId({ id: journal.id, editMode: false })}
                          className="p-4 border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all group cursor-pointer bg-white hover:shadow-md"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-100 transition-all">
                                <BookOpen size={20} />
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-all">{journal.title}</h4>
                                <p className="text-xs text-slate-500">{journal.category} • OJS {journal.ojsVersion}</p>
                              </div>
                            </div>
                              <div className="flex items-center gap-3">
                                {journal.credentials && Array.isArray(journal.credentials) && journal.credentials.length > 0 && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const pass = (journal.credentials as any)[0]?.password;
                                      if (pass) navigator.clipboard.writeText(pass);
                                    }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title={`Copy first password (${journal.credentials.length} stored)`}
                                  >
                                    <Key size={16} />
                                  </button>
                                )}
                                <div className="flex flex-col items-end gap-1">
                                  <span className={cn(
                                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                                    journal.status === 'complete' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                  )}>
                                    {journal.status.replace('_', ' ')}
                                  </span>
                                  <div className="flex flex-col gap-1 items-end">
                                    {journal.isOjsSubscribedFromUs ? (
                                      <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-600 border-emerald-100">
                                        OJS (Us)
                                      </span>
                                    ) : (
                                      <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-100">
                                        OJS (External)
                                      </span>
                                    )}
                                    {journal.issnOnline || journal.issnPrint ? (
                                      journal.isIssnSubscribedFromUs ? (
                                        <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-600 border-emerald-100">
                                          ISSN (Us)
                                        </span>
                                      ) : (
                                        <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-100">
                                          ISSN (External)
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-slate-50 text-slate-400 border-slate-100">
                                        ISSN (Not Added)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  {tasks.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                      <Clock size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">No tasks assigned to this client</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tasks.map(task => (
                        <div key={task.id} className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between hover:border-indigo-200 transition-all">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-2 h-12 rounded-full",
                              task.priority === 'high' ? "bg-rose-500" : task.priority === 'medium' ? "bg-amber-500" : "bg-emerald-500"
                            )}></div>
                            <div>
                              <h4 className="font-bold text-slate-900">{task.serviceType}</h4>
                              <p className="text-xs text-slate-500">Assigned to: {task.assignedTo || 'Unassigned'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Due Date</p>
                              <p className="text-sm font-bold text-slate-700">{task.dueDate || 'No date'}</p>
                            </div>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold border uppercase",
                              task.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                            )}>
                              {task.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'invoices' && (
                <div className="space-y-4">
                  {invoices.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                      <FileText size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-medium">No invoices found for this client</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {invoices.map(invoice => (
                        <div key={invoice.id} className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between hover:border-indigo-200 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                              <DollarSign size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">{invoice.invoiceNumber}</h4>
                              <p className="text-xs text-slate-500">{invoice.issueDate}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Amount</p>
                              <p className="text-lg font-black text-slate-900">${(invoice.total || 0).toLocaleString()}</p>
                            </div>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold border uppercase",
                              invoice.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                            )}>
                              {invoice.status}
                            </span>
                            <button 
                              onClick={() => setViewingInvoice(invoice)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="View Details"
                            >
                              <FileText size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Insights Modal */}
      <Modal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        title="Gemini AI Insights"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <div className="p-3 bg-white text-indigo-600 rounded-xl shadow-sm">
              <Sparkles size={24} />
            </div>
            <div>
              <h4 className="font-bold text-indigo-900">AI Account Analysis</h4>
              <p className="text-xs text-indigo-600">Powered by Gemini 1.5 Flash</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 min-h-[200px] relative">
            {isAiLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-sm font-medium">Analyzing client data...</p>
              </div>
            ) : (
              <div className="prose prose-slate prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {aiInsights}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsAiModalOpen(false)}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            Close Insights
          </button>
        </div>
      </Modal>

      {/* Modals */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        title="Edit Client Profile"
        maxWidth="2xl"
      >
        <ClientEditForm client={client} currentUser={currentUser} onClose={() => setIsEditModalOpen(false)} />
      </Modal>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteClient}
        title="Delete Client"
        message={`Are you sure you want to delete ${client.name}? This will move the client to trash.`}
        confirmText="Delete"
      />

      <Modal 
        isOpen={isNewJournalModalOpen} 
        onClose={() => setIsNewJournalModalOpen(false)} 
        title="Add New Journal"
      >
        <form onSubmit={handleCreateJournal} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Journal Title</label>
            <input 
              type="text"
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={newJournal.title}
              onChange={(e) => setNewJournal({ ...newJournal, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Category</label>
              <input 
                type="text"
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={newJournal.category}
                onChange={(e) => setNewJournal({ ...newJournal, category: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">OJS Version</label>
              <select 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={newJournal.ojsVersion}
                onChange={(e) => setNewJournal({ ...newJournal, ojsVersion: e.target.value })}
              >
                <option value="3.3.0">3.3.0</option>
                <option value="3.4.0">3.4.0</option>
                <option value="2.4.8">2.4.8</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">URL (Optional)</label>
            <input 
              type="url"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={newJournal.url}
              onChange={(e) => setNewJournal({ ...newJournal, url: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsNewJournalModalOpen(false)}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              Create Journal
            </button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isNewTaskModalOpen} 
        onClose={() => setIsNewTaskModalOpen(false)} 
        title="Add New Task"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Task Title</label>
            <input 
              type="text"
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Service Type</label>
              <select 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={newTask.serviceType}
                onChange={(e) => setNewTask({ ...newTask, serviceType: e.target.value as ServiceType })}
              >
                <option value="Hosting">Hosting</option>
                <option value="DOI">DOI</option>
                <option value="ISSN">ISSN</option>
                <option value="OJS">OJS</option>
                <option value="Editorial">Editorial</option>
                <option value="Indexing">Indexing</option>
                <option value="Plagiarism">Plagiarism</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Priority</label>
              <select 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Due Date</label>
              <input 
                type="date"
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Assign To</label>
              <select 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={newTask.assignedTo}
                onChange={(e) => {
                  const emp = employees.find(emp => emp.id === e.target.value);
                  setNewTask({ ...newTask, assignedTo: e.target.value, assignedToName: emp?.name || '' });
                }}
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Description</label>
            <textarea 
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-20"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsNewTaskModalOpen(false)}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              Create Task
            </button>
          </div>
        </form>
      </Modal>
      <Modal 
        isOpen={isActivateServiceModalOpen} 
        onClose={() => setIsActivateServiceModalOpen(false)} 
        title="Activate Client Service"
      >
        <form onSubmit={handleActivateService} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Service to Activate</label>
            <select 
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={serviceToActivate}
              onChange={(e) => setServiceToActivate(e.target.value as ServiceType)}
            >
              <option value="">Select Service</option>
              {activatableServices.length > 0 ? (
                activatableServices.map(service => (
                  <option key={service} value={service}>{service}</option>
                ))
              ) : (
                <>
                  <option value="Domain">Domain</option>
                  <option value="ISSN">ISSN</option>
                  <option value="DOI">DOI</option>
                  <option value="OJS">OJS</option>
                  <option value="Hosting">Hosting</option>
                  <option value="Editorial">Editorial</option>
                  <option value="Indexing">Indexing</option>
                  <option value="Plagiarism">Plagiarism</option>
                </>
              )}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Link Invoice (Optional)</label>
            <select 
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={activationData.invoiceId}
              onChange={(e) => {
                const inv = invoices.find(i => i.id === e.target.value);
                setActivationData({ 
                  ...activationData, 
                  invoiceId: e.target.value,
                  invoiceNumber: inv?.invoiceNumber || ''
                });
              }}
            >
              <option value="">Select Invoice</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.invoiceNumber} - {inv.total} {inv.status}</option>
              ))}
            </select>
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
              <label className="text-sm font-bold text-slate-700">Start Date (Optional)</label>
              <input 
                type="date"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={activationData.startDate}
                onChange={(e) => setActivationData({ ...activationData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Expiry Date (Optional)</label>
              <input 
                type="date"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={activationData.expiryDate}
                onChange={(e) => setActivationData({ ...activationData, expiryDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Subscription Type (Optional)</label>
            <select 
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={activationData.subscriptionType}
              onChange={(e) => setActivationData({ ...activationData, subscriptionType: e.target.value as any })}
            >
              <option value="one-time">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
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
              Activate Service
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
