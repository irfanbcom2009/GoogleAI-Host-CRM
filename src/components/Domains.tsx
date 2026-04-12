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
  GitMerge
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Domain, Client, User } from '../types';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, Timestamp, where, doc, updateDoc } from 'firebase/firestore';
import { Modal } from './Modal';
import { BulkAddModal } from './BulkAddModal';
import { MergeModal } from './MergeModal';
import { DomainManager } from './DomainManager';
import { DomainTransferRequests } from './DomainTransferRequests';
import { ClientDetail } from './ClientDetail';

import { ColumnSelector } from './ColumnSelector';

interface DomainsProps {
  searchQuery: string;
  currentUser: User;
}

const AVAILABLE_COLUMNS = [
  { id: 'domainName', label: 'Domain Name' },
  { id: 'client', label: 'Client' },
  { id: 'registrar', label: 'Registrar' },
  { id: 'status', label: 'Status' },
  { id: 'dates', label: 'Dates' },
  { id: 'pricing', label: 'Pricing' },
];

export const Domains: React.FC<DomainsProps> = ({ searchQuery, currentUser }) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['domains'] || ['domainName', 'client', 'registrar', 'status', 'dates', 'pricing']
  );

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
    registrar: '',
    status: 'active' as const,
    registrationDate: '',
    expirationDate: '',
    costPrice: 0,
    salePrice: 0
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
    
    if (!isEmployee) {
      q = query(
        collection(db, 'domains'), 
        where('clientId', '==', currentUser.id),
        orderBy('expirationDate', 'asc')
      );
    }

    const unsubscribeDomains = onSnapshot(q, (snapshot) => {
      const domainData = snapshot.docs.map(doc => {
        const data = doc.data();
        const expDate = data.expirationDate instanceof Timestamp 
          ? data.expirationDate.toDate().toISOString().split('T')[0]
          : data.expirationDate;
        
        const regDate = data.registrationDate instanceof Timestamp
          ? data.registrationDate.toDate().toISOString().split('T')[0]
          : data.registrationDate;
        
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

    return () => {
      unsubscribeDomains();
      unsubscribeClients();
    };
  }, []);

  const filteredDomains = domains.filter(domain => {
    const client = clients.find(c => c.id === domain.clientId);
    return (domain.domainName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
           (client?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
  });

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for uniqueness
    const isDuplicate = domains.some(d => d.domainName.toLowerCase() === newDomain.domainName.toLowerCase());
    if (isDuplicate) {
      alert('This domain name already exists in the system.');
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
        registrar: '',
        status: 'active',
        registrationDate: '',
        expirationDate: '',
        costPrice: 0,
        salePrice: 0
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
          <button 
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeftRight size={20} className="text-indigo-600" />
            Transfers
          </button>
          {isEmployee && (
            <>
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
                Add New Domain
              </button>
            </>
          )}
        </div>
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
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Loading domains...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  {selectedColumns.includes('domainName') && <th className="px-6 py-4">Domain Name</th>}
                  {selectedColumns.includes('client') && <th className="px-6 py-4">Client</th>}
                  {selectedColumns.includes('registrar') && <th className="px-6 py-4">Registrar</th>}
                  {selectedColumns.includes('status') && <th className="px-6 py-4">Status</th>}
                  {selectedColumns.includes('dates') && <th className="px-6 py-4">Dates</th>}
                  {selectedColumns.includes('pricing') && <th className="px-6 py-4">Pricing</th>}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {filteredDomains.map((domain) => (
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
                              className="text-sm font-medium text-slate-700 hover:text-indigo-600 hover:underline text-left"
                            >
                              {clients.find(c => c.id === domain.clientId)?.name || 'Unknown Client'}
                            </button>
                            <p className="text-[10px] text-slate-400 font-mono">{domain.clientId}</p>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('registrar') && (
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-slate-600 px-2 py-1 bg-slate-100 rounded-md">
                            {domain.registrar}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('status') && (
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                            getStatusColor(domain.status)
                          )}>
                            {getStatusIcon(domain.status)}
                            {domain.status.replace('_', ' ')}
                          </span>
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
            <input 
              required
              type="text" 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. Namecheap"
              value={newDomain.registrar}
              onChange={e => setNewDomain(prev => ({ ...prev, registrar: e.target.value }))}
            />
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

      {isEmployee && (
        <>
          <BulkAddModal 
            isOpen={isBulkModalOpen} 
            onClose={() => setIsBulkModalOpen(false)} 
            type="domains" 
            clients={clients}
          />
          <MergeModal 
            isOpen={isMergeModalOpen}
            onClose={() => setIsMergeModalOpen(false)}
            type="domains"
          />
        </>
      )}

      {viewingClient && (
        <ClientDetail 
          client={viewingClient} 
          onBack={() => setViewingClient(null)} 
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
