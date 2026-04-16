import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ServiceType, RegistrationRequest } from '../types';
import { 
  Layers, 
  UserPlus, 
  X, 
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  Building2, 
  Phone, 
  Mail, 
  User as UserIcon,
  MessageSquare,
  LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';

interface RegistrationFlowProps {
  user: User;
  onClose: () => void;
}

const SERVICES: ServiceType[] = [
  'Hosting', 'DOI', 'ISSN', 'OJS', 'Editorial', 'Indexing', 'Plagiarism', 'Domain', 'Marketing'
];

export const RegistrationFlow: React.FC<RegistrationFlowProps> = ({ user, onClose }) => {
  const [step, setStep] = useState<'message' | 'form' | 'success'>('message');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user.displayName || '',
    organization: '',
    contactNumber: '',
    requiredServices: [] as ServiceType[],
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const request: Omit<RegistrationRequest, 'id'> = {
        name: formData.name,
        email: user.email || '',
        organization: formData.organization,
        contactNumber: formData.contactNumber,
        requiredServices: formData.requiredServices,
        notes: formData.notes,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'registration_requests'), request);
      
      // Also log activity
      await addDoc(collection(db, 'activity_logs'), {
        action: 'REGISTRATION_REQUEST_SUBMITTED',
        details: `Email: ${user.email}, Org: ${formData.organization}`,
        userName: formData.name,
        userId: user.uid,
        timestamp: serverTimestamp()
      });

      setStep('success');
    } catch (error) {
      console.error("Error submitting registration request:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (service: ServiceType) => {
    setFormData(prev => ({
      ...prev,
      requiredServices: prev.requiredServices.includes(service)
        ? prev.requiredServices.filter(s => s !== service)
        : [...prev.requiredServices, service]
    }));
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
      <AnimatePresence mode="wait">
        {step === 'message' && (
          <motion.div 
            key="message"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-10 text-center space-y-8"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/10">
                <X size={32} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Access Restricted</h1>
                <p className="text-slate-500 mt-2">Your account is not created in our system.</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setStep('form')}
                className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 group"
              >
                <UserPlus size={20} className="group-hover:scale-110 transition-transform" />
                Request Account Creation
              </button>
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-3 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
              >
                <LogOut size={20} />
                Close / Exit
              </button>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                Host A Journal Pvt Ltd
              </p>
            </div>
          </motion.div>
        )}

        {step === 'form' && (
          <motion.div 
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Registration Request</h3>
                  <p className="text-xs text-slate-500">Tell us about your organization</p>
                </div>
              </div>
              <button 
                onClick={() => setStep('message')}
                className="p-2 hover:bg-slate-200 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <UserIcon size={16} className="text-indigo-500" />
                    Full Name
                  </label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Mail size={16} className="text-indigo-500" />
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    disabled
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed"
                    value={user.email || ''}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-500" />
                    Organization / Journal Name
                  </label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                    placeholder="e.g. Global Research Journal"
                    value={formData.organization}
                    onChange={e => setFormData(prev => ({ ...prev, organization: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Phone size={16} className="text-indigo-500" />
                    Contact Number
                  </label>
                  <input 
                    type="tel" 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                    placeholder="+92 300 1234567"
                    value={formData.contactNumber}
                    onChange={e => setFormData(prev => ({ ...prev, contactNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700">Required Services</label>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map(service => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => toggleService(service)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                        formData.requiredServices.includes(service)
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200"
                          : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                      )}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <MessageSquare size={16} className="text-indigo-500" />
                  Additional Notes (Optional)
                </label>
                <textarea 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium min-h-[100px]"
                  placeholder="Tell us more about your requirements..."
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="pt-4 flex gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setStep('message')}
                  className="flex-1 px-6 py-4 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  Back
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                  Submit Request
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div 
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-10 text-center space-y-8"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Request Submitted!</h1>
                <p className="text-slate-500 mt-2">
                  Thank you for your interest. Our team will review your request and get back to you shortly.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                  <Mail size={16} />
                </div>
                <span className="text-slate-600 font-medium">{user.email}</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center pt-2">
                Status: Under Review
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              Close & Exit
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
