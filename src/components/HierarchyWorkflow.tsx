import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Globe, 
  BookOpen, 
  ChevronRight, 
  Plus, 
  Search, 
  ArrowLeft,
  ExternalLink,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Settings,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, Publisher, Domain, Journal, User as UserType, DomainRegistrar } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Modal } from './Modal';
import { DomainManager } from './DomainManager';
import { JournalForm } from './JournalForm';
import { JournalDetail } from './JournalDetail';
import { recommendationService } from '../services/recommendationService';

interface HierarchyWorkflowProps {
  client: Client;
  currentUser: UserType;
}

export const HierarchyWorkflow: React.FC<HierarchyWorkflowProps> = ({ client, currentUser }) => {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [registrars, setRegistrars] = useState<DomainRegistrar[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state for drill-down
  const [selectedPublisherId, setSelectedPublisherId] = useState<string | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [selectedJournalId, setSelectedJournalId] = useState<{ id: string, editMode: boolean } | null>(null);

  // Modals
  const [isPublisherModalOpen, setIsPublisherModalOpen] = useState(false);
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);

  const [newPublisher, setNewPublisher] = useState({ name: '', ownerName: '' });
  const [newDomain, setNewDomain] = useState({ domainName: '', registrar: '', registrarId: '' });
  const [newJournal, setNewJournal] = useState({ title: '', ojsVersion: '3.3.0.21' });

  const handleAddPublisher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'publishers'), {
        clientId: client.id,
        ...newPublisher,
        secpRegistration: 'Pending',
        ntn: 'Pending',
        documents: { aoa: '', moa: '', cnic: '', certificates: [] },
        createdAt: serverTimestamp()
      });
      setIsPublisherModalOpen(false);
      setNewPublisher({ name: '', ownerName: '' });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'publishers');
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPublisherId) return;
    try {
      await addDoc(collection(db, 'domains'), {
        clientId: client.id,
        publisherId: selectedPublisherId,
        ...newDomain,
        status: 'active',
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: serverTimestamp()
      });
      setIsDomainModalOpen(false);
      setNewDomain({ domainName: '', registrar: '', registrarId: '' });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'domains');
    }
  };

  const handleAddJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDomainId || !selectedPublisherId) return;
    try {
      await addDoc(collection(db, 'journals'), {
        clientId: client.id,
        publisherId: selectedPublisherId,
        domainId: selectedDomainId,
        ...newJournal,
        status: 'pending_issn',
        createdAt: serverTimestamp()
      });
      setIsJournalModalOpen(false);
      setNewJournal({ title: '', ojsVersion: '3.3.0.21' });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'journals');
    }
  };

  useEffect(() => {
    const unsubPublishers = onSnapshot(
      query(collection(db, 'publishers'), where('clientId', '==', client.id)),
      (snap) => setPublishers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Publisher)))
    );

    const unsubDomains = onSnapshot(
      query(collection(db, 'domains'), where('clientId', '==', client.id)),
      (snap) => setDomains(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Domain)))
    );

    const unsubJournals = onSnapshot(
      query(collection(db, 'journals'), where('clientId', '==', client.id)),
      (snap) => {
        setJournals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal)));
        setLoading(false);
      }
    );

    const unsubRegistrars = onSnapshot(query(collection(db, 'registrars')), (snap) => {
      setRegistrars(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DomainRegistrar)));
    });

    return () => {
      unsubPublishers();
      unsubDomains();
      unsubJournals();
      unsubRegistrars();
    };
  }, [client.id]);

  const selectedPublisher = publishers.find(p => p.id === selectedPublisherId);
  const selectedDomain = domains.find(d => d.id === selectedDomainId);

  const filteredDomains = selectedPublisherId 
    ? domains.filter(d => d.publisherId === selectedPublisherId)
    : [];

  const filteredJournals = selectedDomainId
    ? journals.filter(j => j.domainId === selectedDomainId)
    : [];

  const isEmployee = currentUser.role === 'Admin' || currentUser.role === 'Manager' || currentUser.role === 'Employee';

  return (
    <div className="space-y-6">
      {/* Workflow Progress Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles size={120} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-indigo-200" />
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-100">Intelligent Workflow</span>
          </div>
          <h2 className="text-2xl font-black mb-1">
            {!selectedPublisherId ? "Step 1: Setup Publisher" : 
             !selectedDomainId ? "Step 2: Secure Domain" : 
             "Step 3: Launch Journal"}
          </h2>
          <p className="text-indigo-100 text-sm font-medium opacity-90">
            {!selectedPublisherId ? "Every great publication starts with a solid publishing house. Let's set yours up." : 
             !selectedDomainId ? `Great! ${selectedPublisher?.name} is ready. Now secure a domain for your journals.` : 
             `Domain ${selectedDomain?.domainName} is active. Time to launch your first journal.`}
          </p>
        </div>
      </div>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
        <button 
          onClick={() => {
            setSelectedPublisherId(null);
            setSelectedDomainId(null);
          }}
          className={cn("hover:text-indigo-600 transition-colors", !selectedPublisherId && "text-indigo-600")}
        >
          Publishers
        </button>
        {selectedPublisherId && (
          <>
            <ChevronRight size={12} />
            <button 
              onClick={() => setSelectedDomainId(null)}
              className={cn("hover:text-indigo-600 transition-colors", selectedPublisherId && !selectedDomainId && "text-indigo-600")}
            >
              {selectedPublisher?.name}
            </button>
          </>
        )}
        {selectedDomainId && (
          <>
            <ChevronRight size={12} />
            <span className="text-indigo-600">{selectedDomain?.domainName}</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="wait">
          {!selectedPublisherId ? (
            <motion.div 
              key="publishers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Select a Publisher</h3>
                {isEmployee && (
                  <button 
                    onClick={() => setIsPublisherModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                  >
                    <Plus size={14} /> Add Publisher
                  </button>
                )}
              </div>
              {publishers.length === 0 ? (
                <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <Building2 className="mx-auto text-slate-300 mb-4" size={48} />
                  <p className="text-slate-500 font-medium">No publishers found for this client.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...publishers].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(pub => (
                    <button
                      key={pub.id}
                      onClick={() => setSelectedPublisherId(pub.id)}
                      className="p-6 bg-white border border-slate-100 rounded-3xl text-left hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <Building2 size={24} />
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1">{pub.name}</h4>
                      <p className="text-xs text-slate-500 mb-4 line-clamp-1">{pub.ownerName}</p>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {domains.filter(d => d.publisherId === pub.id).length} Domains
                        </span>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : !selectedDomainId ? (
            <motion.div 
              key="domains"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedPublisherId(null)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Domains under {selectedPublisher?.name}</h3>
                    <p className="text-xs text-slate-500">Select a domain to view journals.</p>
                  </div>
                </div>
                {isEmployee && (
                  <button 
                    onClick={() => setIsDomainModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                  >
                    <Plus size={14} /> Add Domain
                  </button>
                )}
              </div>
              {filteredDomains.length === 0 ? (
                <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <Globe className="mx-auto text-slate-300 mb-4" size={48} />
                  <p className="text-slate-500 font-medium">No domains found for this publisher.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...filteredDomains].sort((a, b) => (a.domainName || '').localeCompare(b.domainName || '')).map(dom => (
                    <button
                      key={dom.id}
                      onClick={() => setSelectedDomainId(dom.id)}
                      className="p-6 bg-white border border-slate-100 rounded-3xl text-left hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                        <Globe size={24} />
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1">{dom.domainName}</h4>
                      <p className="text-xs text-slate-500 mb-4">{dom.registrar}</p>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {journals.filter(j => j.domainId === dom.id).length} Journals
                        </span>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="journals"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedDomainId(null)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Journals on {selectedDomain?.domainName}</h3>
                    <p className="text-xs text-slate-500">Manage journals and OJS details.</p>
                  </div>
                </div>
                {isEmployee && (
                  <button 
                    onClick={() => setIsJournalModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                  >
                    <Plus size={14} /> Add Journal
                  </button>
                )}
              </div>
              {filteredJournals.length === 0 ? (
                <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <BookOpen className="mx-auto text-slate-300 mb-4" size={48} />
                  <p className="text-slate-500 font-medium">No journals found on this domain.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...filteredJournals].sort((a, b) => (a.title || '').localeCompare(b.title || '')).map(journal => (
                    <div
                      key={journal.id}
                      onClick={() => setSelectedJournalId({ id: journal.id, editMode: false })}
                      className="p-6 bg-white border border-slate-100 rounded-3xl text-left hover:border-amber-300 hover:shadow-lg hover:shadow-amber-500/5 transition-all group cursor-pointer relative overflow-hidden"
                    >
                      {recommendationService.getRecommendations(client, publishers, domains, [journal], journal.id).some(r => r.priority === 'high') && (
                        <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-bl-lg flex items-center gap-1">
                          <Sparkles size={10} />
                          Action Required
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all">
                          <BookOpen size={24} />
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                          journal.status === 'complete' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        )}>
                          {journal.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-all">{journal.title}</h4>
                      <p className="text-xs text-slate-500 mb-4">OJS {journal.ojsVersion || 'N/A'} • SSL {journal.sslStatus || 'None'}</p>
                      
                      <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
                        {journal.url && (
                          <a 
                            href={journal.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                          >
                            <ExternalLink size={12} />
                            Visit Site
                          </a>
                        )}
                        {isEmployee && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJournalId({ id: journal.id, editMode: true });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                          >
                            <Settings size={12} />
                            OJS Details
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <Modal isOpen={isPublisherModalOpen} onClose={() => setIsPublisherModalOpen(false)} title="Add New Publisher">
        <form onSubmit={handleAddPublisher} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Publisher Name</label>
            <input required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" value={newPublisher.name || ''} onChange={e => setNewPublisher({...newPublisher, name: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Owner Name</label>
            <input required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" value={newPublisher.ownerName || ''} onChange={e => setNewPublisher({...newPublisher, ownerName: e.target.value})} />
          </div>
          <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Save Publisher</button>
        </form>
      </Modal>

      <Modal isOpen={isDomainModalOpen} onClose={() => setIsDomainModalOpen(false)} title="Add New Domain">
        <form onSubmit={handleAddDomain} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Domain Name</label>
            <input required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" placeholder="example.com" value={newDomain.domainName || ''} onChange={e => setNewDomain({...newDomain, domainName: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Registrar</label>
            <select 
              required 
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" 
              value={newDomain.registrarId || ''} 
              onChange={e => {
                const regId = e.target.value;
                const regObj = registrars.find(r => r.id === regId);
                setNewDomain({
                  ...newDomain,
                  registrarId: regId,
                  registrar: regObj ? regObj.name : ''
                });
              }}
            >
              <option value="">Select Registrar...</option>
              {[...registrars].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(reg => (
                <option key={reg.id} value={reg.id}>{reg.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Save Domain</button>
        </form>
      </Modal>

      <Modal isOpen={isJournalModalOpen} onClose={() => setIsJournalModalOpen(false)} title="Add New Journal">
        <JournalForm 
          currentUser={currentUser} 
          onClose={() => setIsJournalModalOpen(false)} 
          initialClientId={client.id}
          initialPublisherId={selectedPublisherId || ''}
          initialDomainId={selectedDomainId || ''}
        />
      </Modal>

      {selectedJournalId && (
        <JournalDetail
          journalId={selectedJournalId.id}
          onBack={() => setSelectedJournalId(null)}
          currentUser={currentUser}
          initialEditMode={selectedJournalId.editMode}
        />
      )}
    </div>
  );
};
