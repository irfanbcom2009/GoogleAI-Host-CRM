import React, { useState } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Loader2,
  FileText,
  ArrowRight,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface ImporterProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'clients' | 'invoices' | 'tasks';
  onSuccess?: () => void;
}

export const Importer: React.FC<ImporterProps> = ({ isOpen, onClose, type, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file: File) => {
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        setPreviewData(json.slice(0, 5)); // Show first 5 rows
        setLoading(false);
      } catch (err) {
        setError('Failed to parse file. Please ensure it is a valid Excel or CSV file.');
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet) as any[];

        const batch = writeBatch(db);
        const collectionRef = collection(db, type === 'clients' ? 'users' : type);

        for (const item of json) {
          const docRef = doc(collectionRef);
          const dataToSave = {
            ...item,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          
          // Basic mapping logic based on type
          if (type === 'clients') {
            dataToSave.role = 'Client';
            dataToSave.status = dataToSave.status || 'active';
            dataToSave.points = dataToSave.points || 0;
          } else if (type === 'tasks') {
            dataToSave.status = dataToSave.status || 'pending';
            dataToSave.priority = dataToSave.priority || 'medium';
            dataToSave.isClientVisible = dataToSave.isClientVisible !== undefined ? dataToSave.isClientVisible : true;
          } else if (type === 'invoices') {
            dataToSave.status = dataToSave.status || 'unpaid';
          }

          batch.set(docRef, dataToSave);
        }

        await batch.commit();
        setSuccess(true);
        setImporting(false);
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setFile(null);
          setPreviewData([]);
        }, 2000);
      } catch (err) {
        setError('Import failed. Please check your data format.');
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Import {type.charAt(0).toUpperCase() + type.slice(1)}</h3>
                  <p className="text-xs text-slate-500">Import data from Google Sheets or Zoho Invoices</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {!file ? (
                <div 
                  className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden" 
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileChange}
                  />
                  <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:bg-white transition-all shadow-sm">
                    <Upload size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900">Upload your file</h4>
                  <p className="text-sm text-slate-500 mt-1">Support CSV, XLSX, or XLS files from Google Sheets or Zoho</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white text-emerald-600 rounded-lg flex items-center justify-center border border-slate-200">
                        <FileSpreadsheet size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{file.name}</p>
                        <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <button onClick={() => setFile(null)} className="text-slate-400 hover:text-rose-600">
                      <X size={18} />
                    </button>
                  </div>

                  {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="animate-spin" size={32} />
                      <p className="text-sm font-medium">Parsing data...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <ArrowRight size={16} className="text-indigo-600" />
                        Data Preview (First 5 rows)
                      </h4>
                      <div className="overflow-x-auto border border-slate-100 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50">
                            <tr>
                              {previewData.length > 0 && Object.keys(previewData[0]).map(key => (
                                <th key={key} className="px-4 py-2 font-bold text-slate-500 uppercase tracking-wider">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {previewData.map((row, i) => (
                              <tr key={i}>
                                {Object.values(row).map((val: any, j) => (
                                  <td key={j} className="px-4 py-2 text-slate-600 truncate max-w-[150px]">{String(val)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 flex items-center gap-3 text-sm font-medium">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 size={18} />
                  Import successful! Redirecting...
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button 
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  disabled={!file || importing || success}
                  onClick={handleImport}
                  className={cn(
                    "flex-1 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2",
                    (!file || importing || success) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {importing ? <Loader2 className="animate-spin" size={20} /> : <Database size={20} />}
                  {importing ? 'Importing...' : 'Start Import'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
