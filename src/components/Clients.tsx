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
  FileSpreadsheet,
  MessageSquare,
  Edit,
  Trash2,
  GitMerge
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, ServiceType, User as UserType, Subscription } from '../types';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, where, writeBatch } from 'firebase/firestore';
import { Modal } from './Modal';
import { Importer } from './Importer';
import { GoogleSheetImport } from './GoogleSheetImport';
import { ColumnSelector } from './ColumnSelector';
import { ConfirmModal } from './ConfirmModal';
import { BulkAddModal } from './BulkAddModal';
import { MergeModal } from './MergeModal';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ClientDetail } from './ClientDetail';
import { moveToTrash } from '../lib/firebase';

interface ClientsProps {
  searchQuery: string;
  currentUser: UserType | null;
  setActiveTab: (tab: string) => void;
  onImpersonate?: (user: { id: string; role: UserType['role']; name: string; email: string }) => void;
  onOpenChat?: (clientId: string) => void;
}

const AVAILABLE_COLUMNS = [
  { id: 'info', label: 'Client Info' },
  { id: 'contact', label: 'Contact' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'points', label: 'Points' },
  { id: 'status', label: 'Status' },
  { id: 'endingDate', label: 'Ending Date' },
  { id: 'country', label: 'Country' },
  { id: 'address', label: 'Address' },
];

export const Clients: React.FC<ClientsProps> = ({ searchQuery, currentUser, setActiveTab, onImpersonate, onOpenChat }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isGoogleImportOpen, setIsGoogleImportOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser?.columnPreferences?.['clients'] || ['info', 'contact', 'subscriptions', 'points', 'status']
  );
  
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
      if (selectedClient) {
        const updated = clientData.find(c => c.id === selectedClient.id);
        if (updated) setSelectedClient(updated);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
      setLoading(false);
    });

    return () => unsubscribe();
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
    const matchesSearch = (client.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         (client.email?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || client.status === filterStatus;
    const matchesLetter = !letterFilter || (client.name?.toUpperCase() || '').startsWith(letterFilter);
    return matchesSearch && matchesStatus && matchesLetter;
  });

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting to add client:', newClient);
    if (currentUser?.role === 'Client') {
      console.error('Permission denied: User is a client');
      return;
    }

    try {
      const finalStatus = newClient.endingDate ? 'inactive' : newClient.status;
      const docRef = await addDoc(collection(db, 'users'), {
        ...newClient,
        status: finalStatus,
        role: 'Client',
        points: 0,
        createdAt: serverTimestamp()
      });
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
        subscriptions: []
      });
    } catch (error) {
      console.error('Error adding client:', error);
      handleFirestoreError(error, OperationType.CREATE, 'clients');
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredClients);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
    XLSX.writeFile(workbook, "HostAJournal_Clients.xlsx");
  };
  
  const handleDeleteClient = async (client: Client) => {
    try {
      await moveToTrash('users', client.id, client, currentUser?.name || 'Unknown');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'clients');
    }
  };

  const handleDeleteAllClients = async () => {
    setIsDeleteAllConfirmOpen(false);
    setIsDeletingAll(true);
    try {
      for (const client of clients) {
        await moveToTrash('users', client.id, client, currentUser?.name || 'Unknown');
      }
    } catch (error) {
      console.error('Error deleting all clients:', error);
    } finally {
      setIsDeletingAll(false);
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
        {currentUser?.role === 'Admin' && (
          <div className="flex gap-3">
            <ColumnSelector 
              availableColumns={AVAILABLE_COLUMNS}
              selectedColumns={selectedColumns}
              onChange={handleColumnChange}
            />
            <button 
              onClick={() => setIsGoogleImportOpen(true)}
              className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              <FileSpreadsheet size={18} className="text-indigo-600" />
              Google Sheets
            </button>
            <button 
              onClick={() => setIsImporterOpen(true)}
              className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download size={18} className="text-emerald-600" />
              Import Excel
            </button>
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download size={18} />
              Export Excel
            </button>
            {currentUser?.role === 'Admin' && (
              <button 
                onClick={() => setIsDeleteAllConfirmOpen(true)}
                disabled={isDeletingAll || clients.length === 0}
                className="flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-100 px-5 py-2.5 rounded-xl font-semibold hover:bg-rose-100 transition-all shadow-sm disabled:opacity-50"
              >
                <Trash2 size={18} />
                {isDeletingAll ? 'Deleting...' : 'Delete All'}
              </button>
            )}
          </div>
        )}
        {!isClient && (
          <div className="flex gap-3">
            <button 
              onClick={() => setIsMergeModalOpen(true)}
              className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              <GitMerge size={20} className="text-indigo-600" />
              Merge
            </button>
            <button 
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              <Plus size={20} className="text-indigo-600" />
              Bulk Add
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              <Plus size={20} />
              Add Client
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {!isClient && (
          <div className="p-6 border-b border-slate-100 flex flex-col gap-6 bg-slate-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
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
              <div className="flex items-center gap-2">
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

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Loading...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  {selectedColumns.includes('info') && <th className="px-6 py-4">Client Info</th>}
                  {selectedColumns.includes('contact') && <th className="px-6 py-4">Contact</th>}
                  {selectedColumns.includes('subscriptions') && <th className="px-6 py-4">Subscriptions</th>}
                  {selectedColumns.includes('points') && <th className="px-6 py-4">Points</th>}
                  {selectedColumns.includes('status') && <th className="px-6 py-4">Status</th>}
                  {selectedColumns.includes('endingDate') && <th className="px-6 py-4">Ending Date</th>}
                  {selectedColumns.includes('country') && <th className="px-6 py-4">Country</th>}
                  {selectedColumns.includes('address') && <th className="px-6 py-4">Address</th>}
                  {!isClient && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {filteredClients.map((client) => (
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
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                              {client.name.charAt(0)}
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
                        <td className="px-6 py-4 text-sm text-slate-600">{client.endingDate || 'N/A'}</td>
                      )}
                      {selectedColumns.includes('country') && (
                        <td className="px-6 py-4 text-sm text-slate-600">{client.country || 'N/A'}</td>
                      )}
                      {selectedColumns.includes('address') && (
                        <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">{client.address}</td>
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
  )}

      {!isClient && (
        <>
          <ConfirmModal 
        isOpen={isDeleteAllConfirmOpen}
        onClose={() => setIsDeleteAllConfirmOpen(false)}
        onConfirm={handleDeleteAllClients}
        title="Delete All Clients"
        message={`Are you sure you want to delete ALL ${clients.length} clients? This will move them to trash.`}
        confirmText="Delete All"
        variant="danger"
      />

      <BulkAddModal 
            isOpen={isBulkModalOpen} 
            onClose={() => setIsBulkModalOpen(false)} 
            type="clients" 
          />

          <MergeModal 
            isOpen={isMergeModalOpen}
            onClose={() => setIsMergeModalOpen(false)}
            type="clients"
          />

          <Modal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            title="Add New Client"
          >
            <form onSubmit={handleAddClient} className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Salutation</label>
                  <select
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newClient.salutation}
                    onChange={e => setNewClient(prev => ({ ...prev, salutation: e.target.value }))}
                  >
                    <option value="">None</option>
                    {SALUTATIONS.map(sal => (
                      <option key={sal} value={sal}>{sal}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3 space-y-2">
                  <label className="text-sm font-bold text-slate-700">Full Name</label>
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
                  <label className="text-sm font-bold text-slate-700">Email Address</label>
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

        <Modal
          isOpen={isGoogleImportOpen}
          onClose={() => setIsGoogleImportOpen(false)}
          title="Import Clients from Google Sheets"
        >
          <GoogleSheetImport 
            collectionName="clients" 
            onClose={() => setIsGoogleImportOpen(false)}
            onSuccess={() => setIsGoogleImportOpen(false)}
          />
        </Modal>

        <Importer 
          isOpen={isImporterOpen} 
          onClose={() => setIsImporterOpen(false)} 
          type="clients" 
        />
      </>
    )}
  </>
);
};
