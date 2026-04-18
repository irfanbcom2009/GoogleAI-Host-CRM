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
  ArrowUpDown,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Publisher, Client, User } from '../types';

import { PublisherDetail } from './PublisherDetail';

import { ColumnSelector } from './ColumnSelector';

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
  { id: 'owner', label: 'Owner' },
  { id: 'secp', label: 'SECP Reg' },
  { id: 'ntn', label: 'NTN' },
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
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'createdAt', direction: 'desc' });

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
    secpRegistration: '',
    ntn: '',
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

  const handleCreatePublisher = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setNewPublisher({
        clientId: '',
        name: '',
        ownerName: '',
        secpRegistration: '',
        ntn: '',
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
    }
  };

  const handleDeletePublisher = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'publishers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'publishers');
    }
  };

  const filteredPublishers = publishers.filter(pub => {
    const matchesSearch = pub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pub.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pub.ntn.includes(searchQuery);
    
    const matchesClient = !effectiveClientId || pub.clientId === effectiveClientId;
    
    return matchesSearch && matchesClient;
  });

  const sortedPublishers = [...filteredPublishers].sort((a, b) => {
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
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Publishers</h2>
          <p className="text-slate-500 mt-1">Manage journal publishers and their legal documentation.</p>
        </div>
        <div className="flex gap-3">
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={20} />
            Add Publisher
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm border-b border-slate-200">
              <tr className="text-slate-500 text-[10px] uppercase tracking-widest font-black">
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
                          {pub.documents.aoa && <span title="AOA"><FileText size={16} className="text-emerald-500" /></span>}
                          {pub.documents.moa && <span title="MOA"><FileText size={16} className="text-blue-500" /></span>}
                          {pub.documents.cnicFront && <span title="CNIC Front"><ShieldCheck size={16} className="text-amber-500" /></span>}
                          {pub.documents.cnicBack && <span title="CNIC Back"><ShieldCheck size={16} className="text-amber-500" /></span>}
                          {pub.documents.ntn && <span title="NTN"><FileText size={16} className="text-purple-500" /></span>}
                          {pub.documents.secp && <span title="SECP"><ShieldCheck size={16} className="text-rose-500" /></span>}
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
                              secpRegistration: pub.secpRegistration,
                              ntn: pub.ntn,
                              documents: {
                                aoa: pub.documents.aoa || '',
                                moa: pub.documents.moa || '',
                                cnicFront: pub.documents.cnicFront || '',
                                cnicBack: pub.documents.cnicBack || '',
                                ntn: pub.documents.ntn || '',
                                secp: pub.documents.secp || '',
                                certificates: pub.documents.certificates || []
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

      {/* Add Publisher Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">{editingPublisher ? 'Edit Publisher' : 'Add New Publisher'}</h3>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingPublisher(null);
                  }}
                  className="p-2 hover:bg-slate-200 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleCreatePublisher} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Client / Owner</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newPublisher.clientId}
                      onChange={e => {
                        const selectedClient = clients.find(c => c.id === e.target.value);
                        setNewPublisher(prev => ({ 
                          ...prev, 
                          clientId: e.target.value,
                          ownerName: selectedClient ? selectedClient.name : ''
                        }));
                      }}
                      disabled={!!effectiveClientId && !currentUser.role.includes('Admin')}
                    >
                      <option value="">Select a client</option>
                      {clients.map(client => (
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
                    <label className="text-sm font-bold text-slate-700">Publisher Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. Host A Journal Publishing"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newPublisher.name}
                      onChange={e => setNewPublisher(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Owner Name (Auto-filled)</label>
                    <input 
                      readOnly
                      type="text" 
                      placeholder="Select a client above"
                      className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl outline-none transition-all text-slate-500"
                      value={newPublisher.ownerName}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">SECP Registration No.</label>
                    <input 
                      type="text" 
                      placeholder="Registration number"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newPublisher.secpRegistration}
                      onChange={e => setNewPublisher(prev => ({ ...prev, secpRegistration: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">NTN Number</label>
                    <input 
                      type="text" 
                      placeholder="National Tax Number"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newPublisher.ntn}
                      onChange={e => setNewPublisher(prev => ({ ...prev, ntn: e.target.value }))}
                    />
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
                    className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    {editingPublisher ? 'Update Publisher' : 'Create Publisher'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
