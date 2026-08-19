import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Building2, 
  User, 
  FileText, 
  ShieldCheck, 
  Upload, 
  Download, 
  Trash2, 
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  Loader2,
  Globe,
  BookOpen,
  Hash,
  Mail,
  Ticket,
  Lock,
  Settings2,
  Calendar,
  History,
  ArrowLeftRight,
  Phone,
  MapPin
} from 'lucide-react';
import { Publisher, Client, Journal, Domain, DOIApplication, ServiceType, ClientHistoryEntry } from '../types';
import { db, handleFirestoreError, OperationType, getErrorMessage } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, addDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Modal } from './Modal';

import { FloatingActionBar } from './FloatingActionBar';
import { toast } from 'react-hot-toast';

interface PublisherDetailProps {
  publisherId: string;
  onBack: () => void;
  onNavigate?: (tab: string, id: string) => void;
}

export const PublisherDetail: React.FC<PublisherDetailProps> = ({ publisherId, onBack, onNavigate }) => {
  const [publisher, setPublisher] = useState<Publisher | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [doiApplications, setDoiApplications] = useState<DOIApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDoiModalOpen, setIsDoiModalOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Publisher>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  // New Client Transfer states
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    newClientId: '',
    startDate: new Date().toISOString().split('T')[0],
    remarks: ''
  });
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing) return;
      
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        setIsEditing(false);
        setEditData(publisher || {});
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, editData, publisher]);

  useEffect(() => {
    if (isEditing) {
      const firstInput = document.querySelector('input, select, textarea');
      if (firstInput) {
        (firstInput as HTMLElement).focus();
      }
    }
  }, [isEditing]);

  const [newDoi, setNewDoi] = useState({
    memberName: '',
    doiPrefix: '',
    role: 'Member',
    password: '',
    ticketNo: '',
    otherEmails: '',
    domainName: '',
    contactEmail: '',
    sponsoringOrgName: '',
    orgUrl: '',
    orgPubUrl: '',
    remarks: '',
    journalId: ''
  });

  useEffect(() => {
    let unsubJournals: (() => void) | null = null;
    let unsubDomains: (() => void) | null = null;

    const unsubAllClients = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllClients(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(c => c.role === 'Client' || c.role === undefined)
      );
    });

    const unsubPub = onSnapshot(doc(db, 'publishers', publisherId), (docSnap) => {
      if (docSnap.exists()) {
        const pubData = { id: docSnap.id, ...docSnap.data() } as Publisher;
        setPublisher(pubData);
        setEditData(pubData);
        
        // Fetch client info
        onSnapshot(doc(db, 'users', pubData.clientId), (cSnap) => {
          if (cSnap.exists()) {
            setClient({ id: cSnap.id, ...cSnap.data() } as Client);
          }
        });

        // Fetch journals for this publisher
        if (!unsubJournals) {
          const journalsQuery = query(
            collection(db, 'journals'), 
            where('publisherId', '==', publisherId)
          );
          unsubJournals = onSnapshot(journalsQuery, (snapshot) => {
            setJournals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Journal)));
          });
        }

        // Fetch domains for this publisher
        if (!unsubDomains) {
          const domainsQuery = query(
            collection(db, 'domains'),
            where('publisherId', '==', publisherId)
          );
          unsubDomains = onSnapshot(domainsQuery, (snapshot) => {
            setDomains(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Domain)));
          });
        }

        // Fetch DOI applications for this publisher
        const doiQuery = query(
          collection(db, 'doi_applications'),
          where('publisherId', '==', publisherId)
        );
        const unsubDoi = onSnapshot(doiQuery, (snapshot) => {
          setDoiApplications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DOIApplication)));
        });

        setLoading(false);
        return () => {
          unsubDoi();
        };
      } else {
        setPublisher(null);
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'publishers');
      setLoading(false);
    });

    return () => {
      unsubPub();
      unsubAllClients();
      if (unsubJournals) unsubJournals();
      if (unsubDomains) unsubDomains();
    };
  }, [publisherId]);

  const handleFileUpload = async (docType: keyof Publisher['documents'], e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !publisher) return;

    setUploading(docType);
    try {
      // In a real app, we would upload to Firebase Storage here.
      // For now, we'll simulate it by using a placeholder URL.
      const simulatedUrl = `https://placeholder-storage.com/${publisherId}/${docType}/${file.name}`;
      
      await updateDoc(doc(db, 'publishers', publisherId), {
        [`documents.${docType}`]: simulatedUrl,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'publishers');
    } finally {
      setUploading(null);
    }
  };

  const removeDocument = async (docType: keyof Publisher['documents']) => {
    if (!publisher) return;
    try {
      await updateDoc(doc(db, 'publishers', publisherId), {
        [`documents.${docType}`]: '',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'publishers');
    }
  };

  const handleSave = async () => {
    if (!publisher) return;
    setIsSaving(true);
    try {
      const activeHistory = [...(publisher.clientHistory || [])];
      
      // If clientId was changed via edit mode
      if (editData.clientId && editData.clientId !== publisher.clientId) {
        let birthDate = '2026-01-01';
        if (publisher.createdAt) {
          try {
            const seconds = (publisher.createdAt as any).seconds;
            if (seconds) {
              birthDate = new Date(seconds * 1000).toISOString().split('T')[0];
            } else {
              birthDate = new Date(publisher.createdAt).toISOString().split('T')[0];
            }
          } catch (err) {
            console.warn("Could not parse publisher creation date:", err);
          }
        }

        // If no history existed yet, seed current association first
        if (activeHistory.length === 0) {
          activeHistory.push({
            clientId: publisher.clientId,
            clientName: client?.name || 'Previous Client',
            startDate: birthDate,
            endDate: new Date().toISOString().split('T')[0],
            remarks: 'Initial assignment'
          });
        } else {
          // close previous entry
          const lastIndex = activeHistory.length - 1;
          if (activeHistory[lastIndex] && !activeHistory[lastIndex].endDate) {
            activeHistory[lastIndex] = {
              ...activeHistory[lastIndex],
              endDate: new Date().toISOString().split('T')[0]
            };
          }
        }

        const selectedClient = allClients.find(c => c.id === editData.clientId);
        activeHistory.push({
          clientId: editData.clientId,
          clientName: selectedClient?.name || 'New Client',
          startDate: new Date().toISOString().split('T')[0],
          remarks: 'Direct edit profile update'
        });
      }

      await updateDoc(doc(db, 'publishers', publisherId), {
        ...editData,
        clientHistory: activeHistory.length > 0 ? activeHistory : (publisher.clientHistory || []),
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
      toast.success('Publisher updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'publishers');
      toast.error('Failed to update publisher');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransferClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publisher) return;
    if (!transferForm.newClientId) {
      toast.error('Please select a client to transfer to.');
      return;
    }
    if (transferForm.newClientId === publisher.clientId) {
      toast.error('Publisher is already associated with this client.');
      return;
    }

    setIsTransferring(true);
    try {
      const selectedClient = allClients.find(c => c.id === transferForm.newClientId);
      if (!selectedClient) {
        throw new Error('Selected client not found.');
      }

      const activeHistory: ClientHistoryEntry[] = publisher.clientHistory ? [...publisher.clientHistory] : [];

      // If no history exists, seed the current client association first
      if (activeHistory.length === 0) {
        let birthDate = '2026-01-01'; // Default backup
        if (publisher.createdAt) {
          try {
            const seconds = (publisher.createdAt as any).seconds;
            if (seconds) {
              birthDate = new Date(seconds * 1000).toISOString().split('T')[0];
            } else {
              birthDate = new Date(publisher.createdAt).toISOString().split('T')[0];
            }
          } catch (err) {
            console.warn("Could not parse publisher creation date:", err);
          }
        }
        activeHistory.push({
          clientId: publisher.clientId,
          clientName: client?.name || 'Previous Client',
          startDate: birthDate,
          endDate: transferForm.startDate,
          remarks: 'Initial assignment'
        });
      } else {
        // Update the last active history entry with endDate set to new startDate
        const lastIndex = activeHistory.length - 1;
        if (activeHistory[lastIndex] && !activeHistory[lastIndex].endDate) {
          activeHistory[lastIndex] = {
            ...activeHistory[lastIndex],
            endDate: transferForm.startDate
          };
        }
      }

      // Add the new association
      activeHistory.push({
        clientId: transferForm.newClientId,
        clientName: selectedClient.name,
        startDate: transferForm.startDate,
        remarks: transferForm.remarks || 'Transfer assignment'
      });

      // Update firestore publisher details
      await updateDoc(doc(db, 'publishers', publisherId), {
        clientId: transferForm.newClientId,
        ownerName: selectedClient.name, // Link owner name matching new client Name
        clientHistory: activeHistory,
        updatedAt: serverTimestamp()
      });

      toast.success(`Successfully transferred publisher to client "${selectedClient.name}"`);
      setIsTransferModalOpen(false);
      setTransferForm({
        newClientId: '',
        startDate: new Date().toISOString().split('T')[0],
        remarks: ''
      });
    } catch (error) {
      console.error("Transfer client error:", error);
      toast.error('Failed to transfer client. Please try again.');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleDeletePublisher = async () => {
    if (!publisher) return;
    if (!confirm(`Are you sure you want to permanently delete publisher "${publisher.name}"? This cannot be undone.`)) return;
    
    const loadingToast = toast.loading(`Deleting publisher "${publisher.name}"...`);
    try {
      await deleteDoc(doc(db, 'publishers', publisherId));
      toast.success(`Publisher "${publisher.name}" deleted.`, { id: loadingToast });
      onBack();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(getErrorMessage(error), { id: loadingToast });
    }
  };

  const handleResetDoi = () => {
    setNewDoi({
      memberName: '',
      doiPrefix: '',
      role: 'Member',
      password: '',
      ticketNo: '',
      otherEmails: '',
      domainName: '',
      contactEmail: '',
      sponsoringOrgName: '',
      orgUrl: '',
      orgPubUrl: '',
      remarks: '',
      journalId: ''
    });
  };

  const handleCreateDoi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publisher) return;

    try {
      await addDoc(collection(db, 'doi_applications'), {
        ...newDoi,
        publisherId: publisher.id,
        publisherName: publisher.name,
        clientId: publisher.clientId,
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsDoiModalOpen(false);
      setNewDoi({
        memberName: '',
        doiPrefix: '',
        role: 'Member',
        password: '',
        ticketNo: '',
        otherEmails: '',
        domainName: '',
        contactEmail: '',
        sponsoringOrgName: '',
        orgUrl: '',
        orgPubUrl: '',
        remarks: '',
        journalId: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'doi_applications');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  if (!publisher) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500 font-medium">Publisher not found.</p>
        <button onClick={onBack} className="mt-4 text-indigo-600 font-bold hover:underline">Go Back</button>
      </div>
    );
  }

  const documentTypes = [
    { id: 'aoa', label: 'AOA (Articles of Association)', icon: FileText },
    { id: 'moa', label: 'MOA (Memorandum of Association)', icon: FileText },
    { id: 'cnicFront', label: 'CNIC Front', icon: ShieldCheck },
    { id: 'cnicBack', label: 'CNIC Back', icon: ShieldCheck },
    { id: 'ntn', label: 'NTN Certificate', icon: FileText },
    { id: 'secp', label: 'SECP Registration', icon: ShieldCheck },
  ] as const;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all font-bold group"
        >
          <div className="p-2 bg-white border border-slate-200 rounded-xl group-hover:border-slate-300 shadow-sm">
            <ArrowLeft size={20} />
          </div>
          Back to Publishers
        </button>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            disabled={isSaving}
            className={cn(
              "px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2",
              isEditing && "border-indigo-200 text-indigo-600 bg-indigo-50"
            )}
          >
            <Settings2 size={18} />
            {isEditing ? 'Editing Mode' : 'Edit Details'}
          </button>
          {!isEditing && (
            <button 
              onClick={handleDeletePublisher}
              className="px-5 py-2.5 bg-white text-rose-600 border border-slate-200 rounded-xl font-bold hover:bg-rose-50 transition-all flex items-center gap-2"
              title="Delete Publisher Permanently"
            >
              <Trash2 size={18} />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className={cn(
        "grid grid-cols-1 lg:grid-cols-3 gap-8 transition-all",
        isEditing && "opacity-90"
      )}>
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <div className="flex flex-col items-center text-center space-y-4 mb-8">
              <div className="w-24 h-24 rounded-3xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-4xl font-black shadow-inner">
                {publisher.name.charAt(0)}
              </div>
              <div>
                {isEditing ? (
                  <input 
                    type="text"
                    className="text-2xl font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 w-full text-center"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                ) : (
                  <h1 className="text-2xl font-black text-slate-900">{publisher.name}</h1>
                )}
                <p className="text-slate-500 font-medium">Publisher Profile</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Associated Client Area */}
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Associated Client</p>
                  <button
                    type="button"
                    onClick={() => {
                      setTransferForm({
                        newClientId: '',
                        startDate: new Date().toISOString().split('T')[0],
                        remarks: ''
                      });
                      setIsTransferModalOpen(true);
                    }}
                    className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded transition-colors flex items-center gap-1"
                  >
                    <ArrowLeftRight size={10} />
                    Transfer Client
                  </button>
                </div>

                {isEditing ? (
                  <select
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                    value={editData.clientId || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selected = allClients.find(c => c.id === selectedId);
                      setEditData({
                        ...editData,
                        clientId: selectedId,
                        ownerName: selected ? (selected.name || '') : ''
                      });
                    }}
                  >
                    <option value="">Select Associated Client</option>
                    {allClients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : client ? (
                  <button
                    type="button"
                    onClick={() => onNavigate?.('clients', client.id)}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold transition-colors group/client w-full text-left"
                  >
                    <User size={16} className="text-indigo-400 group-hover/client:text-indigo-600" />
                    <span className="text-sm underline decoration-indigo-200 underline-offset-4 group-hover/client:decoration-indigo-600">
                      {client.name}
                    </span>
                    <ExternalLink size={12} className="ml-auto opacity-0 group-hover/client:opacity-100 transition-opacity" />
                  </button>
                ) : (
                  <p className="text-sm text-slate-500 italic">No associated client</p>
                )}

                {/* Date Frame Display for Currently Active Client */}
                {publisher.clientHistory && publisher.clientHistory.length > 0 ? (
                  (() => {
                    const activeEntry = publisher.clientHistory[publisher.clientHistory.length - 1];
                    if (activeEntry && activeEntry.clientId === publisher.clientId) {
                      return (
                        <div className="text-[10px] text-indigo-505 font-semibold flex items-center gap-1 mt-1 text-indigo-500">
                          <Calendar size={12} />
                          Active since: {activeEntry.startDate}
                        </div>
                      );
                    }
                    return null;
                  })()
                ) : null}
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Owner Name</p>
                <div className="flex items-center gap-2 text-slate-700">
                  <User size={16} className="text-slate-400" />
                  {isEditing ? (
                    <input 
                      type="text"
                      className="font-bold bg-white border border-slate-200 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                      value={editData.ownerName || ''}
                      onChange={(e) => setEditData({ ...editData, ownerName: e.target.value })}
                    />
                  ) : (
                    <span className="font-bold">{publisher.ownerName}</span>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">SECP Registration</p>
                <div className="flex items-center gap-2 text-slate-700">
                  <ShieldCheck size={16} className="text-slate-400" />
                  {isEditing ? (
                    <input 
                      type="text"
                      className="font-mono font-bold bg-white border border-slate-200 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                      value={editData.secpRegistration || ''}
                      onChange={(e) => setEditData({ ...editData, secpRegistration: e.target.value })}
                    />
                  ) : (
                    <span className="font-mono font-bold">{publisher.secpRegistration}</span>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">NTN Number</p>
                <div className="flex items-center gap-2 text-slate-700">
                  <FileText size={16} className="text-slate-400" />
                  {isEditing ? (
                    <input 
                      type="text"
                      className="font-mono font-bold bg-white border border-slate-200 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                      value={editData.ntn || ''}
                      onChange={(e) => setEditData({ ...editData, ntn: e.target.value })}
                    />
                  ) : (
                    <span className="font-mono font-bold">{publisher.ntn}</span>
                  )}
                </div>
              </div>

              {/* Contact & Address Section */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact & Location</p>
                
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail size={16} className="text-slate-400 shrink-0" />
                    {isEditing ? (
                      <input 
                        type="email"
                        placeholder="Publisher Email"
                        className="text-xs bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                        value={editData.email || ''}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      />
                    ) : (
                      <span className="text-xs truncate font-semibold">{publisher.email || 'No email specified'}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone size={16} className="text-slate-400 shrink-0" />
                    {isEditing ? (
                      <input 
                        type="tel"
                        placeholder="Publisher Phone"
                        className="text-xs bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      />
                    ) : (
                      <span className="text-xs font-semibold">{publisher.phone || 'No phone specified'}</span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/50">
                    <div className="flex items-start gap-2 text-slate-700 font-sans">
                      <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Publisher Address</p>
                        {isEditing ? (
                          <textarea 
                            rows={2}
                            placeholder="Full physical address"
                            className="text-xs bg-white border border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 w-full resize-none leading-relaxed text-slate-800"
                            value={editData.address || ''}
                            onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                          />
                        ) : (
                          <p className="text-xs text-slate-600 font-medium leading-relaxed bg-white/80 border border-slate-100 rounded-lg p-2">
                            {publisher.address || 'No address specified'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Lock size={10} />
                  Login Credentials
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-700">
                    <User size={14} className="text-slate-400" />
                    {isEditing ? (
                      <input 
                        type="text"
                        placeholder="Username"
                        className="text-xs font-bold bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                        value={editData.loginUsername || ''}
                        onChange={(e) => setEditData({ ...editData, loginUsername: e.target.value })}
                      />
                    ) : (
                      <span className="text-xs font-bold">{publisher.loginUsername || 'Not set'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Lock size={14} className="text-slate-400" />
                    {isEditing ? (
                      <input 
                        type="text"
                        placeholder="Password"
                        className="text-xs font-mono bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                        value={editData.loginPassword || ''}
                        onChange={(e) => setEditData({ ...editData, loginPassword: e.target.value })}
                      />
                    ) : (
                      <span className="text-xs font-mono text-indigo-600 font-bold">{publisher.loginPassword || '••••••••'}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Client History Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 text-slate-700 rounded-xl">
                <History size={20} />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 font-sans tracking-tight">Client History</h4>
                <p className="text-xs text-slate-500">Timeline of associated clients with date frames</p>
              </div>
            </div>

            {!publisher.clientHistory || publisher.clientHistory.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                <p className="font-semibold text-slate-500">No transfer history recorded.</p>
                <p className="mt-1">Future transfers will be logged here with explicit start/end dates.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {publisher.clientHistory.map((entry, idx) => {
                  const isActive = !entry.endDate && entry.clientId === publisher.clientId;
                  return (
                    <div key={idx} className="relative pl-5 pb-4 border-l border-slate-100 last:pb-0">
                      <div className={cn(
                        "absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-white",
                        isActive ? "border-emerald-500" : "border-slate-300"
                      )} />
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-sm font-bold font-sans",
                            isActive ? "text-slate-800" : "text-slate-500"
                          )}>
                            {entry.clientName || 'Unknown Client'}
                          </span>
                          {isActive && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono font-medium">
                          <Calendar size={10} />
                          {entry.startDate} {entry.endDate ? `to ${entry.endDate}` : '— Present'}
                        </div>
                        {entry.remarks && (
                          <p className="text-xs text-slate-500 bg-slate-50 rounded p-2 italic mt-1 font-medium border border-slate-100/50">
                            "{entry.remarks}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Documents */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Legal Documents</h3>
                  <p className="text-sm text-slate-500">Upload and manage required publisher documentation.</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Uploaded Documents */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Uploaded Documents
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documentTypes.filter(dt => publisher.documents?.[dt.id as keyof Publisher['documents']]).map((docType) => {
                    const docUrl = publisher.documents?.[docType.id as keyof Publisher['documents']];
                    return (
                      <div key={docType.id} className="p-4 bg-emerald-50/30 border border-emerald-100 rounded-2xl flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <docType.icon size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{docType.label}</p>
                            <p className="text-[10px] text-emerald-600 font-medium">Verified & Stored</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={docUrl as string} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Document"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button 
                            onClick={() => removeDocument(docType.id as keyof Publisher['documents'])}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Remove Document"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {documentTypes.filter(dt => publisher.documents?.[dt.id as keyof Publisher['documents']]).length === 0 && (
                    <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-sm text-slate-400">No documents uploaded yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Missing Documents */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-rose-600 uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle size={14} />
                  Missing Documents
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documentTypes.filter(dt => !publisher.documents?.[dt.id as keyof Publisher['documents']]).map((docType) => {
                    const isUploading = uploading === docType.id;
                    return (
                      <div key={docType.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-indigo-200 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white text-slate-400 flex items-center justify-center border border-slate-100">
                            <docType.icon size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{docType.label}</p>
                            <p className="text-[10px] text-slate-400 font-medium">Action Required</p>
                          </div>
                        </div>
                        <label className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer">
                          {isUploading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Upload size={16} />
                          )}
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(docType.id as keyof Publisher['documents'], e)}
                            disabled={!!uploading}
                          />
                        </label>
                      </div>
                    );
                  })}
                  {documentTypes.filter(dt => !publisher.documents?.[dt.id as keyof Publisher['documents']]).length === 0 && (
                    <div className="col-span-full py-8 text-center bg-emerald-50 rounded-2xl border border-dashed border-emerald-200">
                      <p className="text-sm text-emerald-600 font-bold">All required documents are uploaded!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Associated Assets Section */}
          <div className="space-y-8">
            {/* Domains Section */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Globe size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Associated Domains</h3>
                    <p className="text-sm text-slate-500">Domains managed under this publisher.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {domains.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Globe className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-sm text-slate-500">No domains associated with this publisher.</p>
                  </div>
                ) : (
                  domains.map((domain) => (
                    <div 
                      key={domain.id} 
                      onClick={() => onNavigate?.('domains', domain.id)}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 font-bold">
                          {domain.domainName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-all">{domain.domainName}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{domain.registrar}</p>
                        </div>
                      </div>
                      <ExternalLink size={16} className="text-slate-300 group-hover:text-emerald-600" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Journals Section */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Associated Journals</h3>
                    <p className="text-sm text-slate-500">Journals published under this publisher.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {journals.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <BookOpen className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-sm text-slate-500">No journals associated with this publisher.</p>
                  </div>
                ) : (
                  journals.map((journal) => (
                    <div 
                      key={journal.id} 
                      onClick={() => onNavigate?.('journals', journal.id)}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-bold">
                          {journal.title.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-all">{journal.title}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{journal.category}</p>
                        </div>
                      </div>
                      <ExternalLink size={16} className="text-slate-300 group-hover:text-indigo-600" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* DOI Applications Section */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <Hash size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">DOI Applications</h3>
                    <p className="text-sm text-slate-500">Manage Digital Object Identifier applications.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDoiModalOpen(true)}
                  className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                >
                  <Plus size={16} />
                  New Application
                </button>
              </div>

              <div className="space-y-4">
                {doiApplications.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Hash className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-sm text-slate-500">No DOI applications found for this publisher.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {doiApplications.map((app) => (
                      <div key={app.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                              <Hash size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{app.doiPrefix || 'Pending Prefix'}</p>
                              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{app.memberName}</p>
                            </div>
                          </div>
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            app.status === 'Approved' ? "bg-emerald-100 text-emerald-600" :
                            app.status === 'Rejected' ? "bg-rose-100 text-rose-600" :
                            "bg-amber-100 text-amber-600"
                          )}>
                            {app.status}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[11px] text-slate-600">
                            <Globe size={12} className="text-slate-400" />
                            <span className="font-medium">{app.domainName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-600">
                            <Mail size={12} className="text-slate-400" />
                            <span className="font-medium">{app.contactEmail}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-3xl border border-amber-100 p-6 flex items-start gap-4">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
              <AlertCircle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-amber-900">Compliance Notice</h4>
              <p className="text-sm text-amber-700 mt-1">
                All uploaded documents must be clear, legible, and valid. Expired or blurred documents may lead to rejection during the verification process.
              </p>
            </div>
          </div>
        </div>
      </div>

      <FloatingActionBar 
        isVisible={isEditing}
        onSave={handleSave}
        onCancel={() => {
          setIsEditing(false);
          setEditData(publisher || {});
        }}
        isSaving={isSaving}
      />

      <Modal 
        isOpen={isDoiModalOpen} 
        onClose={() => setIsDoiModalOpen(false)} 
        title="New DOI Application"
        maxWidth="3xl"
      >
        <form onSubmit={handleCreateDoi} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hierarchy Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                <Building2 size={16} />
                Hierarchy & Journal
              </h3>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Journal</label>
                <select 
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.journalId || ''}
                  onChange={e => setNewDoi(prev => ({ ...prev, journalId: e.target.value }))}
                >
                  <option value="">Select Journal</option>
                  {journals.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Member Name</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.memberName || ''}
                  onChange={e => setNewDoi(prev => ({ ...prev, memberName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">DOI Prefix</label>
                <input 
                  required
                  type="text"
                  placeholder="10.xxxx"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.doiPrefix || ''}
                  onChange={e => setNewDoi(prev => ({ ...prev, doiPrefix: e.target.value }))}
                />
              </div>
            </div>

            {/* Application Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                <FileText size={16} />
                Application Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newDoi.role || ''}
                    onChange={e => setNewDoi(prev => ({ ...prev, role: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="password"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newDoi.password || ''}
                      onChange={e => setNewDoi(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket No</label>
                  <div className="relative">
                    <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newDoi.ticketNo || ''}
                      onChange={e => setNewDoi(prev => ({ ...prev, ticketNo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Domain Name</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      required
                      type="text"
                      placeholder="example.com"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newDoi.domainName || ''}
                      onChange={e => setNewDoi(prev => ({ ...prev, domainName: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    required
                    type="email"
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newDoi.contactEmail || ''}
                    onChange={e => setNewDoi(prev => ({ ...prev, contactEmail: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Crossref Metadata */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
              <Settings2 size={16} />
              Crossref Metadata
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sponsoring Org Name</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.sponsoringOrgName || ''}
                  onChange={e => setNewDoi(prev => ({ ...prev, sponsoringOrgName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Org URL</label>
                <input 
                  type="url"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.orgUrl || ''}
                  onChange={e => setNewDoi(prev => ({ ...prev, orgUrl: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Org Pub URL</label>
                <input 
                  type="url"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoi.orgPubUrl || ''}
                  onChange={e => setNewDoi(prev => ({ ...prev, orgPubUrl: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks</label>
              <textarea 
                rows={2}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newDoi.remarks || ''}
                onChange={e => setNewDoi(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button 
              type="button"
              onClick={handleResetDoi}
              className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-705 py-4 rounded-2xl font-semibold transition-all"
            >
              Reset Form
            </button>
            <button 
              type="submit"
              className="flex-1 bg-rose-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-rose-700 transition-all shadow-xl shadow-rose-200"
            >
              Submit DOI Application
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Client Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transfer Publisher to Another Client"
        maxWidth="lg"
      >
        <form onSubmit={handleTransferClient} className="space-y-6">
          <div className="p-4 bg-indigo-50 text-indigo-800 rounded-2xl text-xs space-y-1.5 border border-indigo-100">
            <p className="font-bold flex items-center gap-1.5">
              <AlertCircle size={14} />
              About Publisher Client Transfer
            </p>
            <p className="leading-relaxed">
              Transferring this publisher will update their primary Associated Client. 
              The previous client association will be archived with an End Date which matches the chosen Start Date, preserving historical transition accuracy.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Currently Associated Client</label>
              <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-sm text-slate-700">
                {client?.name || 'Unknown / Initial Client'}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">New Client Target <span className="text-rose-500">*</span></label>
              <select
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold"
                value={transferForm.newClientId || ''}
                onChange={e => setTransferForm(prev => ({ ...prev, newClientId: e.target.value }))}
              >
                <option value="">Select Target Client</option>
                {allClients
                  .filter(c => c.id !== publisher.clientId)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                }
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Start Date of New Association <span className="text-rose-500">*</span></label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  required
                  type="date"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold"
                  value={transferForm.startDate || ''}
                  onChange={e => setTransferForm(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                The current client's association end date will automatically be set to this date.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Transfer Notes / Reason (Optional)</label>
              <textarea
                rows={3}
                placeholder="E.g., Client transferred ownership, merger, contract transition..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                value={transferForm.remarks || ''}
                onChange={e => setTransferForm(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isTransferring || !transferForm.newClientId}
              className="flex-1 bg-indigo-600 border border-transparent text-white font-bold py-3 rounded-xl text-sm hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isTransferring ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowLeftRight size={16} />
                  Confirm Transfer
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
