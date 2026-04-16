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
  User as UserIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Client, User as CRMUser, PointHistory } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';

export const Points: React.FC = () => {
  const [employees, setEmployees] = useState<CRMUser[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qEmployees = query(
      collection(db, 'users'), 
      where('role', 'in', ['Employee', 'Admin', 'Manager']),
      orderBy('points', 'desc'),
      limit(5)
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
      limit(5)
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
      limit(20)
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

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Points & Rewards</h2>
          <p className="text-slate-500 mt-1 font-medium">Track employee performance and client loyalty rewards.</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm font-medium">Loading points data...</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Employee Leaderboard */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                    <Briefcase size={20} />
                  </div>
                  <h3 className="font-black text-lg text-slate-900">Employee Leaderboard</h3>
                </div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Top Performers</span>
              </div>
              <div className="p-6 space-y-6">
                {employees.map((emp, index) => (
                  <div key={emp.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-400 font-bold uppercase">
                          {emp.name.charAt(0)}
                        </div>
                        <div className={cn(
                          "absolute -top-2 -left-2 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm",
                          index === 0 ? "bg-amber-400 text-white" : 
                          index === 1 ? "bg-slate-300 text-white" :
                          index === 2 ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {index + 1}
                        </div>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{emp.name}</p>
                        <p className="text-xs text-slate-400 font-medium">{emp.department || 'General'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900">{emp.points || 0}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Points</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Client Leaderboard */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <Users size={20} />
                  </div>
                  <h3 className="font-black text-lg text-slate-900">Client Loyalty</h3>
                </div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Top Clients</span>
              </div>
              <div className="p-6 space-y-6">
                {clients.map((client, index) => (
                  <div key={client.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-400 font-bold uppercase">
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{client.salutation} {client.name}</p>
                        <p className="text-xs text-slate-400 font-medium">{client.country || 'Global'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900">{client.points || 0}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Points</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Point History */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200 text-slate-600 rounded-xl">
                  <History size={20} />
                </div>
                <h3 className="font-black text-lg text-slate-900">Point History</h3>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                  <tr className="text-slate-500 text-[10px] uppercase tracking-wider font-black border-b border-slate-100">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Points</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <UserIcon size={14} className="text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">{log.userName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-bold uppercase border",
                          log.type === 'earned' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                        )}>
                          {log.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "font-black",
                          log.type === 'earned' ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {log.type === 'earned' ? '+' : '-'}{log.points}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{log.reason}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Calendar size={12} />
                          {new Date(log.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                        No point history records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
