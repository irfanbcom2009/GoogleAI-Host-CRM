import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Medal, 
  Target, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  User as UserIcon,
  Star,
  Zap,
  Award
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { User, Task } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const PerformanceLeaderboard: React.FC = () => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'all'>('month');

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['Employee', 'Manager']),
      where('status', '==', 'active')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    });

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      setLoading(false);
    });

    return () => {
      unsub();
      unsubTasks();
    };
  }, []);

  const sortedEmployees = [...employees].sort((a, b) => (b.points || 0) - (a.points || 0));

  const getRankStats = (rank: number) => {
    switch(rank) {
      case 0: return { color: 'text-amber-500', bg: 'bg-amber-50 border-amber-100', icon: Trophy };
      case 1: return { color: 'text-slate-400', bg: 'bg-slate-50 border-slate-100', icon: Medal };
      case 2: return { color: 'text-orange-400', bg: 'bg-orange-50 border-orange-100', icon: Medal };
      default: return { color: 'text-slate-400', bg: 'bg-white border-slate-100', icon: Award };
    }
  };

  return (
    <div className="space-y-8 p-1">
      {/* Top 3 Podiums */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        {[1, 0, 2].map((idx) => {
          const emp = sortedEmployees[idx];
          if (!emp) return null;
          const stats = getRankStats(idx);
          const Icon = stats.icon;
          const isWinner = idx === 0;

          return (
            <motion.div 
              key={emp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                "relative flex flex-col items-center p-8 rounded-[2.5rem] border shadow-sm group hover:scale-[1.02] transition-all",
                stats.bg,
                isWinner ? "md:pb-16 bg-slate-900 border-slate-800" : ""
              )}
            >
              <div className={cn(
                "w-20 h-20 rounded-3xl border-4 border-white shadow-lg overflow-hidden mb-4",
                isWinner ? "w-24 h-24 -mt-12 bg-indigo-600" : "bg-white"
              )}>
                {emp.photoURL ? (
                  <img src={emp.photoURL} alt={emp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-black text-slate-300">
                    {emp.name.charAt(0)}
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <div className={cn("text-xs font-black uppercase tracking-widest mb-1", isWinner ? "text-indigo-400" : "text-slate-400")}>
                  {idx === 0 ? 'Monthly Champion' : `Rank #${idx + 1}`}
                </div>
                <h3 className={cn("text-xl font-black mb-2", isWinner ? "text-white" : "text-slate-900")}>
                  {emp.name}
                </h3>
                <div className={cn(
                  "px-6 py-2 rounded-2xl font-black text-xl flex items-center gap-2 justify-center",
                  isWinner ? "bg-indigo-600 text-white" : "bg-white border border-slate-100 text-slate-900"
                )}>
                  <Zap size={20} className={isWinner ? "text-amber-300" : "text-amber-500"} />
                  {emp.points || 0}
                </div>
              </div>

              {isWinner && (
                <div className="absolute -top-4 -right-4 bg-amber-400 p-3 rounded-2xl shadow-xl shadow-amber-200 rotate-12">
                  <Star className="text-white fill-current" size={24} />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Global Leaderboard</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Performance KPIs</p>
            </div>
          </div>
          <div className="flex bg-slate-50 p-1 rounded-xl">
             {['month', 'quarter', 'all'].map(t => (
               <button
                 key={t}
                 onClick={() => setTimeRange(t as any)}
                 className={cn(
                   "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                   timeRange === t ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                 )}
               >
                 {t}
               </button>
             ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Rank</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                <th className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Tasks Done</th>
                <th className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Completion Rate</th>
                <th className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg. Quality</th>
                <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedEmployees.map((emp, idx) => {
                const empTasks = tasks.filter(t => t.assignedTo === emp.id);
                const completed = empTasks.filter(t => t.status === 'completed').length;
                const rate = empTasks.length > 0 ? Math.round((completed / empTasks.length) * 100) : 0;
                
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black",
                        idx < 3 ? "bg-indigo-50 text-indigo-600" : "text-slate-400"
                      )}>
                        #{idx + 1}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                          {emp.photoURL ? (
                            <img src={emp.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <UserIcon size={20} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{emp.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{emp.department || 'Operations'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black">
                        <CheckCircle2 size={12} />
                        {completed}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{rate}%</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-1 text-xs font-black text-amber-500">
                        <Star size={12} className="fill-current" />
                        {(emp.performance?.qualityAverage || 4.5).toFixed(1)}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-lg font-black text-slate-900">{emp.points || 0}</span>
                        <div className="flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                          <TrendingUp size={10} />
                          +12% this week
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
