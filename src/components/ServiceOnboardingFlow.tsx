import React, { useState } from 'react';
import { ConditionalForm, FormField } from './ConditionalForm';
import { motion } from 'motion/react';
import { Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const ServiceOnboardingFlow: React.FC = () => {
  const [currentService, setCurrentService] = useState<'ISSN' | 'OJS' | 'DOI' | 'Indexing' | 'Hosting'>('ISSN');
  
  const fields: FormField[] = [
    {
      id: 'selectionType',
      label: 'Service Option',
      type: 'radio',
      options: ['Need This Service', 'Already Have This Service', 'Partial Service'],
      required: true,
      helpText: 'Choose how you want to proceed with this service.'
    },
    // "Already Have" fields
    {
      id: 'existingUrl',
      label: 'Current Service URL',
      type: 'text',
      placeholder: 'https://...',
      required: true,
      conditions: [{ fieldId: 'selectionType', operator: 'equals', value: 'Already Have This Service' }]
    },
    {
      id: 'credentials',
      label: 'Access Credentials (Username/Password)',
      type: 'textarea',
      placeholder: 'Enter login details for existing service...',
      conditions: [{ fieldId: 'selectionType', operator: 'equals', value: 'Already Have This Service' }]
    },
    // "Need This Service" fields (Full Lifecycle)
    {
      id: 'packageType',
      label: 'Select Package',
      type: 'select',
      options: ['Basic Setup', 'Professional Management', 'Enterprise Solution'],
      required: true,
      conditions: [{ fieldId: 'selectionType', operator: 'equals', value: 'Need This Service' }]
    },
    {
      id: 'workflowPriority',
      label: 'Urgency',
      type: 'radio',
      options: ['Standard (14-21 days)', 'Express (5-7 days)', 'Priority (Next day)'],
      conditions: [{ fieldId: 'selectionType', operator: 'equals', value: 'Need This Service' }]
    },
    // "Partial Service" fields
    {
      id: 'specificTasks',
      label: 'Select Specific Sub-tasks',
      type: 'select',
      options: ['Configuration Only', 'Training Session', 'Security Audit', 'Migration Support'],
      required: true,
      conditions: [{ fieldId: 'selectionType', operator: 'equals', value: 'Partial Service' }]
    },
    {
      id: 'customNotes',
      label: 'Custom Requirements',
      type: 'textarea',
      placeholder: 'Describe exactly what you need help with...',
      conditions: [{ fieldId: 'selectionType', operator: 'equals', value: 'Partial Service' }]
    }
  ];

  const handleSubmit = (data: any) => {
    console.log('Onboarding data:', data);
    toast.success('Service configuration saved!');
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Sparkles size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Service Onboarding</h2>
            <p className="text-slate-500 text-sm font-medium">Configure workflow & requirements for {currentService}</p>
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {(['ISSN', 'OJS', 'DOI', 'Indexing', 'Hosting'] as const).map(s => (
            <button
              key={s}
              onClick={() => setCurrentService(s)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                currentService === s 
                  ? "bg-slate-900 text-white shadow-md" 
                  : "bg-white text-slate-400 border border-slate-100 hover:border-indigo-200"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50">
        <ConditionalForm 
          fields={fields} 
          onSubmit={handleSubmit} 
          submitLabel={`Continue with ${currentService} Setup`}
        />
      </div>

      <div className="mt-8 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 flex items-start gap-4">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-indigo-100 text-indigo-600 shrink-0">
          <Shield size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-indigo-900">Pro-Active Validation</h4>
          <p className="text-xs text-indigo-700/70 mt-1 leading-relaxed">
            Our system dynamically adjusts requirements based on your selection. If you choose <b>"Need This Service"</b>, 
            a dedicated account manager will be assigned to handle the full workflow.
          </p>
        </div>
      </div>
    </div>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
