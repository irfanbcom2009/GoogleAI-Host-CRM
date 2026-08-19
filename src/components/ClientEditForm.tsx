import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Save,
  X,
  Shield,
  Calendar,
  Check,
  Loader2
} from 'lucide-react';
import { Client, ServiceType, Subscription, Domain } from '../types';
import { db, auth, handleFirestoreError, OperationType, getErrorMessage } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, getDoc, limit } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { cn, formatDateForInput } from '../lib/utils';
import { useFieldPermissions } from '../hooks/useFieldPermissions';
import { Globe } from 'lucide-react';

interface ClientEditFormProps {
  client: Client;
  currentUser: any;
  onClose: () => void;
}

const SALUTATIONS = ['Mr.', 'Miss', 'Mrs.', 'Dr.', 'Prof.', 'Dr. Prof.'];

export const ClientEditForm: React.FC<ClientEditFormProps> = ({ client, currentUser, onClose }) => {
  const { canView, canEdit } = useFieldPermissions(currentUser);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    salutation: client.salutation || '',
    name: client.name,
    careOf: client.careOf || '',
    email: client.email,
    phone: client.phone,
    address: client.address,
    status: client.status,
    portalEnabled: client.portalEnabled ?? false,
    isActive: client.isActive ?? true,
    isHidden: client.isHidden ?? false,
    endingDate: formatDateForInput(client.endingDate),
    photoURL: client.photoURL || '',
    subscriptions: client.subscriptions || [],
    serviceSubscriptions: client.serviceSubscriptions || {
      ojs: false,
      issn: false,
      hec: false,
      doi: false
    }
  });

  const [subscriptionDates, setSubscriptionDates] = useState<Record<string, { startDate: string, expiryDate: string, domainId?: string }>>({});
  const [clientDomains, setClientDomains] = useState<Domain[]>([]);

  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const q = query(collection(db, 'domains'), where('clientId', '==', client.id));
        const snapshot = await getDocs(q);
        const domains = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Domain[];
        setClientDomains(domains);
      } catch (error) {
        console.error("Error fetching client domains:", error);
      }
    };
    fetchDomains();

    const dates: Record<string, { startDate: string, expiryDate: string, domainId?: string }> = {};
    client.subscriptions?.forEach(sub => {
      const service = typeof sub === 'string' ? sub : sub.service;
      const startDate = typeof sub === 'string' 
        ? new Date().toISOString().split('T')[0] 
        : (formatDateForInput(sub.startDate) || new Date().toISOString().split('T')[0]);
      const expiryDate = typeof sub === 'string' 
        ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0] 
        : (formatDateForInput(sub.expiryDate) || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]);
      const domainId = typeof sub === 'string' ? undefined : sub.domainId;
      
      dates[service] = { startDate, expiryDate, domainId };
    });
    setSubscriptionDates(dates);
  }, [client.subscriptions, client.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    // Restriction: Only admin can add/edit clients with gmail address
    const isSystemAdmin = auth.currentUser?.email === 'irfanbcom2009@gmail.com' || ['ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'].includes(auth.currentUser?.email || '');
    if (formData.email.toLowerCase().endsWith('@gmail.com') && !isSystemAdmin) {
      setError("Only administrators can manage records with @gmail.com addresses.");
      setIsSaving(false);
      return;
    }

    try {
      // Uniqueness checks on Edit
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      const globalSettings = settingsDoc.exists() ? settingsDoc.data() : null;

      if (globalSettings?.uniquenessSettings?.clientEmail && formData.email) {
        const emailQuery = query(collection(db, 'users'), where('email', '==', formData.email.toLowerCase().trim()), limit(1));
        const emailSnapshot = await getDocs(emailQuery);
        if (!emailSnapshot.empty && emailSnapshot.docs[0].id !== client.id) {
          setError('Another client with this email already exists in the registry.');
          setIsSaving(false);
          return;
        }
      }

      if (globalSettings?.uniquenessSettings?.clientPhone && formData.phone) {
        const phoneQuery = query(collection(db, 'users'), where('phone', '==', formData.phone.trim()), limit(1));
        const phoneSnapshot = await getDocs(phoneQuery);
        if (!phoneSnapshot.empty && phoneSnapshot.docs[0].id !== client.id) {
          setError('Another client with this phone number already exists in the registry.');
          setIsSaving(false);
          return;
        }
      }

      console.log("Starting client update for ID:", client.id);
      const updatedSubscriptions = formData.subscriptions.map(sub => {
        const service = typeof sub === 'string' ? sub : sub.service;
        const currentSub = typeof sub === 'string' ? { service, status: 'active' as const } : sub;
        
        const domainId = subscriptionDates[service]?.domainId || (typeof sub === 'string' ? undefined : sub.domainId);
        const domainName = clientDomains.find(d => d.id === domainId)?.domainName || '';
        
        const subObj: any = {
          ...currentSub,
          startDate: subscriptionDates[service]?.startDate || (typeof sub === 'string' ? new Date().toISOString().split('T')[0] : sub.startDate) || new Date().toISOString().split('T')[0],
          expiryDate: subscriptionDates[service]?.expiryDate || (typeof sub === 'string' ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0] : sub.expiryDate) || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        };

        if (domainId) subObj.domainId = domainId;
        if (domainName) subObj.domainName = domainName;

        return subObj;
      });

      const finalStatus = formData.endingDate ? 'inactive' : formData.status;
      
      const updateData = {
        salutation: formData.salutation || '',
        name: formData.name || '',
        careOf: formData.careOf || '',
        email: formData.email || '',
        phone: formData.phone || '',
        address: formData.address || '',
        portalEnabled: formData.portalEnabled ?? false,
        endingDate: formData.endingDate || '',
        photoURL: formData.photoURL || '',
        status: finalStatus,
        subscriptions: updatedSubscriptions,
        serviceSubscriptions: formData.serviceSubscriptions,
        updatedAt: serverTimestamp()
      };

      console.log("Update payload:", updateData);

      if (!client.id) {
        throw new Error("Client ID is missing. Cannot update record.");
      }

      const clientRef = doc(db, 'users', client.id);
      await updateDoc(clientRef, updateData);
      
      console.log("Update successful");
      toast.success('Changes saved successfully');
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 500);
    } catch (err: any) {
      console.error("Error updating client:", err);
      const friendlyMessage = getErrorMessage(err);
      setError(friendlyMessage);
      toast.error(friendlyMessage);
      try {
        handleFirestoreError(err, OperationType.UPDATE, 'users');
      } catch (e) {
        console.error("Firestore error handler failed:", e);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSubscription = (service: ServiceType) => {
    setFormData(prev => {
      const exists = prev.subscriptions.find(s => (typeof s === 'string' ? s : s.service) === service);
      if (exists) {
        return {
          ...prev,
          subscriptions: prev.subscriptions.filter(s => (typeof s === 'string' ? s : s.service) !== service)
        };
      } else {
        const newSub: Subscription = {
          service,
          startDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          status: 'active'
        };
        return {
          ...prev,
          subscriptions: [...prev.subscriptions, newSub]
        };
      }
    });
  };

  const handleDateChange = (service: ServiceType, field: 'startDate' | 'expiryDate' | 'domainId', value: string) => {
    setSubscriptionDates(prev => ({
      ...prev,
      [service]: {
        ...prev[service],
        [field]: value
      }
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-600 animate-in fade-in slide-in-from-top-2">
          <Shield size={20} className="shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">Profile Photo URL</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={formData.photoURL || ''}
            onChange={e => setFormData({ ...formData, photoURL: e.target.value })}
            placeholder="https://example.com/photo.jpg"
            className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {formData.photoURL && (
            <img src={formData.photoURL} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Salutation</label>
          <select 
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            value={formData.salutation || ''}
            onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
          >
            <option value="">None</option>
            {SALUTATIONS.map(sal => (
              <option key={sal} value={sal}>{sal}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Full Name</label>
          <input 
            type="text"
            required
            disabled={!canEdit('clients', 'name')}
            className={cn(
               "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500",
               !canEdit('clients', 'name') && "opacity-50 cursor-not-allowed"
            )}
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">C/O (Care of) / Referred by</label>
        <input 
          type="text"
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
          value={formData.careOf || ''}
          onChange={(e) => setFormData({ ...formData, careOf: e.target.value })}
          placeholder="e.g. Dr. Smith / Referral Name"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Email</label>
          <input 
            type="email"
            required
            disabled={!canEdit('clients', 'email')}
            className={cn(
               "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500",
               !canEdit('clients', 'email') && "opacity-50 cursor-not-allowed"
            )}
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Phone</label>
          <input 
            type="text"
            disabled={!canEdit('clients', 'phone')}
            className={cn(
               "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500",
               !canEdit('clients', 'phone') && "opacity-50 cursor-not-allowed"
            )}
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Portal Access</label>
          <div className="flex items-center gap-2 h-[42px]">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, portalEnabled: !prev.portalEnabled }))}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                formData.portalEnabled ? "bg-indigo-600" : "bg-slate-200"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                formData.portalEnabled ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
            <span className="text-xs font-bold text-slate-600">{formData.portalEnabled ? 'On' : 'Off'}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Active Status</label>
          <div className="flex items-center gap-2 h-[42px]">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                formData.isActive ? "bg-emerald-600" : "bg-slate-200"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                formData.isActive ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
            <span className="text-xs font-bold text-slate-600">{formData.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Hidden Status</label>
          <div className="flex items-center gap-2 h-[42px]">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, isHidden: !prev.isHidden }))}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                formData.isHidden ? "bg-rose-600" : "bg-slate-200"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                formData.isHidden ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
            <span className="text-xs font-bold text-slate-600">{formData.isHidden ? 'Hidden' : 'Visible'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">Address</label>
        <textarea 
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-20"
          value={formData.address || ''}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>
      <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700">
        <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Shield size={18} className="text-indigo-600" />
          Service Subscription Flags
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">Toggle boolean subscription status flags for core client services.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['ojs', 'issn', 'hec', 'doi'] as const).map(serviceKey => {
            const isChecked = !!formData.serviceSubscriptions?.[serviceKey];
            return (
              <label 
                key={serviceKey} 
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all select-none",
                  isChecked 
                    ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800" 
                    : "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-slate-300"
                )}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    checked={isChecked}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        serviceSubscriptions: {
                          ...prev.serviceSubscriptions,
                          [serviceKey]: checked
                        }
                      }));
                    }}
                  />
                  <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">{serviceKey}</span>
                </div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                  isChecked ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300" : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400"
                )}>
                  {isChecked ? 'Subscribed' : 'Off'}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <Shield size={18} className="text-indigo-600" />
          Subscriptions & Dates
        </label>
        <div className="grid grid-cols-1 gap-4">
          {(['Hosting', 'DOI', 'ISSN', 'OJS', 'Editorial', 'Indexing'] as ServiceType[]).map((service, index) => {
            const isSelected = formData.subscriptions.some(s => (typeof s === 'string' ? s : s.service) === service);
            return (
              <div key={`${service}-${index}`} className={cn(
                "p-4 rounded-2xl border transition-all space-y-4",
                isSelected ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                      isSelected ? "bg-white text-indigo-600" : "bg-slate-100 text-slate-400"
                    )}>
                      {service.charAt(0)}
                    </div>
                    <span className={cn("font-bold", isSelected ? "text-indigo-900" : "text-slate-500")}>{service}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSubscription(service)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                      isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {isSelected ? 'Remove' : 'Add'}
                  </button>
                </div>
                {isSelected && (
                  <div className="space-y-4 pt-2 border-t border-indigo-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Start Date</label>
                        <input 
                          type="date"
                          className="w-full p-2 bg-white border border-indigo-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          value={subscriptionDates[service]?.startDate || ''}
                          onChange={(e) => handleDateChange(service, 'startDate', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Expiry Date</label>
                        <input 
                          type="date"
                          className="w-full p-2 bg-white border border-indigo-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          value={subscriptionDates[service]?.expiryDate || ''}
                          onChange={(e) => handleDateChange(service, 'expiryDate', e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                        <Globe size={10} />
                        Associated Domain
                      </label>
                      <select 
                        className="w-full p-2 bg-white border border-indigo-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        value={subscriptionDates[service]?.domainId || ''}
                        onChange={(e) => handleDateChange(service, 'domainId', e.target.value)}
                      >
                        <option value="">No Domain Associated</option>
                        {clientDomains.sort((a, b) => (a.domainName || '').localeCompare(b.domainName || '')).map(domain => (
                          <option key={domain.id} value={domain.id}>{domain.domainName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 border-t border-slate-100">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Shield size={18} className="text-indigo-600" />
            Status
          </label>
          <select
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            value={formData.status || ''}
            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Portal Access</label>
          <div className="flex items-center gap-3 h-[42px]">
            <button
              type="button"
              disabled={currentUser?.role !== 'Admin'}
              onClick={() => setFormData(prev => ({ ...prev, portalEnabled: !prev.portalEnabled }))}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                formData.portalEnabled ? "bg-indigo-600" : "bg-slate-200",
                currentUser?.role !== 'Admin' && "opacity-50 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  formData.portalEnabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
            <span className="text-sm font-medium text-slate-600">
              {formData.portalEnabled ? 'Enabled' : 'Disabled'}
            </span>
            {currentUser?.role !== 'Admin' && (
              <span className="text-[10px] text-rose-500 font-bold uppercase tracking-tight">Admin Only</span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Calendar size={18} className="text-indigo-600" />
            Ending Date
          </label>
          <input
            type="date"
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            value={formData.endingDate || ''}
            onChange={e => setFormData({ ...formData, endingDate: e.target.value })}
          />
          {formData.endingDate && (
            <p className="text-[10px] text-amber-600 font-bold italic">Setting an ending date will mark the client as Inactive.</p>
          )}
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
