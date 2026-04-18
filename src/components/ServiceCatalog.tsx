import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Settings2,
  Package,
  FileText,
  Users,
  ArrowRight,
  Trash2,
  Edit,
  Save,
  X,
  Upload,
  ExternalLink,
  DollarSign,
  LayoutGrid,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ServiceDefinition, 
  ServiceTier, 
  ClientService, 
  User as UserType, 
  ClientChecklistItem, 
  EmployeeTaskTemplate,
  AuditFields
} from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp,
  where,
  getDocs
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { serviceCatalogService } from '../services/serviceCatalogService';
import { Modal } from './Modal';
import { usePermissions } from '../hooks/usePermissions';
import { toast } from 'react-hot-toast';

interface ServiceCatalogProps {
  currentUser: UserType;
}

export const ServiceCatalog: React.FC<ServiceCatalogProps> = ({ currentUser }) => {
  const { isAdmin, check } = usePermissions(currentUser);
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [clientServices, setClientServices] = useState<ClientService[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'my-services' | 'all-subscriptions' | 'management'>(
    currentUser.role === 'Client' ? 'catalog' : (isAdmin ? 'management' : 'catalog')
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<ServiceDefinition | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<ServiceTier | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [viewingClientService, setViewingClientService] = useState<ClientService | null>(null);

  const calculateTotalPrice = () => {
    if (!selectedTier) return 0;
    const basePrice = selectedTier.price;
    const optionsPrice = (selectedTier.options || [])
      .filter(o => selectedOptionIds.includes(o.id))
      .reduce((sum, o) => sum + o.price, 0);
    return basePrice + optionsPrice;
  };

  useEffect(() => {
    const servicesQuery = query(collection(db, 'catalog'), orderBy('name', 'asc'));
    const unsubServices = onSnapshot(servicesQuery, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ServiceDefinition));
    });

    let clientServicesQuery;
    if (currentUser.role === 'Client') {
      clientServicesQuery = query(
        collection(db, 'client_services'), 
        where('clientId', '==', currentUser.id),
        orderBy('createdAt', 'desc')
      );
    } else {
      clientServicesQuery = query(collection(db, 'client_services'), orderBy('createdAt', 'desc'));
    }

    const unsubClientServices = onSnapshot(clientServicesQuery, (snapshot) => {
      setClientServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ClientService));
      setLoading(false);
    });

    return () => {
      unsubServices();
      unsubClientServices();
    };
  }, [currentUser]);

  const activateService = async (serviceId: string) => {
    try {
      await serviceCatalogService.activateService(serviceId);
      toast.success('Service activated and tasks generated!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'client_services');
    }
  };

  const handleSubscribe = async (service: ServiceDefinition, tier: ServiceTier) => {
    if (currentUser.role !== 'Client') {
      toast.error('Only clients can order services.');
      return;
    }

    try {
      const totalPrice = calculateTotalPrice();
      const clientChecklistProgress: any = {};
      tier.clientChecklist.forEach(item => {
        clientChecklistProgress[item.id] = {
          status: 'pending',
          updatedAt: new Date().toISOString()
        };
      });

      const clientServiceData = {
        clientId: currentUser.id,
        clientName: currentUser.name,
        serviceId: service.id,
        serviceName: service.name,
        tierId: tier.id,
        tierName: tier.name,
        selectedOptions: selectedOptionIds,
        status: 'Pending Payment',
        progress: 0,
        clientChecklistProgress,
        employeeTaskIds: [],
        isActivated: false,
        totalAmount: totalPrice,
        employeeEarnings: 0,
        companyProfit: 0,
        currency: tier.currency,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: currentUser.id,
        createdBy: currentUser.name
      };

      const docRef = await addDoc(collection(db, 'client_services'), clientServiceData);

      // Create Invoice with options
      try {
        const invoiceItems = [
          {
            description: `${service.name} - ${tier.name} Package`,
            quantity: 1,
            rate: tier.price,
            amount: tier.price
          },
          ...(tier.options || [])
            .filter(o => selectedOptionIds.includes(o.id))
            .map(o => ({
              description: `Add-on: ${o.name}`,
              quantity: 1,
              rate: o.price,
              amount: o.price
            }))
        ];

        const invoiceData = {
          clientId: currentUser.id,
          clientName: currentUser.name,
          invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          items: invoiceItems,
          subtotal: totalPrice,
          tax: 0,
          total: totalPrice,
          balance: totalPrice,
          status: 'unpaid',
          currency: tier.currency,
          notes: `Order for ${service.name} (${tier.name}) with options: ${selectedOptionIds.join(', ')}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdById: currentUser.id,
          createdBy: currentUser.name
        };
        const invRef = await addDoc(collection(db, 'invoices'), invoiceData);
        await updateDoc(docRef, { invoiceId: invRef.id });
      } catch (invError) {
        console.error('Error creating invoice:', invError);
      }

      // Notification
      try {
        await addDoc(collection(db, 'notifications'), {
          title: 'New Service Order',
          message: `${currentUser.name} placed an order for ${service.name} (${tier.name})`,
          type: 'info',
          userId: 'admin',
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
      }

      toast.success('Order placed! Please pay the invoice to activate service.');
      setIsSubscriptionModalOpen(false);
      setActiveTab('my-services');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'client_services');
    }
  };

  const updateChecklistProgress = async (clientService: ClientService, itemId: string, value: string, fileUrl?: string) => {
    try {
      const newProgress = { ...clientService.clientChecklistProgress };
      newProgress[itemId] = {
        ...newProgress[itemId],
        status: 'completed',
        value,
        fileUrl,
        updatedAt: new Date().toISOString()
      };

      // Calculate overall progress
      const totalItems = Object.keys(newProgress).length;
      const completedItems = Object.values(newProgress).filter((v: any) => v.status === 'completed').length;
      const progressPercentage = Math.round((completedItems / totalItems) * 100);

      await updateDoc(doc(db, 'client_services', clientService.id), {
        clientChecklistProgress: newProgress,
        progress: progressPercentage,
        status: progressPercentage === 100 ? 'Completed' : 'In Progress',
        updatedAt: new Date().toISOString()
      });

      toast.success('Progress updated!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'client_services');
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Service Catalog</h2>
          <p className="text-slate-500 mt-1 font-medium">Explore and manage our professional services and automated workflows.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit">
          <button 
            onClick={() => setActiveTab('catalog')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              activeTab === 'catalog' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <BookOpen size={18} />
            Catalog
          </button>
          {currentUser.role === 'Client' && (
            <button 
              onClick={() => setActiveTab('my-services')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'my-services' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Package size={18} />
              My Services
            </button>
          )}
          {isAdmin && (
            <>
              <button 
                onClick={() => setActiveTab('all-subscriptions')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === 'all-subscriptions' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Users size={18} />
                All Subscriptions
              </button>
              <button 
                onClick={() => setActiveTab('management')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === 'management' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Settings2 size={18} />
                Management
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Search services..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {activeTab === 'management' && isAdmin && (
          <button 
            onClick={() => {
              setSelectedService(null);
              setIsServiceModalOpen(true);
            }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            <Plus size={20} />
            Create Service
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'catalog' && (
          <motion.div 
            key="catalog"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {services.filter(s => s.isActive && s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(service => (
              <div key={service.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all group">
                <div className="p-6">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Package size={24} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{service.name}</h3>
                  <p className="text-slate-500 text-sm mt-2 line-clamp-2 font-medium">{service.description}</p>
                  
                  <div className="mt-6 space-y-3">
                    {service.tiers.map(tier => (
                      <div key={tier.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{tier.name}</p>
                          <p className="text-xs text-indigo-600 font-black">{tier.currency} {tier.price.toLocaleString()}</p>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedService(service);
                            setSelectedTier(tier);
                            setIsSubscriptionModalOpen(true);
                          }}
                          className="p-2 bg-white text-indigo-600 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        >
                          <ArrowRight size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'my-services' && (
          <motion.div 
            key="my-services"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {clientServices.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No active services</h3>
                <p className="text-slate-500 mt-1">Explore our catalog to subscribe to professional services.</p>
                <button 
                  onClick={() => setActiveTab('catalog')}
                  className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                >
                  Browse Catalog
                </button>
              </div>
            ) : (
              clientServices.map(cs => (
                <div key={cs.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900">{cs.serviceName}</h4>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{cs.tierName} Tier</p>
                    </div>
                  </div>

                  <div className="flex-1 max-w-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500">Progress</span>
                      <span className="text-xs font-black text-indigo-600">{cs.progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${cs.progress}%` }}
                        className="h-full bg-indigo-600 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                      cs.status === 'Completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      cs.status === 'In Progress' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                      "bg-slate-50 text-slate-500 border-slate-100"
                    )}>
                      {cs.status}
                    </span>
                    <button 
                      onClick={() => setViewingClientService(cs)}
                      className="px-4 py-2 bg-slate-50 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-all border border-slate-200"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {activeTab === 'all-subscriptions' && isAdmin && (
          <motion.div 
            key="all-subscriptions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Service</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Accounting</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clientServices.filter(cs => cs.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || cs.serviceName.toLowerCase().includes(searchQuery.toLowerCase())).map(cs => (
                    <tr key={cs.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{cs.clientName}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Subscribed on {new Date(cs.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{cs.serviceName}</p>
                        <p className="text-[10px] text-indigo-600 font-black uppercase tracking-wider">{cs.tierName}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-black text-slate-900">{cs.currency} {cs.totalAmount.toLocaleString()}</p>
                        {cs.isActivated ? (
                          <div className="flex flex-col text-[8px] font-black uppercase">
                            <span className="text-emerald-500">Profit: {cs.currency} {cs.companyProfit.toLocaleString()}</span>
                            <span className="text-amber-500">Employee: {cs.currency} {cs.employeeEarnings.toLocaleString()}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold italic">Awaiting Activation</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[100px]">
                            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${cs.progress}%` }} />
                          </div>
                          <span className="text-[10px] font-black text-slate-900">{cs.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                          cs.status === 'Completed' ? "bg-emerald-50 text-emerald-600" :
                          cs.status === 'In Progress' ? "bg-indigo-50 text-indigo-600" :
                          cs.status === 'Pending Payment' ? "bg-amber-50 text-amber-600" :
                          "bg-slate-100 text-slate-500"
                        )}>
                          {cs.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!cs.isActivated && (
                            <button 
                              onClick={() => activateService(cs.id)}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
                            >
                              Activate
                            </button>
                          )}
                          <button 
                            onClick={() => setViewingClientService(cs)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <ExternalLink size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'management' && isAdmin && (
          <motion.div 
            key="management"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiers</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(service => (
                    <tr key={service.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{service.name}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{service.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase">
                          {service.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-2">
                          {service.tiers.map((tier, i) => (
                            <div key={tier.id} className="w-8 h-8 rounded-full bg-white border-2 border-slate-50 flex items-center justify-center text-[10px] font-bold text-indigo-600 shadow-sm" title={tier.name}>
                              {tier.name[0]}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                          service.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                        )}>
                          {service.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setSelectedService(service);
                              setIsServiceModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={async () => {
                              if (confirm('Are you sure you want to delete this service?')) {
                                await deleteDoc(doc(db, 'services', service.id));
                                toast.success('Service deleted');
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Service Subscription Modal */}
      <Modal 
        isOpen={isSubscriptionModalOpen} 
        onClose={() => {
          setIsSubscriptionModalOpen(false);
          setSelectedOptionIds([]);
        }} 
        title={selectedService?.name || 'Service Details'}
      >
        {selectedService && selectedTier && (
          <div className="space-y-6">
            <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
              <h4 className="text-lg font-black text-indigo-900">{selectedTier.name} Package</h4>
              <p className="text-indigo-700 text-sm mt-1 font-medium">{selectedTier.description}</p>
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm font-bold text-indigo-900">Base Price</span>
                <span className="text-xl font-black text-indigo-600">{selectedTier.currency} {selectedTier.price.toLocaleString()}</span>
              </div>
            </div>

            {selectedTier.options && selectedTier.options.length > 0 && (
              <div className="space-y-4">
                <h5 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Available Add-ons</h5>
                <div className="space-y-2">
                  {selectedTier.options.map(option => (
                    <label key={option.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedOptionIds.includes(option.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOptionIds(prev => [...prev, option.id]);
                            } else {
                              setSelectedOptionIds(prev => prev.filter(id => id !== option.id));
                            }
                          }}
                        />
                        <span className="text-sm font-bold text-slate-900">{option.name}</span>
                      </div>
                      <span className="text-sm font-black text-indigo-600">+{selectedTier.currency} {option.price.toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-slate-900 rounded-2xl flex items-center justify-between text-white shadow-xl">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Price</p>
                <p className="text-2xl font-black">{selectedTier.currency} {calculateTotalPrice().toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">Invoice ready</p>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Requirements Checklist</h5>
              <div className="space-y-3">
                {selectedTier.clientChecklist.map(item => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="p-2 bg-white rounded-xl border border-slate-200 text-slate-400">
                      {item.type === 'document' ? <Upload size={16} /> : item.type === 'input' ? <FileText size={16} /> : <CheckCircle2 size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.description || (item.required ? 'Required' : 'Optional')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                onClick={() => setIsSubscriptionModalOpen(false)}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleSubscribe(selectedService, selectedTier)}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                Subscribe Now
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Client Service Detail Modal */}
      <Modal 
        isOpen={!!viewingClientService} 
        onClose={() => setViewingClientService(null)} 
        title={viewingClientService?.serviceName || 'Service Progress'}
      >
        {viewingClientService && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Status</p>
                <p className="font-black text-slate-900">{viewingClientService.status}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Progress</p>
                <p className="font-black text-indigo-600">{viewingClientService.progress}%</p>
              </div>
            </div>

            {isAdmin && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-900 rounded-2xl text-white">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                  <p className="text-sm font-black">{viewingClientService.currency} {viewingClientService.totalAmount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Company Profit</p>
                  <p className="text-sm font-black text-emerald-400">{viewingClientService.currency} {viewingClientService.companyProfit?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Employee Share</p>
                  <p className="text-sm font-black text-amber-400">{viewingClientService.currency} {viewingClientService.employeeEarnings?.toLocaleString()}</p>
                </div>
              </div>
            )}

            {viewingClientService.selectedOptions && viewingClientService.selectedOptions.length > 0 && (
              <div className="space-y-4">
                <h5 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Selected Add-ons</h5>
                <div className="flex flex-wrap gap-2">
                  {viewingClientService.selectedOptions.map(optId => {
                    const option = services.find(s => s.id === viewingClientService.serviceId)?.tiers.find(t => t.id === viewingClientService.tierId)?.options?.find(o => o.id === optId);
                    return option ? (
                      <span key={optId} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-100 uppercase tracking-wider">
                        {option.name} (+{viewingClientService.currency} {option.price})
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h5 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Your Checklist</h5>
              <div className="space-y-3">
                {services.find(s => s.id === viewingClientService.serviceId)?.tiers.find(t => t.id === viewingClientService.tierId)?.clientChecklist.map(item => {
                  const progress = viewingClientService.clientChecklistProgress[item.id];
                  const isCompleted = progress?.status === 'completed';

                  return (
                    <div key={item.id} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-xl border transition-all",
                            isCompleted ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-200"
                          )}>
                            {item.type === 'document' ? <Upload size={16} /> : item.type === 'input' ? <FileText size={16} /> : <CheckCircle2 size={16} />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{item.label}</p>
                            {isCompleted && <p className="text-[10px] text-emerald-600 font-bold uppercase">Completed</p>}
                          </div>
                        </div>
                        {!isCompleted && (
                          <button 
                            onClick={() => {
                              const val = prompt(`Enter ${item.label}:`);
                              if (val) updateChecklistProgress(viewingClientService, item.id, val);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                      {isCompleted && progress.value && (
                        <div className="pl-11">
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">{progress.value}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Service Management Modal (Create/Edit) */}
      <ServiceManagementModal 
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        service={selectedService}
      />
    </div>
  );
};

interface ServiceManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceDefinition | null;
}

const ServiceManagementModal: React.FC<ServiceManagementModalProps> = ({ isOpen, onClose, service }) => {
  const [formData, setFormData] = useState<Partial<ServiceDefinition>>({
    name: '',
    description: '',
    category: 'General',
    isActive: true,
    tiers: []
  });

  useEffect(() => {
    if (service) {
      setFormData(service);
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'General',
        isActive: true,
        tiers: []
      });
    }
  }, [service, isOpen]);

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Service name is required');
      return;
    }

    try {
      if (service) {
        await updateDoc(doc(db, 'catalog', service.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success('Service updated');
      } else {
        await addDoc(collection(db, 'catalog'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success('Service created');
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'catalog');
    }
  };

  const addTier = () => {
    const newTier: ServiceTier = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Tier',
      description: '',
      price: 0,
      currency: 'PKR',
      clientChecklist: [],
      employeeChecklist: [],
      options: [],
      employeeSharePercentage: 50
    };
    setFormData(prev => ({ ...prev, tiers: [...(prev.tiers || []), newTier] }));
  };

  const updateTier = (tierId: string, updates: Partial<ServiceTier>) => {
    setFormData(prev => ({
      ...prev,
      tiers: prev.tiers?.map(t => t.id === tierId ? { ...t, ...updates } : t)
    }));
  };

  const removeTier = (tierId: string) => {
    setFormData(prev => ({
      ...prev,
      tiers: prev.tiers?.filter(t => t.id !== tierId)
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={service ? 'Edit Service' : 'Create New Service'}>
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Service Name</label>
            <input 
              type="text"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Category</label>
            <select 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
            >
              <option>General</option>
              <option>Technical</option>
              <option>Editorial</option>
              <option>Finance</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Description</label>
          <textarea 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Service Tiers</h4>
            <button 
              onClick={addTier}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-2"
            >
              <Plus size={14} />
              Add Tier
            </button>
          </div>

          <div className="space-y-4">
            {formData.tiers?.map((tier, index) => (
              <div key={tier.id} className="p-4 bg-slate-50 rounded-3xl border border-slate-200 space-y-4 relative">
                <button 
                  onClick={() => removeTier(tier.id)}
                  className="absolute top-4 right-4 p-1 text-slate-400 hover:text-rose-600 transition-all"
                >
                  <Trash2 size={16} />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tier Name</label>
                    <input 
                      type="text"
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={tier.name}
                      onChange={e => updateTier(tier.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Price</label>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        className="flex-1 p-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={tier.price}
                        onChange={e => updateTier(tier.id, { price: Number(e.target.value) })}
                      />
                      <select 
                        className="w-20 p-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={tier.currency}
                        onChange={e => updateTier(tier.id, { currency: e.target.value as any })}
                      >
                        <option>PKR</option>
                        <option>USD</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Employee Share (%)</label>
                  <input 
                    type="number"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={tier.employeeSharePercentage}
                    onChange={e => updateTier(tier.id, { employeeSharePercentage: Number(e.target.value) })}
                    min="0"
                    max="100"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pricing Options (Add-ons)</h5>
                    <button 
                      onClick={() => {
                        const newOption = { id: Math.random().toString(36).substr(2, 9), name: 'New Option', price: 0 };
                        updateTier(tier.id, { options: [...(tier.options || []), newOption] });
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:underline"
                    >
                      + Add Option
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(tier.options || []).map(option => (
                      <div key={option.id} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
                        <input 
                          type="text"
                          className="flex-1 bg-transparent border-none text-xs outline-none"
                          placeholder="Option name"
                          value={option.name}
                          onChange={e => {
                            const newOptions = tier.options.map(o => o.id === option.id ? { ...o, name: e.target.value } : o);
                            updateTier(tier.id, { options: newOptions });
                          }}
                        />
                        <input 
                          type="number"
                          className="w-20 bg-slate-50 border-none text-xs rounded-lg px-2 py-1 outline-none font-bold text-indigo-600"
                          placeholder="Price"
                          value={option.price}
                          onChange={e => {
                            const newOptions = tier.options.map(o => o.id === option.id ? { ...o, price: Number(e.target.value) } : o);
                            updateTier(tier.id, { options: newOptions });
                          }}
                        />
                        <button 
                          onClick={() => {
                            const newOptions = tier.options.filter(o => o.id !== option.id);
                            updateTier(tier.id, { options: newOptions });
                          }}
                          className="text-slate-300 hover:text-rose-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Checklist</h5>
                    <button 
                      onClick={() => {
                        const newItem: ClientChecklistItem = {
                          id: Math.random().toString(36).substr(2, 9),
                          label: 'New Requirement',
                          type: 'document',
                          required: true
                        };
                        updateTier(tier.id, { clientChecklist: [...tier.clientChecklist, newItem] });
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:underline"
                    >
                      + Add Item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {tier.clientChecklist.map(item => (
                      <div key={item.id} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
                        <select 
                          className="bg-slate-50 border-none text-[10px] font-bold rounded-lg px-2 py-1 outline-none"
                          value={item.type}
                          onChange={e => {
                            const newChecklist = tier.clientChecklist.map(i => i.id === item.id ? { ...i, type: e.target.value as any } : i);
                            updateTier(tier.id, { clientChecklist: newChecklist });
                          }}
                        >
                          <option value="document">Doc</option>
                          <option value="input">Input</option>
                          <option value="step">Step</option>
                        </select>
                        <input 
                          type="text"
                          className="flex-1 bg-transparent border-none text-xs outline-none"
                          value={item.label}
                          onChange={e => {
                            const newChecklist = tier.clientChecklist.map(i => i.id === item.id ? { ...i, label: e.target.value } : i);
                            updateTier(tier.id, { clientChecklist: newChecklist });
                          }}
                        />
                        <button 
                          onClick={() => {
                            const newChecklist = tier.clientChecklist.filter(i => i.id !== item.id);
                            updateTier(tier.id, { clientChecklist: newChecklist });
                          }}
                          className="text-slate-300 hover:text-rose-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Tasks</h5>
                    <button 
                      onClick={() => {
                        const newItem: EmployeeTaskTemplate = {
                          id: Math.random().toString(36).substr(2, 9),
                          label: 'New Task',
                          department: 'Technical',
                          priority: 'medium',
                          daysToComplete: 3
                        };
                        updateTier(tier.id, { employeeChecklist: [...tier.employeeChecklist, newItem] });
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:underline"
                    >
                      + Add Task
                    </button>
                  </div>
                  <div className="space-y-2">
                    {tier.employeeChecklist.map(task => (
                      <div key={task.id} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
                        <input 
                          type="text"
                          className="flex-1 bg-transparent border-none text-xs outline-none"
                          value={task.label}
                          onChange={e => {
                            const newTasks = tier.employeeChecklist.map(t => t.id === task.id ? { ...t, label: e.target.value } : t);
                            updateTier(tier.id, { employeeChecklist: newTasks });
                          }}
                        />
                        <select 
                          className="bg-slate-50 border-none text-[10px] font-bold rounded-lg px-2 py-1 outline-none"
                          value={task.department}
                          onChange={e => {
                            const newTasks = tier.employeeChecklist.map(t => t.id === task.id ? { ...t, department: e.target.value as any } : t);
                            updateTier(tier.id, { employeeChecklist: newTasks });
                          }}
                        >
                          <option>Technical</option>
                          <option>Accounts</option>
                          <option>Editorial</option>
                          <option>General</option>
                        </select>
                        <button 
                          onClick={() => {
                            const newTasks = tier.employeeChecklist.filter(t => t.id !== task.id);
                            updateTier(tier.id, { employeeChecklist: newTasks });
                          }}
                          className="text-slate-300 hover:text-rose-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            {service ? 'Update Service' : 'Create Service'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
