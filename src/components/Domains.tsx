import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Globe, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  MoreHorizontal, 
  RefreshCw,
  Search,
  ExternalLink,
  Loader2,
  ArrowLeftRight,
  Settings,
  Shield,
  Key,
  Server,
  GitMerge,
  Trash2,
  AlertCircle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Edit,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Domain, Client, User, DomainRegistrar, HostingAccount } from '../types';
import { cn, formatDateForInput } from '../lib/utils';
import { db, handleFirestoreError, OperationType, moveToTrash, logActivity, getErrorMessage } from '../lib/firebase';
import { workflowService } from '../services/workflowService';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, Timestamp, where, doc, updateDoc } from 'firebase/firestore';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import { DomainManager } from './DomainManager';
import { DomainTransferRequests } from './DomainTransferRequests';
import { RegistrarManager } from './RegistrarManager';
import { HostingAccountManager } from './HostingAccountManager';
import { ClientDetail } from './ClientDetail';
import { ColumnSelector } from './ColumnSelector';
import { usePermissions } from '../hooks/usePermissions';
import { MergeModal } from './MergeModal';
import { toast } from 'react-hot-toast';

interface DomainsProps {
  searchQuery: string;
  currentUser: User;
  clientId?: string;
  initialDomainId?: string;
  onClearInitialId?: () => void;
}

const AVAILABLE_COLUMNS = [
  { id: 'domainName', label: 'Domain Name' },
  { id: 'client', label: 'Client' },
  { id: 'domainType', label: 'Domain Type' },
  { id: 'parentDomain', label: 'Parent Domain' },
  { id: 'hostingAccount', label: 'Hosting Account' },
  { id: 'registrar', label: 'Registrar' },
  { id: 'status', label: 'Status' },
  { id: 'registrationDate', label: 'Reg. Date' },
  { id: 'expirationDate', label: 'Exp. Date' },
  { id: 'costPrice', label: 'Cost Price' },
  { id: 'salePrice', label: 'Sale Price' },
  { id: 'eppCode', label: 'EPP Code' },
  { id: 'isDomainSubscribedFromUs', label: 'Domain Us' },
  { id: 'isHostingSubscribedFromUs', label: 'Hosting Us' },
  { id: 'createdAt', label: 'Created At' },
];

export const Domains: React.FC<DomainsProps> = ({ 
  searchQuery, 
  currentUser, 
  clientId,
  initialDomainId,
  onClearInitialId
}) => {
  const { check, isManager, isAdmin } = usePermissions(currentUser);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setGlobalSettings(doc.data());
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (initialDomainId && domains.length > 0) {
      const domain = domains.find(d => d.id === initialDomainId);
      if (domain) {
        setSelectedDomain(domain);
        setIsManagerModalOpen(true);
        if (onClearInitialId) onClearInitialId();
      }
    }
  }, [initialDomainId, domains, onClearInitialId]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isRegistrarModalOpen, setIsRegistrarModalOpen] = useState(false);
  const [isHostingModalOpen, setIsHostingModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Domain>>({});
  const [registrars, setRegistrars] = useState<DomainRegistrar[]>([]);
  const [hostingAccounts, setHostingAccounts] = useState<HostingAccount[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['domains'] || AVAILABLE_COLUMNS.map(c => c.id)
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired' | 'unassigned'>('all');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [filterClientId, setFilterClientId] = useState<string>('all');
  const [filterRegistrar, setFilterRegistrar] = useState<string>('all');
  const [filterHosting, setFilterHosting] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'expirationDate', direction: 'asc' });
  const [showRegistrarCreds, setShowRegistrarCreds] = useState<Record<string, boolean>>({});
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<Domain | null>(null);
  const [duplicates, setDuplicates] = useState<Domain[][]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [registrarSearch, setRegistrarSearch] = useState('');
  const [isRegistrarDropdownOpen, setIsRegistrarDropdownOpen] = useState(false);

  useEffect(() => {
    if (clientId) {
      setNewDomain(prev => ({ ...prev, clientId }));
    }
  }, [clientId]);

  const handleUpdateBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDomain?.id) return;
    
    // Check for uniqueness - STRICTLY prevent duplicate domains system-wide on update
    if (editFormData.domainName) {
      const cleanName = editFormData.domainName.toLowerCase().trim();
      const existingDomain = domains.find(d => d.id !== selectedDomain.id && d.domainName.toLowerCase().trim() === cleanName);
      if (existingDomain) {
        toast.error(`Domain name "${editFormData.domainName}" already exists in the system registry! Dual registration is blocked.`);
        return;
      }
    }

    try {
      const selectedRegistrar = registrars.find(r => r.id === editFormData.registrarId);
      const docRef = doc(db, 'domains', selectedDomain.id);
      
      const updatedData: any = {
        domainName: editFormData.domainName || '',
        costPrice: Number(editFormData.costPrice) || 0,
        salePrice: Number(editFormData.salePrice) || 0,
        registrarId: editFormData.registrarId || '',
        registrar: selectedRegistrar ? selectedRegistrar.name : (editFormData.registrar || ''),
        domainType: editFormData.domainType || 'Primary Domain',
        parentDomainId: editFormData.parentDomainId || '',
        hostingAccount: editFormData.hostingAccount || '',
        hostingAccountId: editFormData.hostingAccountId || '',
        hostingStartDate: editFormData.hostingStartDate || '',
        hostingEndDate: editFormData.hostingEndDate || '',
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        updatedAt: serverTimestamp()
      };

      if (editFormData.registrationDate) {
        updatedData.registrationDate = Timestamp.fromDate(new Date(editFormData.registrationDate));
      } else {
        updatedData.registrationDate = null;
      }

      if (editFormData.expirationDate) {
        updatedData.expirationDate = Timestamp.fromDate(new Date(editFormData.expirationDate));
      }

      await updateDoc(docRef, updatedData);
      toast.success('Domain basic info updated successfully!');
      setIsEditModalOpen(false);
      logActivity(currentUser.id, currentUser.name, 'DOMAIN_UPDATE', `Updated basic info for domain ${selectedDomain.domainName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    }
  };
  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.domains`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const isEmployee = currentUser.role !== 'Client';

  // Form state
  const [newDomain, setNewDomain] = useState({
    clientId: '',
    domainName: '',
    registrarId: '',
    registrar: '',
    status: 'active' as const,
    registrationDate: '',
    expirationDate: '',
    costPrice: 0,
    salePrice: 0,
    isSubscribed: true,
    isDomainSubscribedFromUs: true,
    isHostingSubscribedFromUs: true,
    domainType: 'Primary Domain' as 'Primary Domain' | 'Addon Domain' | 'Subdomain' | 'Parked Domain',
    parentDomainId: '',
    hostingAccount: '',
    hostingAccountId: '',
    hostingStartDate: '',
    hostingEndDate: ''
  });

  const calculateStatus = (expirationDate: string): Domain['status'] => {
    const today = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring_soon';
    return 'active';
  };

  useEffect(() => {
    let q = query(collection(db, 'domains'), orderBy('expirationDate', 'asc'));
    
    if (clientId) {
      q = query(
        collection(db, 'domains'),
        where('clientId', '==', clientId),
        orderBy('expirationDate', 'asc')
      );
    } else if (!isEmployee) {
      q = query(
        collection(db, 'domains'), 
        where('clientId', '==', currentUser.id),
        orderBy('expirationDate', 'asc')
      );
    }

    const unsubscribeDomains = onSnapshot(q, (snapshot) => {
      const domainData = snapshot.docs.map(doc => {
        const data = doc.data();
        const expDate = formatDateForInput(data.expirationDate);
        const regDate = formatDateForInput(data.registrationDate);
        
        return {
          id: doc.id,
          ...data,
          expirationDate: expDate,
          registrationDate: regDate,
          status: calculateStatus(expDate)
        };
      }) as Domain[];
      setDomains(domainData);
      
      // Sync selectedDomain if it's currently open
      setSelectedDomain(prevSelected => {
        if (!prevSelected) return null;
        const updated = domainData.find(d => d.id === prevSelected.id);
        return updated || prevSelected;
      });
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'domains');
      setLoading(false);
    });

    const unsubscribeClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snapshot) => {
      const clientData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeRegistrars = onSnapshot(query(collection(db, 'registrars'), orderBy('name', 'asc')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DomainRegistrar[];
      setRegistrars(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'registrars');
    });

    const unsubscribeHosting = onSnapshot(query(collection(db, 'hostingAccounts'), orderBy('name', 'asc')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HostingAccount[];
      setHostingAccounts(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'hostingAccounts');
    });

    return () => {
      unsubscribeDomains();
      unsubscribeClients();
      unsubscribeRegistrars();
      unsubscribeHosting();
    };
  }, []);

  const uniqueClients = React.useMemo(() => {
    return [...clients].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [clients]);

  const uniqueRegistrars = React.useMemo(() => {
    const list = new Set<string>();
    registrars.forEach(r => {
      if (r.name) {
        list.add(r.name);
      }
    });
    domains.forEach(d => {
      if (d.registrar) {
        list.add(d.registrar);
      }
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b));
  }, [registrars, domains]);

  const uniqueHostingAccounts = React.useMemo(() => {
    const list = new Set<string>();
    hostingAccounts.forEach(h => {
      if (h.name) {
        list.add(h.name);
      }
    });
    domains.forEach(d => {
      if (d.hostingAccount) {
        list.add(d.hostingAccount);
      }
    });
    return Array.from(list).sort();
  }, [hostingAccounts, domains]);

  const filteredDomains = domains.filter(domain => {
    const client = clients.find(c => c.id === domain.clientId);
    
    const activeSearch = localSearchQuery || searchQuery;
    const matchesSearch = !activeSearch ||
                         (domain.domainName?.toLowerCase() || '').includes(activeSearch.toLowerCase()) ||
                         (client?.name?.toLowerCase() || '').includes(activeSearch.toLowerCase()) ||
                         (domain.hostingAccount?.toLowerCase() || '').includes(activeSearch.toLowerCase()) ||
                         (domain.registrar?.toLowerCase() || '').includes(activeSearch.toLowerCase());
                         
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'unassigned' ? !domain.clientId : domain.status === statusFilter);
                         
    const matchesClient = filterClientId === 'all' || domain.clientId === filterClientId;
    
    const matchesRegistrar = filterRegistrar === 'all' || domain.registrar === filterRegistrar;
    
    const matchesHosting = filterHosting === 'all' || domain.hostingAccount === filterHosting;
    
    return matchesSearch && matchesStatus && matchesClient && matchesRegistrar && matchesHosting;
  });

  const sortedDomains = [...filteredDomains].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    
    let aValue: any = a[sortConfig.key as keyof Domain];
    let bValue: any = b[sortConfig.key as keyof Domain];

    if (sortConfig.key === 'client') {
      const clientA = clients.find(c => c.id === a.clientId);
      const clientB = clients.find(c => c.id === b.clientId);
      aValue = clientA?.name || '';
      bValue = clientB?.name || '';
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

  const [confirmingDomainId, setConfirmingDomainId] = useState<string | null>(null);
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [transferConfirmData, setTransferConfirmData] = useState<Domain | null>(null);

  const executeDeleteDomain = async (domain: Domain) => {
    const loadingToast = toast.loading(`Moving "${domain.domainName}" to trash...`);
    try {
      await moveToTrash('domains', domain.id, domain, currentUser.name);
      toast.success(`"${domain.domainName}" moved to trash.`, { id: loadingToast });
      setConfirmingDomainId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'domains');
      toast.error("Delete failed.", { id: loadingToast });
    }
  };

  const executeCleanup = async () => {
    const invalid = domains.filter(d => !d.domainName || d.domainName.toLowerCase().includes('untitled') || d.domainName.toLowerCase().includes('temp'));
    if (invalid.length === 0) {
      toast.success("No invalid domains found.");
      return;
    }
    const loadingToast = toast.loading(`Moving ${invalid.length} domains to trash...`);
    try {
      for (const d of invalid) {
        await moveToTrash('domains', d.id, d, currentUser?.name || 'Admin');
      }
      toast.success(`Moved ${invalid.length} invalid domains to trash.`, { id: loadingToast });
    } catch (error) {
      console.error("Cleanup error:", error);
      toast.error("Cleanup failed.", { id: loadingToast });
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for uniqueness - STRICTLY prevent duplicate domains system-wide
    const existingDomain = domains.find(d => d.domainName.toLowerCase().trim() === newDomain.domainName.toLowerCase().trim());
    if (existingDomain) {
      toast.error(`Domain name "${newDomain.domainName}" already exists! Dual registration of the same domain is not allowed.`);
      return;
    }

    try {
      const client = clients.find(c => c.id === newDomain.clientId);
      const ownershipEntry = {
        id: crypto.randomUUID(),
        clientId: newDomain.clientId,
        clientName: client?.name || 'Unknown',
        startDate: new Date().toISOString().split('T')[0],
        notes: 'Initial ownership'
      };

      const docRef = await addDoc(collection(db, 'domains'), {
        ...newDomain,
        isSubscribed: newDomain.isSubscribed ?? true,
        registrationDate: newDomain.registrationDate ? Timestamp.fromDate(new Date(newDomain.registrationDate)) : null,
        expirationDate: Timestamp.fromDate(new Date(newDomain.expirationDate)),
        ownershipHistory: [ownershipEntry],
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        isVerified: false
      });

      // Auto-generate invoice if it's a purchase from us
      if (newDomain.isDomainSubscribedFromUs) {
        await workflowService.generateDomainInvoice(
          newDomain.clientId,
          client?.name || 'Client',
          '', // No journal ID yet if added independently
          'Domain Registration',
          newDomain.domainName,
          newDomain.costPrice,
          newDomain.salePrice,
          { id: currentUser.id, name: currentUser.name }
        );
        toast.success(`Domain added and invoice generated`);
      }

      setIsModalOpen(false);
      setNewDomain({
        clientId: '',
        domainName: '',
        registrarId: '',
        registrar: '',
        status: 'active',
        registrationDate: '',
        expirationDate: '',
        costPrice: 0,
        salePrice: 0,
        isSubscribed: true,
        isDomainSubscribedFromUs: true,
        isHostingSubscribedFromUs: true,
        domainType: 'Primary Domain',
        parentDomainId: '',
        hostingAccount: '',
        hostingAccountId: '',
        hostingStartDate: '',
        hostingEndDate: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'domains');
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Manager') return;
    
    try {
      const domainRef = doc(db, 'domains', domainId);
      await updateDoc(domainRef, {
        isVerified: true,
        verifiedBy: currentUser.name,
        verifiedById: currentUser.id,
        verifiedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    }
  };

  const scanForDuplicates = () => {
    setIsScanning(true);
    setHasScanned(true);
    const groups: Domain[][] = [];
    const processed = new Set<string>();

    domains.forEach(domain => {
      if (processed.has(domain.id)) return;

      const group = domains.filter(other => {
        if (other.id === domain.id) return false;
        return domain.domainName?.toLowerCase() === other.domainName?.toLowerCase();
      });

      if (group.length > 0) {
        const fullGroup = [domain, ...group];
        fullGroup.forEach(item => processed.add(item.id));
        groups.push(fullGroup);
      }
    });

    setDuplicates(groups);
    setIsScanning(false);
    if (groups.length === 0) {
      toast.success("No duplicate domains found.");
    }
  };

  const stats = {
    active: domains.filter(d => d.status === 'active').length,
    expiring: domains.filter(d => d.status === 'expiring_soon').length,
    expired: domains.filter(d => d.status === 'expired').length,
  };

  const getStatusColor = (status: Domain['status']) => {
    switch (status) {
      case 'active': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'expiring_soon': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'expired': return 'bg-rose-50 text-rose-700 border-rose-100';
    }
  };

  const getStatusIcon = (status: Domain['status']) => {
    switch (status) {
      case 'active': return <CheckCircle2 size={14} />;
      case 'expiring_soon': return <AlertTriangle size={14} />;
      case 'expired': return <XCircle size={14} />;
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Domain Management</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track registration, status, and expiration of client domains.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          {isEmployee && check('domains', 'edit') && (
            <>
              <button 
                onClick={() => setIsRegistrarModalOpen(true)}
                className="p-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm cursor-pointer"
                title="Registrars"
              >
                <Settings size={20} className="text-indigo-600 dark:text-indigo-400" />
              </button>
              <button 
                onClick={() => setIsHostingModalOpen(true)}
                className="p-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm cursor-pointer"
                title="Hosting Accounts"
              >
                <Server size={20} className="text-indigo-600 dark:text-indigo-400" />
              </button>
            </>
          )}
          <button 
            onClick={() => setIsTransferModalOpen(true)}
            className="p-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm cursor-pointer"
            title="Transfers"
          >
            <ArrowLeftRight size={20} className="text-indigo-600 dark:text-indigo-400" />
          </button>
          {isEmployee && (
            <>
              <button 
                onClick={scanForDuplicates}
                disabled={isScanning}
                className="p-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                title="Duplicate Check"
              >
                {isScanning ? <Loader2 size={18} className="animate-spin" /> : <GitMerge size={20} className="text-indigo-600 dark:text-indigo-400" />}
              </button>
              <button
                onClick={() => setIsCleanupModalOpen(true)}
                className="p-2.5 bg-white dark:bg-slate-800 text-rose-600 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all shadow-sm cursor-pointer"
                title="Cleanup Invalid Domains"
              >
                <Trash2 size={20} />
              </button>
            </>
          )}
          {isAdmin && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="p-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 dark:shadow-none cursor-pointer"
              title="Add New Domain"
            >
              <Plus size={20} />
            </button>
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
                <h4 className="font-bold">Potential Duplicate Domains Found ({duplicates.length} groups)</h4>
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
                    {group.map((domain, dIdx) => (
                      <div key={`${domain.id}-${dIdx}`} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                        <div className="truncate mr-2">
                          <p className="font-bold text-slate-700 truncate">{domain.domainName}</p>
                          <p className="text-[10px] text-slate-500 truncate">{domain.registrar}</p>
                        </div>
                        <button 
                          onClick={() => {
                            setMergeSource(domain);
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

      {hasScanned && duplicates.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-sm mb-6"
        >
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 size={20} />
            <h4 className="font-bold text-sm text-emerald-700">Scan Complete: No duplicate domains found.</h4>
          </div>
          <button 
            onClick={() => setHasScanned(false)}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Dynamic Filters Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Globe className="text-indigo-600" size={20} />
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Filters & Lookups</h3>
          </div>
          {(localSearchQuery || filterClientId !== 'all' || filterRegistrar !== 'all' || filterHosting !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setLocalSearchQuery('');
                setFilterClientId('all');
                setFilterRegistrar('all');
                setFilterHosting('all');
                setStatusFilter('all');
              }}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1"
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Instant Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Instant search domains, registrars..."
              className="w-full pl-10 pr-10 py-2.5 text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium"
              value={localSearchQuery || ''}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
            />
            {localSearchQuery && (
              <button
                onClick={() => setLocalSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-xs font-black"
              >
                ✕
              </button>
            )}
          </div>

          {/* Client Filter */}
          <div className="flex flex-col gap-1.5">
            <select
              className="w-full px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={filterClientId || ''}
              onChange={(e) => setFilterClientId(e.target.value)}
            >
              <option value="all">📁 All Clients</option>
              {uniqueClients.map(c => (
                <option key={c.id} value={c.id}>{c.name || 'Unnamed Client'}</option>
              ))}
            </select>
          </div>

          {/* Registrar Filter */}
          <div className="flex flex-col gap-1.5">
            <select
              className="w-full px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={filterRegistrar || ''}
              onChange={(e) => setFilterRegistrar(e.target.value)}
            >
              <option value="all">🛡️ All Registrars</option>
              {uniqueRegistrars.map(reg => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>
          </div>

          {/* Hosting Account Filter */}
          <div className="flex flex-col gap-1.5">
            <select
              className="w-full px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={filterHosting || ''}
              onChange={(e) => setFilterHosting(e.target.value)}
            >
              <option value="all">🖥️ All Hosting Accounts</option>
              {uniqueHostingAccounts.map(host => (
                <option key={host} value={host}>{host}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Nested Status filter selector & Stats Info row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'active', 'expiring_soon', 'expired', 'unassigned'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                  statusFilter === status 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-155" 
                    : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                )}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            {filteredDomains.length} of {domains.length} Domains Found
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Active Domains</p>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">{stats.active}</h4>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Expiring Soon</p>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">{stats.expiring}</h4>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 text-slate-900 dark:text-white">
          <div className="p-3 bg-rose-100 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-xl">
            <XCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Expired</p>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">{stats.expired}</h4>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Loading domains...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-sans">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 shadow-sm border-b border-slate-100 dark:border-slate-800">
                <tr className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest font-black">
                  {selectedColumns.includes('domainName') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('domainName')}
                    >
                      <div className="flex items-center">
                        Domain Name
                        <SortIcon columnKey="domainName" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('client') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('client')}
                    >
                      <div className="flex items-center">
                        Client
                        <SortIcon columnKey="client" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('domainType') && (
                    <th className="px-6 py-4">
                      Domain Type
                    </th>
                  )}
                  {selectedColumns.includes('parentDomain') && (
                    <th className="px-6 py-4">
                      Parent Domain
                    </th>
                  )}
                  {selectedColumns.includes('hostingAccount') && (
                    <th className="px-6 py-4">
                      Hosting Account
                    </th>
                  )}
                  {selectedColumns.includes('registrar') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('registrar')}
                    >
                      <div className="flex items-center">
                        Registrar
                        <SortIcon columnKey="registrar" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('status') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('status')}
                    >
                      <div className="flex items-center">
                        Status
                        <SortIcon columnKey="status" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('registrationDate') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('registrationDate')}
                    >
                      <div className="flex items-center">
                        Reg. Date
                        <SortIcon columnKey="registrationDate" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('expirationDate') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('expirationDate')}
                    >
                      <div className="flex items-center">
                        Exp. Date
                        <SortIcon columnKey="expirationDate" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('costPrice') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('costPrice')}
                    >
                      <div className="flex items-center">
                        Cost
                        <SortIcon columnKey="costPrice" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('salePrice') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('salePrice')}
                    >
                      <div className="flex items-center">
                        Sale
                        <SortIcon columnKey="salePrice" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('eppCode') && <th className="px-6 py-4">EPP Code</th>}
                  {selectedColumns.includes('isDomainSubscribedFromUs') && <th className="px-6 py-4">D. Us</th>}
                  {selectedColumns.includes('isHostingSubscribedFromUs') && <th className="px-6 py-4">H. Us</th>}
                  {selectedColumns.includes('createdAt') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('createdAt')}
                    >
                      <div className="flex items-center">
                        Created At
                        <SortIcon columnKey="createdAt" />
                      </div>
                    </th>
                  )}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                <AnimatePresence mode="popLayout">
                  {sortedDomains.map((domain) => (
                    <motion.tr 
                      layout
                      key={domain.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-all group"
                    >
                      {selectedColumns.includes('domainName') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Globe size={16} className="text-indigo-500" />
                            <span 
                              onClick={() => {
                                setSelectedDomain(domain);
                                setIsManagerModalOpen(true);
                              }}
                              className="font-bold text-sm text-slate-900 dark:text-slate-100 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-all"
                              title="Click to view Domain credentials & details"
                            >
                              {domain.domainName}
                            </span>
                            <a 
                              href={`https://${domain.domainName}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('client') && (
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const client = clients.find(c => c.id === domain.clientId);
                                if (client) setViewingClient(client);
                              }}
                              className={cn(
                                "text-sm font-bold hover:underline text-left",
                                domain.clientId ? "text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400" : "text-rose-500 dark:text-rose-400"
                              )}
                            >
                              {clients.find(c => c.id === domain.clientId)?.name || 'Unassigned'}
                            </button>
                            {domain.clientId && <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{domain.clientId}</p>}
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('domainType') && (
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-bold",
                            domain.domainType === 'Primary Domain' ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" :
                            domain.domainType === 'Addon Domain' ? "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/20 dark:text-fuchsia-400" :
                            domain.domainType === 'Subdomain' ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" :
                            "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            {domain.domainType || 'Primary Domain'}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('parentDomain') && (
                        <td className="px-6 py-4">
                          {domain.parentDomainId ? (
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                              {domains.find(d => d.id === domain.parentDomainId)?.domainName || 'Unknown Parent'}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                          )}
                        </td>
                      )}
                      {selectedColumns.includes('hostingAccount') && (
                        <td className="px-6 py-4">
                          <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                            {domain.hostingAccount || '-'}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('registrar') && (
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {domain.registrarId ? (
                              <>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-900/30 self-start">
                                  {registrars.find(r => r.id === domain.registrarId)?.name || domain.registrar}
                                </span>
                                <div className="flex flex-col gap-1 mt-1">
                                  {registrars.find(r => r.id === domain.registrarId)?.link && (
                                    <a 
                                      href={registrars.find(r => r.id === domain.registrarId)?.link} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                                    >
                                      Portal Link <ExternalLink size={10} />
                                    </a>
                                  )}
                                  
                                  {isManager && (
                                    <div className="space-y-1 mt-1 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex flex-col">
                                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-tighter">Login Details</span>
                                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                                            {domain.registrarCredentials?.username || registrars.find(r => r.id === domain.registrarId)?.email || 'N/A'}
                                          </span>
                                        </div>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowRegistrarCreds(prev => ({ ...prev, [domain.id]: !prev[domain.id] }));
                                          }}
                                          className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                        >
                                          <Key size={12} />
                                        </button>
                                      </div>
                                      {showRegistrarCreds[domain.id] && (
                                        <div className="flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-700">
                                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-white dark:bg-slate-900 px-1 rounded">
                                            {domain.registrarCredentials?.password || registrars.find(r => r.id === domain.registrarId)?.password || '••••••••'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                                {domain.registrar}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
      {selectedColumns.includes('status') && (
        <td className="px-6 py-4">
          <div className="flex flex-col gap-1">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
              getStatusColor(domain.status)
            )}>
              {getStatusIcon(domain.status)}
              {domain.status.replace('_', ' ')}
            </span>
            <div className="flex flex-col gap-1">
              {domain.isDomainSubscribedFromUs ? (
                <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 self-start">
                  Domain (Us)
                </span>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30 self-start">
                  Domain (External)
                </span>
              )}
              {domain.isHostingSubscribedFromUs ? (
                <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 self-start">
                  Hosting (Us)
                </span>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30 self-start">
                  Hosting (External)
                </span>
              )}
            </div>
          </div>
        </td>
      )}
                      {selectedColumns.includes('registrationDate') && (
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                          {domain.registrationDate || 'N/A'}
                        </td>
                      )}
                      {selectedColumns.includes('expirationDate') && (
                        <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                          {domain.expirationDate || 'N/A'}
                        </td>
                      )}
                      {selectedColumns.includes('costPrice') && (
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-bold">
                          ${domain.costPrice || 0}
                        </td>
                      )}
                      {selectedColumns.includes('salePrice') && (
                        <td className="px-6 py-4 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          ${domain.salePrice || 0}
                        </td>
                      )}
                      {selectedColumns.includes('eppCode') && (
                        <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-slate-300">
                          {domain.eppCode || '—'}
                        </td>
                      )}
                      {selectedColumns.includes('isDomainSubscribedFromUs') && (
                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300 font-medium">
                          {domain.isDomainSubscribedFromUs ? (
                            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">Yes</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">External</span>
                          )}
                        </td>
                      )}
                      {selectedColumns.includes('isHostingSubscribedFromUs') && (
                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300 font-medium">
                          {domain.isHostingSubscribedFromUs ? (
                            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">Yes</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">External</span>
                          )}
                        </td>
                      )}
                      {selectedColumns.includes('createdAt') && (
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                          {domain.createdAt ? new Date(domain.createdAt).toLocaleDateString() : '—'}
                        </td>
                      )}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && (
                            <button 
                              onClick={() => {
                                setSelectedDomain(domain);
                                setEditFormData({
                                  domainName: domain.domainName,
                                  registrationDate: domain.registrationDate,
                                  expirationDate: domain.expirationDate,
                                  costPrice: domain.costPrice,
                                  salePrice: domain.salePrice,
                                  registrarId: domain.registrarId || registrars.find(r => r.name.toLowerCase() === domain.registrar?.toLowerCase())?.id || '',
                                  registrar: domain.registrar || '',
                                  domainType: domain.domainType || 'Primary Domain',
                                  parentDomainId: domain.parentDomainId || '',
                                  hostingAccount: domain.hostingAccount || '',
                                  hostingAccountId: domain.hostingAccountId || '',
                                  hostingStartDate: domain.hostingStartDate || '',
                                  hostingEndDate: domain.hostingEndDate || ''
                                });
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Edit Basic Info"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedDomain(domain);
                              setIsManagerModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Manage Domain & Hosting"
                          >
                            <Settings size={16} />
                          </button>
                          {isEmployee && (
                            <button 
                              onClick={() => {
                                setSelectedDomain(domain);
                                setIsManagerModalOpen(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all"
                            >
                              <RefreshCw size={14} />
                              Renew
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedDomain(domain);
                              setIsManagerModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="More Options"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {isAdmin && (
                            <div className="relative">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmingDomainId(confirmingDomainId === domain.id ? null : domain.id);
                                }}
                                className={cn(
                                  "p-2 rounded-lg transition-all border",
                                  confirmingDomainId === domain.id 
                                    ? "bg-rose-50 text-rose-700 border-rose-200" 
                                    : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-transparent"
                                )}
                                title="Delete Domain"
                              >
                                <Trash2 size={16} />
                              </button>

                                <AnimatePresence>
                                  {confirmingDomainId === domain.id && (
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
                                          <h4 className="font-bold text-slate-900 text-xs text-left">Move to Trash?</h4>
                                          <p className="text-[10px] text-slate-500 mt-1 text-left">Are you sure you want to move this domain to trash?</p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => setConfirmingDomainId(null)}
                                          className="flex-1 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-100 transition-all"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => executeDeleteDomain(domain)}
                                          className="flex-1 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-700 transition-all shadow-sm"
                                        >
                                          Confirm
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
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
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Add New Domain"
      >
        <form onSubmit={handleAddDomain} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Select Client</label>
            <select 
              required
              className="crm-input"
              value={newDomain.clientId || ''}
              onChange={e => setNewDomain(prev => ({ ...prev, clientId: e.target.value }))}
            >
              <option value="">Choose a client...</option>
              {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Domain Name</label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 cursor-pointer bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40 hover:bg-amber-100 transition-colors">
                  <input 
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border-amber-300 dark:border-amber-800 text-amber-600 focus:ring-amber-500"
                    checked={newDomain.isDomainSubscribedFromUs}
                    onChange={e => {
                      const checked = e.target.checked;
                      setNewDomain(prev => ({ 
                        ...prev, 
                        isDomainSubscribedFromUs: checked,
                        isSubscribed: checked ? true : prev.isSubscribed
                      }));
                    }}
                  />
                  <span>Domain (Us)</span>
                </label>
              </div>
              <button 
                type="button"
                onClick={() => {
                  const tempDomain = `TEMP-DOMAIN-${new Date().getTime().toString().slice(-6)}.temp`;
                  setNewDomain(prev => ({ ...prev, domainName: tempDomain }));
                }}
                className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded hover:bg-amber-100 transition-all uppercase tracking-tight"
              >
                Set Temp
              </button>
            </div>
            <input 
              required
              type="text" 
              className="crm-input"
              placeholder="e.g. journal-of-science.com"
              value={newDomain.domainName || ''}
              onChange={e => setNewDomain(prev => ({ ...prev, domainName: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Domain Type</label>
            <select
              className="crm-input"
              value={newDomain.domainType || ''}
              onChange={e => setNewDomain(prev => ({ 
                ...prev, 
                domainType: e.target.value as any,
                parentDomainId: e.target.value === 'Primary Domain' ? '' : prev.parentDomainId
              }))}
            >
              <option value="Primary Domain">Primary Domain</option>
              <option value="Addon Domain">Addon Domain</option>
              <option value="Subdomain">Subdomain</option>
              <option value="Parked Domain">Parked Domain</option>
            </select>
          </div>

          {newDomain.domainType !== 'Primary Domain' && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Parent Domain</label>
              <select
                required
                className="crm-input"
                value={newDomain.parentDomainId || ''}
                onChange={e => setNewDomain(prev => ({ ...prev, parentDomainId: e.target.value }))}
              >
                <option value="">Choose Parent Domain...</option>
                {domains
                  .filter(d => d.clientId === newDomain.clientId && (!d.domainType || d.domainType === 'Primary Domain'))
                  .map(d => (
                    <option key={d.id} value={d.id}>{d.domainName}</option>
                  ))}
              </select>
            </div>
          )}

          <div className="space-y-4 p-4 bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-2xl">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Server size={14} className="text-indigo-600" />
                  Hosting Account / Server
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 cursor-pointer bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40 hover:bg-amber-100 transition-colors">
                  <input 
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border-amber-300 dark:border-amber-800 text-amber-600 focus:ring-amber-500"
                    checked={newDomain.isHostingSubscribedFromUs}
                    onChange={e => {
                      const checked = e.target.checked;
                      setNewDomain(prev => ({ 
                        ...prev, 
                        isHostingSubscribedFromUs: checked,
                        isSubscribed: checked ? true : prev.isSubscribed
                      }));
                    }}
                  />
                  <span>Hosting (Us)</span>
                </label>
              </div>
              <select 
                className="crm-input"
                value={newDomain.hostingAccountId || ''}
                onChange={e => {
                  const id = e.target.value;
                  const selectedHost = hostingAccounts.find(h => h.id === id);
                  setNewDomain(prev => ({
                    ...prev,
                    hostingAccountId: id,
                    hostingAccount: selectedHost ? selectedHost.name : ''
                  }));
                }}
              >
                <option value="">Select Hosting Account / Server...</option>
                {hostingAccounts.map(ha => (
                  <option key={ha.id} value={ha.id}>
                    {ha.name} {ha.ip ? `(${ha.ip})` : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={12} className="text-slate-400" /> Hosting Start Date
                </label>
                <input 
                  type="date" 
                  className="crm-input"
                  value={newDomain.hostingStartDate || ''}
                  onChange={e => setNewDomain(prev => ({ ...prev, hostingStartDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={12} className="text-slate-400" /> Hosting End Date
                </label>
                <input 
                  type="date" 
                  className="crm-input"
                  value={newDomain.hostingEndDate || ''}
                  onChange={e => setNewDomain(prev => ({ ...prev, hostingEndDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Registrar</label>
            <div className="relative">
              <button 
                type="button"
                onClick={() => setIsRegistrarDropdownOpen(!isRegistrarDropdownOpen)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none transition-all flex items-center justify-between text-left text-slate-900 dark:text-slate-100"
              >
                <span className={cn(newDomain.registrar ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500")}>
                  {newDomain.registrar || "Select Registrar..."}
                </span>
                <ChevronDown size={16} className={cn("text-slate-400 transition-transform", isRegistrarDropdownOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isRegistrarDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-[60]" 
                      onClick={() => setIsRegistrarDropdownOpen(false)} 
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-[70] w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
                    >
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
                          <input 
                            autoFocus
                            type="text"
                            placeholder="Search registrars..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                            value={registrarSearch || ''}
                            onChange={e => setRegistrarSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto p-1">
                        {registrars
                          .filter(r => r.name.toLowerCase().includes(registrarSearch.toLowerCase()))
                          .map(reg => (
                            <button
                              key={reg.id}
                              type="button"
                              onClick={() => {
                                setNewDomain(prev => ({ 
                                  ...prev, 
                                  registrarId: reg.id,
                                  registrar: reg.name 
                                }));
                                setIsRegistrarDropdownOpen(false);
                                setRegistrarSearch('');
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm rounded-lg transition-all flex items-center justify-between group",
                                newDomain.registrarId === reg.id 
                                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 font-bold" 
                                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                              )}
                            >
                              {reg.name}
                              {newDomain.registrarId === reg.id && <CheckCircle2 size={14} />}
                            </button>
                          ))}
                        {registrars.filter(r => r.name.toLowerCase().includes(registrarSearch.toLowerCase())).length === 0 && (
                          <div className="py-8 text-center text-slate-400 dark:text-slate-600">
                            <p className="text-xs">No registrars found</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            {newDomain.registrarId && (
              <div className="flex items-center gap-4 mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-widest">Portal Login Link</p>
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 truncate">{registrars.find(r => r.id === newDomain.registrarId)?.link}</p>
                </div>
                <a 
                  href={registrars.find(r => r.id === newDomain.registrarId)?.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all"
                >
                  <ExternalLink size={14} />
                  Login
                </a>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Registration Date</label>
              <input 
                type="date" 
                className="crm-input"
                value={newDomain.registrationDate || ''}
                onChange={e => setNewDomain(prev => ({ ...prev, registrationDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Expiration Date</label>
              <input 
                required
                type="date" 
                className="crm-input"
                value={newDomain.expirationDate || ''}
                onChange={e => setNewDomain(prev => ({ ...prev, expirationDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                Cost Price ($)
                {newDomain.isDomainSubscribedFromUs && <span className="text-rose-500 text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-900/20 px-1.5 py-0.5 rounded ml-1">Required</span>}
              </label>
              <input 
                type="number" 
                className="crm-input"
                placeholder="0.00"
                value={newDomain.costPrice || ''}
                onChange={e => setNewDomain(prev => ({ ...prev, costPrice: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                Sale Price ($)
                {newDomain.isDomainSubscribedFromUs && <span className="text-emerald-500 text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded ml-1">Required</span>}
              </label>
              <input 
                type="number" 
                className="crm-input"
                placeholder="0.00"
                value={newDomain.salePrice || ''}
                onChange={e => setNewDomain(prev => ({ ...prev, salePrice: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className={cn(
            "flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 transition-all",
            newDomain.isDomainSubscribedFromUs && "bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/20"
          )}>
            <input 
              type="checkbox"
              id="isSubscribed"
              disabled={newDomain.isDomainSubscribedFromUs}
              className={cn(
                "w-5 h-5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500",
                newDomain.isDomainSubscribedFromUs && "opacity-50 cursor-not-allowed"
              )}
              checked={newDomain.isSubscribed}
              onChange={e => setNewDomain(prev => ({ ...prev, isSubscribed: e.target.checked }))}
            />
            <label htmlFor="isSubscribed" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex-1">
              Client has officially subscribed to this service
              {newDomain.isDomainSubscribedFromUs && <span className="ml-2 text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-sm"><CheckCircle2 size={10} /> Compulsory</span>}
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Unsubscribed services restrict client chat and support access.</p>
            </label>
          </div>
          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              Add New Domain
            </button>
          </div>
        </form>
      </Modal>

      {/* Basic Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Domain Basic Info"
      >
        <form onSubmit={handleUpdateBasicInfo} className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Domain Name</label>
              <input 
                type="text"
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                value={editFormData.domainName || ''}
                onChange={e => setEditFormData(prev => ({ ...prev, domainName: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Domain Type</label>
              <select
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                value={editFormData.domainType || 'Primary Domain'}
                onChange={e => setEditFormData(prev => ({ 
                  ...prev, 
                  domainType: e.target.value as any,
                  parentDomainId: e.target.value === 'Primary Domain' ? '' : prev.parentDomainId
                }))}
              >
                <option value="Primary Domain">Primary Domain</option>
                <option value="Addon Domain">Addon Domain</option>
                <option value="Subdomain">Subdomain</option>
                <option value="Parked Domain">Parked Domain</option>
              </select>
            </div>

            {editFormData.domainType && editFormData.domainType !== 'Primary Domain' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Parent Domain</label>
                <select
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  value={editFormData.parentDomainId || ''}
                  onChange={e => setEditFormData(prev => ({ ...prev, parentDomainId: e.target.value }))}
                >
                  <option value="">Choose Parent Domain...</option>
                  {domains
                    .filter(d => d.id !== selectedDomain?.id && d.clientId === selectedDomain?.clientId && (!d.domainType || d.domainType === 'Primary Domain'))
                    .map(d => (
                      <option key={d.id} value={d.id}>{d.domainName}</option>
                    ))}
                </select>
              </div>
            )}

            <div className="space-y-4 p-4 bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-2xl">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Server size={14} className="text-indigo-600" />
                  Hosting Account / Server
                </label>
                <select 
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm text-slate-900 dark:text-white"
                  value={editFormData.hostingAccountId || ''}
                  onChange={e => {
                    const id = e.target.value;
                    const selectedHost = hostingAccounts.find(h => h.id === id);
                    setEditFormData(prev => ({
                      ...prev,
                      hostingAccountId: id,
                      hostingAccount: selectedHost ? selectedHost.name : ''
                    }));
                  }}
                >
                  <option value="">Select Hosting Account / Server...</option>
                  {hostingAccounts.map(ha => (
                    <option key={ha.id} value={ha.id}>
                      {ha.name} {ha.ip ? `(${ha.ip})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" /> Hosting Start Date
                  </label>
                  <input 
                    type="date" 
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-sm"
                    value={editFormData.hostingStartDate || ''}
                    onChange={e => setEditFormData(prev => ({ ...prev, hostingStartDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" /> Hosting End Date
                  </label>
                  <input 
                    type="date" 
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-sm"
                    value={editFormData.hostingEndDate || ''}
                    onChange={e => setEditFormData(prev => ({ ...prev, hostingEndDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Reg. Date</label>
                <input 
                  type="date"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                  value={editFormData.registrationDate || ''}
                  onChange={e => setEditFormData(prev => ({ ...prev, registrationDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Exp. Date</label>
                <input 
                  type="date"
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                  value={editFormData.expirationDate || ''}
                  onChange={e => setEditFormData(prev => ({ ...prev, expirationDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cost Price</label>
                <input 
                  type="number"
                  step="0.01"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  value={editFormData.costPrice || 0 || ''}
                  onChange={e => setEditFormData(prev => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sale Price</label>
                <input 
                  type="number"
                  step="0.01"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  value={editFormData.salePrice || 0 || ''}
                  onChange={e => setEditFormData(prev => ({ ...prev, salePrice: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Registrar</label>
              <select 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                value={editFormData.registrarId || ''}
                onChange={e => setEditFormData(prev => ({ ...prev, registrarId: e.target.value }))}
              >
                <option value="">Select Registrar</option>
                {registrars.map(reg => (
                  <option key={reg.id} value={reg.id}>{reg.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Save Basic Info
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        title="Domain & Hosting Management"
        maxWidth="4xl"
      >
        {selectedDomain && (
          <DomainManager 
            domain={selectedDomain} 
            onClose={() => setIsManagerModalOpen(false)} 
            isEmployee={isEmployee}
            currentUser={currentUser}
          />
        )}
      </Modal>

      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Domain Transfer Requests"
        maxWidth="5xl"
      >
        <DomainTransferRequests 
          currentUser={currentUser} 
          clients={clients} 
        />
      </Modal>

      <Modal
        isOpen={isRegistrarModalOpen}
        onClose={() => setIsRegistrarModalOpen(false)}
        title="Settings: Domain Registrars"
        maxWidth="4xl"
      >
        <RegistrarManager currentUser={currentUser} />
      </Modal>

      <Modal
        isOpen={isHostingModalOpen}
        onClose={() => setIsHostingModalOpen(false)}
        title="Settings: Hosting Accounts"
        maxWidth="5xl"
      >
        <HostingAccountManager currentUser={currentUser} />
      </Modal>

      {viewingClient && (
        <ClientDetail 
          client={viewingClient} 
          onBack={() => setViewingClient(null)} 
          currentUser={currentUser}
        />
      )}
      <MergeModal
        isOpen={isMergeModalOpen}
        onClose={() => {
          setIsMergeModalOpen(false);
          setMergeSource(null);
        }}
        type="domains"
        initialSourceItem={mergeSource}
        onSuccess={() => {
          setDuplicates([]);
          scanForDuplicates();
        }}
      />
      <ConfirmModal
        isOpen={isCleanupModalOpen}
        onClose={() => setIsCleanupModalOpen(false)}
        onConfirm={executeCleanup}
        title="Domain Cleanup"
        message="Are you sure you want to move all domains with 'TEMP' or empty domain names to trash?"
        confirmText="Clean Up"
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!transferConfirmData}
        onClose={() => setTransferConfirmData(null)}
        onConfirm={() => {
          if (transferConfirmData) {
            setSelectedDomain(transferConfirmData);
            setIsManagerModalOpen(true);
            setIsModalOpen(false);
          }
        }}
        title="Domain Already Exists"
        message={`Domain "${transferConfirmData?.domainName}" is already assigned to another client. Would you like to transfer it instead?`}
        confirmText="Transfer Domain"
        variant="warning"
      />
    </div>
  );
};
