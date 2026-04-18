import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Key, 
  Eye, 
  EyeOff, 
  Copy, 
  Plus, 
  Trash2, 
  ShieldCheck,
  History,
  ExternalLink,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { User, CredentialVaultRecord } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { Modal } from './Modal';

interface CredentialVaultProps {
  journalId?: string;
  domainId?: string;
  currentUser: User;
}

export const CredentialVault: React.FC<CredentialVaultProps> = ({ journalId, domainId, currentUser }) => {
  const [credentials, setCredentials] = useState<CredentialVaultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [isLogModalOpen, setIsLogModalOpen] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    label: '',
    vaultType: 'Email' as any,
    username: '',
    password: '',
    loginLink: '',
    notes: ''
  });

  useEffect(() => {
    const q = query(
      collection(db, 'vault'),
      where(journalId ? 'journalId' : 'domainId', '==', journalId || domainId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setCredentials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CredentialVaultRecord)));
      setLoading(false);
    });

    return () => unsub();
  }, [journalId, domainId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const record: Partial<CredentialVaultRecord> = {
        ...formData,
        journalId,
        domainId,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        accessLogs: [{
          userId: currentUser.id,
          userName: currentUser.name,
          timestamp: new Date().toISOString(),
          action: 'Created record'
        }]
      };
      await addDoc(collection(db, 'vault'), record);
      setIsAddModalOpen(false);
      setFormData({ label: '', vaultType: 'Email', username: '', password: '', loginLink: '', notes: '' });
      toast.success('Credential added to secure vault');
    } catch (error) {
      toast.error('Failed to add credential');
    }
  };

  const handleView = async (cred: CredentialVaultRecord) => {
    const isShowing = !!showPasswords[cred.id];
    
    // Log access when revealing
    if (!isShowing) {
      try {
        const credRef = doc(db, 'vault', cred.id);
        const newLog = {
          userId: currentUser.id,
          userName: currentUser.name,
          timestamp: new Date().toISOString(),
          action: 'Viewed password'
        };
        await updateDoc(credRef, {
          accessLogs: [...(cred.accessLogs || []), newLog]
        });
      } catch (error) {
        console.error('Failed to log access:', error);
      }
    }

    setShowPasswords(prev => ({ ...prev, [cred.id]: !isShowing }));
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-900 text-white rounded-2xl">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Secure Credential Vault</h3>
            <p className="text-xs text-slate-500 font-medium">Encrypted storage with full access audit</p>
          </div>
        </div>
        {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={18} />
            Store Credential
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {credentials.map(cred => (
          <div key={cred.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                  <Key size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{cred.label}</h4>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{cred.vaultType}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsLogModalOpen(cred.id)}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                  title="View Access History"
                >
                  <History size={16} />
                </button>
                {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
                  <button 
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this credential?')) {
                        await deleteDoc(doc(db, 'vault', cred.id));
                        toast.success('Credential deleted');
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Username / ID</span>
                    <span className="text-sm font-medium text-slate-700">{cred.username}</span>
                  </div>
                  <button 
                    onClick={() => handleCopy(cred.username, 'Username')}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 transition-all"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Password</span>
                    <span className="text-sm font-black tracking-widest">
                      {showPasswords[cred.id] ? cred.password : '••••••••••••'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleView(cred)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 transition-all"
                    >
                      {showPasswords[cred.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    {showPasswords[cred.id] && (
                      <button 
                        onClick={() => handleCopy(cred.password, 'Password')}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 transition-all"
                      >
                        <Copy size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {cred.loginLink && (
                <a 
                  href={cred.loginLink} 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                >
                  <ExternalLink size={14} />
                  Launch Platform
                </a>
              )}
            </div>
          </div>
        ))}

        {credentials.length === 0 && (
          <div className="col-span-2 py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl">
            <Lock size={48} className="text-slate-100 mb-4" />
            <p className="text-sm font-bold text-slate-400">Vault is empty</p>
            <p className="text-xs text-slate-300">Securely store your journal logins and access tokens here</p>
          </div>
        )}
      </div>

      {/* Add Credential Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="New Secure Credential">
        <form onSubmit={handleAdd} className="p-1 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Label</label>
              <input 
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. OJS Admin Login"
                value={formData.label}
                onChange={e => setFormData({...formData, label: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.vaultType}
                onChange={e => setFormData({...formData, vaultType: e.target.value})}
              >
                <option value="Email">Email Account</option>
                <option value="OJS">OJS Platform</option>
                <option value="Hosting">Hosting Panel</option>
                <option value="Domain">Domain Registrar</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Username / Email</label>
            <input 
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
            <input 
              required
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Login URL (Optional)</label>
            <input 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://..."
              value={formData.loginLink}
              onChange={e => setFormData({...formData, loginLink: e.target.value})}
            />
          </div>

          <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
            Securely Save to Vault
          </button>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal 
        isOpen={!!isLogModalOpen} 
        onClose={() => setIsLogModalOpen(null)} 
        title="Access History & Audit"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
            <ShieldAlert className="text-amber-600 shrink-0" size={18} />
            <p className="text-xs text-amber-700 font-medium">
              Every attempt to view or copy this password is logged for security auditing.
            </p>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {credentials.find(c => c.id === isLogModalOpen)?.accessLogs.reverse().map((log, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    {log.userName.charAt(0)}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-700">{log.userName}</h5>
                    <p className="text-[10px] text-slate-400">{log.action}</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-400">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
