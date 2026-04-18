import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Activity, 
  ChevronRight, 
  ChevronLeft, 
  Clock, 
  Trash2, 
  Eye, 
  EyeOff,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where, limit } from 'firebase/firestore';
import { ActivityLog, User as CRMUser } from '../types';
import { cn } from '../lib/utils';
import { usePermissions } from '../hooks/usePermissions';

interface ActivityHistoryProps {
  currentUser: CRMUser;
}

export const ActivityHistory: React.FC<ActivityHistoryProps> = ({ currentUser }) => {
  const { isAdmin } = usePermissions(currentUser);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showHidden, setShowHidden] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    let q = query(
      collection(db, 'activity_logs'), 
      orderBy('timestamp', 'desc'),
      limit(500)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activityData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];
      setActivities(activityData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activity_logs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleToggleRead = async (id: string, currentRead: boolean) => {
    try {
      await updateDoc(doc(db, 'activity_logs', id), {
        isRead: !currentRead
      });
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  const handleToggleHidden = async (id: string, currentHidden: boolean) => {
    try {
      await updateDoc(doc(db, 'activity_logs', id), {
        isHidden: !currentHidden
      });
    } catch (error) {
      console.error('Error updating activity visibility:', error);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadActivities = filteredActivities.filter(a => !a.isRead);
    if (unreadActivities.length === 0) return;

    try {
      const promises = unreadActivities.map(a => 
        updateDoc(doc(db, 'activity_logs', a.id), { isRead: true })
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleClearHistory = async () => {
    if (!isAdmin) return;
    setIsClearing(true);
    try {
      const promises = filteredActivities.map(a => deleteDoc(doc(db, 'activity_logs', a.id)));
      await Promise.all(promises);
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Error clearing history:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'activity_logs', id));
    } catch (error) {
      console.error('Error deleting activity:', error);
    }
  };

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = 
      activity.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.details.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Hidden filter
    if (!showHidden && activity.isHidden) return false;

    // Type filter (custom logic depending on your action strings)
    if (filterType !== 'all') {
      if (filterType === 'security' && !activity.action.toLowerCase().includes('login') && !activity.action.toLowerCase().includes('permission')) return false;
      if (filterType === 'data' && !activity.action.toLowerCase().includes('created') && !activity.action.toLowerCase().includes('updated') && !activity.action.toLowerCase().includes('deleted')) return false;
    }

    return matchesSearch;
  });

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Details'];
    const rows = filteredActivities.map(a => [
      new Date(a.timestamp).toLocaleString(),
      a.userName,
      a.action,
      a.details
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `activity_log_${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <History className="text-indigo-600" size={32} />
            Activity History
          </h2>
          <p className="text-slate-500 mt-1">Audit log of all actions performed in the CRM system.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            <CheckCircle2 size={18} />
            Mark Read
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold text-sm hover:bg-rose-100 transition-all border border-rose-100"
            >
              <Trash2 size={18} />
              Clear Selection
            </button>
          )}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by user, action or details..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="all">All Actions</option>
            <option value="security">Security & Access</option>
            <option value="data">Data Modifications</option>
          </select>
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              showHidden 
                ? "bg-indigo-50 text-indigo-600 border border-indigo-200" 
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {showHidden ? <Eye size={18} /> : <EyeOff size={18} />}
            {showHidden ? "Showing Hidden" : "Show Hidden"}
          </button>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Time</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="animate-spin inline-block mr-2" size={20} />
                    Loading activities...
                  </td>
                </tr>
              ) : filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Activity className="mx-auto mb-2 opacity-20" size={48} />
                    No activities found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((activity) => (
                  <tr key={activity.id} className={cn(
                    "hover:bg-slate-50/50 transition-colors",
                    activity.isRead && "opacity-60"
                  )}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold overflow-hidden shadow-sm">
                          {activity.userPhotoURL ? (
                            <img src={activity.userPhotoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            activity.userName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{activity.userName}</p>
                          <p className="text-xs text-slate-500">ID: {activity.userId.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        activity.action.toLowerCase().includes('deleted') || activity.action.toLowerCase().includes('rejected')
                          ? "bg-rose-50 text-rose-600 border-rose-100"
                          : activity.action.toLowerCase().includes('created') || activity.action.toLowerCase().includes('approved')
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : activity.action.toLowerCase().includes('login')
                              ? "bg-blue-50 text-blue-600 border-blue-100"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {activity.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600 max-w-md truncate" title={activity.details}>
                        {activity.details}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <p className="text-sm font-medium text-slate-900">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={12} /> {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleRead(activity.id, !!activity.isRead)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            activity.isRead ? "text-slate-400 hover:text-indigo-600" : "text-indigo-600 hover:bg-indigo-50"
                          )}
                          title={activity.isRead ? "Mark as unread" : "Mark as read"}
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button
                          onClick={() => handleToggleHidden(activity.id, !!activity.isHidden)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            activity.isHidden ? "text-indigo-600 bg-indigo-50" : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          )}
                          title={activity.isHidden ? "Unhide activity" : "Hide from dash"}
                        >
                          {activity.isHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                        <button
                          onClick={() => setSelectedActivity(activity)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <AlertCircle size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Detail Modal */}
      <AnimatePresence>
        {selectedActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="text-indigo-600" size={24} />
                  Activity Detail
                </h3>
                <button 
                  onClick={() => setSelectedActivity(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <Search className="rotate-45" size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">User</p>
                    <p className="font-bold text-slate-900">{selectedActivity.userName}</p>
                    <p className="text-xs text-slate-500">{selectedActivity.userId}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Action</p>
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
                      {selectedActivity.action}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Timestamp</p>
                  <p className="text-slate-900">{new Date(selectedActivity.timestamp).toLocaleString()}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Details</p>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                    {selectedActivity.details}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setSelectedActivity(null)}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <Trash2 size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Clear Action History?</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    You are about to delete <span className="font-bold text-slate-900">{filteredActivities.length}</span> activities matching your current filters. This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearHistory}
                    disabled={isClearing}
                    className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isClearing ? <Loader2 className="animate-spin" size={20} /> : "Clear All"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
