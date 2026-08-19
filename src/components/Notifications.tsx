import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Globe, 
  FileCheck, 
  Briefcase, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  MoreHorizontal, 
  Trash2,
  Check,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, writeBatch, where } from 'firebase/firestore';

interface Notification {
  id: string;
  type: 'domain' | 'issn' | 'task' | 'subscription' | 'system';
  title: string;
  message: string;
  createdAt: any;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
}

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    let q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    
    // If user is a client, only fetch their own notifications
    // We check the role from the current user document if available, 
    // but for simplicity here we can just try to filter if we know the user is a client
    // In this app, we can pass the currentUser prop or check the role
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(notifData);
      setLoading(false);
    }, (error) => {
      // If permission denied, it might be because we're a client trying to read all
      if (error.code === 'permission-denied') {
        const clientQ = query(
          collection(db, 'notifications'), 
          where('userId', '==', auth.currentUser?.uid),
          orderBy('createdAt', 'desc')
        );
        onSnapshot(clientQ, (snapshot) => {
          const notifData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Notification[];
          setNotifications(notifData);
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, 'notifications');
        });
      } else {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    });

    return () => unsubscribe();
  }, []);

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        const ref = doc(db, 'notifications', n.id);
        batch.update(ref, { read: true });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'notifications');
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'domain': return <Globe size={18} />;
      case 'issn': return <FileCheck size={18} />;
      case 'task': return <Briefcase size={18} />;
      case 'subscription': return <CreditCard size={18} />;
      case 'system': return <Bell size={18} />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'high': return 'bg-rose-500';
      case 'medium': return 'bg-amber-500';
      case 'low': return 'bg-blue-500';
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Notifications</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Stay updated with domain expirations, ISSN requests, and tasks.</p>
        </div>
        <button 
          onClick={markAllAsRead}
          disabled={notifications.filter(n => !n.read).length === 0}
          className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check size={18} />
          Mark all as read
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
            <Loader2 className="animate-spin" size={32} />
            <p className="text-sm font-medium">Loading notifications...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((notif) => (
              <motion.div 
                layout
                key={notif.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={() => !notif.read && markAsRead(notif.id)}
                className={cn(
                  "p-5 rounded-2xl border transition-all group relative cursor-pointer",
                  notif.read ? "bg-white border-slate-100 shadow-sm" : "bg-indigo-50/30 border-indigo-100 shadow-md shadow-indigo-500/5"
                )}
              >
                {!notif.read && (
                  <div className="absolute top-5 left-2 w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-xl text-white shadow-lg",
                      getPriorityColor(notif.priority)
                    )}>
                      {getIcon(notif.type)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900">{notif.title}</h4>
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                          notif.priority === 'high' ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                        )}>
                          {notif.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{notif.message}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 pt-1">
                        <Clock size={12} /> {formatTime(notif.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <Bell size={32} />
            </div>
            <h3 className="font-bold text-slate-900">All caught up!</h3>
            <p className="text-sm text-slate-500">You have no new notifications.</p>
          </div>
        )}
      </div>
    </div>
  );
};
