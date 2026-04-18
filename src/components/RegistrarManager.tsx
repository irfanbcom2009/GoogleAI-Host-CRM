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
  Check
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { DomainRegistrar, User } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';

interface RegistrarManagerProps {
  currentUser: User;
}

export const RegistrarManager: React.FC<RegistrarManagerProps> = ({ currentUser }) => {
  const { check } = usePermissions(currentUser);
  const [registrars, setRegistrars] = useState<DomainRegistrar[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    name: '',
    link: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'registrars'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DomainRegistrar[];
      setRegistrars(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'registrars');
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!check('domains', 'edit')) {
      toast.error('Permission denied');
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'registrars', editingId), {
          ...formData,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name
        });
        toast.success('Registrar updated successfully');
      } else {
        await addDoc(collection(db, 'registrars'), {
          ...formData,
          createdAt: serverTimestamp(),
          createdBy: currentUser.name,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name
        });
        toast.success('Registrar added successfully');
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'registrars');
      toast.error('Failed to save registrar');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!check('domains', 'delete')) {
      toast.error('Permission denied');
      return;
    }
    if (!confirm(`Are you sure you want to delete registrar "${name}"?`)) return;

    try {
      await deleteDoc(doc(db, 'registrars', id));
      toast.success('Registrar deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'registrars');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', link: '', email: '', password: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const startEdit = (registrar: DomainRegistrar) => {
    setFormData({
      name: registrar.name,
      link: registrar.link,
      email: registrar.email,
      password: registrar.password || ''
    });
    setEditingId(registrar.id);
    setIsAdding(true);
  };

  const togglePassword = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="text-sm font-medium text-slate-500">Loading registrars...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Registrar Management</h3>
          <p className="text-xs text-slate-500">Manage external domain registrars and their access details.</p>
        </div>
        {!isAdding && check('domains', 'add') && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Plus size={18} />
            Add Registrar
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registrar Name</label>
              <input 
                required
                type="text"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Namecheap"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Login Link</label>
              <input 
                required
                type="url"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="https://..."
                value={formData.link}
                onChange={e => setFormData(prev => ({ ...prev, link: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email/Username</label>
              <input 
                required
                type="text"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                placeholder="Registrar password"
                value={formData.password}
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md"
            >
              <Save size={18} />
              {editingId ? 'Update Registrar' : 'Save Registrar'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {registrars.map(registrar => (
          <div key={registrar.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:border-indigo-200 transition-all group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ExternalLink size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{registrar.name}</h4>
                  <a 
                    href={registrar.link} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
                  >
                    Visit Portal <ExternalLink size={10} />
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                {check('domains', 'edit') && (
                  <button 
                    onClick={() => startEdit(registrar)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  >
                    <Edit size={14} />
                  </button>
                )}
                {check('domains', 'delete') && (
                  <button 
                    onClick={() => handleDelete(registrar.id, registrar.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Mail size={10} /> Account
                </p>
                <p className="text-xs font-bold text-slate-700 truncate" title={registrar.email}>
                  {registrar.email}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Lock size={10} /> Password
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono font-bold text-slate-700">
                    {showPassword[registrar.id] ? registrar.password : '••••••••'}
                  </p>
                  <button 
                    onClick={() => togglePassword(registrar.id)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword[registrar.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <a 
                href={registrar.link} 
                target="_blank" 
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold border border-slate-100 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all uppercase tracking-wider"
              >
                Quick Login
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ))}
        {registrars.length === 0 && !isAdding && (
          <div className="col-span-full py-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
            <p className="text-slate-500 font-medium">No registrars added yet.</p>
            {check('domains', 'add') && (
              <button 
                onClick={() => setIsAdding(true)}
                className="mt-2 text-indigo-600 font-bold hover:underline"
              >
                Add the first registrar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
