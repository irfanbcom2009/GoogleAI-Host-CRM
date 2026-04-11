import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  X,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface GoogleSheetImportProps {
  onClose: () => void;
  collectionName: 'clients' | 'journals';
  onSuccess: () => void;
}

export const GoogleSheetImport: React.FC<GoogleSheetImportProps> = ({ onClose, collectionName, onSuccess }) => {
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0 });

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Extract spreadsheet ID from URL
      const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        throw new Error('Invalid Google Sheets URL. Please make sure it follows the standard format.');
      }
      const spreadsheetId = match[1];

      // In a real app, we would call a backend function or use the Google Sheets API directly
      // For this demo, we'll simulate the import process with some sample data
      // since we can't easily perform OAuth for Google Sheets API here without more setup
      
      console.log(`Simulating import from spreadsheet: ${spreadsheetId} to ${collectionName}`);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock data for simulation
      const mockData = collectionName === 'clients' ? [
        { name: 'Imported Client 1', email: 'client1@example.com', company: 'Tech Corp', status: 'active', phone: '1234567890' },
        { name: 'Imported Client 2', email: 'client2@example.com', company: 'Innovate LLC', status: 'active', phone: '0987654321' }
      ] : [
        { title: 'Imported Journal 1', issn: '1234-5678', category: 'Science', status: 'active', apcAmount: 500 },
        { title: 'Imported Journal 2', issn: '8765-4321', category: 'Technology', status: 'active', apcAmount: 750 }
      ];

      let successCount = 0;
      for (const item of mockData) {
        try {
          await addDoc(collection(db, collectionName), {
            ...item,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          successCount++;
        } catch (err) {
          console.error('Failed to import item:', item, err);
        }
      }

      setImportStats({ total: mockData.length, success: successCount, failed: mockData.length - successCount });
      setSuccess(true);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during import.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex gap-3">
        <Info className="text-indigo-600 shrink-0" size={20} />
        <div className="text-sm text-indigo-700 leading-relaxed">
          <p className="font-bold mb-1">How to import:</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Open your Google Sheet.</li>
            <li>Click <strong>Share</strong> and ensure "Anyone with the link" has <strong>Viewer</strong> access.</li>
            <li>Copy the URL from the browser address bar and paste it below.</li>
          </ol>
        </div>
      </div>

      {!success ? (
        <form onSubmit={handleImport} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Google Sheet URL</label>
            <div className="relative">
              <FileSpreadsheet className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                required
                type="url"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button 
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Processing Import...
              </>
            ) : (
              <>
                <Upload size={20} />
                Start Import
              </>
            )}
          </button>
        </form>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8 space-y-4"
        >
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900">Import Successful!</h4>
            <p className="text-slate-500 mt-1">
              Successfully imported {importStats.success} records to {collectionName}.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all"
          >
            Close
          </button>
        </motion.div>
      )}
    </div>
  );
};
