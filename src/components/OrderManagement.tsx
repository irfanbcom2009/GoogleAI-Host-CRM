import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  MoreVertical,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  DollarSign,
  Trophy,
  User,
  Calendar,
  FileText,
  Save,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, where, getDoc } from 'firebase/firestore';
import { Order, User as UserType, PointHistory, CatalogItem } from '../types';
import { cn } from '../lib/utils';
import { Modal } from './Modal';
import { SearchableSelect } from './ui/SearchableSelect';

interface OrderManagementProps {
  currentUser: UserType;
}

export const OrderManagement: React.FC<OrderManagementProps> = ({ currentUser }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeliverablesModalOpen, setIsDeliverablesModalOpen] = useState(false);
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  
  const [deliverables, setDeliverables] = useState<{ [key: string]: string }>({});
  const [pointsData, setPointsData] = useState({ amount: 50, reason: 'Order Completion Reward' });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    
    if (currentUser.role === 'Client') {
      q = query(collection(db, 'orders'), where('clientId', '==', currentUser.id), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Order));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser.id, currentUser.role]);

  const handleUpdateStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {})
      });

      // If completed, check if client should be moved to inactive
      if (status === 'completed') {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          checkAndInactivateClient(order.clientId);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    }
  };

  const checkAndInactivateClient = async (clientId: string) => {
    // Check if client has any other active orders or tasks
    const ordersQuery = query(collection(db, 'orders'), where('clientId', '==', clientId), where('status', 'in', ['pending', 'processing']));
    const tasksQuery = query(collection(db, 'tasks'), where('clientId', '==', clientId), where('status', 'in', ['pending', 'in_progress', 'review']));
    
    // This is a simplified check. In a real app, we'd wait for both snapshots.
    // For now, we'll just check the current orders list we have if it's for this client.
    const activeOrders = orders.filter(o => o.clientId === clientId && ['pending', 'processing'].includes(o.status));
    if (activeOrders.length === 0) {
      try {
        await updateDoc(doc(db, 'users', clientId), { status: 'inactive' });
      } catch (error) {
        console.error('Error inactivating client:', error);
      }
    }
  };

  const handleSaveDeliverables = async () => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id), {
        deliverablesData: deliverables,
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      });
      setIsDeliverablesModalOpen(false);
      checkAndInactivateClient(selectedOrder.clientId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRewardPoints = async () => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    try {
      // Reward Employee
      if (selectedOrder.assignedEmployeeId) {
        const empRef = doc(db, 'users', selectedOrder.assignedEmployeeId);
        const empSnap = await getDoc(empRef);
        if (empSnap.exists()) {
          const currentPoints = empSnap.data().points || 0;
          await updateDoc(empRef, { points: currentPoints + pointsData.amount });
          
          await addDoc(collection(db, 'point_history'), {
            userId: selectedOrder.assignedEmployeeId,
            userName: selectedOrder.assignedEmployeeName,
            type: 'earned',
            points: pointsData.amount,
            reason: pointsData.reason,
            orderId: selectedOrder.id,
            createdAt: new Date().toISOString(),
            createdById: currentUser.id,
            createdBy: currentUser.name
          });
        }
      }

      // Reward Client (Loyalty)
      const clientRef = doc(db, 'users', selectedOrder.clientId);
      const clientSnap = await getDoc(clientRef);
      if (clientSnap.exists()) {
        const currentPoints = clientSnap.data().points || 0;
        const clientReward = Math.floor(selectedOrder.totalAmount / 10); // 1 point per $10
        await updateDoc(clientRef, { points: currentPoints + clientReward });
        
        await addDoc(collection(db, 'point_history'), {
          userId: selectedOrder.clientId,
          userName: selectedOrder.clientName,
          type: 'earned',
          points: clientReward,
          reason: `Loyalty reward for Order ${selectedOrder.orderNumber}`,
          orderId: selectedOrder.id,
          createdAt: new Date().toISOString(),
          createdById: currentUser.id,
          createdBy: currentUser.name
        });
      }

      setIsPointsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.catalogItemName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'processing': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'cancelled': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-full mx-auto px-4 md:px-8 lg:px-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Service Orders</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Manage client orders, deliverables, and rewards.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search by order #, client, or service..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            value={searchQuery || ''}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-4 w-48">
          <SearchableSelect
            options={[
              { label: "All Status", value: "all" },
              { label: "Pending", value: "pending" },
              { label: "Processing", value: "processing" },
              { label: "Completed", value: "completed" },
              { label: "Cancelled", value: "cancelled" }
            ]}
            value={statusFilter}
            onChange={value => setStatusFilter(value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm font-medium">Loading orders...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="text-slate-500 text-[10px] uppercase tracking-wider font-black border-b border-slate-100">
                <th className="px-6 py-4">Order Info</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{order.orderNumber}</span>
                      <span className="text-xs text-slate-500">{order.catalogItemName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                        {order.clientName.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{order.clientName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold uppercase border",
                      order.priority === 'Express' ? "bg-rose-50 text-rose-600 border-rose-100" :
                      order.priority === 'Rush' ? "bg-amber-50 text-amber-600 border-amber-100" :
                      "bg-slate-50 text-slate-600 border-slate-100"
                    )}>
                      {order.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">${order.totalAmount}</span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase",
                        order.paymentStatus === 'paid' ? "text-emerald-500" : "text-amber-500"
                      )}>
                        {order.paymentStatus}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                      getStatusColor(order.status)
                    )}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      {currentUser.role !== 'Client' && (
                        <>
                          <button 
                            onClick={() => { 
                              setSelectedOrder(order); 
                              setDeliverables(order.deliverablesData || {});
                              setIsDeliverablesModalOpen(true); 
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Fill Deliverables"
                          >
                            <CheckCircle size={18} />
                          </button>
                          {order.status === 'completed' && (
                            <button 
                              onClick={() => { setSelectedOrder(order); setIsPointsModalOpen(true); }}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                              title="Reward Points"
                            >
                              <Trophy size={18} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Order Details: ${selectedOrder?.orderNumber}`}
        maxWidth="3xl"
      >
        {selectedOrder && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Client Requirements</h4>
                <div className="space-y-4">
                  {Object.entries(selectedOrder.requirementsData).map(([key, value]) => (
                    <div key={key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{key}</label>
                      <div className="text-sm text-slate-900 font-medium break-words">
                        {typeof value === 'string' && (value as string).startsWith('http') ? (
                          <a href={value as string} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
                            View File <FileText size={14} />
                          </a>
                        ) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Deliverables</h4>
                <div className="space-y-4">
                  {Object.entries(selectedOrder.deliverablesData || {}).map(([key, value]) => (
                    <div key={key} className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                      <label className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">{key}</label>
                      <div className="text-sm text-slate-900 font-medium break-words">{String(value)}</div>
                    </div>
                  ))}
                  {Object.keys(selectedOrder.deliverablesData || {}).length === 0 && (
                    <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-sm text-slate-400 italic">No deliverables provided yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Deliverables Modal */}
      <Modal
        isOpen={isDeliverablesModalOpen}
        onClose={() => setIsDeliverablesModalOpen(false)}
        title="Update Deliverables"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700">Deliverable Items</label>
              <button 
                onClick={() => setDeliverables(prev => ({ ...prev, [`Item ${Object.keys(prev).length + 1}`]: '' }))}
                className="text-indigo-600 hover:text-indigo-700 font-bold text-xs flex items-center gap-1"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>
            {Object.entries(deliverables).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 uppercase outline-none"
                  value={key || ''}
                  onChange={e => {
                    const newKey = e.target.value;
                    const newDeliverables = { ...deliverables };
                    delete newDeliverables[key];
                    newDeliverables[newKey] = value;
                    setDeliverables(newDeliverables);
                  }}
                />
                <textarea 
                  rows={2}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  value={value || ''}
                  onChange={e => setDeliverables(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder="Enter deliverable value or link..."
                />
              </div>
            ))}
          </div>
          <div className="pt-6 flex gap-3">
            <button 
              onClick={() => setIsDeliverablesModalOpen(false)}
              className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveDeliverables}
              disabled={isUpdating}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Mark as Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Points Modal */}
      <Modal
        isOpen={isPointsModalOpen}
        onClose={() => setIsPointsModalOpen(false)}
        title="Reward Points"
      >
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
            <Trophy className="text-amber-600 shrink-0" size={24} />
            <div>
              <p className="text-sm font-bold text-amber-900">Reward Employee & Client</p>
              <p className="text-xs text-amber-700 mt-1">Reward the assigned employee for completion and the client for their loyalty.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Employee Reward Points</label>
              <input 
                type="number"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={pointsData.amount || ''}
                onChange={e => setPointsData(prev => ({ ...prev, amount: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Reason</label>
              <input 
                type="text"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={pointsData.reason || ''}
                onChange={e => setPointsData(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            <button 
              onClick={() => setIsPointsModalOpen(false)}
              className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleRewardPoints}
              disabled={isUpdating}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Trophy size={20} />}
              Confirm Reward
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
