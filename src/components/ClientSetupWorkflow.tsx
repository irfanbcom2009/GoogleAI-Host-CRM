import React, { useState, useEffect } from 'react';
import { 
  User, 
  Globe, 
  Building2, 
  BookOpen, 
  CheckCircle2, 
  ChevronRight, 
  Plus, 
  Search, 
  ArrowLeft,
  CreditCard,
  AlertCircle,
  Loader2,
  Check,
  ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, Domain, Publisher, Journal, ServiceType, Subscription } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, updateDoc, doc } from 'firebase/firestore';
import { cn } from '../lib/utils';

const STEPS = [
  { id: 'client', title: 'Client', icon: User },
  { id: 'domain', title: 'Domain', icon: Globe },
  { id: 'publisher', title: 'Publisher', icon: Building2 },
  { id: 'journal', title: 'Journal', icon: BookOpen },
  { id: 'services', title: 'Services', icon: CreditCard },
];

const AVAILABLE_SERVICES: ServiceType[] = [
  'Hosting', 'DOI', 'ISSN', 'OJS', 'Editorial', 'Indexing', 'Plagiarism'
];

export const ClientSetupWorkflow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Data state
  const [clients, setClients] = useState<Client[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);

  // Selection state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedPublisher, setSelectedPublisher] = useState<Publisher | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);

  // Search state
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snap) => {
      setClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      setLoading(false);
    });

    return () => unsubClients();
  }, []);

  useEffect(() => {
    if (!selectedClient) return;

    const unsubDomains = onSnapshot(
      query(collection(db, 'domains'), where('clientId', '==', selectedClient.id)),
      (snap) => setDomains(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Domain)))
    );

    const unsubPublishers = onSnapshot(
      query(collection(db, 'publishers'), where('clientId', '==', selectedClient.id)),
      (snap) => setPublishers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Publisher)))
    );

    const unsubJournals = onSnapshot(
      query(collection(db, 'journals'), where('clientId', '==', selectedClient.id)),
      (snap) => setJournals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal)))
    );

    return () => {
      unsubDomains();
      unsubPublishers();
      unsubJournals();
    };
  }, [selectedClient]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setSearch('');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setSearch('');
    }
  };

  const handleOrderService = async (service: ServiceType) => {
    if (!selectedClient) return;
    try {
      const currentSubscriptions = selectedClient.subscriptions || [];
      if (!currentSubscriptions.some(sub => sub.service === service)) {
        const newSub: Subscription = {
          service,
          startDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          status: 'active'
        };
        const updatedSubscriptions = [...currentSubscriptions, newSub];
        await updateDoc(doc(db, 'users', selectedClient.id), {
          subscriptions: updatedSubscriptions,
          updatedAt: serverTimestamp()
        });
        // The onSnapshot will update the selectedClient if we find it in the clients list
        setSelectedClient(prev => prev ? { ...prev, subscriptions: updatedSubscriptions } : null);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'client':
        return (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search or add client..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
              {clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(client => (
                <button 
                  key={client.id}
                  onClick={() => {
                    setSelectedClient(client);
                    handleNext();
                  }}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
                    selectedClient?.id === client.id 
                      ? "border-indigo-600 bg-indigo-50 shadow-sm" 
                      : "border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      selectedClient?.id === client.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                    )}>
                      <User size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{client.name}</p>
                      <p className="text-xs text-slate-500">{client.email}</p>
                    </div>
                  </div>
                  {selectedClient?.id === client.id && <CheckCircle2 size={20} className="text-indigo-600" />}
                </button>
              ))}
              {search && !clients.some(c => c.name.toLowerCase() === search.toLowerCase()) && (
                <button 
                  onClick={async () => {
                    try {
                      const docRef = await addDoc(collection(db, 'users'), {
                        name: search,
                        email: `${search.toLowerCase().replace(/\s+/g, '.')}@example.com`,
                        role: 'Client',
                        status: 'active',
                        points: 0,
                        subscriptions: [],
                        createdAt: serverTimestamp()
                      });
                      // Selection will happen via onSnapshot
                    } catch (e) {
                      handleFirestoreError(e, OperationType.CREATE, 'users');
                    }
                  }}
                  className="p-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 text-indigo-600 flex items-center gap-3 hover:bg-indigo-50 transition-all font-bold"
                >
                  <Plus size={20} />
                  Add "{search}" as new client
                </button>
              )}
            </div>
          </div>
        );

      case 'domain':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
              <User size={14} /> {selectedClient?.name}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search or add domain..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
              {domains.filter(d => d.domainName.toLowerCase().includes(search.toLowerCase())).map(domain => (
                <button 
                  key={domain.id}
                  onClick={() => {
                    setSelectedDomain(domain);
                    handleNext();
                  }}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
                    selectedDomain?.id === domain.id 
                      ? "border-indigo-600 bg-indigo-50 shadow-sm" 
                      : "border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      selectedDomain?.id === domain.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                    )}>
                      <Globe size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{domain.domainName}</p>
                      <p className="text-xs text-slate-500">{domain.registrar}</p>
                    </div>
                  </div>
                  {selectedDomain?.id === domain.id && <CheckCircle2 size={20} className="text-indigo-600" />}
                </button>
              ))}
              {search && !domains.some(d => d.domainName.toLowerCase() === search.toLowerCase()) && (
                <button 
                  onClick={async () => {
                    try {
                      await addDoc(collection(db, 'domains'), {
                        clientId: selectedClient?.id,
                        domainName: search,
                        registrar: 'Manual Entry',
                        status: 'active',
                        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                        createdAt: serverTimestamp()
                      });
                    } catch (e) {
                      handleFirestoreError(e, OperationType.CREATE, 'domains');
                    }
                  }}
                  className="p-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 text-indigo-600 flex items-center gap-3 hover:bg-indigo-50 transition-all font-bold"
                >
                  <Plus size={20} />
                  Add "{search}" as new domain
                </button>
              )}
              <button 
                onClick={handleNext}
                className="p-4 rounded-2xl border border-dashed border-slate-200 text-slate-500 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all font-medium"
              >
                Skip Domain Selection
              </button>
            </div>
          </div>
        );

      case 'publisher':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm font-medium text-slate-500 mb-2">
              <span className="flex items-center gap-1"><User size={14} /> {selectedClient?.name}</span>
              <span className="text-slate-300">/</span>
              <span className="flex items-center gap-1"><Globe size={14} /> {selectedDomain?.domainName || 'No Domain'}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search or add publisher..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
              {publishers.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(pub => (
                <button 
                  key={pub.id}
                  onClick={() => {
                    setSelectedPublisher(pub);
                    handleNext();
                  }}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
                    selectedPublisher?.id === pub.id 
                      ? "border-indigo-600 bg-indigo-50 shadow-sm" 
                      : "border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      selectedPublisher?.id === pub.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                    )}>
                      <Building2 size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{pub.name}</p>
                      <p className="text-xs text-slate-500">{pub.ownerName}</p>
                    </div>
                  </div>
                  {selectedPublisher?.id === pub.id && <CheckCircle2 size={20} className="text-indigo-600" />}
                </button>
              ))}
              {search && !publishers.some(p => p.name.toLowerCase() === search.toLowerCase()) && (
                <button 
                  onClick={async () => {
                    try {
                      await addDoc(collection(db, 'publishers'), {
                        clientId: selectedClient?.id,
                        name: search,
                        ownerName: 'Pending',
                        secpRegistration: 'Pending',
                        ntn: 'Pending',
                        documents: { aoa: '', moa: '', cnic: '', certificates: [] },
                        createdAt: serverTimestamp()
                      });
                    } catch (e) {
                      handleFirestoreError(e, OperationType.CREATE, 'publishers');
                    }
                  }}
                  className="p-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 text-indigo-600 flex items-center gap-3 hover:bg-indigo-50 transition-all font-bold"
                >
                  <Plus size={20} />
                  Add "{search}" as new publisher
                </button>
              )}
              <button 
                onClick={handleNext}
                className="p-4 rounded-2xl border border-dashed border-slate-200 text-slate-500 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all font-medium"
              >
                Skip Publisher Selection
              </button>
            </div>
          </div>
        );

      case 'journal':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm font-medium text-slate-500 mb-2">
              <span className="flex items-center gap-1"><User size={14} /> {selectedClient?.name}</span>
              <span className="text-slate-300">/</span>
              <span className="flex items-center gap-1"><Building2 size={14} /> {selectedPublisher?.name || 'No Publisher'}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search or add journal..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
              {journals.filter(j => j.title.toLowerCase().includes(search.toLowerCase())).map(journal => (
                <button 
                  key={journal.id}
                  onClick={() => {
                    setSelectedJournal(journal);
                    handleNext();
                  }}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
                    selectedJournal?.id === journal.id 
                      ? "border-indigo-600 bg-indigo-50 shadow-sm" 
                      : "border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      selectedJournal?.id === journal.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                    )}>
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{journal.title}</p>
                      <p className="text-xs text-slate-500">{journal.status}</p>
                    </div>
                  </div>
                  {selectedJournal?.id === journal.id && <CheckCircle2 size={20} className="text-indigo-600" />}
                </button>
              ))}
              {search && !journals.some(j => j.title.toLowerCase() === search.toLowerCase()) && (
                <button 
                  onClick={async () => {
                    try {
                      await addDoc(collection(db, 'journals'), {
                        clientId: selectedClient?.id,
                        publisherId: selectedPublisher?.id || '',
                        title: search,
                        status: 'pending_issn',
                        createdAt: serverTimestamp()
                      });
                    } catch (e) {
                      handleFirestoreError(e, OperationType.CREATE, 'journals');
                    }
                  }}
                  className="p-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 text-indigo-600 flex items-center gap-3 hover:bg-indigo-50 transition-all font-bold"
                >
                  <Plus size={20} />
                  Add "{search}" as new journal
                </button>
              )}
              <button 
                onClick={handleNext}
                className="p-4 rounded-2xl border border-dashed border-slate-200 text-slate-500 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all font-medium"
              >
                Skip Journal Selection
              </button>
            </div>
          </div>
        );

      case 'services':
        const subscribed = selectedClient?.subscriptions || [];
        const unsubscribed = AVAILABLE_SERVICES.filter(s => !subscribed.some(sub => sub.service === s));

        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 text-sm font-medium text-slate-500 mb-2">
              <span className="flex items-center gap-1"><User size={14} /> {selectedClient?.name}</span>
              <span className="text-slate-300">/</span>
              <span className="flex items-center gap-1"><BookOpen size={14} /> {selectedJournal?.title || 'No Journal'}</span>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Subscribed Services
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subscribed.length > 0 ? subscribed.map(sub => (
                  <div key={sub.service} className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white text-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                        <Check size={16} />
                      </div>
                      <span className="font-bold text-emerald-900">{sub.service}</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Active</span>
                  </div>
                )) : (
                  <div className="col-span-2 p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center text-slate-400">
                    No active subscriptions
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart size={16} className="text-indigo-600" />
                Available Services to Order
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unsubscribed.map(service => (
                  <button 
                    key={service}
                    onClick={() => handleOrderService(service)}
                    className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                        <Plus size={16} />
                      </div>
                      <span className="font-bold text-slate-700 group-hover:text-indigo-900">{service}</span>
                    </div>
                    <div className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      Order Now
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
        <Loader2 className="animate-spin" size={40} />
        <p className="font-medium">Loading workflow...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Setup Workflow</h2>
          <p className="text-slate-500 mt-1">Configure client, domains, publishers, and journals in order.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm">
          Step {currentStep + 1} of {STEPS.length}
        </div>
      </div>

      {/* Stepper */}
      <div className="relative flex items-center justify-between px-4">
        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 bg-slate-100 -z-10" />
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          
          return (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm",
                isActive ? "bg-indigo-600 text-white scale-110 shadow-indigo-200" : 
                isCompleted ? "bg-emerald-500 text-white" : "bg-white text-slate-400 border border-slate-200"
              )}>
                {isCompleted ? <Check size={24} /> : <Icon size={24} />}
              </div>
              <span className={cn(
                "text-xs font-bold transition-colors",
                isActive ? "text-indigo-600" : isCompleted ? "text-emerald-600" : "text-slate-400"
              )}>
                {step.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 p-8 min-h-[500px] flex flex-col">
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between pt-8 mt-8 border-t border-slate-50">
          <button 
            onClick={handleBack}
            disabled={currentStep === 0}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all",
              currentStep === 0 ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <ArrowLeft size={20} />
            Back
          </button>
          
          <div className="flex gap-3">
            {currentStep < STEPS.length - 1 && (
              <button 
                onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                Continue
                <ChevronRight size={20} />
              </button>
            )}
            {currentStep === STEPS.length - 1 && (
              <button 
                onClick={() => setCurrentStep(0)}
                className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
              >
                Complete Setup
                <CheckCircle2 size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Sidebar (Optional/Conditional) */}
      {selectedClient && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-slate-900 rounded-3xl text-white flex flex-wrap gap-8"
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client</p>
            <p className="font-bold">{selectedClient.name}</p>
          </div>
          {selectedDomain && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Domain</p>
              <p className="font-bold">{selectedDomain.domainName}</p>
            </div>
          )}
          {selectedPublisher && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Publisher</p>
              <p className="font-bold">{selectedPublisher.name}</p>
            </div>
          )}
          {selectedJournal && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Journal</p>
              <p className="font-bold">{selectedJournal.title}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
