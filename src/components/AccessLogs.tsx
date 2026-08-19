import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Clock, 
  Mail, 
  Globe, 
  Monitor,
  Loader2,
  Calendar,
  Filter,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { AccessLog } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export const AccessLogs: React.FC = () => {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'access_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AccessLog[];
      setLogs(logData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'access_logs'));

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.userAgent?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 max-w-full mx-auto px-4 md:px-8 lg:px-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <ShieldAlert className="text-rose-500" size={32} />
            Access Logs
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Monitoring unauthorized login attempts and security events.</p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search logs by email or user agent..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm"
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <p className="text-sm font-medium">Loading access logs...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-450px)] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-8 py-4">Event Time</th>
                  <th className="px-8 py-4">Email Address</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">User Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                          <Clock size={14} className="text-slate-400" />
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Mail size={14} />
                          </div>
                          <span className="text-sm font-bold text-slate-900">{log.email}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          log.status === 'unauthorized' ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                        )}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 max-w-xs truncate" title={log.userAgent}>
                          <Monitor size={12} className="shrink-0" />
                          {log.userAgent || 'Unknown'}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-300">
                        <ShieldAlert size={48} />
                        <p className="text-sm font-medium">No access logs found matching your criteria.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
