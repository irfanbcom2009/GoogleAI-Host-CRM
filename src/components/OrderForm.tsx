import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  DollarSign,
  Info
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CatalogItem, User as UserType, Order, PricingTier } from '../types';
import { cn } from '../lib/utils';
import { SearchableSelect } from './ui/SearchableSelect';
import { WorkflowEngine } from '../services/workflowEngine';

interface OrderFormProps {
  service: CatalogItem;
  currentUser: UserType;
  onClose: () => void;
  onSuccess: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({ service, currentUser, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PricingTier>(service.pricingTiers[0]);
  const [requirementsData, setRequirementsData] = useState<{ [key: string]: any }>({});
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate requirements
    const missingFields = service.requirements
      .filter(req => req.required && !requirementsData[req.id])
      .map(req => req.label);
    
    if (missingFields.length > 0) {
      setError(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      const orderData: any = {
        orderNumber,
        clientId: currentUser.id,
        clientName: currentUser.name,
        catalogItemId: service.id,
        catalogItemName: service.name,
        requirementsData,
        deliverablesData: {},
        status: 'pending',
        serviceStatus: 'Not Started',
        progressPercentage: 0,
        paymentStatus: 'unpaid',
        priority: selectedTier.priority,
        totalAmount: selectedTier.price,
        paidAmount: 0,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name,
        createdById: currentUser.id,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Trigger Workflow Engine
      await WorkflowEngine.generateTasksForOrder({ id: docRef.id, ...orderData } as Order, currentUser);
      
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'orders');
      setError('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (id: string, value: any) => {
    setRequirementsData(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="space-y-8 p-1">
      <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-start gap-4">
        <div className="p-3 bg-white rounded-2xl text-indigo-600 shadow-sm">
          <Info size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">{service.name}</h3>
          <p className="text-sm text-slate-600 mt-1">{service.description}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Priority Selection */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700">Select Priority & Delivery Speed</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {service.pricingTiers.map(tier => (
              <button
                key={tier.priority}
                type="button"
                onClick={() => setSelectedTier(tier)}
                className={cn(
                  "p-4 rounded-2xl border-2 text-left transition-all",
                  selectedTier.priority === tier.priority 
                    ? "bg-indigo-50 border-indigo-600 shadow-md" 
                    : "bg-white border-slate-100 hover:border-slate-200"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    selectedTier.priority === tier.priority ? "text-indigo-600" : "text-slate-400"
                  )}>
                    {tier.priority}
                  </span>
                  {selectedTier.priority === tier.priority && <CheckCircle2 size={16} className="text-indigo-600" />}
                </div>
                <div className="text-xl font-black text-slate-900">${tier.price}</div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Clock size={12} />
                  Est. {tier.estimatedDays} days
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Requirements Form */}
        <div className="space-y-6">
          <h4 className="text-lg font-bold text-slate-900">Requirements</h4>
          <div className="grid grid-cols-1 gap-6">
            {service.requirements.map(req => (
              <div key={req.id} className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                  {req.label}
                  {req.required && <span className="text-rose-500">*</span>}
                </label>
                
                {req.type === 'text' && (
                  <input 
                    type="text"
                    required={req.required}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder={req.placeholder}
                    value={requirementsData[req.id] || ''}
                    onChange={e => handleInputChange(req.id, e.target.value)}
                  />
                )}

                {req.type === 'textarea' && (
                  <textarea 
                    required={req.required}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                    placeholder={req.placeholder}
                    value={requirementsData[req.id] || ''}
                    onChange={e => handleInputChange(req.id, e.target.value)}
                  />
                )}

                {req.type === 'select' && (
                  <SearchableSelect
                    required={req.required}
                    options={req.options?.map(opt => ({ label: opt, value: opt })) || []}
                    value={requirementsData[req.id] || ''}
                    onChange={value => handleInputChange(req.id, value)}
                    placeholder="Select an option"
                  />
                )}

                {req.type === 'number' && (
                  <input 
                    type="number"
                    required={req.required}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder={req.placeholder}
                    value={requirementsData[req.id] || ''}
                    onChange={e => handleInputChange(req.id, e.target.value)}
                  />
                )}

                {req.type === 'date' && (
                  <input 
                    type="date"
                    required={req.required}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={requirementsData[req.id] || ''}
                    onChange={e => handleInputChange(req.id, e.target.value)}
                  />
                )}

                {req.type === 'file' && (
                  <div className="relative">
                    <input 
                      type="text"
                      required={req.required}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="Paste file URL here..."
                      value={requirementsData[req.id] || ''}
                      onChange={e => handleInputChange(req.id, e.target.value)}
                    />
                    <p className="text-[10px] text-slate-400 mt-1 ml-2 italic">Please upload your file to the File Manager and paste the link here.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-medium">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Amount</span>
            <span className="text-2xl font-black text-indigo-600">${selectedTier.price}</span>
          </div>
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 text-white px-10 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              Place Order
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
