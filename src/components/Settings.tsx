import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  Globe, 
  Mail, 
  Phone, 
  Save,
  CheckCircle2,
  Lock,
  Palette,
  Database,
  DollarSign,
  BookOpen,
  Trash2,
  Plus,
  X,
  FileText,
  Clock,
  Calendar,
  Moon,
  Loader2,
  Building2,
  Camera,
  Edit
} from 'lucide-react';
import { motion } from 'motion/react';
import { User as CRMUser, GlobalSettings, JournalCategory, OfficeSubscription, UserRole } from '../types';
import { cn, formatDateForInput } from '../lib/utils';
import { db, handleFirestoreError, OperationType, auth, storage } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Employees } from './Employees';
import { Clients } from './Clients';
import { HECCategorySettings } from './HECCategorySettings';
import { RegistrarManager } from './RegistrarManager';
import { FieldPermissionsDashboard } from './FieldPermissionsDashboard';
import { usePermissions } from '../hooks/usePermissions';

interface SettingsProps {
  currentUser: CRMUser;
  onImpersonate?: (user: { id: string, role: UserRole, name: string, email: string }) => void;
  setActiveTab: (tab: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ currentUser, onImpersonate, setActiveTab }) => {
  const { check, isAdmin } = usePermissions(currentUser);
  const [activeSection, setActiveSection] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [profileData, setProfileData] = useState({
    salutation: currentUser.salutation || '',
    name: currentUser.name,
    email: currentUser.email,
    phone: currentUser.phone || '',
    timezone: currentUser.timezone || 'UTC (GMT+0)',
    address: currentUser.address || '',
    personalEmail: currentUser.personalEmail || '',
    whatsappPersonal: currentUser.whatsappPersonal || '',
    homePhone: currentUser.homePhone || '',
    cnic: currentUser.cnic || '',
    qualification: currentUser.qualification || '',
    gender: currentUser.gender || 'Male',
    experience: currentUser.experience || '',
    photoURL: currentUser.photoURL || '',
    joiningDate: formatDateForInput(currentUser.joiningDate)
  });
  const [theme, setTheme] = useState<'light' | 'dark'>((localStorage.getItem('theme') as 'light' | 'dark') || 'light');
  const [orgBranding, setOrgBranding] = useState({
    name: 'Host A Journal',
    logoUrl: '',
    primaryColor: '#6366F1'
  });
  const [officeSubscriptions, setOfficeSubscriptions] = useState<OfficeSubscription[]>([]);
  const [activatableServices, setActivatableServices] = useState<string[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [newService, setNewService] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setProfileData({
      salutation: currentUser.salutation || '',
      name: currentUser.name,
      email: currentUser.email,
      phone: currentUser.phone || '',
      timezone: currentUser.timezone || 'UTC (GMT+0)',
      address: currentUser.address || '',
      personalEmail: currentUser.personalEmail || '',
      whatsappPersonal: currentUser.whatsappPersonal || '',
      homePhone: currentUser.homePhone || '',
      cnic: currentUser.cnic || '',
      qualification: currentUser.qualification || '',
      gender: currentUser.gender || 'Male',
      experience: currentUser.experience || '',
      photoURL: currentUser.photoURL || '',
      joiningDate: formatDateForInput(currentUser.joiningDate)
    });
  }, [currentUser]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!isAdmin) return;
      setIsLoadingSettings(true);
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as GlobalSettings;
          setOfficeSubscriptions(Array.isArray(data.officeSubscriptions) ? data.officeSubscriptions : []);
          setActivatableServices(Array.isArray(data.activatableServices) ? data.activatableServices : []);
          if (data.branding) {
            setOrgBranding(data.branding as any);
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    fetchSettings();
  }, [isAdmin]);

  const handleSave = async () => {
    setIsSaving(true);
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    try {
      const directChanges: any = {};
      const requestedChanges: any = {};
      let hasRequestedChanges = false;

      Object.keys(profileData).forEach(key => {
        const newValue = (profileData as any)[key];
        const oldValue = (currentUser as any)[key] || '';

        if (newValue !== oldValue) {
          // If Admin, or if the field was empty, allow direct change
          // Added ayesha tariq's emails for direct saving
          const isAyesha = ['ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'].includes(currentUser.email);
          if (isAdmin || !oldValue || isAyesha) {
            directChanges[key] = newValue;
          } else {
            // Field was already filled, request change
            requestedChanges[key] = { oldValue, newValue };
            hasRequestedChanges = true;
          }
        }
      });

      if (Object.keys(directChanges).length > 0) {
        await updateDoc(doc(db, 'users', currentUser.id), {
          ...directChanges,
          updatedAt: serverTimestamp()
        });
      }

      if (hasRequestedChanges) {
        await addDoc(collection(db, 'profile_update_requests'), {
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          changes: requestedChanges,
          status: 'pending',
          createdAt: serverTimestamp(),
          createdById: currentUser.id,
          createdBy: currentUser.name
        });
      }

      if (isAdmin) {
        await updateDoc(doc(db, 'settings', 'global'), {
          officeSubscriptions,
          activatableServices,
          branding: orgBranding,
          updatedAt: serverTimestamp()
        });
      }
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (e.g., 2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      alert("Image size should be less than 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `profile_pictures/${currentUser.id}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setProfileData(prev => ({ ...prev, photoURL: downloadURL }));
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      alert("Failed to upload profile picture. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };
  const sections = [
    { id: 'profile', label: 'My Profile', icon: User, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
    { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
    { id: 'appearance', label: 'Appearance', icon: Palette, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
    { id: 'security', label: 'Security', icon: Shield, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
    { id: 'organization', label: 'Organization', icon: Building2, roles: ['Admin'], permission: 'settings' },
    { id: 'registrars', label: 'Domain Registrars', icon: Globe, roles: ['Admin', 'Manager'], permission: 'domains' },
    { id: 'field-permissions', label: 'Field Permissions', icon: Shield, roles: ['Admin'], permission: 'settings' },
    { id: 'system', label: 'System Settings', icon: SettingsIcon, roles: ['Admin', 'Manager'], permission: 'settings' },
  ].filter(s => {
    if (!s.roles.includes(currentUser.role)) return false;
    if (s.permission) {
      return check(s.permission as any, 'view');
    }
    return true;
  });

  return (
    <div className={cn(
      "p-8 space-y-8 mx-auto transition-all duration-300",
      (['user-management', 'employee-management', 'client-management', 'registrars'].includes(activeSection)) 
        ? "max-w-7xl" 
        : "max-w-4xl"
    )}>
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="text-slate-500 mt-1">Manage your account settings and system preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 shrink-0 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm",
                activeSection === section.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <section.icon size={18} />
              {section.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 space-y-8">
            {activeSection === 'field-permissions' && (
              <FieldPermissionsDashboard />
            )}

            {activeSection === 'profile' && (
              <div className="space-y-6">
                <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
                  <div className="relative group">
                    <div className="relative">
                      <img 
                        src={profileData.photoURL || auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}`} 
                        className={cn(
                          "w-24 h-24 rounded-3xl bg-slate-100 border-4 border-white shadow-md object-cover ring-2 ring-slate-50",
                          isUploading && "opacity-50"
                        )} 
                        alt="" 
                      />
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="animate-spin text-indigo-600" size={24} />
                        </div>
                      )}
                    </div>
                    
                    <div className="absolute -bottom-2 -right-2 flex gap-1">
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileUpload}
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 group/btn"
                        title="Upload New Photo"
                      >
                        <Camera size={14} className="group-hover/btn:scale-110 transition-transform" />
                      </button>
                      
                      <button 
                        onClick={() => {
                          const url = prompt('Enter image URL:');
                          if (url !== null) setProfileData({ ...profileData, photoURL: url });
                        }}
                        disabled={isUploading}
                        className="p-2 bg-white text-slate-600 rounded-xl shadow-lg border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50"
                        title="Enter URL Manually"
                      >
                        <Edit size={14} />
                      </button>
                      
                      {auth.currentUser?.photoURL && profileData.photoURL !== auth.currentUser.photoURL && (
                        <button 
                          onClick={() => setProfileData({ ...profileData, photoURL: auth.currentUser?.photoURL || '' })}
                          disabled={isUploading}
                          className="p-2 bg-white text-slate-600 rounded-xl shadow-lg border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50"
                          title="Reset to Google Photo"
                        >
                          <Globe size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{currentUser.name}</h3>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-1">{currentUser.role}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-100 uppercase tracking-wider">
                        Active Account
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      Salutation
                    </label>
                    <select 
                      value={profileData.salutation}
                      onChange={e => setProfileData({ ...profileData, salutation: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="">Select Salutation</option>
                      <option value="Mr.">Mr.</option>
                      <option value="Miss">Miss</option>
                      <option value="Mrs.">Mrs.</option>
                      <option value="Dr.">Dr.</option>
                      <option value="Prof.">Prof.</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <User size={14} className="text-indigo-600" />
                      Full Name
                      {currentUser.name && !isAdmin && <span className="text-[10px] text-amber-600 font-medium">(Request Approval)</span>}
                    </label>
                    <input 
                      type="text" 
                      value={profileData.name}
                      onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Mail size={14} className="text-indigo-600" />
                      Email Address
                      {currentUser.email && !isAdmin && <span className="text-[10px] text-amber-600 font-medium">(Request Approval)</span>}
                    </label>
                    <input 
                      type="email" 
                      value={profileData.email}
                      onChange={e => setProfileData({ ...profileData, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Phone size={14} className="text-indigo-600" />
                      Phone Number
                      {currentUser.phone && !isAdmin && <span className="text-[10px] text-amber-600 font-medium">(Request Approval)</span>}
                    </label>
                    <input 
                      type="tel" 
                      placeholder="+1 (555) 000-0000"
                      value={profileData.phone}
                      onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Globe size={14} className="text-indigo-600" />
                      Timezone
                    </label>
                    <select 
                      value={profileData.timezone}
                      onChange={e => setProfileData({ ...profileData, timezone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option>UTC (GMT+0)</option>
                      <option>EST (GMT-5)</option>
                      <option>PST (GMT-8)</option>
                      <option>PKT (GMT+5)</option>
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      Address
                      {currentUser.address && !isAdmin && <span className="text-[10px] text-amber-600 font-medium">(Request Approval)</span>}
                    </label>
                    <textarea 
                      value={profileData.address}
                      onChange={e => setProfileData({ ...profileData, address: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      rows={2}
                    />
                  </div>

                  {currentUser.role !== 'Client' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          Personal Email
                          {currentUser.personalEmail && !isAdmin && <span className="text-[10px] text-amber-600 font-medium">(Request Approval)</span>}
                        </label>
                        <input 
                          type="email" 
                          value={profileData.personalEmail}
                          onChange={e => setProfileData({ ...profileData, personalEmail: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          WhatsApp Number
                          {currentUser.whatsappPersonal && !isAdmin && <span className="text-[10px] text-amber-600 font-medium">(Request Approval)</span>}
                        </label>
                        <input 
                          type="tel" 
                          value={profileData.whatsappPersonal}
                          onChange={e => setProfileData({ ...profileData, whatsappPersonal: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          Home Phone
                          {currentUser.homePhone && !isAdmin && <span className="text-[10px] text-amber-600 font-medium">(Request Approval)</span>}
                        </label>
                        <input 
                          type="tel" 
                          value={profileData.homePhone}
                          onChange={e => setProfileData({ ...profileData, homePhone: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          CNIC Number
                          {currentUser.cnic && !isAdmin && <span className="text-[10px] text-amber-600 font-medium">(Request Approval)</span>}
                        </label>
                        <input 
                          type="text" 
                          value={profileData.cnic}
                          onChange={e => setProfileData({ ...profileData, cnic: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          Qualification
                          {currentUser.qualification && !isAdmin && <span className="text-[10px] text-amber-600 font-medium">(Request Approval)</span>}
                        </label>
                        <input 
                          type="text" 
                          value={profileData.qualification}
                          onChange={e => setProfileData({ ...profileData, qualification: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          Gender
                        </label>
                        <select 
                          value={profileData.gender}
                          onChange={e => setProfileData({ ...profileData, gender: e.target.value as any })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <Calendar size={14} className="text-indigo-600" />
                          Joining Date
                          {!isAdmin && <span className="text-[10px] text-slate-400 font-medium">(View Only)</span>}
                        </label>
                        <input 
                          type="date" 
                          disabled={!isAdmin}
                          value={profileData.joiningDate}
                          onChange={e => setProfileData({ ...profileData, joiningDate: e.target.value })}
                          className={cn(
                            "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                            !isAdmin && "opacity-60 cursor-not-allowed"
                          )}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          Experience Summary
                          {currentUser.experience && !isAdmin && <span className="text-[10px] text-amber-600 font-medium">(Request Approval)</span>}
                        </label>
                        <textarea 
                          value={profileData.experience}
                          onChange={e => setProfileData({ ...profileData, experience: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          rows={3}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'appearance' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Palette size={16} className="text-indigo-500" />
                    Theme Preference
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setTheme('light')}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all text-left space-y-3",
                        theme === 'light' ? "border-indigo-600 bg-indigo-50/50" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                      )}
                    >
                      <div className="w-full aspect-video bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="h-4 bg-slate-100 border-b border-slate-200" />
                        <div className="flex-1 p-2 space-y-1">
                          <div className="h-2 w-1/2 bg-slate-100 rounded" />
                          <div className="h-2 w-full bg-slate-50 rounded" />
                        </div>
                      </div>
                      <p className="text-sm font-bold text-slate-900">Light Mode</p>
                    </button>
                    <button 
                      onClick={() => setTheme('dark')}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all text-left space-y-3",
                        theme === 'dark' ? "border-indigo-600 bg-indigo-50/50" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                      )}
                    >
                      <div className="w-full aspect-video bg-slate-900 rounded-lg border border-slate-800 shadow-sm overflow-hidden flex flex-col">
                        <div className="h-4 bg-slate-800 border-b border-slate-700" />
                        <div className="flex-1 p-2 space-y-1">
                          <div className="h-2 w-1/2 bg-slate-800 rounded" />
                          <div className="h-2 w-full bg-slate-800/50 rounded" />
                        </div>
                      </div>
                      <p className="text-sm font-bold text-slate-900">Dark Mode (Experimental)</p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'organization' && (
              <div className="space-y-8">
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-500" />
                    Branding & Identity
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="crm-label">Organization Name</label>
                      <input 
                        type="text"
                        className="crm-input"
                        value={orgBranding.name}
                        onChange={e => setOrgBranding({...orgBranding, name: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="crm-label">Primary Brand Color</label>
                      <div className="flex gap-3">
                        <input 
                          type="color"
                          className="h-11 w-20 rounded-xl cursor-pointer border-none bg-transparent"
                          value={orgBranding.primaryColor}
                          onChange={e => setOrgBranding({...orgBranding, primaryColor: e.target.value})}
                        />
                        <input 
                          type="text"
                          className="crm-input flex-1"
                          value={orgBranding.primaryColor}
                          onChange={e => setOrgBranding({...orgBranding, primaryColor: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2 md:col-span-2">
                      <label className="crm-label">Logo URL</label>
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                          {orgBranding.logoUrl ? (
                            <img src={orgBranding.logoUrl} className="max-w-full max-h-full object-contain" alt="Logo" />
                          ) : (
                            <Building2 className="text-slate-300" size={32} />
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <input 
                            type="text"
                            placeholder="https://..."
                            className="crm-input"
                            value={orgBranding.logoUrl}
                            onChange={e => setOrgBranding({...orgBranding, logoUrl: e.target.value})}
                          />
                          <p className="text-[10px] text-slate-500">Provide a URL for your organization logo (SVG or PNG recommended).</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-4">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shrink-0 h-fit">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Security Recommendation</h4>
                    <p className="text-xs text-amber-700 mt-1">Enable two-factor authentication to add an extra layer of security to your account.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white text-slate-600 rounded-xl border border-slate-200">
                        <Lock size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Two-Factor Authentication</p>
                        <p className="text-xs text-slate-500">Protect your account with a second factor.</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all">
                      Enable
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white text-slate-600 rounded-xl border border-slate-200">
                        <Database size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Session Management</p>
                        <p className="text-xs text-slate-500">View and manage your active sessions.</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all">
                      View Sessions
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'registrars' && (
              <RegistrarManager currentUser={currentUser} />
            )}

            {activeSection === 'system' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock size={16} className="text-rose-500" />
                    Office Subscriptions
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {officeSubscriptions.map(sub => (
                      <div key={sub.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                        <button 
                          onClick={() => setOfficeSubscriptions(officeSubscriptions.filter(s => s.id !== sub.id))}
                          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                        <p className="font-bold text-slate-900">{sub.name}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-500">Expires: {sub.expiryDate}</span>
                          <span className="text-xs font-bold text-indigo-600">{sub.cost} {sub.currency}</span>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const name = prompt('Subscription Name:');
                        const date = prompt('Expiry Date (YYYY-MM-DD):');
                        const cost = prompt('Cost:');
                        if (name && date && cost) {
                          setOfficeSubscriptions([...officeSubscriptions, {
                            id: Math.random().toString(36).substr(2, 9),
                            name,
                            expiryDate: date,
                            cost: Number(cost),
                            currency: 'PKR',
                            status: 'active'
                          }]);
                        }
                      }}
                      className="p-4 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                    >
                      <Plus size={24} />
                      <span className="text-xs font-bold mt-1">Add Subscription</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-8 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Globe size={16} className="text-indigo-500" />
                    Services to Activate
                  </h4>
                  <p className="text-xs text-slate-500">Manage the list of services available for activation in Client and Journal profiles.</p>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Add new service..."
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={newService}
                      onChange={(e) => setNewService(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newService.trim()) {
                          if (!activatableServices.includes(newService.trim())) {
                            setActivatableServices([...activatableServices, newService.trim()]);
                          }
                          setNewService('');
                        }
                      }}
                    />
                    <button 
                      onClick={() => {
                        if (newService.trim()) {
                          if (!activatableServices.includes(newService.trim())) {
                            setActivatableServices([...activatableServices, newService.trim()]);
                          }
                          setNewService('');
                        }
                      }}
                      className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
                    >
                      <Plus size={20} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activatableServices.map(service => (
                      <div 
                        key={service}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 group"
                      >
                        {service}
                        <button 
                          onClick={() => setActivatableServices(activatableServices.filter(s => s !== service))}
                          className="text-indigo-300 hover:text-rose-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {activatableServices.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No services added yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {showSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                      <CheckCircle2 size={16} />
                      Changes saved successfully!
                    </div>
                    {!isAdmin && (
                      <p className="text-[10px] text-amber-600 font-medium">Note: Changes to existing data require administrator approval.</p>
                    )}
                  </motion.div>
                )}
              </div>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
