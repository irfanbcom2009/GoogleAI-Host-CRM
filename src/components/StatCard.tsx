import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  change: number;
  icon: LucideIcon;
  color: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, change, icon: Icon, color }) => {
  const isPositive = change >= 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <h3 className="text-xl font-bold text-slate-900 mt-0.5">{value}</h3>
          <div className={cn(
            "flex items-center gap-1 mt-1.5 text-[10px] font-semibold",
            isPositive ? "text-emerald-600" : "text-rose-600"
          )}>
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            <span>{Math.abs(change)}%</span>
            <span className="text-slate-400 font-normal ml-0.5">vs last month</span>
          </div>
        </div>
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </motion.div>
  );
};
