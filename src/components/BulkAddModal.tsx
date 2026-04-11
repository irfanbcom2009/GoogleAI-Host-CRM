import React, { useState } from 'react';
import { Modal } from './Modal';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, AlertCircle } from 'lucide-react';
import { Client } from '../types';

interface BulkAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'clients' | 'journals' | 'issn' | 'domains';
  clients?: Client[];
}

export const BulkAddModal: React.FC<BulkAddModalProps> = ({ isOpen, onClose, type, clients = [] }) => {
  const [input, setInput] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = input.split('\n').map(l => l.trim()).filter(l => l !== '');

  const handleBulkAdd = async () => {
    if (!input.trim()) return;
    if (type !== 'clients' && !selectedClientId) {
      setError('Please select a client first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const promises = lines.map(line => {
        let data: any = {
          createdAt: serverTimestamp(),
          status: 'active'
        };

        if (type === 'clients') {
          data = {
            ...data,
            name: line,
            email: `${line.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            role: 'Client',
            points: 0,
            subscriptions: []
          };
        } else if (type === 'journals') {
          data = {
            ...data,
            clientId: selectedClientId,
            title: line,
            category: 'General',
            apcAmount: 0
          };
        } else if (type === 'domains') {
          data = {
            ...data,
            clientId: selectedClientId,
            domainName: line,
            registrar: 'Pending'
          };
        } else if (type === 'issn') {
          data = {
            ...data,
            clientId: selectedClientId,
            journalId: 'pending',
            type: 'Online',
            status: 'pending'
          };
        }

        const collectionName = type === 'issn' ? 'issn_requests' : (type === 'clients' ? 'users' : type);
        return addDoc(collection(db, collectionName), data);
      });

      await Promise.all(promises);
      setInput('');
      onClose();
    } catch (err) {
      console.error('Bulk add error:', err);
      setError('Failed to add some items. Please check your permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Bulk Add ${type.charAt(0).toUpperCase() + type.slice(1)}`}>
      <div className="space-y-4">
        {type !== 'clients' && (
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Select Client</label>
            <select
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">Select a client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">
            Enter {type} (one per line)
          </label>
          <textarea
            className="w-full h-48 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
            placeholder={type === 'clients' ? "John Doe\nJane Smith" : "Item 1\nItem 2"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="pt-4">
          <button
            onClick={handleBulkAdd}
            disabled={loading || !input.trim()}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : `Add ${lines.length || ''} Items`}
          </button>
        </div>
      </div>
    </Modal>
  );
};
