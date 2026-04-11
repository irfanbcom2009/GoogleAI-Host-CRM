import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  UserCog, 
  Shield, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  MoreHorizontal, 
  Search,
  Lock,
  Eye,
  Loader2,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User as CRMUser, UserRole, User as UserType } from '../types';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Modal } from './Modal';
import { ColumnSelector } from './ColumnSelector';

interface UserManagementProps {
  onImpersonate?: (user: { id: string, role: UserRole, name: string, email: string }) => void;
  currentUser: UserType;
}

const AVAILABLE_COLUMNS = [
  { id: 'info', label: 'User Info' },
  { id: 'role', label: 'Role' },
  { id: 'points', label: 'Points' },
  { id: 'status', label: 'Status' },
];

export const UserManagement: React.FC<UserManagementProps> = ({ onImpersonate, currentUser }) => {
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    currentUser.columnPreferences?.['users'] || ['info', 'role', 'points', 'status']
  );

  // Form state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'Employee' as 'Admin' | 'Manager' | 'Employee' | 'Client',
    points: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CRMUser[];
      setUsers(userData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleColumnChange = async (columns: string[]) => {
    setSelectedColumns(columns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, {
        [`columnPreferences.users`]: columns
      });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'users'), {
        ...newUser,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setNewUser({
        name: '',
        email: '',
        role: 'Employee',
        points: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  const getRoleColor = (role: CRMUser['role']) => {
    switch (role) {
      case 'Admin': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'Manager': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'Employee': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Client': return 'bg-amber-50 text-amber-700 border-amber-100';
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">User Management</h2>
          <p className="text-slate-500 mt-1">Manage CRM users, roles, and access permissions.</p>
        </div>
        <div className="flex gap-3">
          <ColumnSelector 
            availableColumns={AVAILABLE_COLUMNS}
            selectedColumns={selectedColumns}
            onChange={handleColumnChange}
          />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={20} />
            Create User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-lg">System Users</h3>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-100 uppercase tracking-widest">
              {users.length} TOTAL
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all">
              <Shield size={18} />
            </button>
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Loading users...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  {selectedColumns.includes('info') && <th className="px-6 py-4">User Info</th>}
                  {selectedColumns.includes('role') && <th className="px-6 py-4">Role</th>}
                  {selectedColumns.includes('points') && <th className="px-6 py-4">Points</th>}
                  {selectedColumns.includes('status') && <th className="px-6 py-4">Status</th>}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {users.map((user) => (
                    <motion.tr 
                      layout
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/50 transition-all group"
                    >
                      {selectedColumns.includes('info') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} 
                              className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200" 
                              alt="" 
                            />
                            <div>
                              <p className="font-bold text-sm text-slate-900">{user.name}</p>
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Mail size={12} /> {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                      )}
                      {selectedColumns.includes('role') && (
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                            getRoleColor(user.role)
                          )}>
                            <Shield size={12} />
                            {user.role}
                          </span>
                        </td>
                      )}
                      {selectedColumns.includes('points') && (
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-slate-900">{user.points.toLocaleString()} pts</span>
                        </td>
                      )}
                      {selectedColumns.includes('status') && (
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-emerald-50 text-emerald-700 border-emerald-100">
                            <CheckCircle2 size={14} />
                            ACTIVE
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {onImpersonate && user.role !== 'Admin' && (
                            <button 
                              onClick={() => onImpersonate({ id: user.id, role: user.role, name: user.name, email: user.email })}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              title="Login As"
                            >
                              <LogIn size={16} />
                            </button>
                          )}
                          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                            <Lock size={16} />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                            <Eye size={16} />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
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
        title="Create New User"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Full Name</label>
            <input 
              required
              type="text" 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. John Doe"
              value={newUser.name}
              onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Email Address</label>
            <input 
              required
              type="email" 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. john@hostajournal.com"
              value={newUser.email}
              onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Role</label>
              <select 
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newUser.role}
                onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value as any }))}
              >
                <option value="Employee">Employee</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
                <option value="Client">Client</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Initial Points</label>
              <input 
                required
                type="number" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newUser.points}
                onChange={e => setNewUser(prev => ({ ...prev, points: parseInt(e.target.value) }))}
              />
            </div>
          </div>
          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              Create User
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
