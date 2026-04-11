import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Globe, 
  User, 
  Shield,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DomainTransferRequest, Client } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface DomainTransferRequestsProps {
  currentUser: { id: string; role: string };
  clients: Client[];
}

export const DomainTransferRequests: React.FC<DomainTransferRequestsProps> = ({ currentUser, clients }) => {
  const [requests, setRequests] = useState<DomainTransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newRequest, setNewRequest] = useState({
    clientId: currentUser.role === 'Client' ? currentUser.id : '',
    domainName: '',
    type: 'Transfer In' as DomainTransferRequest['type'],
    eppCode: ''
  });

  const isEmployee = currentUser.role !== 'Client';

  useEffect(() => {
    let q = query(collection(db, 'domain_transfer_requests'), orderBy('createdAt', 'desc'));
    
    if (!isEmployee) {
      q = query(
        collection(db, 'domain_transfer_requests'), 
        where('clientId', '==', currentUser.id),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DomainTransferRequest[];
      setRequests(requestData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'domain_transfer_requests');
    });

    return () => unsubscribe();
  }, [currentUser.id, isEmployee]);

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'domain_transfer_requests'), {
        ...newRequest,
        status: 'Pending',
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewRequest({
        clientId: currentUser.role === 'Client' ? currentUser.id : '',
        domainName: '',
        type: 'Transfer In',
        eppCode: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'domain_transfer_requests');
    }
  };

  const handleUpdateStatus = async (id: string, status: DomainTransferRequest['status']) => {
    try {
      await updateDoc(doc(db, 'domain_transfer_requests', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'domain_transfer_requests');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Domain Transfer Requests</h3>
          <p className="text-sm text-slate-500">Manage incoming and outgoing domain transfers.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-all text-sm"
        >
          {isAdding ? 'Cancel' : <><Plus size={18} /> New Request</>}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddRequest} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {isEmployee && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Select Client</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.clientId}
                      onChange={e => setNewRequest(prev => ({ ...prev, clientId: e.target.value }))}
                    >
                      <option value="">Choose a client...</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Transfer Type</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newRequest.type}
                    onChange={e => setNewRequest(prev => ({ ...prev, type: e.target.value as DomainTransferRequest['type'] }))}
                  >
                    <option value="Transfer In">Transfer In (To Host A Journal)</option>
                    <option value="Transfer Out">Transfer Out (From Host A Journal)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Domain Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. example.com"
                    value={newRequest.domainName}
                    onChange={e => setNewRequest(prev => ({ ...prev, domainName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">EPP Code (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Auth code for transfer"
                    value={newRequest.eppCode}
                    onChange={e => setNewRequest(prev => ({ ...prev, eppCode: e.target.value }))}
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                Submit Transfer Request
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="animate-spin" size={24} />
              <p className="text-xs font-medium">Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <ArrowLeftRight size={32} className="opacity-20" />
              <p className="text-xs font-medium">No transfer requests found</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">Domain & Type</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">EPP Code</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          request.type === 'Transfer In' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        )}>
                          <Globe size={16} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{request.domainName}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{request.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <User size={14} className="text-slate-400" />
                        {clients.find(c => c.id === request.clientId)?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {request.eppCode ? (
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit">
                          <Shield size={12} className="text-indigo-500" />
                          {request.eppCode}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not provided</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                        request.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        request.status === 'Rejected' ? "bg-rose-50 text-rose-700 border-rose-100" :
                        request.status === 'Approved' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                        "bg-amber-50 text-amber-700 border-amber-100"
                      )}>
                        {request.status === 'Completed' ? <CheckCircle2 size={12} /> :
                         request.status === 'Rejected' ? <XCircle size={12} /> :
                         request.status === 'Approved' ? <CheckCircle2 size={12} /> :
                         <Clock size={12} />}
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isEmployee && request.status === 'Pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleUpdateStatus(request.id, 'Approved')}
                            className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-all"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(request.id, 'Rejected')}
                            className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100 transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {isEmployee && request.status === 'Approved' && (
                        <button 
                          onClick={() => handleUpdateStatus(request.id, 'Completed')}
                          className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-all"
                        >
                          Mark Completed
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
