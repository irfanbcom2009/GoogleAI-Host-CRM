import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { ChevronRight, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface FormCondition {
  fieldId: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
  value: any;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'radio' | 'checkbox' | 'date' | 'file' | 'textarea';
  options?: string[];
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  conditions?: FormCondition[];
}

export interface ConditionalFormProps {
  fields: FormField[];
  onSubmit: (data: any) => void;
  initialData?: Record<string, any>;
  submitLabel?: string;
  isSubmitting?: boolean;
  error?: string | null;
}

export const ConditionalForm: React.FC<ConditionalFormProps> = ({ 
  fields, 
  onSubmit, 
  initialData = {}, 
  submitLabel = 'Submit',
  isSubmitting = false,
  error = null
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const checkCondition = (condition: FormCondition): boolean => {
    const value = formData[condition.fieldId];
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'notEquals':
        return value !== condition.value;
      case 'contains':
        return Array.isArray(value) && value.includes(condition.value);
      case 'greaterThan':
        return Number(value) > Number(condition.value);
      case 'lessThan':
        return Number(value) < Number(condition.value);
      default:
        return true;
    }
  };

  const isVisible = (field: FormField): boolean => {
    if (!field.conditions || field.conditions.length === 0) return true;
    return field.conditions.every(checkCondition);
  };

  const visibleFields = fields.filter(isVisible);

  const handleChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    // Clear error when user changes value
    if (errors[fieldId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate visible fields
    const newErrors: Record<string, string> = {};
    visibleFields.forEach(field => {
      if (field.required && !formData[field.id]) {
        newErrors[field.id] = `${field.label} is required`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Only submit data for visible fields
    const submissionData = visibleFields.reduce((acc, field) => {
      acc[field.id] = formData[field.id];
      return acc;
    }, {} as Record<string, any>);

    onSubmit(submissionData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {visibleFields.map((field) => (
            <motion.div
              layout
              key={field.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-2"
            >
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                {field.label}
                {field.required && <span className="text-rose-500">*</span>}
              </label>
              
              {field.type === 'text' && (
                <input
                  type="text"
                  placeholder={field.placeholder}
                  className={cn(
                    "w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none transition-all",
                    errors[field.id] ? "border-rose-300 ring-2 ring-rose-50 bg-rose-50" : "border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  )}
                  value={formData[field.id] || ''}
                  onChange={e => handleChange(field.id, e.target.value)}
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  placeholder={field.placeholder}
                  rows={4}
                  className={cn(
                    "w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none transition-all resize-none",
                    errors[field.id] ? "border-rose-300 ring-2 ring-rose-50 bg-rose-50" : "border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  )}
                  value={formData[field.id] || ''}
                  onChange={e => handleChange(field.id, e.target.value)}
                />
              )}

              {field.type === 'select' && (
                <select
                  className={cn(
                    "w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none transition-all",
                    errors[field.id] ? "border-rose-300 ring-2 ring-rose-50 bg-rose-50" : "border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  )}
                  value={formData[field.id] || ''}
                  onChange={e => handleChange(field.id, e.target.value)}
                >
                  <option value="">{field.placeholder || 'Select an option'}</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.type === 'radio' && (
                <div className="flex flex-wrap gap-4 pt-1">
                  {field.options?.map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        name={field.id}
                        value={opt || ''}
                        checked={formData[field.id] === opt}
                        onChange={() => handleChange(field.id, opt)}
                      />
                      <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'date' && (
                <input
                  type="date"
                  className={cn(
                    "w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none transition-all",
                    errors[field.id] ? "border-rose-300 ring-2 ring-rose-50 bg-rose-50" : "border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  )}
                  value={formData[field.id] || ''}
                  onChange={e => handleChange(field.id, e.target.value)}
                />
              )}

              {field.helpText && (
                <p className="text-[10px] text-slate-400 font-medium italic">{field.helpText}</p>
              )}

              {errors[field.id] && (
                <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors[field.id]}
                </p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 mb-4"
        >
          <AlertCircle size={18} className="shrink-0" />
          <p className="text-xs font-bold">{error}</p>
        </motion.div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSubmitting ? 'Processing...' : submitLabel}
        {!isSubmitting && <ArrowRight size={18} />}
      </button>
    </form>
  );
};
