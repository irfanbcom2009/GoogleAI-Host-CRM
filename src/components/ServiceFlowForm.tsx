import React, { useState, useMemo } from 'react';
import { 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  FileText, 
  Package, 
  Settings, 
  AlertCircle,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  Info
} from 'lucide-react';
import { SERVICE_TEMPLATES } from '../constants/serviceTemplates';
import { ServiceTemplate, Client, User, WorkflowMainTask, WorkflowSubTask } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ServiceFlowFormProps {
  clients: Client[];
  employees: User[];
  currentUser: User;
  onSuccess: (task: Partial<WorkflowMainTask>) => void;
  isSubmitting: boolean;
}

export const ServiceFlowForm: React.FC<ServiceFlowFormProps> = ({ 
  clients, 
  employees, 
  currentUser,
  onSuccess,
  isSubmitting 
}) => {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectionMode, setSelectionMode] = useState<'need' | 'already_have' | 'partial'>('need');
  const [selectedSubItems, setSelectedSubItems] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [clientInstructions, setClientInstructions] = useState('');
  const [employeeInstructions, setEmployeeInstructions] = useState('');
  const [requirementValues, setRequirementValues] = useState<Record<string, any>>({});

  const selectedService = selectedServiceId ? SERVICE_TEMPLATES[selectedServiceId] : null;

  const isFieldVisible = (field: any, values: Record<string, any>) => {
    if (!field.dependsOn) return true;
    const { fieldId, value } = field.dependsOn;
    return values[fieldId] === value;
  };

  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    if (selectionMode === 'already_have') return 0;
    
    let total = selectedService.basePrice;
    if (selectionMode === 'partial') {
      total = selectedSubItems.reduce((acc, id) => {
        const sub = selectedService.subItems.find(s => s.id === id);
        return acc + (sub?.price || 0);
      }, 0);
    } else {
      total = selectedService.basePrice;
    }
    return total;
  }, [selectedService, selectionMode, selectedSubItems]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !selectedServiceId) return;

    const selectedClient = clients.find(c => c.id === selectedClientId);
    
    // Filter out values for hidden fields
    const finalRequirements = selectedService?.requirements
      .filter(req => isFieldVisible(req, requirementValues))
      .map(req => {
        const val = requirementValues[req.id];
        return {
          label: req.label,
          status: 'Pending' as const,
          textValue: req.type !== 'file' ? String(val || '') : undefined,
          fileUrl: req.type === 'file' ? (val || undefined) : undefined
        };
      }) || [];

    const taskData: Partial<WorkflowMainTask> = {
      title: `${selectedService?.name} for ${selectedClient?.name}`,
      serviceId: selectedServiceId,
      clientId: selectedClientId,
      clientName: selectedClient?.name || 'Unknown',
      userSelectionMode: selectionMode,
      selectedSubItemIds: selectionMode === 'already_have' ? [] : 
                          selectionMode === 'partial' ? selectedSubItems : 
                          selectedService?.subItems.map(s => s.id) || [],
      requirements: finalRequirements,
      deliverables: selectedService?.deliverables.map(del => ({
        label: del,
        status: 'Pending'
      })) || [],
      clientInstructions,
      employeeInstructions,
      status: 'Pending',
      deadline: deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      totalPrice,
      progress: 0,
      subTasks: selectedService?.subItems
        .filter(s => selectionMode === 'need' || selectedSubItems.includes(s.id))
        .map(s => ({
          id: Math.random().toString(36).substr(2, 9),
          name: s.name,
          description: `Action items for ${s.name}`,
          price: s.price,
          status: 'Pending',
          updatedAt: new Date().toISOString()
        })) || []
    };

    onSuccess(taskData);
  };

  const toggleSubItem = (id: string) => {
    setSelectedSubItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const updateRequirementValue = (id: string, value: any) => {
    setRequirementValues(prev => ({ ...prev, [id]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side: Service & Mode Selection */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Client</label>
            <select 
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
              value={selectedClientId || ''}
              onChange={e => setSelectedClientId(e.target.value)}
            >
              <option value="">Choose a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Item</label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(SERVICE_TEMPLATES).map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    setRequirementValues({}); // Clear values on service change
                  }}
                  className={cn(
                    "flex flex-col items-center p-4 rounded-2xl border transition-all text-center group",
                    selectedServiceId === service.id 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                      : "bg-white border-slate-100 text-slate-600 hover:border-indigo-200"
                  )}
                >
                  <Package size={24} className={cn("mb-2", selectedServiceId === service.id ? "text-white" : "text-indigo-600")} />
                  <span className="text-xs font-black uppercase tracking-tight">{service.name}</span>
                  <span className={cn("text-[10px] font-bold mt-1 opacity-60", selectedServiceId === service.id ? "text-white" : "text-slate-400")}>
                    From ${service.basePrice}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedService && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Service Status</p>
                <div className="flex gap-2">
                  {[
                    { id: 'need', label: 'Need Service', icon: Plus },
                    { id: 'already_have', label: 'Already Have', icon: Check },
                    { id: 'partial', label: 'Partial Service', icon: Settings }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setSelectionMode(mode.id as any)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-[10px] font-black uppercase transition-all border",
                        selectionMode === mode.id 
                          ? "bg-indigo-600 border-indigo-600 text-white" 
                          : "bg-white border-indigo-100 text-indigo-600 hover:bg-indigo-100"
                      )}
                    >
                      <mode.icon size={12} />
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectionMode !== 'already_have' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Sub-Tasks</label>
                  <div className="space-y-2">
                    {selectedService.subItems.map((sub) => (
                      <label 
                        key={sub.id} 
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                          (selectionMode === 'need' || selectedSubItems.includes(sub.id))
                            ? "bg-white border-indigo-200 shadow-sm"
                            : "bg-slate-50/50 border-slate-100 grayscale hover:grayscale-0"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            disabled={selectionMode === 'need'}
                            checked={selectionMode === 'need' || selectedSubItems.includes(sub.id)}
                            onChange={() => toggleSubItem(sub.id)}
                            className="w-4 h-4 rounded-md text-indigo-600 focus:ring-0 border-slate-300"
                          />
                          <span className="text-xs font-bold text-slate-700">{sub.name}</span>
                        </div>
                        <span className="text-xs font-black text-indigo-600">${sub.price}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Right Side: Dynamic Requirements & Deliverables */}
        <div className="space-y-6">
          {selectedService ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <FileText size={16} />
                  Requirement Flow Input
                </h4>
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {selectedService.requirements.map((field) => {
                      if (!isFieldVisible(field, requirementValues)) return null;

                      return (
                        <motion.div 
                          key={field.id}
                          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                          animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{field.label}</label>
                          {field.type === 'toggle' ? (
                            <div className="flex gap-2">
                               <button
                                type="button"
                                onClick={() => updateRequirementValue(field.id, true)}
                                className={cn(
                                  "flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all border",
                                  requirementValues[field.id] === true 
                                    ? "bg-amber-600 border-amber-600 text-white" 
                                    : "bg-white border-amber-200 text-amber-600 hover:bg-amber-50"
                                )}
                              >
                                Yes
                              </button>
                               <button
                                type="button"
                                onClick={() => updateRequirementValue(field.id, false)}
                                className={cn(
                                  "flex-1 py-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all border",
                                  requirementValues[field.id] === false 
                                    ? "bg-amber-600 border-amber-600 text-white" 
                                    : "bg-white border-amber-200 text-amber-600 hover:bg-amber-50"
                                )}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <input 
                              type={field.type === 'file' ? 'file' : field.type === 'number' ? 'number' : 'text'}
                              placeholder={field.placeholder}
                              className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-sm"
                              value={field.type === 'file' ? undefined : requirementValues[field.id] || ''}
                              onChange={e => updateRequirementValue(field.id, e.target.value)}
                            />
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>

              <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Package size={16} />
                  Flow Delivery Result
                </h4>
                <div className="space-y-2">
                  {selectedService.deliverables.map((del, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-bold text-emerald-900 border-b border-emerald-200/50 pb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {del}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                 <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deadline</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    value={deadline || ''}
                    onChange={e => setDeadline(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Special Notes for Client</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                    placeholder="Specific requests for the client..."
                    value={clientInstructions || ''}
                    onChange={e => setClientInstructions(e.target.value)}
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <AlertCircle size={48} className="text-slate-300 mb-4" />
              <p className="text-sm font-bold text-slate-400">Select a service to see requirements and deliverables</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer / Total Price */}
      <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Calculated Price</p>
            <h3 className="text-2xl font-black">${totalPrice}</h3>
          </div>
          {selectionMode === 'already_have' && (
            <p className="text-xs font-bold text-slate-400 max-w-[200px]">
              * Price is $0 because client already has this service. Tasks will be for setup/verification only.
            </p>
          )}
        </div>

        <button 
          type="submit"
          disabled={isSubmitting || !selectedClientId || !selectedServiceId}
          className="flex items-center gap-2 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Initialize Service Workflow
          <ChevronRight size={18} />
        </button>
      </div>
    </form>
  );
};
