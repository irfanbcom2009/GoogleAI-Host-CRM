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
  ShieldCheck
} from 'lucide-react';
import { User as CRMUser, UserPermissions } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface EmployeeEditFormProps {
  employee: CRMUser;
  onClose: () => void;
}

export const EmployeeEditForm: React.FC<EmployeeEditFormProps> = ({ employee, onClose }) => {
  const [formData, setFormData] = useState({
    employeeId: employee.employeeId || '',
    name: employee.name || '',
    email: employee.email || '',
    department: employee.department || '',
    assignments: employee.assignments || '',
    qualification: employee.qualification || '',
    joiningDate: employee.joiningDate || '',
    endingDate: employee.endingDate || '',
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
    pcAllotted: employee.pcAllotted || '',
    pcUsername: employee.pcUsername || '',
    pcPassword: employee.pcPassword || '',
    role: employee.role || 'Employee',
    modeOfWorking: employee.modeOfWorking || 'On-site',
    permissions: employee.permissions || {
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

  const handlePermissionToggle = (key: keyof UserPermissions) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'users', employee.id), {
        ...formData,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <User size={16} />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee ID</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.employeeId}
                  onChange={e => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
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
              <input 
                type="date"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.endingDate}
                onChange={e => setFormData(prev => ({ ...prev, endingDate: e.target.value }))}
              />
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

        {/* Permissions Section */}
        <div className="space-y-4 md:col-span-2 pt-6 border-t border-slate-100">
          <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={16} />
            Feature Permissions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
            {Object.entries(formData.permissions).map(([key, value]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox"
                    className="sr-only"
                    checked={value}
                    onChange={() => handlePermissionToggle(key as keyof UserPermissions)}
                  />
                  <div className={cn(
                    "w-10 h-6 rounded-full transition-all duration-200",
                    value ? "bg-indigo-600" : "bg-slate-300"
                  )} />
                  <div className={cn(
                    "absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all duration-200",
                    value ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </label>
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
          className="flex-[2] px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2"
        >
          <Save size={20} />
          Save Changes
        </button>
      </div>
    </form>
  );
};
