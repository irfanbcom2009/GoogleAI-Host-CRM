import React, { useState, useEffect } from 'react';
import { HelpCircle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Policy } from '../types';
import { cn } from '../lib/utils';

interface HelpIconProps {
  policyTitle: string;
  className?: string;
}

export const HelpIcon: React.FC<HelpIconProps> = ({ policyTitle, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicy = async () => {
    if (policy || loading) return;
    
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'policies'), 
        where('title', '==', policyTitle),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setPolicy({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Policy);
      } else {
        setError("Policy not found.");
      }
    } catch (err) {
      console.error("Error fetching policy:", err);
      setError("Failed to load help content.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("inline-block relative ml-1", className)}>
      <button
        type="button"
        onMouseEnter={fetchPolicy}
        onClick={() => {
          fetchPolicy();
          setIsOpen(!isOpen);
        }}
        className="text-slate-400 hover:text-indigo-600 transition-colors"
      >
        <HelpCircle size={14} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[110]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-[120]"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Help & Policy</h4>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-rose-600">
                  <X size={14} />
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin text-indigo-600" size={20} />
                </div>
              ) : error ? (
                <p className="text-xs text-rose-500 font-medium">{error}</p>
              ) : policy ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-indigo-600">{policy.title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {policy.content}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No help content available for this section.</p>
              )}
              
              <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-slate-100 rotate-45" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
