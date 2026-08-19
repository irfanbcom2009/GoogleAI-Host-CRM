import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Plus, 
  Package, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  MessageSquare,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { ClientService, Invoice, User as CRMUser, ActivityLog } from '../../types';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import { ServiceWorkflow } from '../ServiceWorkflow';
import { Modal } from '../Modal';

interface ClientDashboardProps {
  currentUser: CRMUser;
  setActiveTab: (tab: string) => void;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ currentUser, setActiveTab }) => {
  const [activeServices, setActiveServices] = useState<ClientService[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);
  const [viewingService, setViewingService] = useState<ClientService | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const servicesQuery = query(
      collection(db, 'client_services'), 
      where('clientId', '==', currentUser.id),
      orderBy('updatedAt', 'desc')
    );
    
    const invoicesQuery = query(
      collection(db, 'invoices'),
      where('clientId', '==', currentUser.id),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubServices = onSnapshot(servicesQuery, (snapshot) => {
      setActiveServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ClientService));
    });

    const unsubInvoices = onSnapshot(invoicesQuery, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Invoice));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching client invoices:", error);
      setLoading(false);
    });

    return () => {
      unsubServices();
      unsubInvoices();
    };
  }, [currentUser]);

  const stats = [
    { label: 'Active Services', value: activeServices.filter(s => s.status === 'In Progress' || s.status === 'Ordered').length, icon: Package, color: 'bg-indigo-500' },
    { label: 'Pending Payments', value: invoices.filter(i => i.status === 'unpaid').length, icon: CreditCard, color: 'bg-rose-500' },
    { label: 'Completed', value: activeServices.filter(s => s.status === 'Completed').length, icon: CheckCircle2, color: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-8 p-4">
      {/* Welcome & AI Recommendations */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-2">
          <h2 className="text-3xl font-black text-slate-900">Welcome to your Portal, {currentUser.name.split(' ')[0]}!</h2>
          <p className="text-slate-500 font-medium">Track your publishing projects and manage active services in real-time.</p>
        </div>
        <button 
          onClick={() => setActiveTab('catalog')}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100"
        >
          <Plus size={20} /> Order New Service
        </button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4"
          >
            <div className={cn("w-12 h-12 flex items-center justify-center rounded-2xl text-white shadow-lg", stat.color)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Services List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Sparkles size={20} className="text-amber-400" />
              Active Projects
            </h3>
            <button 
              onClick={() => setActiveTab('catalog')}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              View History
            </button>
          </div>

          <div className="space-y-4">
            {activeServices.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                <p className="text-slate-500 font-medium italic">No active services. Start by ordering a service from the catalog.</p>
              </div>
            ) : (
              activeServices.map((service, idx) => (
                <motion.div 
                   key={service.id}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: idx * 0.05 }}
                   className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 font-black">
                      {service.progress}%
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{service.serviceName}</h4>
                      <p className="text-xs text-slate-500">{service.tierName} Tier • {service.status}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden md:block w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 transition-all" style={{ width: `${service.progress}%` }} />
                    </div>
                    <button 
                      onClick={() => setViewingService(service)}
                      className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                    >
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Financial Sidebar */}
        <div className="space-y-6">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <CreditCard size={20} className="text-indigo-600" />
            Recent Billing
          </h3>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm font-medium italic">No recent invoices</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {invoices.map((inv) => (
                  <div key={inv.id} className="p-4 hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => setActiveTab('invoices')}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900">{inv.invoiceNumber}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                        inv.status === 'paid' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                      )}>
                        {inv.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-medium">{format(new Date(inv.date), 'MMM dd, yyyy')}</span>
                      <span className="text-xs font-black text-slate-900">{inv.currency} {inv.total.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="relative z-10 flex flex-col gap-4">
               <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Outstanding</p>
                 <p className="text-3xl font-black">
                   PKR {invoices.filter(i => i.status === 'unpaid').reduce((sum, i) => sum + i.balance, 0).toLocaleString()}
                 </p>
               </div>
               <button 
                 onClick={() => setActiveTab('invoices')}
                 className="flex items-center justify-center gap-2 py-3 bg-white text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all"
               >
                 View All Invoices
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Service Detail Modal (Workflow) */}
      <Modal 
        isOpen={!!viewingService} 
        onClose={() => setViewingService(null)} 
        title={viewingService?.serviceName || 'Project Workflow'}
        maxWidth="5xl"
      >
        {viewingService && (
           <ServiceWorkflow 
             clientService={viewingService}
             steps={[]} // I need to fetch steps here or pass them
             userRole="Client"
             currentUserId={currentUser.id}
           />
        )}
      </Modal>
    </div>
  );
};
