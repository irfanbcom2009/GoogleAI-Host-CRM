import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  FileCheck, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  MoreHorizontal, 
  Search,
  Hash,
  FileText,
  Loader2,
  Building2,
  Globe,
  User as UserIcon,
  Mail,
  CreditCard,
  Calendar,
  Settings2,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ISSNRequest, Client, Journal, Publisher, User, GlobalSettings } from '../types';
import { cn, sanitizeUrl } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, getDoc, where } from 'firebase/firestore';
import { Modal } from './Modal';
import { ISSNDetail } from './ISSNDetail';
import { ColumnSelector } from './ColumnSelector';
import { ClientDetail } from './ClientDetail';
import { JournalDetail } from './JournalDetail';
import { usePermissions } from '../hooks/usePermissions';
import { ConfigModal } from './ConfigModal';

interface ISSNRequestsProps {
  searchQuery: string;
  currentUser: User;
}

const AVAILABLE_COLUMNS = [
  { id: 'requestNo', label: 'ISSN Request #' },
  { id: 'journal', label: 'Journal Title' },
  { id: 'client', label: 'Client Name' },
  { id: 'type', label: 'Request Type' },
  { id: 'status', label: 'Request Status' },
  { id: 'payment', label: 'Payments ISSN' },
  { id: 'sentDate', label: 'ISSN Sent Date' },
  { id: 'modifiedDate', label: 'ISSN Modified Date' },
  { id: 'publisher', label: 'Name of Publisher (ISSN)' },
  { id: 'publisherAddress', label: 'Publisher Address (ISSN)' },
  { id: 'frequency', label: 'Frequency_ISSN' },
  { id: 'contact', label: 'Contact name (ISSN)' },
  { id: 'email', label: 'Email Address (ISSN)' },
  { id: 'pIssn', label: 'P-ISSN' },
  { id: 'eIssn', label: 'E-ISSN' },
  { id: 'login', label: 'ISSN_Login' },
  { id: 'password', label: 'ISSN_Password' },
];

export const ISSNRequests: React.FC<ISSNRequestsProps> = ({ searchQuery, currentUser }) => {
  const { check } = usePermissions(currentUser);
  const [requests, setRequests] = useState<ISSNRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubjectConfigOpen, setIsSubjectConfigOpen] = useState(false);
  const [isFrequencyConfigOpen, setIsFrequencyConfigOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ISSNRequest | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [viewingJournal, setViewingJournal] = useState<{ id: string, editMode?: boolean } | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['issn'] || ['requestNo', 'journal', 'client', 'type', 'status']
  );
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);

  // Form state
  const [newRequest, setNewRequest] = useState({
    clientId: '',
    journalId: '',
    requestNo: '',
    requestType: 'Assignment',
    printIssn: '',
    onlineIssn: '',
    issnLogin: '',
    issnPassword: '',
    journalUrl: '',
    publisherName: '',
    publisherAddress: '',
    frequency: '',
    contactName: '',
    emailAddress: '',
    paymentAmountPkr: 0,
    sentDate: '',
    modifiedDate: '',
    legacyInvoiceNumber: '',
    language: 'English',
    subject: '',
    country: 'Pakistan',
    status: 'pending' as const,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as GlobalSettings;
          const sanitizedData: GlobalSettings = {
            ...data,
            expenseHeads: Array.isArray(data.expenseHeads) ? data.expenseHeads : [],
            journalCategories: Array.isArray(data.journalCategories) ? data.journalCategories : [],
            issnTypes: Array.isArray(data.issnTypes) ? data.issnTypes : [],
            issnSubjects: Array.isArray(data.issnSubjects) ? data.issnSubjects : [],
            frequencies: Array.isArray(data.frequencies) ? data.frequencies : [],
            departments: Array.isArray(data.departments) ? data.departments : [],
            modes: Array.isArray(data.modes) ? data.modes : [],
            journalScopes: Array.isArray(data.journalScopes) ? data.journalScopes : [],
            officeSubscriptions: Array.isArray(data.officeSubscriptions) ? data.officeSubscriptions : []
          };
          setGlobalSettings(sanitizedData);
          setNewRequest(prev => ({
            ...prev,
            requestType: prev.requestType || sanitizedData.issnTypes?.[0] || 'Assignment',
            frequency: prev.frequency || sanitizedData.frequencies?.[0] || 'Monthly',
            subject: prev.subject || sanitizedData.issnSubjects?.[0] || 'Pluridisciplinary'
          }));
        }
      });
      return unsubscribeSettings;
    };
    const unsubSettings = fetchSettings();

    const q = query(collection(db, 'issn_requests'), orderBy('createdAt', 'desc'));
    const unsubscribeRequests = onSnapshot(q, (snapshot) => {
      const requestData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ISSNRequest[];
      setRequests(requestData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issn_requests');
    });

    const unsubscribeClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snapshot) => {
      const clientData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientData);
    });

    const unsubscribeJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      const journalData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Journal[];
      setJournals(journalData);
    });

    const unsubscribePublishers = onSnapshot(collection(db, 'publishers'), (snapshot) => {
      const publisherData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Publisher[];
      setPublishers(publisherData);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeClients();
      unsubscribeJournals();
      unsubscribePublishers();
    };
  }, []);

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.issn`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const filteredRequests = requests.filter(req => {
    const client = clients.find(c => c.id === req.clientId);
    const journal = journals.find(j => j.id === req.journalId);
    return journal?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           req.requestNo?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const journal = journals.find(j => j.id === newRequest.journalId);
      const client = clients.find(c => c.id === newRequest.clientId);
      
      await addDoc(collection(db, 'issn_requests'), {
        ...newRequest,
        journalUrl: sanitizeUrl(newRequest.journalUrl),
        journalTitle: journal?.title,
        clientName: client?.name,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        isVerified: false
      });
      setIsModalOpen(false);
      setNewRequest({
        clientId: '',
        journalId: '',
        requestNo: '',
        requestType: 'Assignment',
        printIssn: '',
        onlineIssn: '',
        issnLogin: '',
        issnPassword: '',
        journalUrl: '',
        publisherName: '',
        publisherAddress: '',
        frequency: '',
        contactName: '',
        emailAddress: '',
        paymentAmountPkr: 0,
        sentDate: '',
        modifiedDate: '',
        legacyInvoiceNumber: '',
        language: 'English',
        subject: 'Pluridisciplinary',
        country: 'Pakistan',
        status: 'pending',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'issn_requests');
    }
  };

  const handleVerifyRequest = async (requestId: string) => {
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Manager') return;
    
    try {
      const requestRef = doc(db, 'issn_requests', requestId);
      await updateDoc(requestRef, {
        isVerified: true,
        verifiedBy: currentUser.name,
        verifiedById: currentUser.id,
        verifiedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'issn_requests');
    }
  };

  const getStatusColor = (status: ISSNRequest['status']) => {
    switch (status) {
      case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'rejected': return 'bg-rose-50 text-rose-700 border-rose-100';
    }
  };

  if (selectedRequest) {
    return <ISSNDetail request={selectedRequest} onBack={() => setSelectedRequest(null)} currentUser={currentUser} />;
  }

  if (viewingJournal) {
    return (
      <JournalDetail 
        journalId={viewingJournal.id} 
        initialEditMode={viewingJournal.editMode}
        onBack={() => setViewingJournal(null)} 
        currentUser={currentUser}
      />
    );
  }

  if (viewingClient) {
    return (
      <ClientDetail 
        client={viewingClient} 
        onBack={() => setViewingClient(null)} 
        currentUser={currentUser}
      />
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">ISSN Requests</h2>
          <p className="text-slate-500 mt-1">Manage and track ISSN applications for client journals.</p>
        </div>
        <div className="flex items-center gap-3">
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          {currentUser.role !== 'Client' && (
            <div className="flex items-center gap-2">
              {currentUser.role === 'Admin' && (
                <div className="flex gap-2 mr-2">
                  <button 
                    onClick={() => setIsSubjectConfigOpen(true)}
                    className="p-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                    title="Configure ISSN Subjects"
                  >
                    <Settings2 size={20} />
                  </button>
                  <button 
                    onClick={() => setIsFrequencyConfigOpen(true)}
                    className="p-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                    title="Configure Frequencies"
                  >
                    <Settings size={20} />
                  </button>
                </div>
              )}
              {check('issnRequests', 'add') && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Plus size={20} />
                  New Request
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Loading requests...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                  {selectedColumns.includes('requestNo') && <th className="px-6 py-4">Request No</th>}
                  {selectedColumns.includes('journal') && <th className="px-6 py-4">Journal</th>}
                  {selectedColumns.includes('client') && <th className="px-6 py-4">Client</th>}
                  {selectedColumns.includes('type') && <th className="px-6 py-4">Type</th>}
                  {selectedColumns.includes('status') && <th className="px-6 py-4">Status</th>}
                  {selectedColumns.includes('publisher') && <th className="px-6 py-4">Publisher</th>}
                  {selectedColumns.includes('payment') && <th className="px-6 py-4">Payment</th>}
                  {selectedColumns.includes('dates') && <th className="px-6 py-4">Dates</th>}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {filteredRequests.map((req) => (
                    <motion.tr 
                      layout
                      key={req.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedRequest(req)}
                      className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                    >
                      {selectedColumns.includes('requestNo') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                              <FileCheck size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-sm text-slate-900">{req.requestNo}</p>
                              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">ISSN APP</p>
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('journal') && (
                        <td className="px-6 py-4">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const journal = journals.find(j => j.id === req.journalId);
                              if (journal) setViewingJournal({ id: journal.id, editMode: false });
                            }}
                            className="font-bold text-sm text-slate-900 hover:text-indigo-600 hover:underline text-left"
                          >
                            {journals.find(j => j.id === req.journalId)?.title || 'Unknown Journal'}
                          </button>
                          <p className="text-[10px] text-slate-400 font-mono">{req.journalId}</p>
                        </td>
                      )}
                      {selectedColumns.includes('client') && (
                        <td className="px-6 py-4">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const client = clients.find(c => c.id === req.clientId);
                              if (client) setViewingClient(client);
                            }}
                            className="text-sm font-medium text-slate-700 hover:text-indigo-600 hover:underline text-left"
                          >
                            {clients.find(c => c.id === req.clientId)?.name || 'Unknown Client'}
                          </button>
                        </td>
                      )}
                      {selectedColumns.includes('type') && (
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                            {req.requestType}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('status') && (
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                            getStatusColor(req.status)
                          )}>
                            {req.status === 'approved' ? <CheckCircle2 size={14} /> : req.status === 'pending' ? <Clock size={14} /> : <XCircle size={14} />}
                            {req.status}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('publisher') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-700">{req.publisherName || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('publisherAddress') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600 truncate max-w-[150px]">{req.publisherAddress || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('payment') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-emerald-600">PKR {req.paymentAmountPkr?.toLocaleString()}</p>
                        </td>
                      )}
                      {selectedColumns.includes('sentDate') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{req.sentDate || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('modifiedDate') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{req.modifiedDate || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('frequency') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{req.frequency || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('contact') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{req.contactName || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('email') && (
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{req.emailAddress || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('pIssn') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono font-bold text-slate-900">{req.printIssn || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('eIssn') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono font-bold text-slate-900">{req.onlineIssn || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('login') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono text-slate-600">{req.issnLogin || 'N/A'}</p>
                        </td>
                      )}
                      {selectedColumns.includes('password') && (
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono text-slate-600">••••••••</p>
                        </td>
                      )}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequest(req);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Details"
                          >
                            <FileText size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequest(req);
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

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Add New ISSN Detail"
        maxWidth="4xl"
      >
        <form onSubmit={handleNewRequest} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Basic Information</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">ISSN Request #</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="ISSN-REQ-XXX"
                    value={newRequest.requestNo}
                    onChange={e => setNewRequest(prev => ({ ...prev, requestNo: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Select Client</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newRequest.clientId}
                    onChange={e => setNewRequest(prev => ({ ...prev, clientId: e.target.value, journalId: '' }))}
                  >
                    <option value="">Choose a client...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Select Journal</label>
                  <select 
                    required
                    disabled={!newRequest.clientId}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                    value={newRequest.journalId}
                    onChange={e => setNewRequest(prev => ({ ...prev, journalId: e.target.value }))}
                  >
                    <option value="">Choose a journal...</option>
                    {journals.filter(j => j.clientId === newRequest.clientId).map(journal => (
                      <option key={journal.id} value={journal.id}>{journal.title}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Request Type</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.requestType}
                      onChange={e => setNewRequest(prev => ({ ...prev, requestType: e.target.value }))}
                    >
                      {globalSettings?.issnTypes?.map(type => (
                        <option key={type} value={type}>{type}</option>
                      )) || (
                        <>
                          <option value="Claim">Claim</option>
                          <option value="Assignment">Assignment</option>
                          <option value="Modification">Modification</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Frequency_ISSN</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.frequency}
                      onChange={e => setNewRequest(prev => ({ ...prev, frequency: e.target.value }))}
                    >
                      {globalSettings?.frequencies?.map(freq => (
                        <option key={freq} value={freq}>{freq}</option>
                      )) || (
                        <>
                          <option value="Monthly">Monthly</option>
                          <option value="Quarterly">Quarterly</option>
                          <option value="Bi-Annual">Bi-Annual</option>
                          <option value="Annual">Annual</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">ISSN Details</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">P-ISSN</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="XXXX-XXXX"
                      value={newRequest.printIssn}
                      onChange={e => setNewRequest(prev => ({ ...prev, printIssn: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">E-ISSN</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="XXXX-XXXX"
                      value={newRequest.onlineIssn}
                      onChange={e => setNewRequest(prev => ({ ...prev, onlineIssn: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">ISSN Login</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.issnLogin}
                      onChange={e => setNewRequest(prev => ({ ...prev, issnLogin: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">ISSN Password</label>
                    <input 
                      type="password" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.issnPassword}
                      onChange={e => setNewRequest(prev => ({ ...prev, issnPassword: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Language</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.language}
                      onChange={e => setNewRequest(prev => ({ ...prev, language: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Country</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.country}
                      onChange={e => setNewRequest(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Subject Area</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newRequest.subject}
                    onChange={e => setNewRequest(prev => ({ ...prev, subject: e.target.value }))}
                  >
                    {globalSettings?.issnSubjects?.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    )) || (
                      <>
                        <option value="Pluridisciplinary">Pluridisciplinary</option>
                        <option value="Information and documentation, official publications">Information and documentation, official publications</option>
                        <option value="Philosophy, religion and psychology">Philosophy, religion and psychology</option>
                        <option value="Social sciences">Social sciences</option>
                        <option value="Mathematics and natural sciences">Mathematics and natural sciences</option>
                        <option value="Applied sciences, technology and medicine">Applied sciences, technology and medicine</option>
                        <option value="Arts and recreation">Arts and recreation</option>
                        <option value="Language and Literature">Language and Literature</option>
                        <option value="Geography and History">Geography and History</option>
                        <option value="Other, please specify">Other, please specify</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Journal URL</label>
                  <input 
                    type="url" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="https://..."
                    value={newRequest.journalUrl}
                    onChange={e => setNewRequest(prev => ({ ...prev, journalUrl: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Publisher & Contact</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Name of Publisher (ISSN)</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newRequest.publisherName}
                    onChange={e => setNewRequest(prev => ({ ...prev, publisherName: e.target.value }))}
                  >
                    <option value="">Select publisher</option>
                    {publishers.map(pub => (
                      <option key={pub.id} value={pub.name}>{pub.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Publisher Address (ISSN)</label>
                  <textarea 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                    rows={2}
                    value={newRequest.publisherAddress}
                    onChange={e => setNewRequest(prev => ({ ...prev, publisherAddress: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Contact name (ISSN)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.contactName}
                      onChange={e => setNewRequest(prev => ({ ...prev, contactName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Email Address (ISSN)</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.emailAddress}
                      onChange={e => setNewRequest(prev => ({ ...prev, emailAddress: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Financials & Dates</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Payments ISSN (Amount in PKR)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="0.00"
                    value={newRequest.paymentAmountPkr}
                    onChange={e => setNewRequest(prev => ({ ...prev, paymentAmountPkr: Number(e.target.value) }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">ISSN Sent Date</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.sentDate}
                      onChange={e => setNewRequest(prev => ({ ...prev, sentDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">ISSN Modified Date</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.modifiedDate}
                      onChange={e => setNewRequest(prev => ({ ...prev, modifiedDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Invoice Number (Legacy)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="INV-ISSN-XXX"
                    value={newRequest.legacyInvoiceNumber}
                    onChange={e => setNewRequest(prev => ({ ...prev, legacyInvoiceNumber: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-slate-100">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>

      {isSubjectConfigOpen && (
        <ConfigModal
          isOpen={isSubjectConfigOpen}
          onClose={() => setIsSubjectConfigOpen(false)}
          title="Configure ISSN Subjects"
          fieldName="issnSubjects"
          type="string-list"
          initialItems={globalSettings?.issnSubjects || []}
        />
      )}

      {isFrequencyConfigOpen && (
        <ConfigModal
          isOpen={isFrequencyConfigOpen}
          onClose={() => setIsFrequencyConfigOpen(false)}
          title="Configure Frequencies"
          fieldName="frequencies"
          type="string-list"
          initialItems={globalSettings?.frequencies || []}
        />
      )}
    </div>
  );
};
