import React, { useState } from 'react';
import { 
  Plus, 
  User as UserIcon, 
  Globe, 
  Building2, 
  BookOpen, 
  FileText, 
  GraduationCap,
  DollarSign, 
  CreditCard,
  Layers,
  X,
  PlusCircle,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { UserPermissions, User } from '../types';
import { usePermissions } from '../hooks/usePermissions';

interface GlobalAddButtonProps {
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onAddClient?: () => void;
  onAddDomain?: () => void;
  onAddPublisher?: () => void;
  onAddJournal?: () => void;
  onAddISSN?: () => void;
  onAddExpense?: () => void;
  onAddIncome?: () => void;
  onAddInvoice?: () => void;
  onAddIndexing?: () => void;
}

export const GlobalAddButton: React.FC<GlobalAddButtonProps> = ({ 
  setActiveTab,
  currentUser,
  onAddClient,
  onAddDomain,
  onAddPublisher,
  onAddJournal,
  onAddISSN,
  onAddExpense,
  onAddIncome,
  onAddInvoice,
  onAddIndexing
}) => {
  const { check } = usePermissions(currentUser);
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { id: 'client', label: 'Add Client', icon: UserIcon, color: 'bg-indigo-500', tab: 'clients', permission: 'clients' },
    { id: 'domain', label: 'Add Domain', icon: Globe, color: 'bg-emerald-500', tab: 'domains', permission: 'domains' },
    { id: 'publisher', label: 'Add Publisher', icon: Building2, color: 'bg-amber-500', tab: 'publishers', permission: 'publishers' },
    { id: 'journal', label: 'Add Journal', icon: BookOpen, color: 'bg-rose-500', tab: 'journals', permission: 'journals' },
    { id: 'hec', label: 'Add HEC App', icon: GraduationCap, color: 'bg-indigo-500', tab: 'hec', permission: 'hecApplications' },
    { id: 'doaj', label: 'Add DOAJ App', icon: Globe, color: 'bg-blue-500', tab: 'doaj', permission: 'doajApplications' },
    { id: 'issn', label: 'Add ISSN Request', icon: FileText, color: 'bg-violet-500', tab: 'issn', permission: 'issnRequests' },
    { id: 'expense', label: 'Add Expense', icon: DollarSign, color: 'bg-red-500', tab: 'expenses', permission: 'expenses' },
    { id: 'income', label: 'Add Income', icon: DollarSign, color: 'bg-green-500', tab: 'expenses', permission: 'expenses' },
    { id: 'invoice', label: 'Add Invoice', icon: CreditCard, color: 'bg-sky-500', tab: 'invoices', permission: 'invoices' },
    { id: 'indexing', label: 'Add Indexing', icon: Layers, color: 'bg-orange-500', tab: 'indexing', permission: 'indexingAgencies' },
  ];

  const filteredActions = actions.filter(action => {
    if (action.permission) {
      return check(action.permission as any, 'add');
    }
    return true;
  });

  const handleAction = (action: typeof actions[0]) => {
    setActiveTab(action.tab);
    setIsOpen(false);
    // In a real app, we might trigger a specific modal here
    // For now, we just navigate to the tab
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[-1]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-20 right-0 w-72 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-4 space-y-2 overflow-hidden"
            >
              <div className="px-4 py-2 border-b border-slate-50 mb-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {filteredActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action)}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-all group text-left"
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg", action.color)}>
                      <action.icon size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{action.label}</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">New Entry</p>
                    </div>
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-400 transition-all" />
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-500 hover:scale-110 active:scale-95",
          isOpen ? "bg-slate-900 rotate-45" : "bg-indigo-600 shadow-indigo-500/40"
        )}
      >
        {isOpen ? <X size={32} /> : <Plus size={32} />}
      </button>
    </div>
  );
};
