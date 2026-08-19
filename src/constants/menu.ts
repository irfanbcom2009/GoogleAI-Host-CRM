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
  Activity,
  UserPlus,
  ShieldAlert,
  Bell,
  FileText,
  Search,
  History,
  Database
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
      { id: 'dynamic-service', label: 'Service Portal', icon: ShoppingCart, roles: ['Admin', 'Client'] },
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
      { id: 'domains', label: 'Domain Management', icon: Globe, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'domains' },
      { id: 'indexing', label: 'Indexing Agencies', icon: Building2, roles: ['Admin', 'Manager', 'Employee'], permission: 'indexingAgencies' },
      { id: 'hec', label: 'HEC Applications', icon: GraduationCap, roles: ['Admin', 'Manager', 'Employee'], permission: 'hecApplications' },
      { id: 'issn', label: 'ISSN Requests', icon: FileCheck, roles: ['Admin', 'Manager', 'Employee'], permission: 'issnRequests', recommendation: 'doi' },
      { id: 'doi', label: 'DOI Management', icon: Globe, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'doiManagement' },
    ]
  },
  {
    id: 'workflow-system',
    label: 'Workflow System',
    items: [
      { id: 'workflow-dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'tasks' },
      { id: 'workflow-orders', label: 'Orders & Tasks', icon: Briefcase, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'tasks' },
      { id: 'workflow-team', label: 'Team', icon: Users, roles: ['Admin', 'Manager'], permission: 'employees' },
      { id: 'workflow-logs', label: 'Activity Logs', icon: Activity, roles: ['Admin', 'Manager', 'Client'], permission: 'accessLogs' },
    ]
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { id: 'activity-history', label: 'Activity History', icon: History, roles: ['Admin', 'Manager'], permission: 'resources' },
      { id: 'resources', label: 'Resources', icon: FileText, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
      { id: 'chat', label: 'Live Chat', icon: MessageSquare, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
      { id: 'policies', label: 'Policies', icon: BookOpen, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
      { id: 'faq', label: 'FAQ', icon: HelpCircle, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'resources' },
      { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['Admin', 'Manager', 'Employee', 'Client'], permission: 'notifications' },
    ]
  }
];
