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
  Settings, 
  Layers,
  Building2,
  GraduationCap,
  CreditCard,
  Trash2,
  HelpCircle,
  MessageSquare,
  TrendingDown,
  Layout,
  ShoppingCart,
  UserPlus,
  ShieldAlert,
  Bell,
  FileText,
  Search,
  History
} from 'lucide-react';
import { UserRole, UserPermissions } from '../types';

export interface MenuItem {
  id: string;
  label: string;
  icon: any;
  roles: UserRole[];
  permission?: keyof UserPermissions;
  department?: string;
  badge?: number;
  recommendation?: string;
}

export interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

export const MENU_CONFIG: MenuGroup[] = [
  {
    id: 'core',
    label: 'Core Management',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Manager', 'Employee', 'Client'] },
      { id: 'approvals', label: 'Approval Requests', icon: FileCheck, roles: ['Admin', 'Manager', 'Employee'], permission: 'approvalRequests' },
      { id: 'leaderboard', label: 'Performance Rank', icon: Trophy, roles: ['Admin', 'Manager', 'Employee'] },
      { id: 'clients', label: 'Clients', icon: Users, roles: ['Admin', 'Manager', 'Employee'], permission: 'clients' },
      { id: 'employees', label: 'Employees', icon: Users, roles: ['Admin', 'Manager', 'Employee'], permission: 'employees' },
    ]
  },
  {
    id: 'publishing',
    label: 'Publishing & Journals',
    items: [
      { id: 'publishers', label: 'Publishers', icon: Building2, roles: ['Admin', 'Manager', 'Employee'], permission: 'publishers' },
      { id: 'journals', label: 'Journals', icon: BookOpen, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'journals' },
      { id: 'indexing', label: 'Indexing Agencies', icon: Building2, roles: ['Admin', 'Manager', 'Employee'], permission: 'indexingAgencies' },
      { id: 'hec', label: 'HEC Applications', icon: GraduationCap, roles: ['Admin', 'Manager', 'Employee'], permission: 'hecApplications' },
      { id: 'issn', label: 'ISSN Requests', icon: FileCheck, roles: ['Admin', 'Manager', 'Employee'], permission: 'issnRequests', recommendation: 'doi' },
      { id: 'doi', label: 'DOI Management', icon: Globe, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'doiManagement' },
    ]
  },
  {
    id: 'operations',
    label: 'Operations Hub',
    items: [
      { id: 'catalog', label: 'Service Catalog', icon: Layout, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'serviceCatalog' },
      { id: 'orders', label: 'Service Orders', icon: ShoppingCart, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'clients' },
      { id: 'tasks', label: 'Tasks & Workflow', icon: Briefcase, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'tasks' },
      { id: 'points', label: 'Points & Rewards', icon: Trophy, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'clients' },
    ]
  },
  {
    id: 'data',
    label: 'Data Tools',
    items: [
      { id: 'domains', label: 'Domains', icon: Globe, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'domains' },
      { id: 'files', label: 'File Manager', icon: Layers, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
    ]
  },
  {
    id: 'finance',
    label: 'Financials',
    items: [
      { id: 'finance-dashboard', label: 'Finance Hub', icon: DollarSign, roles: ['Admin', 'Manager', 'Employee'], department: 'Finance', permission: 'invoices' },
      { id: 'invoices', label: 'Invoices', icon: CreditCard, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'invoices' },
      { id: 'expenses', label: 'Expenses', icon: TrendingDown, roles: ['Admin', 'Manager', 'Employee'], permission: 'expenses' },
    ]
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { id: 'catalog-manager', label: 'Catalog Manager', icon: Layers, roles: ['Admin', 'Manager'], permission: 'serviceCatalog' },
      { id: 'activity-history', label: 'Activity History', icon: History, roles: ['Admin', 'Manager'], permission: 'resources' },
      { id: 'resources', label: 'Resources', icon: FileText, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
      { id: 'chat', label: 'Live Chat', icon: MessageSquare, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
      { id: 'policies', label: 'Policies', icon: BookOpen, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
      { id: 'faq', label: 'FAQ', icon: HelpCircle, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
      { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'notifications' },
    ]
  }
];
