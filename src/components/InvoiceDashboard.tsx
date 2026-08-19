import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  FileText, 
  AlertCircle, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  CheckCircle2,
  Filter,
  Search,
  Plus,
  Download,
  Calendar
} from 'lucide-react';
import { motion } from 'motion/react';
import { Invoice, Payment, ServiceType } from '../types';
import { financeService } from '../services/financeService';
import { cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const InvoiceDashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        // Run recurring check first
        await financeService.checkRecurringInvoices();
        
        const data = await financeService.getFinancialSummary(dateRange.start, dateRange.end);
        setSummary(data);
      } catch (error) {
        console.error('Error fetching financial summary:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [dateRange]);

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const pieData = Object.entries(summary.serviceEarnings as Record<string, number>).map(([name, value]) => ({
    name,
    value: Number(value)
  }));

  const stats = [
    { 
      label: 'Total Revenue', 
      value: `PKR ${summary.totalRevenue.toLocaleString()}`, 
      icon: DollarSign, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      trend: '+12.5%',
      trendUp: true
    },
    { 
      label: 'Total Invoiced', 
      value: `PKR ${summary.totalInvoiced.toLocaleString()}`, 
      icon: FileText, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50',
      trend: '+8.2%',
      trendUp: true
    },
    { 
      label: 'Outstanding', 
      value: `PKR ${summary.totalOutstanding.toLocaleString()}`, 
      icon: Clock, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50',
      trend: '-2.4%',
      trendUp: false
    },
    { 
      label: 'Invoices Sent', 
      value: summary.invoiceCount, 
      icon: CheckCircle2, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50',
      trend: '+5',
      trendUp: true
    },
  ];

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
            <Calendar size={16} className="text-slate-400" />
            <input 
              type="date" 
              className="bg-transparent border-none outline-none text-sm font-bold text-slate-700"
              value={dateRange.start || ''}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
            <span className="text-slate-300">to</span>
            <input 
              type="date" 
              className="bg-transparent border-none outline-none text-sm font-bold text-slate-700"
              value={dateRange.end || ''}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">
            <Download size={16} />
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl transition-colors", stat.bg, stat.color)}>
                <stat.icon size={24} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg",
                stat.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              )}>
                {stat.trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {stat.trend}
              </div>
            </div>
            <h3 className="text-slate-500 text-sm font-medium mb-1">{stat.label}</h3>
            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900">Revenue Overview</h3>
              <p className="text-sm text-slate-500">Monthly revenue trends and projections.</p>
            </div>
            <select className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500">
              <option>Last 6 Months</option>
              <option>Last Year</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pieData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                  tickFormatter={(value) => `PKR ${value / 1000}k`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#6366f1" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Service Earnings Pie */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 mb-1">Service Earnings</h3>
          <p className="text-sm text-slate-500 mb-8">Revenue distribution by service type.</p>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total</span>
              <span className="text-xl font-black text-slate-900">PKR {(summary.totalRevenue / 1000).toFixed(1)}k</span>
            </div>
          </div>
          <div className="mt-8 space-y-3">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-sm font-medium text-slate-600">{entry.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">PKR {(entry.value / 1000).toFixed(1)}k</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
