import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, addDoc, Timestamp } from 'firebase/firestore';
import { Domain, Client } from '../types';
import { Plus, Check, ShieldAlert, Globe } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface SelectDomainFieldProps {
  clientId?: string; // Optional client filter
  selectedDomainNameOrId: string;
  onChange: (value: string, domainObj?: Domain) => void;
  required?: boolean;
  label?: string;
}

export const SelectDomainField: React.FC<SelectDomainFieldProps> = ({
  clientId = '',
  selectedDomainNameOrId,
  onChange,
  required = false,
  label = 'Select Domain'
}) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New domain inline form state
  const [newDomain, setNewDomain] = useState({
    clientId: clientId,
    domainName: '',
    domainType: 'Primary Domain' as 'Primary Domain' | 'Addon Domain' | 'Subdomain' | 'Parked Domain',
    parentDomainId: '',
    hostingAccount: '',
  });

  useEffect(() => {
    // Sync clientId filter if changed
    if (clientId) {
      setNewDomain(prev => ({ ...prev, clientId }));
    }
  }, [clientId]);

  // Fetch clients to support dynamic lookup if no clientId is set initially
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const clientsData = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((user: any) => user.role === 'Client') as Client[];
      setAllClients(clientsData);
    });
    return unsub;
  }, []);

  // Fetch domains
  useEffect(() => {
    let q = query(collection(db, 'domains'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Domain[];
      setDomains(data);
      setLoading(false);
    }, (error) => {
      console.error('Error loading domains:', error);
      handleFirestoreError(error, OperationType.LIST, 'domains');
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Filter existing domains for active selection list
  const filteredDomains = domains.filter(d => !clientId || d.clientId === clientId);

  const handleRegisterInlineDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const domainCleanName = newDomain.domainName.trim();
    if (!domainCleanName) {
      toast.error('Domain name cannot be empty.');
      return;
    }

    if (!newDomain.clientId) {
      toast.error('Please assign this domain to a Client.');
      return;
    }

    // Strict validation: Prevent duplicate domains system-wide
    const isDuplicate = domains.some(d => d.domainName.toLowerCase().trim() === domainCleanName.toLowerCase());
    if (isDuplicate) {
      toast.error(`Domain "${domainCleanName}" already exists in the system registry! Duplicates are blocked.`);
      return;
    }

    try {
      const today = new Date();
      const oneYearLater = new Date();
      oneYearLater.setFullYear(today.getFullYear() + 1);

      const domainPayload: any = {
        clientId: newDomain.clientId,
        domainName: domainCleanName,
        domainType: newDomain.domainType,
        parentDomainId: newDomain.parentDomainId || '',
        hostingAccount: newDomain.hostingAccount || '',
        status: 'active',
        registrationDate: Timestamp.fromDate(today),
        expirationDate: Timestamp.fromDate(oneYearLater),
        isSubscribed: true,
        isDomainSubscribedFromUs: false,
        isHostingSubscribedFromUs: false,
        registrar: 'System Direct',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'domains'), domainPayload);
      toast.success(`Registered new domain: ${domainCleanName}`);

      // Auto-set the new domain in dropdown
      onChange(domainCleanName, { id: docRef.id, ...domainPayload });

      // Reset inline form
      setNewDomain({
        clientId: clientId,
        domainName: '',
        domainType: 'Primary Domain',
        parentDomainId: '',
        hostingAccount: '',
      });
      setIsAddingNew(false);
    } catch (error) {
      console.error('Error registering inline domain:', error);
      toast.error('Failed to register domain.');
    }
  };

  const selectedDomainObj = domains.find(d => d.id === selectedDomainNameOrId || d.domainName === selectedDomainNameOrId);

  return (
    <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Globe size={16} className="text-indigo-500" />
          {label}
        </label>
        <button
          type="button"
          onClick={() => setIsAddingNew(!isAddingNew)}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
        >
          <Plus size={14} />
          {isAddingNew ? "Select Existing" : "Add New Domain"}
        </button>
      </div>

      {!isAddingNew ? (
        <select
          required={required}
          className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
          value={selectedDomainNameOrId || ''}
          onChange={(e) => {
            const val = e.target.value;
            const found = domains.find(d => d.id === val || d.domainName === val);
            onChange(val, found);
          }}
        >
          <option value="">Choose Domain...</option>
          {filteredDomains.map(d => (
            <option key={d.id} value={d.domainName}>
              {d.domainName} ({d.domainType || 'Primary Domain'})
            </option>
          ))}
        </select>
      ) : (
        <div className="p-3 bg-white dark:bg-slate-800 border-l-4 border-l-indigo-500 rounded-r-xl space-y-3 shadow-inner">
          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Register New Domain directly into CRM Registry:</p>
          
          {!clientId && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">For Client</label>
              <select
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                value={newDomain.clientId || ''}
                onChange={e => setNewDomain(prev => ({ ...prev, clientId: e.target.value }))}
              >
                <option value="">Select a client...</option>
                {allClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Domain Address</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              placeholder="e.g. journal-name.com"
              value={newDomain.domainName || ''}
              onChange={e => setNewDomain(prev => ({ ...prev, domainName: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type</label>
              <select
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                value={newDomain.domainType || ''}
                onChange={e => setNewDomain(prev => ({ ...prev, domainType: e.target.value as any, parentDomainId: '' }))}
              >
                <option value="Primary Domain">Primary Domain</option>
                <option value="Addon Domain">Addon Domain</option>
                <option value="Subdomain">Subdomain</option>
                <option value="Parked Domain">Parked Domain</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hosting Account</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                placeholder="Server Account"
                value={newDomain.hostingAccount || ''}
                onChange={e => setNewDomain(prev => ({ ...prev, hostingAccount: e.target.value }))}
              />
            </div>
          </div>

          {newDomain.domainType !== 'Primary Domain' && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Parent Domain</label>
              <select
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                value={newDomain.parentDomainId || ''}
                onChange={e => setNewDomain(prev => ({ ...prev, parentDomainId: e.target.value }))}
              >
                <option value="">Select Parent Domain...</option>
                {domains
                  .filter(d => (!newDomain.clientId || d.clientId === newDomain.clientId) && (!d.domainType || d.domainType === 'Primary Domain'))
                  .map(d => (
                    <option key={d.id} value={d.id}>{d.domainName}</option>
                  ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-750 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[11px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRegisterInlineDomain}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-sm"
            >
              <Check size={11} /> Register & Select
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
