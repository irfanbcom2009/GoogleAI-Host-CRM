import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  FileCheck, 
  Building2, 
  Briefcase,
  Loader2,
  ExternalLink,
  ArrowRight,
  Check,
  Hash,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ISSNRequest, JournalIndexing, Task, Client, Journal, IndexingAgency, ProfileUpdateRequest } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

export const ApprovalRequests: React.FC = () => {
  const [issnRequests, setIssnRequests] = useState<ISSNRequest[]>([]);
  const [tasksInReview, setTasksInReview] = useState<Task[]>([]);
  const [profileRequests, setProfileRequests] = useState<ProfileUpdateRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [agencies, setAgencies] = useState<IndexingAgency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubIssn = onSnapshot(
      query(collection(db, 'issn_requests'), where('status', '==', 'pending')),
      (snapshot) => {
        setIssnRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ISSNRequest)));
      }
    );

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('status', '==', 'review')),
      (snapshot) => {
        setTasksInReview(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      }
    );

    const unsubProfile = onSnapshot(
      query(collection(db, 'profile_update_requests'), where('status', '==', 'pending')),
      (snapshot) => {
        setProfileRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProfileUpdateRequest)));
      }
    );

    const unsubClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });

    const unsubJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      setJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal)));
    });

    const unsubAgencies = onSnapshot(collection(db, 'indexing_agencies'), (snapshot) => {
      setAgencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IndexingAgency)));
      setLoading(false);
    });

    return () => {
      unsubIssn();
      unsubTasks();
      unsubProfile();
      unsubClients();
      unsubJournals();
      unsubAgencies();
    };
  }, []);

  const handleApproveISSN = async (id: string, issn: string, journalId?: string) => {
    try {
      await updateDoc(doc(db, 'issn_requests', id), {
        status: 'approved',
        issn,
        approvedAt: serverTimestamp()
      });

      if (journalId) {
        // Update the journal's online ISSN by default, or both if needed
        await updateDoc(doc(db, 'journals', journalId), {
          issnOnline: issn,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'issn_requests');
    }
  };

  const handleApproveTask = async (id: string) => {
    try {
      await updateDoc(doc(db, 'tasks', id), {
        status: 'completed',
        completedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }
  };

  const handleApproveProfileUpdate = async (request: ProfileUpdateRequest) => {
    try {
      const updates: any = {};
      Object.keys(request.changes).forEach(key => {
        updates[key] = request.changes[key].newValue;
      });

      await updateDoc(doc(db, 'users', request.userId), {
        ...updates,
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'profile_update_requests', request.id), {
        status: 'approved',
        reviewedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleRejectProfileUpdate = async (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    try {
      await updateDoc(doc(db, 'profile_update_requests', id), {
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'profile_update_requests');
    }
  };

  const totalRequests = issnRequests.length + tasksInReview.length + profileRequests.length;

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="font-medium">Loading approval requests...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-full mx-auto px-4 md:px-8 lg:px-12">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Approval Requests</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Centralized dashboard for managers to review and approve pending items.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ISSN Requests</p>
              <h4 className="text-2xl font-bold text-slate-900">{issnRequests.length}</h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Briefcase size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Task Reviews</p>
              <h4 className="text-2xl font-bold text-slate-900">{tasksInReview.length}</h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <User size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Profile Updates</p>
              <h4 className="text-2xl font-bold text-slate-900">{profileRequests.length}</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ISSN Section */}
        {issnRequests.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileCheck size={20} className="text-indigo-600" />
              Pending ISSN Applications
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {issnRequests.map(req => {
                const journal = journals.find(j => j.id === req.journalId);
                const client = clients.find(c => c.id === req.clientId);
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={req.id} 
                    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                        <Hash className="text-slate-400" size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{journal?.title || 'Unknown Journal'}</h4>
                        <p className="text-sm text-slate-500">{client?.name} • {req.requestType} ISSN</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => {
                          const issn = prompt('Enter the assigned ISSN:');
                          if (issn) handleApproveISSN(req.id, issn, req.journalId);
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                      >
                        Approve & Assign
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Tasks Section */}
        {tasksInReview.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Briefcase size={20} className="text-emerald-600" />
              Tasks Awaiting Review
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {tasksInReview.map(task => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={task.id} 
                  className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{task.title}</h4>
                      <p className="text-sm text-slate-500">{task.clientName} • Assigned to: {task.assignedToName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleApproveTask(task.id)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                    >
                      Approve & Complete
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Profile Updates Section */}
        {profileRequests.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <User size={20} className="text-blue-600" />
              Profile Update Requests
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {profileRequests.map(req => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={req.id} 
                  className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4 group hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <User size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{req.userName}</h4>
                        <p className="text-sm text-slate-500">{req.userRole} • Requested changes to profile</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleRejectProfileUpdate(req.id)}
                        className="px-4 py-2 text-rose-600 font-bold text-sm hover:bg-rose-50 rounded-xl transition-all"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => handleApproveProfileUpdate(req)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                      >
                        Approve Changes
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-16">
                    {Object.keys(req.changes).map(field => (
                      <div key={field} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{field}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 line-through">{req.changes[field].oldValue || '(empty)'}</span>
                          <ArrowRight size={12} className="text-slate-400" />
                          <span className="font-bold text-slate-900">{req.changes[field].newValue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {totalRequests === 0 && (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
            <CheckCircle2 size={48} className="text-emerald-500" />
            <div className="text-center">
              <p className="font-bold text-slate-900">All caught up!</p>
              <p className="text-sm">There are no pending approval requests at the moment.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
