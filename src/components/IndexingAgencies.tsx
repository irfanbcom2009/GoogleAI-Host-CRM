import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Building2, 
  Globe, 
  Clock, 
  ExternalLink, 
  Trash2, 
  Edit, 
  Loader2, 
  X,
  Link as LinkIcon,
  Image as ImageIcon,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  SlidersHorizontal,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IndexingAgency, User, Journal } from '../types';
import { JournalIndexingManager } from './JournalIndexingManager';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Modal } from './Modal';
import { usePermissions } from '../hooks/usePermissions';

const RESPONSE_TIME_OPTIONS = [
  '1 Week',
  '1 Month',
  '2-6 Month',
  '1 Year',
  'Not Known'
];

interface IndexingAgenciesProps {
  currentUser: User;
}

export const IndexingAgencies: React.FC<IndexingAgenciesProps> = ({ currentUser }) => {
  const { check } = usePermissions(currentUser);
  const [agencies, setAgencies] = useState<IndexingAgency[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [indexingRecords, setIndexingRecords] = useState<any[]>([]);
  const [indexingCounts, setIndexingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Custom Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [responseTimeFilter, setResponseTimeFilter] = useState('');
  const [journalStatusFilter, setJournalStatusFilter] = useState('');
  const [journalAgencyFilter, setJournalAgencyFilter] = useState('');

  // Pagination & progressive Load More states
  const [agenciesPage, setAgenciesPage] = useState(1);
  const [agenciesPerPage, setAgenciesPerPage] = useState(8);
  const [agenciesVisibleCount, setAgenciesVisibleCount] = useState(8);
  const [agenciesLoadMode, setAgenciesLoadMode] = useState<'pagination' | 'load_more'>('pagination');

  const [journalsPage, setJournalsPage] = useState(1);
  const [journalsPerPage, setJournalsPerPage] = useState(8);
  const [journalsVisibleCount, setJournalsVisibleCount] = useState(8);
  const [journalsLoadMode, setJournalsLoadMode] = useState<'pagination' | 'load_more'>('pagination');

  // Sorting states
  const [agenciesSortField, setAgenciesSortField] = useState<'name' | 'country' | 'responseTime' | 'indexedCount'>('name');
  const [agenciesSortDirection, setAgenciesSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [journalsSortField, setJournalsSortField] = useState<'title' | 'indexedCount' | 'latestApp'>('title');
  const [journalsSortDirection, setJournalsSortDirection] = useState<'asc' | 'desc'>('asc');

  const [applyingAgency, setApplyingAgency] = useState<IndexingAgency | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<IndexingAgency | null>(null);
  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);
  const [isIndexingModalOpen, setIsIndexingModalOpen] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [activeTab, setActiveTab] = useState<'agencies' | 'management'>('agencies');
  
  const [newAgency, setNewAgency] = useState({
    name: '',
    logoUrl: '',
    searchLink: '',
    submissionLink: '',
    country: '',
    responseTime: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'indexing_agencies'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IndexingAgency[];
      setAgencies(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'indexing_agencies');
    });

    const unsubscribeJournals = onSnapshot(query(collection(db, 'journals'), orderBy('title', 'asc')), (snapshot) => {
      setJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeIndexing = onSnapshot(collection(db, 'journal_indexing'), (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setIndexingRecords(records);

      const counts: Record<string, number> = {};
      records.forEach(data => {
        if (data.status === 'indexed') {
          counts[data.agencyId] = (counts[data.agencyId] || 0) + 1;
        }
      });
      setIndexingCounts(counts);
    });

    return () => {
      unsubscribe();
      unsubscribeJournals();
      unsubscribeIndexing();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingAgency) {
        await updateDoc(doc(db, 'indexing_agencies', editingAgency.id), {
          ...newAgency,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'indexing_agencies'), {
          ...newAgency,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingAgency(null);
      setNewAgency({
        name: '',
        logoUrl: '',
        searchLink: '',
        submissionLink: '',
        country: '',
        responseTime: ''
      });
    } catch (error) {
      handleFirestoreError(error, editingAgency ? OperationType.UPDATE : OperationType.CREATE, 'indexing_agencies');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAgency = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agency?')) return;
    try {
      await deleteDoc(doc(db, 'indexing_agencies', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'indexing_agencies');
    }
  };

  const countries = React.useMemo(() => {
    return Array.from(new Set(agencies.map(a => a.country).filter(Boolean))).sort();
  }, [agencies]);

  const sortedAndFilteredAgencies = React.useMemo(() => {
    const filtered = agencies.filter(agency => {
      const nameMatch = agency.name.toLowerCase().includes(searchQuery.toLowerCase());
      const countryMatch = agency.country ? agency.country.toLowerCase().includes(searchQuery.toLowerCase()) : false;
      const searchLinkMatch = agency.searchLink ? agency.searchLink.toLowerCase().includes(searchQuery.toLowerCase()) : false;
      const submissionLinkMatch = agency.submissionLink ? agency.submissionLink.toLowerCase().includes(searchQuery.toLowerCase()) : false;
      
      const matchesSearch = nameMatch || countryMatch || searchLinkMatch || submissionLinkMatch;
      const matchesCountry = !countryFilter || agency.country === countryFilter;
      const matchesResponse = !responseTimeFilter || agency.responseTime === responseTimeFilter;
      
      return matchesSearch && matchesCountry && matchesResponse;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (agenciesSortField === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (agenciesSortField === 'country') {
        comparison = (a.country || '').localeCompare(b.country || '');
      } else if (agenciesSortField === 'responseTime') {
        comparison = (a.responseTime || '').localeCompare(b.responseTime || '');
      } else if (agenciesSortField === 'indexedCount') {
        const countA = indexingCounts[a.id] || 0;
        const countB = indexingCounts[b.id] || 0;
        comparison = countA - countB;
      }
      return agenciesSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [agencies, searchQuery, countryFilter, responseTimeFilter, agenciesSortField, agenciesSortDirection, indexingCounts]);

  const sortedAndFilteredJournals = React.useMemo(() => {
    const filtered = journals.filter(journal => {
      // 1. Search Query
      const matchesSearch = !searchQuery || 
        (journal.title && journal.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (journal.issnPrint && journal.issnPrint.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (journal.url && journal.url.toLowerCase().includes(searchQuery.toLowerCase()));

      // 2. Status Filter
      const journalRecords = indexingRecords.filter(r => r.journalId === journal.id);
      let matchesStatus = true;
      if (journalStatusFilter === 'indexed') {
        matchesStatus = journalRecords.some(r => r.status === 'indexed');
      } else if (journalStatusFilter === 'pending') {
        matchesStatus = journalRecords.some(r => r.status === 'pending');
      } else if (journalStatusFilter === 'unindexed') {
        matchesStatus = journalRecords.length === 0 || !journalRecords.some(r => r.status === 'indexed');
      } else if (journalStatusFilter === 'rejected') {
        matchesStatus = journalRecords.some(r => r.status === 'rejected');
      }

      // 3. Agency Filter
      let matchesAgency = true;
      if (journalAgencyFilter) {
        matchesAgency = journalRecords.some(r => r.agencyId === journalAgencyFilter);
      }

      return matchesSearch && matchesStatus && matchesAgency;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (journalsSortField === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else if (journalsSortField === 'indexedCount') {
        const countA = indexingRecords.filter(r => r.journalId === a.id && r.status === 'indexed').length;
        const countB = indexingRecords.filter(r => r.journalId === b.id && r.status === 'indexed').length;
        comparison = countA - countB;
      } else if (journalsSortField === 'latestApp') {
        const recordsA = indexingRecords.filter(r => r.journalId === a.id);
        const recordsB = indexingRecords.filter(r => r.journalId === b.id);
        
        const getLatestTime = (recs: any[]) => {
          if (recs.length === 0) return 0;
          const sortedRecs = [...recs].sort((x, y) => {
            const timeX = x.createdAt?.seconds ? x.createdAt.seconds * 1000 : new Date(x.createdAt || 0).getTime();
            const timeY = y.createdAt?.seconds ? y.createdAt.seconds * 1000 : new Date(y.createdAt || 0).getTime();
            return timeY - timeX;
          });
          const latest = sortedRecs[0];
          return latest.createdAt?.seconds ? latest.createdAt.seconds * 1000 : new Date(latest.createdAt || 0).getTime();
        };

        comparison = getLatestTime(recordsA) - getLatestTime(recordsB);
      }
      return journalsSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [journals, searchQuery, journalStatusFilter, journalAgencyFilter, journalsSortField, journalsSortDirection, indexingRecords]);

  // Reset agency page on search/filter changes
  useEffect(() => {
    setAgenciesPage(1);
    setAgenciesVisibleCount(agenciesPerPage);
  }, [searchQuery, countryFilter, responseTimeFilter, agenciesSortField, agenciesSortDirection, agenciesPerPage]);

  // Reset journal page on search/filter/sort changes
  useEffect(() => {
    setJournalsPage(1);
    setJournalsVisibleCount(journalsPerPage);
  }, [searchQuery, journalStatusFilter, journalAgencyFilter, journalsSortField, journalsSortDirection, journalsPerPage]);

  const toggleAgenciesSort = (field: 'name' | 'country' | 'responseTime' | 'indexedCount') => {
    if (agenciesSortField === field) {
      setAgenciesSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setAgenciesSortField(field);
      setAgenciesSortDirection('asc');
    }
  };

  const toggleJournalsSort = (field: 'title' | 'indexedCount' | 'latestApp') => {
    if (journalsSortField === field) {
      setJournalsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setJournalsSortField(field);
      setJournalsSortDirection('asc');
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Indexing Repository
            <span className="text-sm font-bold px-3 py-1 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full">
              {activeTab === 'agencies' ? `${sortedAndFilteredAgencies.length} of ${agencies.length}` : `${sortedAndFilteredJournals.length} of ${journals.length}`}
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {activeTab === 'agencies' ? 'Manage global indexing agencies available for journals.' : 'Monitor and manage indexing status across all journals.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('agencies')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === 'agencies' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Agencies
            </button>
            <button
              onClick={() => setActiveTab('management')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === 'management' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Management List
            </button>
          </div>
          {activeTab === 'agencies' && check('indexingAgencies', 'add') && (
            <button 
              onClick={() => {
                setEditingAgency(null);
                setNewAgency({
                  name: '',
                  logoUrl: '',
                  searchLink: '',
                  submissionLink: '',
                  country: '',
                  responseTime: ''
                });
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Plus size={20} />
              Add Agency
            </button>
          )}
        </div>
      </div>

      {activeTab === 'agencies' ? (
        <>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-xl">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Agencies</p>
              <h3 className="text-2xl font-bold text-slate-900">{agencies.length}</h3>
            </div>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-600 text-white rounded-xl">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Indexed Journals</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {Object.values(indexingCounts).reduce((a, b) => a + b, 0)}
              </h3>
            </div>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-600 text-white rounded-xl">
              <Globe size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Countries Covered</p>
              <h3 className="text-2xl font-bold text-slate-900">{countries.length}</h3>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search agencies by name, country, search link, or submission link..." 
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <div className="relative flex-1 sm:flex-initial min-w-[160px]">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              className="w-full pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm appearance-none"
              value={countryFilter || ''}
              onChange={(e) => setCountryFilter(e.target.value)}
            >
              <option value="">All Countries</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 sm:flex-initial min-w-[180px]">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              className="w-full pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm appearance-none"
              value={responseTimeFilter || ''}
              onChange={(e) => setResponseTimeFilter(e.target.value)}
            >
              <option value="">All Response Times</option>
              {RESPONSE_TIME_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          {(searchQuery || countryFilter || responseTimeFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCountryFilter('');
                setResponseTimeFilter('');
              }}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Loading agencies...</p>
            </div>
          ) : sortedAndFilteredAgencies.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Building2 size={48} className="opacity-20" />
              <p className="text-sm font-medium">No agencies found</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                  <th className="px-6 py-4 w-12 text-center">#</th>
                  <th 
                    onClick={() => toggleAgenciesSort('name')}
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Agency ({sortedAndFilteredAgencies.length})
                      <ArrowUpDown size={14} className={agenciesSortField === 'name' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleAgenciesSort('indexedCount')}
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Indexed Journals
                      <ArrowUpDown size={14} className={agenciesSortField === 'indexedCount' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleAgenciesSort('country')}
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Country
                      <ArrowUpDown size={14} className={agenciesSortField === 'country' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleAgenciesSort('responseTime')}
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Response Time
                      <ArrowUpDown size={14} className={agenciesSortField === 'responseTime' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th className="px-6 py-4">Search Link</th>
                  <th className="px-6 py-4">Submission</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {(() => {
                    const agenciesStartIndex = (agenciesPage - 1) * agenciesPerPage;
                    const agenciesEndIndex = agenciesLoadMode === 'pagination' ? agenciesStartIndex + agenciesPerPage : agenciesVisibleCount;
                    const paginatedAgencies = sortedAndFilteredAgencies.slice(agenciesLoadMode === 'pagination' ? agenciesStartIndex : 0, agenciesEndIndex);
                    
                    return paginatedAgencies.map((agency, index) => {
                      const globalIndex = agenciesLoadMode === 'pagination' ? agenciesStartIndex + index + 1 : index + 1;
                      return (
                        <motion.tr 
                          layout
                          key={`${agency.id || 'agency'}-${globalIndex}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-slate-50/50 transition-all group"
                        >
                          <td className="px-6 py-4 text-center text-xs font-bold text-slate-500">
                            {globalIndex}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                {agency.logoUrl ? (
                                  <img src={agency.logoUrl} alt={agency.name} className="w-full h-full object-contain p-1.5" referrerPolicy="no-referrer" />
                                ) : (
                                  <Building2 size={20} className="text-slate-300" />
                                )}
                              </div>
                              <span className="font-bold text-sm text-slate-900">{agency.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-100">
                              <BookOpen size={12} />
                              {indexingCounts[agency.id] || 0} Journals
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Globe size={14} className="text-slate-400" />
                              {agency.country}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Clock size={14} className="text-slate-400" />
                              {agency.responseTime || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {agency.searchLink ? (
                              <a 
                                href={agency.searchLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-medium text-sm transition-colors"
                              >
                                <ExternalLink size={14} />
                                Search
                              </a>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Not provided</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => {
                                setApplyingAgency(agency);
                                setIsConfirmModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-medium text-sm transition-colors"
                            >
                              <LinkIcon size={14} />
                              Apply
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              {check('indexingAgencies', 'edit') && (
                                <button 
                                  onClick={() => {
                                    setEditingAgency(agency);
                                    setNewAgency({
                                      name: agency.name,
                                      logoUrl: agency.logoUrl,
                                      searchLink: agency.searchLink,
                                      submissionLink: agency.submissionLink,
                                      country: agency.country,
                                      responseTime: agency.responseTime
                                    });
                                    setIsModalOpen(true);
                                  }}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                >
                                  <Edit size={16} />
                                </button>
                              )}
                              {check('indexingAgencies', 'delete') && (
                                <button 
                                  onClick={() => handleDeleteAgency(agency.id)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    });
                  })()}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination & Load More controls footer */}
        {sortedAndFilteredAgencies.length > 0 && (
          <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>Show:</span>
                <select
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={agenciesLoadMode === 'pagination' ? agenciesPerPage : agenciesVisibleCount || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (agenciesLoadMode === 'pagination') {
                      setAgenciesPerPage(val);
                      setAgenciesPage(1);
                    } else {
                      setAgenciesVisibleCount(val);
                    }
                  }}
                >
                  {[5, 8, 10, 20, 50].map(sz => (
                    <option key={sz} value={sz}>{sz} items</option>
                  ))}
                </select>
              </div>

              <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAgenciesLoadMode('pagination')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase transition-all",
                    agenciesLoadMode === 'pagination' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Pages
                </button>
                <button
                  type="button"
                  onClick={() => setAgenciesLoadMode('load_more')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase transition-all",
                    agenciesLoadMode === 'load_more' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Ajax Load More
                </button>
              </div>
            </div>

            {(() => {
              if (agenciesLoadMode === 'pagination') {
                const agenciesStartIndex = (agenciesPage - 1) * agenciesPerPage;
                return (
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-slate-500">
                      Showing <span className="font-bold text-slate-900">{Math.min(sortedAndFilteredAgencies.length, agenciesStartIndex + 1)}</span> to{" "}
                      <span className="font-bold text-slate-900">{Math.min(sortedAndFilteredAgencies.length, agenciesStartIndex + agenciesPerPage)}</span> of{" "}
                      <span className="font-bold text-slate-900">{sortedAndFilteredAgencies.length}</span> agencies
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={agenciesPage === 1}
                        onClick={() => setAgenciesPage(p => Math.max(1, p - 1))}
                        className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: Math.ceil(sortedAndFilteredAgencies.length / agenciesPerPage) }).map((_, idx) => {
                        const p = idx + 1;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setAgenciesPage(p)}
                            className={cn(
                              "px-3 py-1 text-xs font-bold rounded-lg transition-colors",
                              agenciesPage === p ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            {p}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        disabled={agenciesPage >= Math.ceil(sortedAndFilteredAgencies.length / agenciesPerPage)}
                        onClick={() => setAgenciesPage(p => Math.min(Math.ceil(sortedAndFilteredAgencies.length / agenciesPerPage), p + 1))}
                        className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-slate-500">
                      Showing <span className="font-bold text-slate-900">{Math.min(sortedAndFilteredAgencies.length, agenciesVisibleCount)}</span> of{" "}
                      <span className="font-bold text-slate-900">{sortedAndFilteredAgencies.length}</span> agencies
                    </span>
                    {agenciesVisibleCount < sortedAndFilteredAgencies.length && (
                      <button
                        type="button"
                        onClick={() => setAgenciesVisibleCount(prev => prev + agenciesPerPage)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                      >
                        Load More Agencies
                      </button>
                    )}
                  </div>
                );
              }
            })()}
          </div>
        )}
      </div>
    </>
  ) : (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search journals by title or ISSN..." 
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <div className="relative flex-1 sm:flex-initial min-w-[160px]">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              className="w-full pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm appearance-none"
              value={journalStatusFilter || ''}
              onChange={(e) => setJournalStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="indexed">Indexed</option>
              <option value="pending">Pending</option>
              <option value="unindexed">Unindexed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="relative flex-1 sm:flex-initial min-w-[180px]">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              className="w-full pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm appearance-none"
              value={journalAgencyFilter || ''}
              onChange={(e) => setJournalAgencyFilter(e.target.value)}
            >
              <option value="">All Agencies</option>
              {agencies.map(agency => (
                <option key={agency.id} value={agency.id}>{agency.name}</option>
              ))}
            </select>
          </div>
          {(searchQuery || journalStatusFilter || journalAgencyFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setJournalStatusFilter('');
                setJournalAgencyFilter('');
              }}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-250px)] overflow-y-auto">
          {sortedAndFilteredJournals.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <BookOpen size={48} className="opacity-20" />
              <p className="text-sm font-medium">No journals found</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                  <th className="px-6 py-4 w-12 text-center">#</th>
                  <th 
                    onClick={() => toggleJournalsSort('title')}
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Journal Title ({sortedAndFilteredJournals.length})
                      <ArrowUpDown size={14} className={journalsSortField === 'title' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleJournalsSort('indexedCount')}
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Indexing Agencies
                      <ArrowUpDown size={14} className={journalsSortField === 'indexedCount' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleJournalsSort('latestApp')}
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Latest Application
                      <ArrowUpDown size={14} className={journalsSortField === 'latestApp' ? 'text-indigo-600' : 'text-slate-400'} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const journalsStartIndex = (journalsPage - 1) * journalsPerPage;
                    const journalsEndIndex = journalsLoadMode === 'pagination' ? journalsStartIndex + journalsPerPage : journalsVisibleCount;
                    const paginatedJournals = sortedAndFilteredJournals.slice(journalsLoadMode === 'pagination' ? journalsStartIndex : 0, journalsEndIndex);

                    return paginatedJournals.map((journal, index) => {
                      const globalIndex = journalsLoadMode === 'pagination' ? journalsStartIndex + index + 1 : index + 1;
                      const journalRecords = indexingRecords.filter(r => r.journalId === journal.id);
                      const isExpanded = expandedJournalId === journal.id;

                      return (
                        <React.Fragment key={journal.id}>
                          <motion.tr 
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={cn(
                              "hover:bg-slate-50/50 transition-all border-b border-slate-50 group",
                              isExpanded && "bg-indigo-50/20"
                            )}
                          >
                            <td className="px-6 py-4 text-center text-xs font-bold text-slate-500">
                              {globalIndex}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">{journal.title}</span>
                                <span className="text-[10px] text-slate-400 mt-0.5">{journal.issnPrint || journal.url || 'No extra info'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                {journalRecords.length > 0 ? (
                                  journalRecords.map((record, rIdx) => {
                                    const agency = agencies.find(a => a.id === record.agencyId);
                                    return (
                                      <div 
                                        key={`${record.id || 'rec'}-${rIdx}`} 
                                        className={cn(
                                          "px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1",
                                          record.status === 'indexed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                          record.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                          "bg-slate-50 text-slate-600 border-slate-100"
                                        )}
                                      >
                                        {agency?.name || 'Unknown'}
                                        <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
                                        {record.status.split('_').join(' ')}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <span className="text-xs text-slate-400 italic">No indexing applications found</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {journalRecords.length > 0 ? (
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-slate-700">
                                    {(() => {
                                      const sortedRecs = [...journalRecords].sort((a, b) => {
                                        const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
                                        const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
                                        return tB - tA;
                                      });
                                      const latest = sortedRecs[0];
                                      return latest.createdAt ? new Date(latest.createdAt?.seconds ? latest.createdAt.seconds * 1000 : latest.createdAt).toLocaleDateString() : 'Unknown Date';
                                    })()}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => {
                                    setSelectedJournal(journal);
                                    setIsIndexingModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm shadow-indigo-100"
                                >
                                  <SlidersHorizontal size={14} />
                                  Manage Indexing
                                </button>
                                <button 
                                  onClick={() => setExpandedJournalId(isExpanded ? null : journal.id)}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1",
                                    isExpanded 
                                      ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" 
                                      : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 group-hover:scale-105"
                                  )}
                                >
                                  {isExpanded ? 'Hide Details' : 'View Workflow'}
                                </button>
                              </div>
                            </td>
                          </motion.tr>

                          {/* Accordion expanded drawer details panel */}
                          {isExpanded && (
                            <motion.tr
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-indigo-50/10 border-b border-indigo-100"
                            >
                              <td colSpan={5} className="p-6">
                                <div className="bg-white rounded-xl border border-indigo-50 shadow-sm overflow-hidden p-6 space-y-4">
                                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                    <div>
                                      <h4 className="font-bold text-slate-900 text-sm">Applications Workflow for {journal.title}</h4>
                                      <p className="text-xs text-slate-400 mt-1">Detailed registration steps and verification trail.</p>
                                    </div>
                                    <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                                      {journalRecords.length} Total records
                                    </span>
                                  </div>

                                  {journalRecords.length === 0 ? (
                                    <div className="text-center py-6 text-slate-400 text-xs italic">
                                      No indexing events logged for this journal. Apply to an agency to start logging workflow tracking records.
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      {journalRecords.map((record, rIdx) => {
                                        const agency = agencies.find(a => a.id === record.agencyId);
                                        return (
                                          <div key={record.id || rIdx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-xl transition-colors gap-4">
                                            <div className="flex items-start gap-3">
                                              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                                                {agency?.logoUrl ? (
                                                  <img src={agency.logoUrl} alt={agency.name} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                                                ) : (
                                                  <Building2 size={16} className="text-slate-400" />
                                                )}
                                              </div>
                                              <div>
                                                <h5 className="text-xs font-bold text-slate-800">{agency?.name || 'Unknown Agency'}</h5>
                                                {record.createdAt && (
                                                  <p className="text-[10px] text-slate-400 mt-1">
                                                    Submitted on {new Date(record.createdAt?.seconds ? record.createdAt.seconds * 1000 : record.createdAt).toLocaleString()}
                                                  </p>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                              <span className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                                record.status === 'indexed' ? "bg-emerald-100 text-emerald-700" :
                                                record.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                                "bg-rose-100 text-rose-700"
                                              )}>
                                                {record.status}
                                              </span>
                                              {agency?.submissionLink && (
                                                <a 
                                                  href={agency.submissionLink}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="p-1 px-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 text-[10px] font-bold rounded-lg transition-all"
                                                >
                                                  Portal Link
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination & Load More controls footer */}
        {sortedAndFilteredJournals.length > 0 && (
          <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>Show:</span>
                <select
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={journalsLoadMode === 'pagination' ? journalsPerPage : journalsVisibleCount || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (journalsLoadMode === 'pagination') {
                      setJournalsPerPage(val);
                      setJournalsPage(1);
                    } else {
                      setJournalsVisibleCount(val);
                    }
                  }}
                >
                  {[5, 8, 10, 20, 50].map(sz => (
                    <option key={sz} value={sz}>{sz} items</option>
                  ))}
                </select>
              </div>

              <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setJournalsLoadMode('pagination')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase transition-all",
                    journalsLoadMode === 'pagination' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Pages
                </button>
                <button
                  type="button"
                  onClick={() => setJournalsLoadMode('load_more')}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase transition-all",
                    journalsLoadMode === 'load_more' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Ajax Load More
                </button>
              </div>
            </div>

            {(() => {
              if (journalsLoadMode === 'pagination') {
                const journalsStartIndex = (journalsPage - 1) * journalsPerPage;
                return (
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-slate-500">
                      Showing <span className="font-bold text-slate-900">{Math.min(sortedAndFilteredJournals.length, journalsStartIndex + 1)}</span> to{" "}
                      <span className="font-bold text-slate-900">{Math.min(sortedAndFilteredJournals.length, journalsStartIndex + journalsPerPage)}</span> of{" "}
                      <span className="font-bold text-slate-900">{sortedAndFilteredJournals.length}</span> journals
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={journalsPage === 1}
                        onClick={() => setJournalsPage(p => Math.max(1, p - 1))}
                        className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: Math.ceil(sortedAndFilteredJournals.length / journalsPerPage) }).map((_, idx) => {
                        const p = idx + 1;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setJournalsPage(p)}
                            className={cn(
                              "px-3 py-1 text-xs font-bold rounded-lg transition-colors",
                              journalsPage === p ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            {p}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        disabled={journalsPage >= Math.ceil(sortedAndFilteredJournals.length / journalsPerPage)}
                        onClick={() => setJournalsPage(p => Math.min(Math.ceil(sortedAndFilteredJournals.length / journalsPerPage), p + 1))}
                        className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-slate-500">
                      Showing <span className="font-bold text-slate-900">{Math.min(sortedAndFilteredJournals.length, journalsVisibleCount)}</span> of{" "}
                      <span className="font-bold text-slate-900">{sortedAndFilteredJournals.length}</span> journals
                    </span>
                    {journalsVisibleCount < sortedAndFilteredJournals.length && (
                      <button
                        type="button"
                        onClick={() => setJournalsVisibleCount(prev => prev + journalsPerPage)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                      >
                        Load More Journals
                      </button>
                    )}
                  </div>
                );
              }
            })()}
          </div>
        )}
      </div>
    </div>
  )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingAgency(null);
        }} 
        title={editingAgency ? "Edit Indexing Agency" : "Add Indexing Agency"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Agency Name</label>
            <input 
              required
              type="text" 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. Scopus, Web of Science"
              value={newAgency.name || ''}
              onChange={e => setNewAgency(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Logo URL</label>
            <div className="relative">
              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                required
                type="url" 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="https://example.com/logo.png"
                value={newAgency.logoUrl || ''}
                onChange={e => setNewAgency(prev => ({ ...prev, logoUrl: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Search Link (Optional)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="url" 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="https://scopus.com/search"
                  value={newAgency.searchLink || ''}
                  onChange={e => setNewAgency(prev => ({ ...prev, searchLink: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Submission Link</label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  required
                  type="url" 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="https://scopus.com/submit"
                  value={newAgency.submissionLink || ''}
                  onChange={e => setNewAgency(prev => ({ ...prev, submissionLink: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Country</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  required
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. USA, Netherlands"
                  value={newAgency.country || ''}
                  onChange={e => setNewAgency(prev => ({ ...prev, country: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Response Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select 
                  required
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                  value={newAgency.responseTime || ''}
                  onChange={e => setNewAgency(prev => ({ ...prev, responseTime: e.target.value }))}
                >
                  <option value="">Select Response Time</option>
                  {RESPONSE_TIME_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              disabled={isSubmitting}
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              {editingAgency ? "Save Changes" : "Add Agency"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Application"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
              <ExternalLink className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-900">External Submission Link</p>
              <p className="text-xs text-amber-700">You are about to be redirected to the agency's submission page.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-sm text-slate-600 leading-relaxed">
              Would you like to proceed to the submission link for <span className="font-bold text-slate-900">{applyingAgency?.name}</span>?
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (applyingAgency?.submissionLink) {
                  window.open(applyingAgency.submissionLink, '_blank', 'noopener,noreferrer');
                }
                setIsConfirmModalOpen(false);
              }}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              Proceed
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isIndexingModalOpen}
        onClose={() => {
          setIsIndexingModalOpen(false);
          setSelectedJournal(null);
        }}
        title="Journal Indexing Management"
        maxWidth="4xl"
      >
        {selectedJournal && (
          <JournalIndexingManager
            journal={selectedJournal}
            onClose={() => {
              setIsIndexingModalOpen(false);
              setSelectedJournal(null);
            }}
            currentUser={currentUser}
          />
        )}
      </Modal>
    </div>
  );
};
