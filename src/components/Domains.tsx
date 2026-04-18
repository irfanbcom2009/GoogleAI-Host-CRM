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
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Domain, Client, User, DomainRegistrar } from '../types';
import { cn, formatDateForInput } from '../lib/utils';
import { db, handleFirestoreError, OperationType, moveToTrash } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, Timestamp, where, doc, updateDoc } from 'firebase/firestore';
import { Modal } from './Modal';
import { DomainManager } from './DomainManager';
import { DomainTransferRequests } from './DomainTransferRequests';
import { RegistrarManager } from './RegistrarManager';
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
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);

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
  const [registrars, setRegistrars] = useState<DomainRegistrar[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['domains'] || AVAILABLE_COLUMNS.map(c => c.id)
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired' | 'unassigned'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'expirationDate', direction: 'asc' });
  const [showRegistrarCreds, setShowRegistrarCreds] = useState<Record<string, boolean>>({});
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<Domain | null>(null);
  const [duplicates, setDuplicates] = useState<Domain[][]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [registrarSearch, setRegistrarSearch] = useState('');
  const [isRegistrarDropdownOpen, setIsRegistrarDropdownOpen] = useState(false);

  useEffect(() => {
    if (clientId) {
      setNewDomain(prev => ({ ...prev, clientId }));
    }
  }, [clientId]);

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
    isHostingSubscribedFromUs: true
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

    return () => {
      unsubscribeDomains();
      unsubscribeClients();
      unsubscribeRegistrars();
    };
  }, []);

  const filteredDomains = domains.filter(domain => {
    const client = clients.find(c => c.id === domain.clientId);
    const matchesSearch = (domain.domainName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         (client?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'unassigned' ? !domain.clientId : domain.status === statusFilter);
    
    return matchesSearch && matchesStatus;
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

  const handleDeleteDomain = async (domain: Domain) => {
    if (!confirm(`Are you sure you want to move "${domain.domainName}" to trash?`)) return;
    try {
      await moveToTrash('domains', domain.id, domain, currentUser.name);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'domains');
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for uniqueness
    const existingDomain = domains.find(d => d.domainName.toLowerCase() === newDomain.domainName.toLowerCase());
    if (existingDomain) {
      if (confirm(`Domain "${newDomain.domainName}" is already assigned to another client. Would you like to transfer it instead?`)) {
        setSelectedDomain(existingDomain);
        setIsManagerModalOpen(true);
        setIsModalOpen(false);
      }
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

      await addDoc(collection(db, 'domains'), {
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
        isHostingSubscribedFromUs: true
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
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Domain Management</h2>
          <p className="text-slate-500 mt-1">Track registration, status, and expiration of client domains.</p>
        </div>
        <div className="flex items-center gap-3">
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          {isEmployee && check('domains', 'edit') && (
            <button 
              onClick={() => setIsRegistrarModalOpen(true)}
              className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              <Settings size={20} className="text-indigo-600" />
              Registrars
            </button>
          )}
          <button 
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeftRight size={20} className="text-indigo-600" />
            Transfers
          </button>
          {isEmployee && (
            <button 
              onClick={scanForDuplicates}
              disabled={isScanning}
              className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
              title="Scan for duplicate domains"
            >
              {isScanning ? <Loader2 size={18} className="animate-spin" /> : <GitMerge size={20} className="text-indigo-600" />}
              Duplicate Check
            </button>
          )}
          {isEmployee && (
            <>
              {check('domains', 'add') && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Plus size={20} />
                  Add New Domain
                </button>
              )}
            </>
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

      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'active', 'expiring_soon', 'expired', 'unassigned'] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              statusFilter === status 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Active Domains</p>
            <h4 className="text-xl font-bold text-slate-900">{stats.active}</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Expiring Soon</p>
            <h4 className="text-xl font-bold text-slate-900">{stats.expiring}</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
            <XCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Expired</p>
            <h4 className="text-xl font-bold text-slate-900">{stats.expired}</h4>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Loading domains...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-sans">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm border-b border-slate-100">
                <tr className="text-slate-500 text-[10px] uppercase tracking-widest font-black">
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
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {sortedDomains.map((domain) => (
                    <motion.tr 
                      layout
                      key={domain.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/50 transition-all group"
                    >
                      {selectedColumns.includes('domainName') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Globe size={16} className="text-indigo-500" />
                            <span className="font-bold text-sm text-slate-900">{domain.domainName}</span>
                            <a 
                              href={`https://${domain.domainName}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-slate-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:text-indigo-600"
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
                                domain.clientId ? "text-slate-700 hover:text-indigo-600" : "text-rose-500"
                              )}
                            >
                              {clients.find(c => c.id === domain.clientId)?.name || 'Unassigned'}
                            </button>
                            {domain.clientId && <p className="text-[10px] text-slate-400 font-mono">{domain.clientId}</p>}
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('registrar') && (
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {domain.registrarId ? (
                              <>
                                <span className="text-xs font-bold text-slate-600 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 self-start">
                                  {registrars.find(r => r.id === domain.registrarId)?.name || domain.registrar}
                                </span>
                                <div className="flex flex-col gap-1 mt-1">
                                  {registrars.find(r => r.id === domain.registrarId)?.link && (
                                    <a 
                                      href={registrars.find(r => r.id === domain.registrarId)?.link} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
                                    >
                                      Portal Link <ExternalLink size={10} />
                                    </a>
                                  )}
                                  
                                  {isManager && (
                                    <div className="space-y-1 mt-1 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex flex-col">
                                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Login Details</span>
                                          <span className="text-[10px] font-bold text-slate-700 truncate max-w-[100px]">
                                            {domain.registrarCredentials?.username || registrars.find(r => r.id === domain.registrarId)?.email || 'N/A'}
                                          </span>
                                        </div>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowRegistrarCreds(prev => ({ ...prev, [domain.id]: !prev[domain.id] }));
                                          }}
                                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                                        >
                                          <Key size={12} />
                                        </button>
                                      </div>
                                      {showRegistrarCreds[domain.id] && (
                                        <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                                          <span className="text-[10px] font-mono text-indigo-600 font-bold bg-white px-1 rounded">
                                            {domain.registrarCredentials?.password || registrars.find(r => r.id === domain.registrarId)?.password || '••••••••'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs font-medium text-slate-600 px-2 py-1 bg-slate-100 rounded-md">
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
                <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-600 border-emerald-100 self-start">
                  Domain (Us)
                </span>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-100 self-start">
                  Domain (External)
                </span>
              )}
              {domain.isHostingSubscribedFromUs ? (
                <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-600 border-emerald-100 self-start">
                  Hosting (Us)
                </span>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-100 self-start">
                  Hosting (External)
                </span>
              )}
            </div>
          </div>
        </td>
      )}
                      {selectedColumns.includes('dates') && (
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Calendar size={12} />
                              Reg: {domain.registrationDate || 'N/A'}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                              <Calendar size={14} className="text-slate-400" />
                              Exp: {domain.expirationDate}
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('pricing') && (
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <p className="text-xs text-slate-500">Cost: <span className="font-bold">${domain.costPrice || 0}</span></p>
                            <p className="text-sm text-indigo-600 font-bold">Sale: ${domain.salePrice || 0}</p>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
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
                          {check('domains', 'delete') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDomain(domain);
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Domain"
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
        title="Add New Domain"
      >
        <form onSubmit={handleAddDomain} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Select Client</label>
            <select 
              required
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={newDomain.clientId}
              onChange={e => setNewDomain(prev => ({ ...prev, clientId: e.target.value }))}
            >
              <option value="">Choose a client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 space-y-4">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
              <Shield size={18} />
              Subscription Awareness
            </h3>
            <p className="text-xs text-amber-700">Identify which services are subscribed through us to enable billing and support features.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox"
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  checked={newDomain.isDomainSubscribedFromUs}
                  onChange={e => setNewDomain(prev => ({ ...prev, isDomainSubscribedFromUs: e.target.checked }))}
                />
                <span className="text-xs font-bold text-slate-700">Domain (Us)</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors">
                <input 
                  type="checkbox"
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  checked={newDomain.isHostingSubscribedFromUs}
                  onChange={e => setNewDomain(prev => ({ ...prev, isHostingSubscribedFromUs: e.target.checked }))}
                />
                <span className="text-xs font-bold text-slate-700">Hosting (Us)</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Domain Name</label>
            <input 
              required
              type="text" 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. journal-of-science.com"
              value={newDomain.domainName}
              onChange={e => setNewDomain(prev => ({ ...prev, domainName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Registrar</label>
            <div className="relative">
              <button 
                type="button"
                onClick={() => setIsRegistrarDropdownOpen(!isRegistrarDropdownOpen)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all flex items-center justify-between text-left"
              >
                <span className={cn(newDomain.registrar ? "text-slate-900" : "text-slate-400")}>
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
                            value={registrarSearch}
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
                                newDomain.registrarId === reg.id ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              {reg.name}
                              {newDomain.registrarId === reg.id && <CheckCircle2 size={14} />}
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
            
            {newDomain.registrarId && (
              <div className="flex items-center gap-4 mt-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Portal Login Link</p>
                  <p className="text-xs font-bold text-indigo-700 truncate">{registrars.find(r => r.id === newDomain.registrarId)?.link}</p>
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
              <label className="text-sm font-bold text-slate-700">Registration Date</label>
              <input 
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newDomain.registrationDate}
                onChange={e => setNewDomain(prev => ({ ...prev, registrationDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Expiration Date</label>
              <input 
                required
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newDomain.expirationDate}
                onChange={e => setNewDomain(prev => ({ ...prev, expirationDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Cost Price ($)</label>
              <input 
                type="number" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="0.00"
                value={newDomain.costPrice}
                onChange={e => setNewDomain(prev => ({ ...prev, costPrice: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Sale Price ($)</label>
              <input 
                type="number" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="0.00"
                value={newDomain.salePrice}
                onChange={e => setNewDomain(prev => ({ ...prev, salePrice: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <input 
              type="checkbox"
              id="isSubscribed"
              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={newDomain.isSubscribed}
              onChange={e => setNewDomain(prev => ({ ...prev, isSubscribed: e.target.checked }))}
            />
            <label htmlFor="isSubscribed" className="text-sm font-bold text-slate-700 cursor-pointer">
              Client has officially subscribed to this service
              <p className="text-[10px] text-slate-400 font-medium">Unsubscribed services restrict client chat and support access.</p>
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
    </div>
  );
};
