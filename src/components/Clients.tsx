import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Download, 
  Mail, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  XCircle,
  Loader2,
  LogIn,
  FileSearch,
  MessageSquare,
  Edit,
  Trash2,
  Search,
  AlertCircle,
  GitMerge,
  ArrowUpDown,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, ServiceType, User as UserType, Subscription, Domain, Journal } from '../types';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { db, handleFirestoreError, OperationType, logActivity } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, where, writeBatch } from 'firebase/firestore';
import { Modal } from './Modal';
import { ColumnSelector } from './ColumnSelector';
import { ConfirmModal } from './ConfirmModal';
import { HelpIcon } from './HelpIcon';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ClientDetail } from './ClientDetail';
import { moveToTrash } from '../lib/firebase';
import { usePermissions } from '../hooks/usePermissions';
import { MergeModal } from './MergeModal';
import { SearchableSelect } from './ui/SearchableSelect';
import { toast } from 'react-hot-toast';

interface ClientsProps {
  searchQuery: string;
  currentUser: UserType | null;
  setActiveTab: (tab: string) => void;
  onImpersonate?: (user: { id: string; role: UserType['role']; name: string; email: string }) => void;
  onOpenChat?: (clientId: string) => void;
}

const AVAILABLE_COLUMNS = [
  { id: 'info', label: 'Client Info' },
  { id: 'salutation', label: 'Salutation' },
  { id: 'careOf', label: 'C/O' },
  { id: 'contact', label: 'Basic Contact' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'points', label: 'Points' },
  { id: 'status', label: 'Status' },
  { id: 'isActive', label: 'Active' },
  { id: 'isHidden', label: 'Hidden' },
  { id: 'endingDate', label: 'Ending Date' },
  { id: 'country', label: 'Country' },
  { id: 'address', label: 'Address' },
  { id: 'portalEnabled', label: 'Portal Access' },
  { id: 'createdAt', label: 'Registered On' },
];

export const Clients: React.FC<ClientsProps> = ({ searchQuery, currentUser, setActiveTab, onImpersonate, onOpenChat }) => {
  const { check, isClient: isClientRole } = usePermissions(currentUser);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser?.columnPreferences?.['clients'] || AVAILABLE_COLUMNS.map(c => c.id)
  );
  const [subscriptionFilter, setSubscriptionFilter] = useState<'all' | 'subscribed' | 'external' | 'missing'>('all');
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allJournals, setAllJournals] = useState<Journal[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<Client | null>(null);
  const [duplicates, setDuplicates] = useState<Client[][]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'createdAt', direction: 'desc' });
  
  // Form state
  const [newClient, setNewClient] = useState({
    salutation: '',
    name: '',
    careOf: '',
    email: '',
    phone: '',
    address: '',
    endingDate: '',
    status: 'active' as const,
    portalEnabled: false,
    isActive: true,
    isHidden: false,
    subscriptions: [] as Subscription[]
  });

  const SALUTATIONS = ['Mr.', 'Miss', 'Mrs.', 'Dr.', 'Prof.', 'Dr. Prof.'];
const DEPARTMENTS = ['Management', 'Editorial', 'Technical', 'Sales', 'Support', 'Finance', 'HR'];
const WORK_MODES = ['Office', 'Remotely', 'Hybrid'];
const GENDERS = ['Male', 'Female', 'Other'];
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const handleToggleStatus = async (client: Client) => {
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'users', client.id), {
        status: newStatus
      });
      if (currentUser) {
        logActivity(currentUser.id, currentUser.name, 'CLIENT_STATUS_TOGGLE', `Changed status of ${client.name} to ${newStatus}`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'clients');
    }
  };
  const handleNameChange = (name: string) => {
    let detectedSalutation = newClient.salutation;
    let cleanedName = name;

    // Check if name starts with any known salutation
    for (const sal of SALUTATIONS) {
      if (name.toLowerCase().startsWith(sal.toLowerCase() + ' ')) {
        detectedSalutation = sal;
        cleanedName = name.substring(sal.length + 1).trim();
        break;
      } else if (name.toLowerCase().startsWith(sal.toLowerCase())) {
        // Handle case where user typed "Dr." but no space yet
        detectedSalutation = sal;
        cleanedName = name.substring(sal.length).trim();
      }
    }

    setNewClient(prev => ({
      ...prev,
      salutation: detectedSalutation,
      name: cleanedName
    }));
  };

  useEffect(() => {
    if (!currentUser) return;

    let q = query(collection(db, 'users'), where('role', '==', 'Client'), orderBy('createdAt', 'desc'));
    
    // If client, only show their own record
    if (currentUser.role === 'Client') {
      q = query(collection(db, 'users'), where('role', '==', 'Client'), where('email', '==', currentUser.email));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientData);
      setLoading(false);

      // Update selected client if it exists to keep detail view in sync
      setSelectedClient(prev => {
        if (!prev) return null;
        const updated = clientData.find(c => c.id === prev.id);
        return updated || null;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
      setLoading(false);
    });

    const unsubDomains = onSnapshot(collection(db, 'domains'), (snapshot) => {
      setAllDomains(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Domain)));
    });

    const unsubJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      setAllJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal)));
    });

    return () => {
      unsubscribe();
      unsubDomains();
      unsubJournals();
    };
  }, [currentUser]);

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    if (!currentUser) return;
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.clients`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const filteredClients = clients.filter(client => {
    // Hidden logic
    const isHidden = client.isHidden === true;
    const canSeeHidden = currentUser?.role === 'Admin';
    if (isHidden && !canSeeHidden) return false;

    const matchesSearch = (client.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         (client.email?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    
    // Status check with both isActive and legacy status
    const isActive = (client.status === 'active' || client.isActive !== false) && !client.endingDate;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && isActive) ||
                         (filterStatus === 'inactive' && !isActive);
    
    const matchesLetter = !letterFilter || (client.name?.toUpperCase() || '').startsWith(letterFilter);
    
    const clientDomains = allDomains.filter(d => d.clientId === client.id);
    const clientJournals = allJournals.filter(j => j.clientId === client.id);
    
    const hasSubscribedFromUs = clientDomains.some(d => d.isDomainSubscribedFromUs || d.isHostingSubscribedFromUs) ||
                                clientJournals.some(j => j.isOjsSubscribedFromUs || j.isIssnSubscribedFromUs || j.isHecSubscribedFromUs || j.isDoiSubscribedFromUs);
                                
    const hasExternal = clientDomains.some(d => (d.domainName && !d.isDomainSubscribedFromUs) || (d.hostingProvider && !d.isHostingSubscribedFromUs)) ||
                        clientJournals.some(j => (j.url && !j.isOjsSubscribedFromUs) || ((j.issnOnline || j.issnPrint) && !j.isIssnSubscribedFromUs));
    
    const hasNoServices = clientDomains.length === 0 && clientJournals.length === 0;

    const matchesSubscription = subscriptionFilter === 'all' ||
                                (subscriptionFilter === 'subscribed' && hasSubscribedFromUs) ||
                                (subscriptionFilter === 'external' && hasExternal) ||
                                (subscriptionFilter === 'missing' && hasNoServices);

    return matchesSearch && matchesStatus && matchesLetter && matchesSubscription;
  });

  const sortedClients = [...filteredClients].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    
    let aValue: any = a[sortConfig.key as keyof Client];
    let bValue: any = b[sortConfig.key as keyof Client];

    // Handle special cases
    if (sortConfig.key === 'points') {
      aValue = a.points || 0;
      bValue = b.points || 0;
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

  const scanForDuplicates = () => {
    setIsScanning(true);
    const groups: Client[][] = [];
    const processedIds = new Set<string>();

    clients.forEach((client, index) => {
      if (processedIds.has(client.id)) return;

      const group: Client[] = [client];
      const name = client.name?.toLowerCase().trim();
      const email = client.email?.toLowerCase().trim();
      const phone = client.phone?.trim();
      
      clients.forEach((other, otherIndex) => {
        if (index === otherIndex || processedIds.has(other.id)) return;

        const otherName = other.name?.toLowerCase().trim();
        const otherEmail = other.email?.toLowerCase().trim();
        const otherPhone = other.phone?.trim();

        const nameMatch = name && otherName && name === otherName;
        const emailMatch = email && otherEmail && email === otherEmail;
        const phoneMatch = phone && otherPhone && phone === otherPhone;

        if (nameMatch || emailMatch || phoneMatch) {
          group.push(other);
          processedIds.add(other.id);
        }
      });

      if (group.length > 1) {
        groups.push(group);
        processedIds.add(client.id);
      }
    });

    setDuplicates(groups);
    setIsScanning(false);
    if (groups.length === 0) {
      toast.success('No duplicate clients found');
    } else {
      toast.error(`Found ${groups.length} potential duplicate groups`);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting to add client:', newClient);
    if (currentUser?.role === 'Client') {
      console.error('Permission denied: User is a client');
      return;
    }

    // Restriction: Only admin can add clients with gmail address
    const isSystemAdmin = currentUser?.role === 'Admin' || ['irfanbcom2009@gmail.com', 'ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'].includes(currentUser?.email || '');
    if (newClient.email.toLowerCase().endsWith('@gmail.com') && !isSystemAdmin) {
      setError("Only administrators can add clients with @gmail.com addresses.");
      return;
    }

    try {
      const finalStatus = newClient.endingDate ? 'inactive' : newClient.status;
      const docRef = await addDoc(collection(db, 'users'), {
        ...newClient,
        status: finalStatus,
        role: 'Client',
        points: 0,
        portalEnabled: newClient.portalEnabled ?? false,
        createdAt: serverTimestamp()
      });
      if (currentUser) {
        logActivity(currentUser.id, currentUser.name, 'CLIENT_ADD', `Added new client: ${newClient.name}`);
      }
      console.log('Client added successfully with ID:', docRef.id);
      setIsModalOpen(false);
      setNewClient({
        salutation: '',
        name: '',
        careOf: '',
        email: '',
        phone: '',
        address: '',
        endingDate: '',
        status: 'active',
        portalEnabled: false,
        isActive: true,
        isHidden: false,
        subscriptions: []
      });
    } catch (error) {
      console.error('Error adding client:', error);
      handleFirestoreError(error, OperationType.CREATE, 'clients');
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(sortedClients);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
    XLSX.writeFile(workbook, "HostAJournal_Clients.xlsx");
  };
  
  const handleDeleteClient = async (client: Client) => {
    try {
      await moveToTrash('users', client.id, client, currentUser?.name || 'Unknown');
      if (currentUser) {
        logActivity(currentUser.id, currentUser.name, 'CLIENT_DELETE', `Moved client ${client.name} to trash`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'clients');
    }
  };

  const toggleSubscription = (service: ServiceType) => {
    if (currentUser?.role === 'Client') return; // Clients can't edit subscriptions
    setNewClient(prev => {
      const exists = prev.subscriptions.find(s => s.service === service);
      if (exists) {
        return {
          ...prev,
          subscriptions: prev.subscriptions.filter(s => s.service !== service)
        };
      } else {
        const newSub: Subscription = {
          service,
          startDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          status: 'active'
        };
        return {
          ...prev,
          subscriptions: [...prev.subscriptions, newSub]
        };
      }
    });
  };

  const isClient = currentUser?.role === 'Client';
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  return (
    <>
      <ConfirmModal 
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        onConfirm={() => {
          if (clientToDelete) {
            handleDeleteClient(clientToDelete);
            setClientToDelete(null);
          }
        }}
        title="Delete Client"
        message={`Are you sure you want to delete ${clientToDelete?.name}? This will move the client to trash.`}
        confirmText="Delete"
      />

      <MergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        type="clients"
        initialSourceItem={mergeSource}
        onSuccess={() => {
          setDuplicates([]);
          scanForDuplicates();
        }}
      />

      {selectedClient ? (
        <ClientDetail 
          client={selectedClient} 
          onBack={() => {
            setSelectedClient(null);
            setIsEditMode(false);
          }} 
          currentUser={currentUser}
          initialEdit={isEditMode}
          onImpersonate={onImpersonate}
        />
      ) : (
        <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            {isClient ? 'My Profile' : 'Clients Management'}
          </h2>
          <p className="text-slate-500 mt-1">
            {isClient ? 'View your account details and subscriptions.' : 'Manage your publishing partners and their subscriptions.'}
          </p>
        </div>
        {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || ['ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com', 'irfanbcom2009@gmail.com'].includes(currentUser?.email || '')) && (
          <div className="flex gap-3">
            <ColumnSelector 
              availableColumns={AVAILABLE_COLUMNS}
              selectedColumns={selectedColumns}
              onChange={handleColumnChange}
            />
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download size={18} />
              Export Excel
            </button>
            <button
              onClick={scanForDuplicates}
              disabled={isScanning}
              className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
              title="Scan for duplicates"
            >
              {isScanning ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              Scan Duplicates
            </button>
          </div>
        )}
        {!isClient && (
          <div className="flex gap-3">
            {check('clients', 'add') && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                <Plus size={20} />
                Add Client
              </button>
            )}
          </div>
        )}
      </div>

      {duplicates.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 mt-6">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle size={20} />
                <h4 className="font-bold">Potential Duplicates Found ({duplicates.length} groups)</h4>
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
                <div key={idx} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm space-y-3">
                  <p className="text-sm font-bold text-slate-900">Duplicate Group</p>
                  <div className="space-y-2">
                    {group.map(client => (
                      <div key={client.id} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                        <div className="truncate mr-2">
                          <p className="font-bold text-slate-700 truncate">{client.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{client.email}</p>
                        </div>
                        <button 
                          onClick={() => {
                            setMergeSource(client);
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

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-6">
        {!isClient && (
          <div className="p-6 border-b border-slate-100 flex flex-col gap-6 bg-slate-50/30">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex flex-wrap items-center gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Status</label>
                  <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                    {(['all', 'active', 'inactive'] as const).map((status) => (
                      <button 
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={cn(
                          "px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize", 
                          filterStatus === status ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                        )}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subscription Type</label>
                  <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                    {(['all', 'subscribed', 'external', 'missing'] as const).map((sub) => (
                      <button 
                        key={sub}
                        onClick={() => setSubscriptionFilter(sub)}
                        className={cn(
                          "px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize", 
                          subscriptionFilter === sub ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                        )}
                      >
                        {sub === 'subscribed' ? 'Subscribed (Us)' : sub === 'external' ? 'External' : sub === 'missing' ? 'No Services' : 'All'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end">
                <ColumnSelector 
                  availableColumns={AVAILABLE_COLUMNS} 
                  selectedColumns={selectedColumns} 
                  onChange={handleColumnChange} 
                />
                <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all">
                  <Filter size={18} />
                </button>
                <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>

            {/* A-Z Filter */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setLetterFilter(null)}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all",
                  !letterFilter ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-300"
                )}
              >
                ALL
              </button>
              {ALPHABET.map(letter => (
                <button
                  key={letter}
                  onClick={() => setLetterFilter(letter)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all",
                    letterFilter === letter ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-300"
                  )}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}

      <div className="crm-card mt-6">
        <div className="crm-table-container">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-sm font-medium">Loading ledger...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-sans">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm border-b border-slate-100">
                <tr className="text-slate-500 text-[10px] uppercase tracking-widest font-black">
                  {selectedColumns.includes('info') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('name')}
                    >
                      <div className="flex items-center">
                        Client Info
                        <SortIcon columnKey="name" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('salutation') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('salutation')}
                    >
                      <div className="flex items-center">
                        Salut.
                        <SortIcon columnKey="salutation" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('careOf') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('careOf')}
                    >
                      <div className="flex items-center">
                        C/O
                        <SortIcon columnKey="careOf" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('contact') && <th className="px-6 py-4">Basic Contact</th>}
                  {selectedColumns.includes('phone') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('phone')}
                    >
                      <div className="flex items-center">
                        Phone
                        <SortIcon columnKey="phone" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('email') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('email')}
                    >
                      <div className="flex items-center">
                        Email
                        <SortIcon columnKey="email" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('subscriptions') && <th className="px-6 py-4">Subscriptions</th>}
                  {selectedColumns.includes('points') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('points')}
                    >
                      <div className="flex items-center">
                        Points
                        <SortIcon columnKey="points" />
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
                  {selectedColumns.includes('endingDate') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('endingDate')}
                    >
                      <div className="flex items-center">
                        Ending Date
                        <SortIcon columnKey="endingDate" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('country') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('country')}
                    >
                      <div className="flex items-center">
                        Country
                        <SortIcon columnKey="country" />
                      </div>
                    </th>
                  )}
                  {selectedColumns.includes('address') && <th className="px-6 py-4">Address</th>}
                  {selectedColumns.includes('portalEnabled') && <th className="px-6 py-4">Portal</th>}
                  {selectedColumns.includes('createdAt') && (
                    <th 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group"
                      onClick={() => requestSort('createdAt')}
                    >
                      <div className="flex items-center">
                        Registered
                        <SortIcon columnKey="createdAt" />
                      </div>
                    </th>
                  )}
                  {!isClient && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {sortedClients.map((client) => (
                    <motion.tr 
                      layout
                      key={client.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedClient(client)}
                      className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                    >
                      {selectedColumns.includes('info') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold overflow-hidden">
                              {client.photoURL ? (
                                <img src={client.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                client.name.charAt(0)
                              )}
                            </div>
                            <div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClient(client);
                                }}
                                className="font-bold text-sm text-slate-900 hover:text-indigo-600 hover:underline text-left"
                              >
                                {client.salutation && <span className="mr-1 text-slate-500">{client.salutation}</span>}
                                {client.name}
                                {client.careOf && (
                                  <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200 uppercase tracking-tighter">
                                    C/O {client.careOf}
                                  </span>
                                )}
                              </button>
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <MapPin size={12} /> {client.address}
                              </p>
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('salutation') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{client.salutation || 'N/A'}</td>
                      )}
                      {selectedColumns.includes('careOf') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{client.careOf || 'N/A'}</td>
                      )}
                      {selectedColumns.includes('contact') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600 flex items-center gap-1.5">
                            <Mail size={14} className="text-slate-400" /> {client.email}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                            <Phone size={14} className="text-slate-400" /> {client.phone}
                          </p>
                        </td>
                      )}
                      {selectedColumns.includes('phone') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{client.phone || 'N/A'}</td>
                      )}
                      {selectedColumns.includes('email') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{client.email}</td>
                      )}
                      {selectedColumns.includes('subscriptions') && (
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {client.subscriptions?.map(sub => (
                              <span key={typeof sub === 'string' ? sub : sub.service} className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
                                {typeof sub === 'string' ? sub : sub.service}
                              </span>
                            ))}
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('points') && (
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-slate-900">{client.points}</span>
                          <p className="text-[10px] text-slate-400 font-medium">REWARD PTS</p>
                        </td>
                      )}
                      {selectedColumns.includes('status') && (
                        <td className="px-6 py-4">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(client);
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all hover:scale-105",
                              client.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-600 border-slate-200"
                            )}
                          >
                            {client.status === 'active' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            {client.status.toUpperCase()}
                          </button>
                        </td>
                      )}
                      {selectedColumns.includes('endingDate') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{client.endingDate || 'Lifetime'}</td>
                      )}
                      {selectedColumns.includes('country') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{client.country || 'N/A'}</td>
                      )}
                      {selectedColumns.includes('address') && (
                        <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">{client.address}</td>
                      )}
                      {selectedColumns.includes('portalEnabled') && (
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            client.portalEnabled ? "bg-emerald-50 text-emerald-700 font-bold" : "bg-slate-100 text-slate-500"
                          )}>
                            {client.portalEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('createdAt') && (
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {client.createdAt && client.createdAt.toDate ? client.createdAt.toDate().toLocaleDateString() : 'N/A'}
                        </td>
                      )}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClient(client);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Details"
                          >
                            <FileSearch size={16} />
                          </button>
                          {!isClient && (
                            <>
                              {check('clients', 'edit') && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedClient(client);
                                    setIsEditMode(true);
                                  }}
                                  className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                  title="Edit Client"
                                >
                                  <Edit size={16} />
                                </button>
                              )}
                              {check('clients', 'delete') && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setClientToDelete(client);
                                  }}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Delete Client"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenChat) onOpenChat(client.id);
                              else setActiveTab('chat');
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Open Chat"
                          >
                            <MessageSquare size={16} />
                          </button>
                          {onImpersonate && currentUser?.role === 'Admin' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onImpersonate({ id: client.id, role: 'Client', name: client.name, email: client.email });
                              }}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              title="Login As"
                            >
                              <LogIn size={16} />
                            </button>
                          )}
                          <a 
                            href={`mailto:${client.email}`}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Send Email"
                          >
                            <Mail size={16} />
                          </a>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClient(client);
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
      </div>
    </div>
  </div>
)}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Add New Client"
      >
            <form onSubmit={handleAddClient} className="space-y-4">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-600 animate-in fade-in slide-in-from-top-2">
                  <XCircle size={20} className="shrink-0" />
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <SearchableSelect
                    label="Salutation"
                    options={[
                      { label: "None", value: "" },
                      ...SALUTATIONS.map(sal => ({ label: sal, value: sal }))
                    ]}
                    value={newClient.salutation}
                    onChange={value => setNewClient(prev => ({ ...prev, salutation: value }))}
                  />
                </div>
                <div className="col-span-3 space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center">
                    Full Name
                    <HelpIcon policyTitle="Client Registration Policy" />
                  </label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Sarah Chen"
                    value={newClient.name}
                    onChange={e => handleNameChange(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">C/O (Care of) / Referred by</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. Dr. Smith / Referral Name"
                  value={newClient.careOf}
                  onChange={e => setNewClient(prev => ({ ...prev, careOf: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center">
                    Email Address
                    <HelpIcon policyTitle="Client Communication Policy" />
                  </label>
                  <input 
                    required
                    type="email" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="sarah@example.com"
                    value={newClient.email}
                    onChange={e => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Phone Number</label>
                <input 
                  type="tel" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="+1 (555) 000-0000"
                  value={newClient.phone}
                  onChange={e => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Address</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="123 Academic Way, Boston, MA"
                  value={newClient.address}
                  onChange={e => setNewClient(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Ending Date</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newClient.endingDate}
                  onChange={e => setNewClient(prev => ({ ...prev, endingDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Subscriptions</label>
                        <div className="flex flex-wrap gap-2">
                          {(['Hosting', 'DOI', 'ISSN', 'OJS', 'Editorial', 'Indexing', 'Plagiarism'] as ServiceType[]).map(service => {
                            const isSelected = newClient.subscriptions.some(s => s.service === service);
                            return (
                              <button
                                key={service}
                                type="button"
                                onClick={() => toggleSubscription(service)}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                  isSelected
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300"
                                )}
                              >
                                {service}
                              </button>
                            );
                          })}
                        </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Portal Access</label>
                <div className="flex items-center gap-2 h-[42px]">
                  <button
                    type="button"
                    onClick={() => setNewClient(prev => ({ ...prev, portalEnabled: !prev.portalEnabled }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      newClient.portalEnabled ? "bg-indigo-600" : "bg-slate-200"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      newClient.portalEnabled ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                  <span className="text-xs font-bold text-slate-600">{newClient.portalEnabled ? 'On' : 'Off'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Active Status</label>
                <div className="flex items-center gap-2 h-[42px]">
                  <button
                    type="button"
                    onClick={() => setNewClient(prev => ({ ...prev, isActive: !prev.isActive }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      newClient.isActive ? "bg-emerald-600" : "bg-slate-200"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      newClient.isActive ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                  <span className="text-xs font-bold text-slate-600">{newClient.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Hidden Status</label>
                <div className="flex items-center gap-2 h-[42px]">
                  <button
                    type="button"
                    onClick={() => setNewClient(prev => ({ ...prev, isHidden: !prev.isHidden }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      newClient.isHidden ? "bg-rose-600" : "bg-slate-200"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      newClient.isHidden ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                  <span className="text-xs font-bold text-slate-600">{newClient.isHidden ? 'Hidden' : 'Visible'}</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                Save Client
              </button>
            </div>
          </form>
        </Modal>
    </>
  );
};
