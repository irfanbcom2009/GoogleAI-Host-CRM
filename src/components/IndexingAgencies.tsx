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
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IndexingAgency, User } from '../types';
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
  const [indexingCounts, setIndexingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [responseTimeFilter, setResponseTimeFilter] = useState('');
  const [applyingAgency, setApplyingAgency] = useState<IndexingAgency | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<IndexingAgency | null>(null);
  
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

    // Fetch indexing counts
    const unsubCounts = onSnapshot(collection(db, 'journal_indexing'), (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'indexed') {
          counts[data.agencyId] = (counts[data.agencyId] || 0) + 1;
        }
      });
      setIndexingCounts(counts);
    });

    return () => {
      unsubscribe();
      unsubCounts();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const countries = Array.from(new Set(agencies.map(a => a.country))).sort();

  const filteredAgencies = agencies.filter(agency => {
    const matchesSearch = agency.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agency.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCountry = !countryFilter || agency.country === countryFilter;
    const matchesResponse = !responseTimeFilter || agency.responseTime === responseTimeFilter;
    
    return matchesSearch && matchesCountry && matchesResponse;
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            Indexing Agencies
            <span className="text-sm font-bold px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full">
              {agencies.length}
            </span>
          </h2>
          <p className="text-slate-500 mt-1">Manage global indexing agencies available for journals.</p>
        </div>
          {check('indexingAgencies', 'add') && (
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

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search agencies by name or country..." 
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <div className="relative min-w-[160px]">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm appearance-none"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
            >
              <option value="">All Countries</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          <div className="relative min-w-[180px]">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm appearance-none"
              value={responseTimeFilter}
              onChange={(e) => setResponseTimeFilter(e.target.value)}
            >
              <option value="">All Response Times</option>
              {RESPONSE_TIME_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Loading agencies...</p>
            </div>
          ) : filteredAgencies.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
              <Building2 size={48} className="opacity-20" />
              <p className="text-sm font-medium">No agencies found</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                  <th className="px-6 py-4 w-12 text-center">#</th>
                  <th className="px-6 py-4">Agency ({filteredAgencies.length})</th>
                  <th className="px-6 py-4">Indexed Journals</th>
                  <th className="px-6 py-4">Country</th>
                  <th className="px-6 py-4">Response Time</th>
                  <th className="px-6 py-4">Search Link</th>
                  <th className="px-6 py-4">Submission</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {filteredAgencies.map((agency, index) => (
                    <motion.tr 
                      layout
                      key={agency.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/50 transition-all group"
                    >
                      <td className="px-6 py-4 text-center text-xs font-bold text-slate-400">
                        {index + 1}
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
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>

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
              value={newAgency.name}
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
                value={newAgency.logoUrl}
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
                  value={newAgency.searchLink}
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
                  value={newAgency.submissionLink}
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
                  value={newAgency.country}
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
                  value={newAgency.responseTime}
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
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
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
    </div>
  );
};
