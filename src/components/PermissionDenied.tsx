import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface PermissionDeniedProps {
  message?: string;
  onBack?: () => void;
}

export const PermissionDenied: React.FC<PermissionDeniedProps> = ({ 
  message = "You don't have permission to access this module. Please contact your administrator.",
  onBack 
}) => {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-6"
      >
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert size={40} className="text-rose-500" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Access Denied</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            {message}
          </p>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Go Back
          </button>
        )}
      </motion.div>
    </div>
  );
};
