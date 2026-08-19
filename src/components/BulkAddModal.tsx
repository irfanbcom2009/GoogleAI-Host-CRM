import React, { useState } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface BulkAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'clients' | 'domains' | 'issn' | 'journals' | 'employees';
  clients?: any[];
}

export const BulkAddModal: React.FC<BulkAddModalProps> = ({ isOpen, onClose, type, clients }) => {
  const [rawData, setRawData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!rawData.trim()) return;
    setIsImporting(true);
    setError(null);

    try {
      const lines = rawData.trim().split('\n');
      const data = lines.map(line => line.split('\t'));
      setProgress({ current: 0, total: data.length });

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        let docData: any = { createdAt: serverTimestamp() };

        if (type === 'clients') {
          docData = {
            ...docData,
            name: row[0] || '',
            email: row[1] || '',
            phone: row[2] || '',
            address: row[3] || '',
            role: 'Client'
          };
        } else if (type === 'domains') {
          docData = {
            ...docData,
            domainName: row[0] || '',
            registrar: row[1] || '',
            expiryDate: row[2] || '',
            clientId: row[3] || ''
          };
        } else if (type === 'journals') {
          docData = {
            ...docData,
            title: row[0] || '',
            issn: row[1] || '',
            publisher: row[2] || ''
          };
        }

        await addDoc(collection(db, type === 'employees' ? 'users' : type), docData);
        setProgress(prev => ({ ...prev, current: i + 1 }));
      }

      onClose();
    } catch (err) {
      console.error('Bulk import error:', err);
      setError('Import failed. Please check your data format.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Upload className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-slate-900">Bulk Add {type.charAt(0).toUpperCase() + type.slice(1)}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <textarea
            value={rawData || ''}
            onChange={(e) => setRawData(e.target.value)}
            placeholder="Paste tab-separated data here..."
            className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
            disabled={isImporting}
          />
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          {isImporting ? (
            <div className="flex items-center gap-4 flex-1">
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-slate-600">{progress.current} / {progress.total}</span>
            </div>
          ) : (
            <>
              <button onClick={onClose} className="px-6 py-2 rounded-xl font-bold text-slate-600 hover:bg-white transition-all">Cancel</button>
              <button onClick={handleImport} className="bg-indigo-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg">Import</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
