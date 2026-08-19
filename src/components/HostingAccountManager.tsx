import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Save, 
  X,
  Loader2,
  Check,
  Server,
  Globe,
  Info,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { HostingAccount, User } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';
import { motion } from 'motion/react';

interface HostingAccountManagerProps {
  currentUser: User;
}

export const HostingAccountManager: React.FC<HostingAccountManagerProps> = ({ currentUser }) => {
  const { check } = usePermissions(currentUser);
  const [hostingAccounts, setHostingAccounts] = useState<HostingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [duplicates, setDuplicates] = useState<HostingAccount[][]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    link: '',
    email: '',
    username: '',
    password: '',
    ip: '',
    provider: '',
    panelUrl: '',
    notes: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'hostingAccounts'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HostingAccount[];
      setHostingAccounts(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'hostingAccounts');
    });

    return () => unsubscribe();
  }, []);

  const scanForDuplicates = () => {
    setIsScanning(true);
    setHasScanned(true);
    const groups: HostingAccount[][] = [];
    const processed = new Set<string>();

    hostingAccounts.forEach(account => {
      if (processed.has(account.id)) return;

      const group = hostingAccounts.filter(other => {
        if (other.id === account.id) return false;
        
        const sameName = account.name?.toLowerCase().trim() === other.name?.toLowerCase().trim();
        const sameIp = account.ip && other.ip && account.ip.trim() === other.ip.trim();
        const sameUser = account.username && other.username && 
                         account.username.toLowerCase().trim() === other.username.toLowerCase().trim() && 
                         account.provider?.toLowerCase().trim() === other.provider?.toLowerCase().trim();
        
        return sameName || sameIp || sameUser;
      });

      if (group.length > 0) {
        const fullGroup = [account, ...group];
        fullGroup.forEach(item => processed.add(item.id));
        groups.push(fullGroup);
      }
    });

    setDuplicates(groups);
    setIsScanning(false);
    if (groups.length === 0) {
      toast.success("No duplicate hosting accounts found.");
    } else {
      toast.error(`Found ${groups.length} groups of potential duplicate hosting accounts.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!check('domains', 'edit')) {
      toast.error('Permission denied');
      return;
    }

    // Strict uniqueness checking
    const cleanName = formData.name.toLowerCase().trim();
    const cleanIp = formData.ip?.trim();
    const cleanUsername = formData.username?.toLowerCase().trim();
    const cleanProvider = formData.provider?.toLowerCase().trim();

    const isDuplicate = hostingAccounts.some(acc => {
      if (editingId && acc.id === editingId) return false;
      const sameName = acc.name.toLowerCase().trim() === cleanName;
      const sameIp = cleanIp && acc.ip && acc.ip.trim() === cleanIp;
      const sameUser = cleanUsername && acc.username && 
                       acc.username.toLowerCase().trim() === cleanUsername && 
                       cleanProvider && acc.provider && 
                       acc.provider.toLowerCase().trim() === cleanProvider;
      return sameName || sameIp || sameUser;
    });

    if (isDuplicate) {
      toast.error('A hosting account with this Server Name, IP address, or Username already exists! Duplicates are strictly blocked.');
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'hostingAccounts', editingId), {
          ...formData,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name
        });
        toast.success('Hosting account updated successfully');
      } else {
        await addDoc(collection(db, 'hostingAccounts'), {
          ...formData,
          createdAt: serverTimestamp(),
          createdBy: currentUser.name,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name
        });
        toast.success('Hosting account added successfully');
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'hostingAccounts');
      toast.error('Failed to save hosting account');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!check('domains', 'delete')) {
      toast.error('Permission denied');
      return;
    }
    if (!confirm(`Are you sure you want to delete hosting account "${name}"?`)) return;

    try {
      await deleteDoc(doc(db, 'hostingAccounts', id));
      toast.success('Hosting account deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'hostingAccounts');
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      link: '', 
      email: '', 
      username: '', 
      password: '', 
      ip: '', 
      provider: '', 
      panelUrl: '', 
      notes: '' 
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const startEdit = (account: HostingAccount) => {
    setFormData({
      name: account.name,
      link: account.link || '',
      email: account.email || '',
      username: account.username || '',
      password: account.password || '',
      ip: account.ip || '',
      provider: account.provider || '',
      panelUrl: account.panelUrl || '',
      notes: account.notes || ''
    });
    setEditingId(account.id);
    setIsAdding(true);
  };

  const togglePassword = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="text-sm font-medium text-slate-500">Loading hosting accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Hosting Account & Server Management</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage external hosting accounts, servers, control panels, and login details.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isAdding && check('domains', 'add') && (
            <>
              <button 
                type="button"
                onClick={scanForDuplicates}
                disabled={isScanning}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 px-4 py-2 rounded-xl font-bold transition-all shadow-sm text-xs uppercase cursor-pointer"
              >
                {isScanning ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Scan Duplicates
              </button>
              <button 
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm text-xs uppercase"
              >
                <Plus size={18} />
                Add Hosting Account
              </button>
            </>
          )}
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Server/Account Name</label>
              <input 
                required
                type="text"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-950 font-medium"
                placeholder="e.g. Hostinger Business Plan, AWS EC2-1"
                value={formData.name || ''}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hosting Provider</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-950 font-medium"
                placeholder="e.g. Hostinger, AWS, DigitalOcean"
                value={formData.provider || ''}
                onChange={e => setFormData(prev => ({ ...prev, provider: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Server IP Address</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-950 font-medium font-mono"
                placeholder="e.g. 192.168.1.1"
                value={formData.ip || ''}
                onChange={e => setFormData(prev => ({ ...prev, ip: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Control Panel Link / URL</label>
              <input 
                type="url"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-950 font-medium"
                placeholder="https://..."
                value={formData.panelUrl || ''}
                onChange={e => setFormData(prev => ({ ...prev, panelUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Login Website Link (Client Portal)</label>
              <input 
                type="url"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-950 font-medium"
                placeholder="https://..."
                value={formData.link || ''}
                onChange={e => setFormData(prev => ({ ...prev, link: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
              <input 
                type="email"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-950 font-medium"
                placeholder="admin@example.com"
                value={formData.email || ''}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Login Username</label>
              <input 
                required
                type="text"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-950 font-medium"
                placeholder="cpanel_user or admin"
                value={formData.username || ''}
                onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono text-slate-950 font-semibold"
                placeholder="Password"
                value={formData.password || ''}
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">General Notes</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-950 font-medium"
                placeholder="PHP version, nameservers, locations, etc."
                value={formData.notes || ''}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all text-xs"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md text-xs uppercase"
            >
              <Save size={18} />
              {editingId ? 'Update Account' : 'Save Account'}
            </button>
          </div>
        </form>
      )}

      {duplicates.length > 0 && (
        <div className="mx-auto mb-6">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle size={20} />
                <h4 className="font-bold">Potential Duplicate Hosting Accounts Found ({duplicates.length} groups)</h4>
              </div>
              <button 
                onClick={() => {
                  setDuplicates([]);
                  setHasScanned(false);
                }}
                className="text-xs font-bold text-amber-600 hover:text-amber-700"
              >
                Dismiss
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {duplicates.map((group, idx) => (
                <div key={`group-${idx}`} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm space-y-3">
                  <p className="text-sm font-bold text-slate-900">Duplicate Group</p>
                  <div className="space-y-2">
                    {group.map((account, dIdx) => (
                      <div key={`${account.id}-${dIdx}`} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                        <div className="truncate mr-2">
                          <p className="font-bold text-slate-700 truncate">{account.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{account.ip || 'No IP'} • {account.username}</p>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => startEdit(account)}
                            className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md font-bold hover:bg-indigo-100 transition-all text-[10px]"
                          >
                            Edit
                          </button>
                          {check('domains', 'delete') && (
                            <button 
                              onClick={() => handleDelete(account.id, account.name)}
                              className="px-2 py-1 bg-rose-50 text-rose-600 rounded-md font-bold hover:bg-rose-100 transition-all text-[10px]"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {hasScanned && duplicates.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-sm mb-6"
        >
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 size={20} />
            <h4 className="font-bold text-sm text-emerald-700">Scan Complete: No duplicate hosting accounts found.</h4>
          </div>
          <button 
            onClick={() => setHasScanned(false)}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hostingAccounts.map(account => (
          <div key={account.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-indigo-200 transition-all group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Server size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    {account.name}
                    {account.provider && (
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black uppercase">
                        {account.provider}
                      </span>
                    )}
                  </h4>
                  <div className="flex gap-3 mt-1">
                    {account.panelUrl && (
                      <a 
                        href={account.panelUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
                      >
                        Control Panel <ExternalLink size={10} />
                      </a>
                    )}
                    {account.link && (
                      <a 
                        href={account.link} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] text-slate-500 font-bold hover:underline flex items-center gap-1"
                      >
                        Portal Link <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                {check('domains', 'edit') && (
                  <button 
                    onClick={() => startEdit(account)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  >
                    <Edit size={14} />
                  </button>
                )}
                {check('domains', 'delete') && (
                  <button 
                    onClick={() => handleDelete(account.id, account.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-slate-50">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Mail size={10} /> Username
                </p>
                <p className="text-xs font-bold text-slate-700 truncate" title={account.username}>
                  {account.username || '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Lock size={10} /> Password
                </p>
                <div className="flex items-center gap-1">
                  <p className="text-xs font-mono font-bold text-slate-700">
                    {showPassword[account.id] ? account.password : '••••••••'}
                  </p>
                  <button 
                    onClick={() => togglePassword(account.id)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword[account.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1 col-span-2 md:col-span-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Globe size={10} /> Server IP
                </p>
                <p className="text-xs font-mono font-bold text-slate-700 truncate">
                  {account.ip || '—'}
                </p>
              </div>
            </div>

            {(account.email || account.notes) && (
              <div className="p-3 bg-slate-50 rounded-xl text-slate-600 space-y-1 text-[11px] font-medium border border-slate-100">
                {account.email && (
                  <p><span className="font-bold">Contact Email:</span> {account.email}</p>
                )}
                {account.notes && (
                  <p className="italic text-slate-500 flex items-start gap-1">
                    <Info size={12} className="shrink-0 mt-0.5 text-slate-400" />
                    <span>{account.notes}</span>
                  </p>
                )}
              </div>
            )}
            
            {account.panelUrl && (
              <div className="pt-2">
                <a 
                  href={account.panelUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-bold border border-indigo-100 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all uppercase tracking-wider"
                >
                  Access Control Panel
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        ))}
        {hostingAccounts.length === 0 && !isAdding && (
          <div className="col-span-full py-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
            <p className="text-slate-500 font-medium">No hosting accounts or servers added yet.</p>
            {check('domains', 'add') && (
              <button 
                onClick={() => setIsAdding(true)}
                className="mt-2 text-indigo-600 font-bold hover:underline"
              >
                Add the first hosting account
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
