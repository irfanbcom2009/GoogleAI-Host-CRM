import React, { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  TrendingUp,
  Search,
  Command,
  Users,
  CheckSquare,
  Settings as SettingsIcon,
  LayoutDashboard,
  History,
  AlertCircle,
  ChevronRight,
  Loader2,
  Mail,
  Smartphone,
  Shield,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { UserRole } from '../types';
import { db } from '../lib/firebase';
import { collection, query, getDocs, limit, or, where, orderBy, startAt, endAt } from 'firebase/firestore';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  onOpenShortcuts?: () => void;
  userRole: UserRole;
  showInfo?: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ 
  isOpen, 
  onClose, 
  setActiveTab,
  onOpenShortcuts,
  userRole,
  showInfo = false
}) => {
  const [query_str, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dataResults, setDataResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(showInfo);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setShowInfoPanel(showInfo);
    }
  }, [showInfo, isOpen]);

  const navigationItems = [
    { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, category: 'Navigation', roles: ['Admin', 'Manager', 'Employee', 'Client'] },
    { id: 'clients', label: 'View Clients', icon: Users, category: 'Navigation', roles: ['Admin', 'Manager', 'Employee'] },
    { id: 'journals', label: 'View Journals', icon: BookOpen, category: 'Navigation', roles: ['Admin', 'Manager', 'Employee', 'Client'] },
    { id: 'tasks', label: 'My Tasks', icon: CheckSquare, category: 'Navigation', roles: ['Admin', 'Manager', 'Employee', 'Client'] },
    { id: 'activity-history', label: 'View Activity Log', icon: History, category: 'Navigation', roles: ['Admin', 'Manager'] },
    { id: 'settings', label: 'User Settings', icon: SettingsIcon, category: 'Navigation', roles: ['Admin', 'Manager', 'Employee', 'Client'] },
  ].filter(item => item.roles.includes(userRole));

  const helpItems = [
    { id: 'shortcuts', label: 'View Keyboard Shortcuts', icon: Command, category: 'Help', roles: ['Admin', 'Manager', 'Employee', 'Client'] },
  ].filter(item => item.roles.includes(userRole));

  const actionItems = [
    { id: 'add-client', label: 'Add New Client', icon: Plus, category: 'Actions', roles: ['Admin', 'Manager'], tab: 'clients' },
    { id: 'add-task', label: 'Create New Task', icon: Plus, category: 'Actions', roles: ['Admin', 'Manager', 'Employee'], tab: 'tasks' },
    { id: 'performance', label: 'View Performance', icon: TrendingUp, category: 'Actions', roles: ['Admin', 'Manager', 'Employee'], tab: 'dashboard' },
  ].filter(item => item.roles.includes(userRole));

  const allItems = [...navigationItems, ...helpItems, ...actionItems];
  
  const filteredCommands = allItems.filter(item => 
    item.label.toLowerCase().includes(query_str.toLowerCase()) ||
    item.category.toLowerCase().includes(query_str.toLowerCase())
  );

  const filteredItems = [...filteredCommands, ...dataResults];

  useEffect(() => {
    if (!isOpen) return;
    if (query_str.length < 2) {
      setDataResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results: any[] = [];
        const q = query_str.toLowerCase();

        // 1. Search Users (Employees & Clients)
        const usersRef = collection(db, 'users');
        const userSnap = await getDocs(query(usersRef, limit(20)));
        userSnap.docs.forEach(doc => {
          const data = doc.data();
          if (
            data.name?.toLowerCase().includes(q) || 
            data.email?.toLowerCase().includes(q) ||
            data.employeeId?.toLowerCase().includes(q)
          ) {
            results.push({
              id: doc.id,
              label: data.name,
              subLabel: data.email,
              icon: data.role === 'Client' ? Users : Shield,
              category: data.role === 'Client' ? 'Clients' : 'Employees',
              tab: data.role === 'Client' ? 'clients' : 'employees',
              data: data
            });
          }
        });

        // 2. Search Journals
        const journalsRef = collection(db, 'journals');
        const journalSnap = await getDocs(query(journalsRef, limit(20)));
        journalSnap.docs.forEach(doc => {
          const data = doc.data();
          if (
            data.title?.toLowerCase().includes(q) || 
            data.issnPrint?.toLowerCase().includes(q) ||
            data.issnOnline?.toLowerCase().includes(q) ||
            data.editorEmail?.toLowerCase().includes(q)
          ) {
            results.push({
              id: doc.id,
              label: data.title,
              subLabel: `ISSN: ${data.issnPrint || 'N/A'} | ${data.issnOnline || 'N/A'}`,
              icon: BookOpen,
              category: 'Journals',
              tab: 'journals',
              data: data
            });
          }
        });

        // 3. Search Domains
        const domainsRef = collection(db, 'domains');
        const domainSnap = await getDocs(query(domainsRef, limit(20)));
        domainSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.domainName?.toLowerCase().includes(q)) {
            results.push({
              id: doc.id,
              label: data.domainName,
              subLabel: `Registrar: ${data.registrar || 'N/A'}`,
              icon: Globe,
              category: 'Domains',
              tab: 'domains',
              data: data
            });
          }
        });

        // 4. Search ISSN Requests/Logins
        const issnRef = collection(db, 'issn_requests');
        const issnSnap = await getDocs(query(issnRef, limit(20)));
        issnSnap.docs.forEach(doc => {
          const data = doc.data();
          if (
            data.journalTitle?.toLowerCase().includes(q) || 
            data.issnLogin?.toLowerCase().includes(q) ||
            data.issn?.toLowerCase().includes(q) ||
            data.requestNo?.toLowerCase().includes(q)
          ) {
            results.push({
              id: doc.id,
              label: data.journalTitle || 'ISSN Request',
              subLabel: `Login: ${data.issnLogin || 'N/A'} | Req: ${data.requestNo}`,
              icon: Key,
              category: 'ISSN Logins',
              tab: 'issn',
              data: data
            });
          }
        });

        setDataResults(results.slice(0, 15));
      } catch (error) {
        console.error("Global search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query_str, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setDataResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  const handleSelect = (item: any) => {
    if (item.id === 'shortcuts') {
      onOpenShortcuts?.();
      onClose();
      return;
    }
    if (item.tab) {
      setActiveTab(item.tab);
    } else {
      setActiveTab(item.id);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-start justify-center pt-24 px-4 sm:pt-40">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="flex items-center px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              {isSearching ? (
                <Loader2 className="text-indigo-600 animate-spin mr-3" size={24} />
              ) : (
                <Search className="text-slate-400 dark:text-slate-500 mr-3" size={24} />
              )}
              <input
                ref={inputRef}
                type="text"
                placeholder="Search anything: 'John', 'Journal of...', 'ISSN-123', 'example.com'..."
                className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-bold text-lg py-1"
                value={query_str || ''}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
              />
              <div className="flex items-center gap-2 ml-4">
                <button
                  type="button"
                  onClick={() => setShowInfoPanel(!showInfoPanel)}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors cursor-pointer text-xs font-bold flex items-center gap-1 shrink-0",
                    showInfoPanel 
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30" 
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  )}
                  title="Toggle Search Information Guide"
                >
                  <AlertCircle size={16} />
                  <span className="hidden sm:inline">Guide</span>
                </button>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-700">ESC</kbd>
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto p-4 md:p-6">
              {query_str === '' ? (
                showInfoPanel ? (
                  <div className="space-y-6 py-2">
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-indigo-900/10 rounded-2xl p-5 border border-indigo-100/40 dark:border-indigo-900/30">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                        <Search className="text-indigo-600 dark:text-indigo-400" size={16} />
                        Universal Search Information Guide
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        This CRM utilizes a live-indexed search engine. Type at least 2 characters in the input field above to instantly search across all modules.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Users size={14} />
                          </div>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">Employees & Clients</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">Search by name, email address, or specific Employee ID.</p>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <BookOpen size={14} />
                          </div>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">Journals Database</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">Search by full title, print ISSN, online ISSN, or editor email.</p>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Globe size={14} />
                          </div>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">Domains & Servers</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">Search by registered domain name or registrar name.</p>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5 hover:border-indigo-100 dark:hover:border-indigo-950 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Key size={14} />
                          </div>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">ISSN Requests</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">Search by request number, journal title, or assigned login.</p>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-2" />

                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-100/50 dark:border-slate-850">
                      <span className="font-bold flex items-center gap-1.5">
                        <Command size={12} />
                        Tip: Keyboard Shortcuts
                      </span>
                      <span>Press <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded font-mono font-bold">ALT + D</kbd> to jump to Dashboard instantly</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2">
                      <span>Quick Navigation & Actions</span>
                      <button 
                        onClick={() => setShowInfoPanel(true)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 normal-case font-semibold cursor-pointer"
                      >
                        <AlertCircle size={12} />
                        Show Guide
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {allItems.map((item, idx) => {
                        const isSelected = idx === selectedIndex;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              const anyItem = item as any;
                              if (anyItem.tab) setActiveTab(anyItem.tab);
                              else if (item.id === 'shortcuts' && onOpenShortcuts) onOpenShortcuts();
                              else setActiveTab(item.id);
                              onClose();
                            }}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left border cursor-pointer",
                              isSelected
                                ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                            )}
                          >
                            <item.icon size={18} className={isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold">{item.label}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{item.category}</p>
                            </div>
                            <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : filteredItems.length > 0 ? (
                <div className="space-y-6">
                  {['Navigation', 'Actions', 'Help', 'Employees', 'Clients', 'Journals', 'Domains', 'ISSN Logins'].map(category => {
                    const categoryItems = filteredItems.filter(i => i.category === category);
                    if (categoryItems.length === 0) return null;
                    
                    return (
                      <div key={category} className="space-y-2">
                        <div className="px-4 py-1 flex items-center justify-between">
                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{category}</p>
                          <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">{categoryItems.length} results</span>
                        </div>
                        {categoryItems.map((item, idx) => {
                          const globalIdx = filteredItems.indexOf(item);
                          const isSelected = globalIdx === selectedIndex;
                          
                          return (
                            <button
                              key={`${item.category}-${item.id}`}
                              onMouseEnter={() => setSelectedIndex(globalIdx)}
                              onClick={() => handleSelect(item)}
                              className={cn(
                                "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group text-left border border-transparent",
                                isSelected 
                                  ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 border-indigo-500" 
                                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-100 dark:hover:border-slate-700"
                              )}
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={cn(
                                  "w-11 h-11 rounded-xl flex items-center justify-center transition-all",
                                  isSelected ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 shadow-sm"
                                )}>
                                  <item.icon size={22} className={isSelected ? "text-white" : "text-indigo-600"} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm tracking-tight truncate">{item.label}</p>
                                  {item.subLabel && (
                                    <p className={cn(
                                      "text-[10px] font-medium transition-colors truncate mt-0.5",
                                      isSelected ? "text-indigo-100/70" : "text-slate-400"
                                    )}>{item.subLabel}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {isSelected && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                    Open
                                    <ArrowRight size={12} />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full">
                    <AlertCircle size={32} strokeWidth={1.5} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-200">No results found</p>
                    <p className="text-xs">Try searching for different keywords</p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">↑↓</span>
                  Navigate
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">Enter</span>
                  Select
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                <Command size={14} />
                Command Palette
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
