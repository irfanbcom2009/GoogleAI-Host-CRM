import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  Briefcase, 
  Award, 
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  History,
  Calendar,
  User as UserIcon,
  Plus,
  DollarSign,
  Wallet,
  Activity
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Client, User as CRMUser, PointHistory } from '../types';
import { DEFAULT_IMAGES } from '../constants/images';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { pointsService } from '../services/pointsService';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Modal } from './Modal';

export const Points: React.FC<{ currentUser: CRMUser }> = ({ currentUser }) => {
  const [employees, setEmployees] = useState<CRMUser[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CRMUser | Client | null>(null);
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const qEmployees = query(
      collection(db, 'users'), 
      where('role', 'in', ['Employee', 'Admin', 'Manager']),
      orderBy('points', 'desc'),
      limit(10)
    );
    const unsubscribeEmployees = onSnapshot(qEmployees, (snapshot) => {
      const empData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CRMUser[];
      setEmployees(empData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const qClients = query(
      collection(db, 'users'), 
      where('role', '==', 'Client'),
      orderBy('points', 'desc'),
      limit(10)
    );
    const unsubscribeClients = onSnapshot(qClients, (snapshot) => {
      const clientData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
    });

    const qHistory = query(
      collection(db, 'point_history'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PointHistory));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'point_history');
    });

    return () => {
      unsubscribeEmployees();
      unsubscribeClients();
      unsubscribeHistory();
    };
  }, []);

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || amount <= 0) return;
    try {
      await pointsService.rechargeClientPoints(
        selectedUser.id,
        selectedUser.name,
        amount,
        reason || 'Manual Admin Recharge',
        { id: currentUser.id, name: currentUser.name }
      );
      toast.success('Points recharged successfully');
      setIsRechargeModalOpen(false);
      setAmount(0);
      setReason('');
    } catch (error) {
      toast.error('Failed to recharge points');
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || amount <= 0) return;
    try {
      await pointsService.withdrawEmployeePoints(
        selectedUser.id,
        selectedUser.name,
        amount,
        reason || 'Standard Withdrawal Request',
        { id: currentUser.id, name: currentUser.name }
      );
      toast.success('Withdrawal processed successfully');
      setIsWithdrawModalOpen(false);
      setAmount(0);
      setReason('');
    } catch (error) {
      toast.error('Withdrawal failed: Insufficient balance');
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-full mx-auto px-4 md:px-8 lg:px-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Points Ledger & Economy</h2>
          <p className="text-slate-500 mt-1 font-medium">Automated system for employee earnings and client task management.</p>
        </div>
        {currentUser.role === 'Admin' && (
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setSelectedUser(null);
                setIsRechargeModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Plus size={18} /> Recharge Client
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm font-medium">Synchronizing point historical data...</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Employee Performance Wall */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                    <Trophy size={20} />
                  </div>
                  <h3 className="font-black text-lg text-slate-900 uppercase">Employee Production</h3>
                </div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-indigo-100 shadow-sm">Verified Earnings</span>
              </div>
              <div className="p-6 space-y-4 flex-1">
                {employees.map((emp, index) => (
                  <div key={emp.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 font-bold uppercase overflow-hidden">
                            {(emp.photoURL || (emp.gender === 'Female' && DEFAULT_IMAGES.FEMALE_STAFF)) ? (
                              <img src={emp.photoURL || DEFAULT_IMAGES.FEMALE_STAFF} alt={emp.name} className="w-full h-full object-cover" referrerPolicy='no-referrer' />
                            ) : (
                              emp.name.charAt(0)
                            )}
                          </div>
                          <div className={cn(
                            "absolute -top-2 -left-2 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm",
                            index === 0 ? "bg-amber-400 text-white" : 
                            index === 1 ? "bg-slate-300 text-white" :
                            index === 2 ? "bg-amber-600 text-white" : "bg-white text-slate-400"
                          )}>
                            {index + 1}
                          </div>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase">{emp.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{emp.department || 'General Operations'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs text-slate-400 font-bold uppercase">Earned</p>
                          <p className="text-lg font-black text-emerald-600 leading-none">+{emp.totalEarnedPoints || 0}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 font-bold uppercase">Balance</p>
                          <p className="text-lg font-black text-slate-900 leading-none">{emp.points || 0}</p>
                        </div>
                        {currentUser.role === 'Admin' && (
                          <button 
                            onClick={() => {
                              setSelectedUser(emp);
                              setIsWithdrawModalOpen(true);
                            }}
                            className="p-2 bg-white text-slate-400 hover:text-rose-600 border border-slate-100 rounded-xl hover:bg-rose-50 transition-all shadow-sm"
                            title="Process Withdrawal"
                          >
                            <DollarSign size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Client Ledger Hub */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                    <Wallet size={20} />
                  </div>
                  <h3 className="font-black text-lg text-slate-900 uppercase">Client Credit Lines</h3>
                </div>
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-amber-100 shadow-sm">Support Credits</span>
              </div>
              <div className="p-6 space-y-4 flex-1">
                {clients.map((client, index) => (
                  <div key={client.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-amber-200 transition-all group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 font-bold uppercase overflow-hidden">
                          {client.photoURL ? <img src={client.photoURL} alt={client.name} className="w-full h-full object-cover" referrerPolicy='no-referrer' /> : client.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors uppercase">{client.salutation} {client.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{client.country || 'Global Account'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs text-slate-400 font-bold uppercase">Balance</p>
                          <p className={cn(
                            "text-xl font-black leading-none",
                            client.points < 0 ? "text-rose-600" : "text-emerald-600"
                          )}>
                            {client.points || 0}
                          </p>
                        </div>
                        {currentUser.role === 'Admin' && (
                          <button 
                            onClick={() => {
                              setSelectedUser(client);
                              setIsRechargeModalOpen(true);
                            }}
                            className="p-2 bg-white text-slate-400 hover:text-indigo-600 border border-slate-100 rounded-xl hover:bg-indigo-50 transition-all shadow-sm"
                            title="Quick Recharge"
                          >
                            <Plus size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit History Ledger */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200 text-slate-600 rounded-xl shadow-inner">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 uppercase leading-none">Transaction Audit History</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Real-time ledger of all point movements</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 text-[10px] uppercase tracking-widest font-black border-b border-slate-100">
                    <th className="px-8 py-5">Party</th>
                    <th className="px-8 py-5">Transaction Type</th>
                    <th className="px-8 py-5">Movement</th>
                    <th className="px-8 py-5">Description / Audit Root</th>
                    <th className="px-8 py-5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                            {log.userName?.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-slate-700">{log.userName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase border tracking-widest",
                          log.type === 'earned' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          log.type === 'withdrawn' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                          log.type === 'recharged' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          "bg-rose-50 text-rose-600 border-rose-100"
                        )}>
                          {log.type}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <span className={cn(
                          "font-black text-lg",
                          (log.type === 'earned' || log.type === 'recharged') ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {(log.type === 'earned' || log.type === 'recharged') ? '+' : '-'}{log.points}
                        </span>
                      </td>
                      <td className="px-8 py-4 max-w-xs">
                        <span className="text-xs text-slate-600 font-medium line-clamp-1">{log.reason}</span>
                        {log.metadata?.taskId && <p className="text-[10px] text-indigo-400 font-bold uppercase mt-0.5">Ref Task: {log.metadata.taskId}</p>}
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">{new Date(log.createdAt).toLocaleDateString()}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic">
                        <div className="flex flex-col items-center gap-3">
                          <Activity className="text-slate-200" size={48} />
                          <p className="text-sm font-black text-slate-300 uppercase tracking-widest">No Economic Activity Detected</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Recharge Modal */}
      <Modal
        isOpen={isRechargeModalOpen}
        onClose={() => setIsRechargeModalOpen(false)}
        title="Point Credit Injection"
      >
        <form onSubmit={handleRecharge} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">Select Client</label>
            <select 
              required
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              value={selectedUser?.id || ''}
              onChange={(e) => {
                const user = clients.find(u => u.id === e.target.value);
                setSelectedUser(user || null);
              }}
            >
              <option value="">Select User Account...</option>
              {clients.map(u => (
                <option key={u.id} value={u.id}>{u.name} (Current: {u.points})</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">Amount (Credits)</label>
            <input 
              type="number"
              required
              min="1"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-black text-2xl text-center"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">Reason / Transaction Notes</label>
            <textarea 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-none"
              placeholder="Enter audit comment for this recharge..."
              value={reason || ''}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <button 
            type="submit"
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
          >
            <Plus size={24} /> Confirm Credit Injection
          </button>
        </form>
      </Modal>

      {/* Withdrawal Modal */}
      <Modal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        title="Process Financial Withdrawal"
      >
        <form onSubmit={handleWithdraw} className="space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 space-y-1">
            <p className="text-sm font-black">Authorized Payment Processor</p>
            <p className="text-xs font-medium italic">Verify bank details or payment channel before confirmation.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">Select Employee</label>
            <select 
              required
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              value={selectedUser?.id || ''}
              onChange={(e) => {
                const user = employees.find(u => u.id === e.target.value);
                setSelectedUser(user || null);
              }}
            >
              <option value="">Select Account...</option>
              {employees.map(u => (
                <option key={u.id} value={u.id}>{u.name} (Available: {u.points})</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">Withdrawal Amount</label>
            <input 
              type="number"
              required
              min="1"
              max={selectedUser?.points || 1000000}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-black text-2xl text-center"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            {selectedUser && <p className="text-right text-[10px] font-black text-slate-400 mt-1 uppercase">Max Available: {selectedUser.points}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-widest">Transaction Memo</label>
            <textarea 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-none"
              placeholder="Reference number or payment ID..."
              value={reason || ''}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <button 
            type="submit"
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
          >
            <DollarSign size={24} /> Finalize Payout
          </button>
        </form>
      </Modal>
    </div>
  );
};
