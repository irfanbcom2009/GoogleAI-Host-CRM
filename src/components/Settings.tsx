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
  Moon,
  Loader2,
  Building2
} from 'lucide-react';
import { motion } from 'motion/react';
import { User as CRMUser, GlobalSettings, JournalCategory, OfficeSubscription, UserRole } from '../types';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Employees } from './Employees';
import { Clients } from './Clients';

interface SettingsProps {
  currentUser: CRMUser;
  onImpersonate?: (user: { id: string, role: UserRole, name: string, email: string }) => void;
  setActiveTab: (tab: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ currentUser, onImpersonate, setActiveTab }) => {
  const [activeSection, setActiveSection] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [profileData, setProfileData] = useState({
    name: currentUser.name,
    email: currentUser.email,
    phone: currentUser.phone || '',
    timezone: currentUser.timezone || 'UTC (GMT+0)'
  });
  const [expenseHeads, setExpenseHeads] = useState<string[]>(['Office Rent', 'Server Hosting', 'Marketing', 'Salaries', 'Utilities']);
  const [journalCategories, setJournalCategories] = useState<JournalCategory[]>([]);
  const [officeSubscriptions, setOfficeSubscriptions] = useState<OfficeSubscription[]>([]);
  const [newHead, setNewHead] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newSubCat, setNewSubCat] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [newIssnType, setNewIssnType] = useState('');
  const [newIssnSubject, setNewIssnSubject] = useState('');
  const [newFrequency, setNewFrequency] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newMode, setNewMode] = useState('');

  const [issnTypes, setIssnTypes] = useState<string[]>(['Claim', 'Assignment', 'Modification']);
  const [issnSubjects, setIssnSubjects] = useState<string[]>(['Pluridisciplinary', 'Social sciences', 'Mathematics', 'Applied sciences', 'Arts', 'Language', 'Geography']);
  const [frequencies, setFrequencies] = useState<string[]>(['Monthly', 'Quarterly', 'Bi-Annual', 'Annual']);
  const [departments, setDepartments] = useState<string[]>(['IT', 'HR', 'Finance', 'Marketing', 'Operations']);
  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Manager';
  const [modes, setModes] = useState<string[]>(['Office', 'Remotely', 'Hybrid']);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!isAdmin) return;
      setIsLoadingSettings(true);
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as GlobalSettings;
          setExpenseHeads(data.expenseHeads || []);
          setJournalCategories(data.journalCategories || []);
          setIssnTypes(data.issnTypes || []);
          setIssnSubjects(data.issnSubjects || []);
          setFrequencies(data.frequencies || []);
          setDepartments(data.departments || []);
          setModes(data.modes || []);
          setOfficeSubscriptions(data.officeSubscriptions || []);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    fetchSettings();
  }, [isAdmin]);

  const handleAddHead = () => {
    if (newHead && !expenseHeads.includes(newHead)) {
      setExpenseHeads([...expenseHeads, newHead]);
      setNewHead('');
    }
  };

  const handleAddCat = () => {
    if (newCat && !journalCategories.find(c => c.name === newCat)) {
      const newCategory: JournalCategory = {
        id: Math.random().toString(36).substr(2, 9),
        name: newCat,
        subCategories: []
      };
      setJournalCategories([...journalCategories, newCategory]);
      setNewCat('');
    }
  };

  const handleAddSubCat = (catId: string) => {
    if (newSubCat) {
      setJournalCategories(journalCategories.map(cat => {
        if (cat.id === catId && !cat.subCategories.includes(newSubCat)) {
          return { ...cat, subCategories: [...cat.subCategories, newSubCat] };
        }
        return cat;
      }));
      setNewSubCat('');
    }
  };

  const handleRemoveSubCat = (catId: string, subCat: string) => {
    setJournalCategories(journalCategories.map(cat => {
      if (cat.id === catId) {
        return { ...cat, subCategories: cat.subCategories.filter(s => s !== subCat) };
      }
      return cat;
    }));
  };

  const handleAddIssnType = () => {
    if (newIssnType && !issnTypes.includes(newIssnType)) {
      setIssnTypes([...issnTypes, newIssnType]);
      setNewIssnType('');
    }
  };

  const handleAddIssnSubject = () => {
    if (newIssnSubject && !issnSubjects.includes(newIssnSubject)) {
      setIssnSubjects([...issnSubjects, newIssnSubject]);
      setNewIssnSubject('');
    }
  };

  const handleAddFrequency = () => {
    if (newFrequency && !frequencies.includes(newFrequency)) {
      setFrequencies([...frequencies, newFrequency]);
      setNewFrequency('');
    }
  };

  const handleAddDepartment = () => {
    if (newDepartment && !departments.includes(newDepartment)) {
      setDepartments([...departments, newDepartment]);
      setNewDepartment('');
    }
  };

  const handleAddMode = () => {
    if (newMode && !modes.includes(newMode)) {
      setModes([...modes, newMode]);
      setNewMode('');
    }
  };

  const handleRemoveHead = (head: string) => {
    setExpenseHeads(expenseHeads.filter(h => h !== head));
  };

  const handleRemoveCat = (catId: string) => {
    setJournalCategories(journalCategories.filter(c => c.id !== catId));
    if (selectedCatId === catId) setSelectedCatId(null);
  };

  const handleRemoveIssnType = (type: string) => {
    setIssnTypes(issnTypes.filter(t => t !== type));
  };

  const handleRemoveIssnSubject = (subject: string) => {
    setIssnSubjects(issnSubjects.filter(s => s !== subject));
  };

  const handleRemoveFrequency = (freq: string) => {
    setFrequencies(frequencies.filter(f => f !== freq));
  };

  const handleRemoveDepartment = (dept: string) => {
    setDepartments(departments.filter(d => d !== dept));
  };

  const handleRemoveMode = (mode: string) => {
    setModes(modes.filter(m => m !== mode));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.id), {
        ...profileData,
        updatedAt: serverTimestamp()
      });

      if (isAdmin) {
        await setDoc(doc(db, 'settings', 'global'), {
          expenseHeads,
          journalCategories,
          issnTypes,
          issnSubjects,
          frequencies,
          departments,
          modes,
          officeSubscriptions,
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

  const sections = [
    { id: 'profile', label: 'My Profile', icon: User, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
    { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
    { id: 'security', label: 'Security', icon: Shield, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
    { id: 'employee-management', label: 'Employee Management', icon: Building2, roles: ['Admin', 'Manager'] },
    { id: 'system', label: 'System Settings', icon: SettingsIcon, roles: ['Admin', 'Manager'] },
  ].filter(s => s.roles.includes(currentUser.role));

  return (
    <div className={cn(
      "p-8 space-y-8 mx-auto transition-all duration-300",
      (['user-management', 'employee-management', 'client-management'].includes(activeSection)) 
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
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
                  <div className="relative group">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}`} 
                      className="w-24 h-24 rounded-3xl bg-slate-100 border-4 border-white shadow-md" 
                      alt="" 
                    />
                    <button 
                      onClick={() => alert('Profile photo update feature coming soon!')}
                      className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-3xl text-xs font-bold"
                    >
                      Change Photo
                    </button>
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
                      <User size={14} className="text-indigo-600" />
                      Full Name
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

            {activeSection === 'employee-management' && (
              <div className="-m-8">
                <Employees currentUser={currentUser} onImpersonate={onImpersonate} />
              </div>
            )}

            {activeSection === 'system' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Expense Heads */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <DollarSign size={16} className="text-emerald-500" />
                      Expense Heads
                    </h4>
                    <div className="space-y-2">
                      {expenseHeads.map(head => (
                        <div key={head} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-sm font-medium text-slate-700">{head}</span>
                          <button onClick={() => handleRemoveHead(head)} className="text-slate-400 hover:text-rose-600 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input 
                          type="text" placeholder="Add new head..."
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          value={newHead} onChange={e => setNewHead(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && handleAddHead()}
                        />
                        <button onClick={handleAddHead} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Journal Categories & Sub-categories */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <BookOpen size={16} className="text-indigo-500" />
                      Journal Categories
                    </h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {journalCategories.map(cat => (
                          <div key={cat.id} className="space-y-2">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <button 
                                onClick={() => setSelectedCatId(selectedCatId === cat.id ? null : cat.id)}
                                className="text-sm font-bold text-slate-700 hover:text-indigo-600 transition-all"
                              >
                                {cat.name} ({cat.subCategories.length})
                              </button>
                              <button onClick={() => handleRemoveCat(cat.id)} className="text-slate-400 hover:text-rose-600 transition-all">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            
                            {selectedCatId === cat.id && (
                              <div className="ml-4 pl-4 border-l-2 border-indigo-100 space-y-2">
                                {cat.subCategories.map(sub => (
                                  <div key={sub} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                                    <span className="text-xs font-medium text-slate-600">{sub}</span>
                                    <button onClick={() => handleRemoveSubCat(cat.id, sub)} className="text-slate-400 hover:text-rose-600 transition-all">
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                                <div className="flex gap-2">
                                  <input 
                                    type="text" placeholder="Add sub-category..."
                                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newSubCat} onChange={e => setNewSubCat(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleAddSubCat(cat.id)}
                                  />
                                  <button onClick={() => handleAddSubCat(cat.id)} className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-all">
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" placeholder="Add new category..."
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          value={newCat} onChange={e => setNewCat(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && handleAddCat()}
                        />
                        <button onClick={handleAddCat} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Office Subscriptions */}
                  <div className="space-y-4 col-span-full">
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

                  {/* Other Configs */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-900">ISSN Types</h4>
                    <div className="flex flex-wrap gap-2">
                      {issnTypes.map(t => (
                        <span key={t} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium flex items-center gap-2">
                          {t}
                          <button onClick={() => handleRemoveIssnType(t)} className="text-slate-400 hover:text-rose-600"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-900">Departments</h4>
                    <div className="flex flex-wrap gap-2">
                      {departments.map(d => (
                        <span key={d} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium flex items-center gap-2">
                          {d}
                          <button onClick={() => handleRemoveDepartment(d)} className="text-slate-400 hover:text-rose-600"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
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
                    className="flex items-center gap-2 text-emerald-600 font-bold text-sm"
                  >
                    <CheckCircle2 size={16} />
                    Changes saved successfully!
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
