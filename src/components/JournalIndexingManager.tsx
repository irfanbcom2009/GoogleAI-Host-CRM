import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  ExternalLink, 
  Search, 
  Link as LinkIcon, 
  Building2,
  Globe,
  Loader2,
  X,
  ArrowRight,
  Trash2,
  Calendar,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Journal, IndexingAgency, JournalIndexing, IndexingStatus, User as UserType } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, updateDoc, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { cn, sanitizeUrl } from '../lib/utils';
import { Modal } from './Modal';
import { usePermissions } from '../hooks/usePermissions';

interface JournalIndexingManagerProps {
  journal: Journal;
  onClose: () => void;
  currentUser: UserType | null;
}

export const JournalIndexingManager: React.FC<JournalIndexingManagerProps> = ({ journal, onClose, currentUser }) => {
  const { check } = usePermissions(currentUser);
  const [agencies, setAgencies] = useState<IndexingAgency[]>([]);
  const [journalIndexing, setJournalIndexing] = useState<JournalIndexing[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  
  // Selected items for modals
  const [selectedAgency, setSelectedAgency] = useState<IndexingAgency | null>(null);
  const [selectedIndexing, setSelectedIndexing] = useState<JournalIndexing | null>(null);
  
  // Form inputs
  const [applyDate, setApplyDate] = useState(new Date().toISOString().split('T')[0]);
  const [liveLink, setLiveLink] = useState('');

  useEffect(() => {
    // Fetch all agencies
    const unsubAgencies = onSnapshot(collection(db, 'indexing_agencies'), (snapshot) => {
      setAgencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IndexingAgency)));
    });

    // Fetch indexing status for this journal
    const q = query(collection(db, 'journal_indexing'), where('journalId', '==', journal.id));
    const unsubIndexing = onSnapshot(q, (snapshot) => {
      setJournalIndexing(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalIndexing)));
      setLoading(false);
    });

    return () => {
      unsubAgencies();
      unsubIndexing();
    };
  }, [journal.id]);

  const logIndexingChange = async (agencyName: string, status: string) => {
    try {
      await addDoc(collection(db, 'google_scholar_history'), {
        journalId: journal.id,
        status: `Indexing: ${agencyName} -> ${status}`,
        tagOptimization: `Automatic log from Indexing Manager`,
        employeeName: currentUser?.name || 'System',
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error logging indexing change:', error);
    }
  };

  // Command Logic
  const handleApplyCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgency) return;
    try {
      // Check if already exists
      const existing = journalIndexing.find(i => i.agencyId === selectedAgency.id);
      if (existing) {
        await updateDoc(doc(db, 'journal_indexing', existing.id), {
          status: 'pending',
          appliedAt: applyDate
        });
      } else {
        await addDoc(collection(db, 'journal_indexing'), {
          journalId: journal.id,
          agencyId: selectedAgency.id,
          status: 'pending',
          appliedAt: applyDate
        });
      }
      await logIndexingChange(selectedAgency.name, 'Pending');
      setIsApplyModalOpen(false);
      setSelectedAgency(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'journal_indexing');
    }
  };

  const handleAddLinkCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgency) return;
    try {
      const sanitizedUrl = sanitizeUrl(liveLink);
      const existing = journalIndexing.find(i => i.agencyId === selectedAgency.id);
      if (existing) {
        await updateDoc(doc(db, 'journal_indexing', existing.id), {
          status: 'indexed',
          journalPageUrl: sanitizedUrl,
          indexedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'journal_indexing'), {
          journalId: journal.id,
          agencyId: selectedAgency.id,
          status: 'indexed',
          journalPageUrl: sanitizedUrl,
          indexedAt: serverTimestamp()
        });
      }
      await logIndexingChange(selectedAgency.name, 'Indexed');
      setIsLinkModalOpen(false);
      setLiveLink('');
      setSelectedAgency(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'journal_indexing');
    }
  };

  const handleRemoveLinkCommand = async (indexingId: string) => {
    if (!confirm('Remove indexing link and move to Not Indexed?')) return;
    try {
      const indexing = journalIndexing.find(i => i.id === indexingId);
      const agency = agencies.find(a => a.id === indexing?.agencyId);
      await updateDoc(doc(db, 'journal_indexing', indexingId), {
        status: 'not_indexed',
        journalPageUrl: null,
        indexedAt: null
      });
      if (agency) await logIndexingChange(agency.name, 'Not Indexed');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journal_indexing');
    }
  };

  const handleApproveCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIndexing) return;
    try {
      const sanitizedUrl = sanitizeUrl(liveLink);
      await updateDoc(doc(db, 'journal_indexing', selectedIndexing.id), {
        status: 'indexed',
        journalPageUrl: sanitizedUrl,
        indexedAt: serverTimestamp()
      });
      await logIndexingChange(selectedAgency.name, 'Indexed (Approved)');
      setIsApproveModalOpen(false);
      setLiveLink('');
      setSelectedIndexing(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journal_indexing');
    }
  };

  const deleteRecord = async (indexingId: string) => {
    if (!confirm('Delete this indexing record?')) return;
    try {
      await deleteDoc(doc(db, 'journal_indexing', indexingId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'journal_indexing');
    }
  };

  // Grouping data for UI
  const indexed = journalIndexing
    .filter(i => i.status === 'indexed')
    .map(i => ({
      indexing: i,
      agency: agencies.find(a => a.id === i.agencyId)
    }))
    .filter(item => item.agency);

  const pending = journalIndexing
    .filter(i => i.status === 'pending')
    .map(i => ({
      indexing: i,
      agency: agencies.find(a => a.id === i.agencyId)
    }))
    .filter(item => item.agency);

  const notIndexed = agencies.filter(agency => {
    const indexing = journalIndexing.find(i => i.agencyId === agency.id);
    return !indexing || indexing.status === 'not_indexed';
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{journal.title}</h2>
          <p className="text-sm text-slate-500">Journal Indexing Logic Engine</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all">
          <X size={20} className="text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Card A: Currently Indexed */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
            <h3 className="font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 size={20} />
              Currently Indexed
            </h3>
            <span className="px-3 py-1 bg-white text-emerald-600 rounded-full text-xs font-bold border border-emerald-100">
              {indexed.length} Agencies
            </span>
          </div>
          <div className="p-6">
            {indexed.length === 0 ? (
              <div className="text-center py-8 text-slate-400 italic text-sm">
                No agencies currently indexed.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {indexed.map(({ indexing, agency }) => (
                  <div key={indexing.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-emerald-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center overflow-hidden p-1">
                        <img src={agency?.logoUrl} alt={agency?.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{agency?.name}</h4>
                        <a 
                          href={indexing.journalPageUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <ExternalLink size={10} />
                          Live Link
                        </a>
                      </div>
                    </div>
                    {check('indexingAgencies', 'delete') && (
                      <button 
                        onClick={() => handleRemoveLinkCommand(indexing.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Remove Link"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card B: Status Tracker */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Clock size={20} className="text-indigo-400" />
              Status Tracker
            </h3>
          </div>
          
          <div className="p-6 space-y-8">
            {/* Sub-section: Pending with Dates */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-400 rounded-full" />
                Pending with Dates
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {pending.length === 0 ? (
                  <p className="text-xs text-slate-400 italic ml-4">No pending applications.</p>
                ) : (
                  pending.map(({ indexing, agency }) => (
                    <div key={indexing.id} className="flex items-center justify-between p-4 bg-amber-50/30 rounded-2xl border border-amber-100/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center overflow-hidden p-1">
                          <img src={agency?.logoUrl} alt={agency?.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{agency?.name}</h4>
                          <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                            <Calendar size={10} />
                            Applied: {indexing.appliedAt}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {check('indexingAgencies', 'approve') && (
                          <button 
                            onClick={() => {
                              setSelectedIndexing(indexing);
                              setSelectedAgency(agency!);
                              setIsApproveModalOpen(true);
                            }}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                          >
                            Approve
                          </button>
                        )}
                        {check('indexingAgencies', 'delete') && (
                          <button 
                            onClick={() => deleteRecord(indexing.id)}
                            className="p-2 text-slate-300 hover:text-rose-600 rounded-lg transition-all"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sub-section: Not Indexed with Apply links */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 bg-slate-300 rounded-full" />
                Not Indexed
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notIndexed.map((agency) => (
                  <div key={agency.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden p-1">
                        <img src={agency.logoUrl} alt={agency.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">{agency.name}</h4>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {check('indexingAgencies', 'edit') && (
                        <>
                          <button 
                            onClick={() => {
                              setSelectedAgency(agency);
                              setIsApplyModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-all"
                          >
                            Apply
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedAgency(agency);
                              setIsLinkModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-all"
                          >
                            Add Link
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      <Modal 
        isOpen={isApplyModalOpen} 
        onClose={() => setIsApplyModalOpen(false)} 
        title={`Apply to ${selectedAgency?.name}`}
      >
        <form onSubmit={handleApplyCommand} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Application Date</label>
            <input 
              required
              type="date" 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={applyDate}
              onChange={e => setApplyDate(e.target.value)}
            />
          </div>
          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              Move to Pending
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Link Modal */}
      <Modal 
        isOpen={isLinkModalOpen} 
        onClose={() => setIsLinkModalOpen(false)} 
        title={`Add Indexing Link: ${selectedAgency?.name}`}
      >
        <form onSubmit={handleAddLinkCommand} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Live Link (Journal Page)</label>
            <input 
              required
              type="url" 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="https://agency.com/journal/123"
              value={liveLink}
              onChange={e => setLiveLink(e.target.value)}
            />
          </div>
          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              Move to Indexed
            </button>
          </div>
        </form>
      </Modal>

      {/* Approve Modal */}
      <Modal 
        isOpen={isApproveModalOpen} 
        onClose={() => setIsApproveModalOpen(false)} 
        title={`Approve Indexing: ${selectedAgency?.name}`}
      >
        <form onSubmit={handleApproveCommand} className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800 text-sm">
            Provide the live link to approve this pending application.
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Live Link</label>
            <input 
              required
              type="url" 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="https://..."
              value={liveLink}
              onChange={e => setLiveLink(e.target.value)}
            />
          </div>
          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              Approve & Index
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
