import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  Trash, 
  Search, 
  Filter, 
  Calendar,
  User,
  Clock,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, addDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { TrashItem } from '../types';
import { toast } from 'react-hot-toast';

export const TrashManagement: React.FC = () => {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'trash'), orderBy('deletedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const trashData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrashItem[];
      setItems(trashData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trash');
    });

    return () => unsubscribe();
  }, []);

  const handleRestore = async (item: TrashItem) => {
    try {
      // 1. Add back to original collection
      const originalId = item.data.id;
      if (originalId) {
        const { id, ...restData } = item.data;
        await setDoc(doc(db, item.originalCollection, originalId), {
          ...restData,
          restoredAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, item.originalCollection), {
          ...item.data,
          restoredAt: serverTimestamp()
        });
      }
      // 2. Delete from trash
      await deleteDoc(doc(db, 'trash', item.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'restore');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'trash', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'trash');
    }
  };

  const filteredItems = items.filter(item => 
    item.originalCollection.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.data.name && item.data.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.data.title && item.data.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDeletedAt = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Trash Management</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Review and restore soft-deleted items. Items are permanently deleted after 30 days.</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 text-sm font-bold">
          <AlertTriangle size={18} />
          Auto-cleanup enabled
        </div>
        <button
          onClick={async () => {
            if (!confirm("Are you sure you want to permanently delete ALL items in the trash? This cannot be undone.")) return;
            const loadingToast = toast.loading("Emptying trash...");
            try {
              for (const item of items) {
                await deleteDoc(doc(db, 'trash', item.id));
              }
              toast.success("Trash emptied successfully.", { id: loadingToast });
            } catch (error) {
              console.error("Empty trash error:", error);
              toast.error("Failed to empty trash.", { id: loadingToast });
            }
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
        >
          <Trash2 size={20} />
          Empty Trash
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search deleted items..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Item Details</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Original Collection</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Deleted By</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Deleted At</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Loader2 className="animate-spin" size={32} />
                      <p className="text-sm font-medium">Loading trash...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Trash2 size={32} />
                      <p className="text-sm font-medium">Trash is empty</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{item.data.name || item.data.title || 'Untitled Item'}</span>
                        <span className="text-xs text-slate-500 truncate max-w-xs">{JSON.stringify(item.data).substring(0, 50)}...</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        {item.originalCollection}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <User size={14} className="text-slate-400" />
                        <span className="text-sm">{item.deletedBy}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock size={14} className="text-slate-400" />
                        <span className="text-sm">{formatDeletedAt(item.deletedAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => handleRestore(item)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all text-xs font-bold"
                        >
                          <RotateCcw size={14} />
                          Restore
                        </button>
                        <button 
                          onClick={() => handlePermanentDelete(item.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash size={18} />
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
    </div>
  );
};
