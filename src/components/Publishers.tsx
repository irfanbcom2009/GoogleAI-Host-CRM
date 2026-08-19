import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Download,
  User as UserIcon,
  FileText,
  ShieldCheck,
  Trash2,
  Edit,
  Loader2,
  X,
  Lock,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Clock,
  History,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType, getErrorMessage } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Publisher, Client, User } from '../types';

import { PublisherDetail } from './PublisherDetail';

import { ColumnSelector } from './ColumnSelector';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import { toast } from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';

interface PublishersProps {
  searchQuery?: string;
  currentUser: User;
  clientId?: string;
  initialPublisherId?: string;
  onClearInitialId?: () => void;
  onNavigate?: (tab: string, id: string) => void;
}

const AVAILABLE_COLUMNS = [
  { id: 'name', label: 'Publisher Name' },
  { id: 'client', label: 'Client' },
  { id: 'owner', label: 'Owner' },
  { id: 'secp', label: 'SECP Reg' },
  { id: 'ntn', label: 'NTN' },
  { id: 'login', label: 'Login Credentials' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'address', label: 'Address' },
  { id: 'documents', label: 'Documents' },
  { id: 'createdAt', label: 'Created At' },
];


export const Publishers: React.FC<PublishersProps> = ({ 
  searchQuery = '', 
  currentUser, 
  clientId,
  initialPublisherId,
  onClearInitialId,
  onNavigate
}) => {
  const isTaiba = (val: string | undefined) => {
    if (!val) return false;
    return val.toLowerCase().includes('taiba@0045');
  };

  const { check } = usePermissions(currentUser);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPublisher, setEditingPublisher] = useState<Publisher | null>(null);
  const [selectedPublisherId, setSelectedPublisherId] = useState<string | null>(initialPublisherId || null);

  useEffect(() => {
    if (initialPublisherId) {
      setSelectedPublisherId(initialPublisherId);
    }
  }, [initialPublisherId]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['publishers'] || AVAILABLE_COLUMNS.map(c => c.id)
  );
  const [selectedPublisherIds, setSelectedPublisherIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'createdAt', direction: 'desc' });
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);

  const executeBulkDelete = async () => {
    const loadingToast = toast.loading(`Deleting ${selectedPublisherIds.length} publishers...`);
    try {
      for (const id of selectedPublisherIds) {
        await deleteDoc(doc(db, 'publishers', id));
      }
      setSelectedPublisherIds([]);
      toast.success(`Deleted ${selectedPublisherIds.length} publishers.`, { id: loadingToast });
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
    }
  };

  const executeCleanup = async () => {
    const invalid = publishers.filter(p => !p.name || p.name.includes('TEMP-PUB-'));
    if (invalid.length === 0) {
      toast.success("No invalid publishers found.");
      return;
    }
    const loadingToast = toast.loading(`Deleting ${invalid.length} publishers...`);
    try {
      for (const p of invalid) {
        await deleteDoc(doc(db, 'publishers', p.id));
      }
      toast.success(`Deleted ${invalid.length} invalid publishers.`, { id: loadingToast });
    } catch (error) {
      console.error("Cleanup error:", error);
      toast.error("Cleanup failed.", { id: loadingToast });
    }
  };

  const isClient = currentUser.role === 'Client';
  const effectiveClientId = isClient ? currentUser.id : clientId;

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.publishers`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const [newPublisher, setNewPublisher] = useState({
    clientId: '',
    name: '',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    secpRegistration: '',
    ntn: '',
    secpLoginUrl: '',
    loginUsername: '',
    usernameForPublisher: '',
    loginPassword: '',
    documents: {
      aoa: '',
      moa: '',
      cnicFront: '',
      cnicBack: '',
      ntn: '',
      secp: '',
      certificates: [] as string[]
    }
  });

  const [uploading, setUploading] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(field);
    
    // Simulate upload with base64 for demo
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewPublisher(prev => ({
        ...prev,
        documents: {
          ...prev.documents,
          [field]: reader.result as string
        }
      }));
      setUploading(null);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const q = query(collection(db, 'publishers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pubData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Publisher[];
      setPublishers(pubData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'publishers');
    });

    const unsubClients = onSnapshot(collection(db, 'users'), (snapshot) => {
      setClients(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(c => c.role === 'Client' || c.role === undefined)
      );
    });

    return () => {
      unsubscribe();
      unsubClients();
    };
  }, []);

  useEffect(() => {
    if (effectiveClientId && clients.length > 0 && !editingPublisher && !isModalOpen) {
      const selectedClient = clients.find(c => c.id === effectiveClientId);
      setNewPublisher(prev => ({
        ...prev,
        clientId: effectiveClientId,
        ownerName: selectedClient ? (selectedClient.name || '') : prev.ownerName
      }));
    }
  }, [effectiveClientId, clients, editingPublisher, isModalOpen]);

  const handleOpenAddModal = () => {
    const selectedClient = clients.find(c => c.id === effectiveClientId);
    setNewPublisher({
      clientId: effectiveClientId || '',
      name: '',
      ownerName: selectedClient ? (selectedClient.name || '') : '',
      email: '',
      phone: '',
      address: '',
      secpRegistration: '',
      ntn: '',
      secpLoginUrl: '',
      loginUsername: '',
      usernameForPublisher: '',
      loginPassword: '',
      documents: {
        aoa: '',
        moa: '',
        cnicFront: '',
        cnicBack: '',
        ntn: '',
        secp: '',
        certificates: []
      }
    });
    setEditingPublisher(null);
    setIsModalOpen(true);
  };

  const handleCreatePublisher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingPublisher) {
        await updateDoc(doc(db, 'publishers', editingPublisher.id), {
          ...newPublisher,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'publishers'), {
          ...newPublisher,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingPublisher(null);
      const selectedClient = clients.find(c => c.id === effectiveClientId);
      setNewPublisher({
        clientId: effectiveClientId || '',
        name: '',
        ownerName: selectedClient ? (selectedClient.name || '') : '',
        email: '',
        phone: '',
        address: '',
        secpRegistration: '',
        ntn: '',
        secpLoginUrl: '',
        loginUsername: '',
        usernameForPublisher: '',
        loginPassword: '',
        documents: {
          aoa: '',
          moa: '',
          cnicFront: '',
          cnicBack: '',
          ntn: '',
          secp: '',
          certificates: []
        }
      });
    } catch (error) {
      handleFirestoreError(error, editingPublisher ? OperationType.UPDATE : OperationType.CREATE, 'publishers');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePublisher = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'publishers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'publishers');
    }
  };

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [documentFilter, setDocumentFilter] = useState('');
  const [activeView, setActiveView] = useState<'all' | 'accessed' | 'added' | 'edited'>('all');
  const [recentAccessedIds, setRecentAccessedIds] = useState<string[]>([]);

  useEffect(() => {
    const key = `recently_accessed_publishers_${currentUser.id}`;
    const ids = JSON.parse(localStorage.getItem(key) || '[]');
    setRecentAccessedIds(ids);
  }, [currentUser.id]);

  useEffect(() => {
    if (selectedPublisherId) {
      const key = `recently_accessed_publishers_${currentUser.id}`;
      let ids: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      ids = [selectedPublisherId, ...ids.filter(id => id !== selectedPublisherId)].slice(0, 15);
      localStorage.setItem(key, JSON.stringify(ids));
      setRecentAccessedIds(ids);
    }
  }, [selectedPublisherId, currentUser.id]);

  const filteredPublishers = publishers.filter(pub => {
    const fullSearch = (searchQuery + ' ' + localSearchQuery).trim().toLowerCase();
    const pubClientObj = clients.find(c => c.id === pub.clientId);
    const clientName = pubClientObj ? (pubClientObj.name || '').toLowerCase() : '';
    
    const matchesSearch = !fullSearch || 
      pub.name.toLowerCase().includes(fullSearch) ||
      pub.ownerName.toLowerCase().includes(fullSearch) ||
      pub.ntn.includes(fullSearch) ||
      (pub.email && pub.email.toLowerCase().includes(fullSearch)) ||
      (pub.phone && pub.phone.toLowerCase().includes(fullSearch)) ||
      (pub.secpRegistration && pub.secpRegistration.toLowerCase().includes(fullSearch)) ||
      clientName.includes(fullSearch);
    
    const targetClient = clientFilter || effectiveClientId;
    const matchesClient = !targetClient || pub.clientId === targetClient;
    
    let matchesDocs = true;
    if (documentFilter === 'missing_aoa_moa') {
      matchesDocs = !pub.documents?.aoa || !pub.documents?.moa;
    } else if (documentFilter === 'missing_cnic') {
      matchesDocs = !pub.documents?.cnicFront || !pub.documents?.cnicBack;
    } else if (documentFilter === 'missing_secp_ntn') {
      matchesDocs = !pub.documents?.secp || !pub.documents?.ntn;
    } else if (documentFilter === 'has_portal') {
      matchesDocs = !(!pub.loginUsername && !pub.loginPassword && !pub.secpLoginUrl);
    } else if (documentFilter === 'missing_any') {
      matchesDocs = !pub.documents?.aoa || !pub.documents?.moa || !pub.documents?.cnicFront || !pub.documents?.cnicBack || !pub.documents?.secp || !pub.documents?.ntn;
    } else if (documentFilter === 'all_uploaded') {
      matchesDocs = !!(pub.documents?.aoa && pub.documents?.moa && pub.documents?.cnicFront && pub.documents?.cnicBack && pub.documents?.secp && pub.documents?.ntn);
    }
    
    return matchesSearch && matchesClient && matchesDocs;
  });

  const sortedPublishers = (() => {
    let list = [...filteredPublishers];
    if (activeView === 'accessed') {
      list = list
        .filter(pub => recentAccessedIds.includes(pub.id))
        .sort((a, b) => recentAccessedIds.indexOf(a.id) - recentAccessedIds.indexOf(b.id));
    } else if (activeView === 'added') {
      list.sort((a: any, b: any) => {
        const aTime = a.createdAt && (a.createdAt as any).toDate ? (a.createdAt as any).toDate().getTime() : 0;
        const bTime = b.createdAt && (b.createdAt as any).toDate ? (b.createdAt as any).toDate().getTime() : 0;
        return bTime - aTime;
      });
    } else if (activeView === 'edited') {
      list.sort((a: any, b: any) => {
        const aTime = (a.updatedAt && (a.updatedAt as any).toDate) 
          ? (a.updatedAt as any).toDate().getTime() 
          : (a.createdAt && (a.createdAt as any).toDate) 
            ? (a.createdAt as any).toDate().getTime() 
            : 0;
        const bTime = (b.updatedAt && (b.updatedAt as any).toDate) 
          ? (b.updatedAt as any).toDate().getTime() 
          : (b.createdAt && (b.createdAt as any).toDate) 
            ? (b.createdAt as any).toDate().getTime() 
            : 0;
        return bTime - aTime;
      });
    } else {
      list.sort((a, b) => {
        if (!sortConfig.key || !sortConfig.direction) return 0;
        
        let aValue: any = a[sortConfig.key as keyof Publisher];
        let bValue: any = b[sortConfig.key as keyof Publisher];

        if (sortConfig.key === 'owner') {
          aValue = a.ownerName || '';
          bValue = b.ownerName || '';
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
    return list;
  })();

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

  if (selectedPublisherId) {
    return (
      <PublisherDetail 
        publisherId={selectedPublisherId} 
        onBack={() => {
          setSelectedPublisherId(null);
          if (onClearInitialId) onClearInitialId();
        }} 
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Publishers</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage journal publishers and their legal documentation.</p>
        </div>
        <div className="flex gap-3">
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          {check('publishers', 'delete') && (
            <>
              <button
                onClick={() => setIsCleanupModalOpen(true)}
                className="p-3 bg-white text-rose-600 border border-slate-200 rounded-xl hover:bg-rose-50 transition-all shadow-sm"
                title="Cleanup invalid publishers"
              >
                <Trash2 size={20} />
              </button>
              {selectedPublisherIds.length > 0 && (
                <button
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  <Trash2 size={20} />
                  Delete ({selectedPublisherIds.length})
                </button>
              )}
            </>
          )}
          <button 
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={20} />
            Add Publisher
          </button>
        </div>
      </div>

      {/* Search, Filter & Intelligent Views Controls */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
        {/* Outer Grid: Search Box, Client Filter, Document Filter */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Inline Search Box */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search publishers, owners, NTN, email, phone..."
              value={localSearchQuery || ''}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm"
            />
            {localSearchQuery && (
              <button
                type="button"
                onClick={() => setLocalSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear Search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Client Filter Dropdown */}
          <div className="relative">
            <select
              value={clientFilter || ''}
              onChange={(e) => setClientFilter(e.target.value)}
              disabled={!!effectiveClientId && !currentUser.role.includes('Admin')}
              className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm appearance-none text-slate-700 disabled:opacity-50"
            >
              <option value="">All Clients</option>
              {[...clients]
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {cli.name}
                  </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <Filter size={14} />
            </div>
          </div>

          {/* Document Filter Dropdown */}
          <div className="relative">
            <select
              value={documentFilter || ''}
              onChange={(e) => setDocumentFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm appearance-none text-slate-700"
            >
              <option value="">Document Status (All)</option>
              <option value="all_uploaded">All Docs Uploaded</option>
              <option value="missing_any">Missing Any Doc</option>
              <option value="missing_aoa_moa">Missing AOA/MOA</option>
              <option value="missing_cnic">Missing CNIC (F/B)</option>
              <option value="missing_secp_ntn">Missing SECP/NTN</option>
              <option value="has_portal">Has Portal Account</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <FileText size={14} />
            </div>
          </div>

        </div>

        {/* View Selection Tabs & Active Filter Count Info */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200/65">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/50 rounded-xl">
            {[
              { id: 'all', label: 'All Publishers', icon: Building2 },
              { id: 'accessed', label: 'Latest Accessed', icon: Clock },
              { id: 'added', label: 'Latest Added', icon: Sparkles },
              { id: 'edited', label: 'Latest Edited', icon: History }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveView(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                    isActive 
                      ? "bg-white text-indigo-600 shadow-sm" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-300/40"
                  )}
                >
                  <Icon size={14} />
                  {tab.label}
                  {tab.id === 'accessed' && recentAccessedIds.length > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.5 text-[9px] rounded-full font-black",
                      isActive ? "bg-indigo-50 text-indigo-600" : "bg-slate-300 text-slate-700"
                    )}>
                      {recentAccessedIds.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span>Showing: <strong className="font-bold text-slate-800">{sortedPublishers.length}</strong> of {publishers.length} publishers</span>
            {(localSearchQuery || clientFilter || documentFilter || activeView !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearchQuery('');
                  setClientFilter('');
                  setDocumentFilter('');
                  setActiveView('all');
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm border-b border-slate-200">
              <tr className="text-slate-500 text-[10px] uppercase tracking-widest font-black">
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={sortedPublishers.length > 0 && selectedPublisherIds.length === sortedPublishers.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPublisherIds(sortedPublishers.map(p => p.id));
                      } else {
                        setSelectedPublisherIds([]);
                      }
                    }}
                  />
                </th>
                {selectedColumns.includes('name') && (
                  <th 
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => requestSort('name')}
                  >
                    <div className="flex items-center">
                      Publisher Name
                      <SortIcon columnKey="name" />
                    </div>
                  </th>
                )}
                {selectedColumns.includes('client') && (
                  <th className="px-6 py-4">Client</th>
                )}
                {selectedColumns.includes('owner') && (
                  <th 
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => requestSort('owner')}
                  >
                    <div className="flex items-center">
                      Owner
                      <SortIcon columnKey="owner" />
                    </div>
                  </th>
                )}
                {selectedColumns.includes('secp') && <th className="px-6 py-4">SECP</th>}
                {selectedColumns.includes('ntn') && <th className="px-6 py-4">NTN</th>}
                {selectedColumns.includes('login') && <th className="px-6 py-4">Login</th>}
                {selectedColumns.includes('email') && <th className="px-6 py-4">Email</th>}
                {selectedColumns.includes('phone') && <th className="px-6 py-4">Phone</th>}
                {selectedColumns.includes('address') && <th className="px-6 py-4">Address</th>}
                {selectedColumns.includes('documents') && <th className="px-6 py-4">Docs</th>}
                {selectedColumns.includes('createdAt') && (
                  <th 
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                    onClick={() => requestSort('createdAt')}
                  >
                    <div className="flex items-center">
                      Created
                      <SortIcon columnKey="createdAt" />
                    </div>
                  </th>
                )}
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Loader2 className="animate-spin" size={32} />
                      <p className="text-sm font-medium">Loading publishers...</p>
                    </div>
                  </td>
                </tr>
              ) : sortedPublishers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Building2 size={32} />
                      <p className="text-sm font-medium">No publishers found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedPublishers.map((pub) => (
                  <tr 
                    key={pub.id} 
                    onClick={() => setSelectedPublisherId(pub.id)}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedPublisherIds.includes(pub.id)}
                        onChange={() => {
                          setSelectedPublisherIds(prev => 
                            prev.includes(pub.id) 
                              ? prev.filter(id => id !== pub.id)
                              : [...prev, pub.id]
                          );
                        }}
                      />
                    </td>
                    {selectedColumns.includes('name') && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                            {pub.name.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-all">{pub.name}</span>
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('client') && (
                      <td className="px-6 py-4">
                        {(() => {
                          const pubClient = clients.find(c => c.id === pub.clientId);
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onNavigate) onNavigate('clients', pub.clientId);
                              }}
                              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold transition-colors group/client"
                            >
                              <UserIcon size={14} className="text-indigo-400 group-hover/client:text-indigo-600" />
                              <span className="text-sm underline decoration-indigo-200 underline-offset-4 group-hover/client:decoration-indigo-600">{pubClient?.name || 'Unknown Client'}</span>
                            </button>
                          );
                        })()}
                      </td>
                    )}
                    {selectedColumns.includes('owner') && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <UserIcon size={14} className="text-slate-400" />
                          <span className="text-sm">{pub.ownerName}</span>
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('secp') && (
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-slate-500">{pub.secpRegistration}</span>
                      </td>
                    )}
                    {selectedColumns.includes('ntn') && (
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-slate-500">{pub.ntn}</span>
                      </td>
                    )}
                    {selectedColumns.includes('login') && (
                      <td className="px-6 py-4">
                        <div className="text-[10px] space-y-0.5">
                          <p className="flex items-center gap-1">
                            <span className="text-slate-400">U:</span>
                            <span className="font-bold text-slate-700">{pub.loginUsername || '—'}</span>
                          </p>
                          <p className="flex items-center gap-1">
                            <span className="text-slate-400">P:</span>
                            <span className="font-mono text-indigo-600">
                              {isTaiba(pub.loginPassword) && currentUser.role !== 'Admin' ? '••••••••' : (pub.loginPassword || '—')}
                            </span>
                          </p>
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('email') && (
                      <td className="px-6 py-4 text-xs text-slate-600">{pub.email || 'N/A'}</td>
                    )}
                    {selectedColumns.includes('phone') && (
                      <td className="px-6 py-4 text-xs text-slate-600">{pub.phone || 'N/A'}</td>
                    )}
                    {selectedColumns.includes('address') && (
                      <td className="px-6 py-4 text-xs text-slate-600 truncate max-w-[150px]">{pub.address || 'N/A'}</td>
                    )}
                    {selectedColumns.includes('documents') && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {pub.documents?.aoa && <span title="AOA"><FileText size={16} className="text-emerald-500" /></span>}
                          {pub.documents?.moa && <span title="MOA"><FileText size={16} className="text-blue-500" /></span>}
                          {pub.documents?.cnicFront && <span title="CNIC Front"><ShieldCheck size={16} className="text-amber-500" /></span>}
                          {pub.documents?.cnicBack && <span title="CNIC Back"><ShieldCheck size={16} className="text-amber-500" /></span>}
                          {pub.documents?.ntn && <span title="NTN"><FileText size={16} className="text-purple-500" /></span>}
                          {pub.documents?.secp && <span title="SECP"><ShieldCheck size={16} className="text-rose-500" /></span>}
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('createdAt') && (
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {pub.createdAt && (pub.createdAt as any).toDate ? (pub.createdAt as any).toDate().toLocaleDateString() : 'N/A'}
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPublisher(pub);
                            setNewPublisher({
                              clientId: pub.clientId,
                              name: pub.name,
                              ownerName: pub.ownerName,
                              email: pub.email || '',
                              phone: pub.phone || '',
                              address: pub.address || '',
                              secpRegistration: pub.secpRegistration,
                              ntn: pub.ntn,
                              secpLoginUrl: pub.secpLoginUrl || '',
                              loginUsername: pub.loginUsername || '',
                              usernameForPublisher: pub.usernameForPublisher || '',
                              loginPassword: pub.loginPassword || '',
                              documents: {
                                aoa: pub.documents?.aoa || '',
                                moa: pub.documents?.moa || '',
                                cnicFront: pub.documents?.cnicFront || '',
                                cnicBack: pub.documents?.cnicBack || '',
                                ntn: pub.documents?.ntn || '',
                                secp: pub.documents?.secp || '',
                                certificates: pub.documents?.certificates || []
                              }
                            });
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Edit Publisher"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to delete this publisher?')) {
                              handleDeletePublisher(pub.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete Publisher"
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPublisher(null);
          const selectedClient = clients.find(c => c.id === effectiveClientId);
          setNewPublisher({
            clientId: effectiveClientId || '',
            name: '',
            ownerName: selectedClient ? (selectedClient.name || '') : '',
            email: '',
            phone: '',
            address: '',
            secpRegistration: '',
            ntn: '',
            secpLoginUrl: '',
            loginUsername: '',
            usernameForPublisher: '',
            loginPassword: '',
            documents: {
              aoa: '',
              moa: '',
              cnicFront: '',
              cnicBack: '',
              ntn: '',
              secp: '',
              certificates: []
            }
          });
        }}
        title={editingPublisher ? 'Edit Publisher' : 'Add New Publisher'}
        maxWidth="4xl"
        align="top"
      >
        <form onSubmit={handleCreatePublisher} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Client / Owner (Optional)</label>
              <select 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newPublisher.clientId || ''}
                onChange={e => {
                  const selectedClient = clients.find(c => c.id === e.target.value);
                  setNewPublisher(prev => ({ 
                    ...prev, 
                    clientId: e.target.value,
                    ownerName: selectedClient ? selectedClient.name : prev.ownerName
                  }));
                }}
                disabled={!!effectiveClientId && !currentUser.role.includes('Admin')}
              >
                <option value="">No client (Independent)</option>
                {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              
              {/* Already Attached Publishers */}
              {newPublisher.clientId && (
                <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-2">
                  <div className="flex items-center gap-2 text-amber-600 mb-2">
                    <Building2 size={16} />
                    <p className="text-xs font-bold uppercase tracking-widest">Existing Publishers for this Client</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {publishers.filter(p => p.clientId === newPublisher.clientId).length > 0 ? (
                      publishers.filter(p => p.clientId === newPublisher.clientId).map(p => (
                        <div key={p.id} className="px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                          {p.name}
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-amber-500 font-medium italic">No publishers attached yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700">Publisher Name</label>
                <button 
                  type="button"
                  onClick={() => {
                    const tempName = `TEMP-PUB-${new Date().getTime().toString().slice(-6)}`;
                    setNewPublisher(prev => ({ ...prev, name: tempName }));
                  }}
                  className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded hover:bg-amber-100 transition-all uppercase tracking-tight"
                >
                  Set Temp
                </button>
              </div>
              <input 
                required
                type="text" 
                placeholder="e.g. Host A Journal Publishing"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newPublisher.name || ''}
                onChange={e => setNewPublisher(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Owner Name</label>
              <input 
                type="text" 
                placeholder="Enter owner name"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 outline-none transition-all"
                value={newPublisher.ownerName || ''}
                onChange={e => setNewPublisher(prev => ({ ...prev, ownerName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">SECP Registration No.</label>
              <input 
                type="text" 
                placeholder="Registration number"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newPublisher.secpRegistration || ''}
                onChange={e => setNewPublisher(prev => ({ ...prev, secpRegistration: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">NTN Number</label>
              <input 
                type="text" 
                placeholder="National Tax Number"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newPublisher.ntn || ''}
                onChange={e => setNewPublisher(prev => ({ ...prev, ntn: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Email Address</label>
              <input 
                type="email" 
                placeholder="publisher@example.com"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newPublisher.email || ''}
                onChange={e => setNewPublisher(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Phone Number</label>
              <input 
                type="tel" 
                placeholder="e.g. +92 300 1234567"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newPublisher.phone || ''}
                onChange={e => setNewPublisher(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-700">Publisher Address</label>
              <textarea 
                rows={2}
                placeholder="Full physical address of the publisher"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none text-slate-900"
                value={newPublisher.address || ''}
                onChange={e => setNewPublisher(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
          </div>

          <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-900 font-bold">
              <ShieldCheck size={18} />
              SECP / NTN Portal Access
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Login URL</label>
                <input 
                  type="url" 
                  placeholder="SECP / NTN Login URL"
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newPublisher.secpLoginUrl || ''}
                  onChange={e => setNewPublisher(prev => ({ ...prev, secpLoginUrl: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Login Username</label>
                  <input 
                    type="text" 
                    placeholder="Username for portal"
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newPublisher.loginUsername || ''}
                    onChange={e => setNewPublisher(prev => ({ ...prev, loginUsername: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Username for publisher</label>
                  <input 
                    type="text" 
                    placeholder="Username for publisher"
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newPublisher.usernameForPublisher || ''}
                    onChange={e => setNewPublisher(prev => ({ ...prev, usernameForPublisher: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Login Password</label>
                  <input 
                    type="text" 
                    placeholder="Password"
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newPublisher.loginPassword || ''}
                    onChange={e => setNewPublisher(prev => ({ ...prev, loginPassword: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-sm font-bold text-slate-900">Legal Documents</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'AOA Document', field: 'aoa' },
                { label: 'MOA Document', field: 'moa' },
                { label: 'CNIC Front', field: 'cnicFront' },
                { label: 'CNIC Back', field: 'cnicBack' },
                { label: 'NTN Document', field: 'ntn' },
                { label: 'SECP Document', field: 'secp' }
              ].map(({ label, field }) => (
                <div key={field} className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
                  <div className="flex items-center gap-3">
                    <label className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group",
                      newPublisher.documents[field as keyof typeof newPublisher.documents] && "border-emerald-200 bg-emerald-50"
                    )}>
                      {uploading === field ? (
                        <Loader2 className="animate-spin text-indigo-600" size={16} />
                      ) : newPublisher.documents[field as keyof typeof newPublisher.documents] ? (
                        <ShieldCheck className="text-emerald-600" size={16} />
                      ) : (
                        <Plus className="text-slate-400 group-hover:text-indigo-600" size={16} />
                      )}
                      <span className={cn(
                        "text-xs font-bold",
                        newPublisher.documents[field as keyof typeof newPublisher.documents] ? "text-emerald-600" : "text-slate-500 group-hover:text-indigo-600"
                      )}>
                        {newPublisher.documents[field as keyof typeof newPublisher.documents] ? 'Uploaded' : 'Upload File'}
                      </span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileUpload(e, field)}
                      />
                    </label>
                    {newPublisher.documents[field as keyof typeof newPublisher.documents] && (
                      <button 
                        type="button"
                        onClick={() => setNewPublisher(prev => ({
                          ...prev,
                          documents: { ...prev.documents, [field]: '' }
                        }))}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
              disabled={isSubmitting}
              className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="animate-spin" size={18} />}
              {editingPublisher ? 'Update Publisher' : 'Create Publisher'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={executeBulkDelete}
        title="Permanent Bulk Delete"
        message={`Are you sure you want to permanently delete ${selectedPublisherIds.length} selected publishers? This action cannot be undone.`}
        confirmText="Delete Permanently"
        variant="danger"
      />

      <ConfirmModal
        isOpen={isCleanupModalOpen}
        onClose={() => setIsCleanupModalOpen(false)}
        onConfirm={executeCleanup}
        title="Publisher Cleanup"
        message="Are you sure you want to delete all publishers with 'TEMP' or empty names? This action cannot be undone."
        confirmText="Clean Up"
        variant="danger"
      />
    </div>
  );
};
