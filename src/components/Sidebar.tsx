import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Globe, 
  BookOpen, 
  FileCheck, 
  Briefcase, 
  Trophy, 
  DollarSign,
  Shield,
  UserCog, 
  Bell, 
  Settings, 
  LogOut,
  Layers,
  Building2,
  GraduationCap,
  CreditCard,
  Trash2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  TrendingDown,
  Layout,
  ShoppingCart
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserRole, UserPermissions } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: UserRole;
  userPermissions?: UserPermissions;
  userDepartment?: string;
  onLogout?: () => void;
  isImpersonating?: boolean;
  onStopImpersonating?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  userRole = 'Employee', 
  userPermissions,
  userDepartment,
  onLogout,
  isImpersonating,
  onStopImpersonating
}) => {
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>(['core', 'publishing', 'operations', 'data', 'finance', 'other']);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const menuGroups = [
    {
      id: 'core',
      label: 'Core Management',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
        { id: 'approvals', label: 'Approval Requests', icon: FileCheck, roles: ['Admin', 'Manager', 'Employee'], permission: 'approvalRequests' },
        { id: 'clients', label: 'Clients', icon: Users, roles: ['Admin', 'Manager', 'Employee'] },
        { id: 'employees', label: 'Employees', icon: Users, roles: ['Admin', 'Manager'] },
      ]
    },
    {
      id: 'publishing',
      label: 'Publishing & Journals',
      items: [
        { id: 'journals', label: 'Journals', icon: BookOpen, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'journals' },
        { id: 'indexing', label: 'Indexing Agencies', icon: Building2, roles: ['Admin', 'Manager', 'Employee'], permission: 'indexingAgencies' },
        { id: 'publishers', label: 'Publishers', icon: Building2, roles: ['Admin', 'Manager', 'Employee'], permission: 'publishers' },
        { id: 'hec', label: 'HEC Applications', icon: GraduationCap, roles: ['Admin', 'Manager', 'Employee'], permission: 'hecApplications' },
        { id: 'issn', label: 'ISSN Requests', icon: FileCheck, roles: ['Admin', 'Manager', 'Employee'], permission: 'issnRequests' },
        { id: 'doi', label: 'DOI Management', icon: Globe, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'doiManagement' },
      ]
    },
    {
      id: 'operations',
      label: 'Operations Hub',
      items: [
        { id: 'catalog', label: 'Service Catalog', icon: Layout, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
        { id: 'orders', label: 'Service Orders', icon: ShoppingCart, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
        { id: 'tasks', label: 'Tasks & Workflow', icon: Briefcase, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
        { id: 'points', label: 'Points & Rewards', icon: Trophy, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
      ]
    },
    {
      id: 'data',
      label: 'Data Tools',
      items: [
        { id: 'domains', label: 'Domains', icon: Globe, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'dataTools' },
        { id: 'files', label: 'File Manager', icon: Layers, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'dataTools' },
      ]
    },
    {
      id: 'finance',
      label: 'Financials',
      items: [
        { id: 'finance-dashboard', label: 'Finance Hub', icon: DollarSign, roles: ['Admin', 'Manager', 'Employee'], department: 'Finance' },
        { id: 'invoices', label: 'Invoices', icon: CreditCard, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'invoices' },
        { id: 'expenses', label: 'Expenses', icon: TrendingDown, roles: ['Admin', 'Manager', 'Employee'], permission: 'expenses' },
      ]
    },
    {
      id: 'admin',
      label: 'Administration',
      items: [
        { id: 'catalog-manager', label: 'Catalog Settings', icon: Settings, roles: ['Admin', 'Manager'] },
        { id: 'employees', label: 'Employee Directory', icon: Users, roles: ['Admin', 'Manager'] },
        { id: 'trash', label: 'Trash Bin', icon: Trash2, roles: ['Admin', 'Manager'], permission: 'trash' },
      ]
    },
    {
      id: 'other',
      label: 'Resources',
      items: [
        { id: 'chat', label: 'Live Chat', icon: MessageSquare, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
        { id: 'policies', label: 'Policies', icon: BookOpen, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
        { id: 'faq', label: 'FAQ', icon: HelpCircle, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
        { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'notifications' },
      ]
    }
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800 shrink-0">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="text-indigo-500" />
          Host A Journal
        </h1>
        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">CRM System</p>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto pb-8 scrollbar-hide">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter(item => {
            const hasRole = item.roles.includes(userRole);
            if (!hasRole) return false;
            
            // If item has a permission requirement, check it
            if (item.permission && userPermissions) {
              if (userPermissions[item.permission as keyof UserPermissions] === false) return false;
            }

            // If item has a department requirement, check it
            if ((item as any).department && userRole !== 'Admin') {
              if (userDepartment !== (item as any).department) return false;
            }
            
            return true;
          });
          if (visibleItems.length === 0) return null;

          const isExpanded = expandedGroups.includes(group.id);

          return (
            <div key={group.id} className="space-y-1">
              <button 
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors group"
              >
                <span className="group-hover:translate-x-1 transition-transform">{group.label}</span>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-1 overflow-hidden"
                  >
                    {visibleItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group relative",
                          activeTab === item.id 
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                        )}
                      >
                        <item.icon size={18} className={cn(
                          "transition-colors",
                          activeTab === item.id ? "text-white" : "group-hover:text-indigo-400"
                        )} />
                        <span className="font-medium text-xs">{item.label}</span>
                        {activeTab === item.id && (
                          <motion.div 
                            layoutId="activeTab"
                            className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
                          />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-1">
        {isImpersonating && (
          <button 
            onClick={onStopImpersonating}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-all mb-2"
          >
            <Shield size={18} />
            <span className="font-medium text-sm">Stop Impersonation</span>
          </button>
        )}
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-slate-400",
            activeTab === 'settings' ? "bg-slate-800 text-white" : "hover:bg-slate-800 hover:text-white"
          )}
        >
          <Settings size={18} />
          <span className="font-medium text-sm">
            {(userRole === 'Admin' || userRole === 'Manager') ? 'Admin & Settings' : 'Settings'}
          </span>
        </button>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-red-900/20 hover:text-red-400 transition-all text-slate-400"
        >
          <LogOut size={18} />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
    </div>
  );
};
