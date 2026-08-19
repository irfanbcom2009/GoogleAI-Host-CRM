import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  CreditCard, 
  ShoppingBag, 
  Zap, 
  Check, 
  Package, 
  Plus,
  ShieldCheck,
  Globe,
  Server,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { WIZARD_SERVICES, WizardService } from '../constants/wizardConfig';
import { db, handleFirestoreError, OperationType, sendNotification, getErrorMessage } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { User as UserType } from '../types';
import { toast } from 'react-hot-toast';
import { SelectDomainField } from './SelectDomainField';

interface ServiceOrderWizardProps {
  currentUser: UserType;
  onComplete?: () => void;
}

type ServiceSelection = 'already_have' | 'subscribe' | 'skip';

interface SelectionState {
  type: ServiceSelection;
  data: Record<string, any>;
  options: string[]; // IDs of selected options
}

export const ServiceOrderWizard: React.FC<ServiceOrderWizardProps> = ({ currentUser, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, SelectionState>>(() => {
    const initial: Record<string, SelectionState> = {};
    WIZARD_SERVICES.forEach(s => {
      initial[s.id] = {
        type: 'subscribe',
        data: {},
        options: []
      };
    });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [registrars, setRegistrars] = useState<any[]>([]);
  const [clientDomains, setClientDomains] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [isCustomRegistrar, setIsCustomRegistrar] = useState(false);
  const [isCustomServer, setIsCustomServer] = useState(false);

  useEffect(() => {
    const unsubRegistrars = onSnapshot(collection(db, 'registrars'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistrars(list);
    }, (error) => {
      console.error("Error fetching registrars in ServiceOrderWizard: ", error);
    });

    const domainsQuery = query(collection(db, 'domains'), where('clientId', '==', currentUser.id));
    const unsubDomains = onSnapshot(domainsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClientDomains(list);
    }, (err) => {
      console.error("Error fetching domains in ServiceOrderWizard: ", err);
    });

    const unsubServers = onSnapshot(collection(db, 'servers'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServers(list);
    }, (err) => {
      console.error("Error fetching servers in ServiceOrderWizard: ", err);
    });

    return () => {
      unsubRegistrars();
      unsubDomains();
      unsubServers();
    };
  }, [currentUser.id]);

  const activeService = WIZARD_SERVICES[currentStep];
  const isLastStep = currentStep === WIZARD_SERVICES.length - 1;

  const currentSelection = selections[activeService.id] || { 
    type: 'subscribe', 
    data: {}, 
    options: [] 
  };

  const handleTypeChange = (type: ServiceSelection) => {
    setFormError(null);
    setSelections(prev => ({
      ...prev,
      [activeService.id]: { ...currentSelection, type }
    }));
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormError(null);
    setSelections(prev => ({
      ...prev,
      [activeService.id]: {
        ...currentSelection,
        data: { ...currentSelection.data, [fieldId]: value }
      }
    }));
  };

  const toggleOption = (optionId: string) => {
    const options = currentSelection.options.includes(optionId)
      ? currentSelection.options.filter(id => id !== optionId)
      : [...currentSelection.options, optionId];
    
    setSelections(prev => ({
      ...prev,
      [activeService.id]: { ...currentSelection, options }
    }));
  };

  const validateStep = () => {
    if (currentSelection.type === 'skip') return true;

    const missingFields = activeService.clientFields
      .filter(f => f.required && (!f.showFor || f.showFor === 'both' || f.showFor === currentSelection.type))
      .filter(f => !currentSelection.data[f.id]);

    if (missingFields.length > 0) {
      setFormError(`Please fill in all required fields: ${missingFields.map(f => f.label).join(', ')}`);
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      if (currentStep < WIZARD_SERVICES.length - 1) {
        setCurrentStep(prev => prev + 1);
        setFormError(null);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setFormError(null);
    }
  };

  const calculateTotal = useMemo(() => {
    let total = 0;
    Object.entries(selections).forEach(([serviceId, selection]) => {
      if (selection.type === 'subscribe') {
        const service = WIZARD_SERVICES.find(s => s.id === serviceId);
        if (service) {
          if (serviceId === 'hosting') {
            const pref = selection.data['hostingPreference'] || '';
            let price = 50; // default to 50
            if (pref.includes('150') || pref.includes('Dedicated')) {
              price = 150;
            } else if (pref.includes('100') || pref.includes('Upgrade')) {
              price = 100;
            } else if (pref.includes('50') || pref.includes('Shared')) {
              price = 50;
            }
            total += price;
          } else if (serviceId === 'indexing') {
            const pack = selection.data['indexingPackage'] || '';
            let price = 10; // default to 10
            if (pack.includes('Starter') || pack.includes('10')) {
              price = 10;
            } else if (pack.includes('Professional') || pack.includes('20')) {
              price = 20;
            } else if (pack.includes('Premium') || pack.includes('50')) {
              price = 50;
            } else if (pack.includes('Enterprise') || pack.includes('Custom')) {
              price = 0;
            }
            total += price;
          } else {
            total += service.basePrice;
          }
          selection.options.forEach(optId => {
            const opt = service.options.find(o => o.id === optId);
            if (opt) total += opt.price;
          });
        }
      }
    });
    return total;
  }, [selections]);

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setIsSubmitting(true);
    setFormError(null);
    try {
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      const orderData = {
        orderNumber,
        clientId: currentUser.id,
        clientName: currentUser.name,
        status: 'pending',
        totalAmount: calculateTotal,
        selections,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isWizardOrder: true,
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);

      // Create separate Task groups for each subscribed service
      for (const [serviceId, selection] of Object.entries(selections)) {
        if (selection.type === 'subscribe') {
          const service = WIZARD_SERVICES.find(s => s.id === serviceId);
          if (service) {
            let actualPrice = service.basePrice;
            if (serviceId === 'hosting') {
              const pref = selection.data['hostingPreference'] || '';
              if (pref.includes('150') || pref.includes('Dedicated')) {
                actualPrice = 150;
              } else {
                actualPrice = 50;
              }
            } else if (serviceId === 'indexing') {
              const pack = selection.data['indexingPackage'] || '';
              if (pack.includes('Starter') || pack.includes('10')) {
                actualPrice = 10;
              } else if (pack.includes('Professional') || pack.includes('20')) {
                actualPrice = 20;
              } else if (pack.includes('Premium') || pack.includes('50')) {
                actualPrice = 50;
              } else if (pack.includes('Enterprise') || pack.includes('Custom')) {
                actualPrice = 0;
              }
            }
            // Create sub-order or just tasks
            for (const taskTemplate of service.employeeTasks) {
              const dueDate = new Date();
              dueDate.setDate(dueDate.getDate() + taskTemplate.days);

              await addDoc(collection(db, 'tasks'), {
                clientId: currentUser.id,
                clientName: currentUser.name,
                linkedOrderId: orderRef.id,
                serviceType: serviceId.toUpperCase(),
                title: `${service.label}: ${taskTemplate.label}`,
                description: `Onboarding task for ${service.label}`,
                status: 'pending',
                priority: 'medium',
                points: Math.floor(actualPrice * 0.5 * (taskTemplate.reward / 100)), // 50% Reward logic
                reward: Math.floor(actualPrice * 0.5 * (taskTemplate.reward / 100)), // Mirror points to reward
                dueDate: dueDate.toISOString(),
                createdAt: new Date().toISOString(),
                isClientVisible: true,
                deliverablesData: selection.data
              });
            }
          }
        }
      }

      // Create Invoice
      if (calculateTotal > 0) {
        await addDoc(collection(db, 'invoices'), {
          clientId: currentUser.id,
          clientName: currentUser.name,
          invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
          date: new Date().toISOString().split('T')[0],
          total: calculateTotal,
          balance: calculateTotal,
          status: 'unpaid',
          items: Object.entries(selections)
            .filter(([_, s]) => s.type === 'subscribe')
            .map(([serviceId, s]) => {
              const service = WIZARD_SERVICES.find(srv => srv.id === serviceId);
              return {
                description: service?.label || serviceId,
                amount: (service?.basePrice || 0) + s.options.reduce((sum, optId) => {
                  return sum + (service?.options.find(o => o.id === optId)?.price || 0);
                }, 0)
              };
            }),
          createdAt: new Date().toISOString()
        });
      }

      setIsSuccess(true);
      toast.success('Order submitted successfully!');
    } catch (error: any) {
      const friendlyMessage = getErrorMessage(error);
      setFormError(friendlyMessage);
      toast.error(friendlyMessage);
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="text-3xl font-black text-slate-900 border-none">Order Placed Successfully!</h2>
        <p className="text-slate-500 max-w-md mx-auto font-medium">
          Your service request has been received. Our team will start working on your journal setup immediately. 
          You can track progress in your dashboard.
        </p>
        <button 
          onClick={onComplete}
          className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="w-full py-4">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Journal Setup Wizard</h2>
            <p className="text-slate-500 font-medium mt-1">Configure services to set up your academic journal step-by-step</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estimated Total</p>
            <p className="text-3xl font-black text-indigo-600">${calculateTotal}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeService.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-8"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-indigo-600 shadow-inner shrink-0">
                  <activeService.icon size={32} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-slate-900">{activeService.label}</h3>
                    {activeService.isOptional && (
                      <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase tracking-wider">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 font-medium">{activeService.description}</p>
                </div>
              </div>

              {/* Selection Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'subscribe', label: 'Subscribe', desc: 'Need this service', icon: Zap },
                  { id: 'already_have', label: 'Already Have', desc: 'Enter details only', icon: CheckCircle2 },
                  { id: 'skip', label: 'Skip', desc: 'Move to next', icon: ArrowRight }
                ].map((choice) => (
                  <button
                    key={choice.id}
                    onClick={() => handleTypeChange(choice.id as ServiceSelection)}
                    className={cn(
                      "p-6 rounded-3xl border-2 text-left transition-all group",
                      currentSelection.type === choice.id 
                        ? "border-indigo-600 bg-indigo-50/50" 
                        : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors",
                      currentSelection.type === choice.id ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-400 group-hover:text-slate-600"
                    )}>
                      <choice.icon size={20} />
                    </div>
                    <p className={cn("font-black uppercase tracking-widest text-[10px]", currentSelection.type === choice.id ? "text-indigo-600" : "text-slate-400")}>
                      {choice.label}
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{choice.desc}</p>
                  </button>
                ))}
              </div>

              {/* Dynamic Content based on selection */}
              {currentSelection.type !== 'skip' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6 pt-6 border-t border-slate-100"
                >
                  {/* Options for Subscribe */}
                  {currentSelection.type === 'subscribe' && activeService.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {activeService.options.map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleOption(opt.id)}
                          className={cn(
                            "px-4 py-3 rounded-2xl border transition-all flex items-center gap-3 w-full text-left h-full group",
                            currentSelection.options.includes(opt.id)
                              ? "bg-emerald-50/60 border-emerald-200 text-emerald-800 font-bold"
                              : "bg-white border-slate-100 text-slate-600 hover:border-indigo-200"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all",
                            currentSelection.options.includes(opt.id) 
                              ? "bg-emerald-500 border-emerald-500 text-white" 
                              : "border-slate-300 group-hover:border-indigo-400"
                          )}>
                            {currentSelection.options.includes(opt.id) && <Check size={12} />}
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-xs font-bold leading-tight text-slate-800 group-hover:text-slate-900">{opt.label}</p>
                            <p className="text-[10px] font-black mt-1 text-slate-400">
                              {opt.price === 0 ? 'FREE' : `+$${opt.price}`}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activeService.clientFields
                      .filter(field => !field.showFor || field.showFor === 'both' || field.showFor === currentSelection.type)
                      .map(field => {
                        // Support custom domainNameSelection with pre-existing domains list
                        if (activeService.id === 'domain' && field.id === 'domainNameSelection') {
                          const savedValue = currentSelection.data[field.id] || '';
                          
                          return (
                            <div key={field.id} className="col-span-1 md:col-span-2">
                              <SelectDomainField
                                required={field.required}
                                clientId={currentUser.id}
                                selectedDomainNameOrId={savedValue}
                                onChange={(value) => {
                                  handleFieldChange(field.id, value);
                                }}
                                label={field.label}
                              />
                            </div>
                          );
                        }

                        // Support custom registrarSelection with pre-existing registrars list
                        if (activeService.id === 'domain' && field.id === 'registrarSelection') {
                          const savedValue = currentSelection.data[field.id] || '';
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
                                        handleFieldChange(field.id, '');
                                      } else {
                                        handleFieldChange(field.id, e.target.value);
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
                                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                    />
                                    {hasRegistrars && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsCustomRegistrar(false);
                                          handleFieldChange(field.id, '');
                                        }}
                                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-300 transition-colors whitespace-nowrap"
                                      >
                                        Select From List
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Support custom indexing package selection with professional cards, comparison table and disclaimer
                        if (activeService.id === 'indexing' && field.id === 'indexingPackage') {
                          const savedValue = currentSelection.data[field.id] || '';
                          
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
                                      onClick={() => handleFieldChange(field.id, opt.id)}
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
                          const savedValue = currentSelection.data[field.id] || '';
                          
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
                                    onClick={() => handleFieldChange(field.id, opt.id)}
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
                          const savedValue = currentSelection.data[field.id] || '';
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
                                        handleFieldChange(field.id, '');
                                      } else {
                                        handleFieldChange(field.id, e.target.value);
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
                                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                    />
                                    {hasServers && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsCustomServer(false);
                                          handleFieldChange(field.id, '');
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
                          <div key={field.id} className={cn("space-y-2", (field.type === 'textarea' || field.id === 'eb_cv' || field.id === 'review_files') && "col-span-1 md:col-span-2")}>
                            <label className="text-sm font-bold text-slate-700">
                              {field.label}
                              {field.required && <span className="text-rose-500 ml-1">*</span>}
                            </label>
                            
                            {field.type === 'text' && (
                              <input 
                                type={field.id.toLowerCase().includes('date') || field.id === 'expiry' ? 'date' : 'text'} 
                                placeholder={field.placeholder}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                                value={currentSelection.data[field.id] || ''}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                              />
                            )}
                            
                            {field.type === 'textarea' && (
                              <textarea 
                                rows={3}
                                placeholder={field.placeholder}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm font-medium"
                                value={currentSelection.data[field.id] || ''}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                              />
                            )}
                            
                            {field.type === 'select' && (
                              field.id === 'tld' ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                                    {field.options?.map(opt => {
                                      const isSel = (currentSelection.data[field.id] || '')
                                        .split(',')
                                        .map((s: string) => s.trim())
                                        .filter(Boolean)
                                        .includes(opt);
                                      return (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() => {
                                            const currentVal = currentSelection.data[field.id] || '';
                                            let selectedList = currentVal.split(',').map((s: string) => s.trim()).filter(Boolean);
                                            if (selectedList.includes(opt)) {
                                              selectedList = selectedList.filter((s: string) => s !== opt);
                                            } else {
                                              selectedList = [...selectedList, opt];
                                            }
                                            handleFieldChange(field.id, selectedList.join(', '));
                                          }}
                                          className={cn(
                                            "flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-black tracking-wide transition-all duration-200 cursor-pointer text-center",
                                            isSel
                                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                          )}
                                        >
                                          <span className="flex-1 text-center font-mono">{opt}</span>
                                          {isSel && (
                                            <Check size={12} className="stroke-[3.5] shrink-0 ml-1" />
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <p className="text-[11px] text-slate-400 font-medium">
                                    You can select multiple TLDs above to reserve for your journal website.
                                  </p>
                                </div>
                              ) : (
                                <select
                                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer text-sm font-medium"
                                  value={currentSelection.data[field.id] || ''}
                                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                >
                                  <option value="">-- Select {field.label} --</option>
                                  {field.options?.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              )
                            )}
                            
                            {field.type === 'radio' && (
                              <div className="flex gap-4 p-1">
                                {field.options?.map(opt => (
                                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                      type="radio" 
                                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" 
                                      checked={currentSelection.data[field.id] === opt}
                                      onChange={() => handleFieldChange(field.id, opt)}
                                    />
                                    <span className="text-sm font-medium text-slate-650">{opt}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {field.type === 'file' && (
                              <div className="flex items-center justify-center w-full">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition-colors">
                                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Plus className="w-8 h-8 mb-3 text-slate-400" />
                                    <p className="mb-2 text-xs text-slate-500"><span className="font-bold">Click to upload</span> or drag and drop</p>
                                    <p className="text-[10px] text-slate-400">PDF, DOC, DOCX, JPG or PNG (Max. 10MB)</p>
                                  </div>
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) {
                                        handleFieldChange(field.id, e.target.files[0].name);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          {formError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600"
            >
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-bold">{formError}</p>
            </motion.div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 disabled:opacity-0 transition-all"
            >
              <ChevronLeft size={20} />
              Previous Step
            </button>
            <button
              onClick={isLastStep ? handleSubmit : nextStep}
              disabled={isSubmitting}
              className="px-10 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-bold flex items-center gap-2 shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {isLastStep ? (isSubmitting ? 'Processing...' : 'Review & Finalize') : 'Next Configuration'}
              {!isSubmitting && <ChevronRight size={20} />}
            </button>
          </div>
        </div>

        {/* Unified Interactive Navigation & Order Summary Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 sm:p-7 rounded-[2.5rem] shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shrink-0">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-widest text-xs">Order Summary</h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Step {currentStep + 1} of {WIZARD_SERVICES.length}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-full">
                  Interactive Track
                </span>
              </div>
            </div>

            {/* Vertical progress timeline list */}
            <div className="relative pl-0 space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {/* Left vertical timeline line passing exactly through the node circles */}
              <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-slate-800/80 pointer-events-none" />

              {WIZARD_SERVICES.map((s, idx) => {
                const isActive = idx === currentStep;
                const isCompleted = idx < currentStep;
                const isFuture = idx > currentStep;
                
                const selection = selections[s.id] || { type: 'skip', data: {}, options: [] };
                const isSkipped = selection.type === 'skip';
                const isAlreadyHave = selection.type === 'already_have';
                
                // Calculate prices
                let basePrice = s.basePrice;
                if (s.id === 'hosting') {
                  const pref = selection.data['hostingPreference'] || '';
                  if (pref.includes('150') || pref.includes('Dedicated')) {
                    basePrice = 150;
                  } else if (pref.includes('100') || pref.includes('Upgrade')) {
                    basePrice = 100;
                  } else {
                    basePrice = 50;
                  }
                } else if (s.id === 'indexing') {
                  const pack = selection.data['indexingPackage'] || '';
                  if (pack.includes('Starter') || pack.includes('10')) {
                    basePrice = 10;
                  } else if (pack.includes('Professional') || pack.includes('20')) {
                    basePrice = 20;
                  } else if (pack.includes('Premium') || pack.includes('50')) {
                    basePrice = 50;
                  } else if (pack.includes('Enterprise') || pack.includes('Custom')) {
                    basePrice = 0;
                  }
                }
                
                const optionsPrice = selection.options.reduce((sum, optId) => {
                  const opt = s.options.find(o => o.id === optId);
                  return sum + (opt?.price || 0);
                }, 0);
                
                const itemPrice = isSkipped || isAlreadyHave ? 0 : (basePrice + optionsPrice);

                return (
                  <div 
                    key={s.id}
                    onClick={() => {
                      if (idx <= currentStep || validateStep()) {
                        setCurrentStep(idx);
                      }
                    }}
                    className={cn(
                      "relative flex items-center gap-4.5 p-2.5 rounded-2xl transition-all cursor-pointer group",
                      isActive 
                        ? "bg-slate-850 border border-indigo-500/35 shadow-lg text-white" 
                        : isFuture 
                        ? "opacity-35 hover:opacity-60 text-slate-400" 
                        : "hover:bg-slate-800/40 text-slate-300"
                    )}
                  >
                    {/* Timeline Node Icon/Number */}
                    <div className="relative z-10 shrink-0">
                      <div className={cn(
                        "w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black transition-all",
                        isActive 
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/50 scale-105" 
                          : isSkipped 
                          ? "bg-slate-850 text-slate-600 border border-slate-800" 
                          : isCompleted 
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                          : "bg-slate-850 text-slate-500 border border-slate-800"
                      )}>
                        {isCompleted && !isSkipped ? (
                          <Check size={12} className="stroke-[3]" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                    </div>

                    {/* Item Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "text-xs font-bold leading-tight truncate block",
                          isActive ? "text-white" : isSkipped ? "text-slate-500 line-through" : "text-slate-300"
                        )}>
                          {s.label}
                        </span>
                        
                        {/* Item Price */}
                        <span className={cn(
                          "text-xs font-black shrink-0 font-mono",
                          isSkipped 
                            ? "text-slate-600 line-through font-medium" 
                            : isAlreadyHave 
                            ? "text-emerald-400/80 text-[9px] uppercase font-bold" 
                            : "text-slate-200"
                        )}>
                          {isSkipped 
                            ? "Skip" 
                            : isAlreadyHave 
                            ? "Owner" 
                            : `$${itemPrice}`
                          }
                        </span>
                      </div>

                      {/* Selected Options List */}
                      {!isSkipped && !isAlreadyHave && selection.options.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {selection.options.map(optId => {
                            const opt = s.options.find(o => o.id === optId);
                            return (
                              <div key={optId} className="flex items-center justify-between text-[9px] text-slate-500 pl-2">
                                <span className="truncate">+ {opt?.label}</span>
                                <span className="shrink-0 font-mono">+${opt?.price}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Action Button: X to clear/skip item */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelections(prev => {
                          const current = prev[s.id];
                          const newType = current.type === 'skip' ? 'subscribe' : 'skip';
                          return {
                            ...prev,
                            [s.id]: {
                              ...current,
                              type: newType
                            }
                          };
                        });
                        toast.success(isSkipped ? `Subscribed to ${s.label}` : `Skipped ${s.label}`);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all shrink-0 ml-1"
                      title={isSkipped ? "Subscribe to this service" : "Skip this service"}
                    >
                      <X size={12} className={cn(isSkipped && "rotate-45 text-emerald-400 hover:text-emerald-300")} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Total Section */}
            <div className="pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between text-lg font-black">
                <span>Total Amount</span>
                <span className="text-indigo-400">${calculateTotal}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <Zap size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Automation Ready</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Our system will automatically generate all necessary tasks and assign them to our specialized team members upon confirmation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
