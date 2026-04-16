import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  GraduationCap, 
  Calendar, 
  Target, 
  Clock, 
  Hash, 
  MessageSquare, 
  Monitor, 
  Lock,
  Save,
  X,
  FileText,
  Upload,
  ShieldCheck,
  Check,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { User as CRMUser, UserPermissions, ModulePermissions } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { HelpIcon } from './HelpIcon';
import { usePermissions } from '../hooks/usePermissions';

interface EmployeeEditFormProps {
  employee: CRMUser;
  currentUser: CRMUser;
  onClose: () => void;
}

export const EmployeeEditForm: React.FC<EmployeeEditFormProps> = ({ employee, currentUser, onClose }) => {
  const { check } = usePermissions(currentUser);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    employeeId: employee.employeeId || '',
    name: employee.name || '',
    email: employee.email || '',
    department: employee.department || '',
    assignments: employee.assignments || '',
    qualification: employee.qualification || '',
    joiningDate: employee.joiningDate ? (typeof employee.joiningDate === 'string' ? employee.joiningDate.split('T')[0] : '') : '',
    endingDate: employee.endingDate ? (typeof employee.endingDate === 'string' ? employee.endingDate.split('T')[0] : '') : '',
    experience: employee.experience || '',
    gender: employee.gender || '',
    officialMail: employee.officialMail || '',
    officialMailPassword: employee.officialMailPassword || '',
    personalEmail: employee.personalEmail || '',
    cnic: employee.cnic || '',
    whatsappPersonal: employee.whatsappPersonal || '',
    homePhone: employee.homePhone || '',
    address: employee.address || '',
    remarks: employee.remarks || '',
    portalEnabled: employee.portalEnabled ?? false,
    photoURL: employee.photoURL || '',
    pcAllotted: employee.pcAllotted || '',
    pcUsername: employee.pcUsername || '',
    pcPassword: employee.pcPassword || '',
    role: employee.role || 'Employee',
    modeOfWorking: employee.modeOfWorking || 'On-site',
    employmentHistory: employee.employmentHistory || [],
    permissions: employee.permissions || {
      clients: { view: false, add: false, edit: false, delete: false },
      journals: { view: false, add: false, edit: false, delete: false },
      domains: { view: false, add: false, edit: false, delete: false },
      issnRequests: { view: false, add: false, edit: false, delete: false },
      tasks: { view: false, add: false, edit: false, delete: false },
      invoices: { view: false, add: false, edit: false, delete: false },
      expenses: { view: false, add: false, edit: false, delete: false },
      publishers: { view: false, add: false, edit: false, delete: false },
      hecApplications: { view: false, add: false, edit: false, delete: false },
      indexingAgencies: { view: false, add: false, edit: false, delete: false },
      doiManagement: { view: false, add: false, edit: false, delete: false },
      dataTools: { view: false, add: false, edit: false, delete: false },
      resources: { view: false, add: false, edit: false, delete: false },
      notifications: { view: false, add: false, edit: false, delete: false },
      trash: { view: false, add: false, edit: false, delete: false },
      approvalRequests: { view: false, add: false, edit: false, delete: false },
      settings: { view: false, add: false, edit: false, delete: false },
      employees: { view: false, add: false, edit: false, delete: false }
    } as UserPermissions,
    attachments: employee.attachments || {
      cv: '',
      photo: '',
      cnicScanned: '',
      otherDocs: []
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 500KB to stay under Firestore 1MB limit)
    if (file.size > 500 * 1024) {
      setError("File is too large. Please upload files smaller than 500KB.");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (field === 'otherDocs') {
        setFormData(prev => ({
          ...prev,
          attachments: {
            ...prev.attachments,
            otherDocs: [...(prev.attachments?.otherDocs || []), base64String]
          }
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          attachments: {
            ...prev.attachments,
            [field]: base64String
          }
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePermissionToggle = (module: keyof UserPermissions, action: keyof ModulePermissions) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: {
          ...prev.permissions[module],
          [action]: !prev.permissions[module][action]
        }
      }
    }));
  };

  const handleModuleToggle = (module: keyof UserPermissions, enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: enabled ? { view: true, add: true, edit: true, delete: true, upload: true, download: true, approve: true } : { view: false, add: false, edit: false, delete: false, upload: false, download: false, approve: false }
      }
    }));
  };

  const handleRehire = () => {
    if (!formData.endingDate) return;
    
    const newHistory = [
      ...formData.employmentHistory,
      {
        joiningDate: formData.joiningDate,
        endingDate: formData.endingDate,
        remarks: formData.remarks
      }
    ];

    setFormData(prev => ({
      ...prev,
      joiningDate: new Date().toISOString().split('T')[0],
      endingDate: '',
      remarks: `Rehired on ${new Date().toLocaleDateString()}`,
      employmentHistory: newHistory
    }));
  };

  const generateEmployeeId = async (joiningDate: string) => {
    if (!joiningDate) return;
    
    const dateStr = joiningDate.replace(/-/g, ''); // YYYYMMDD
    const prefix = `EMP-${dateStr}-`;
    
    try {
      const q = query(
        collection(db, 'users'), 
        where('employeeId', '>=', prefix),
        where('employeeId', '<=', prefix + '\uf8ff')
      );
      const snapshot = await getDocs(q);
      const count = snapshot.size + 1;
      const newId = `${prefix}${count.toString().padStart(3, '0')}`;
      
      setFormData(prev => ({ ...prev, employeeId: newId }));
    } catch (error) {
      console.error("Error generating Employee ID:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setError(null);

    // Restriction: Only admin can add/edit employees with gmail address
    const isSystemAdmin = currentUser.role === 'Admin' || currentUser.email === 'irfanbcom2009@gmail.com';
    
    if (formData.email.toLowerCase().endsWith('@gmail.com') && !isSystemAdmin) {
      setError("Only administrators can manage records with @gmail.com addresses.");
      setIsSaving(false);
      return;
    }

    try {
      // Check for unique Employee ID if changed
      if (formData.employeeId !== employee.employeeId) {
        const idQuery = query(collection(db, 'users'), where('employeeId', '==', formData.employeeId));
        const idSnapshot = await getDocs(idQuery);
        if (!idSnapshot.empty) {
          setError("Employee ID already exists. Please use a unique ID.");
          setIsSaving(false);
          return;
        }
      }

      // Check for unique CNIC if changed
      if (formData.cnic && formData.cnic !== employee.cnic) {
        const cnicQuery = query(collection(db, 'users'), where('cnic', '==', formData.cnic));
        const cnicSnapshot = await getDocs(cnicQuery);
        if (!cnicSnapshot.empty) {
          setError("CNIC already exists in the directory.");
          setIsSaving(false);
          return;
        }
      }

      if (!employee.id) {
        throw new Error("Employee ID is missing. Cannot update record.");
      }

      await updateDoc(doc(db, 'users', employee.id), {
        ...formData,
        updatedAt: serverTimestamp()
      });
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 500);
    } catch (err: any) {
      console.error("Error updating employee:", err);
      let message = "Failed to save changes. Please try again.";
      
      if (err.message && err.message.includes('quota')) {
        message = "Storage quota exceeded. Please contact support.";
      } else if (err.code === 'permission-denied') {
        message = "You don't have permission to update this record.";
      } else if (err.message && err.message.includes('too large')) {
        message = "The record is too large to save. Try removing some attachments.";
      }

      setError(message);
      
      try {
        handleFirestoreError(err, OperationType.UPDATE, 'users');
      } catch (e) {
        // handleFirestoreError throws, we catch it here
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {error && (
          <div className="md:col-span-2 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-600 animate-in fade-in slide-in-from-top-2">
            <ShieldCheck size={20} className="shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <User size={16} />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                    Employee ID
                    <HelpIcon policyTitle="Employee ID Policy" />
                  </label>
                  <button 
                    type="button"
                    onClick={() => generateEmployeeId(formData.joiningDate)}
                    className="text-[8px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider flex items-center gap-1"
                  >
                    <RefreshCw size={8} />
                    Regenerate
                  </button>
                </div>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.employeeId}
                  onChange={e => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Profile Photo URL</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.photoURL}
                  onChange={e => setFormData(prev => ({ ...prev, photoURL: e.target.value }))}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Login Username</label>
              <input 
                required
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.role}
                  onChange={e => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                >
                  <option value="Employee">Employee</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode of Working</label>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.modeOfWorking}
                  onChange={e => setFormData(prev => ({ ...prev, modeOfWorking: e.target.value as any }))}
                >
                  <option value="On-site">On-site</option>
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <Building size={16} />
            Professional Profile
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.department}
                onChange={e => setFormData(prev => ({ ...prev, department: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assignments</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.assignments}
                onChange={e => setFormData(prev => ({ ...prev, assignments: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portal Access</label>
              <div className="flex items-center gap-3 h-[42px]">
                <button
                  type="button"
                  disabled={!check('employees', 'edit')}
                  onClick={() => setFormData(prev => ({ ...prev, portalEnabled: !prev.portalEnabled }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                    formData.portalEnabled ? "bg-indigo-600" : "bg-slate-200",
                    !check('employees', 'edit') && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      formData.portalEnabled ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {formData.portalEnabled ? 'Enabled' : 'Disabled'}
                </span>
                {!check('employees', 'edit') && (
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-tight">Admin Only</span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Qualification</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.qualification}
                onChange={e => setFormData(prev => ({ ...prev, qualification: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Experience</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.experience}
                onChange={e => setFormData(prev => ({ ...prev, experience: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Dates & Personal */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <Calendar size={16} />
            Dates & Personal
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Joining Date</label>
              <input 
                type="date"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.joiningDate}
                onChange={e => setFormData(prev => ({ ...prev, joiningDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ending Date</label>
              <div className="flex gap-2">
                <input 
                  type="date"
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.endingDate}
                  onChange={e => setFormData(prev => ({ ...prev, endingDate: e.target.value }))}
                />
                {formData.endingDate && (
                  <button
                    type="button"
                    onClick={handleRehire}
                    className="px-3 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-100 transition-all flex items-center gap-1"
                    title="Rehire Employee"
                  >
                    <RefreshCw size={14} />
                    Rehire
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gender</label>
              <select 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.gender}
                onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CNIC</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.cnic}
                onChange={e => setFormData(prev => ({ ...prev, cnic: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <Phone size={16} />
            Contact Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Official Mail</label>
              <input 
                type="email"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.officialMail}
                onChange={e => setFormData(prev => ({ ...prev, officialMail: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mail Password</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.officialMailPassword}
                onChange={e => setFormData(prev => ({ ...prev, officialMailPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.whatsappPersonal}
                onChange={e => setFormData(prev => ({ ...prev, whatsappPersonal: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Home Phone</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.homePhone}
                onChange={e => setFormData(prev => ({ ...prev, homePhone: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* PC Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <Monitor size={16} />
            PC Details
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PC Allotted</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.pcAllotted}
                onChange={e => setFormData(prev => ({ ...prev, pcAllotted: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PC Username</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.pcUsername}
                  onChange={e => setFormData(prev => ({ ...prev, pcUsername: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PC Password</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.pcPassword}
                  onChange={e => setFormData(prev => ({ ...prev, pcPassword: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Address & Remarks */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <MapPin size={16} />
            Address & Remarks
          </h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Home Address</label>
              <textarea 
                rows={2}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remarks</label>
              <textarea 
                rows={2}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.remarks}
                onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Employment History Section */}
        {formData.employmentHistory.length > 0 && (
          <div className="space-y-4 md:col-span-2 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
              <Clock size={16} />
              Employment History
            </h3>
            <div className="space-y-2">
              {formData.employmentHistory.map((period, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Joined</span>
                      <span className="font-bold text-slate-700">{period.joiningDate}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Left</span>
                      <span className="font-bold text-slate-700">{period.endingDate || 'Present'}</span>
                    </div>
                  </div>
                  {period.remarks && (
                    <div className="flex-1 ml-8 text-slate-500 italic truncate max-w-md">
                      {period.remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Permissions Section */}
        <div className="space-y-4 md:col-span-2 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={16} />
              Module Permissions
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const allFull = Object.keys(formData.permissions).reduce((acc, key) => ({
                    ...acc,
                    [key]: { view: true, add: true, edit: true, delete: true, upload: true, download: true, approve: true }
                  }), {} as UserPermissions);
                  setFormData(prev => ({ ...prev, permissions: allFull }));
                }}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
              >
                Grant All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => {
                  const allNone = Object.keys(formData.permissions).reduce((acc, key) => ({
                    ...acc,
                    [key]: { view: false, add: false, edit: false, delete: false, upload: false, download: false, approve: false }
                  }), {} as UserPermissions);
                  setFormData(prev => ({ ...prev, permissions: allNone }));
                }}
                className="text-[10px] font-bold text-rose-600 hover:text-rose-700 uppercase tracking-wider"
              >
                Revoke All
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(formData.permissions).map(([module, actions]) => (
              <div key={module} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    {module.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const isAllEnabled = Object.values(actions).every(v => v === true);
                      handleModuleToggle(module as keyof UserPermissions, !isAllEnabled);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-tight"
                  >
                    Toggle All
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                  {Object.entries(actions).map(([action, value]) => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox"
                          className="sr-only"
                          checked={value as boolean}
                          onChange={() => handlePermissionToggle(module as keyof UserPermissions, action as keyof ModulePermissions)}
                        />
                        <div className={cn(
                          "w-8 h-4 rounded-full transition-all duration-200",
                          value ? "bg-indigo-600" : "bg-slate-300"
                        )} />
                        <div className={cn(
                          "absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-200",
                          value ? "translate-x-4" : "translate-x-0"
                        )} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                        {action}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attachments Section */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <FileText size={16} />
            Employee Attachments
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CV Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CV / Resume</label>
              <div className="relative group">
                <input 
                  type="file" 
                  onChange={(e) => handleFileUpload(e, 'cv')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  accept=".pdf,.doc,.docx"
                />
                <div className={cn(
                  "p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all",
                  formData.attachments?.cv ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-400 group-hover:border-indigo-300 group-hover:bg-indigo-50"
                )}>
                  <Upload size={20} />
                  <span className="text-[10px] font-bold uppercase">{formData.attachments?.cv ? 'CV Uploaded' : 'Upload CV'}</span>
                </div>
              </div>
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee Photo</label>
              <div className="relative group">
                <input 
                  type="file" 
                  onChange={(e) => handleFileUpload(e, 'photo')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  accept="image/*"
                />
                <div className={cn(
                  "p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all",
                  formData.attachments?.photo ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-400 group-hover:border-indigo-300 group-hover:bg-indigo-50"
                )}>
                  <Upload size={20} />
                  <span className="text-[10px] font-bold uppercase">{formData.attachments?.photo ? 'Photo Uploaded' : 'Upload Photo'}</span>
                </div>
              </div>
            </div>

            {/* CNIC Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CNIC Scanned Copy</label>
              <div className="relative group">
                <input 
                  type="file" 
                  onChange={(e) => handleFileUpload(e, 'cnicScanned')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  accept="image/*,.pdf"
                />
                <div className={cn(
                  "p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all",
                  formData.attachments?.cnicScanned ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-400 group-hover:border-indigo-300 group-hover:bg-indigo-50"
                )}>
                  <Upload size={20} />
                  <span className="text-[10px] font-bold uppercase">{formData.attachments?.cnicScanned ? 'CNIC Uploaded' : 'Upload CNIC'}</span>
                </div>
              </div>
            </div>

            {/* Other Docs Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Other Documents</label>
              <div className="relative group">
                <input 
                  type="file" 
                  onChange={(e) => handleFileUpload(e, 'otherDocs')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  multiple
                />
                <div className={cn(
                  "p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all",
                  formData.attachments?.otherDocs && formData.attachments.otherDocs.length > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-400 group-hover:border-indigo-300 group-hover:bg-indigo-50"
                )}>
                  <Upload size={20} />
                  <span className="text-[10px] font-bold uppercase">
                    {formData.attachments?.otherDocs && formData.attachments.otherDocs.length > 0 
                      ? `${formData.attachments.otherDocs.length} Docs Uploaded` 
                      : 'Upload Others'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-6 border-t border-slate-100">
        <button 
          type="button"
          onClick={onClose}
          className="flex-1 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
        >
          <X size={20} />
          Cancel
        </button>
        <button 
          type="submit"
          disabled={isSaved || isSaving}
          className={cn(
            "flex-[2] px-6 py-3 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-2",
            isSaved 
              ? "bg-emerald-600 text-white shadow-emerald-200" 
              : isSaving
                ? "bg-slate-400 text-white cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
          )}
        >
          {isSaved ? (
            <>
              <Check size={20} />
              Saved Successfully!
            </>
          ) : isSaving ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Saving...
            </>
          ) : (
            <>
              <Save size={20} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
};
