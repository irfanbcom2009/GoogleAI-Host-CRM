import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Columns,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  where
} from 'firebase/firestore';
import { HECCategory, HECCategoryType, User } from '../types';
import { cn } from '../lib/utils';

interface HECCategorySettingsProps {
  currentUser: User;
}

export const HECCategorySettings: React.FC<HECCategorySettingsProps> = ({ currentUser }) => {
  const [categories, setCategories] = useState<HECCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<HECCategoryType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<HECCategory | null>(null);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(['name', 'type', 'parent', 'status', 'actions']);

  const [formData, setFormData] = useState({
    name: '',
    type: 'main' as HECCategoryType,
    parentId: '',
    isActive: true
  });

  useEffect(() => {
    const q = query(collection(db, 'hec_categories'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HECCategory));
      setCategories(cats);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'hec_categories');
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async () => {
    if (!formData.name) return;

    // Check for duplicates under same parent
    const duplicate = categories.find(c => 
      c.name.toLowerCase() === formData.name.toLowerCase() && 
      c.type === formData.type && 
      c.parentId === formData.parentId
    );

    if (duplicate) {
      alert('A category with this name already exists under the selected parent.');
      return;
    }

    try {
      await addDoc(collection(db, 'hec_categories'), {
        ...formData,
        createdAt: serverTimestamp(),
        createdById: currentUser.id,
        createdBy: currentUser.name
      });
      setShowAddModal(false);
      setFormData({ name: '', type: 'main', parentId: '', isActive: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'hec_categories');
    }
  };

  const handleUpdate = async () => {
    if (!editingCategory || !formData.name) return;

    try {
      await updateDoc(doc(db, 'hec_categories', editingCategory.id), {
        ...formData,
        updatedAt: serverTimestamp(),
        updatedById: currentUser.id,
        updatedBy: currentUser.name
      });
      setEditingCategory(null);
      setFormData({ name: '', type: 'main', parentId: '', isActive: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hec_categories');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category? This will not delete children but they will lose their parent reference.')) return;

    try {
      await deleteDoc(doc(db, 'hec_categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'hec_categories');
    }
  };

  const toggleStatus = async (category: HECCategory) => {
    try {
      await updateDoc(doc(db, 'hec_categories', category.id), {
        isActive: !category.isActive,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hec_categories');
    }
  };

  const filteredCategories = categories.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || cat.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' ? cat.isActive : !cat.isActive);
    return matchesSearch && matchesType && matchesStatus;
  });

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = categories.find(c => c.id === parentId);
    return parent ? parent.name : 'Unknown';
  };

  const mainCategories = categories.filter(c => c.type === 'main' && c.isActive);
  const subCategories = categories.filter(c => c.type === 'sub' && c.isActive);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search categories..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select 
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="all">All Types</option>
              <option value="main">Main Category</option>
              <option value="sub">Sub Category</option>
              <option value="subject">Subject Category</option>
            </select>
            <select 
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="all">All Status</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowColumnSelector(!showColumnSelector)}
            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
            title="Column Selection"
          >
            <Columns size={20} />
          </button>
          <button 
            onClick={() => {
              setEditingCategory(null);
              setFormData({ name: '', type: 'main', parentId: '', isActive: true });
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            Add Category
          </button>
        </div>
      </div>

      {showColumnSelector && (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap gap-4">
          <span className="text-sm font-bold text-slate-700 w-full mb-2">Visible Columns:</span>
          {['name', 'type', 'parent', 'status', 'actions'].map(col => (
            <label key={col} className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox"
                checked={visibleColumns.includes(col)}
                onChange={(e) => {
                  if (e.target.checked) setVisibleColumns([...visibleColumns, col]);
                  else setVisibleColumns(visibleColumns.filter(c => c !== col));
                }}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm capitalize">{col}</span>
            </label>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-100">
              {visibleColumns.includes('name') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Category Name</th>}
              {visibleColumns.includes('type') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>}
              {visibleColumns.includes('parent') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Parent</th>}
              {visibleColumns.includes('status') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>}
              {visibleColumns.includes('actions') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Loading categories...</p>
                  </div>
                </td>
              </tr>
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <p className="text-slate-500">No categories found matching your criteria.</p>
                </td>
              </tr>
            ) : (
              filteredCategories.map(cat => (
                <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors group">
                  {visibleColumns.includes('name') && (
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                    </td>
                  )}
                  {visibleColumns.includes('type') && (
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                        cat.type === 'main' ? "bg-indigo-50 text-indigo-600" :
                        cat.type === 'sub' ? "bg-emerald-50 text-emerald-600" :
                        "bg-amber-50 text-amber-600"
                      )}>
                        {cat.type}
                      </span>
                    </td>
                  )}
                  {visibleColumns.includes('parent') && (
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500">{getParentName(cat.parentId)}</span>
                    </td>
                  )}
                  {visibleColumns.includes('status') && (
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleStatus(cat)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all",
                          cat.isActive 
                            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" 
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        {cat.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  )}
                  {visibleColumns.includes('actions') && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => {
                            setEditingCategory(cat);
                            setFormData({
                              name: cat.name,
                              type: cat.type,
                              parentId: cat.parentId || '',
                              isActive: cat.isActive
                            });
                            setShowAddModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(cat.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                >
                  <MoreVertical size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Category Name</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter category name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Category Type</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as HECCategoryType, parentId: '' })}
                  >
                    <option value="main">Main Category</option>
                    <option value="sub">Sub Category</option>
                    <option value="subject">Subject Category</option>
                  </select>
                </div>

                {formData.type !== 'main' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      {formData.type === 'sub' ? 'Parent Main Category' : 'Parent Sub Category'}
                    </label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={formData.parentId}
                      onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                      required
                    >
                      <option value="">Select Parent</option>
                      {formData.type === 'sub' ? (
                        mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                      ) : (
                        subCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                      )}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      formData.isActive ? "bg-indigo-600" : "bg-slate-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      formData.isActive ? "right-1" : "left-1"
                    )} />
                  </button>
                  <span className="text-sm font-medium text-slate-700">Active Status</span>
                </div>
              </div>
              <div className="p-6 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={editingCategory ? handleUpdate : handleAdd}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                >
                  {editingCategory ? 'Update' : 'Add Category'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
