import React, { useState, useEffect } from 'react';
import { 
  History, 
  Plus, 
  Trash2, 
  Edit, 
  Clock, 
  Activity, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Save,
  GraduationCap,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { GoogleScholarHistory, User as UserType } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { Modal } from './Modal';

interface ScholarHistoryProps {
  journalId: string;
  currentUser: UserType | null;
}

export const ScholarHistory: React.FC<ScholarHistoryProps> = ({ journalId, currentUser }) => {
  const [history, setHistory] = useState<GoogleScholarHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GoogleScholarHistory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Pagination
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Form state
  const [formData, setFormData] = useState({
    status: 'Indexed' as 'Indexed' | 'Not Indexed',
    date: new Date().toISOString().split('T')[0],
    lastAction: '',
    resultsAdded: ''
  });

  useEffect(() => {
    if (!journalId) return;

    const unsub = onSnapshot(
      query(collection(db, 'google_scholar_history'), where('journalId', '==', journalId), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GoogleScholarHistory)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'google_scholar_history')
    );

    return () => unsub();
  }, [journalId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || isSaving) return;

    setIsSaving(true);
    try {
      if (isEditing && selectedEntry) {
        await updateDoc(doc(db, 'google_scholar_history', selectedEntry.id), {
          ...formData,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name
        });
        toast.success('History entry updated');
      } else {
        await addDoc(collection(db, 'google_scholar_history'), {
          journalId,
          ...formData,
          createdAt: new Date().toISOString(),
          createdById: currentUser.id,
          employeeName: currentUser.name,
          timestamp: serverTimestamp()
        });
        toast.success('History entry logged');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'google_scholar_history');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this entry?')) return;
    try {
      await deleteDoc(doc(db, 'google_scholar_history', id));
      toast.success('Entry removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'google_scholar_history');
    }
  };

  const resetForm = () => {
    setFormData({
      status: 'Indexed',
      date: new Date().toISOString().split('T')[0],
      lastAction: '',
      resultsAdded: ''
    });
    setIsEditing(false);
    setSelectedEntry(null);
  };

  const totalPages = Math.ceil(history.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedHistory = history.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <GraduationCap size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Academic Indexing Journal</span>
          </div>
          <h3 className="text-xl font-black text-slate-900">Scholar Visibility History</h3>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[5, 10, 20].map((size) => (
              <button
                key={size}
                onClick={() => { setItemsPerPage(size); setCurrentPage(1); }}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-black transition-all",
                  itemsPerPage === size ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {size}
              </button>
            ))}
          </div>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
          >
            <Plus size={18} />
            Log Evolution
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Visibility Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Delta / Action</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Metadata Added</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedHistory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                        item.status === 'Indexed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        <Activity size={16} />
                      </div>
                      <span className={cn(
                        "text-xs font-black uppercase tracking-wider",
                        item.status === 'Indexed' ? "text-emerald-700" : "text-amber-700"
                      )}>
                        {item.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      {item.date}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-600 line-clamp-1">{item.lastAction || 'No action recorded'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-indigo-400" />
                      <span className="text-xs font-black text-indigo-600 italic">+{item.resultsAdded || '0'} Items</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setSelectedEntry(item);
                          setFormData({
                            status: item.status,
                            date: item.date,
                            lastAction: item.lastAction || '',
                            resultsAdded: item.resultsAdded || ''
                          });
                          setIsEditing(true);
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <History className="mx-auto text-slate-200 mb-4" size={48} />
                    <p className="text-sm font-bold text-slate-400 italic font-medium">No visibility records found for this journal.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, history.length)} of {history.length} Entries
            </p>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50 transition-all shadow-sm"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50 hover:bg-slate-50 transition-all shadow-sm"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Modify visibility Entry' : 'Log scholar visibility Evolution'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visibility Status</label>
              <div className="flex gap-2">
                {['Indexed', 'Not Indexed'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status: status as any }))}
                    className={cn(
                      "flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
                      formData.status === status 
                        ? (status === 'Indexed' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-amber-600 text-white shadow-lg shadow-amber-100")
                        : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Date</label>
              <input 
                type="date"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                value={formData.date || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Latest Action / Delta</label>
            <textarea 
              rows={3}
              required
              placeholder="e.g. Added metadata, updated tags, submitted request..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium resize-none"
              value={formData.lastAction || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, lastAction: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Results/Metadata Count</label>
            <div className="relative">
              <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={18} />
              <input 
                type="text"
                placeholder="e.g. 5 articles, 12 citations"
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-600"
                value={formData.resultsAdded || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, resultsAdded: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <Clock className="animate-spin" size={20} /> : <Save size={20} />}
              {isEditing ? 'Commit Changes' : 'Log Evolution'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
