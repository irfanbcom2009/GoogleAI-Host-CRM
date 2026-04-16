import React from 'react';
import { Save, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FloatingActionBarProps {
  isVisible: boolean;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  isValid?: boolean;
  message?: string;
}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  isVisible,
  onSave,
  onCancel,
  isSaving = false,
  isValid = true,
  message = 'You have unsaved changes'
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
        >
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between gap-6 backdrop-blur-lg bg-opacity-90">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-sm font-bold tracking-tight">{message}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-all flex items-center gap-2"
              >
                <X size={18} />
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={isSaving || !isValid}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
