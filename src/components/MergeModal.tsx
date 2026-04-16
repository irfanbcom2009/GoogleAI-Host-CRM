import React, { useState, useEffect } from 'react';
import { 
  GitMerge, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  Search,
  Loader2,
  User,
  BookOpen,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';

interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'clients' | 'journals' | 'domains' | 'employees';
  initialSourceItem?: any;
  onSuccess?: () => void;
}

export const MergeModal: React.FC<MergeModalProps> = ({ 
  isOpen, 
  onClose, 
  type, 
  initialSourceItem,
  onSuccess 
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sourceItem, setSourceItem] = useState<any>(initialSourceItem || null);
  const [targetItem, setTargetItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSourceItem) {
      setSourceItem(initialSourceItem);
      setStep(2);
    }
  }, [initialSourceItem]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const collectionName = (type === 'clients' || type === 'employees') ? 'users' : type;
      const q = query(
        collection(db, collectionName),
        where(type === 'clients' ? 'role' : (type === 'employees' ? 'role' : 'status'), '!=', 'deleted') // Basic filter
      );
      
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((item: any) => {
          if (type === 'clients' && item.role !== 'Client') return false;
          if (type === 'employees' && !['Employee', 'Manager'].includes(item.role)) return false;
          if (sourceItem && item.id === sourceItem.id) return false;
          
          const searchLower = searchQuery.toLowerCase();
          if (type === 'clients' || type === 'employees') {
            return item.name?.toLowerCase().includes(searchLower) || item.email?.toLowerCase().includes(searchLower);
          } else if (type === 'journals') {
            return item.title?.toLowerCase().includes(searchLower) || item.issnPrint?.includes(searchQuery);
          } else {
            return item.domainName?.toLowerCase().includes(searchLower);
          }
        });
      
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search items.');
    } finally {
      setLoading(false);
    }
  };

  const executeMerge = async () => {
    if (!sourceItem || !targetItem) return;
    setMerging(true);
    setError(null);
    
    const batch = writeBatch(db);
    
    try {
      if (type === 'clients') {
        // Transfer Journals
        const journalsQ = query(collection(db, 'journals'), where('clientId', '==', sourceItem.id));
        const journalsSnap = await getDocs(journalsQ);
        journalsSnap.forEach(d => {
          batch.update(d.ref, { clientId: targetItem.id, clientName: targetItem.name });
        });

        // Transfer Domains
        const domainsQ = query(collection(db, 'domains'), where('clientId', '==', sourceItem.id));
        const domainsSnap = await getDocs(domainsQ);
        domainsSnap.forEach(d => {
          batch.update(d.ref, { clientId: targetItem.id, clientName: targetItem.name });
        });

        // Transfer Tasks
        const tasksQ = query(collection(db, 'tasks'), where('clientId', '==', sourceItem.id));
        const tasksSnap = await getDocs(tasksQ);
        tasksSnap.forEach(d => {
          batch.update(d.ref, { clientId: targetItem.id, clientName: targetItem.name });
        });

        // Transfer Invoices
        const invoicesQ = query(collection(db, 'invoices'), where('clientId', '==', sourceItem.id));
        const invoicesSnap = await getDocs(invoicesQ);
        invoicesSnap.forEach(d => {
          batch.update(d.ref, { clientId: targetItem.id, clientName: targetItem.name });
        });

        // Merge Points
        const totalPoints = (targetItem.points || 0) + (sourceItem.points || 0);
        batch.update(doc(db, 'users', targetItem.id), { points: totalPoints });

        // Delete Source Client
        batch.delete(doc(db, 'users', sourceItem.id));
      } 
      else if (type === 'employees') {
        // Transfer Tasks
        const tasksQ = query(collection(db, 'tasks'), where('assignedTo', '==', sourceItem.id));
        const tasksSnap = await getDocs(tasksQ);
        tasksSnap.forEach(d => {
          batch.update(d.ref, { assignedTo: targetItem.id });
        });

        // Transfer Journal Assignments
        const journalsQ = query(collection(db, 'journals'), where('assignedEmployeeId', '==', sourceItem.id));
        const journalsSnap = await getDocs(journalsQ);
        journalsSnap.forEach(d => {
          batch.update(d.ref, { assignedEmployeeId: targetItem.id });
        });

        // Merge Points
        const totalPoints = (targetItem.points || 0) + (sourceItem.points || 0);
        batch.update(doc(db, 'users', targetItem.id), { points: totalPoints });

        // Delete Source Employee
        batch.delete(doc(db, 'users', sourceItem.id));
      }
      else if (type === 'journals') {
        // Transfer Tasks
        const tasksQ = query(collection(db, 'tasks'), where('journalId', '==', sourceItem.id));
        const tasksSnap = await getDocs(tasksQ);
        tasksSnap.forEach(d => {
          batch.update(d.ref, { journalId: targetItem.id, journalTitle: targetItem.title });
        });

        // Transfer Invoices
        const invoicesQ = query(collection(db, 'invoices'), where('journalId', '==', sourceItem.id));
        const invoicesSnap = await getDocs(invoicesQ);
        invoicesSnap.forEach(d => {
          batch.update(d.ref, { journalId: targetItem.id, journalTitle: targetItem.title });
        });

        // Transfer Indexing
        const indexingQ = query(collection(db, 'journalIndexing'), where('journalId', '==', sourceItem.id));
        const indexingSnap = await getDocs(indexingQ);
        indexingSnap.forEach(d => {
          batch.update(d.ref, { journalId: targetItem.id });
        });

        // Delete Source Journal
        batch.delete(doc(db, 'journals', sourceItem.id));
      }
      else if (type === 'domains') {
        // Transfer Journals
        const journalsQ = query(collection(db, 'journals'), where('domainId', '==', sourceItem.id));
        const journalsSnap = await getDocs(journalsQ);
        journalsSnap.forEach(d => {
          batch.update(d.ref, { domainId: targetItem.id });
        });

        // Delete Source Domain
        batch.delete(doc(db, 'domains', sourceItem.id));
      }

      await batch.commit();
      setStep(3);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Merge error:', err);
      setError('An error occurred during the merge process.');
    } finally {
      setMerging(false);
    }
  };

  const renderItemCard = (item: any, isTarget: boolean = false) => {
    const Icon = (type === 'clients' || type === 'employees') ? User : type === 'journals' ? BookOpen : Globe;
    const name = (type === 'clients' || type === 'employees') ? item.name : type === 'journals' ? item.title : item.domainName;
    const sub = (type === 'clients' || type === 'employees') ? item.email : type === 'journals' ? item.issnPrint : item.registrar;

    return (
      <div className={cn(
        "p-4 rounded-2xl border transition-all",
        isTarget ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-200"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            isTarget ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
          )}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{name}</p>
            <p className="text-xs text-slate-500 truncate">{sub}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                  <GitMerge size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Merge {type.charAt(0).toUpperCase() + type.slice(1)}</h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="p-8">
              {step === 1 && (
                <div className="space-y-6">
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                    <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
                    <p className="text-sm text-amber-800 font-medium">
                      Select the <span className="font-bold">Source</span> item. This item will be deleted, and all its data will be moved to the target.
                    </p>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="text"
                      placeholder={`Search ${type} to merge...`}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <button 
                      onClick={handleSearch}
                      disabled={loading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={16} /> : 'Search'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {searchResults.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSourceItem(item);
                          setStep(2);
                          setSearchResults([]);
                          setSearchQuery('');
                        }}
                        className="w-full text-left"
                      >
                        {renderItemCard(item)}
                      </button>
                    ))}
                    {searchResults.length === 0 && searchQuery && !loading && (
                      <p className="text-center py-8 text-slate-400 font-medium">No results found</p>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Source (Delete)</p>
                      {renderItemCard(sourceItem)}
                    </div>
                    <ArrowRight className="text-slate-300 mt-6" size={24} />
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-center">Target (Keep)</p>
                      {targetItem ? renderItemCard(targetItem, true) : (
                        <div className="h-[74px] border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 text-xs font-medium">
                          Select Target
                        </div>
                      )}
                    </div>
                  </div>

                  {!targetItem ? (
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                          type="text"
                          placeholder={`Search target ${type}...`}
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                        <button 
                          onClick={handleSearch}
                          disabled={loading}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="animate-spin" size={16} /> : 'Search'}
                        </button>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {searchResults.map(item => (
                          <button
                            key={item.id}
                            onClick={() => setTargetItem(item)}
                            className="w-full text-left"
                          >
                            {renderItemCard(item)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3">
                        <AlertTriangle className="text-rose-600 flex-shrink-0" size={20} />
                        <p className="text-xs text-rose-800 font-medium">
                          Warning: This action is irreversible. All data from <span className="font-bold">{type === 'clients' ? sourceItem.name : type === 'journals' ? sourceItem.title : sourceItem.domainName}</span> will be moved to <span className="font-bold">{type === 'clients' ? targetItem.name : type === 'journals' ? targetItem.title : targetItem.domainName}</span> and the source will be permanently deleted.
                        </p>
                      </div>
                      
                      <div className="flex gap-3">
                        <button 
                          onClick={() => setTargetItem(null)}
                          className="flex-1 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                        >
                          Change Target
                        </button>
                        <button 
                          onClick={executeMerge}
                          disabled={merging}
                          className="flex-[2] px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                        >
                          {merging ? <Loader2 className="animate-spin" size={20} /> : <GitMerge size={20} />}
                          Confirm Merge
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="text-center py-8 space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={40} />
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-slate-900">Merge Successful!</h4>
                    <p className="text-slate-500 mt-2">All data has been transferred and the source item has been removed.</p>
                  </div>
                  <button 
                    onClick={onClose}
                    className="w-full px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                  >
                    Close
                  </button>
                </div>
              )}

              {error && (
                <p className="mt-4 text-center text-sm font-bold text-rose-600">{error}</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
