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
  X
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
}

const AVAILABLE_COLUMNS = [
  { id: 'name', label: 'Publisher Name' },
  { id: 'owner', label: 'Owner' },
  { id: 'secp', label: 'SECP Reg' },
  { id: 'ntn', label: 'NTN' },
  { id: 'documents', label: 'Documents' },
];

export const Publishers: React.FC<PublishersProps> = ({ searchQuery = '', currentUser }) => {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPublisher, setEditingPublisher] = useState<Publisher | null>(null);
  const [selectedPublisherId, setSelectedPublisherId] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['publishers'] || ['name', 'owner', 'secp', 'ntn', 'documents']
  );

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

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
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

  const filteredPublishers = publishers.filter(pub => 
    pub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pub.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pub.ntn.includes(searchQuery)
  );

  if (selectedPublisherId) {
    return <PublisherDetail publisherId={selectedPublisherId} onBack={() => setSelectedPublisherId(null)} />;
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {selectedColumns.includes('name') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Publisher Name</th>}
                {selectedColumns.includes('owner') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Owner</th>}
                {selectedColumns.includes('secp') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">SECP Reg</th>}
                {selectedColumns.includes('ntn') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">NTN</th>}
                {selectedColumns.includes('documents') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Documents</th>}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Loader2 className="animate-spin" size={32} />
                      <p className="text-sm font-medium">Loading publishers...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPublishers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Building2 size={32} />
                      <p className="text-sm font-medium">No publishers found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPublishers.map((pub) => (
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
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Client</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newPublisher.clientId}
                    onChange={e => setNewPublisher(prev => ({ ...prev, clientId: e.target.value }))}
                  >
                    <option value="">Select a client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Owner Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Full name of the owner"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newPublisher.ownerName}
                      onChange={e => setNewPublisher(prev => ({ ...prev, ownerName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">SECP Registration No.</label>
                    <input 
                      required
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
                      required
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
