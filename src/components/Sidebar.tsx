import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Menu, 
  X, 
  ChevronLeft,
  Settings,
  LogOut,
  Shield,
  Sparkles,
  Layers,
  Sun,
  Moon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserRole, UserPermissions } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { MENU_CONFIG, MenuItem, MenuGroup } from '../constants/menu';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: UserRole;
  userPermissions?: UserPermissions;
  userEmail?: string;
  userPhotoURL?: string;
  userDepartment?: string;
  userSubscriptions?: any[];
  onLogout?: () => void;
  isImpersonating?: boolean;
  onStopImpersonating?: () => void;
  pendingApprovalsCount?: number;
  branding?: {
    name: string;
    logoUrl?: string;
    primaryColor?: string;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  userRole = 'Employee', 
  userPermissions,
  userEmail,
  userPhotoURL,
  userDepartment,
  userSubscriptions,
  onLogout,
  isImpersonating,
  onStopImpersonating,
  pendingApprovalsCount = 0,
  branding = { name: 'Host A Journal' }
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Listen to custom window events for mobile navigation
  useEffect(() => {
    const handleToggle = () => setIsMobileOpen(prev => !prev);
    const handleOpen = () => setIsMobileOpen(true);
    const handleClose = () => setIsMobileOpen(false);

    window.addEventListener('toggle-mobile-sidebar', handleToggle);
    window.addEventListener('open-mobile-sidebar', handleOpen);
    window.addEventListener('close-mobile-sidebar', handleClose);

    return () => {
      window.removeEventListener('toggle-mobile-sidebar', handleToggle);
      window.removeEventListener('open-mobile-sidebar', handleOpen);
      window.removeEventListener('close-mobile-sidebar', handleClose);
    };
  }, []);

  // Auto-expand group containing active tab
  useEffect(() => {
    const activeGroup = MENU_CONFIG.find(group => 
      group.items.some(item => item.id === activeTab)
    );
    if (activeGroup && !expandedGroups.includes(activeGroup.id)) {
      setExpandedGroups(prev => [...prev, activeGroup.id]);
    }
  }, [activeTab]);

  const toggleGroup = (groupId: string) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setExpandedGroups([groupId]);
      return;
    }
    setExpandedGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const filteredMenu = useMemo(() => {
    const ayeshaEmails = ['ayeshatariq88991@gmail.com', 'ayeshatariq8836@gmail.com'];
    const isAyesha = userEmail && ayeshaEmails.includes(userEmail);

    return MENU_CONFIG.map(group => ({
      ...group,
      items: group.items.filter(item => {
        // Role check - Bypass for Ayesha on specific tabs
        if (!item.roles.includes(userRole) && !(isAyesha && ['employees', 'activity-history'].includes(item.id))) return false;
        
        // Active Subscriptions check for Client users
        if (userRole === 'Client') {
          const activeSubs = (userSubscriptions || []).filter(
            (sub: any) => sub.status === 'active'
          );
          const activeServices = activeSubs.map((sub: any) => sub.service);

          if (item.id === 'domains') {
            const hasSub = activeServices.some((s: string) => 
              ['Domain', 'Domain (External)', 'Hosting', 'Hosting (External)'].includes(s)
            );
            if (!hasSub) return false;
          }
          if (item.id === 'journals') {
            const hasSub = activeServices.some((s: string) => 
              ['OJS', 'Publisher', 'Editorial Setup', 'Journal Evaluation'].includes(s)
            );
            if (!hasSub) return false;
          }
          if (item.id === 'doi') {
            const hasSub = activeServices.some((s: string) => s === 'DOI');
            if (!hasSub) return false;
          }
          if (['workflow-dashboard', 'workflow-orders', 'workflow-logs'].includes(item.id)) {
            if (activeServices.length === 0) return false;
          }
        }

        // Permission check
        if (item.permission && userRole !== 'Admin') {
          // Bypass for Ayesha on specific tabs
          const isAyeshaBypass = isAyesha && ['employees', 'activity-history'].includes(item.id);
          if (!isAyeshaBypass) {
            const modulePerms = userPermissions ? (userPermissions as any)[item.permission] : null;
            if (!modulePerms || typeof modulePerms !== 'object' || modulePerms.view !== true) {
              return false;
            }
          }
        }

        // Department check
        if (item.department && userRole !== 'Admin' && userDepartment !== item.department) return false;

        // Search check
        if (searchQuery && !item.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;

        return true;
      })
    })).filter(group => group.items.length > 0);
  }, [userRole, userPermissions, userDepartment, searchQuery, userSubscriptions]);

  const renderMenuItem = (item: MenuItem) => {
    const isActive = activeTab === item.id;
    const badge = item.id === 'approvals' ? pendingApprovalsCount : item.badge;

    const isRecommended = MENU_CONFIG.some(group => 
      group.items.some(i => i.id === activeTab && i.recommendation === item.id)
    );

    return (
      <button
        key={item.id}
        onClick={() => {
          setActiveTab(item.id);
          if (isMobileOpen) setIsMobileOpen(false);
        }}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group relative",
          isActive 
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
          isCollapsed && "justify-center px-0"
        )}
        title={isCollapsed ? item.label : undefined}
      >
        <item.icon size={18} className={cn(
          "shrink-0 transition-colors",
          isActive ? "text-white" : "group-hover:text-indigo-400"
        )} />
        
        {!isCollapsed && (
          <>
            <span className="font-medium text-xs truncate">{item.label}</span>
            {badge && badge > 0 ? (
              <span className="ml-auto px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
                {badge}
              </span>
            ) : isRecommended ? (
              <Sparkles size={12} className="ml-auto text-amber-400 animate-pulse" />
            ) : null}
          </>
        )}

        {isActive && !isCollapsed && (
          <motion.div 
            layoutId="activeTabIndicator"
            className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
          />
        )}
      </button>
    );
  };

  const sidebarContent = (
    <div className={cn(
      "bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800 transition-all duration-300 relative",
      isCollapsed ? "w-20" : "w-64"
    )}>
      {/* Header */}
      <div className={cn("p-6", isCollapsed && "px-4 text-center")}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0 overflow-hidden">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} className="w-full h-full object-contain p-1" alt="" />
            ) : (
              <Layers className="text-white" size={24} />
            )}
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate">{branding.name}</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">CRM System</p>
            </div>
          )}
        </div>
      </div>

      {/* Search - Icon only or compact button */}
      <div className="px-4 mb-4 flex justify-center shrink-0 select-none">
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-command-palette'));
          }}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 cursor-pointer border border-transparent hover:border-slate-800/80 w-full",
            isCollapsed && "w-10 h-10 justify-center p-0"
          )}
          title="Search CRM System (⌘ K)"
        >
          <Search size={16} className="text-indigo-400 shrink-0" />
          {!isCollapsed && <span className="font-semibold text-xs tracking-tight">Search System...</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto pb-8 scrollbar-hide">
        {filteredMenu.map((group) => {
          const isExpanded = expandedGroups.includes(group.id);

          return (
            <div key={group.id} className="space-y-1">
              {!isCollapsed ? (
                <button 
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors group"
                >
                  <span className="group-hover:translate-x-1 transition-transform">{group.label}</span>
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              ) : (
                <div className="h-px bg-slate-800 my-4 mx-2" />
              )}
              
              <AnimatePresence initial={false}>
                {(isExpanded || isCollapsed) && (
                  <motion.div 
                    initial={isCollapsed ? { opacity: 1 } : { height: 0, opacity: 0 }}
                    animate={isCollapsed ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                    exit={isCollapsed ? { opacity: 1 } : { height: 0, opacity: 0 }}
                    className="space-y-1 overflow-hidden"
                  >
                    {group.items.map(renderMenuItem)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn("p-4 border-t border-slate-800 space-y-1", isCollapsed && "px-2")}>
        {!isCollapsed && userEmail && (
          <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden border border-slate-700">
              {userPhotoURL ? (
                <img src={userPhotoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                userEmail.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{userRole}</p>
              <p className="text-xs font-medium text-slate-200 truncate">{userEmail}</p>
            </div>
          </div>
        )}

        {isImpersonating && (
          <button 
            onClick={onStopImpersonating}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-all mb-2",
              isCollapsed && "justify-center px-0"
            )}
            title={isCollapsed ? "Stop Impersonation" : undefined}
          >
            <Shield size={18} className="shrink-0" />
            {!isCollapsed && <span className="font-medium text-xs">Stop Impersonation</span>}
          </button>
        )}
        
        <button 
          onClick={() => {
            window.dispatchEvent(new CustomEvent('toggle-global-theme'));
          }}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 hover:text-white transition-all text-slate-400 group cursor-pointer",
            isCollapsed && "justify-center px-0"
          )}
          title={isCollapsed ? "Switch Theme" : undefined}
        >
          <Sun size={18} className="shrink-0 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
          {!isCollapsed && (
            <span className="font-medium text-xs truncate">
              Toggle Light / Dark
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-slate-400 group",
            activeTab === 'settings' ? "bg-slate-800 text-white" : "hover:bg-slate-800 hover:text-white",
            isCollapsed && "justify-center px-0"
          )}
          title={isCollapsed ? "Settings" : undefined}
        >
          <Settings size={18} className={cn("shrink-0 transition-colors", activeTab === 'settings' ? "text-white" : "group-hover:text-indigo-400")} />
          {!isCollapsed && (
            <span className="font-medium text-xs truncate">
              {(userRole === 'Admin' || userRole === 'Manager') ? 'Admin & Settings' : 'Settings'}
            </span>
          )}
        </button>

        <button 
          onClick={onLogout}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-900/20 hover:text-red-400 transition-all text-slate-400 group",
            isCollapsed && "justify-center px-0"
          )}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut size={18} className="shrink-0 group-hover:text-red-400" />
          {!isCollapsed && <span className="font-medium text-xs">Logout</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-all z-50 hidden md:flex"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-[100]">
        <button 
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800"
        >
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[90] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-[95] transition-transform duration-300 md:relative md:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {sidebarContent}
      </div>
    </>
  );
};
