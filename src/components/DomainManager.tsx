import React, { useState } from 'react';
import { 
  History, 
  Server, 
  Key, 
  Plus, 
  Calendar, 
  ArrowRight,
  Shield,
  Trash2,
  Save,
  Loader2,
  Globe,
  Lock,
  RefreshCw,
  Users,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Domain, RegistrarHistory, HostingMigrationLog, User as UserType, Client, OwnershipHistory } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, deleteDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { cn, sanitizeUrl } from '../lib/utils';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { moveToTrash } from '../lib/firebase';

interface DomainManagerProps {
  domain: Domain;
  onClose: () => void;
  isEmployee: boolean;
  currentUser: UserType;
}

export const DomainManager: React.FC<DomainManagerProps> = ({ domain, onClose, isEmployee, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'history' | 'hosting' | 'credentials' | 'renewals' | 'ownership'>('history');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);

  // Form states
  const [newRegistrar, setNewRegistrar] = useState({ registrarName: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [newMigration, setNewMigration] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    fromServer: '', 
    toServer: '', 
    fromNS: '', 
    toNS: '', 
    notes: '' 
  });
  const [newOwnership, setNewOwnership] = useState({ clientId: '', startDate: new Date().toISOString().split('T')[0], notes: '' });
  const [newRenewal, setNewRenewal] = useState({ date: new Date().toISOString().split('T')[0], costPrice: 0, salePrice: 0, notes: '' });
  const [credentials, setCredentials] = useState(domain.hostingCredentials || { panelUrl: '', username: '', password: '' });
  const [eppCode, setEppCode] = useState(domain.eppCode || '');
  const [isDomainSubscribedFromUs, setIsDomainSubscribedFromUs] = useState(domain.isDomainSubscribedFromUs ?? domain.isSubscribed ?? true);
  const [isHostingSubscribedFromUs, setIsHostingSubscribedFromUs] = useState(domain.isHostingSubscribedFromUs ?? domain.isSubscribed ?? true);

  React.useEffect(() => {
    if (isEmployee) {
      const q = query(collection(db, 'users'), where('role', '==', 'Client'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Client));
      });
      return () => unsubscribe();
    }
  }, [isEmployee]);

  const handleUpdateSubscription = async (field: 'isDomainSubscribedFromUs' | 'isHostingSubscribedFromUs', value: boolean) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'domains', domain.id), {
        [field]: value,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
      if (field === 'isDomainSubscribedFromUs') setIsDomainSubscribedFromUs(value);
      if (field === 'isHostingSubscribedFromUs') setIsHostingSubscribedFromUs(value);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCredentials = async () => {
    setLoading(true);
    try {
      const sanitizedCredentials = {
        ...credentials,
        panelUrl: sanitizeUrl(credentials.panelUrl)
      };
      await updateDoc(doc(db, 'domains', domain.id), {
        hostingCredentials: sanitizedCredentials,
        eppCode: eppCode,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
      setCredentials(sanitizedCredentials);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRegistrarHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const entry = { id: crypto.randomUUID(), ...newRegistrar };
      await updateDoc(doc(db, 'domains', domain.id), {
        registrarHistory: arrayUnion(entry),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
      setNewRegistrar({ registrarName: '', date: new Date().toISOString().split('T')[0], notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHostingHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const entry = { 
        id: crypto.randomUUID(), 
        date: newMigration.date,
        fromServer: newMigration.fromServer,
        toServer: newMigration.toServer,
        fromNS: newMigration.fromNS.split(',').map(s => s.trim()).filter(Boolean),
        toNS: newMigration.toNS.split(',').map(s => s.trim()).filter(Boolean),
        notes: newMigration.notes
      };
      await updateDoc(doc(db, 'domains', domain.id), {
        hostingHistory: arrayUnion(entry),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
      setNewMigration({ date: new Date().toISOString().split('T')[0], fromServer: '', toServer: '', fromNS: '', toNS: '', notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnership.clientId) return;
    
    setLoading(true);
    try {
      const targetClient = clients.find(c => c.id === newOwnership.clientId);
      if (!targetClient) throw new Error('Target client not found');

      const newEntry: OwnershipHistory = {
        id: crypto.randomUUID(),
        clientId: newOwnership.clientId,
        clientName: targetClient.name,
        startDate: newOwnership.startDate,
        notes: newOwnership.notes
      };

      let updatedHistory = [...(domain.ownershipHistory || [])];
      
      // Update the last entry's end date if it exists
      if (updatedHistory.length > 0) {
        const lastIndex = updatedHistory.length - 1;
        updatedHistory[lastIndex] = {
          ...updatedHistory[lastIndex],
          endDate: newOwnership.startDate
        };
      }

      updatedHistory.push(newEntry);

      // Update current ownership and the entire history
      await updateDoc(doc(db, 'domains', domain.id), {
        clientId: newOwnership.clientId,
        ownershipHistory: updatedHistory,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });

      setNewOwnership({ clientId: '', startDate: new Date().toISOString().split('T')[0], notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRenewalHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const entry = { id: crypto.randomUUID(), ...newRenewal };
      await updateDoc(doc(db, 'domains', domain.id), {
        renewalHistory: arrayUnion(entry),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
      setNewRenewal({ date: new Date().toISOString().split('T')[0], costPrice: 0, salePrice: 0, notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  const removeHistoryItem = async (field: 'registrarHistory' | 'hostingHistory' | 'renewalHistory' | 'ownershipHistory', item: any) => {
    if (!confirm('Are you sure you want to remove this record?')) return;
    try {
      await updateDoc(doc(db, 'domains', domain.id), {
        [field]: arrayRemove(item),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domains');
    }
  };

  const handleDeleteDomain = async () => {
    if (domain.isVerified && currentUser.role !== 'Admin') {
      alert('Only administrators can delete verified domains.');
      return;
    }

    if (!confirm('Are you sure you want to move this domain to trash?')) return;

    setLoading(true);
    try {
      await moveToTrash('domains', domain.id, domain, currentUser.name);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'domains');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm">
            <Globe size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{domain.domainName}</h3>
            <p className="text-sm text-slate-500">Domain & Hosting Management</p>
          </div>
        </div>

        {isEmployee && (
          <div className="flex items-center gap-2">
            {/* Verification Status */}
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all uppercase tracking-wider",
              domain.isVerified 
                ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                : "bg-amber-50 text-amber-700 border-amber-100"
            )}>
              {domain.isVerified ? <ShieldCheck size={12} /> : <Clock size={12} />}
              {domain.isVerified ? 'Verified' : 'Pending'}
            </div>

            {/* Danger Zone / Actions */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
              {!domain.isVerified && (currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                <button 
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'domains', domain.id), {
                        isVerified: true,
                        verifiedBy: currentUser.name,
                        verifiedById: currentUser.id,
                        verifiedAt: new Date().toISOString()
                      });
                    } catch (error) {
                      handleFirestoreError(error, OperationType.UPDATE, 'domains');
                    }
                  }}
                  className="p-1.5 text-amber-600 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                  title="Verify Domain"
                >
                  <Shield size={16} />
                </button>
              )}
              <button 
                onClick={handleDeleteDomain}
                disabled={loading || (domain.isVerified && currentUser.role !== 'Admin')}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  domain.isVerified && currentUser.role !== 'Admin'
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-rose-600 hover:bg-white hover:shadow-sm"
                )}
                title="Move to Trash"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 space-y-4 mb-8">
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
              checked={isDomainSubscribedFromUs}
              onChange={e => handleUpdateSubscription('isDomainSubscribedFromUs', e.target.checked)}
            />
            <span className="text-xs font-bold text-slate-700">Domain (Us)</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors">
            <input 
              type="checkbox"
              className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              checked={isHostingSubscribedFromUs}
              onChange={e => handleUpdateSubscription('isHostingSubscribedFromUs', e.target.checked)}
            />
            <span className="text-xs font-bold text-slate-700">Hosting (Us)</span>
          </label>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'history' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <History size={16} />
          Registrar History
        </button>
        <button 
          onClick={() => setActiveTab('hosting')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'hosting' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Server size={16} />
          Hosting Logs
        </button>
        <button 
          onClick={() => setActiveTab('credentials')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'credentials' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Key size={16} />
          Access & EPP
        </button>
        <button 
          onClick={() => setActiveTab('ownership')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'ownership' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Users size={16} />
          Ownership History
        </button>
        <button 
          onClick={() => setActiveTab('renewals')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'renewals' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <RefreshCw size={16} />
          Renewal History
        </button>
      </div>

      <div className="min-h-[400px] space-y-8">
        {activeTab === 'history' && (
          <div className="space-y-6">
            {isEmployee && (
              <form onSubmit={handleAddRegistrarHistory} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Registrar Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="e.g. Namecheap, GoDaddy"
                      value={newRegistrar.registrarName}
                      onChange={e => setNewRegistrar(prev => ({ ...prev, registrarName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRegistrar.date}
                      onChange={e => setNewRegistrar(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Notes (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Initial registration"
                    value={newRegistrar.notes}
                    onChange={e => setNewRegistrar(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <button 
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                  Add Registrar Record
                </button>
              </form>
            )}

            <div className="space-y-3">
              {domain.registrarHistory?.length ? (
                domain.registrarHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Globe size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{item.registrarName}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Calendar size={12} /> {item.date}</span>
                          {item.notes && <span>• {item.notes}</span>}
                        </div>
                      </div>
                    </div>
                    {isEmployee && (
                      <button 
                        onClick={() => removeHistoryItem('registrarHistory', item)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <History size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No registrar history recorded</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'hosting' && (
          <div className="space-y-6">
            {isEmployee && (
              <form onSubmit={handleAddHostingHistory} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Migration Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newMigration.date}
                      onChange={e => setNewMigration(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">From Server</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Old Server IP/Name"
                      value={newMigration.fromServer}
                      onChange={e => setNewMigration(prev => ({ ...prev, fromServer: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">To Server</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="New Server IP/Name"
                      value={newMigration.toServer}
                      onChange={e => setNewMigration(prev => ({ ...prev, toServer: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">From NS (Comma separated)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="ns1.old.com, ns2.old.com"
                      value={newMigration.fromNS}
                      onChange={e => setNewMigration(prev => ({ ...prev, fromNS: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">To NS (Comma separated)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="ns1.new.com, ns2.new.com"
                      value={newMigration.toNS}
                      onChange={e => setNewMigration(prev => ({ ...prev, toNS: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Migration Notes</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Upgraded to dedicated server"
                    value={newMigration.notes}
                    onChange={e => setNewMigration(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <button 
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Server size={18} />}
                  Log Migration
                </button>
              </form>
            )}

            <div className="space-y-3">
              {domain.hostingHistory?.length ? (
                domain.hostingHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <RefreshCw size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{item.fromServer || 'N/A'}</span>
                            {item.fromNS && item.fromNS.length > 0 && (
                              <span className="text-[10px] text-slate-400 font-mono">{item.fromNS.join(', ')}</span>
                            )}
                          </div>
                          <ArrowRight size={14} className="text-slate-400" />
                          <div className="flex flex-col">
                            <span className="font-bold text-indigo-600">{item.toServer || 'N/A'}</span>
                            {item.toNS && item.toNS.length > 0 && (
                              <span className="text-[10px] text-indigo-400 font-mono">{item.toNS.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1"><Calendar size={12} /> {item.date}</span>
                          {item.notes && <span>• {item.notes}</span>}
                        </div>
                      </div>
                    </div>
                    {isEmployee && (
                      <button 
                        onClick={() => removeHistoryItem('hostingHistory', item)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Server size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No hosting migration logs found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'credentials' && (
          <div className="space-y-6">
            {!isHostingSubscribedFromUs && !isDomainSubscribedFromUs ? (
              <div className="p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <Lock size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">External Service</h3>
                <p className="text-slate-500 max-w-md mx-auto">
                  This domain and hosting are managed externally. Credentials and invoice details are hidden for external services.
                </p>
                {isEmployee && (
                  <button
                    onClick={() => handleUpdateSubscription('isHostingSubscribedFromUs', true)}
                    className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    Convert to Subscribed (Us)
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Lock size={16} className="text-indigo-600" />
                    Hosting Access Credentials
                  </h4>
                  {isHostingSubscribedFromUs ? (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Panel URL</label>
                        <input 
                          disabled={!isEmployee}
                          type="text" 
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                          placeholder="https://cpanel.domain.com"
                          value={credentials.panelUrl}
                          onChange={e => setCredentials(prev => ({ ...prev, panelUrl: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                          <input 
                            disabled={!isEmployee}
                            type="text" 
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                            value={credentials.username}
                            onChange={e => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                          <input 
                            disabled={!isEmployee}
                            type="text" 
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                            value={credentials.password}
                            onChange={e => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Hosting is managed externally. Credentials hidden.</p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Shield size={16} className="text-indigo-600" />
                    EPP / Authorization Code
                  </h4>
                  {isDomainSubscribedFromUs ? (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">EPP Code</label>
                      <div className="relative">
                        <input 
                          disabled={!isEmployee}
                          type="text" 
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                          placeholder="Enter EPP code for transfer"
                          value={eppCode}
                          onChange={e => setEppCode(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Domain is managed externally. EPP code hidden.</p>
                  )}
                </div>

                {isEmployee && (
                  <button 
                    onClick={handleUpdateCredentials}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    Save Access Details
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ownership' && (
          <div className="space-y-6">
            {isEmployee && (
              <form onSubmit={handleTransferOwnership} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Transfer to Client</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newOwnership.clientId}
                      onChange={e => setNewOwnership(prev => ({ ...prev, clientId: e.target.value }))}
                    >
                      <option value="">Choose a client...</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Transfer Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newOwnership.startDate}
                      onChange={e => setNewOwnership(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Transfer Notes</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Domain sold to new client"
                    value={newOwnership.notes}
                    onChange={e => setNewOwnership(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <button 
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} />}
                  Transfer Ownership
                </button>
              </form>
            )}

            <div className="space-y-3">
              {domain.ownershipHistory?.length ? (
                domain.ownershipHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Users size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{item.clientName}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Calendar size={12} /> From: {item.startDate}</span>
                          {item.endDate && <span className="flex items-center gap-1"><Calendar size={12} /> To: {item.endDate}</span>}
                          {item.notes && <span>• {item.notes}</span>}
                        </div>
                      </div>
                    </div>
                    {isEmployee && (
                      <button 
                        onClick={() => removeHistoryItem('ownershipHistory', item)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Users size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No ownership history found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'renewals' && (
          <div className="space-y-6">
            {isEmployee && (
              <form onSubmit={handleAddRenewalHistory} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Renewal Date</label>
                    <input 
                      required
                      type="date" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRenewal.date}
                      onChange={e => setNewRenewal(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Cost Price ($)</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="0.00"
                      value={newRenewal.costPrice}
                      onChange={e => setNewRenewal(prev => ({ ...prev, costPrice: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Sale Price ($)</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="0.00"
                      value={newRenewal.salePrice}
                      onChange={e => setNewRenewal(prev => ({ ...prev, salePrice: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Notes (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Renewed for 1 year"
                    value={newRenewal.notes}
                    onChange={e => setNewRenewal(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <button 
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                  Add Renewal Record
                </button>
              </form>
            )}

            <div className="space-y-3">
              {domain.renewalHistory?.length ? (
                domain.renewalHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <RefreshCw size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-4">
                          <p className="font-bold text-slate-900">Renewal on {item.date}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Cost: ${item.costPrice}</span>
                            <span className="text-xs font-bold text-indigo-600">Sale: ${item.salePrice}</span>
                          </div>
                        </div>
                        {item.notes && <p className="text-xs text-slate-500 mt-1">{item.notes}</p>}
                      </div>
                    </div>
                    {isEmployee && (
                      <button 
                        onClick={() => removeHistoryItem('renewalHistory', item)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No renewal history recorded</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audit Info Footer */}
        {isEmployee && (
          <div className="pt-6 mt-8 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entered By</p>
              <p className="text-xs font-bold text-slate-600">{domain.createdBy || 'System'}</p>
              <p className="text-[10px] text-slate-500">{domain.createdAt ? new Date(domain.createdAt).toLocaleString() : 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Updated By</p>
              <p className="text-xs font-bold text-slate-600">{domain.updatedBy || 'System'}</p>
              <p className="text-[10px] text-slate-500">{domain.updatedAt ? new Date(domain.updatedAt).toLocaleString() : 'N/A'}</p>
            </div>
            {domain.isVerified && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified By</p>
                <p className="text-xs font-bold text-emerald-600">{domain.verifiedBy}</p>
                <p className="text-[10px] text-slate-500">{domain.verifiedAt ? new Date(domain.verifiedAt).toLocaleString() : 'N/A'}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
