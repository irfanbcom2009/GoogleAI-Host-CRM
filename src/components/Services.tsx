import React, { useState, useEffect } from 'react';
import { 
  FileCheck, 
  Globe, 
  Search, 
  BookOpen, 
  TrendingUp, 
  CheckCircle2, 
  DollarSign, 
  ArrowRight,
  Info,
  Package,
  Shield,
  Zap,
  Layout,
  Users,
  MessageSquare,
  Plus,
  ShoppingCart,
  X,
  CreditCard,
  Briefcase,
  Loader2,
  Check,
  Send,
  Edit3,
  Save,
  Trash2,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, where, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Modal } from './Modal';
import { Client, User } from '../types';
import { useServices } from '../hooks/useServices';

interface ServicesProps {
  currentUser: User | null;
}

export const Services: React.FC<ServicesProps> = ({ currentUser }) => {
  const { catalog: initialCatalog, loading: loadingCatalog } = useServices();
  const [catalog, setCatalog] = useState<any[]>([]);
  const [isEditingCatalog, setIsEditingCatalog] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [orderData, setOrderData] = useState({
    clientId: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    selectedItems: [] as string[],
    notes: ''
  });
  const [isOrdering, setIsOrdering] = useState(false);
  const [isSavingCatalog, setIsSavingCatalog] = useState(false);

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  useEffect(() => {
    if (initialCatalog.length > 0) {
      setCatalog(initialCatalog);
      if (!activeCategory) {
        setActiveCategory(initialCatalog[0].id);
      }
    }
  }, [initialCatalog]);

  const getIcon = (id: string) => {
    switch (id) {
      case 'issn': return FileCheck;
      case 'hosting': return Globe;
      case 'indexing': return Search;
      case 'editorial': return BookOpen;
      case 'bundles': return Package;
      default: return TrendingUp;
    }
  };

  const getColor = (id: string) => {
    switch (id) {
      case 'issn': return 'text-indigo-600';
      case 'hosting': return 'text-emerald-600';
      case 'indexing': return 'text-amber-600';
      case 'editorial': return 'text-rose-600';
      case 'bundles': return 'text-purple-600';
      default: return 'text-purple-600';
    }
  };

  const getBg = (id: string) => {
    switch (id) {
      case 'issn': return 'bg-indigo-50';
      case 'hosting': return 'bg-emerald-50';
      case 'indexing': return 'bg-amber-50';
      case 'editorial': return 'bg-rose-50';
      case 'bundles': return 'bg-purple-50';
      default: return 'bg-purple-50';
    }
  };

  const processedCatalog = catalog.map(cat => ({
    ...cat,
    icon: getIcon(cat.id),
    color: getColor(cat.id),
    bg: getBg(cat.id),
    items: cat.items.map((item: any) => ({
      ...item,
      displayPrice: `PKR ${(item.price || 0).toLocaleString()}${item.unit ? ` / ${item.unit}` : ''}`
    }))
  }));

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client')), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    return () => unsub();
  }, [currentUser]);

  const filteredServices = processedCatalog.map(cat => ({
    ...cat,
    items: cat.items.filter((item: any) => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0);

  const activeCategoryData = processedCatalog.find(c => c.id === activeCategory);

  const handleSaveCatalog = async () => {
    setIsSavingCatalog(true);
    try {
      await updateDoc(doc(db, 'settings', 'services'), {
        categories: catalog,
        updatedAt: serverTimestamp()
      });
      setIsEditingCatalog(false);
      alert('Catalog updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/services');
    } finally {
      setIsSavingCatalog(false);
    }
  };

  const handleUpdateItem = (catId: string, itemIndex: number, field: string, value: any) => {
    setCatalog(prev => prev.map(cat => {
      if (cat.id === catId) {
        const newItems = [...cat.items];
        newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
        return { ...cat, items: newItems };
      }
      return cat;
    }));
  };

  const handleRemoveItem = (catId: string, itemIndex: number) => {
    if (!confirm('Are you sure you want to remove this service?')) return;
    setCatalog(prev => prev.map(cat => {
      if (cat.id === catId) {
        return { ...cat, items: cat.items.filter((_: any, i: number) => i !== itemIndex) };
      }
      return cat;
    }));
  };

  const handleAddItem = (catId: string) => {
    setCatalog(prev => prev.map(cat => {
      if (cat.id === catId) {
        return { 
          ...cat, 
          items: [
            ...cat.items, 
            { 
              title: 'New Service', 
              description: 'Service description', 
              price: 0, 
              requirements: [], 
              deliverables: [] 
            }
          ] 
        };
      }
      return cat;
    }));
  };

  const handleAddCategory = () => {
    const name = prompt('Enter Category Name:');
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '_');
    setCatalog(prev => [
      ...prev,
      {
        id,
        category: name,
        items: []
      }
    ]);
    setActiveCategory(id);
  };

  const handleRemoveCategory = (catId: string) => {
    if (!confirm('Are you sure you want to remove this entire category?')) return;
    setCatalog(prev => prev.filter(cat => cat.id !== catId));
    if (activeCategory === catId) {
      setActiveCategory(catalog[0]?.id || '');
    }
  };

  const calculateTotal = () => {
    if (!selectedService) return 0;
    if (!selectedService.isBundle) return selectedService.price;

    // Bundle logic: if all items selected, use bundle price.
    // If some deselected, use individual prices.
    const allSelected = selectedService.bundleItems.every((bi: any) => orderData.selectedItems.includes(bi.id));
    
    if (allSelected) return selectedService.price;

    return selectedService.bundleItems
      .filter((bi: any) => orderData.selectedItems.includes(bi.id))
      .reduce((acc: number, bi: any) => acc + bi.individualPrice, 0);
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    if (!currentUser && (!orderData.guestName || !orderData.guestEmail)) return;
    if (currentUser && currentUser.role !== 'Client' && !orderData.clientId) return;
    
    setIsOrdering(true);
    try {
      const totalAmount = calculateTotal();
      const client = currentUser?.role === 'Client' ? currentUser : clients.find(c => c.id === orderData.clientId);
      
      const orderPayload = {
        serviceTitle: selectedService.title,
        amount: totalAmount,
        status: 'pending',
        notes: orderData.notes,
        createdAt: serverTimestamp(),
        items: selectedService.isBundle 
          ? selectedService.bundleItems.filter((bi: any) => orderData.selectedItems.includes(bi.id)).map((bi: any) => ({ description: bi.title, amount: bi.individualPrice }))
          : [{ description: selectedService.title, amount: selectedService.price }]
      };

      if (currentUser) {
        // Authenticated order
        const invoiceRef = await addDoc(collection(db, 'invoices'), {
          ...orderPayload,
          clientId: client?.id,
          clientName: client?.name || 'Unknown',
          invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
          date: new Date().toISOString().split('T')[0],
        });

        await addDoc(collection(db, 'tasks'), {
          clientId: client?.id,
          clientName: client?.name || 'Unknown',
          title: `New Order: ${selectedService.title}`,
          description: `Order confirmed for ${selectedService.title}. Total: PKR ${totalAmount.toLocaleString()}. Notes: ${orderData.notes}`,
          serviceType: selectedService.title,
          status: 'pending',
          priority: 'high',
          createdAt: serverTimestamp(),
          isClientVisible: true,
          invoiceId: invoiceRef.id
        });
      } else {
        // Guest order
        await addDoc(collection(db, 'public_orders'), {
          ...orderPayload,
          guestName: orderData.guestName,
          guestEmail: orderData.guestEmail,
          guestPhone: orderData.guestPhone,
          type: 'public_inquiry'
        });
      }

      setIsOrderModalOpen(false);
      setSelectedService(null);
      alert(currentUser ? 'Order confirmed! Task and Invoice generated.' : 'Inquiry sent! Our team will contact you soon.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setIsOrdering(false);
    }
  };

  if (loadingCatalog) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
        <Loader2 className="animate-spin" size={48} />
        <p className="font-bold">Loading services catalog...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-100">
            <Package size={14} />
            Service Catalog
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Our Professional Services</h1>
          <p className="text-slate-500 max-w-xl font-medium">
            Comprehensive solutions for academic publishers, from ISSN registration to global indexing and growth strategies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button 
              onClick={() => isEditingCatalog ? handleSaveCatalog() : setIsEditingCatalog(true)}
              disabled={isSavingCatalog}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg",
                isEditingCatalog 
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200" 
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-slate-100"
              )}
            >
              {isSavingCatalog ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isEditingCatalog ? (
                <Save size={18} />
              ) : (
                <Edit3 size={18} />
              )}
              {isEditingCatalog ? 'Save Changes' : 'Manage Catalog'}
            </button>
          )}
          {isEditingCatalog && (
            <button 
              onClick={() => setIsEditingCatalog(false)}
              className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          )}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search services..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {processedCatalog.map(cat => (
          <div key={cat.id} className="relative group">
            <button
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border",
                activeCategory === cat.id 
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200" 
                  : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
              )}
            >
              <cat.icon size={18} />
              {cat.category}
            </button>
            {isEditingCatalog && (
              <button 
                onClick={() => handleRemoveCategory(cat.id)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        {isEditingCatalog && (
          <button 
            onClick={handleAddCategory}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 border border-dashed border-slate-300 hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Add Category
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Service List */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 gap-6"
            >
              {activeCategoryData?.items.map((service: any, i: number) => (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={service.title + i}
                  className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden group"
                >
                  <div className="p-8">
                    {isEditingCatalog ? (
                      <div className="space-y-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-4">
                            <input 
                              type="text"
                              value={service.title}
                              onChange={(e) => handleUpdateItem(activeCategory, i, 'title', e.target.value)}
                              className="w-full text-xl font-black text-slate-900 border-b border-slate-200 focus:border-indigo-500 outline-none pb-1"
                              placeholder="Service Title"
                            />
                            <textarea 
                              value={service.description}
                              onChange={(e) => handleUpdateItem(activeCategory, i, 'description', e.target.value)}
                              className="w-full text-slate-500 font-medium border-b border-slate-200 focus:border-indigo-500 outline-none resize-none"
                              placeholder="Service Description"
                              rows={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                              <span className="text-xs font-bold text-slate-400">PKR</span>
                              <input 
                                type="number"
                                value={service.price}
                                onChange={(e) => handleUpdateItem(activeCategory, i, 'price', Number(e.target.value))}
                                className="w-24 font-black text-slate-900 bg-transparent outline-none"
                              />
                            </div>
                            <button 
                              onClick={() => handleRemoveItem(activeCategory, i)}
                              className="w-full flex items-center justify-center gap-2 p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all text-xs font-bold"
                            >
                              <Trash2 size={14} />
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Info size={14} className="text-indigo-500" />
                              Requirements
                            </h4>
                            <textarea 
                              value={service.requirements.join('\n')}
                              onChange={(e) => handleUpdateItem(activeCategory, i, 'requirements', e.target.value.split('\n'))}
                              className="w-full text-sm text-slate-600 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="One requirement per line"
                              rows={4}
                            />
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Zap size={14} className="text-emerald-500" />
                              Deliverables
                            </h4>
                            <textarea 
                              value={service.deliverables.join('\n')}
                              onChange={(e) => handleUpdateItem(activeCategory, i, 'deliverables', e.target.value.split('\n'))}
                              className="w-full text-sm text-slate-600 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="One deliverable per line"
                              rows={4}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                          <div className="space-y-1">
                            <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{service.title}</h3>
                            <p className="text-slate-500 font-medium">{service.description}</p>
                          </div>
                          <div className="shrink-0">
                            <div className="px-4 py-2 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-lg shadow-slate-200">
                              {service.displayPrice}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Info size={14} className="text-indigo-500" />
                              Client Requirements
                            </h4>
                            <ul className="space-y-2">
                              {service.requirements.map((req: string) => (
                                <li key={req} className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                  {req}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Zap size={14} className="text-emerald-500" />
                              We Deliver
                            </h4>
                            <ul className="space-y-2">
                              {service.deliverables.map((del: string) => (
                                <li key={del} className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                  <CheckCircle2 size={14} className="text-emerald-500" />
                                  {del}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex -space-x-2">
                              {[1, 2, 3].map(i => (
                                <img 
                                  key={i}
                                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${service.title}${i}`}
                                  className="w-8 h-8 rounded-full border-2 border-white bg-slate-100"
                                  alt="User"
                                  referrerPolicy="no-referrer"
                                />
                              ))}
                            </div>
                            <p className="text-xs text-slate-400 font-medium">Trusted by 50+ publishers</p>
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedService(service);
                              setOrderData({
                                clientId: currentUser?.role === 'Client' ? currentUser.id : '',
                                guestName: '',
                                guestEmail: '',
                                guestPhone: '',
                                selectedItems: service.isBundle ? service.bundleItems.map((bi: any) => bi.id) : [],
                                notes: ''
                              });
                              setIsOrderModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-all group/btn"
                          >
                            Order Service
                            <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
              {isEditingCatalog && activeCategory && (
                <button 
                  onClick={() => handleAddItem(activeCategory)}
                  className="w-full py-8 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-all mb-2">
                    <Plus size={24} />
                  </div>
                  <span className="font-bold">Add New Service to {activeCategoryData?.category}</span>
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Column: Sidebar Info */}
        <div className="space-y-8">
          {/* Why Choose Us */}
          <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <h3 className="text-xl font-black mb-6 relative z-10">Why Choose Host A Journal?</h3>
            <div className="space-y-6 relative z-10">
              {[
                { title: 'Expert Guidance', desc: '10+ years of experience in academic publishing.', icon: Shield },
                { title: 'Fast Turnaround', desc: 'Quick processing for ISSN and indexing.', icon: Zap },
                { title: 'Global Standards', desc: 'Compliance with Scopus, WoS, and HEC.', icon: Globe },
                { title: 'Full Support', desc: 'Dedicated account manager for every project.', icon: MessageSquare }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="p-2 bg-white/10 rounded-xl shrink-0">
                    <item.icon size={20} className="text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{item.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Request */}
          <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200">
            <h3 className="text-xl font-black mb-2">Need a custom plan?</h3>
            <p className="text-indigo-100 text-sm mb-6">
              If you have specific requirements not listed here, we can create a tailored solution for your journal.
            </p>
            <button className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black hover:bg-indigo-50 transition-all shadow-lg">
              Contact Sales
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 text-center">
              <p className="text-2xl font-black text-slate-900">200+</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Journals</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 text-center">
              <p className="text-2xl font-black text-slate-900">15+</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Countries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Order Modal */}
      <Modal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        title={currentUser ? `Configure Order: ${selectedService?.title}` : `Inquire about: ${selectedService?.title}`}
        maxWidth="2xl"
      >
        <form onSubmit={handleConfirmOrder} className="space-y-6">
          {!currentUser ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Full Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="John Doe"
                  value={orderData.guestName}
                  onChange={(e) => setOrderData({ ...orderData, guestName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Email Address</label>
                <input 
                  required
                  type="email" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="john@example.com"
                  value={orderData.guestEmail}
                  onChange={(e) => setOrderData({ ...orderData, guestEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-slate-700">Phone Number</label>
                <input 
                  type="tel" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="+92 ..."
                  value={orderData.guestPhone}
                  onChange={(e) => setOrderData({ ...orderData, guestPhone: e.target.value })}
                />
              </div>
            </div>
          ) : currentUser.role !== 'Client' && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Select Client</label>
              <select 
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={orderData.clientId}
                onChange={(e) => setOrderData({ ...orderData, clientId: e.target.value })}
              >
                <option value="">Choose a client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedService?.isBundle && (
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700">Bundle Items (Deselect to use individual pricing)</label>
              <div className="grid grid-cols-1 gap-3">
                {selectedService.bundleItems.map((item: any) => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      const newItems = orderData.selectedItems.includes(item.id)
                        ? orderData.selectedItems.filter(id => id !== item.id)
                        : [...orderData.selectedItems, item.id];
                      setOrderData({ ...orderData, selectedItems: newItems });
                    }}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between",
                      orderData.selectedItems.includes(item.id)
                        ? "bg-indigo-50 border-indigo-600"
                        : "bg-white border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                        orderData.selectedItems.includes(item.id)
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-slate-300"
                      )}>
                        {orderData.selectedItems.includes(item.id) && <Check size={14} />}
                      </div>
                      <span className="font-bold text-slate-900">{item.title}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      PKR {item.individualPrice.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-xs font-medium">
                Note: If you deselect any item from the bundle, the total will be recalculated using individual item prices instead of the discounted bundle rate.
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Additional Notes</label>
            <textarea 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
              placeholder="Any specific instructions..."
              value={orderData.notes}
              onChange={(e) => setOrderData({ ...orderData, notes: e.target.value })}
            />
          </div>

          <div className="p-6 bg-slate-900 rounded-3xl text-white flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Amount</p>
              <h4 className="text-3xl font-black">PKR {calculateTotal().toLocaleString()}</h4>
            </div>
            <button 
              type="submit"
              disabled={isOrdering || (currentUser && currentUser.role !== 'Client' && !orderData.clientId) || (!currentUser && (!orderData.guestName || !orderData.guestEmail)) || (selectedService?.isBundle && orderData.selectedItems.length === 0)}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isOrdering ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Processing...
                </>
              ) : (
                <>
                  {currentUser ? <ShoppingCart size={20} /> : <Send size={20} />}
                  {currentUser ? 'Confirm Order' : 'Send Inquiry'}
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
