import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

const data = [
  { name: 'Jan', clients: 120, tasks: 450 },
  { name: 'Feb', clients: 132, tasks: 520 },
  { name: 'Mar', clients: 148, tasks: 480 },
  { name: 'Apr', clients: 156, tasks: 610 },
  { name: 'May', clients: 165, tasks: 550 },
  { name: 'Jun', clients: 178, tasks: 670 },
  { name: 'Jul', clients: 192, tasks: 720 },
];

const journalData = [
  { name: 'Medical', value: 40 },
  { name: 'Engineering', value: 30 },
  { name: 'Humanities', value: 20 },
  { name: 'Social Sci', value: 25 },
];

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export const JournalDistribution = () => (
  <div className="h-[300px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={journalData}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#94a3b8', fontSize: 12 }}
        />
        <Tooltip 
          cursor={{ fill: '#f8fafc' }}
          contentStyle={{ 
            backgroundColor: '#fff', 
            borderRadius: '12px', 
            border: 'none', 
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
          }} 
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {journalData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);
