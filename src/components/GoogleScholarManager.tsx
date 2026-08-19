import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  History, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Activity, 
  BarChart,
  Loader2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Journal, GoogleScholarHistory } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface GoogleScholarManagerProps {
  journal: Journal;
  onClose: () => void;
}

export const GoogleScholarManager: React.FC<GoogleScholarManagerProps> = ({ journal, onClose }) => {
  const [history, setHistory] = useState<GoogleScholarHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [newEntry, setNewEntry] = useState({
    status: 'Not Indexed' as GoogleScholarHistory['status'],
    date: new Date().toISOString().split('T')[0],
    lastAction: '',
    resultsAdded: ''
  });

  useEffect(() => {
    const q = query(
      collection(db, 'google_scholar_history'), 
      where('journalId', '==', journal.id),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GoogleScholarHistory[];
      setHistory(historyData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'google_scholar_history');
    });

    return () => unsubscribe();
  }, [journal.id]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'google_scholar_history'), {
        journalId: journal.id,
        ...newEntry,
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setNewEntry({
        status: 'Not Indexed',
        date: new Date().toISOString().split('T')[0],
        lastAction: '',
        resultsAdded: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'google_scholar_history');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this history entry?')) return;
    try {
      await deleteDoc(doc(db, 'google_scholar_history', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'google_scholar_history');
    }
  };

  const totalPages = Math.ceil(history.length / pageSize);
  const paginatedHistory = history.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{journal.title}</h3>
          <p className="text-sm text-slate-500">Google Scholar Indexing History</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Per Page:</span>
            <select 
              className="bg-transparent text-xs font-bold outline-none"
              value={pageSize || ''}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-all text-sm"
          >
            {isAdding ? 'Cancel' : <><Plus size={18} /> Add Record</>}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddEntry} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Indexing Status</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newEntry.status || 'Not Indexed'}
                    onChange={e => setNewEntry(prev => ({ ...prev, status: e.target.value as GoogleScholarHistory['status'] }))}
                  >
                    <option value="Not Indexed">Not Indexed</option>
                    <option value="Indexed">Indexed</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Date</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newEntry.date || ''}
                    onChange={e => setNewEntry(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Last Action Performed</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. Submitted sitemap to Google Search Console"
                  value={newEntry.lastAction || ''}
                  onChange={e => setNewEntry(prev => ({ ...prev, lastAction: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Results Added / Findings</label>
                <textarea 
                  rows={2}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. 15 new articles indexed, total 145"
                  value={newEntry.resultsAdded || ''}
                  onChange={e => setNewEntry(prev => ({ ...prev, resultsAdded: e.target.value }))}
                />
              </div>
              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <History size={18} />}
                  Add Scholar History Log
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="animate-spin" size={24} />
              <p className="text-xs font-medium">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <History size={32} />
              <p className="text-xs font-medium">No history records found.</p>
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                  <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Last Action</th>
                    <th className="px-6 py-4">Results</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                          entry.status === 'Indexed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                        )}>
                          {entry.status === 'Indexed' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                          <Calendar size={14} className="text-slate-400" />
                          {new Date(entry.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Activity size={14} className="text-slate-400" />
                          {entry.lastAction || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <BarChart size={14} className="text-slate-400" />
                          {entry.resultsAdded || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {history.length > pageSize && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Showing {paginatedHistory.length} of {history.length} Entries
                  </p>
                  <div className="flex gap-2">
                    <button 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      Prev
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                      <button 
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={cn(
                          "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                          currentPage === i + 1 ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white border border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
