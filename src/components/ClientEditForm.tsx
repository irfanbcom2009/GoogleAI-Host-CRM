import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Save,
  X,
  Shield
} from 'lucide-react';
import { Client, ServiceType, Subscription, Domain } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Globe } from 'lucide-react';

interface ClientEditFormProps {
  client: Client;
  onClose: () => void;
}

const SALUTATIONS = ['Mr.', 'Miss', 'Mrs.', 'Dr.', 'Prof.', 'Dr. Prof.'];

export const ClientEditForm: React.FC<ClientEditFormProps> = ({ client, onClose }) => {
  const [formData, setFormData] = useState({
    salutation: client.salutation || '',
    name: client.name,
    email: client.email,
    phone: client.phone,
    address: client.address,
    status: client.status,
    subscriptions: client.subscriptions || []
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
      const startDate = typeof sub === 'string' ? new Date().toISOString().split('T')[0] : (sub.startDate || new Date().toISOString().split('T')[0]);
      const expiryDate = typeof sub === 'string' ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0] : (sub.expiryDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]);
      const domainId = typeof sub === 'string' ? undefined : sub.domainId;
      
      dates[service] = { startDate, expiryDate, domainId };
    });
    setSubscriptionDates(dates);
  }, [client.subscriptions, client.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedSubscriptions = formData.subscriptions.map(sub => {
        const service = typeof sub === 'string' ? sub : sub.service;
        const currentSub = typeof sub === 'string' ? { service, status: 'active' as const } : sub;
        
        const domainId = subscriptionDates[service]?.domainId || (typeof sub === 'string' ? undefined : sub.domainId);
        const domainName = clientDomains.find(d => d.id === domainId)?.domainName;
        
        return {
          ...currentSub,
          startDate: subscriptionDates[service]?.startDate || (typeof sub === 'string' ? new Date().toISOString().split('T')[0] : sub.startDate),
          expiryDate: subscriptionDates[service]?.expiryDate || (typeof sub === 'string' ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0] : sub.expiryDate),
          domainId,
          domainName
        };
      });

      await updateDoc(doc(db, 'users', client.id), {
        ...formData,
        subscriptions: updatedSubscriptions,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'clients');
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Salutation</label>
          <select 
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            value={formData.salutation}
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
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Email</label>
          <input 
            type="email"
            required
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Phone</label>
          <input 
            type="text"
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">Address</label>
        <textarea 
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-20"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </div>
      <div className="space-y-4">
        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <Shield size={18} className="text-indigo-600" />
          Subscriptions & Dates
        </label>
        <div className="grid grid-cols-1 gap-4">
          {(['Hosting', 'DOI', 'ISSN', 'OJS', 'Editorial', 'Indexing', 'Plagiarism'] as ServiceType[]).map(service => {
            const isSelected = formData.subscriptions.some(s => (typeof s === 'string' ? s : s.service) === service);
            return (
              <div key={service} className={cn(
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
                        {clientDomains.map(domain => (
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
