import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  PlusCircle, 
  MinusCircle,
  GripVertical,
  Layout,
  Settings,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { CatalogItem, CatalogRequirement, PricingTier, User as UserType } from '../types';
import { cn } from '../lib/utils';
import { Modal } from './Modal';

interface CatalogManagerProps {
  currentUser: UserType;
}

export const CatalogManager: React.FC<CatalogManagerProps> = ({ currentUser }) => {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  
  const [formData, setFormData] = useState<Partial<CatalogItem>>({
    name: '',
    description: '',
    category: 'General',
    basePrice: 0,
    isActive: true,
    pricingTiers: [
      { priority: 'Standard', price: 0, estimatedDays: 7 },
      { priority: 'Rush', price: 0, estimatedDays: 3 },
      { priority: 'Express', price: 0, estimatedDays: 1 }
    ],
    requirements: []
  });

  useEffect(() => {
    const q = query(collection(db, 'catalog'), orderBy('category', 'asc'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as CatalogItem));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'catalog');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...formData,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      };

      if (editingItem) {
        await updateDoc(doc(db, 'catalog', editingItem.id), data);
      } else {
        await addDoc(collection(db, 'catalog'), {
          ...data,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.name,
          createdById: currentUser.id
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'catalog');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      category: 'General',
      basePrice: 0,
      isActive: true,
      pricingTiers: [
        { priority: 'Standard', price: 0, estimatedDays: 7 },
        { priority: 'Rush', price: 0, estimatedDays: 3 },
        { priority: 'Express', price: 0, estimatedDays: 1 }
      ],
      requirements: []
    });
  };

  const addRequirement = () => {
    const newReq: CatalogRequirement = {
      id: crypto.randomUUID(),
      label: '',
      type: 'text',
      required: true,
      placeholder: ''
    };
    setFormData(prev => ({
      ...prev,
      requirements: [...(prev.requirements || []), newReq]
    }));
  };

  const removeRequirement = (id: string) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements?.filter(r => r.id !== id)
    }));
  };

  const updateRequirement = (id: string, updates: Partial<CatalogRequirement>) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements?.map(r => r.id === id ? { ...r, ...updates } : r)
    }));
  };

  const updateTier = (priority: string, updates: Partial<PricingTier>) => {
    setFormData(prev => ({
      ...prev,
      pricingTiers: prev.pricingTiers?.map(t => t.priority === priority ? { ...t, ...updates } : t)
    }));
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Service Catalog Manager</h2>
          <p className="text-slate-500 mt-1 font-medium">Define services, requirements, and pricing tiers.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus size={20} />
          Create New Service
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm font-medium">Loading catalog...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Settings size={24} />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={async () => { if(confirm('Delete this service?')) await deleteDoc(doc(db, 'catalog', item.id)); }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900">{item.name}</h3>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.description}</p>
              
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Base Price</span>
                  <span className="font-bold text-slate-900">${item.basePrice}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Requirements</span>
                  <span className="font-bold text-slate-900">{item.requirements?.length || 0} fields</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                    item.isActive ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-400 border border-slate-200"
                  )}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Service" : "Create New Service"}
        maxWidth="4xl"
      >
        <form onSubmit={handleSave} className="space-y-8 p-1">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Service Name</label>
              <input 
                required
                type="text"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Category</label>
              <input 
                required
                type="text"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Description</label>
            <textarea 
              required
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <DollarSign size={20} className="text-indigo-600" />
                Pricing Tiers (Priority Slaps)
              </h4>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {formData.pricingTiers?.map(tier => (
                <div key={tier.priority} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="font-bold text-slate-900">{tier.priority}</div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Price ($)</label>
                    <input 
                      type="number"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={tier.price}
                      onChange={e => updateTier(tier.priority, { price: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Est. Days</label>
                    <input 
                      type="number"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={tier.estimatedDays}
                      onChange={e => updateTier(tier.priority, { estimatedDays: Number(e.target.value) })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layout size={20} className="text-indigo-600" />
                Requirements Form Elements
              </h4>
              <button 
                type="button"
                onClick={addRequirement}
                className="text-indigo-600 hover:text-indigo-700 font-bold text-sm flex items-center gap-1"
              >
                <PlusCircle size={18} />
                Add Field
              </button>
            </div>
            
            <div className="space-y-3">
              {formData.requirements?.map((req, index) => (
                <div key={req.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="mt-2 text-slate-300">
                    <GripVertical size={20} />
                  </div>
                  <div className="flex-1 grid grid-cols-12 gap-4">
                    <div className="col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Field Label</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={req.label}
                        onChange={e => updateRequirement(req.id, { label: e.target.value })}
                        placeholder="e.g. Website URL"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                      <select 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={req.type}
                        onChange={e => updateRequirement(req.id, { type: e.target.value as any })}
                      >
                        <option value="text">Short Text</option>
                        <option value="textarea">Long Text</option>
                        <option value="select">Dropdown</option>
                        <option value="file">File Upload</option>
                        <option value="date">Date</option>
                        <option value="number">Number</option>
                      </select>
                    </div>
                    <div className="col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Options (for Dropdown)</label>
                      <input 
                        disabled={req.type !== 'select'}
                        type="text"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                        value={req.options?.join(', ') || ''}
                        onChange={e => updateRequirement(req.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                        placeholder="Option 1, Option 2"
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center pt-6">
                      <input 
                        type="checkbox"
                        checked={req.required}
                        onChange={e => updateRequirement(req.id, { required: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="col-span-1 pt-6">
                      <button 
                        type="button"
                        onClick={() => removeRequirement(req.id)}
                        className="text-rose-500 hover:text-rose-600 transition-all"
                      >
                        <MinusCircle size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {(!formData.requirements || formData.requirements.length === 0) && (
                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-400">No requirements defined. Click "Add Field" to start.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="isActive" className="text-sm font-bold text-slate-700">Active in Catalog</label>
            </div>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-indigo-600 text-white px-10 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {editingItem ? 'Update Service' : 'Create Service'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
