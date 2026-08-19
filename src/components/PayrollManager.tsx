import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Search, 
  Calendar, 
  TrendingUp, 
  ArrowRight,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Filter,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PayrollRecord, SalaryPayment, User, UserRole } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, doc, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { financeService } from '../services/financeService';
import { cn } from '../lib/utils';
import { Modal } from './Modal';
import { toast } from 'react-hot-toast';

interface PayrollManagerProps {
  currentUser: User;
}

export const PayrollManager: React.FC<PayrollManagerProps> = ({ currentUser }) => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [payrollEntries, setPayrollEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    currency: 'PKR' as 'USD' | 'PKR',
    method: 'Bank Transfer' as any,
    type: 'salary' as any,
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result = [];
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
      result.push(i);
    }
    return result;
  }, []);

  useEffect(() => {
    const fetchEmployees = async () => {
      const q = query(
        collection(db, 'users'),
        where('role', 'in', ['Employee', 'Manager']),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const empData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setEmployees(empData);
    };

    fetchEmployees();
  }, []);

  useEffect(() => {
    const calculateAllPayroll = async () => {
      if (employees.length === 0) return;
      setLoading(true);
      try {
        const entries = await Promise.all(
          employees.map(emp => financeService.calculatePayroll(emp.id, selectedMonth, selectedYear))
        );
        setPayrollEntries(entries);
      } catch (error) {
        console.error('Error calculating all payroll:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateAllPayroll();
  }, [employees, selectedMonth, selectedYear]);

  const filteredEntries = useMemo(() => {
    return payrollEntries.filter(entry => 
      entry.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [payrollEntries, searchQuery]);

  const stats = useMemo(() => {
    return {
      totalGross: payrollEntries.reduce((sum, e) => sum + e.grossSalary, 0),
      totalGrossUSD: payrollEntries.reduce((sum, e) => sum + (e.usdEquiv?.grossSalary || 0), 0),
      totalPaid: payrollEntries.reduce((sum, e) => sum + e.paidAmount, 0),
      totalPaidUSD: payrollEntries.reduce((sum, e) => sum + (e.usdEquiv?.paidAmount || 0), 0),
      totalBalance: payrollEntries.reduce((sum, e) => sum + e.balance, 0),
      totalBalanceUSD: payrollEntries.reduce((sum, e) => sum + (e.usdEquiv?.balance || 0), 0),
      employeeCount: payrollEntries.length
    };
  }, [payrollEntries]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || isProcessing) return;
    
    setIsProcessing(true);
    try {
      await financeService.recordSalaryPayment({
        employeeId: selectedEmployee.employeeId,
        employeeName: selectedEmployee.employeeName,
        amount: paymentData.amount,
        currency: paymentData.currency,
        date: paymentData.date,
        method: paymentData.method,
        type: paymentData.type,
        notes: paymentData.notes
      });

      toast.success('Payment recorded successfully');
      setIsPaymentModalOpen(false);
      
      // Refresh payroll for this employee
      const updatedEntry = await financeService.calculatePayroll(selectedEmployee.employeeId, selectedMonth, selectedYear);
      setPayrollEntries(prev => prev.map(e => e.employeeId === selectedEmployee.employeeId ? updatedEntry : e));
    } catch (error) {
      toast.error('Failed to record payment');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-full mx-auto px-4 md:px-8 lg:px-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <DollarSign className="text-indigo-600 dark:text-indigo-400" size={32} />
            Payroll Management
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Calculate salaries based on earned points or base salary, and manage advance payments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
            <Calendar size={18} className="text-indigo-600" />
            <select 
              value={selectedMonth || ''}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-transparent border-none outline-none font-bold text-slate-700 cursor-pointer"
            >
              {months.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
            <select 
              value={selectedYear || ''}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent border-none outline-none font-bold text-slate-700 cursor-pointer"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm">
            <Download size={18} />
            Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Estimated Total Gross', value: stats.totalGross, subValue: stats.totalGrossUSD, icon: DollarSign, color: 'indigo' },
          { label: 'Total Amount Paid', value: stats.totalPaid, subValue: stats.totalPaidUSD, icon: CheckCircle2, color: 'emerald' },
          { label: 'Remaining Balance', value: stats.totalBalance, subValue: stats.totalBalanceUSD, icon: Clock, color: 'amber' },
          { label: 'Staff Count', value: stats.employeeCount, icon: TrendingUp, color: 'rose', isNumber: true }
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3 group hover:border-indigo-200 transition-colors"
          >
            <div className={`p-3 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl w-fit group-hover:scale-110 transition-transform`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <h4 className="text-xl font-black text-slate-900 mt-1">
                {stat.isNumber ? stat.value : `PKR ${stat.value.toLocaleString()}`}
              </h4>
              {!stat.isNumber && stat.subValue !== undefined && (
                <p className="text-xs font-bold text-slate-400">$ {stat.subValue.toLocaleString()}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search staff members..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filter by status:</span>
            <select className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none">
              <option>All Staff</option>
              <option>Pending</option>
              <option>Paid</option>
              <option>Partially Paid</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Staff Member</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Points Earned</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Reward (Points Value)</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Base Salary</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Gross Salary</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Paid</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right italic">Balance</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-3" size={32} />
                    <p className="text-slate-500 font-medium">Calculating payroll data...</p>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="p-4 bg-slate-50 rounded-2xl w-fit mx-auto mb-3 text-slate-400">
                      <AlertCircle size={32} />
                    </div>
                    <p className="text-slate-500 font-medium">No results found for your search.</p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{entry.employeeName}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Month: {months[selectedMonth]}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-indigo-600" />
                        <span className="font-bold text-slate-700">{entry.pointsEarned.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-600">{entry.pointsValue.toLocaleString()} PKR</span>
                        {entry.usdEquiv && <span className="text-[10px] text-slate-400 font-medium">$ {(entry.usdEquiv.pointsValue || entry.pointsValue / 280).toLocaleString()}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-600">{entry.baseSalary.toLocaleString()} PKR</span>
                        {entry.usdEquiv && <span className="text-[10px] text-slate-400 font-medium">$ {(entry.usdEquiv.baseSalary || entry.baseSalary / 280).toLocaleString()}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-black text-slate-900">{entry.grossSalary.toLocaleString()} PKR</span>
                        {entry.usdEquiv && <span className="text-[10px] font-bold text-slate-400">$ {entry.usdEquiv.grossSalary.toLocaleString()}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-600">
                      <div className="flex flex-col items-end">
                        <span>{entry.paidAmount > 0 ? `-${entry.paidAmount.toLocaleString()}` : '0'} PKR</span>
                        {entry.usdEquiv && <span className="text-[10px] font-bold text-emerald-400">-{entry.usdEquiv.paidAmount > 0 ? `$ ${entry.usdEquiv.paidAmount.toLocaleString()}` : '$ 0'}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end px-2 py-1 rounded-lg bg-slate-50">
                        <span className={cn(
                          "font-black",
                          entry.balance > 0 ? "text-amber-700" : "text-emerald-700"
                        )}>
                          {entry.balance.toLocaleString()} PKR
                        </span>
                        {entry.usdEquiv && (
                          <span className={cn(
                            "text-[10px] font-bold",
                            entry.balance > 0 ? "text-amber-500" : "text-emerald-500"
                          )}>
                            $ {entry.usdEquiv.balance.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        entry.status === 'paid' ? "bg-emerald-100 text-emerald-700" :
                        entry.status === 'partially_paid' ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {entry.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          setSelectedEmployee(entry);
                          setPaymentData(prev => ({ ...prev, amount: entry.balance }));
                          setIsPaymentModalOpen(true);
                        }}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        title="Record Payment"
                      >
                        <DollarSign size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Salary Payment"
        maxWidth="xl"
      >
        <form onSubmit={handleRecordPayment} className="space-y-6">
          <div className="p-4 bg-indigo-50 rounded-2xl flex gap-4">
            <div className="p-3 bg-white text-indigo-600 rounded-xl shrink-0 h-fit shadow-sm">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Paying To</p>
              <h4 className="text-lg font-black text-indigo-900">{selectedEmployee?.employeeName}</h4>
              <p className="text-xs text-indigo-700 font-medium mt-0.5">
                For {months[selectedMonth]} {selectedYear}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Currency</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                value={paymentData.currency || ''}
                onChange={(e) => setPaymentData({ ...paymentData, currency: e.target.value as any })}
              >
                <option value="PKR">PKR (Rs.)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Payment Amount</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                  {paymentData.currency === 'USD' ? '$' : 'Rs.'}
                </div>
                <input 
                  type="number"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-black"
                  value={paymentData.amount || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 md:col-span-1">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Payment Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="date"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                  value={paymentData.date || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Payment Method</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                value={paymentData.method || ''}
                onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value as any })}
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Online">Online/EasyPaisa/JazzCash</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Transaction Type</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                value={paymentData.type || ''}
                onChange={(e) => setPaymentData({ ...paymentData, type: e.target.value as any })}
              >
                <option value="salary">Monthly Salary</option>
                <option value="advance">Salary Advance</option>
                <option value="bonus">Performance Bonus</option>
                <option value="commission">Sales Commission</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Internal Notes</label>
            <textarea 
              rows={3}
              placeholder="e.g. Paid via HBL Online Transfer (Ref: 98234)"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={paymentData.notes || ''}
              onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
            />
          </div>

          <button 
            type="submit"
            disabled={isProcessing}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
            Confirm & Record Payment
          </button>
        </form>
      </Modal>
    </div>
  );
};
