import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  Loader2, 
  CheckCircle2, 
  DollarSign, 
  Clock, 
  Info,
  Layout,
  ArrowRight,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { CatalogItem, User as UserType } from '../types';
import { cn } from '../lib/utils';
import { Modal } from './Modal';
import { OrderForm } from './OrderForm';

interface ServicesProps {
  currentUser: UserType;
}

export const Services: React.FC<ServicesProps> = ({ currentUser }) => {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedService, setSelectedService] = useState<CatalogItem | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'catalog'), where('isActive', '==', true), orderBy('category', 'asc'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as CatalogItem));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'catalog');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const categories = ['All', ...Array.from(new Set(items.map(item => item.category)))];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-8 space-y-8 max-w-full mx-auto px-4 md:px-8 lg:px-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Service Catalog</h2>
          <p className="text-slate-500 mt-1 font-medium">Browse and order professional publishing services.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search for services..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            value={searchQuery || ''}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap",
                activeCategory === cat 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                  : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm font-medium">Loading catalog...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map(item => (
            <motion.div 
              layout
              key={item.id} 
              className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col"
            >
              <div className="p-8 space-y-6 flex-1">
                <div className="flex items-start justify-between">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl">
                    <Layout size={32} />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Starting from</span>
                    <span className="text-2xl font-black text-slate-900">${item.basePrice}</span>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-2xl font-black text-slate-900 leading-tight">{item.name}</h3>
                  <p className="text-slate-500 mt-2 text-sm leading-relaxed line-clamp-3">{item.description}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    Includes {item.requirements?.length || 0} Custom Fields
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <Clock size={14} className="text-indigo-500" />
                    {item.pricingTiers[0].estimatedDays} Days Delivery
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => { setSelectedService(item); setIsOrderModalOpen(true); }}
                  className="w-full flex items-center justify-center gap-2 bg-white text-indigo-600 border-2 border-indigo-100 py-4 rounded-[1.5rem] font-black hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all group/btn shadow-sm"
                >
                  Order This Service
                  <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        title="Place Service Order"
        maxWidth="3xl"
      >
        {selectedService && (
          <OrderForm 
            service={selectedService} 
            currentUser={currentUser} 
            onClose={() => setIsOrderModalOpen(false)}
            onSuccess={() => {
              setIsOrderModalOpen(false);
              alert('Order placed successfully! You can track it in the Service Orders tab.');
            }}
          />
        )}
      </Modal>
    </div>
  );
};
