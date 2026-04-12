import React, { useState } from 'react';
import { X, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserPermissions } from '../types';
import { seedEmployees } from '../lib/seedData';

interface BulkEmployeeAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkEmployeeAddModal: React.FC<BulkEmployeeAddModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [rawData, setRawData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const parseData = (text: string) => {
    const lines = text.trim().split('\n');
    // Skip header if present
    const startIdx = lines[0].toLowerCase().includes('employee id') ? 1 : 0;
    
    return lines.slice(startIdx).map(line => {
      const parts = line.split('\t');
      if (parts.length < 3) return null;

      const employee = {
        employeeId: parts[0]?.trim() || '',
        joiningDate: parts[1]?.trim() || '',
        name: parts[2]?.trim() || '',
        modeOfWorking: parts[3]?.trim() || '',
        department: parts[4]?.trim() || '',
        assignments: parts[5]?.trim() || '',
        officialMail: (parts[6]?.trim() || '').replace(/"/g, ''),
        personalEmail: parts[7]?.trim() || '',
        cnic: parts[8]?.trim() || '',
        whatsappPersonal: parts[9]?.trim() || '',
        homePhone: parts[10]?.trim() || '',
        address: parts[11]?.trim() || '',
        qualification: parts[12]?.trim() || '',
        gender: (parts[13]?.trim() || 'Male') as 'Male' | 'Female' | 'Other',
        remarks: parts[14]?.trim() || '',
        endingDate: parts[15]?.trim() || '',
        experience: parts[16]?.trim() || '',
        role: 'Employee',
        points: 0,
        email: parts[7]?.trim() || parts[6]?.trim()?.replace(/"/g, '') || `emp${parts[0]?.trim()}@hostajournal.biz`,
        permissions: {
          approvalRequests: true,
          journals: true,
          indexingAgencies: true,
          publishers: true,
          hecApplications: true,
          issnRequests: true,
          doiManagement: true,
          dataTools: true,
          invoices: true,
          expenses: true,
          resources: true,
          notifications: true,
          trash: true
        } as UserPermissions,
        createdAt: serverTimestamp()
      };

      // Basic validation for gender
      if (!['Male', 'Female', 'Other'].includes(employee.gender)) {
        employee.gender = 'Male';
      }

      return employee;
    }).filter(Boolean);
  };

  const handleImport = async () => {
    if (!rawData.trim()) return;
    
    setIsImporting(true);
    setError(null);
    
    try {
      const employees = parseData(rawData);
      setProgress({ current: 0, total: employees.length });

      for (let i = 0; i < employees.length; i++) {
        await addDoc(collection(db, 'users'), employees[i]);
        setProgress(prev => ({ ...prev, current: i + 1 }));
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Bulk import error:', err);
      setError('Failed to import some employees. Please check the data format.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Bulk Add Employees</h2>
              <p className="text-sm text-slate-500">Paste tab-separated data from Excel/Sheets</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Raw Data (Tab Separated)</label>
            <textarea
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              placeholder="Employee ID	Joining Date	Name..."
              className="w-full h-96 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
              disabled={isImporting}
            />
          </div>

          <div className="bg-indigo-50 p-4 rounded-2xl">
            <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Expected Columns:</h4>
            <p className="text-[10px] text-indigo-600 leading-relaxed">
              Employee ID, Joining Date, Name, Mode, Department, Assignments, Official Mail, Personal Email, CNIC, WhatsApp, Home Phone, Address, Qualification, Gender, Remarks, Ending Date, Experience
            </p>
          </div>
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
              <span className="text-sm font-bold text-slate-600">
                {progress.current} / {progress.total}
              </span>
            </div>
          ) : (
            <>
              <button
                onClick={async () => {
                  setIsImporting(true);
                  await seedEmployees();
                  setIsImporting(false);
                  onSuccess();
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-indigo-600 hover:bg-indigo-50 transition-all border border-indigo-100"
              >
                Seed Initial Data
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!rawData.trim()}
                className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
              >
                <CheckCircle2 size={20} />
                Start Import
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
