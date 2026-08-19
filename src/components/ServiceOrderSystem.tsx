import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Settings2, 
  Globe, 
  Hash, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight,
  TrendingUp,
  Users,
  DollarSign,
  ChevronRight,
  LayoutGrid,
  List,
  ExternalLink,
  ChevronDown,
  Activity,
  Zap,
  MoreVertical,
  X,
  FileText,
  Save,
  CheckCircle,
  Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Order, 
  Task, 
  User as UserType, 
  Journal, 
  Client, 
  ServiceType,
  UserRole
} from '../types';
import { db, handleFirestoreError, OperationType, sendNotification } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  addDoc, 
  doc, 
  updateDoc, 
  serverTimestamp,
  getDocs 
} from 'firebase/firestore';
import { cn, formatDateForInput } from '../lib/utils';
import { Modal } from './Modal';
import { usePermissions } from '../hooks/usePermissions';
import { toast } from 'react-hot-toast';
import { SelectDomainField } from './SelectDomainField';

interface ServiceOrderSystemProps {
  currentUser: UserType;
}

const SERVICES = [
  {
    id: 'doi',
    name: 'DOI Registration',
    type: 'DOI' as ServiceType,
    icon: <Package className="w-6 h-6" />,
    description: 'Digital Object Identifier registration and metadata management.',
    color: 'indigo',
    autoTasks: [
      { title: 'Crossref Account Setup', department: 'Technical', points: 50, days: 2 },
      { title: 'Metadata Configuration', department: 'Technical', points: 30, days: 1 },
      { title: 'DOI Prefix Assignment', department: 'Technical', points: 20, days: 1 },
      { title: 'DOI Testing & Activation', department: 'Technical', points: 40, days: 1 }
    ]
  },
  {
    id: 'ojs',
    name: 'OJS Setup & Config',
    type: 'OJS' as ServiceType,
    icon: <Settings2 className="w-6 h-6" />,
    description: 'Complete OJS installation, theme setup, and journal workflow config.',
    color: 'emerald',
    autoTasks: [
      { title: 'OJS Core Installation', department: 'Technical', points: 100, days: 3 },
      { title: 'Journal Configuration', department: 'Technical', points: 50, days: 1 },
      { title: 'Role & User Setup', department: 'Editorial', points: 30, days: 1 },
      { title: 'Plugin & Email Setup', department: 'Technical', points: 40, days: 1 },
      { title: 'Submission Workflow Setup', department: 'Editorial', points: 60, days: 2 }
    ]
  },
  {
    id: 'hosting',
    name: 'Web Hosting',
    type: 'Hosting' as ServiceType,
    icon: <Globe className="w-6 h-6" />,
    description: 'Secure and reliable hosting solutions for academic journals.',
    color: 'blue',
    autoTasks: [
      { title: 'Server Provisioning', department: 'Technical', points: 50, days: 1 },
      { title: 'Domain Pointing (DNS)', department: 'Technical', points: 20, days: 1 },
      { title: 'SSL Installation', department: 'Technical', points: 30, days: 1 },
      { title: 'Control Panel Setup', department: 'Technical', points: 40, days: 1 },
      { title: 'Email Hosting Configuration', department: 'Technical', points: 30, days: 1 }
    ]
  },
  {
    id: 'issn',
    name: 'ISSN Application',
    type: 'ISSN' as ServiceType,
    icon: <Hash className="w-6 h-6" />,
    description: 'Professional assistance for ISSN print and online applications.',
    color: 'amber',
    autoTasks: [
      { title: 'Application Preparation', department: 'Editorial', points: 40, days: 2 },
      { title: 'Metadata Formatting', department: 'Editorial', points: 30, days: 1 },
      { title: 'ISSN Submission', department: 'Editorial', points: 20, days: 1 },
      { title: 'Follow-up & Communication', department: 'Editorial', points: 30, days: 10 },
      { title: 'Status Monitoring & Completion', department: 'Editorial', points: 20, days: 2 }
    ]
  }
];

export const ServiceOrderSystem: React.FC<ServiceOrderSystemProps> = ({ currentUser }) => {
  const { isAdmin, check } = usePermissions(currentUser);
  const [orders, setOrders] = useState<Order[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'grid' | 'table'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<typeof SERVICES[0] | null>(null);
  const [orderType, setOrderType] = useState<'Already Have' | 'Subscribe New'>('Subscribe New');
  
  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderForm, setOrderForm] = useState({
    clientId: '',
    journalId: '',
    domainName: '',
    expectedVolume: '',
    hostingType: 'Shared',
    theme: 'Default',
    costPrice: 0,
    salePrice: 0,
    notes: '',
    assignedEmployeeId: ''
  });

  useEffect(() => {
    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      setLoading(false);
    });

    const unsubJournals = onSnapshot(collection(db, 'journals'), (snapshot) => {
      setJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal)));
    });

    const unsubClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'Client'), where('isActive', '!=', false)), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    const unsubEmployees = onSnapshot(query(collection(db, 'users'), where('role', 'in', ['Employee', 'Manager', 'Admin'])), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    return () => {
      unsubOrders();
      unsubJournals();
      unsubClients();
      unsubEmployees();
    };
  }, []);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const client = clients.find(c => c.id === orderForm.clientId);
      const journal = journals.find(j => j.id === orderForm.journalId);
      const assignedEmployee = employees.find(emp => emp.id === orderForm.assignedEmployeeId);

      let finalAssignedId = orderForm.assignedEmployeeId;
      let finalAssignedName = assignedEmployee?.name || '';

      // Auto-assignment fallback
      if (!finalAssignedId) {
        const firstDept = selectedService.autoTasks?.[0]?.department;
        const pool = employees.filter(e => e.isActive && (e.department === firstDept || !e.department));
        const chosenPool = pool.length > 0 ? pool : employees.filter(e => e.isActive);
        if (chosenPool.length > 0) {
          const chosen = chosenPool[Math.floor(Math.random() * chosenPool.length)];
          finalAssignedId = chosen.id;
          finalAssignedName = chosen.name;
        }
      }

      const orderData: Partial<Order> = {
        orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
        clientId: orderForm.clientId,
        clientName: client?.name || 'Unknown Client',
        catalogItemId: selectedService.id,
        catalogItemName: selectedService.name,
        status: 'pending',
        serviceStatus: 'Not Started',
        progressPercentage: 0,
        totalAmount: orderForm.salePrice,
        costPrice: orderForm.costPrice,
        profit: orderForm.salePrice - orderForm.costPrice,
        notes: orderForm.notes,
        assignedEmployeeId: finalAssignedId,
        assignedEmployeeName: finalAssignedName,
        createdAt: new Date().toISOString(),
        createdById: currentUser.id,
        createdBy: currentUser.name,
        updatedAt: new Date().toISOString(),
        currency: 'PKR',
        deliverablesData: {
          orderType,
          domainName: orderForm.domainName,
          expectedVolume: orderForm.expectedVolume,
          hostingType: orderForm.hostingType,
          theme: orderForm.theme,
          journalId: orderForm.journalId,
          journalTitle: journal?.title || ''
        }
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Auto-generate Tasks if "Subscribe New"
      if (orderType === 'Subscribe New') {
        for (const taskTemplate of selectedService.autoTasks) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + taskTemplate.days);
          
          const taskData: Partial<Task> = {
            clientId: orderForm.clientId,
            clientName: client?.name || '',
            journalId: orderForm.journalId,
            journalTitle: journal?.title || '',
            linkedOrderId: orderRef.id,
            serviceType: selectedService.type,
            title: `${selectedService.name}: ${taskTemplate.title}`,
            description: `Automated task for ${selectedService.name} order.`,
            assignedTo: finalAssignedId, 
            assignedToName: finalAssignedName,
            status: 'pending',
            priority: 'medium',
            basePoints: taskTemplate.points,
            complexityMultiplier: 1,
            urgencyBonus: 0,
            delayPenalty: 0,
            reworkPenalty: 0,
            points: taskTemplate.points,
            dueDate: dueDate.toISOString(),
            deadline: dueDate.toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            activityLogs: [{
              text: 'Task auto-generated from order placement.',
              userId: 'system',
              userName: 'System',
              timestamp: new Date().toISOString()
            }],
            isClientVisible: true
          };
          await addDoc(collection(db, 'tasks'), taskData);
        }

        // Send notification to assigned employee
        if (finalAssignedId) {
          await sendNotification(
            finalAssignedId,
            'New Project Assignment',
            `You have been assigned to ${selectedService.name} for ${client?.name || 'a client'}. ${selectedService.autoTasks.length} tasks generated.`,
            'info',
            'workflow'
          );
        }

        // Generate Invoice if needed
        const invoiceData = {
          clientId: orderForm.clientId,
          clientName: client?.name || '',
          invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
          date: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          items: [{
            description: `${selectedService.name} - ${orderType}`,
            quantity: 1,
            rate: orderForm.salePrice,
            amount: orderForm.salePrice
          }],
          subtotal: orderForm.salePrice,
          tax: 0,
          total: orderForm.salePrice,
          balance: orderForm.salePrice,
          status: 'unpaid',
          currency: 'PKR',
          createdAt: new Date().toISOString(),
          createdById: currentUser.id,
          createdBy: currentUser.name,
          journalId: orderForm.journalId
        };
        await addDoc(collection(db, 'invoices'), invoiceData);
      }

      toast.success('Service order placed successfully!');
      setIsOrderModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setOrderForm({
      clientId: '',
      journalId: '',
      domainName: '',
      expectedVolume: '',
      hostingType: 'Shared',
      theme: 'Default',
      costPrice: 0,
      salePrice: 0,
      notes: '',
      assignedEmployeeId: ''
    });
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    inProgress: orders.filter(o => o.status === 'processing').length,
    completed: orders.filter(o => o.status === 'completed').length,
    revenue: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
  };

  return (
    <div className="p-8 space-y-8 w-full max-w-full mx-auto px-4 md:px-8">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Activity size={18} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Service Control Center</span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Order Lifecycle Management</h2>
          <p className="text-slate-500 mt-1 font-medium italic">Automate service provisioning, task workflows, and financial settlements.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setActiveView('grid')}
              className={cn(
                "p-2 rounded-xl transition-all",
                activeView === 'grid' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setActiveView('table')}
              className={cn(
                "p-2 rounded-xl transition-all",
                activeView === 'table' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              <List size={20} />
            </button>
          </div>
          <button className="px-5 py-3 bg-slate-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl">
             <TrendingUp size={20} />
             Revenue Insights
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Live Orders', value: stats.total, icon: <Package />, color: 'indigo' },
          { label: 'Awaiting Action', value: stats.pending, icon: <Clock />, color: 'amber' },
          { label: 'Active Pipeline', value: stats.inProgress, icon: <Activity />, color: 'emerald' },
          { label: 'System Revenue', value: `PKR ${stats.revenue.toLocaleString()}`, icon: <DollarSign />, color: 'blue' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group"
          >
            <div className={cn(
              "absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 group-hover:scale-125 transition-transform",
              `bg-${stat.color}-500`
            )} />
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                {stat.icon}
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Global Metrics</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-tight">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Service Selection Board */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Zap size={18} className="text-indigo-600" />
            Provision New Service
          </h3>
          <span className="text-[10px] font-bold text-slate-400">SELECT A SERVICE TO START DEPLOYMENT</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES.map((service, idx) => (
            <motion.div 
              key={service.id}
              whileHover={{ y: -5 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group cursor-pointer hover:shadow-xl transition-all"
              onClick={() => {
                setSelectedService(service);
                setIsOrderModalOpen(true);
              }}
            >
              <div className={cn("p-8 h-full flex flex-col items-center text-center", `bg-${service.color}-50/30`)}>
                <div className={cn(
                  "w-16 h-16 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-all shadow-lg",
                  `bg-${service.color}-600 text-white shadow-${service.color}-100`
                )}>
                  {service.icon}
                </div>
                <h4 className="text-xl font-black text-slate-900 mb-2">{service.name}</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                  {service.description}
                </p>
                <div className="mt-auto pt-6 border-t border-slate-100 w-full flex items-center justify-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest">
                  Configure Order
                  <ArrowRight size={14} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by order ID, client name..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium shadow-sm"
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          {['all', 'pending', 'processing', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                statusFilter === status ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identify</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client & Target</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Entity</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Economics</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-black text-slate-900">{order.orderNumber}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{formatDateForInput(order.createdAt)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900 flex items-center gap-1">
                      <Users size={14} className="text-slate-400" />
                      {order.clientName}
                    </p>
                    {order.deliverablesData?.journalTitle && (
                      <p className="text-[10px] text-indigo-600 font-black uppercase flex items-center gap-1">
                        <Link2 size={12} />
                        {order.deliverablesData.journalTitle}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        {SERVICES.find(s => s.id === order.catalogItemId)?.icon || <Package size={14} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{order.catalogItemName}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          {order.deliverablesData?.orderType || 'Standard'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-black text-slate-900">{order.currency} {order.totalAmount.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-600 font-black uppercase">Profit: {order.currency} {(order.profit || 0).toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[8px] font-black uppercase text-slate-400">
                        <span>Progress</span>
                        <span>{order.progressPercentage}%</span>
                      </div>
                      <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600" style={{ width: `${order.progressPercentage}%` }} />
                      </div>
                      <span className={cn(
                        "w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                        order.status === 'completed' ? "bg-emerald-50 text-emerald-600" :
                        order.status === 'processing' ? "bg-indigo-50 text-indigo-600" :
                        "bg-amber-50 text-amber-600"
                      )}>
                        {order.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                      <ExternalLink size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrders.length === 0 && !loading && (
            <div className="p-12 text-center text-slate-400">
              No orders found matching your criteria.
            </div>
          )}
        </div>
      </div>

      {/* Order Modal */}
      <Modal 
        isOpen={isOrderModalOpen} 
        onClose={() => setIsOrderModalOpen(false)} 
        title={`New ${selectedService?.name} Order`}
        maxWidth="4xl"
      >
        {selectedService && (
          <form onSubmit={handleCreateOrder} className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex gap-2">
                {['Subscribe New', 'Already Have'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setOrderType(type as any)}
                    className={cn(
                      "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                      orderType === type ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="ml-auto text-[10px] font-medium text-slate-500 italic max-w-[200px]">
                {orderType === 'Subscribe New' 
                  ? 'Includes billing, auto-task generation, and full deployment workflow.' 
                  : 'Used for tracking existing client setup. No billing or auto-tasks.'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Client</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={orderForm.clientId || ''}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, clientId: e.target.value, journalId: '' }))}
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Journal (Optional)</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={orderForm.journalId || ''}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, journalId: e.target.value }))}
                    disabled={!orderForm.clientId}
                  >
                    <option value="">Select Journal</option>
                    {journals.filter(j => j.clientId === orderForm.clientId).map(j => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </select>
                </div>

                {selectedService.id === 'doi' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Expected DOI Volume</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 50-100 DOIs per year"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                      value={orderForm.expectedVolume || ''}
                      onChange={(e) => setOrderForm(prev => ({ ...prev, expectedVolume: e.target.value }))}
                    />
                  </div>
                )}

                {selectedService.id === 'hosting' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Hosting Type</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                      value={orderForm.hostingType || ''}
                      onChange={(e) => setOrderForm(prev => ({ ...prev, hostingType: e.target.value }))}
                    >
                      <option value="Shared">Shared Hosting</option>
                      <option value="VPS">VPS Hosting</option>
                      <option value="Dedicated">Dedicated Server</option>
                    </select>
                  </div>
                )}

                 {(selectedService.id === 'ojs' || selectedService.id === 'hosting') && (
                   <SelectDomainField
                     required
                     clientId={orderForm.clientId}
                     selectedDomainNameOrId={orderForm.domainName}
                     onChange={(val) => setOrderForm(prev => ({ ...prev, domainName: val }))}
                     label="Linked Domain"
                   />
                 )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Assign to Employee</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={orderForm.assignedEmployeeId || ''}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, assignedEmployeeId: e.target.value }))}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900 p-6 rounded-3xl text-white space-y-4 shadow-xl">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Financial Ledger</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Cost Price (PKR)</label>
                      <input 
                        type="number" 
                        disabled={orderType === 'Already Have'}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                        value={orderForm.costPrice || ''}
                        onChange={(e) => setOrderForm(prev => ({ ...prev, costPrice: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Sale Price (PKR)</label>
                      <input 
                        type="number" 
                        disabled={orderType === 'Already Have'}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                        value={orderForm.salePrice || ''}
                        onChange={(e) => setOrderForm(prev => ({ ...prev, salePrice: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">Projected Profit</span>
                    <span className="text-xl font-black text-emerald-400">PKR {(orderForm.salePrice - orderForm.costPrice).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Internal Remarks</label>
                  <textarea 
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium resize-none"
                    placeholder="Provide internal notes for this service provisioning..."
                    value={orderForm.notes || ''}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {orderType === 'Subscribe New' && (
              <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 space-y-4">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                  < Zap size={16} />
                  Auto-Workflow Automation
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedService.autoTasks.map((task, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-100">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-slate-900">{task.title}</p>
                        <div className="flex items-center gap-2 text-[8px] font-black uppercase text-slate-400">
                          <span>{task.department}</span>
                          <span>•</span>
                          <span>{task.points} Pts</span>
                          <span>•</span>
                          <span>{task.days}d</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-indigo-600 italic font-medium">Upon deployment, system will auto-generate {selectedService.autoTasks.length} tasks and an invoice.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button 
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? <Clock className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                Deploy Service Order
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
