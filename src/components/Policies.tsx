import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  ChevronRight, 
  Clock, 
  User, 
  Tag,
  Edit2,
  Trash2,
  Loader2,
  FileText,
  Shield,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Policy, User as UserType } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDocs, where } from 'firebase/firestore';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import { cn } from '../lib/utils';
import { HANDBOOK_CONTENT } from '../constants/policies';
import { geminiService } from '../services/geminiService';
import { Sparkles } from 'lucide-react';

interface PoliciesProps {
  currentUser: UserType | null;
}

export const Policies: React.FC<PoliciesProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'handbook' | 'updates'>('handbook');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [activeHandbookSection, setActiveHandbookSection] = useState(HANDBOOK_CONTENT[0].id);
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'General' as Policy['category']
  });

  const categories = ['All', 'General', 'Financial', 'Technical'];

  useEffect(() => {
    const q = query(collection(db, 'policies'), orderBy('lastUpdated', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const policyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastUpdated: doc.data().lastUpdated?.toDate()?.toISOString() || new Date().toISOString()
      })) as Policy[];
      setPolicies(policyData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'policies');
    });

    return () => unsubscribe();
  }, []);

  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = policy.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         policy.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || policy.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const handleAiGeneratePolicy = async () => {
    if (!formData.title) return;
    setIsAiGenerating(true);
    const content = await geminiService.generatePolicy(formData.title, formData.category);
    if (content) {
      setFormData(prev => ({ ...prev, content }));
    }
    setIsAiGenerating(false);
  };

  const handleSeedPolicies = async () => {
    const defaultPolicies = [
      { title: 'Employee ID Policy', content: 'Employee IDs are automatically generated in the format Emp-001, Emp-002, etc. based on the total count of staff members. This ID is unique and used for all internal tracking.', category: 'General' },
      { title: 'CNIC Verification Policy', content: 'CNIC must be a valid 13-digit number (format: XXXXX-XXXXXXX-X). It is required for payroll and legal compliance. Each CNIC must be unique in the directory.', category: 'General' },
      { title: 'Client Registration Policy', content: 'All clients must be registered with their full legal name or business name. This ensures accurate invoicing and communication.', category: 'General' },
      { title: 'Client Communication Policy', content: 'Official communication with clients should primarily happen via the registered email address. Ensure the email is active and monitored.', category: 'General' }
    ];

    for (const p of defaultPolicies) {
      const q = query(collection(db, 'policies'), where('title', '==', p.title));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        await addDoc(collection(db, 'policies'), {
          ...p,
          lastUpdated: serverTimestamp(),
          updatedBy: 'System Seed'
        });
      }
    }
    alert('Help policies seeded successfully!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      if (editingPolicy) {
        await updateDoc(doc(db, 'policies', editingPolicy.id), {
          ...formData,
          lastUpdated: serverTimestamp(),
          updatedBy: currentUser.name
        });
      } else {
        await addDoc(collection(db, 'policies'), {
          ...formData,
          lastUpdated: serverTimestamp(),
          updatedBy: currentUser.name
        });
      }
      setIsModalOpen(false);
      setEditingPolicy(null);
      setFormData({ title: '', content: '', category: 'General' });
    } catch (error) {
      handleFirestoreError(error, editingPolicy ? OperationType.UPDATE : OperationType.CREATE, 'policies');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'policies', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'policies');
    }
  };

  const canManage = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const currentHandbookSection = HANDBOOK_CONTENT.find(s => s.id === activeHandbookSection);

  return (
    <div className="p-8 space-y-6">
      <ConfirmModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Delete Policy"
        message="Are you sure you want to delete this policy? This action cannot be undone."
      />
      
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Policies & Guidelines</h2>
          <p className="text-slate-500 mt-1">Access company handbook, CRM policies, and internal updates.</p>
        </div>
        {activeTab === 'updates' && canManage && (
          <div className="flex gap-2">
            <button 
              onClick={handleSeedPolicies}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Sparkles size={20} />
              Seed Help Policies
            </button>
            <button 
              onClick={() => {
                setEditingPolicy(null);
                setFormData({ title: '', content: '', category: 'General' });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              <Plus size={20} />
              Add Policy
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('handbook')}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'handbook' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <BookOpen size={18} />
          Company Handbook
        </button>
        <button
          onClick={() => setActiveTab('updates')}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'updates' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <FileText size={18} />
          Internal Updates
        </button>
      </div>

      {activeTab === 'handbook' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-1">
            {HANDBOOK_CONTENT.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveHandbookSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group",
                    activeHandbookSection === section.id
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                      : "hover:bg-white hover:shadow-sm text-slate-600"
                  )}
                >
                  <Icon size={18} className={cn(
                    activeHandbookSection === section.id ? "text-white" : "text-slate-400 group-hover:text-indigo-600"
                  )} />
                  <span className="text-sm font-bold truncate">{section.title.split('. ')[1] || section.title}</span>
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeHandbookSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
              >
                <div className="p-8 border-b border-slate-50 bg-slate-50/50">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                      {currentHandbookSection && <currentHandbookSection.icon size={24} />}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">{currentHandbookSection?.title}</h3>
                  </div>
                </div>
                
                <div className="p-8 space-y-8">
                  {currentHandbookSection?.content && (
                    <div className="prose prose-slate max-w-none">
                      <p className="text-slate-600 leading-relaxed whitespace-pre-wrap text-lg">
                        {currentHandbookSection.content}
                      </p>
                    </div>
                  )}

                  {currentHandbookSection?.subsections && (
                    <div className="grid gap-6">
                      {currentHandbookSection.subsections.map((sub, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                          <h4 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                            {sub.title}
                          </h4>
                          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                            {sub.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Search updates..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={searchQuery || ''}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                    selectedCategory === cat 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-sm font-medium">Loading updates...</p>
              </div>
            ) : filteredPolicies.length > 0 ? (
              filteredPolicies.map((policy) => (
                <motion.div
                  layout
                  key={policy.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col"
                >
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <BookOpen size={20} />
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                        policy.category === 'General' ? "bg-blue-50 text-blue-600" :
                        policy.category === 'Financial' ? "bg-amber-50 text-amber-600" :
                        "bg-purple-50 text-purple-600"
                      )}>
                        {policy.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                      {policy.title}
                    </h3>
                    <p className="text-slate-600 text-sm line-clamp-3 mb-4 whitespace-pre-wrap">
                      {policy.content}
                    </p>
                  </div>
                  <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 rounded-b-2xl flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                        <Clock size={12} />
                        {new Date(policy.lastUpdated).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                        <User size={12} />
                        {policy.updatedBy}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canManage && (
                        <>
                          <button 
                            onClick={() => {
                              setEditingPolicy(policy);
                              setFormData({
                                title: policy.title,
                                content: policy.content,
                                category: policy.category
                              });
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-sm"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => setConfirmDelete(policy.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all shadow-sm"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => {
                          setEditingPolicy(policy);
                          setFormData({
                            title: policy.title,
                            content: policy.content,
                            category: policy.category
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-sm"
                        title="View Details"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-20 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                <BookOpen size={48} className="mb-4 opacity-20" />
                <p className="font-medium">No updates found matching your search.</p>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPolicy ? "Edit Policy" : "Add New Policy"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Policy Title</label>
            <input 
              required
              type="text"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. Article Submission Guidelines"
              value={formData.title || ''}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Category</label>
            <select
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={formData.category || ''}
              onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as Policy['category'] }))}
            >
              {categories.filter(c => c !== 'All').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">Content</label>
              <button
                type="button"
                onClick={handleAiGeneratePolicy}
                disabled={isAiGenerating || !formData.title}
                className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-700 disabled:opacity-50"
              >
                <Sparkles size={10} />
                AI Generate
              </button>
            </div>
            <textarea 
              required
              rows={8}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
              placeholder="Write the policy content here..."
              value={formData.content || ''}
              onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
            />
          </div>
          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              {editingPolicy ? "Update Policy" : "Save Policy"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
