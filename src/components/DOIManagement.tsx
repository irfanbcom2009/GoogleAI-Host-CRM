import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  CreditCard, 
  FileText, 
  Upload, 
  AlertCircle,
  Loader2,
  Trash2,
  ExternalLink,
  Receipt,
  Hash,
  Settings2,
  Building2,
  Mail,
  Lock,
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DOI, DOIPayment, Client, Journal, User, Publisher } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { cn, sanitizeUrl } from '../lib/utils';
import { Modal } from './Modal';
import { ColumnSelector } from './ColumnSelector';
import { usePermissions } from '../hooks/usePermissions';

interface DOIManagementProps {
  currentUser: User;
}

const AVAILABLE_COLUMNS = [
  { id: 'journal', label: 'Journal' },
  { id: 'prefix', label: 'DOI Prefix' },
  { id: 'member', label: 'Member Name' },
  { id: 'domain', label: 'Domain' },
  { id: 'client', label: 'Client' },
  { id: 'status', label: 'Status' },
  { id: 'dates', label: 'Dates' },
  { id: 'ticket', label: 'Ticket No' },
  { id: 'role', label: 'Role' },
  { id: 'org', label: 'Sponsoring Org' }
];

export const DOIManagement: React.FC<DOIManagementProps> = ({ currentUser }) => {
  const { check } = usePermissions(currentUser);
  const [dois, setDois] = useState<DOI[]>([]);
  const [payments, setPayments] = useState<DOIPayment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(AVAILABLE_COLUMNS.map(c => c.id));
  
  const [newDOI, setNewDOI] = useState({
    clientId: '',
    publisherId: '',
    journalId: '',
    memberName: '',
    doiPrefix: '',
    role: 'Member',
    password: '',
    ticketNo: '',
    otherEmails: [] as string[],
    domainName: '',
    url: '',
    sponsoringOrgName: '',
    sponsoringOrgUrl: '',
    sponsoringOrgPubUrl: '',
    remarks: ''
  });

  const [newPayment, setNewPayment] = useState({
    clientId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: '',
    screenshotUrl: ''
  });

  const isClient = currentUser.role === 'Client';

  useEffect(() => {
    // Load column preferences
    const savedPrefs = localStorage.getItem(`doi_columns_${currentUser.id}`);
    if (savedPrefs) {
      try {
        setSelectedColumns(JSON.parse(savedPrefs));
      } catch (e) {
        console.error("Failed to parse DOI column preferences");
      }
    }

    let unsubDois;
    let unsubPayments;

    if (isClient) {
      unsubDois = onSnapshot(
        query(collection(db, 'doi_records'), where('clientId', '==', currentUser.id)),
        (snapshot) => setDois(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DOI)))
      );
      unsubPayments = onSnapshot(
        query(collection(db, 'doi_payments'), where('clientId', '==', currentUser.id)),
        (snapshot) => setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DOIPayment)))
      );
    } else {
      unsubDois = onSnapshot(collection(db, 'doi_records'), (snapshot) => {
        setDois(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DOI)));
      });
      unsubPayments = onSnapshot(collection(db, 'doi_payments'), (snapshot) => {
        setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DOIPayment)));
      });
    }

    const unsubClients = onSnapshot(collection(db, 'users'), (snapshot) => {
      setClients(snapshot.docs.filter(d => d.data().role === 'Client').map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });

    const unsubPublishers = onSnapshot(collection(db, 'publishers'), (snapshot) => {
      setPublishers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Publisher)));
    });

    const unsubJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      setJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal)));
      setLoading(false);
    });

    return () => {
      unsubDois();
      unsubPayments();
      unsubClients();
      unsubPublishers();
      unsubJournals();
    };
  }, [isClient, currentUser.id]);

  const handleColumnChange = (newColumns: string[]) => {
    setSelectedColumns(newColumns);
    localStorage.setItem(`doi_columns_${currentUser.id}`, JSON.stringify(newColumns));
  };

  const handleCreateDOI = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Strict Rule: 1 Email and 1 Domain per unique Application/Prefix
    const existingWithPrefix = dois.find(d => d.doiPrefix === newDOI.doiPrefix);
    if (existingWithPrefix) {
      if (existingWithPrefix.domainName !== newDOI.domainName) {
        alert(`Strict Rule Violation: DOI Prefix ${newDOI.doiPrefix} is already associated with domain ${existingWithPrefix.domainName}. Each prefix must have a unique domain.`);
        return;
      }
    }

    try {
      await addDoc(collection(db, 'doi_records'), {
        ...newDOI,
        clientId: isClient ? currentUser.id : newDOI.clientId,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setIsSingleModalOpen(false);
      setNewDOI({
        clientId: '',
        publisherId: '',
        journalId: '',
        memberName: '',
        doiPrefix: '',
        role: 'Member',
        password: '',
        ticketNo: '',
        otherEmails: [],
        domainName: '',
        url: '',
        sponsoringOrgName: '',
        sponsoringOrgUrl: '',
        sponsoringOrgPubUrl: '',
        remarks: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'doi_records');
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = bulkUrls.split('\n').map(u => sanitizeUrl(u.trim())).filter(u => u !== '');
    const targetClientId = isClient ? currentUser.id : selectedClientId;
    
    if (!targetClientId) {
      alert('Please select a client.');
      return;
    }

    const existingUrls = dois.filter(d => d.clientId === targetClientId).map(d => d.url);
    const newUrls = urls.filter(u => !existingUrls.includes(u));

    if (newUrls.length === 0) {
      alert('No new URLs found.');
      return;
    }

    if (confirm(`Found ${newUrls.length} new URLs. Deposit for activation?`)) {
      try {
        for (const url of newUrls) {
          await addDoc(collection(db, 'doi_records'), {
            clientId: targetClientId,
            journalId: journals.find(j => j.clientId === targetClientId)?.id || '',
            url,
            status: 'pending',
            createdAt: serverTimestamp(),
            memberName: 'Bulk Upload',
            doiPrefix: 'Pending',
            role: 'Member',
            domainName: 'Pending'
          });
        }
        setIsBulkModalOpen(false);
        setBulkUrls('');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'doi_records');
      }
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'doi_payments'), {
        ...newPayment,
        screenshotUrl: sanitizeUrl(newPayment.screenshotUrl),
        createdAt: serverTimestamp()
      });
      setIsPaymentModalOpen(false);
      setNewPayment({
        clientId: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        notes: '',
        screenshotUrl: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'doi_payments');
    }
  };

  const activateDOI = async (id: string) => {
    try {
      await updateDoc(doc(db, 'doi_records', id), {
        status: 'activated',
        activationDate: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'doi_records');
    }
  };

  const getClientStats = (clientId: string) => {
    const clientDois = dois.filter(d => d.clientId === clientId);
    const clientPayments = payments.filter(p => p.clientId === clientId);
    
    const totalActivated = clientDois.filter(d => d.status === 'activated').length;
    const totalPayments = clientPayments.reduce((sum, p) => sum + p.amount, 0);
    
    const costPerDoi = 1; // Placeholder cost
    const balance = totalPayments - (totalActivated * costPerDoi);

    return { totalActivated, totalPayments, balance };
  };

  const canAdd = check('doiManagement', 'add');
  const canEdit = check('doiManagement', 'edit');
  const canApprove = check('doiManagement', 'approve');

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="font-medium">Loading DOI data...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">DOI Management</h2>
          <p className="text-slate-500 mt-1">Manage Digital Object Identifiers and activation payments.</p>
        </div>
        <div className="flex gap-3">
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          {canAdd && (
            <>
              <button 
                onClick={() => setIsSingleModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                <Plus size={20} />
                New Application
              </button>
            </>
          )}
          {!isClient && canAdd && (
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              <DollarSign size={20} />
              Add Payment
            </button>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isClient ? (
          <>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Activated</p>
              <h4 className="text-2xl font-bold text-slate-900">{dois.filter(d => d.status === 'activated').length}</h4>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Payments</p>
              <h4 className="text-2xl font-bold text-emerald-600">${payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</h4>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Current Balance</p>
              <h4 className={cn(
                "text-2xl font-bold",
                getClientStats(currentUser.id).balance >= 0 ? "text-indigo-600" : "text-rose-600"
              )}>
                ${getClientStats(currentUser.id).balance.toLocaleString()}
              </h4>
            </div>
          </>
        ) : (
          <div className="md:col-span-3 bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
            <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <AlertCircle size={20} />
              Quick Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Total DOIs</p>
                <p className="text-xl font-bold text-indigo-900">{dois.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Pending</p>
                <p className="text-xl font-bold text-amber-600">{dois.filter(d => d.status === 'pending').length}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Activated</p>
                <p className="text-xl font-bold text-emerald-600">{dois.filter(d => d.status === 'activated').length}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Total Revenue</p>
                <p className="text-xl font-bold text-indigo-900">${payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DOI List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <h3 className="font-bold text-lg">DOI Records</h3>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold border border-indigo-100 uppercase tracking-widest">
              {dois.length} RECORDS
            </span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                {selectedColumns.includes('journal') && <th className="px-6 py-4">Journal & URL</th>}
                {selectedColumns.includes('prefix') && <th className="px-6 py-4">Prefix</th>}
                {selectedColumns.includes('member') && <th className="px-6 py-4">Member Name</th>}
                {selectedColumns.includes('domain') && <th className="px-6 py-4">Domain</th>}
                {selectedColumns.includes('client') && <th className="px-6 py-4">Client</th>}
                {selectedColumns.includes('status') && <th className="px-6 py-4">Status</th>}
                {selectedColumns.includes('dates') && <th className="px-6 py-4">Dates</th>}
                {selectedColumns.includes('ticket') && <th className="px-6 py-4">Ticket No</th>}
                {selectedColumns.includes('role') && <th className="px-6 py-4">Role</th>}
                {selectedColumns.includes('org') && <th className="px-6 py-4">Sponsoring Org</th>}
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {dois.map((doi) => (
                  <motion.tr 
                    layout
                    key={doi.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-slate-50/50 transition-all group"
                  >
                    {selectedColumns.includes('journal') && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                            <Globe size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900">
                              {journals.find(j => j.id === doi.journalId)?.title || 'Unknown Journal'}
                            </p>
                            <a 
                              href={doi.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                            >
                              {doi.url} <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      </td>
                    )}
                    {selectedColumns.includes('prefix') && (
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-700">{doi.doiPrefix}</p>
                      </td>
                    )}
                    {selectedColumns.includes('member') && (
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">{doi.memberName}</p>
                      </td>
                    )}
                    {selectedColumns.includes('domain') && (
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">{doi.domainName}</p>
                      </td>
                    )}
                    {selectedColumns.includes('client') && (
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-700">
                          {clients.find(c => c.id === doi.clientId)?.name || 'Unknown Client'}
                        </p>
                      </td>
                    )}
                    {selectedColumns.includes('status') && (
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                          doi.status === 'activated' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                        )}>
                          {doi.status === 'activated' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                          {doi.status}
                        </span>
                      </td>
                    )}
                    {selectedColumns.includes('dates') && (
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500">Added: {new Date(doi.createdAt).toLocaleDateString()}</p>
                        {doi.activationDate && (
                          <p className="text-xs text-emerald-600 font-medium">Active: {new Date(doi.activationDate).toLocaleDateString()}</p>
                        )}
                      </td>
                    )}
                    {selectedColumns.includes('ticket') && (
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">{doi.ticketNo || '-'}</p>
                      </td>
                    )}
                    {selectedColumns.includes('role') && (
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">{doi.role}</p>
                      </td>
                    )}
                    {selectedColumns.includes('org') && (
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">{doi.sponsoringOrgName || '-'}</p>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      {!isClient && doi.status === 'pending' && canApprove && (
                        <button 
                          onClick={() => activateDOI(doi.id)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* New Application Modal */}
      <Modal 
        isOpen={isSingleModalOpen} 
        onClose={() => setIsSingleModalOpen(false)} 
        title="New DOI Application"
        maxWidth="3xl"
      >
        <form onSubmit={handleCreateDOI} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hierarchy Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                <Building2 size={16} />
                Hierarchy & Client
              </h3>
              {!isClient && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Client</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newDOI.clientId}
                    onChange={e => setNewDOI(prev => ({ ...prev, clientId: e.target.value, publisherId: '', journalId: '' }))}
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Publisher</label>
                <select 
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDOI.publisherId}
                  onChange={e => setNewDOI(prev => ({ ...prev, publisherId: e.target.value, journalId: '' }))}
                >
                  <option value="">Select Publisher</option>
                  {publishers
                    .filter(p => p.clientId === (isClient ? currentUser.id : newDOI.clientId))
                    .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Journal</label>
                <select 
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDOI.journalId}
                  onChange={e => setNewDOI(prev => ({ ...prev, journalId: e.target.value }))}
                >
                  <option value="">Select Journal</option>
                  {journals
                    .filter(j => j.publisherId === newDOI.publisherId)
                    .map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
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
                  <label className="text-xs font-bold text-slate-500 uppercase">Member Name</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newDOI.memberName}
                    onChange={e => setNewDOI(prev => ({ ...prev, memberName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">DOI Prefix</label>
                  <input 
                    required
                    type="text"
                    placeholder="10.xxxx"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newDOI.doiPrefix}
                    onChange={e => setNewDOI(prev => ({ ...prev, doiPrefix: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newDOI.role}
                    onChange={e => setNewDOI(prev => ({ ...prev, role: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                  <input 
                    type="password"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newDOI.password}
                    onChange={e => setNewDOI(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ticket No</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newDOI.ticketNo}
                    onChange={e => setNewDOI(prev => ({ ...prev, ticketNo: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Domain Name</label>
                  <input 
                    required
                    type="text"
                    placeholder="example.com"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newDOI.domainName}
                    onChange={e => setNewDOI(prev => ({ ...prev, domainName: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Crossref Metadata */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
              <Globe size={16} />
              Crossref Metadata
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Sponsoring Org Name</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDOI.sponsoringOrgName}
                  onChange={e => setNewDOI(prev => ({ ...prev, sponsoringOrgName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Org URL</label>
                <input 
                  type="url"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDOI.sponsoringOrgUrl}
                  onChange={e => setNewDOI(prev => ({ ...prev, sponsoringOrgUrl: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Org Pub URL</label>
                <input 
                  type="url"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDOI.sponsoringOrgPubUrl}
                  onChange={e => setNewDOI(prev => ({ ...prev, sponsoringOrgPubUrl: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Remarks</label>
              <textarea 
                rows={2}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newDOI.remarks}
                onChange={e => setNewDOI(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200"
            >
              Submit DOI Application
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Add Modal */}
      <Modal 
        isOpen={isBulkModalOpen} 
        onClose={() => setIsBulkModalOpen(false)} 
        title="Bulk Add DOI URLs"
      >
        <form onSubmit={handleBulkAdd} className="space-y-4">
          {!isClient && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Select Client</label>
              <select 
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
              >
                <option value="">Choose a client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Paste URLs (One per line)</label>
            <textarea 
              required
              rows={8}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-xs"
              placeholder="https://example.com/article/1&#10;https://example.com/article/2"
              value={bulkUrls}
              onChange={e => setBulkUrls(e.target.value)}
            />
          </div>
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-800 text-xs">
            The system will automatically filter out URLs that have already been added for this client.
          </div>
          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              Scan & Confirm Deposit
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal 
        isOpen={isPaymentModalOpen} 
        onClose={() => setIsPaymentModalOpen(false)} 
        title="Add DOI Payment Record"
      >
        <form onSubmit={handleAddPayment} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Select Client</label>
            <select 
              required
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={newPayment.clientId}
              onChange={e => setNewPayment(prev => ({ ...prev, clientId: e.target.value }))}
            >
              <option value="">Choose a client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Amount ($)</label>
              <input 
                required
                type="number" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newPayment.amount}
                onChange={e => setNewPayment(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Payment Date</label>
              <input 
                required
                type="date" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newPayment.date}
                onChange={e => setNewPayment(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Payment Proof (Screenshot)</label>
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => {
                  const url = prompt('Enter the screenshot URL (simulating upload):');
                  if (url) setNewPayment(prev => ({ ...prev, screenshotUrl: url }));
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:bg-slate-100 hover:border-indigo-300 transition-all group"
              >
                <Upload size={20} className="group-hover:text-indigo-600" />
                <span className="text-sm font-medium">
                  {newPayment.screenshotUrl ? 'Change Screenshot' : 'Upload Screenshot'}
                </span>
              </button>
              {newPayment.screenshotUrl && (
                <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                  <img src={newPayment.screenshotUrl} alt="Proof" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              )}
            </div>
            {newPayment.screenshotUrl && (
              <p className="text-[10px] text-emerald-600 font-medium truncate">
                File attached: {newPayment.screenshotUrl}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Notes</label>
            <textarea 
              rows={3}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={newPayment.notes}
              onChange={e => setNewPayment(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              Record Payment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
