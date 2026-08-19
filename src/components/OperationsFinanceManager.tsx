import React, { useState } from 'react';
import { 
  DollarSign, 
  ShoppingCart, 
  Briefcase, 
  Trophy, 
  CreditCard, 
  TrendingDown, 
  Layout,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Activity,
  Calendar,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User } from '../types';
import { FinanceDashboard } from './FinanceDashboard';
import { ServiceCatalog } from './ServiceCatalog';
import { ServiceOrderSystem } from './ServiceOrderSystem';
import { Tasks } from './Tasks';
import { PayrollManager } from './PayrollManager';
import { Expenses } from './Expenses';
import { Points } from './Points';
import { PaymentTaskLedger } from './PaymentTaskLedger';
import { motion, AnimatePresence } from 'motion/react';

interface OperationsFinanceManagerProps {
  currentUser: User;
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}

export const OperationsFinanceManager: React.FC<OperationsFinanceManagerProps> = ({ 
  currentUser,
  activeSection: externalActiveSection,
  onSectionChange
}) => {
  const [internalActiveSection, setInternalActiveSection] = useState('hub');
  const activeSection = externalActiveSection || internalActiveSection;

  const setActiveSection = (section: string) => {
    if (onSectionChange) {
      onSectionChange(section);
    } else {
      setInternalActiveSection(section);
    }
  };

  const sections = [
    { id: 'hub', label: 'Finance Hub', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'catalog', label: 'Service Catalog', icon: Layout, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { id: 'orders', label: 'Order Management', icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'tasks', label: 'Tasks & Workflow', icon: Briefcase, color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'invoices', label: 'Payments & Task Ledger', icon: CreditCard, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'payroll', label: 'Payroll', icon: CreditCard, color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'expenses', label: 'Expenses', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { id: 'points', label: 'Points Ledger', icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'hub': return <FinanceDashboard currentUser={currentUser} />;
      case 'catalog': return <ServiceCatalog currentUser={currentUser} />;
      case 'orders': return <ServiceOrderSystem currentUser={currentUser} />;
      case 'tasks': return <Tasks searchQuery="" currentUser={currentUser} />;
      case 'invoices': return <PaymentTaskLedger currentUser={currentUser} />;
      case 'payroll': return <PayrollManager currentUser={currentUser} />;
      case 'expenses': return <Expenses currentUser={currentUser} />;
      case 'points': return <Points currentUser={currentUser} />;
      default: return <FinanceDashboard currentUser={currentUser} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Module Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="text-emerald-600" size={28} />
              Operations & Finance
            </h1>
            <p className="text-slate-500 text-sm mt-1">Unified management of services, workflow, and financial assets.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <Wallet size={18} />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Revenue Target</span>
                <span className="text-sm font-bold">$125,000 / $150,000</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <Activity size={18} />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">System Load</span>
                <span className="text-sm font-bold">Stable (1.2s)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-8 overflow-x-auto scrollbar-hide pb-1">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  isActive 
                    ? "bg-slate-900 text-white shadow-lg" 
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <section.icon size={18} className={isActive ? section.color : "text-slate-400"} />
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderSection()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
