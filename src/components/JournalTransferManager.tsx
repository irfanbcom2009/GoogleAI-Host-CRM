import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Plus, 
  History, 
  User, 
  Calendar, 
  Loader2,
  Trash2,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Journal, JournalTransferRecord, Client } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { ConfirmModal } from './ConfirmModal';

interface JournalTransferManagerProps {
  journal: Journal;
  clients: Client[];
  onClose: () => void;
}

export const JournalTransferManager: React.FC<JournalTransferManagerProps> = ({ journal, clients, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<JournalTransferRecord | null>(null);
  const [newTransfer, setNewTransfer] = useState({
    newClientId: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleAddTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newClient = clients.find(c => c.id === newTransfer.newClientId);
      const oldClient = clients.find(c => c.id === journal.clientId);

      const record: JournalTransferRecord = {
        id: crypto.randomUUID(),
        oldClientId: journal.clientId,
        oldClientName: oldClient?.name || 'Unknown',
        newClientId: newTransfer.newClientId,
        newClientName: newClient?.name || 'Unknown',
        date: newTransfer.date,
        notes: newTransfer.notes
      };

      // Update journal with new owner and add to history
      await updateDoc(doc(db, 'journals', journal.id), {
        clientId: newTransfer.newClientId,
        transferHistory: arrayUnion(record)
      });

      setIsAdding(false);
      setNewTransfer({ newClientId: '', date: new Date().toISOString().split('T')[0], notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journals');
    } finally {
      setLoading(false);
    }
  };

  const removeTransferRecord = async (record: JournalTransferRecord) => {
    try {
      await updateDoc(doc(db, 'journals', journal.id), {
        transferHistory: arrayRemove(record)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journals');
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && removeTransferRecord(confirmDelete)}
        title="Remove Transfer Record"
        message="Are you sure you want to remove this transfer record? This action cannot be undone."
      />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Ownership Transfer History</h3>
          <p className="text-sm text-slate-500">Track journal transfers between clients.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-all text-sm"
        >
          {isAdding ? 'Cancel' : <><ArrowLeftRight size={18} /> Transfer Journal</>}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddTransfer} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">New Owner (Client)</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newTransfer.newClientId || ''}
                    onChange={e => setNewTransfer(prev => ({ ...prev, newClientId: e.target.value }))}
                  >
                    <option value="">Choose new owner...</option>
                    {clients
                      .filter(c => c.id !== journal.clientId)
                      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                      .map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Transfer Date</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newTransfer.date || ''}
                    onChange={e => setNewTransfer(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Transfer Notes</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. Journal sold to new publisher"
                  value={newTransfer.notes || ''}
                  onChange={e => setNewTransfer(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <button 
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Confirm Transfer
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {journal.transferHistory?.length ? (
          journal.transferHistory.map((record) => (
            <div key={record.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ArrowLeftRight size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">From:</span>
                    <span className="font-bold text-slate-900 text-sm">{record.oldClientName}</span>
                    <span className="text-slate-300 mx-1">→</span>
                    <span className="text-xs font-bold text-slate-400 uppercase">To:</span>
                    <span className="font-bold text-indigo-600 text-sm">{record.newClientName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {record.date}</span>
                    {record.notes && <span>• {record.notes}</span>}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setConfirmDelete(record)}
                className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-slate-400">
            <History size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No transfer history recorded</p>
          </div>
        )}
      </div>
    </div>
  );
};
