import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Shield, 
  Loader2, 
  Check, 
  Database, 
  BookOpen,
  Wand2,
  Sparkles
} from 'lucide-react';
import { Journal, Client, Publisher, Domain, User as UserType, HECCategory, JournalCategory } from '../types';
import { cn, sanitizeUrl, generateJournalAbbreviation, generateJournalInitials } from '../lib/utils';
import { db, handleFirestoreError, OperationType, getErrorMessage } from '../lib/firebase';
import { geminiService } from '../services/geminiService';
import { collection, onSnapshot, addDoc, query, orderBy, where, doc, getDoc, getDocs, limit } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface JournalFormProps {
  currentUser: UserType;
  onClose: () => void;
  initialClientId?: string;
  initialPublisherId?: string;
  initialDomainId?: string;
  onSuccess?: (journalId: string) => void;
}

export const JournalForm: React.FC<JournalFormProps> = ({ 
  currentUser, 
  onClose, 
  initialClientId = '', 
  initialPublisherId = '', 
  initialDomainId = '',
  onSuccess 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [hecCategories, setHecCategories] = useState<HECCategory[]>([]);
  const [journalCategories, setJournalCategories] = useState<JournalCategory[]>([]);
  const [journalScopes, setJournalScopes] = useState<string[]>([]);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  const [newJournal, setNewJournal] = useState({
    clientId: initialClientId,
    publisherId: initialPublisherId,
    domainId: initialDomainId,
    title: '',
    abbreviation: '',
    initials: '',
    url: '',
    ojsVersion: '',
    sslStatus: 'None' as Journal['sslStatus'],
    chiefEditorName: '',
    contactPersonName: '',
    issnPrint: '',
    issnOnline: '',
    invoiceNumber: '',
    category: '',
    subCategory: '',
    subjectCategory: '',
    publisherCountry: '',
    languages: '',
    license: 'CC BY' as Journal['license'],
    hecMainCategoryId: '',
    hecSubCategoryId: '',
    hecSubjectCategoryId: '',
    scope: [] as string[],
    apcAmount: 0,
    editorEmail: '',
    credentials: [] as any[],
    assignedEmployeeId: '',
    status: 'pending_issn' as Journal['status'],
    isSubscribed: true,
    isOjsSubscribedFromUs: true,
    isIssnSubscribedFromUs: true,
    isHecSubscribedFromUs: true,
    isDoiSubscribedFromUs: true
  });

  useEffect(() => {
    // Basic setup for a new journal if data exists in local storage
    const draft = localStorage.getItem('journal_creation_draft');
    if (draft && !initialClientId && !initialPublisherId && !initialDomainId) {
      try {
        const parsed = JSON.parse(draft);
        setNewJournal(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('journal_creation_draft', JSON.stringify(newJournal));
  }, [newJournal]);

  useEffect(() => {
    const unsubClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snap) => {
      setClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });

    const unsubPublishers = onSnapshot(collection(db, 'publishers'), (snap) => {
      setPublishers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Publisher)));
    });

    const unsubDomains = onSnapshot(collection(db, 'domains'), (snap) => {
      setDomains(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Domain)));
    });

    const unsubEmployees = onSnapshot(query(collection(db, 'users'), where('role', 'in', ['Admin', 'Manager', 'Employee'])), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserType)));
    });

    const unsubHec = onSnapshot(collection(db, 'hec_categories'), (snap) => {
      setHecCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HECCategory)));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setJournalCategories(data.journalCategories || []);
        setJournalScopes(data.journalScopes || []);
      }
    });

    return () => {
      unsubClients();
      unsubPublishers();
      unsubDomains();
      unsubEmployees();
      unsubHec();
      unsubSettings();
    };
  }, []);

  // Fetch relevant data when clientId changes
  useEffect(() => {
    if (!newJournal.clientId) return;

    const fetchIssn = async () => {
      const q = query(
        collection(db, 'issn_requests'), 
        where('clientId', '==', newJournal.clientId),
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const issnData = snap.docs[0].data();
        setNewJournal(prev => ({ 
          ...prev, 
          issnPrint: prev.issnPrint || issnData.issn_print || '',
          issnOnline: prev.issnOnline || issnData.issn_online || ''
        }));
      }
    };

    const fetchInvoice = async () => {
      const q = query(
        collection(db, 'invoices'), 
        where('clientId', '==', newJournal.clientId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const invoiceData = snap.docs[0].data();
        setNewJournal(prev => ({ 
          ...prev, 
          invoiceNumber: prev.invoiceNumber || invoiceData.invoiceNumber || ''
        }));
      }
    };

    fetchIssn();
    fetchInvoice();
  }, [newJournal.clientId]);

  const handleAiSuggestCategory = async () => {
    if (!newJournal.title) return;
    setIsAiSuggesting(true);
    try {
      const suggestion = await geminiService.suggestJournalCategory(newJournal.title, newJournal.scope);
      if (suggestion) {
        setNewJournal(prev => ({ ...prev, category: suggestion }));
        toast.success(`Suggested category: ${suggestion}`);
      }
    } catch (e) {
      toast.error("Failed to get suggestion");
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const assignedEmployee = employees.find(e => e.id === newJournal.assignedEmployeeId);
      const client = clients.find(c => c.id === newJournal.clientId);
      
      const journalToCreate = {
        ...newJournal,
        clientName: client?.name || '',
        url: sanitizeUrl(newJournal.url),
        credentials: (newJournal.credentials || []).map((cred: any) => ({
          ...cred,
          loginLink: sanitizeUrl(cred.loginLink || '')
        })),
        assignedEmployeeName: assignedEmployee?.name || '',
        isSubscribed: newJournal.isSubscribed ?? true,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        isVerified: false
      };

      const docRef = await addDoc(collection(db, 'journals'), journalToCreate);
      
      // Clear draft
      localStorage.removeItem('journal_creation_draft');
      toast.success('Journal created successfully');
      
      if (onSuccess) onSuccess(docRef.id);
      onClose();
    } catch (err: any) {
      const friendlyMessage = getErrorMessage(err);
      setError(friendlyMessage);
      toast.error(friendlyMessage);
      handleFirestoreError(err, OperationType.CREATE, 'journals');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper inside to keep it consistent
  const getCategories = () => {
    const fromData = journalCategories.map(c => c.name);
    return Array.from(new Set([...fromData])).sort();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-600"
          >
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">Select Client (Optional)</label>
        <select 
          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          value={newJournal.clientId || ''}
          onChange={e => setNewJournal(prev => ({ ...prev, clientId: e.target.value, publisherId: '', domainId: '' }))}
          disabled={!!initialClientId}
        >
          <option value="">Choose a client...</option>
          {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(client => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Select Publisher</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={newJournal.publisherId || ''}
            onChange={e => setNewJournal(prev => ({ ...prev, publisherId: e.target.value }))}
            disabled={!!initialPublisherId}
          >
            <option value="">Choose a publisher...</option>
            {publishers
              .filter(p => !newJournal.clientId || p.clientId === newJournal.clientId)
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map(pub => (
                <option key={pub.id} value={pub.id}>{pub.name}</option>
              ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Select Domain</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={newJournal.domainId || ''}
            onChange={e => setNewJournal(prev => ({ ...prev, domainId: e.target.value }))}
            disabled={!!initialDomainId}
          >
            <option value="">Choose a domain...</option>
            {domains
              .filter(d => !newJournal.clientId || d.clientId === newJournal.clientId)
              .sort((a, b) => (a.domainName || '').localeCompare(b.domainName || ''))
              .map(domain => (
                <option key={domain.id} value={domain.id}>{domain.domainName}</option>
              ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Journal Title</label>
          <button 
            type="button"
            onClick={() => {
              const tempTitle = `TEMP-JOURNAL-${new Date().getTime().toString().slice(-6)}`;
              setNewJournal(prev => ({ 
                ...prev, 
                title: tempTitle,
                abbreviation: generateJournalAbbreviation(tempTitle),
                initials: generateJournalInitials(tempTitle)
              }));
            }}
            className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all uppercase tracking-tight"
          >
            Set Temp
          </button>
        </div>
        <input 
          required
          type="text" 
          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
          placeholder="e.g. International Journal of Medical Science"
          value={newJournal.title || ''}
          onChange={e => {
            const title = e.target.value;
            setNewJournal(prev => ({ 
              ...prev, 
              title,
              abbreviation: generateJournalAbbreviation(title),
              initials: generateJournalInitials(title)
            }));
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Abbreviation</label>
          <input 
            type="text" 
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={newJournal.abbreviation || ''}
            onChange={e => setNewJournal(prev => ({ ...prev, abbreviation: e.target.value }))}
            placeholder="Auto-generated"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Initials</label>
          <input 
            type="text" 
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={newJournal.initials || ''}
            onChange={e => setNewJournal(prev => ({ ...prev, initials: e.target.value }))}
            placeholder="Auto-generated"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category</label>
            <button 
              type="button"
              onClick={handleAiSuggestCategory}
              disabled={isAiSuggesting || !newJournal.title}
              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:text-indigo-700 transition-all disabled:opacity-50"
            >
              {isAiSuggesting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              AI Suggest
            </button>
          </div>
          <select 
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={newJournal.category || ''}
            onChange={e => setNewJournal(prev => ({ ...prev, category: e.target.value }))}
          >
            <option value="">Select Category...</option>
            {getCategories().map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">OJS Version</label>
            <label className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 cursor-pointer bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40 hover:bg-amber-100 transition-colors">
              <input 
                type="checkbox"
                className="w-3.5 h-3.5 rounded border-amber-300 dark:border-amber-800 text-amber-600 focus:ring-amber-500"
                checked={newJournal.isOjsSubscribedFromUs}
                onChange={e => setNewJournal(prev => ({ ...prev, isOjsSubscribedFromUs: e.target.checked }))}
              />
              <span>OJS (Us)</span>
            </label>
          </div>
          <select 
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={newJournal.ojsVersion || ''}
            onChange={e => setNewJournal(prev => ({ ...prev, ojsVersion: e.target.value }))}
          >
            <option value="">Select Version</option>
            {[
              '3.3.0.8', '3.3.0.9', '3.3.0.10', '3.3.0.11', '3.3.0.12', 
              '3.3.0.13', '3.3.0.14', '3.3.0.15', '3.3.0.16', '3.3.0.17', 
              '3.3.0.18', '3.3.0.19', '3.3.0.20', '3.3.0.21', '3.4.0.0'
            ].map(v => (
              <option key={v} value={v}>OJS {v}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">SSL Status</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={newJournal.sslStatus || ''}
            onChange={e => setNewJournal(prev => ({ ...prev, sslStatus: e.target.value as any }))}
          >
            <option value="None">None</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">License</label>
          <select 
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={newJournal.license || ''}
            onChange={e => setNewJournal(prev => ({ ...prev, license: e.target.value as any }))}
          >
            <option value="CC BY">CC BY</option>
            <option value="CC BY-SA">CC BY-SA</option>
            <option value="CC BY-ND">CC BY-ND</option>
            <option value="CC BY-NC">CC BY-NC</option>
            <option value="CC BY-NC-SA">CC BY-NC-SA</option>
            <option value="CC BY-NC-ND">CC BY-NC-ND</option>
            <option value="CC0">CC0</option>
            <option value="Public Domain">Public Domain</option>
            <option value="Publisher’s Own License">Publisher’s Own License</option>
          </select>
        </div>
      </div>

      {/* HEC Section with HEC (Us) toggle */}
      <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-200">
            <Database size={16} className="text-indigo-600 dark:text-indigo-400" />
            <span>HEC Category Management</span>
          </div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 cursor-pointer bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-md border border-amber-200/60 dark:border-amber-900/40 hover:bg-amber-100 transition-colors">
            <input 
              type="checkbox"
              className="w-3.5 h-3.5 rounded border-amber-300 dark:border-amber-800 text-amber-600 focus:ring-amber-500"
              checked={newJournal.isHecSubscribedFromUs}
              onChange={e => setNewJournal(prev => ({ ...prev, isHecSubscribedFromUs: e.target.checked }))}
            />
            <span>HEC (Us)</span>
          </label>
        </div>
        
        {newJournal.isHecSubscribedFromUs ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">HEC Main</label>
              <select 
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newJournal.hecMainCategoryId || ''}
                onChange={e => setNewJournal(prev => ({ ...prev, hecMainCategoryId: e.target.value, hecSubCategoryId: '', hecSubjectCategoryId: '' }))}
              >
                <option value="">Select...</option>
                {hecCategories.filter(c => c.type === 'main').map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">HEC Sub</label>
              <select 
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newJournal.hecSubCategoryId || ''}
                onChange={e => setNewJournal(prev => ({ ...prev, hecSubCategoryId: e.target.value, hecSubjectCategoryId: '' }))}
                disabled={!newJournal.hecMainCategoryId}
              >
                <option value="">Select...</option>
                {hecCategories.filter(c => c.type === 'sub' && c.parentId === newJournal.hecMainCategoryId).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">HEC Subject</label>
              <select 
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={newJournal.hecSubjectCategoryId || ''}
                onChange={e => setNewJournal(prev => ({ ...prev, hecSubjectCategoryId: e.target.value }))}
                disabled={!newJournal.hecSubCategoryId}
              >
                <option value="">Select...</option>
                {hecCategories.filter(c => c.type === 'subject' && c.parentId === newJournal.hecSubCategoryId).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">Check "HEC (Us)" to enable HEC Category management for this journal.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">URL</label>
          <input 
            type="url"
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={newJournal.url || ''}
            onChange={e => setNewJournal(prev => ({ ...prev, url: e.target.value }))}
            placeholder=" https://..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Languages</label>
          <input 
            type="text"
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={newJournal.languages || ''}
            onChange={e => setNewJournal(prev => ({ ...prev, languages: e.target.value }))}
            placeholder="e.g. English, Urdu"
          />
        </div>
      </div>

      {/* ISSN Section with ISSN (Us) toggle */}
      <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-200">
            <BookOpen size={16} className="text-indigo-600 dark:text-indigo-400" />
            <span>ISSN Registration</span>
          </div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 cursor-pointer bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-md border border-amber-200/60 dark:border-amber-900/40 hover:bg-amber-100 transition-colors">
            <input 
              type="checkbox"
              className="w-3.5 h-3.5 rounded border-amber-300 dark:border-amber-800 text-amber-600 focus:ring-amber-500"
              checked={newJournal.isIssnSubscribedFromUs}
              onChange={e => setNewJournal(prev => ({ ...prev, isIssnSubscribedFromUs: e.target.checked }))}
            />
            <span>ISSN (Us)</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">ISSN Print</label>
            <input 
              type="text"
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={newJournal.issnPrint || ''}
              onChange={e => setNewJournal(prev => ({ ...prev, issnPrint: e.target.value }))}
              placeholder="e.g. 1234-5678"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">ISSN Online</label>
            <input 
              type="text"
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={newJournal.issnOnline || ''}
              onChange={e => setNewJournal(prev => ({ ...prev, issnOnline: e.target.value }))}
              placeholder="e.g. 8765-4321"
            />
          </div>
        </div>
      </div>

      {/* DOI Section with DOI (Us) toggle */}
      <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-200">
            <Shield size={16} className="text-indigo-600 dark:text-indigo-400" />
            <span>DOI Services (Crossref)</span>
          </div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 cursor-pointer bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-md border border-amber-200/60 dark:border-amber-900/40 hover:bg-amber-100 transition-colors">
            <input 
              type="checkbox"
              className="w-3.5 h-3.5 rounded border-amber-300 dark:border-amber-800 text-amber-600 focus:ring-amber-500"
              checked={newJournal.isDoiSubscribedFromUs}
              onChange={e => setNewJournal(prev => ({ ...prev, isDoiSubscribedFromUs: e.target.checked }))}
            />
            <span>DOI (Us)</span>
          </label>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          {newJournal.isDoiSubscribedFromUs 
            ? "DOI allocation and Crossref deposits are active under our organization's membership." 
            : "Toggle 'DOI (Us)' if DOI registration services are managed through us."}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">Assign Employee</label>
        <select 
          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          value={newJournal.assignedEmployeeId || ''}
          onChange={e => setNewJournal(prev => ({ ...prev, assignedEmployeeId: e.target.value }))}
        >
          <option value="">Select Employee...</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <input 
          type="checkbox"
          id="journalIsSubscribedAction"
          className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          checked={newJournal.isSubscribed}
          onChange={e => setNewJournal(prev => ({ ...prev, isSubscribed: e.target.checked }))}
        />
        <label htmlFor="journalIsSubscribedAction" className="text-sm font-bold text-slate-700 cursor-pointer">
          Official Subscription
          <p className="text-[10px] text-slate-400 font-medium italic">Enables full client features.</p>
        </label>
      </div>

      <div className="pt-6 flex gap-3">
        <button 
          type="button"
          onClick={onClose}
          className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
        >
          Cancel
        </button>
        <button 
          type="submit"
          disabled={isSubmitting}
          className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Saving...
            </>
          ) : (
            <>
              <Plus size={20} />
              Create Journal
            </>
          )}
        </button>
      </div>
    </form>
  );
};
