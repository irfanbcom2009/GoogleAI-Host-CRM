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
  Check,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Journal, IndexingAgency, JournalIndexing, IndexingStatus, User as UserType } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, updateDoc, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { cn, sanitizeUrl, formatDateForInput } from '../lib/utils';
import { Modal } from './Modal';
import { usePermissions } from '../hooks/usePermissions';
import { toast } from 'react-hot-toast';

const extractRootDomain = (urlStr: string): string => {
  if (!urlStr) return '';
  try {
    let formatted = urlStr.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = 'https://' + formatted;
    }
    const cleanUrl = formatted.split(/[?#]/)[0];
    const parsed = new URL(cleanUrl);
    const host = parsed.hostname.toLowerCase();
    
    const cleanHost = host.startsWith('www.') ? host.substring(4) : host;
    
    const parts = cleanHost.split('.');
    if (parts.length >= 3) {
      const secondToLast = parts[parts.length - 2];
      const multiPartSuffixes = ['co', 'com', 'org', 'net', 'edu', 'gov', 'ac', 'res', 'sch', 'or', 'mil'];
      if (multiPartSuffixes.includes(secondToLast)) {
        return parts.slice(-3).join('.');
      }
      return parts.slice(-2).join('.');
    }
    return cleanHost;
  } catch (e) {
    const match = urlStr.match(/^(?:https?:\/\/)?(?:www\.)?([^:\/\s?#]+)/i);
    if (match && match[1]) {
      const host = match[1].toLowerCase();
      const parts = host.split('.');
      if (parts.length >= 3) {
        const secondToLast = parts[parts.length - 2];
        const multiPartSuffixes = ['co', 'com', 'org', 'net', 'edu', 'gov', 'ac', 'res', 'sch', 'or', 'mil'];
        if (multiPartSuffixes.includes(secondToLast)) {
          return parts.slice(-3).join('.');
        }
        return parts.slice(-2).join('.');
      }
      return host;
    }
    return '';
  }
};

const isDomainMatching = (enteredUrl: string, agency: IndexingAgency): boolean => {
  if (!enteredUrl) return true;
  
  const enteredDomain = extractRootDomain(enteredUrl);
  if (!enteredDomain) return false;
  
  const searchDomain = agency.searchLink ? extractRootDomain(agency.searchLink) : '';
  const submissionDomain = agency.submissionLink ? extractRootDomain(agency.submissionLink) : '';
  
  if (!searchDomain && !submissionDomain) {
    const agencyNameSlug = agency.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return enteredDomain.includes(agencyNameSlug) || agencyNameSlug.includes(enteredDomain);
  }
  
  return (searchDomain !== '' && enteredDomain === searchDomain) || 
         (submissionDomain !== '' && enteredDomain === submissionDomain);
};

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modals
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  
  // Selected items for modals
  const [selectedAgency, setSelectedAgency] = useState<IndexingAgency | null>(null);
  const [selectedIndexing, setSelectedIndexing] = useState<JournalIndexing | null>(null);
  
  // Form inputs
  const [applyDate, setApplyDate] = useState(new Date().toISOString().split('T')[0]);
  const [localApplyDates, setLocalApplyDates] = useState<Record<string, string>>({});
  const [liveLink, setLiveLink] = useState('');
  
  const isLinkValid = !liveLink.trim() || !selectedAgency || isDomainMatching(liveLink, selectedAgency);

  // Filtering and pagination states
  const [searchFilter, setSearchFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [submissionLinkFilter, setSubmissionLinkFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

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
    if (!selectedAgency || isSubmitting) return;
    setIsSubmitting(true);
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
          clientId: journal.clientId,
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickApply = async (agency: IndexingAgency, date: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const existing = journalIndexing.find(i => i.agencyId === agency.id);
      if (existing) {
        await updateDoc(doc(db, 'journal_indexing', existing.id), {
          status: 'pending',
          appliedAt: date
        });
      } else {
        await addDoc(collection(db, 'journal_indexing'), {
          journalId: journal.id,
          clientId: journal.clientId,
          agencyId: agency.id,
          status: 'pending',
          appliedAt: date
        });
      }
      await logIndexingChange(agency.name, 'Pending');
      toast.success(`${agency.name} moved to pending`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'journal_indexing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLinkCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgency || isSubmitting) return;
    
    if (!isDomainMatching(liveLink, selectedAgency)) {
      toast.error('The entered URL does not match the indexing agency root domain');
      return;
    }

    setIsSubmitting(true);
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
          clientId: journal.clientId,
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveLinkCommand = async (indexingId: string) => {
    if (!confirm('Delete this indexing record? (You can restore it later from the "Not Indexed" section)') || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const indexing = journalIndexing.find(i => i.id === indexingId);
      const agency = agencies.find(a => a.id === indexing?.agencyId);
      await updateDoc(doc(db, 'journal_indexing', indexingId), {
        status: 'not_indexed',
        lastStatus: 'indexed',
        lastJournalPageUrl: indexing?.journalPageUrl || null,
        lastIndexedAt: indexing?.indexedAt || null,
        lastAppliedAt: indexing?.appliedAt || null,
        journalPageUrl: null,
        indexedAt: null
      });
      if (agency) await logIndexingChange(agency.name, 'Not Indexed');
      toast.success('Indexing record deleted (can be restored)');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journal_indexing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIndexing || !selectedAgency || isSubmitting) return;

    if (!isDomainMatching(liveLink, selectedAgency)) {
      toast.error('The entered URL does not match the indexing agency root domain');
      return;
    }

    setIsSubmitting(true);
    try {
      const sanitizedUrl = sanitizeUrl(liveLink);
      await updateDoc(doc(db, 'journal_indexing', selectedIndexing.id), {
        status: 'indexed',
        journalPageUrl: sanitizedUrl,
        indexedAt: serverTimestamp(),
        // Clear previous state once approved normally
        lastStatus: null,
        lastJournalPageUrl: null,
        lastIndexedAt: null,
        lastAppliedAt: null
      });
      await logIndexingChange(selectedAgency?.name || 'Unknown', 'Indexed (Approved)');
      setIsApproveModalOpen(false);
      setLiveLink('');
      setSelectedIndexing(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journal_indexing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteRecord = async (indexingId: string) => {
    if (!confirm('Delete this indexing record? (You can restore it later from the "Not Indexed" section)') || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const indexing = journalIndexing.find(i => i.id === indexingId);
      const agency = agencies.find(a => a.id === indexing?.agencyId);
      await updateDoc(doc(db, 'journal_indexing', indexingId), {
        status: 'not_indexed',
        lastStatus: 'pending',
        lastJournalPageUrl: indexing?.journalPageUrl || null,
        lastIndexedAt: indexing?.indexedAt || null,
        lastAppliedAt: indexing?.appliedAt || null,
        appliedAt: null,
        journalPageUrl: null,
        indexedAt: null
      });
      if (agency) await logIndexingChange(agency.name, 'Revoked/Deleted');
      toast.success('Indexing record deleted (can be restored)');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journal_indexing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestoreLastState = async (indexingId: string) => {
    if (isSubmitting) return;
    const indexing = journalIndexing.find(i => i.id === indexingId);
    if (!indexing) return;
    const agency = agencies.find(a => a.id === indexing.agencyId);
    if (!confirm(`Restore last state for ${agency?.name || 'this agency'}?`)) return;

    setIsSubmitting(true);
    try {
      const restoredStatus = indexing.lastStatus || 'not_indexed';
      await updateDoc(doc(db, 'journal_indexing', indexingId), {
        status: restoredStatus,
        journalPageUrl: indexing.lastJournalPageUrl || null,
        indexedAt: indexing.lastIndexedAt || null,
        appliedAt: indexing.lastAppliedAt || null,
        lastStatus: null,
        lastJournalPageUrl: null,
        lastIndexedAt: null,
        lastAppliedAt: null
      });
      if (agency) await logIndexingChange(agency.name, `Restored (${restoredStatus})`);
      toast.success(`Restored ${agency?.name || 'agency'} to ${restoredStatus} state!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journal_indexing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHardDeleteRecord = async (indexingId: string) => {
    if (!confirm('Permanently delete this indexing record and its history? This action cannot be undone.') || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const indexing = journalIndexing.find(i => i.id === indexingId);
      const agency = agencies.find(a => a.id === indexing?.agencyId);
      await deleteDoc(doc(db, 'journal_indexing', indexingId));
      if (agency) await logIndexingChange(agency.name, 'Deleted Permanently');
      toast.success('Indexing record permanently deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'journal_indexing');
    } finally {
      setIsSubmitting(false);
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

  // Unique countries for filter dropdown
  const countries = Array.from(new Set(notIndexed.map(a => a.country).filter(Boolean)));

  // Filter notIndexed list
  const filteredNotIndexed = notIndexed.filter(agency => {
    const matchesSearch = agency.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
                          (agency.country && agency.country.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchesCountry = countryFilter === 'All' || agency.country === countryFilter;
    const matchesSubmission = submissionLinkFilter === 'All' || 
                              (submissionLinkFilter === 'has_link' && agency.submissionLink) ||
                              (submissionLinkFilter === 'no_link' && !agency.submissionLink);
    return matchesSearch && matchesCountry && matchesSubmission;
  });

  // Calculate pagination
  const totalItems = filteredNotIndexed.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedNotIndexed = filteredNotIndexed.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter, countryFilter, submissionLinkFilter, pageSize]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden animate-fade-in">
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
              <div className="divide-y divide-slate-100 border border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                {indexed.map(({ indexing, agency }) => (
                  <div key={indexing.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center overflow-hidden p-1 shrink-0">
                        <img src={agency?.logoUrl} alt={agency?.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-snug">{agency?.name}</h4>
                        {indexing.journalPageUrl && (
                          <a 
                            href={indexing.journalPageUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            <ExternalLink size={10} />
                            Live Link
                          </a>
                        )}
                      </div>
                    </div>
                    {check('indexingAgencies', 'delete') && (
                      <button 
                        onClick={() => handleRemoveLinkCommand(indexing.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all"
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
              <div className="divide-y divide-slate-100 border border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                {pending.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 italic text-sm">
                    No pending applications.
                  </div>
                ) : (
                  pending.map(({ indexing, agency }) => (
                    <div key={indexing.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 hover:bg-slate-50 transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center overflow-hidden p-1 shrink-0">
                          <img src={agency?.logoUrl} alt={agency?.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm leading-snug">{agency?.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                              <Calendar size={10} />
                              Applied {formatDateForInput(indexing.appliedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        {agency?.searchLink && (
                          <a 
                            href={agency.searchLink.includes('{') 
                              ? agency.searchLink.replace('{title}', encodeURIComponent(journal.title)).replace('{issn}', encodeURIComponent(journal.issnOnline || journal.issnPrint || ''))
                              : agency.searchLink
                            }
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-600 rounded-lg text-xs font-semibold tracking-wide border border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm"
                          >
                            <Search size={12} />
                            Search Record
                          </a>
                        )}
                        {check('indexingAgencies', 'approve') && (
                          <button 
                            disabled={isSubmitting}
                            onClick={() => {
                              setSelectedIndexing(indexing);
                              setSelectedAgency(agency!);
                              setIsApproveModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                          >
                            {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            Approve
                          </button>
                        )}
                        {check('indexingAgencies', 'delete') && (
                          <button 
                            disabled={isSubmitting}
                            onClick={() => {
                              if(confirm('Delete this indexing record? (You can restore it later from the "Not Indexed" section)')) deleteRecord(indexing.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all"
                            title="Delete Indexing Record"
                          >
                            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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

              {/* Filtering Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl">
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or country..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={searchFilter || ''}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Country Filter */}
                  <select
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700"
                    value={countryFilter || ''}
                    onChange={(e) => setCountryFilter(e.target.value)}
                  >
                    <option value="All">All Countries</option>
                    {countries.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {/* Submission Link Filter */}
                  <select
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700"
                    value={submissionLinkFilter || ''}
                    onChange={(e) => setSubmissionLinkFilter(e.target.value)}
                  >
                    <option value="All">All Submission Types</option>
                    <option value="has_link">Has Submission Link</option>
                    <option value="no_link">No Submission Link</option>
                  </select>

                  {/* Page Size Select */}
                  <select
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700"
                    value={pageSize || ''}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>
              </div>

              {/* Not Indexed List */}
              <div className="divide-y divide-slate-100 border border-slate-200/60 rounded-2xl overflow-hidden bg-white">
                {paginatedNotIndexed.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 italic text-sm">
                    No matching agencies found.
                  </div>
                ) : (
                  paginatedNotIndexed.map((agency) => {
                    const indexing = journalIndexing.find(i => i.agencyId === agency.id);
                    const canRestore = indexing && indexing.lastStatus;
                    return (
                      <div key={agency.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 hover:bg-slate-50 transition-all group">
                        {/* Left: Logo & Info */}
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden p-1 shrink-0">
                            <img src={agency.logoUrl} alt={agency.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800 text-sm leading-snug">{agency.name}</h4>
                              {canRestore && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded border border-amber-200 animate-pulse">
                                  Has Backup
                                </span>
                              )}
                            </div>
                            {agency.submissionLink && (
                              <a 
                                href={agency.submissionLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider inline-flex items-center gap-1 mt-0.5 hover:underline"
                              >
                                <ExternalLink size={10} />
                                Submission Link
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Right: Date selector and action buttons */}
                        <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
                          {/* Application Date Input */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap hidden sm:inline">Apply Date:</span>
                            <input 
                              type="date"
                              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all w-36"
                              value={localApplyDates[agency.id] || new Date().toISOString().split('T')[0] || ''}
                              onChange={(e) => setLocalApplyDates(prev => ({ ...prev, [agency.id]: e.target.value }))}
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {canRestore && indexing && (
                              <button 
                                disabled={isSubmitting}
                                onClick={() => handleRestoreLastState(indexing.id)}
                                className="px-3 py-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center gap-1.5"
                                title={`Restore previous ${indexing.lastStatus} state`}
                              >
                                <RotateCcw size={12} />
                                <span>Restore Last State</span>
                              </button>
                            )}

                            {indexing && check('indexingAgencies', 'delete') && (
                              <button 
                                disabled={isSubmitting}
                                onClick={() => handleHardDeleteRecord(indexing.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all"
                                title="Permanently Delete Record"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            
                            {check('indexingAgencies', 'edit') && (
                              <>
                                <button 
                                  onClick={() => {
                                    setSelectedAgency(agency);
                                    setIsLinkModalOpen(true);
                                  }}
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-transparent hover:border-emerald-100 transition-all"
                                  title="Directly Add Indexed Link"
                                >
                                  <LinkIcon size={14} />
                                </button>
                                
                                <button 
                                  disabled={isSubmitting}
                                  onClick={() => handleQuickApply(agency, localApplyDates[agency.id] || new Date().toISOString().split('T')[0])}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                                  <span>Move to Pending</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-2xl">
                  <span className="text-xs font-medium text-slate-500">
                    Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} agencies
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
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
              value={applyDate || ''}
              onChange={e => setApplyDate(e.target.value)}
            />
          </div>
          <div className="pt-4">
            <button 
              disabled={isSubmitting}
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
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
              className={cn(
                "w-full px-4 py-2 bg-slate-50 border rounded-xl outline-none transition-all focus:ring-2",
                isLinkValid 
                  ? "border-slate-200 focus:ring-indigo-500" 
                  : "border-rose-300 focus:ring-rose-500 bg-rose-50/30 text-rose-900"
              )}
              placeholder="https://agency.com/journal/123"
              value={liveLink || ''}
              onChange={e => setLiveLink(e.target.value)}
            />
            {!isLinkValid && (
              <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1 animate-pulse">
                <AlertCircle size={12} /> The entered URL does not match the indexing agency root domain
              </p>
            )}
          </div>
          <div className="pt-4">
            <button 
              disabled={isSubmitting || !isLinkValid}
              type="submit"
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
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
              className={cn(
                "w-full px-4 py-2 bg-slate-50 border rounded-xl outline-none transition-all focus:ring-2",
                isLinkValid 
                  ? "border-slate-200 focus:ring-indigo-500" 
                  : "border-rose-300 focus:ring-rose-500 bg-rose-50/30 text-rose-900"
              )}
              placeholder="https://..."
              value={liveLink || ''}
              onChange={e => setLiveLink(e.target.value)}
            />
            {!isLinkValid && (
              <p className="text-xs text-rose-500 font-semibold mt-1.5 flex items-center gap-1 animate-pulse">
                <AlertCircle size={12} /> The entered URL does not match the indexing agency root domain
              </p>
            )}
          </div>
          <div className="pt-4">
            <button 
              disabled={isSubmitting || !isLinkValid}
              type="submit"
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              Approve & Index
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
