import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Globe, 
  Shield, 
  Key, 
  User, 
  Calendar, 
  ExternalLink, 
  Copy, 
  Check,
  BookOpen,
  Edit,
  Trash2,
  Save,
  X,
  History,
  GraduationCap,
  Plus,
  Clock,
  User as UserIcon,
  Activity,
  DollarSign
} from 'lucide-react';
import { Journal, User as UserType, JournalIndexing, IndexingAgency, Client, Publisher } from '../types';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { doc, updateDoc, onSnapshot, serverTimestamp, collection, query, where, addDoc, orderBy, limit } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { geminiService } from '../services/geminiService';
import { Sparkles, Loader2 } from 'lucide-react';

import { JournalIndexingManager } from './JournalIndexingManager';
import { Modal } from './Modal';

interface JournalDetailProps {
  journalId: string;
  onBack: () => void;
  currentUser: UserType | null;
  initialEditMode?: boolean;
}

export const JournalDetail: React.FC<JournalDetailProps> = ({ 
  journalId, 
  onBack, 
  currentUser,
  initialEditMode = false
}) => {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Journal>>({});
  const [indexingRecords, setIndexingRecords] = useState<JournalIndexing[]>([]);
  const [agencies, setAgencies] = useState<IndexingAgency[]>([]);
  const [isIndexingModalOpen, setIsIndexingModalOpen] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [scholarHistory, setScholarHistory] = useState<any[]>([]);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [newScholarLog, setNewScholarLog] = useState({ status: 'Indexed', tagOptimization: '' });
  const [isScholarModalOpen, setIsScholarModalOpen] = useState(false);

  const [aiHealth, setAiHealth] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleGetAiHealth = async () => {
    if (!journal) return;
    setIsAiLoading(true);
    setIsAiModalOpen(true);
    try {
      const health = await geminiService.getJournalHealth({
        title: journal.title,
        status: journal.status,
        category: journal.category,
        ojsVersion: journal.ojsVersion,
        issnPrint: journal.issnPrint,
        issnOnline: journal.issnOnline,
        indexingCount: indexingRecords.length
      });
      setAiHealth(health);
    } catch (error) {
      setAiHealth("Failed to generate health check.");
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    setIsEditing(initialEditMode);
  }, [initialEditMode]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'journals', journalId), (doc) => {
      if (doc.exists()) {
        const data = { id: doc.id, ...doc.data() } as Journal;
        setJournal(data);
        // Initialize editData on first load or when not editing
        setEditData(prev => {
          if (Object.keys(prev).length === 0 || !isEditing) {
            return data;
          }
          return prev;
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'journals');
      setLoading(false);
    });

    const unsubIndexing = onSnapshot(query(collection(db, 'journal_indexing'), where('journalId', '==', journalId)), (snapshot) => {
      setIndexingRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalIndexing)));
    });

    const unsubAgencies = onSnapshot(collection(db, 'indexing_agencies'), (snapshot) => {
      setAgencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IndexingAgency)));
    });

    const unsubActivities = onSnapshot(
      query(collection(db, 'journal_activities'), where('journalId', '==', journalId), orderBy('timestamp', 'desc'), limit(20)),
      (snapshot) => {
        setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubScholar = onSnapshot(
      query(collection(db, 'google_scholar_history'), where('journalId', '==', journalId), orderBy('timestamp', 'desc')),
      (snapshot) => {
        setScholarHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubEmployees = onSnapshot(
      query(collection(db, 'users'), where('role', 'in', ['Admin', 'Manager', 'Employee']), where('status', '==', 'active')),
      (snapshot) => {
        setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserType)));
      }
    );

    const unsubClients = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'Client'), where('status', '==', 'active')),
      (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      }
    );

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setGlobalSettings(doc.data());
      }
    });

    return () => {
      unsub();
      unsubIndexing();
      unsubAgencies();
      unsubActivities();
      unsubScholar();
      unsubEmployees();
      unsubClients();
      unsubSettings();
    };
  }, [journalId]);

  useEffect(() => {
    if (!journal?.clientId) return;

    const unsubDomains = onSnapshot(
      query(collection(db, 'domains'), where('clientId', '==', journal.clientId), where('status', '==', 'active')),
      (snapshot) => {
        setDomains(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubPublishers = onSnapshot(
      query(collection(db, 'publishers'), where('clientId', '==', journal.clientId)),
      (snapshot) => {
        setPublishers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Publisher)));
      }
    );

    return () => {
      unsubDomains();
      unsubPublishers();
    };
  }, [journal?.clientId]);

  useEffect(() => {
    if (!journalId || !isEditing) return;

    // Fetch latest ISSN Request for this journal to auto-fill metadata
    const unsubIssn = onSnapshot(
      query(collection(db, 'issn_requests'), where('journalId', '==', journalId), orderBy('createdAt', 'desc'), limit(1)),
      (snapshot) => {
        if (!snapshot.empty) {
          const issnData = snapshot.docs[0].data();
          setEditData(prev => ({
            ...prev,
            issnPrint: prev.issnPrint || issnData.printIssn || '',
            issnOnline: prev.issnOnline || issnData.onlineIssn || '',
            languages: prev.languages || issnData.language || '',
            publisherCountry: prev.publisherCountry || issnData.country || ''
          }));
        }
      }
    );

    // Fetch latest Invoice for this journal to auto-fill invoice number
    const unsubInvoice = onSnapshot(
      query(collection(db, 'invoices'), where('journalId', '==', journalId), orderBy('createdAt', 'desc'), limit(1)),
      (snapshot) => {
        if (!snapshot.empty) {
          const invoiceData = snapshot.docs[0].data();
          setEditData(prev => ({
            ...prev,
            invoiceNumber: prev.invoiceNumber || invoiceData.invoiceNumber || ''
          }));
        }
      }
    );

    return () => {
      unsubIssn();
      unsubInvoice();
    };
  }, [journalId, isEditing]);

  const logActivity = async (action: string) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'journal_activities'), {
        journalId,
        employeeName: currentUser.name,
        action,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const handleAddScholarLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'google_scholar_history'), {
        journalId,
        ...newScholarLog,
        employeeName: currentUser.name,
        timestamp: serverTimestamp()
      });
      setIsScholarModalOpen(false);
      setNewScholarLog({ status: 'Indexed', tagOptimization: '' });
      logActivity(`Updated Google Scholar History: ${newScholarLog.status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'google_scholar_history');
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = async () => {
    if (!journal) return;
    try {
      await updateDoc(doc(db, 'journals', journalId), {
        ...editData,
        updatedAt: serverTimestamp()
      });
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        setIsEditing(false);
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journals');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!journal) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Journal not found.</p>
        <button onClick={onBack} className="mt-4 text-indigo-600 font-bold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all font-bold group"
        >
          <div className="p-2 bg-white border border-slate-200 rounded-xl group-hover:border-slate-300 shadow-sm">
            <ArrowLeft size={20} />
          </div>
          Back
        </button>
        <div className="flex gap-3">
          {!isEditing && (
            <button 
              onClick={handleGetAiHealth}
              className="px-5 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-bold hover:bg-indigo-100 transition-all shadow-sm flex items-center gap-2"
            >
              <Sparkles size={18} />
              AI Health Check
            </button>
          )}
          {isEditing ? (
            <>
              <button 
                onClick={() => setIsEditing(false)}
                className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaved}
                className={cn(
                  "px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2",
                  isSaved 
                    ? "bg-emerald-600 text-white shadow-emerald-200" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
                )}
              >
                {isSaved ? (
                  <>
                    <Check size={18} />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <Edit size={18} />
              Edit Journal
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <BookOpen size={32} />
                </div>
                <div>
                  {isEditing ? (
                    <div className="space-y-4 w-full">
                      <input 
                        type="text"
                        className="text-2xl font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                        value={editData.title || ''}
                        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                        placeholder="Journal Title"
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Database Type</span>
                          <select 
                            className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={editData.databaseType || 'HEC'}
                            onChange={(e) => setEditData({ ...editData, databaseType: e.target.value as any })}
                          >
                            <option value="HEC">HEC Journals</option>
                            <option value="ISSN">ISSN Journals</option>
                            <option value="DOAJ">DOAJ Journals</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">License</span>
                          <select 
                            className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={editData.license || 'CC BY'}
                            onChange={(e) => setEditData({ ...editData, license: e.target.value as any })}
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

                      {editData.databaseType === 'HEC' ? (
                        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Main Category</span>
                            <input 
                              type="text"
                              className="w-full text-sm font-medium bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                              value={editData.hecMainCategory || ''}
                              onChange={(e) => setEditData({ ...editData, hecMainCategory: e.target.value })}
                              placeholder="Main"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Sub Category</span>
                            <input 
                              type="text"
                              className="w-full text-sm font-medium bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                              value={editData.hecSubCategory || ''}
                              onChange={(e) => setEditData({ ...editData, hecSubCategory: e.target.value })}
                              placeholder="Sub"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Third Category</span>
                            <input 
                              type="text"
                              className="w-full text-sm font-medium bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                              value={editData.hecThirdCategory || ''}
                              onChange={(e) => setEditData({ ...editData, hecThirdCategory: e.target.value })}
                              placeholder="Third"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Subject Category</span>
                          <input 
                            type="text"
                            className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={editData.subjectCategory || ''}
                            onChange={(e) => setEditData({ ...editData, subjectCategory: e.target.value })}
                            placeholder="Subject Category"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Publisher's Country</span>
                          <input 
                            type="text"
                            className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={editData.publisherCountry || ''}
                            onChange={(e) => setEditData({ ...editData, publisherCountry: e.target.value })}
                            placeholder="Country"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Languages</span>
                          <input 
                            type="text"
                            className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={editData.languages || ''}
                            onChange={(e) => setEditData({ ...editData, languages: e.target.value })}
                            placeholder="Languages"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Legacy Category</span>
                          <select 
                            className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={editData.category || ''}
                            onChange={(e) => setEditData({ ...editData, category: e.target.value, subCategory: '' })}
                          >
                            <option value="">Select Category</option>
                            {globalSettings?.journalCategories?.map((cat: any) => (
                              <option key={cat.name} value={cat.name}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Legacy Sub-Category</span>
                          <select 
                            className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={editData.subCategory || ''}
                            onChange={(e) => setEditData({ ...editData, subCategory: e.target.value })}
                            disabled={!editData.category}
                          >
                            <option value="">Select Sub-Category</option>
                            {globalSettings?.journalCategories?.find((cat: any) => cat.name === editData.category)?.subCategories?.map((sub: string) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h1 className="text-2xl font-black text-slate-900">{journal.title}</h1>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase">
                          {journal.databaseType || 'HEC'}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                          {journal.license || 'CC BY'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm">
                        {journal.databaseType === 'HEC' ? (
                          <p className="text-slate-500 font-medium">
                            {journal.hecMainCategory || 'No Main Category'} 
                            {journal.hecSubCategory && ` • ${journal.hecSubCategory}`}
                            {journal.hecThirdCategory && ` • ${journal.hecThirdCategory}`}
                          </p>
                        ) : (
                          <p className="text-slate-500 font-medium">
                            Subject: {journal.subjectCategory || 'Not set'}
                          </p>
                        )}
                        <p className="text-slate-400 text-xs mt-1">
                          {journal.publisherCountry && `Country: ${journal.publisherCountry}`}
                          {journal.languages && ` • Languages: ${journal.languages}`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {isEditing ? (
                <select 
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-wider"
                  value={editData.status || 'pending_issn'}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value as any })}
                >
                  <option value="complete">Complete</option>
                  <option value="pending_issn">Pending ISSN</option>
                </select>
              ) : (
                <span className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider",
                  journal.status === 'complete' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                )}>
                  {journal.status.replace('_', ' ')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Journal Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Globe size={18} className="text-slate-400" />
                    {isEditing ? (
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Domain</span>
                        <select 
                          className="text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editData.domainId || ''}
                          onChange={(e) => setEditData({ ...editData, domainId: e.target.value })}
                        >
                          <option value="">Select Domain</option>
                          {domains.map(d => (
                            <option key={d.id} value={d.id}>{d.domainName}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-sm font-medium">Domain: {domains.find(d => d.id === journal.domainId)?.domainName || 'N/A'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Globe size={18} className="text-slate-400" />
                    {isEditing ? (
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">OJS Version</span>
                        <input 
                          type="text"
                          className="text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editData.ojsVersion || ''}
                          onChange={(e) => setEditData({ ...editData, ojsVersion: e.target.value })}
                          placeholder="OJS Version"
                        />
                      </div>
                    ) : (
                      <span className="text-sm font-medium">OJS Version: {journal.ojsVersion || 'N/A'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Shield size={18} className="text-slate-400" />
                    {isEditing ? (
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">SSL Status</span>
                        <select 
                          className="text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editData.sslStatus || 'None'}
                          onChange={(e) => setEditData({ ...editData, sslStatus: e.target.value as any })}
                        >
                          <option value="Active">Active</option>
                          <option value="Expired">Expired</option>
                          <option value="Pending">Pending</option>
                          <option value="None">None</option>
                        </select>
                      </div>
                    ) : (
                      <span className="text-sm font-medium">SSL: {journal.sslStatus || 'None'}</span>
                    )}
                  </div>
                  {isEditing && (
                    <div className="flex items-center gap-3 text-slate-600">
                      <DollarSign size={18} className="text-slate-400" />
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">APC Amount</span>
                        <input 
                          type="number"
                          className="text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                          value={editData.apcAmount || 0}
                          onChange={(e) => setEditData({ ...editData, apcAmount: Number(e.target.value) })}
                          placeholder="APC Amount"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-slate-600">
                    <Calendar size={18} className="text-slate-400" />
                    <span className="text-sm font-medium">
                      Created: {journal.createdAt ? (
                        typeof journal.createdAt === 'string' 
                          ? new Date(journal.createdAt).toLocaleDateString()
                          : new Date((journal.createdAt as any).seconds * 1000).toLocaleDateString()
                      ) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">ISSN & Metadata</h3>
                <div className="space-y-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Print ISSN</span>
                    {isEditing ? (
                      <input 
                        type="text"
                        className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editData.issnPrint || ''}
                        onChange={(e) => setEditData({ ...editData, issnPrint: e.target.value })}
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-700">{journal.issnPrint || 'Not Assigned'}</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Online ISSN</span>
                    {isEditing ? (
                      <input 
                        type="text"
                        className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editData.issnOnline || ''}
                        onChange={(e) => setEditData({ ...editData, issnOnline: e.target.value })}
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-700">{journal.issnOnline || 'Not Assigned'}</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Invoice Number</span>
                    {isEditing ? (
                      <input 
                        type="text"
                        className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editData.invoiceNumber || ''}
                        onChange={(e) => setEditData({ ...editData, invoiceNumber: e.target.value })}
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-700">{journal.invoiceNumber || 'N/A'}</span>
                    )}
                  </div>
                  {isEditing && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Scope</span>
                      <textarea 
                        className="text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                        value={editData.scope || ''}
                        onChange={(e) => setEditData({ ...editData, scope: e.target.value })}
                        placeholder="Journal Scope"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Indexing Status Section */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Globe className="text-emerald-600" size={20} />
                <h3 className="text-lg font-bold text-slate-900">Indexing Status</h3>
              </div>
              <button 
                onClick={() => setIsIndexingModalOpen(true)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
              >
                Manage Indexing
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Indexed</p>
                <p className="text-2xl font-black text-emerald-700">
                  {indexingRecords.filter(r => r.status === 'indexed').length}
                </p>
              </div>
              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Pending</p>
                <p className="text-2xl font-black text-amber-700">
                  {indexingRecords.filter(r => r.status === 'pending').length}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Not Indexed</p>
                <p className="text-2xl font-black text-slate-600">
                  {agencies.length - indexingRecords.filter(r => r.status === 'indexed' || r.status === 'pending').length}
                </p>
              </div>
            </div>

            {indexingRecords.filter(r => r.status === 'indexed').length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Indexing Links</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {indexingRecords.filter(r => r.status === 'indexed').map(record => {
                    const agency = agencies.find(a => a.id === record.agencyId);
                    return (
                      <div key={record.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-slate-50 flex items-center justify-center overflow-hidden p-0.5">
                            <img src={agency?.logoUrl} alt={agency?.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{agency?.name}</span>
                        </div>
                        <a 
                          href={record.journalPageUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Access & Credentials Section */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <div className="flex items-center gap-2 mb-6">
              <Key className="text-indigo-600" size={20} />
              <h3 className="text-lg font-bold text-slate-900">Access & Credentials</h3>
            </div>
            
            <div className="space-y-6">
              {/* URLs Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Journal Website URL</span>
                    {!isEditing && journal.url && (
                      <a 
                        href={journal.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-indigo-600"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  {isEditing ? (
                    <input 
                      type="url"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editData.url || ''}
                      onChange={(e) => setEditData({ ...editData, url: e.target.value })}
                      placeholder="https://journal-website.com"
                    />
                  ) : (
                    <p className="font-bold text-slate-700 truncate">{journal.url || 'Not set'}</p>
                  )}
                </div>

                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 uppercase">Admin Login URL</span>
                    {!isEditing && journal.credentials?.loginLink && (
                      <a 
                        href={journal.credentials.loginLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-white rounded-lg transition-all text-indigo-400 hover:text-indigo-600"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  {isEditing ? (
                    <input 
                      type="url"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editData.credentials?.loginLink || ''}
                      onChange={(e) => setEditData({ 
                        ...editData, 
                        credentials: { ...editData.credentials, loginLink: e.target.value } 
                      })}
                      placeholder="https://journal-admin-login.com"
                    />
                  ) : (
                    <p className="font-bold text-indigo-700 truncate">{journal.credentials?.loginLink || 'Not set'}</p>
                  )}
                </div>
              </div>

              {/* Credentials Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Login Username</span>
                    {!isEditing && (
                      <button 
                        onClick={() => handleCopy(journal.credentials?.email || '', 'email')}
                        className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-indigo-600"
                      >
                        {copiedField === 'email' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <input 
                      type="text"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editData.credentials?.email || ''}
                      onChange={(e) => setEditData({ 
                        ...editData, 
                        credentials: { ...editData.credentials, email: e.target.value } 
                      })}
                      placeholder="Username"
                    />
                  ) : (
                    <p className="font-bold text-slate-700 truncate">{journal.credentials?.email || 'Not set'}</p>
                  )}
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Login Password</span>
                    {!isEditing && (
                      <button 
                        onClick={() => handleCopy(journal.credentials?.password || '', 'password')}
                        className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-indigo-600"
                      >
                        {copiedField === 'password' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <input 
                      type="text"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editData.credentials?.password || ''}
                      onChange={(e) => setEditData({ 
                        ...editData, 
                        credentials: { ...editData.credentials, password: e.target.value } 
                      })}
                      placeholder="Password"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-700 font-mono">
                        {journal.credentials?.password ? '••••••••' : 'Not set'}
                      </p>
                      {journal.credentials?.password && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded font-bold uppercase">Secret</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Assignment & Meta */}
        <div className="space-y-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Activity size={18} className="text-indigo-600" />
              Activity Window
            </h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
              {activities.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">No recent activities.</p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 relative pb-4 last:pb-0">
                    <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-100 last:hidden" />
                    <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 z-10">
                      <Clock size={12} className="text-indigo-600" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900">
                        <span className="text-indigo-600">{activity.employeeName}</span> {activity.action}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {activity.timestamp ? (
                          typeof activity.timestamp === 'string'
                            ? new Date(activity.timestamp).toLocaleString()
                            : activity.timestamp.toDate().toLocaleString()
                        ) : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap size={18} className="text-indigo-600" />
                Scholar History
              </h3>
              <button 
                onClick={() => setIsScholarModalOpen(true)}
                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
              {scholarHistory.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">No scholar logs found.</p>
              ) : (
                scholarHistory.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        log.status === 'Indexed' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {log.status}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {log.timestamp ? (
                          typeof log.timestamp === 'string'
                            ? new Date(log.timestamp).toLocaleDateString()
                            : log.timestamp.toDate().toLocaleDateString()
                        ) : 'N/A'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">{log.tagOptimization}</p>
                    <p className="text-[10px] text-slate-400 italic">By: {log.employeeName}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Assigned Personnel</h3>
            {isEditing ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Responsible Employee</label>
                  <select 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editData.assignedEmployeeId || ''}
                    onChange={(e) => {
                      const emp = employees.find(emp => emp.id === e.target.value);
                      setEditData({ 
                        ...editData, 
                        assignedEmployeeId: e.target.value,
                        assignedEmployeeName: emp?.name || ''
                      });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  {journal.assignedEmployeeName?.charAt(0) || <User size={24} />}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{journal.assignedEmployeeName || 'Unassigned'}</p>
                  <p className="text-xs text-slate-500">Responsible Employee</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Client & Editor Info</h3>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Owner Client</p>
                {isEditing ? (
                  <select 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editData.clientId || ''}
                    onChange={(e) => {
                      const client = clients.find(c => c.id === e.target.value);
                      setEditData({ 
                        ...editData, 
                        clientId: e.target.value,
                        clientName: client?.name || ''
                      });
                    }}
                  >
                    <option value="">Select Client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                ) : (
                  <>
                    <p className="font-bold text-slate-900">{journal.clientName}</p>
                    <p className="text-xs text-slate-500 mt-1">ID: {journal.clientId}</p>
                  </>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Publisher</p>
                {isEditing ? (
                  <select 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editData.publisherId || ''}
                    onChange={(e) => setEditData({ ...editData, publisherId: e.target.value })}
                  >
                    <option value="">Select Publisher</option>
                    {publishers.map(pub => (
                      <option key={pub.id} value={pub.id}>{pub.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="font-bold text-slate-900">{publishers.find(p => p.id === journal.publisherId)?.name || 'N/A'}</p>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase">Editor Email</p>
                {isEditing ? (
                  <input 
                    type="email"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editData.editorEmail || ''}
                    onChange={(e) => setEditData({ ...editData, editorEmail: e.target.value })}
                    placeholder="Editor Email"
                  />
                ) : (
                  <p className="font-bold text-slate-700">{journal.editorEmail || 'Not Set'}</p>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase">Chief Editor</p>
                {isEditing ? (
                  <input 
                    type="text"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editData.chiefEditorName || ''}
                    onChange={(e) => setEditData({ ...editData, chiefEditorName: e.target.value })}
                    placeholder="Chief Editor Name"
                  />
                ) : (
                  <p className="font-bold text-slate-700">{journal.chiefEditorName || 'Not Set'}</p>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase">Contact Person</p>
                {isEditing ? (
                  <input 
                    type="text"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editData.contactPersonName || ''}
                    onChange={(e) => setEditData({ ...editData, contactPersonName: e.target.value })}
                    placeholder="Contact Person Name"
                  />
                ) : (
                  <p className="font-bold text-slate-700">{journal.contactPersonName || 'Not Set'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Health Modal */}
      <Modal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        title="Gemini AI Health Check"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <div className="p-3 bg-white text-indigo-600 rounded-xl shadow-sm">
              <Sparkles size={24} />
            </div>
            <div>
              <h4 className="font-bold text-indigo-900">Journal Health Analysis</h4>
              <p className="text-xs text-indigo-600">Powered by Gemini 1.5 Flash</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 min-h-[200px] relative">
            {isAiLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-sm font-medium">Analyzing journal data...</p>
              </div>
            ) : (
              <div className="prose prose-slate prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {aiHealth}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsAiModalOpen(false)}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            Close Health Check
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={isIndexingModalOpen} 
        onClose={() => setIsIndexingModalOpen(false)}
        title="Journal Indexing Manager"
        maxWidth="4xl"
      >
        <JournalIndexingManager 
          journal={journal} 
          onClose={() => setIsIndexingModalOpen(false)} 
          currentUser={currentUser}
        />
      </Modal>

      {/* Google Scholar Log Modal */}
      <Modal
        isOpen={isScholarModalOpen}
        onClose={() => setIsScholarModalOpen(false)}
        title="Add Scholar History Log"
      >
        <form onSubmit={handleAddScholarLog} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Indexing Status</label>
            <select 
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={newScholarLog.status}
              onChange={(e) => setNewScholarLog({ ...newScholarLog, status: e.target.value })}
            >
              <option value="Indexed">Indexed</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
              <option value="Tag Optimization">Tag Optimization</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Tag Optimization / Notes</label>
            <textarea 
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
              placeholder="Enter tag optimization details or status notes..."
              value={newScholarLog.tagOptimization}
              onChange={(e) => setNewScholarLog({ ...newScholarLog, tagOptimization: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsScholarModalOpen(false)}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              Add Log
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
