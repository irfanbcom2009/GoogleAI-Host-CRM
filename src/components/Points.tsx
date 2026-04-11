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
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Client, User as CRMUser } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';

export const Points: React.FC = () => {
  const [employees, setEmployees] = useState<CRMUser[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qEmployees = query(
      collection(db, 'users'), 
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
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
    });

    return () => {
      unsubscribeEmployees();
      unsubscribeClients();
    };
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Points & Rewards</h2>
          <p className="text-slate-500 mt-1">Track employee performance and client loyalty rewards.</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
          <Award size={20} />
          Redeem Points
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm font-medium">Loading leaderboards...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Employee Leaderboard */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Briefcase size={20} />
                </div>
                <h3 className="font-bold text-lg">Employee Leaderboard</h3>
              </div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Top Performers</span>
            </div>
            <div className="p-6 space-y-6">
              {employees.map((emp, index) => (
                <div key={emp.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-400 font-bold uppercase">
                        {emp.name.charAt(0)}
                      </div>
                      {index === 0 && (
                        <div className="absolute -top-1 -right-1 bg-amber-400 text-white p-1 rounded-full shadow-sm">
                          <Star size={10} fill="currentColor" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{emp.name}</p>
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{emp.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{emp.points.toLocaleString()} pts</p>
                    <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-emerald-600">
                      <ArrowUpRight size={10} />
                      ACTIVE
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-all">
                View Full Leaderboard
              </button>
            </div>
          </div>

          {/* Client Leaderboard */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Users size={20} />
                </div>
                <h3 className="font-bold text-lg">Client Loyalty Points</h3>
              </div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Lifetime</span>
            </div>
            <div className="p-6 space-y-6">
              {clients.map((client, index) => (
                <div key={client.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-400 font-bold uppercase">
                        {client.name.charAt(0)}
                      </div>
                      {index === 0 && (
                        <div className="absolute -top-1 -right-1 bg-amber-400 text-white p-1 rounded-full shadow-sm">
                          <Trophy size={10} fill="currentColor" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{client.name}</p>
                      <p className="text-xs text-slate-500">Partner Client</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{client.points.toLocaleString()} pts</p>
                    <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-emerald-600">
                      <ArrowUpRight size={10} />
                      LOYALTY
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <button className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-all">
                View All Partners
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Point Rules */}
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
          <Award className="text-indigo-500" />
          How Points are Calculated
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-900">Task Completion</h4>
            <p className="text-xs text-slate-500">Points awarded based on task complexity and service type (Hosting: 150, DOI: 100, ISSN: 200).</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-900">Client Loyalty</h4>
            <p className="text-xs text-slate-500">Clients earn 50 points for every month of active subscription and 100 points for renewals.</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-900">Employee Bonus</h4>
            <p className="text-xs text-slate-500">Extra 50 points for tasks completed before the due date and positive client feedback.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
