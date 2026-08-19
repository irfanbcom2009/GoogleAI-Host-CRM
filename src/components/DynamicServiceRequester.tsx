import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Zap, 
  Plus, 
  Check, 
  X,
  CreditCard,
  Layers,
  ArrowRight,
  Settings,
  ShieldCheck,
  ShoppingCart
} from 'lucide-react';
import { cn } from '../lib/utils';
import { SERVICE_REQUEST_CONFIG, ServiceDefinition, DynamicFormField } from '../constants/serviceRequestConfig';
import { db, handleFirestoreError, OperationType, getErrorMessage } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { User as UserType } from '../types';
import { toast } from 'react-hot-toast';
import { ServiceOrderWizard } from './ServiceOrderWizard';
import { SelectDomainField } from './SelectDomainField';

interface DynamicServiceRequesterProps {
  currentUser: UserType;
  onComplete?: () => void;
}

type Mode = 'selection' | 'form' | 'summary';
type ServiceSelection = 'subscribe' | 'alreadyHave' | 'skip';

interface ServiceState {
  mode: ServiceSelection;
  data: Record<string, any>;
}

export const DynamicServiceRequester: React.FC<DynamicServiceRequesterProps> = ({ currentUser, onComplete }) => {
  const [activeSubTab, setActiveSubTab] = useState<'wizard' | 'custom'>('wizard');
  const [view, setView] = useState<Mode>('selection');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [formStates, setFormStates] = useState<Record<string, ServiceState>>({});
  const [currentFormIndex, setCurrentFormIndex] = useState(0);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize service states
  useEffect(() => {
    const initialState: Record<string, ServiceState> = {};
    SERVICE_REQUEST_CONFIG.forEach(s => {
      initialState[s.id] = { mode: 'subscribe', data: {} };
    });
    setFormStates(initialState);
  }, []);

  const [registrars, setRegistrars] = useState<any[]>([]);
  const [clientDomains, setClientDomains] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [isCustomRegistrar, setIsCustomRegistrar] = useState(false);
  const [isCustomServer, setIsCustomServer] = useState(false);

  // Fetch registrars, client's domains, and servers from Firestore
  useEffect(() => {
    const unsubRegistrars = onSnapshot(collection(db, 'registrars'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistrars(list);
    }, (error) => {
      console.error("Error fetching registrars in DynamicServiceRequester: ", error);
    });

    const domainsQuery = query(collection(db, 'domains'), where('clientId', '==', currentUser.id));
    const unsubDomains = onSnapshot(domainsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClientDomains(list);
    }, (err) => {
      console.error("Error fetching domains in DynamicServiceRequester: ", err);
    });

    const unsubServers = onSnapshot(collection(db, 'servers'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServers(list);
    }, (err) => {
      console.error("Error fetching servers in DynamicServiceRequester: ", err);
    });

    return () => {
      unsubRegistrars();
      unsubDomains();
      unsubServers();
    };
  }, [currentUser.id]);

  // Reset custom inputs when moving between services/steps
  useEffect(() => {
    setIsCustomDomain(false);
    setIsCustomRegistrar(false);
    setIsCustomServer(false);
  }, [currentFormIndex]);

  const activeServiceId = selectedServiceIds[currentFormIndex];
  const activeService = SERVICE_REQUEST_CONFIG.find(s => s.id === activeServiceId);

  const toggleService = (id: string) => {
    setSelectedServiceIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const startForms = () => {
    if (selectedServiceIds.length === 0) {
      toast.error('Please select at least one service');
      return;
    }
    loadFormContent(0);
  };

  const loadFormContent = (index: number) => {
    setIsLoadingForm(true);
    // Simulate AJAX loading
    setTimeout(() => {
      setCurrentFormIndex(index);
      setView('form');
      setIsLoadingForm(false);
      window.scrollTo(0, 0);
    }, 600);
  };

  const nextStep = () => {
    if (validateCurrentForm()) {
      if (currentFormIndex < selectedServiceIds.length - 1) {
        loadFormContent(currentFormIndex + 1);
      } else {
        setView('summary');
      }
    }
  };

  const prevStep = () => {
    if (currentFormIndex > 0) {
      loadFormContent(currentFormIndex - 1);
    } else {
      setView('selection');
    }
  };

  const validateCurrentForm = () => {
    if (!activeService) return true;
    const currentState = formStates[activeService.id];
    if (currentState.mode === 'skip') return true;

    const fields = currentState.mode === 'subscribe' 
      ? activeService.fields.subscribe 
      : activeService.fields.alreadyHave;

    const missing = fields
      .filter(f => f.required)
      .filter(f => !currentState.data[f.id]);

    if (missing.length > 0) {
      const msg = `Please fill in: ${missing.map(f => f.label).join(', ')}`;
      setError(msg);
      toast.error(msg);
      return false;
    }
    setError(null);
    return true;
  };

  const handleFieldChange = (serviceId: string, fieldId: string, value: any) => {
    setFormStates(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        data: { ...prev[serviceId].data, [fieldId]: value }
      }
    }));
  };

  const handleModeChange = (serviceId: string, mode: ServiceSelection) => {
    setFormStates(prev => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], mode }
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const orderData = {
        clientId: currentUser.id,
        clientName: currentUser.name,
        services: selectedServiceIds.map(id => ({
          id,
          ...formStates[id]
        })),
        status: 'pending',
        type: 'Dynamic Request',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'orders'), orderData);
      setIsSuccess(true);
      toast.success('Service request submitted!');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'orders');
      toast.error(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-xl shadow-emerald-100"
        >
          <CheckCircle2 size={48} />
        </motion.div>
        <h2 className="text-4xl font-black text-slate-900 border-none">Request Received!</h2>
        <p className="text-slate-500 max-w-md mx-auto font-medium">
          Your dynamic service request has been successfully submitted. Our team will review your requirements and get back to you shortly.
        </p>
        <button 
          onClick={onComplete}
          className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto py-8 px-4 md:px-8 lg:px-12">
      {/* Sub-Tabs Nav */}
      <div className="mb-10 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-200/60 pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
            Service Request Portal
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Equip your journal with professional software, indexing, and premium setups</p>
        </div>

        <div className="flex bg-slate-950 dark:bg-black p-1.5 rounded-2xl border border-slate-900 shrink-0 shadow-lg">
          <button
            onClick={() => setActiveSubTab('wizard')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'wizard'
                ? "bg-slate-900 text-white shadow-md border border-slate-800"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Layers size={14} />
            Step-by-Step Setup Wizard
          </button>
          <button
            onClick={() => setActiveSubTab('custom')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'custom'
                ? "bg-slate-900 text-white shadow-md border border-slate-800"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <ShoppingCart size={14} />
            Custom Services Portal
          </button>
        </div>
      </div>

      {activeSubTab === 'wizard' ? (
        <ServiceOrderWizard currentUser={currentUser} onComplete={onComplete} />
      ) : (
        <>
          {isLoadingForm ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 size={48} className="text-indigo-600 animate-spin" />
              <p className="font-black uppercase tracking-widest text-xs text-slate-400">Loading Form Modules...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
          {view === 'selection' && (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-2 mb-8">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                    <Plus size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Select Required Services</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SERVICE_REQUEST_CONFIG.map(service => (
                    <button
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={cn(
                        "p-6 rounded-3xl border-2 text-left transition-all flex items-start gap-4 group",
                        selectedServiceIds.includes(service.id) 
                          ? "border-indigo-600 bg-indigo-50/30" 
                          : "border-slate-100 hover:border-indigo-100 bg-white"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm",
                        selectedServiceIds.includes(service.id) ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-400"
                      )}>
                        <service.icon size={24} />
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-slate-900">{service.label}</p>
                        <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">{service.description}</p>
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-1",
                        selectedServiceIds.includes(service.id) ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200"
                      )}>
                        {selectedServiceIds.includes(service.id) && <Check size={14} />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={startForms}
                  className="px-10 py-5 bg-slate-900 text-white rounded-3xl font-bold flex items-center gap-3 shadow-2xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Configure {selectedServiceIds.length} Selection(s)
                  <ChevronRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {view === 'form' && activeService && (
            <motion.div
              key={activeService.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                      <activeService.icon size={32} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuring Service {currentFormIndex + 1} of {selectedServiceIds.length}</p>
                      <h3 className="text-2xl font-black text-slate-900">{activeService.label}</h3>
                    </div>
                  </div>
                </div>

                {/* Option Toggles */}
                <div className="flex flex-wrap gap-3">
                  {[
                    { 
                      id: 'subscribe', 
                      label: activeService.id === 'domain' 
                        ? 'Need this service 15USD' 
                        : activeService.id === 'hosting' 
                        ? 'Need this service' 
                        : 'Subscribe / Purchase', 
                      icon: Zap 
                    },
                    { 
                      id: 'alreadyHave', 
                      label: activeService.id === 'domain' 
                        ? 'Already Have 0USD' 
                        : 'Already Have', 
                      subLabel: activeService.id === 'domain' 
                        ? 'Enter details only' 
                        : activeService.id === 'hosting' 
                        ? 'Enter Hosting details only' 
                        : undefined,
                      icon: CheckCircle2 
                    },
                    { 
                      id: 'skip', 
                      label: 'Skip This Step', 
                      icon: ArrowRight 
                    }
                  ].map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleModeChange(activeService.id, mode.id as ServiceSelection)}
                      className={cn(
                        "px-6 py-3 rounded-2xl border-2 flex flex-col items-start text-left transition-all gap-0.5 min-w-[140px]",
                        formStates[activeService.id]?.mode === mode.id 
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold" 
                          : "border-slate-100 text-slate-500 font-medium hover:border-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <mode.icon size={16} />
                        <span className="text-sm">{mode.label}</span>
                      </div>
                      {mode.subLabel && (
                        <span className="text-[10px] text-slate-400 font-normal pl-6">{mode.subLabel}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Form Fields */}
                {formStates[activeService.id]?.mode !== 'skip' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                    {(formStates[activeService.id]?.mode === 'subscribe' 
                      ? activeService.fields.subscribe 
                      : activeService.fields.alreadyHave
                    ).map(field => {
                      // Support custom domain select/add
                      if (activeService.id === 'domain' && field.id === 'domainNameSelection') {
                        const savedValue = formStates[activeService.id].data[field.id] || '';
                        
                        return (
                          <div key={field.id} className="col-span-1 md:col-span-2">
                            <SelectDomainField
                              required={field.required}
                              clientId={currentUser.id}
                              selectedDomainNameOrId={savedValue}
                              onChange={(value) => {
                                handleFieldChange(activeService.id, field.id, value);
                              }}
                              label={field.label}
                            />
                          </div>
                        );
                      }

                      // Support custom registrar select/add
                      if (activeService.id === 'domain' && field.id === 'registrarSelection') {
                        const savedValue = formStates[activeService.id].data[field.id] || '';
                        const hasRegistrars = registrars.length > 0;
                        
                        return (
                          <div key={field.id} className="space-y-2 col-span-1 md:col-span-2 bg-slate-50/55 p-4 rounded-xl border border-slate-200/50">
                            <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                              <span>{field.label} {field.required && <span className="text-rose-500 ml-1">*</span>}</span>
                            </label>
                            
                            {hasRegistrars && !isCustomRegistrar ? (
                              <div className="space-y-2">
                                <select
                                  className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer text-sm font-medium"
                                  value={savedValue || ''}
                                  onChange={(e) => {
                                    if (e.target.value === '__custom__') {
                                      setIsCustomRegistrar(true);
                                      handleFieldChange(activeService.id, field.id, '');
                                    } else {
                                      handleFieldChange(activeService.id, field.id, e.target.value);
                                    }
                                  }}
                                >
                                  <option value="">-- Select Pre-Existing Registrar --</option>
                                  {[...registrars].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(r => (
                                    <option key={r.id} value={r.name}>{r.name}</option>
                                  ))}
                                  <option value="__custom__">➕ Type Custom Registrar Name...</option>
                                </select>
                                <p className="text-[10px] text-slate-400">Select an existing domain provider/registrar, or select the option to type a custom name.</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    required={field.required}
                                    className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-sm"
                                    placeholder="e.g. GoDaddy, Namecheap, Google Domains"
                                    value={savedValue || ''}
                                    onChange={(e) => handleFieldChange(activeService.id, field.id, e.target.value)}
                                  />
                                  {hasRegistrars && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsCustomRegistrar(false);
                                        handleFieldChange(activeService.id, field.id, '');
                                      }}
                                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-300 transition-colors whitespace-nowrap"
                                    >
                                      Select From List
                                    </button>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400">Enter the name of your domain registry or registrar.</p>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Support custom indexing package selection with professional cards, comparison table and disclaimer
                      if (activeService.id === 'indexing' && field.id === 'indexingPackage') {
                        const savedValue = formStates[activeService.id].data[field.id] || '';
                        
                        const packages = [
                          {
                            id: 'Starter Package (20 Indexing Applications)',
                            title: 'Starter Package',
                            appCount: '20 Indexing Applications',
                            priceVal: '10',
                            currency: 'USD',
                            period: 'Package',
                            badge: 'Essential',
                            badgeColor: 'bg-blue-50 border-blue-100 text-blue-700',
                            colorClass: 'text-blue-600',
                            borderColor: 'border-blue-500 bg-blue-50/10 shadow-lg shadow-blue-100/50',
                            bulletColor: 'text-blue-500',
                            features: [
                              'Up to 20 indexing databases',
                              'Database eligibility review',
                              'Metadata compliance check',
                              'Submission preparation',
                              'Progress tracking',
                              'Delivery: 2–4 Weeks'
                            ]
                          },
                          {
                            id: 'Professional Package (40 Indexing Applications)',
                            title: 'Professional Package',
                            appCount: '40 Indexing Applications',
                            priceVal: '20',
                            currency: 'USD',
                            period: 'Package',
                            badge: 'Most Popular',
                            badgeColor: 'bg-indigo-50 border-indigo-100 text-indigo-700',
                            colorClass: 'text-indigo-600',
                            borderColor: 'border-indigo-600 bg-indigo-50/10 shadow-lg shadow-indigo-100/50',
                            bulletColor: 'text-indigo-500',
                            features: [
                              'Up to 40 indexing databases',
                              'Metadata optimization',
                              'Indexing eligibility review',
                              'Submission to selected databases',
                              'Progress report',
                              'Delivery: 1–6 Months'
                            ]
                          },
                          {
                            id: 'Premium Package (50 Indexing Applications)',
                            title: 'Premium Package',
                            appCount: '50 Indexing Applications',
                            priceVal: '50',
                            currency: 'USD',
                            period: 'Package',
                            badge: 'Best Value',
                            badgeColor: 'bg-emerald-50 border-emerald-100 text-emerald-700',
                            colorClass: 'text-emerald-600',
                            borderColor: 'border-emerald-600 bg-emerald-50/10 shadow-lg shadow-emerald-100/50',
                            bulletColor: 'text-emerald-500',
                            features: [
                              'Up to 50 indexing databases',
                              'Complete metadata optimization',
                              'Submission management',
                              'Indexing monitoring',
                              'Monthly progress updates',
                              'Delivery: 1–12 Months'
                            ]
                          },
                          {
                            id: 'Enterprise Package (Custom Indexing Campaign)',
                            title: 'Enterprise Package',
                            appCount: 'Custom Indexing Campaign',
                            priceVal: 'Custom',
                            currency: '',
                            period: 'Quote',
                            badge: 'Custom Strategy',
                            badgeColor: 'bg-amber-50 border-amber-100 text-amber-700',
                            colorClass: 'text-amber-600',
                            borderColor: 'border-amber-600 bg-amber-50/10 shadow-lg shadow-amber-100/50',
                            bulletColor: 'text-amber-500',
                            features: [
                              'Unlimited consultation',
                              'Custom indexing strategy',
                              'Database selection',
                              'Priority handling',
                              'Dedicated project manager',
                              'Custom delivery schedule'
                            ]
                          }
                        ];

                        return (
                          <div key={field.id} className="col-span-1 md:col-span-2 space-y-8">
                            <div className="space-y-1">
                              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider block">
                                {field.label} {field.required && <span className="text-rose-500">*</span>}
                              </label>
                              <p className="text-xs font-semibold text-slate-400">Choose the package that best fits your journal's goals and budget.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              {packages.map((opt) => {
                                const isSelected = savedValue === opt.id;
                                return (
                                  <div
                                    key={opt.id}
                                    onClick={() => handleFieldChange(activeService.id, field.id, opt.id)}
                                    className={cn(
                                      "cursor-pointer p-6 rounded-3xl border-2 transition-all flex flex-col justify-between h-full bg-white relative group",
                                      isSelected
                                        ? opt.borderColor
                                        : "border-slate-100 hover:border-indigo-200"
                                    )}
                                  >
                                    <div>
                                      <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-black text-base text-slate-900 leading-tight pr-4">{opt.title}</h4>
                                        <div className={cn(
                                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                                          isSelected 
                                            ? (opt.priceVal === '10' ? "border-blue-600 bg-blue-600 text-white" : opt.priceVal === '20' ? "border-indigo-600 bg-indigo-600 text-white" : opt.priceVal === '50' ? "border-emerald-600 bg-emerald-600 text-white" : "border-amber-600 bg-amber-600 text-white") 
                                            : "border-slate-200"
                                        )}>
                                          {isSelected && <Check size={12} />}
                                        </div>
                                      </div>
                                      
                                      <p className="text-xs font-bold text-slate-500 mb-4">{opt.appCount}</p>
                                      
                                      <div className="mb-6">
                                        <div className="flex items-baseline gap-1 mb-1">
                                          {opt.priceVal === 'Custom' ? (
                                            <span className={cn("text-2xl font-black tracking-tight", opt.colorClass)}>
                                              Custom Quote
                                            </span>
                                          ) : (
                                            <>
                                              <span className={cn("text-3xl font-black tracking-tight", opt.colorClass)}>
                                                ${opt.priceVal}
                                              </span>
                                              <span className="text-xs font-bold text-slate-400">
                                                {opt.currency}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400/80 uppercase tracking-wider mb-2">
                                          / {opt.period}
                                        </div>
                                        {opt.badge && (
                                          <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border",
                                            opt.badgeColor
                                          )}>
                                            {opt.badge}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <ul className="space-y-3">
                                        {opt.features.map((feat, i) => (
                                          <li key={i} className="flex items-start gap-2.5 text-xs font-semibold text-slate-600">
                                            <ShieldCheck size={14} className={cn("mt-0.5 shrink-0", opt.bulletColor)} />
                                            <span>{feat}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    
                                    <div className="mt-6">
                                      <button
                                        type="button"
                                        className={cn(
                                          "w-full py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all border",
                                          isSelected
                                            ? (opt.priceVal === '10' ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" : opt.priceVal === '20' ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" : opt.priceVal === '50' ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100" : "bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-100")
                                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                        )}
                                      >
                                        {opt.priceVal === 'Custom' ? 'Request Quote' : 'Select Package'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Comparison Table */}
                            <div className="overflow-hidden rounded-2xl border border-slate-150 bg-white shadow-sm mt-8">
                              <div className="bg-slate-50 px-6 py-4 border-b border-slate-150">
                                <h5 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Packages Comparison</h5>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs font-semibold text-slate-600 min-w-[500px]">
                                  <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                      <th className="px-6 py-3 text-slate-500 font-bold uppercase tracking-wider">Feature</th>
                                      <th className="px-6 py-3 text-slate-700 font-black">Starter</th>
                                      <th className="px-6 py-3 text-indigo-600 font-black">Professional</th>
                                      <th className="px-6 py-3 text-emerald-600 font-black">Premium</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    <tr>
                                      <td className="px-6 py-3.5 font-bold text-slate-800">Databases</td>
                                      <td className="px-6 py-3.5">20</td>
                                      <td className="px-6 py-3.5 text-indigo-600">40</td>
                                      <td className="px-6 py-3.5 text-emerald-600">50</td>
                                    </tr>
                                    <tr>
                                      <td className="px-6 py-3.5 font-bold text-slate-800">Metadata Review</td>
                                      <td className="px-6 py-3.5">✓</td>
                                      <td className="px-6 py-3.5">✓</td>
                                      <td className="px-6 py-3.5">✓</td>
                                    </tr>
                                    <tr>
                                      <td className="px-6 py-3.5 font-bold text-slate-800">Eligibility Check</td>
                                      <td className="px-6 py-3.5">✓</td>
                                      <td className="px-6 py-3.5">✓</td>
                                      <td className="px-6 py-3.5">✓</td>
                                    </tr>
                                    <tr>
                                      <td className="px-6 py-3.5 font-bold text-slate-800">Submission</td>
                                      <td className="px-6 py-3.5">✓</td>
                                      <td className="px-6 py-3.5">✓</td>
                                      <td className="px-6 py-3.5">✓</td>
                                    </tr>
                                    <tr>
                                      <td className="px-6 py-3.5 font-bold text-slate-800">Progress Report</td>
                                      <td className="px-6 py-3.5">Basic</td>
                                      <td className="px-6 py-3.5 text-indigo-600 font-bold">Detailed</td>
                                      <td className="px-6 py-3.5 text-emerald-600 font-bold">Monthly</td>
                                    </tr>
                                    <tr>
                                      <td className="px-6 py-3.5 font-bold text-slate-800">Priority Processing</td>
                                      <td className="px-6 py-3.5 text-slate-400">—</td>
                                      <td className="px-6 py-3.5 text-indigo-600 font-bold">Optional</td>
                                      <td className="px-6 py-3.5 text-emerald-600 font-bold">Included</td>
                                    </tr>
                                    <tr>
                                      <td className="px-6 py-3.5 font-bold text-slate-800">Delivery</td>
                                      <td className="px-6 py-3.5 text-slate-500">2–4 Weeks</td>
                                      <td className="px-6 py-3.5 text-indigo-600">1–6 Months</td>
                                      <td className="px-6 py-3.5 text-emerald-600">1–12 Months</td>
                                    </tr>
                                    <tr className="bg-slate-50/30">
                                      <td className="px-6 py-3.5 font-bold text-slate-800">Price</td>
                                      <td className="px-6 py-3.5 font-black text-slate-900">$10</td>
                                      <td className="px-6 py-3.5 font-black text-indigo-600">$20</td>
                                      <td className="px-6 py-3.5 font-black text-emerald-600">$50</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Notice Box */}
                            <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/60 flex gap-4.5">
                              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 shrink-0 self-start">
                                <AlertCircle size={20} />
                              </div>
                              <div>
                                <h5 className="text-xs font-black uppercase tracking-wider text-amber-800 mb-1">Important Notice</h5>
                                <p className="text-xs font-semibold text-amber-700/95 leading-relaxed">
                                  <strong>Disclaimer:</strong> Submission to indexing databases does not guarantee acceptance. Final approval depends entirely on each indexing database's evaluation criteria and policies. Host A Journal provides professional preparation, compliance review, and submission assistance.
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Support custom hosting preference selection with pricing cards and listed features
                      if (activeService.id === 'hosting' && field.id === 'hostingPreference') {
                        const savedValue = formStates[activeService.id].data[field.id] || '';
                        
                        const pricingOptions = [
                          {
                            id: 'Unlimited Shared OJS Hosting (50USD/Annual/Domain)',
                            title: 'Unlimited Shared OJS Hosting',
                            priceVal: '50',
                            currency: 'USD',
                            period: 'Annual / Domain',
                            badge: 'Best for Starters',
                            badgeColor: 'bg-indigo-50 border-indigo-100 text-indigo-700',
                            colorClass: 'text-indigo-600',
                            borderColor: 'border-indigo-600 bg-indigo-50/10 shadow-lg shadow-indigo-100/50',
                            bulletColor: 'text-indigo-500',
                            features: [
                              'High-Speed Web Hosting with SSL',
                              'Unlimited Bandwidth & Storage for PDFs',
                              'Managed Daily/Weekly Offsite Backups',
                              'Dedicated Email Accounts for Editors',
                              'SSH/Control Panel Access'
                            ]
                          },
                          {
                            id: 'Dedicated Cloud Server OJS Hosting (150USD/Annual/Domain)',
                            title: 'Dedicated Cloud Server OJS Hosting',
                            priceVal: '150',
                            currency: 'USD',
                            period: 'Annual / Domain',
                            badge: 'Enterprise Performance',
                            badgeColor: 'bg-emerald-50 border-emerald-100 text-emerald-700',
                            colorClass: 'text-emerald-600',
                            borderColor: 'border-emerald-600 bg-emerald-50/10 shadow-lg shadow-emerald-100/50',
                            bulletColor: 'text-emerald-500',
                            features: [
                              'Dedicated Resources (vCPU & RAM)',
                              'Full SSH / Root / Control Panel Access',
                              'Direct Support with 99.9% Uptime Guarantee',
                              'Unlimited Domains & OJS Multi-Journal Setup',
                              'High-Performance SSL and SSD Storage'
                            ]
                          },
                          {
                            id: 'Upgrade Existing Shared Hosting to Cloud Hosting (100USD/Annual/Domain)',
                            title: 'Upgrade Existing Shared Hosting to Cloud Hosting',
                            priceVal: '100',
                            currency: 'USD',
                            period: 'Annual / Domain',
                            badge: 'Seamless Upgrade',
                            badgeColor: 'bg-amber-50 border-amber-100 text-amber-700',
                            colorClass: 'text-amber-600',
                            borderColor: 'border-amber-600 bg-amber-50/10 shadow-lg shadow-amber-100/50',
                            bulletColor: 'text-amber-500',
                            features: [
                              'Perfect for growing journals that require more dedicated processing power.',
                              'Upgraded CPU & RAM Resources',
                              'Advanced Error Logging & DNS setup',
                              'Optimized PHP Environment for OJS',
                              'Robust Security and Firewall Protection'
                            ]
                          }
                        ];

                        return (
                          <div key={field.id} className="col-span-1 md:col-span-2 space-y-4">
                            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider block">
                              {field.label} {field.required && <span className="text-rose-500">*</span>}
                            </label>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {pricingOptions.map((opt) => {
                                const isSelected = savedValue === opt.id;
                                return (
                                  <div
                                    key={opt.id}
                                    onClick={() => handleFieldChange(activeService.id, field.id, opt.id)}
                                    className={cn(
                                      "cursor-pointer p-6 rounded-3xl border-2 transition-all flex flex-col justify-between h-full bg-white relative group",
                                      isSelected
                                        ? opt.borderColor
                                        : "border-slate-100 hover:border-indigo-200"
                                    )}
                                  >
                                    <div>
                                      <div className="flex justify-between items-start mb-4">
                                        <h4 className="font-black text-lg text-slate-900 leading-tight pr-4">{opt.title}</h4>
                                        <div className={cn(
                                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                                          isSelected 
                                            ? (opt.priceVal === '50' ? "border-indigo-600 bg-indigo-600 text-white" : opt.priceVal === '150' ? "border-emerald-600 bg-emerald-600 text-white" : "border-amber-600 bg-amber-600 text-white") 
                                            : "border-slate-200"
                                        )}>
                                          {isSelected && <Check size={12} />}
                                        </div>
                                      </div>
                                      
                                      <div className="mb-6">
                                        <div className="flex items-baseline gap-1 mb-1">
                                          <span className={cn("text-3xl font-black tracking-tight", opt.colorClass)}>
                                            ${opt.priceVal}
                                          </span>
                                          <span className="text-xs font-bold text-slate-400">
                                            {opt.currency}
                                          </span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400/80 uppercase tracking-wider mb-2">
                                          / {opt.period}
                                        </div>
                                        {opt.badge && (
                                          <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border",
                                            opt.badgeColor
                                          )}>
                                            {opt.badge}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <ul className="space-y-3">
                                        {opt.features.map((feat, i) => (
                                          <li key={i} className="flex items-start gap-2.5 text-xs font-semibold text-slate-600">
                                            <ShieldCheck size={14} className={cn("mt-0.5 shrink-0", opt.bulletColor)} />
                                            <span>{feat}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // Support custom addon selection for hosting
                      if (activeService.id === 'hosting' && field.id === 'addonUpgrade') {
                        return null;
                      }

                      // Support custom hosting server select/add under "Already Have"
                      if (activeService.id === 'hosting' && field.id === 'hostingServerSelection') {
                        const savedValue = formStates[activeService.id].data[field.id] || '';
                        const hasServers = servers.length > 0;
                        
                        return (
                          <div key={field.id} className="space-y-2 col-span-1 md:col-span-2 bg-slate-50/55 p-4 rounded-xl border border-slate-200/50">
                            <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                              <span>Add/Select Hosting Server {field.required && <span className="text-rose-500 ml-1">*</span>}</span>
                            </label>
                            
                            {hasServers && !isCustomServer ? (
                              <div className="space-y-2">
                                <select
                                  className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer text-sm font-medium"
                                  value={savedValue || ''}
                                  onChange={(e) => {
                                    if (e.target.value === '__custom__') {
                                      setIsCustomServer(true);
                                      handleFieldChange(activeService.id, field.id, '');
                                    } else {
                                      handleFieldChange(activeService.id, field.id, e.target.value);
                                    }
                                  }}
                                >
                                  <option value="">-- Select Pre-Existing Hosting Server --</option>
                                  {[...servers].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(s => (
                                    <option key={s.id} value={s.name}>{s.name} ({s.ipAddress || 'Internal IP'})</option>
                                  ))}
                                  <option value="__custom__">➕ Type Custom Server Name/IP...</option>
                                </select>
                                <p className="text-[10px] text-slate-400">Select an existing registered hosting server, or select the option to type a custom name.</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    required={field.required}
                                    className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-sm"
                                    placeholder="e.g. Server IP or Hostname"
                                    value={savedValue || ''}
                                    onChange={(e) => handleFieldChange(activeService.id, field.id, e.target.value)}
                                  />
                                  {hasServers && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsCustomServer(false);
                                        handleFieldChange(activeService.id, field.id, '');
                                      }}
                                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-300 transition-colors whitespace-nowrap"
                                    >
                                      Select From List
                                    </button>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400">Enter the IP address or host name of your hosting server.</p>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div key={field.id} className={cn("space-y-2", field.type === 'textarea' && "col-span-1 md:col-span-2")}>
                          <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                            <span>{field.label} {field.required && <span className="text-rose-500 ml-1">*</span>}</span>
                          </label>
                          
                          {field.type === 'text' && (
                            <input 
                              type={field.id.toLowerCase().includes('date') || field.id === 'expiry' ? 'date' : 'text'} 
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-sm"
                              placeholder={field.placeholder}
                              value={formStates[activeService.id].data[field.id] || ''}
                              onChange={(e) => handleFieldChange(activeService.id, field.id, e.target.value)}
                            />
                          )}

                          {field.type === 'number' && (
                            <input 
                              type="number" 
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-sm"
                              value={formStates[activeService.id].data[field.id] || ''}
                              onChange={(e) => handleFieldChange(activeService.id, field.id, e.target.value)}
                            />
                          )}

                          {field.type === 'textarea' && (
                            <textarea 
                              rows={3}
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow resize-none text-sm"
                              placeholder={field.placeholder}
                              value={formStates[activeService.id].data[field.id] || ''}
                              onChange={(e) => handleFieldChange(activeService.id, field.id, e.target.value)}
                            />
                          )}

                          {field.type === 'select' && (
                            <select 
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer text-sm font-medium"
                              value={formStates[activeService.id].data[field.id] || ''}
                              onChange={(e) => handleFieldChange(activeService.id, field.id, e.target.value)}
                            >
                              <option value="">Select Option</option>
                              {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          )}

                          {field.type === 'radio' && (
                            <div className="flex flex-wrap gap-4 pt-2">
                              {field.options?.map(opt => (
                                <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                  <div className={cn(
                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                    formStates[activeService.id].data[field.id] === opt ? "border-indigo-600 bg-indigo-600" : "border-slate-200 group-hover:border-indigo-300"
                                  )}>
                                    {formStates[activeService.id].data[field.id] === opt && <div className="w-2 h-2 bg-white rounded-full shadow-sm" />}
                                  </div>
                                  <input 
                                    type="radio" 
                                    className="hidden" 
                                    checked={formStates[activeService.id].data[field.id] === opt}
                                    onChange={() => handleFieldChange(activeService.id, field.id, opt)}
                                  />
                                  <span className="text-sm font-medium text-slate-600">{opt}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {field.type === 'file' && (
                            <div className="relative group">
                              <input 
                                type="file" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <div className="w-full px-5 py-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center gap-3 text-slate-500 group-hover:border-indigo-400 group-hover:bg-indigo-50 transition-all">
                                <Plus size={20} />
                                <span className="text-sm font-bold">Choose or drag file</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={prevStep}
                  className="flex items-center gap-2 px-6 py-4 text-slate-500 font-bold hover:text-slate-900 transition-all bg-white border border-slate-100 rounded-[1.5rem]"
                >
                  <ChevronLeft size={20} />
                  Back
                </button>
                <div className="flex-1 max-w-[200px] h-2 bg-slate-100 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-indigo-600 transition-all duration-500" 
                     style={{ width: `${((currentFormIndex + 1) / selectedServiceIds.length) * 100}%` }}
                   />
                </div>
                <button
                  onClick={nextStep}
                  className="px-10 py-5 bg-indigo-600 text-white rounded-3xl font-black flex items-center gap-3 shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
                >
                  {currentFormIndex === selectedServiceIds.length - 1 ? 'Review Summary' : 'Next Configuration'}
                  <ChevronRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {view === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl space-y-10 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center text-white rotate-3">
                      <Layers size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">Request Summary</h3>
                      <p className="text-slate-400 text-sm font-medium">Review your selections before submitting</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setView('selection')}
                    className="p-3 bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-colors"
                  >
                    <Settings size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  {selectedServiceIds.map((id) => {
                    const srv = SERVICE_REQUEST_CONFIG.find(s => s.id === id);
                    const state = formStates[id];
                    if (!srv || state.mode === 'skip') return null;

                    return (
                      <div key={id} className="p-6 bg-slate-850 rounded-3xl border border-slate-800 flex items-start gap-5">
                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
                          <srv.icon size={20} />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-black text-slate-100">{srv.label}</h4>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                              state.mode === 'subscribe' ? "bg-indigo-500/20 text-indigo-300" : "bg-emerald-500/20 text-emerald-300"
                            )}>
                              {state.mode === 'subscribe' ? 'Subscribe' : 'Already Have'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-6 pb-2">
                             {Object.entries(state.data).map(([key, val]) => (
                               <div key={key}>
                                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{key.replace(/([A-Z])/g, ' $1')}</p>
                                 <p className="text-xs font-bold text-slate-300 truncate">{String(val)}</p>
                               </div>
                             ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-8 border-t border-slate-800 flex items-center justify-between">
                   <div className="space-y-1">
                     <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">Status</p>
                     <p className="text-lg font-black text-emerald-400">Ready to Process</p>
                   </div>
                   <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-12 py-5 bg-indigo-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-indigo-900/40 hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={24} />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Confirm Request
                        <CheckCircle2 size={24} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  )}

      {/* Background decoration */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-50 rounded-full blur-[120px]" />
      </div>
    </div>
  );
};
