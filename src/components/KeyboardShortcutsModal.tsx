import React from 'react';
import { 
  Command, 
  X, 
  Keyboard,
  ArrowRight,
  Search,
  Plus,
  LayoutDashboard,
  Users,
  BookOpen,
  CheckSquare,
  CreditCard,
  Settings,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const shortcutGroups = [
    {
      title: 'Global Actions',
      shortcuts: [
        { keys: ['⌘', 'K'], label: 'Open Command Palette', icon: Command },
        { keys: ['?'], label: 'Show Keyboard Shortcuts', icon: Keyboard },
        { keys: ['Esc'], label: 'Close Modal / Cancel', icon: X },
        { keys: ['Alt', 'N'], label: 'Quick Add Menu', icon: Plus },
        { keys: ['/'], label: 'Focus Search', icon: Search },
      ]
    },
    {
      title: 'Navigation',
      shortcuts: [
        { keys: ['Alt', 'D'], label: 'Go to Dashboard', icon: LayoutDashboard },
        { keys: ['Alt', 'C'], label: 'Go to Clients', icon: Users },
        { keys: ['Alt', 'J'], label: 'Go to Journals', icon: BookOpen },
        { keys: ['Alt', 'T'], label: 'Go to Tasks', icon: CheckSquare },
        { keys: ['Alt', 'I'], label: 'Go to Invoices', icon: CreditCard },
        { keys: ['Alt', 'S'], label: 'Go to Settings', icon: Settings },
      ]
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Keyboard size={24} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">Keyboard Shortcuts</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Master your CRM workflow</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {shortcutGroups.map((group) => (
                <div key={group.title} className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{group.title}</h4>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut) => (
                      <div 
                        key={shortcut.label}
                        className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <shortcut.icon size={16} />
                          </div>
                          <span className="text-sm font-bold text-slate-700">{shortcut.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, i) => (
                            <React.Fragment key={key}>
                              <kbd className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-900 shadow-sm min-w-[24px] text-center">
                                {key}
                              </kbd>
                              {i < shortcut.keys.length - 1 && <span className="text-slate-300 text-[10px] font-bold">+</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <HelpCircle size={14} />
                Need more help?
              </div>
              <button 
                onClick={onClose}
                className="text-xs font-black text-indigo-600 hover:text-indigo-700 transition-all flex items-center gap-1"
              >
                Got it <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
