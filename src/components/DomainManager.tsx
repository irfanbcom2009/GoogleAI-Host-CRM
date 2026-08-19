import React, { useState } from 'react';
import { 
  History, 
  Server, 
  Key, 
  Plus, 
  Calendar, 
  ArrowRight,
  Shield,
  Trash2,
  Save,
  Loader2,
  Globe,
  Lock,
  RefreshCw,
  Users,
  ShieldCheck,
  Eye,
  EyeOff,
  Search,
  ChevronDown,
  Mail,
  ExternalLink,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Domain, RegistrarHistory, HostingMigrationLog, User as UserType, Client, OwnershipHistory, DomainRegistrar } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, deleteDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { cn, sanitizeUrl } from '../lib/utils';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { moveToTrash } from '../lib/firebase';
import { toast } from 'react-hot-toast';

interface DomainManagerProps {
  domain: Domain;
  onClose: () => void;
  isEmployee: boolean;
  currentUser: UserType;
}

export const DomainManager: React.FC<DomainManagerProps> = ({ domain, onClose, isEmployee, currentUser }) => {
  const isTaiba = (val: string | undefined) => {
    if (!val) return false;
    return val.toLowerCase().includes('taiba@0045');
  };

  const [activeTab, setActiveTab] = useState<'history' | 'hosting' | 'credentials' | 'renewals' | 'ownership' | 'emails'>('history');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [emails, setEmails] = useState<any[]>(domain.emails || []);
  const [newEmail, setNewEmail] = useState({
    email: '',
    username: '',
    password: '',
    webmailLink: '',
    label: ''
  });
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [showEmailPasswords, setShowEmailPasswords] = useState<Record<string, boolean>>({});
  const [registrars, setRegistrars] = useState<DomainRegistrar[]>([]);

  // Form states
  const [newRegistrar, setNewRegistrar] = useState({ registrarName: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [newMigration, setNewMigration] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    fromServer: '', 
    toServer: '', 
    fromNS: '', 
    toNS: '', 
    notes: '' 
  });
  const [newOwnership, setNewOwnership] = useState({ clientId: '', startDate: new Date().toISOString().split('T')[0], notes: '' });
  const [newRenewal, setNewRenewal] = useState({ date: new Date().toISOString().split('T')[0], costPrice: 0, salePrice: 0, notes: '' });
  const [primaryRegistrarId, setPrimaryRegistrarId] = useState(domain.registrarId || '');
  const [registrarCreds, setRegistrarCreds] = useState({
    username: domain.registrarCredentials?.username || '',
    password: domain.registrarCredentials?.password || ''
  });
  const [showRegistrarPassword, setShowRegistrarPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    panelUrl: domain.hostingCredentials?.panelUrl || '',
    username: domain.hostingCredentials?.username || '',
    password: domain.hostingCredentials?.password || ''
  });
  const [showHostingPassword, setShowHostingPassword] = useState(false);
  const [eppCode, setEppCode] = useState(domain.eppCode || '');
  const [isDomainSubscribedFromUs, setIsDomainSubscribedFromUs] = useState(domain.isDomainSubscribedFromUs ?? domain.isSubscribed ?? true);
  const [registrarSearch, setRegistrarSearch] = useState('');
  const [isRegistrarHistoryDropdownOpen, setIsRegistrarHistoryDropdownOpen] = useState(false);
  const [isPrimaryRegistrarDropdownOpen, setIsPrimaryRegistrarDropdownOpen] = useState(false);
  const [isHostingSubscribedFromUs, setIsHostingSubscribedFromUs] = useState(domain.isHostingSubscribedFromUs ?? domain.isSubscribed ?? true);
  const [registrationSource, setRegistrationSource] = useState<'System' | 'External'>(domain.registrationSource || 'System');

  // Sync state when domain prop changes
  React.useEffect(() => {
    setPrimaryRegistrarId(domain.registrarId || '');
    setRegistrarCreds({
      username: domain.registrarCredentials?.username || '',
      password: domain.registrarCredentials?.password || ''
    });
    setCredentials({
      panelUrl: domain.hostingCredentials?.panelUrl || '',
      username: domain.hostingCredentials?.username || '',
      password: domain.hostingCredentials?.password || ''
    });
    setEppCode(domain.eppCode || '');
    setIsDomainSubscribedFromUs(domain.isDomainSubscribedFromUs ?? domain.isSubscribed ?? true);
    setIsHostingSubscribedFromUs(domain.isHostingSubscribedFromUs ?? domain.isSubscribed ?? true);
    setRegistrationSource(domain.registrationSource || 'System');
    setEmails(domain.emails || []);
  }, [domain]);

  React.useEffect(() => {
    if (isEmployee) {
      const q = query(collection(db, 'users'), where('role', '==', 'Client'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Client));
      });

      const qRegistrars = query(collection(db, 'registrars'));
      const unsubscribeRegistrars = onSnapshot(qRegistrars, (snapshot) => {
        setRegistrars(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as DomainRegistrar));
      });

      return () => {
        unsubscribe();
        unsubscribeRegistrars();
      };
    }
  }, [isEmployee]);

  const handleUpdateSubscription = async (field: 'isDomainSubscribedFromUs' | 'isHostingSubscribedFromUs' | 'registrationSource', value: any) => {
    setLoading(true);
    try {
      const updates: any = {
        [field]: value,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      };

      if (field === 'registrationSource') {
        setRegistrationSource(value);
      } else {
        // If either is true, isSubscribed must be true
        if (value === true || (field === 'isDomainSubscribedFromUs' ? isHostingSubscribedFromUs : isDomainSubscribedFromUs)) {
          updates.isSubscribed = true;
        }
        
        if (field === 'isDomainSubscribedFromUs') setIsDomainSubscribedFromUs(value);
        if (field === 'isHostingSubscribedFromUs') setIsHostingSubscribedFromUs(value);
      }

      await updateDoc(doc(db, 'domains', domain.id), updates);
      toast.success('Subscription settings updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCredentials = async () => {
    setLoading(true);
    try {
      const sanitizedCredentials = {
        ...credentials,
        panelUrl: sanitizeUrl(credentials.panelUrl)
      };
      await updateDoc(doc(db, 'domains', domain.id), {
        hostingCredentials: sanitizedCredentials,
        registrarCredentials: registrarCreds,
        registrarId: primaryRegistrarId,
        registrar: registrars.find(r => r.id === primaryRegistrarId)?.name || domain.registrar,
        eppCode: eppCode,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
      setCredentials(sanitizedCredentials);
      toast.success('Access details saved successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRegistrarHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const entry = { id: crypto.randomUUID(), ...newRegistrar };
      await updateDoc(doc(db, 'domains', domain.id), {
        registrarHistory: arrayUnion(entry),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
      setNewRegistrar({ registrarName: '', date: new Date().toISOString().split('T')[0], notes: '' });
      toast.success('Registrar record added');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHostingHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const entry = { 
        id: crypto.randomUUID(), 
        date: newMigration.date,
        fromServer: newMigration.fromServer,
        toServer: newMigration.toServer,
        fromNS: newMigration.fromNS.split(',').map(s => s.trim()).filter(Boolean),
        toNS: newMigration.toNS.split(',').map(s => s.trim()).filter(Boolean),
        notes: newMigration.notes
      };
      await updateDoc(doc(db, 'domains', domain.id), {
        hostingHistory: arrayUnion(entry),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
      setNewMigration({ date: new Date().toISOString().split('T')[0], fromServer: '', toServer: '', fromNS: '', toNS: '', notes: '' });
      toast.success('Hosting migration log added');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnership.clientId) return;
    
    setLoading(true);
    try {
      const targetClient = clients.find(c => c.id === newOwnership.clientId);
      if (!targetClient) throw new Error('Target client not found');

      const newEntry: OwnershipHistory = {
        id: crypto.randomUUID(),
        clientId: newOwnership.clientId,
        clientName: targetClient.name,
        startDate: newOwnership.startDate,
        notes: newOwnership.notes
      };

      let updatedHistory = [...(domain.ownershipHistory || [])];
      
      // Update the last entry's end date if it exists
      if (updatedHistory.length > 0) {
        const lastIndex = updatedHistory.length - 1;
        updatedHistory[lastIndex] = {
          ...updatedHistory[lastIndex],
          endDate: newOwnership.startDate
        };
      }

      updatedHistory.push(newEntry);

      // Update current ownership and the entire history
      await updateDoc(doc(db, 'domains', domain.id), {
        clientId: newOwnership.clientId,
        ownershipHistory: updatedHistory,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });

      setNewOwnership({ clientId: '', startDate: new Date().toISOString().split('T')[0], notes: '' });
      toast.success('Domain ownership transferred');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRenewalHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const entry = { id: crypto.randomUUID(), ...newRenewal };
      await updateDoc(doc(db, 'domains', domain.id), {
        renewalHistory: arrayUnion(entry),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
      setNewRenewal({ date: new Date().toISOString().split('T')[0], costPrice: 0, salePrice: 0, notes: '' });
      toast.success('Renewal record added');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const removeHistoryItem = async (field: 'registrarHistory' | 'hostingHistory' | 'renewalHistory' | 'ownershipHistory', item: any) => {
    if (!confirm('Are you sure you want to remove this record?')) return;
    try {
      await updateDoc(doc(db, 'domains', domain.id), {
        [field]: arrayRemove(item),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.email) {
      toast.error('Email address is required');
      return;
    }
    setLoading(true);
    try {
      let updatedEmails = [...emails];
      if (editingEmailId) {
        updatedEmails = updatedEmails.map(item => 
          item.id === editingEmailId ? { ...item, ...newEmail } : item
        );
      } else {
        const id = crypto.randomUUID();
        updatedEmails.push({ id, ...newEmail });
      }

      await updateDoc(doc(db, 'domains', domain.id), {
        emails: updatedEmails,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });

      setEmails(updatedEmails);
      setNewEmail({ email: '', username: '', password: '', webmailLink: '', label: '' });
      setEditingEmailId(null);
      toast.success(editingEmailId ? 'Webmail credential updated successfully' : 'Webmail credential saved successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmail = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webmail credential?')) return;
    setLoading(true);
    try {
      const updatedEmails = emails.filter(item => item.id !== id);
      await updateDoc(doc(db, 'domains', domain.id), {
        emails: updatedEmails,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
      setEmails(updatedEmails);
      toast.success('Webmail credential deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmail = (item: any) => {
    setEditingEmailId(item.id);
    setNewEmail({
      email: item.email || '',
      username: item.username || item.email || '',
      password: item.password || '',
      webmailLink: item.webmailLink || '',
      label: item.label || ''
    });
  };

  const handleDeleteDomain = async () => {
    if (domain.isVerified && currentUser.role !== 'Admin') {
      alert('Only administrators can delete verified domains.');
      return;
    }

    if (!confirm('Are you sure you want to move this domain to trash?')) return;

    setLoading(true);
    try {
      await moveToTrash('domains', domain.id, domain, currentUser.name);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm">
            <Globe size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{domain.domainName}</h3>
            <p className="text-sm text-slate-500">Domain & Hosting Management</p>
          </div>
        </div>

        {isEmployee && (
          <div className="flex items-center gap-2">
            {/* Verification Status */}
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all uppercase tracking-wider",
              domain.isVerified 
                ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                : "bg-amber-50 text-amber-700 border-amber-100"
            )}>
              {domain.isVerified ? <ShieldCheck size={12} /> : <Clock size={12} />}
              {domain.isVerified ? 'Verified' : 'Pending'}
            </div>

            {/* Danger Zone / Actions */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
              {!domain.isVerified && (currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                <button 
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'domains', domain.id), {
                        isVerified: true,
                        verifiedBy: currentUser.name,
                        verifiedById: currentUser.id,
                        verifiedAt: new Date().toISOString()
                      });
                    } catch (error) {
                      handleFirestoreError(error, OperationType.UPDATE, 'domains');
                    }
                  }}
                  className="p-1.5 text-amber-600 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                  title="Verify Domain"
                >
                  <Shield size={16} />
                </button>
              )}
              <button 
                onClick={handleDeleteDomain}
                disabled={loading || (domain.isVerified && currentUser.role !== 'Admin')}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  domain.isVerified && currentUser.role !== 'Admin'
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-rose-600 hover:bg-white hover:shadow-sm"
                )}
                title="Move to Trash"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
          <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Registration Source</p>
          <div className="flex gap-2">
            <button 
              onClick={() => handleUpdateSubscription('registrationSource', 'System')}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all",
                registrationSource === 'System' ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}
            >
              System
            </button>
            <button 
              onClick={() => handleUpdateSubscription('registrationSource', 'External')}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all",
                registrationSource === 'External' ? "bg-amber-600 text-white shadow-sm" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}
            >
              External
            </button>
          </div>
        </div>

        <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <input 
            type="checkbox"
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
            checked={isDomainSubscribedFromUs}
            onChange={e => handleUpdateSubscription('isDomainSubscribedFromUs', e.target.checked)}
          />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Domain (Us)
            {isDomainSubscribedFromUs && <span className="ml-2 text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase">Subscribed</span>}
          </span>
        </label>

        <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <input 
            type="checkbox"
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
            checked={isHostingSubscribedFromUs}
            onChange={e => handleUpdateSubscription('isHostingSubscribedFromUs', e.target.checked)}
          />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Hosting (Us)
            {isHostingSubscribedFromUs && <span className="ml-2 text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase">Subscribed</span>}
          </span>
        </label>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'history' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <History size={16} />
          Registrar History
        </button>
        <button 
          onClick={() => setActiveTab('hosting')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'hosting' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Server size={16} />
          Hosting Logs
        </button>
        <button 
          onClick={() => setActiveTab('credentials')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'credentials' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Key size={16} />
          Access & EPP
        </button>
        <button 
          onClick={() => setActiveTab('ownership')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'ownership' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Users size={16} />
          Ownership History
        </button>
        <button 
          onClick={() => setActiveTab('renewals')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'renewals' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <RefreshCw size={16} />
          Renewal History
        </button>
        <button 
          onClick={() => setActiveTab('emails')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'emails' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Mail size={16} />
          Webmails & Emails
        </button>
      </div>

      <div className="min-h-[400px] space-y-8">
        {activeTab === 'history' && (
          <div className="space-y-6">
            {isEmployee && (
              <form onSubmit={handleAddRegistrarHistory} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Registrar Name</label>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setIsRegistrarHistoryDropdownOpen(!isRegistrarHistoryDropdownOpen)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all flex items-center justify-between text-left"
                      >
                        <span className={cn(newRegistrar.registrarName ? "text-slate-900" : "text-slate-400")}>
                          {newRegistrar.registrarName || "Select Registrar..."}
                        </span>
                        <ChevronDown size={16} className={cn("text-slate-400 transition-transform", isRegistrarHistoryDropdownOpen && "rotate-180")} />
                      </button>

                      <AnimatePresence>
                        {isRegistrarHistoryDropdownOpen && (
                          <>
                            <div 
                              className="fixed inset-0 z-[60]" 
                              onClick={() => setIsRegistrarHistoryDropdownOpen(false)} 
                            />
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute z-[70] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden"
                            >
                              <div className="p-2 border-b border-slate-100">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                  <input 
                                    autoFocus
                                    type="text"
                                    placeholder="Search registrars..."
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={registrarSearch || ''}
                                    onChange={e => setRegistrarSearch(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="max-h-60 overflow-y-auto p-1">
                                {registrars
                                  .filter(r => r.name.toLowerCase().includes(registrarSearch.toLowerCase()))
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(reg => (
                                    <button
                                      key={reg.id}
                                      type="button"
                                      onClick={() => {
                                        setNewRegistrar(prev => ({ 
                                          ...prev, 
                                          registrarName: reg.name 
                                        }));
                                        setIsRegistrarHistoryDropdownOpen(false);
                                        setRegistrarSearch('');
                                      }}
                                      className={cn(
                                        "w-full px-3 py-2 text-left text-sm rounded-lg transition-all flex items-center justify-between group",
                                        newRegistrar.registrarName === reg.name ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                                      )}
                                    >
                                      {reg.name}
                                      {newRegistrar.registrarName === reg.name && <CheckCircle2 size={14} />}
                                    </button>
                                  ))}
                                {registrars.filter(r => r.name.toLowerCase().includes(registrarSearch.toLowerCase())).length === 0 && (
                                  <div className="py-8 text-center text-slate-400">
                                    <p className="text-xs">No registrars found</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRegistrar.date || ''}
                      onChange={e => setNewRegistrar(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Notes (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Initial registration"
                    value={newRegistrar.notes || ''}
                    onChange={e => setNewRegistrar(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <button 
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                  Add Registrar Record
                </button>
              </form>
            )}

            <div className="space-y-3">
              {domain.registrarHistory?.length ? (
                domain.registrarHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Globe size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{item.registrarName}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Calendar size={12} /> {item.date}</span>
                          {item.notes && <span>• {item.notes}</span>}
                        </div>
                      </div>
                    </div>
                    {isEmployee && (
                      <button 
                        onClick={() => removeHistoryItem('registrarHistory', item)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <History size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No registrar history recorded</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'hosting' && (
          <div className="space-y-6">
            {isEmployee && (
              <form onSubmit={handleAddHostingHistory} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Migration Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newMigration.date || ''}
                      onChange={e => setNewMigration(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">From Server</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Old Server IP/Name"
                      value={newMigration.fromServer || ''}
                      onChange={e => setNewMigration(prev => ({ ...prev, fromServer: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">To Server</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="New Server IP/Name"
                      value={newMigration.toServer || ''}
                      onChange={e => setNewMigration(prev => ({ ...prev, toServer: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">From NS (Comma separated)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="ns1.old.com, ns2.old.com"
                      value={newMigration.fromNS || ''}
                      onChange={e => setNewMigration(prev => ({ ...prev, fromNS: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">To NS (Comma separated)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="ns1.new.com, ns2.new.com"
                      value={newMigration.toNS || ''}
                      onChange={e => setNewMigration(prev => ({ ...prev, toNS: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Migration Notes</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Upgraded to dedicated server"
                    value={newMigration.notes || ''}
                    onChange={e => setNewMigration(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <button 
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Server size={18} />}
                  Log Migration
                </button>
              </form>
            )}

            <div className="space-y-3">
              {domain.hostingHistory?.length ? (
                domain.hostingHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <RefreshCw size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{item.fromServer || 'N/A'}</span>
                            {item.fromNS && item.fromNS.length > 0 && (
                              <span className="text-[10px] text-slate-400 font-mono">{item.fromNS.join(', ')}</span>
                            )}
                          </div>
                          <ArrowRight size={14} className="text-slate-400" />
                          <div className="flex flex-col">
                            <span className="font-bold text-indigo-600">{item.toServer || 'N/A'}</span>
                            {item.toNS && item.toNS.length > 0 && (
                              <span className="text-[10px] text-indigo-400 font-mono">{item.toNS.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1"><Calendar size={12} /> {item.date}</span>
                          {item.notes && <span>• {item.notes}</span>}
                        </div>
                      </div>
                    </div>
                    {isEmployee && (
                      <button 
                        onClick={() => removeHistoryItem('hostingHistory', item)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Server size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No hosting migration logs found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'credentials' && (
          <div className="space-y-6">
            {!isHostingSubscribedFromUs && !isDomainSubscribedFromUs ? (
              <div className="p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <Lock size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">External Service</h3>
                <p className="text-slate-500 max-w-md mx-auto">
                  This domain and hosting are managed externally. Credentials and invoice details are hidden for external services.
                </p>
                {isEmployee && (
                  <button
                    onClick={() => handleUpdateSubscription('isHostingSubscribedFromUs', true)}
                    className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    Convert to Subscribed (Us)
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-indigo-600" />
                    Registrar Configuration
                  </h4>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Registrar</label>
                    <div className="relative">
                      <button 
                        disabled={!isEmployee}
                        type="button"
                        onClick={() => setIsPrimaryRegistrarDropdownOpen(!isPrimaryRegistrarDropdownOpen)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all flex items-center justify-between text-left disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <span className={cn(primaryRegistrarId ? "text-slate-900" : "text-slate-400")}>
                          {registrars.find(r => r.id === primaryRegistrarId)?.name || "Select Registrar..."}
                        </span>
                        <ChevronDown size={16} className={cn("text-slate-400 transition-transform", isPrimaryRegistrarDropdownOpen && "rotate-180")} />
                      </button>

                      <AnimatePresence>
                        {isPrimaryRegistrarDropdownOpen && (
                          <>
                            <div 
                              className="fixed inset-0 z-[60]" 
                              onClick={() => setIsPrimaryRegistrarDropdownOpen(false)} 
                            />
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute z-[70] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden"
                            >
                              <div className="p-2 border-b border-slate-100">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                  <input 
                                    autoFocus
                                    type="text"
                                    placeholder="Search registrars..."
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={registrarSearch || ''}
                                    onChange={e => setRegistrarSearch(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="max-h-60 overflow-y-auto p-1">
                                {registrars
                                  .filter(r => r.name.toLowerCase().includes(registrarSearch.toLowerCase()))
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(reg => (
                                    <button
                                      key={reg.id}
                                      type="button"
                                      onClick={() => {
                                        setPrimaryRegistrarId(reg.id);
                                        setIsPrimaryRegistrarDropdownOpen(false);
                                        setRegistrarSearch('');
                                      }}
                                      className={cn(
                                        "w-full px-3 py-2 text-left text-sm rounded-lg transition-all flex items-center justify-between group",
                                        primaryRegistrarId === reg.id ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                                      )}
                                    >
                                      {reg.name}
                                      {primaryRegistrarId === reg.id && <CheckCircle2 size={14} />}
                                    </button>
                                  ))}
                                {registrars.filter(r => r.name.toLowerCase().includes(registrarSearch.toLowerCase())).length === 0 && (
                                  <div className="py-8 text-center text-slate-400">
                                    <p className="text-xs">No registrars found</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-slate-200 pt-4">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <Key size={14} className="text-indigo-600" />
                      Specific Access Credentials
                    </h4>
                    {isDomainSubscribedFromUs ? (
                      <div className="grid grid-cols-1 gap-4">
                        {primaryRegistrarId && registrars.find(r => r.id === primaryRegistrarId)?.link && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                          <div className="flex items-center gap-2">
                            <Globe size={16} className="text-indigo-500" />
                            <span className="text-xs font-bold text-slate-700">Registrar Portal</span>
                          </div>
                          <a 
                            href={registrars.find(r => r.id === domain.registrarId)?.link} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-bold flex items-center gap-1 hover:bg-indigo-100 transition-all"
                          >
                            Login Page <ArrowRight size={10} />
                          </a>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                          <input 
                            disabled={!isEmployee}
                            type="text" 
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                            placeholder={registrars.find(r => r.id === domain.registrarId)?.email || "Registrar username"}
                            value={registrarCreds.username || ''}
                            onChange={e => setRegistrarCreds(prev => ({ ...prev, username: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                          <div className="relative">
                            <input 
                              disabled={!isEmployee}
                              type={showRegistrarPassword && !(isTaiba(registrarCreds.password) && currentUser.role !== 'Admin') ? "text" : "password"} 
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                              placeholder={registrars.find(r => r.id === domain.registrarId)?.password ? "••••••••" : "Registrar password"}
                              value={registrarCreds.password || ''}
                              onChange={e => setRegistrarCreds(prev => ({ ...prev, password: e.target.value }))}
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegistrarPassword(!showRegistrarPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1"
                            >
                              {showRegistrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 italic">If empty, master registrar account credentials will be used.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Domain is managed externally. Registrar credentials hidden.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Lock size={16} className="text-indigo-600" />
                    Hosting Access Credentials
                  </h4>
                  {isHostingSubscribedFromUs ? (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Panel URL</label>
                        <input 
                          disabled={!isEmployee}
                          type="text" 
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                          placeholder="https://cpanel.domain.com"
                          value={credentials.panelUrl || ''}
                          onChange={e => setCredentials(prev => ({ ...prev, panelUrl: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                          <input 
                            disabled={!isEmployee}
                            type="text" 
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                            value={credentials.username || ''}
                            onChange={e => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                          <div className="relative">
                            <input 
                              disabled={!isEmployee}
                              type={showHostingPassword && !(isTaiba(credentials.password) && currentUser.role !== 'Admin') ? "text" : "password"} 
                              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                              value={credentials.password || ''}
                              onChange={e => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                            />
                            <button
                              type="button"
                              onClick={() => setShowHostingPassword(!showHostingPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1"
                            >
                              {showHostingPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Hosting is managed externally. Credentials hidden.</p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Shield size={16} className="text-indigo-600" />
                    EPP / Authorization Code
                  </h4>
                  {isDomainSubscribedFromUs ? (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">EPP Code</label>
                      <div className="relative">
                        <input 
                          disabled={!isEmployee}
                          type="text" 
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                          placeholder="Enter EPP code for transfer"
                          value={isTaiba(eppCode) && currentUser.role !== 'Admin' ? '••••••••' : eppCode || ''}
                          onChange={e => setEppCode(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Domain is managed externally. EPP code hidden.</p>
                  )}
                </div>

                {isEmployee && (
                  <button 
                    onClick={handleUpdateCredentials}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    Save Access Details
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ownership' && (
          <div className="space-y-6">
            {isEmployee && (
              <form onSubmit={handleTransferOwnership} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Transfer to Client</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newOwnership.clientId || ''}
                      onChange={e => setNewOwnership(prev => ({ ...prev, clientId: e.target.value }))}
                    >
                      <option value="">Choose a client...</option>
                      {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Transfer Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newOwnership.startDate || ''}
                      onChange={e => setNewOwnership(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Transfer Notes</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Domain sold to new client"
                    value={newOwnership.notes || ''}
                    onChange={e => setNewOwnership(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <button 
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} />}
                  Transfer Ownership
                </button>
              </form>
            )}

            <div className="space-y-3">
              {domain.ownershipHistory?.length ? (
                domain.ownershipHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Users size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{item.clientName}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Calendar size={12} /> From: {item.startDate}</span>
                          {item.endDate && <span className="flex items-center gap-1"><Calendar size={12} /> To: {item.endDate}</span>}
                          {item.notes && <span>• {item.notes}</span>}
                        </div>
                      </div>
                    </div>
                    {isEmployee && (
                      <button 
                        onClick={() => removeHistoryItem('ownershipHistory', item)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Users size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No ownership history found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'renewals' && (
          <div className="space-y-6">
            {isEmployee && (
              <form onSubmit={handleAddRenewalHistory} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Renewal Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRenewal.date || ''}
                      onChange={e => setNewRenewal(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Cost Price ($)</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="0.00"
                      value={newRenewal.costPrice || ''}
                      onChange={e => setNewRenewal(prev => ({ ...prev, costPrice: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Sale Price ($)</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="0.00"
                      value={newRenewal.salePrice || ''}
                      onChange={e => setNewRenewal(prev => ({ ...prev, salePrice: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Notes (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Renewed for 1 year"
                    value={newRenewal.notes || ''}
                    onChange={e => setNewRenewal(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <button 
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                  Add Renewal Record
                </button>
              </form>
            )}

            <div className="space-y-3">
              {domain.renewalHistory?.length ? (
                domain.renewalHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <RefreshCw size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-4">
                          <p className="font-bold text-slate-900">Renewal on {item.date}</p>
                          <div className="flex items-center gap-2">
                            {(currentUser.role === 'Admin' || currentUser.role === 'Manager' || currentUser.role === 'Employee') && (
                              <span className="text-xs text-slate-500">Cost: ${item.costPrice}</span>
                            )}
                            <span className="text-xs font-black text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded">Sale: ${item.salePrice}</span>
                          </div>
                        </div>
                        {item.notes && <p className="text-xs text-slate-500 mt-1">{item.notes}</p>}
                      </div>
                    </div>
                    {isEmployee && (
                      <button 
                        onClick={() => removeHistoryItem('renewalHistory', item)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No renewal history recorded</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="space-y-6">
            {isEmployee && (
              <form onSubmit={handleSaveEmail} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 mb-2">
                  {editingEmailId ? 'Edit Webmail Credential' : 'Add Webmail / Email Credential'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 block">Label / Name</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="e.g. Editor-in-Chief Email, Support"
                      value={newEmail.label || ''}
                      onChange={e => setNewEmail(prev => ({ ...prev, label: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 block">Email Address *</label>
                    <input 
                      required
                      type="email" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="e.g. info@journaldomain.com"
                      value={newEmail.email || ''}
                      onChange={e => setNewEmail(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 block">Login Username (if distinct)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="Leave empty to use Email address"
                      value={newEmail.username || ''}
                      onChange={e => setNewEmail(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 block">Password</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="Webmail Password"
                      value={newEmail.password || ''}
                      onChange={e => setNewEmail(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 block">Webmail Link</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="e.g. https://webmail.journaldomain.com"
                    value={newEmail.webmailLink || ''}
                    onChange={e => setNewEmail(prev => ({ ...prev, webmailLink: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {editingEmailId ? 'Update Credential' : 'Save Credential'}
                  </button>
                  {editingEmailId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingEmailId(null);
                        setNewEmail({ email: '', username: '', password: '', webmailLink: '', label: '' });
                      }}
                      className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all text-sm font-bold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Mail size={16} className="text-indigo-600" />
                Saved Email & Webmail Accounts
              </h4>
              {emails && emails.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {emails.map((item) => (
                    <div key={item.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all group relative">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1 pr-12 w-full">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.label && (
                              <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                                {item.label}
                              </span>
                            )}
                            <span className="font-bold text-slate-900 text-sm">{item.email}</span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3 pt-2 border-t border-slate-100">
                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Username</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-slate-700">
                                  {isTaiba(item.username || item.email) && currentUser.role !== 'Admin' ? '••••••••' : (item.username || item.email)}
                                </span>
                                {currentUser.role === 'Admin' && (
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(item.username || item.email);
                                      toast.success('Username copied');
                                    }}
                                    className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold"
                                  >
                                    Copy
                                  </button>
                                )}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Password</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-slate-700">
                                  {showEmailPasswords[item.id] ? (
                                    isTaiba(item.password) && currentUser.role !== 'Admin' ? '••••••••' : (item.password || 'N/A')
                                  ) : '••••••••'}
                                </span>
                                <button 
                                  type="button"
                                  onClick={() => setShowEmailPasswords(prev => ({ ...prev, [item.id] : !prev[item.id] }))}
                                  className="text-[10px] text-slate-400 hover:text-indigo-600 font-bold"
                                >
                                  {showEmailPasswords[item.id] ? 'Hide' : 'Show'}
                                </button>
                                {item.password && currentUser.role === 'Admin' && (
                                  <button 
                                    onClick={() => {
                                      if (isTaiba(item.password)) {
                                        toast.error('Access Denied');
                                        return;
                                      }
                                      navigator.clipboard.writeText(item.password);
                                      toast.success('Password copied');
                                    }}
                                    className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold"
                                  >
                                    Copy
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {item.webmailLink && (
                            <div className="mt-3 pt-2">
                              <span className="text-[10px] text-slate-400 block uppercase font-bold">Webmail Link</span>
                              <a 
                                href={sanitizeUrl(item.webmailLink)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 w-fit mt-1"
                              >
                                {item.webmailLink}
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          )}
                        </div>

                        {isEmployee && (
                          <div className="flex gap-1 absolute right-3 top-3">
                            <button 
                              onClick={() => handleEditEmail(item)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Edit credential"
                            >
                              <Pencil size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteEmail(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete credential"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <Mail size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No webmail/email credentials saved yet</p>
                  <p className="text-xs text-slate-400 mt-1">Add details above to store access for this domain.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audit Info Footer */}
        {isEmployee && (
          <div className="pt-6 mt-8 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entered By</p>
              <p className="text-xs font-bold text-slate-600">{domain.createdBy || 'System'}</p>
              <p className="text-[10px] text-slate-500">{domain.createdAt ? new Date(domain.createdAt).toLocaleString() : 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Updated By</p>
              <p className="text-xs font-bold text-slate-600">{domain.updatedBy || 'System'}</p>
              <p className="text-[10px] text-slate-500">{domain.updatedAt ? new Date(domain.updatedAt).toLocaleString() : 'N/A'}</p>
            </div>
            {domain.isVerified && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified By</p>
                <p className="text-xs font-bold text-emerald-600">{domain.verifiedBy}</p>
                <p className="text-[10px] text-slate-500">{domain.verifiedAt ? new Date(domain.verifiedAt).toLocaleString() : 'N/A'}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
