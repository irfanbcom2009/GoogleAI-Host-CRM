import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Building2, 
  Mail, 
  Phone, 
  Calendar,
  Loader2,
  Check,
  X,
  MessageSquare,
  ArrowRight,
  Shield,
  ExternalLink
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp, addDoc, setDoc } from 'firebase/firestore';
import { RegistrationRequest, UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Modal } from './Modal';

export const RegistrationRequests: React.FC = () => {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'registration_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RegistrationRequest[];
      setRequests(requestData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'registration_requests'));

    return () => unsubscribe();
  }, []);

  const handleApprove = async (request: RegistrationRequest) => {
    if (!request.id || actionLoading) return;
    setActionLoading(request.id);
    try {
      // 1. Create the user document
      const newUser = {
        name: request.name,
        email: request.email,
        role: 'Client' as UserRole,
        organization: request.organization,
        contactNumber: request.contactNumber,
        points: 0,
        portalEnabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        permissions: {
          dashboard: true,
          journals: true,
          indexingAgencies: true,
          publishers: true,
          hecApplications: true,
          issnRequests: true,
          doiManagement: true,
          dataTools: true,
          invoices: true,
          expenses: false,
          approvalRequests: false,
          resources: true,
          notifications: true,
          trash: false
        }
      };

      // We use a random ID or the email as a seed for the ID if we can't get the UID yet
      // Actually, when they log in again, App.tsx will find them by email and link the UID.
      await addDoc(collection(db, 'users'), newUser);

      // 2. Update request status
      await updateDoc(doc(db, 'registration_requests', request.id), {
        status: 'approved',
        updatedAt: new Date().toISOString()
      });

      // 3. Log activity
      await addDoc(collection(db, 'activity_logs'), {
        action: 'REGISTRATION_APPROVED',
        details: `Email: ${request.email}, Approved by Admin`,
        userName: 'System Admin',
        userId: 'admin',
        timestamp: serverTimestamp()
      });

      setSelectedRequest(null);
    } catch (error) {
      console.error("Error approving request:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest?.id || actionLoading) return;
    setActionLoading(selectedRequest.id);
    try {
      await updateDoc(doc(db, 'registration_requests', selectedRequest.id), {
        status: 'rejected',
        rejectionReason: rejectionReason,
        updatedAt: new Date().toISOString()
      });

      // Log activity
      await addDoc(collection(db, 'activity_logs'), {
        action: 'REGISTRATION_REJECTED',
        details: `Email: ${selectedRequest.email}, Reason: ${rejectionReason}`,
        userName: 'System Admin',
        userId: 'admin',
        timestamp: serverTimestamp()
      });

      setShowRejectionModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
    } catch (error) {
      console.error("Error rejecting request:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.organization.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 space-y-8 max-w-full mx-auto px-4 md:px-8 lg:px-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Registration Requests</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage new account creation requests from unregistered users.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-widest",
                statusFilter === status 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search requests by name, email or organization..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm"
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm font-medium">Loading requests...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {filteredRequests.length > 0 ? (
              filteredRequests.map((request) => (
                <motion.div
                  layout
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className={cn(
                    "p-6 bg-white rounded-2xl border transition-all cursor-pointer group relative overflow-hidden",
                    selectedRequest?.id === request.id 
                      ? "border-indigo-600 ring-4 ring-indigo-50 shadow-xl" 
                      : "border-slate-100 hover:border-indigo-200 shadow-sm"
                  )}
                >
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        request.status === 'pending' ? "bg-amber-50 text-amber-600" :
                        request.status === 'approved' ? "bg-emerald-50 text-emerald-600" :
                        "bg-rose-50 text-rose-600"
                      )}>
                        {request.status === 'pending' ? <Clock size={24} /> :
                         request.status === 'approved' ? <CheckCircle2 size={24} /> :
                         <XCircle size={24} />}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{request.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Building2 size={12} /> {request.organization}
                          </p>
                          <span className="text-slate-300">•</span>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail size={12} /> {request.email}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        request.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                        request.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        "bg-rose-50 text-rose-600 border-rose-100"
                      )}>
                        {request.status}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-2 flex items-center justify-end gap-1">
                        <Calendar size={10} /> {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <UserPlus size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No requests found</h3>
                <p className="text-slate-500 text-sm">Try adjusting your filters or search query.</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {selectedRequest ? (
                <motion.div
                  key={selectedRequest.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden sticky top-8"
                >
                  <div className="p-8 space-y-8">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-xl text-slate-900">Request Details</h3>
                      <button 
                        onClick={() => setSelectedRequest(null)}
                        className="p-2 hover:bg-slate-100 rounded-full transition-all"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 font-bold">
                          {selectedRequest.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{selectedRequest.name}</p>
                          <p className="text-xs text-slate-500">{selectedRequest.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Organization</p>
                          <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Building2 size={14} className="text-indigo-500" />
                            {selectedRequest.organization}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Number</p>
                          <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Phone size={14} className="text-indigo-500" />
                            {selectedRequest.contactNumber}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Required Services</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedRequest.requiredServices.map((service, idx) => (
                            <span key={`${service}-${idx}`} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold border border-indigo-100">
                              {service}
                            </span>
                          ))}
                        </div>
                      </div>

                      {selectedRequest.notes && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</p>
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed italic">
                            "{selectedRequest.notes}"
                          </div>
                        </div>
                      )}

                      {selectedRequest.status === 'rejected' && selectedRequest.rejectionReason && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Rejection Reason</p>
                          <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-600 leading-relaxed">
                            {selectedRequest.rejectionReason}
                          </div>
                        </div>
                      )}

                      {selectedRequest.status === 'pending' && (
                        <div className="pt-6 flex gap-3">
                          <button
                            onClick={() => setShowRejectionModal(true)}
                            disabled={!!actionLoading}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-all border border-rose-100"
                          >
                            <X size={18} />
                            Reject
                          </button>
                          <button
                            onClick={() => handleApprove(selectedRequest)}
                            disabled={!!actionLoading}
                            className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                          >
                            {actionLoading === selectedRequest.id ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                            Approve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-10 text-center space-y-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto text-slate-300 shadow-sm">
                    <MessageSquare size={24} />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Select a request to view full details and take action.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      <Modal
        isOpen={showRejectionModal}
        onClose={() => setShowRejectionModal(false)}
        title="Reject Request"
      >
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Please provide a reason for rejecting this registration request. This will be logged for internal records.</p>
            <textarea 
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm min-h-[120px]"
              placeholder="e.g. Incomplete information, Duplicate request..."
              value={rejectionReason || ''}
              onChange={e => setRejectionReason(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setShowRejectionModal(false)}
              className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleReject}
              disabled={!rejectionReason.trim() || !!actionLoading}
              className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
            >
              Confirm Reject
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
