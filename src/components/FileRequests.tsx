import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  FileCheck, 
  Clock, 
  XCircle, 
  MoreHorizontal, 
  Search,
  User,
  Briefcase,
  Loader2,
  X,
  Send,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { FileRequest, Client, User as CRMUser, Task } from '../types';

interface FileRequestsProps {
  searchQuery?: string;
}

export const FileRequests: React.FC<FileRequestsProps> = ({ searchQuery = '' }) => {
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    clientId: '',
    taskId: '',
    assignedTo: '',
    assignedRole: 'Client' as 'Client' | 'Employee'
  });

  useEffect(() => {
    const q = query(collection(db, 'file_requests'), orderBy('createdAt', 'desc'));
    const unsubRequests = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileRequest)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'file_requests'));

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMUser)));
    });

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    return () => {
      unsubRequests();
      unsubClients();
      unsubUsers();
      unsubTasks();
    };
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'file_requests'), {
        ...newRequest,
        status: 'pending',
        requestedBy: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setNewRequest({
        title: '',
        description: '',
        clientId: '',
        taskId: '',
        assignedTo: '',
        assignedRole: 'Client'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'file_requests');
    }
  };

  const handleUpdateStatus = async (id: string, status: FileRequest['status']) => {
    try {
      await updateDoc(doc(db, 'file_requests', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'file_requests');
    }
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Unknown Client';
  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown User';
  const getTaskTitle = (id: string) => tasks.find(t => t.id === id)?.title || 'No Task';

  const filteredRequests = requests.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getClientName(r.clientId).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">File Requests</h2>
          <p className="text-slate-500 mt-1">Request missing documents from clients or employees.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus size={20} />
          New Request
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Request</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client / Task</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Loader2 className="animate-spin" size={32} />
                      <p className="text-sm font-medium">Loading requests...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FileCheck size={32} />
                      <p className="text-sm font-medium">No file requests found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-900">{req.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{req.description}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-700">{getClientName(req.clientId)}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{getTaskTitle(req.taskId || '')}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-200">
                          {req.assignedRole === 'Client' ? 'C' : 'E'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">{getUserName(req.assignedTo)}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{req.assignedRole}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {req.status === 'pending' && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
                          <span title="Pending"><Clock size={10} /></span> Pending
                        </span>
                      )}
                      {req.status === 'completed' && (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
                          <span title="Completed"><CheckCircle2 size={10} /></span> Completed
                        </span>
                      )}
                      {req.status === 'cancelled' && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
                          <span title="Cancelled"><XCircle size={10} /></span> Cancelled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        {req.status === 'pending' && (
                          <button 
                            onClick={() => handleUpdateStatus(req.id, 'completed')}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          >
                            <span title="Mark Completed"><CheckCircle2 size={18} /></span>
                          </button>
                        )}
                        <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                          <span title="Cancel Request"><XCircle size={18} /></span>
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

      {/* New Request Modal */}
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
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">New File Request</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleCreateRequest} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Request Title</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Missing SECP Certificate"
                    value={newRequest.title}
                    onChange={e => setNewRequest(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Description</label>
                  <textarea 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                    placeholder="Explain what file is needed and why..."
                    value={newRequest.description}
                    onChange={e => setNewRequest(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Client</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.clientId}
                      onChange={e => setNewRequest(prev => ({ ...prev, clientId: e.target.value }))}
                    >
                      <option value="">Select Client</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Task (Optional)</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.taskId}
                      onChange={e => setNewRequest(prev => ({ ...prev, taskId: e.target.value }))}
                    >
                      <option value="">No Task</option>
                      {tasks.filter(t => t.clientId === newRequest.clientId).map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Assign To Role</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.assignedRole}
                      onChange={e => setNewRequest(prev => ({ ...prev, assignedRole: e.target.value as any }))}
                    >
                      <option value="Client">Client</option>
                      <option value="Employee">Employee</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Assign To User</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newRequest.assignedTo}
                      onChange={e => setNewRequest(prev => ({ ...prev, assignedTo: e.target.value }))}
                    >
                      <option value="">Select User</option>
                      {users.filter(u => u.role === newRequest.assignedRole).map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
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
                    Send Request
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
