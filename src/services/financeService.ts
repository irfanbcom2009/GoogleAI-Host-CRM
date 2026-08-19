import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  serverTimestamp, 
  orderBy, 
  limit,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Invoice, InvoiceItem, Payment, InvoiceStatus, RecurringDetails, ServiceType } from '../types';
import { serviceCatalogService } from './serviceCatalogService';

export const financeService = {
  generateInvoiceNumber: async (): Promise<string> => {
    try {
      const q = query(collection(db, 'invoices'), orderBy('invoiceNumber', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      
      const currentYear = new Date().getFullYear();
      let nextNumber = 1;

      if (!snapshot.empty) {
        const lastInvoice = snapshot.docs[0].data() as Invoice;
        const lastNumber = lastInvoice.invoiceNumber;
        if (lastNumber && lastNumber.startsWith(`INV-${currentYear}-`)) {
          const parts = lastNumber.split('-');
          nextNumber = parseInt(parts[2]) + 1;
        }
      }

      return `INV-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      return `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    }
  },

  calculateInvoiceTotals: (items: InvoiceItem[], currency: 'USD' | 'PKR', usdPkrRate: number) => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    items.forEach(item => {
      const itemSubtotal = item.rate * item.quantity;
      const itemDiscount = itemSubtotal * (item.discountRate / 100);
      const itemTax = (itemSubtotal - itemDiscount) * (item.taxRate / 100);
      
      subtotal += itemSubtotal;
      discountTotal += itemDiscount;
      taxTotal += itemTax;
    });

    const total = subtotal - discountTotal + taxTotal;
    const amountUSD = currency === 'USD' ? total : total / usdPkrRate;
    const amountPKR = currency === 'PKR' ? total : total * usdPkrRate;

    return {
      subtotal,
      taxTotal,
      discountTotal,
      total,
      amountUSD,
      amountPKR,
      usdPkrRate
    };
  },

  recordPayment: async (payment: Omit<Payment, 'id'>) => {
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
      const settings = settingsSnap.exists() ? settingsSnap.data() as any : {};
      const usdPkrRate = settings.usdPkrRate || 280;

      // 1. Calculate dual amounts
      const amountUSD = payment.currency === 'USD' ? payment.amount : payment.amount / usdPkrRate;
      const amountPKR = payment.currency === 'PKR' ? payment.amount : payment.amount * usdPkrRate;

      // 2. Add payment record
      const paymentRef = await addDoc(collection(db, 'payments'), {
        ...payment,
        amountUSD,
        amountPKR,
        usdPkrRate,
        createdAt: serverTimestamp()
      });

      // 3. Update invoice balance and status
      const invoiceDoc = doc(db, 'invoices', payment.invoiceId);
      const invoiceSnap = await getDoc(invoiceDoc);
      if (!invoiceSnap.exists()) throw new Error('Invoice not found');
      
      const invoiceData = invoiceSnap.data() as Invoice;
      
      // Calculate how much to deduct from original balance
      // If invoice is USD and payment is USD, deduct flat
      // If invoice is USD and payment is PKR, convert payment to USD using CURRENT rate or payment rate
      let deduction = payment.amount;
      if (invoiceData.currency !== payment.currency) {
        deduction = payment.currency === 'USD' ? payment.amount * usdPkrRate : payment.amount / usdPkrRate;
      }

      const newBalance = Math.max(0, invoiceData.balance - deduction);
      
      let newStatus: InvoiceStatus = 'partially_paid';
      if (newBalance <= 0.01) { // Floating point safety
        newStatus = 'paid';
      } else if (newBalance >= invoiceData.total - 0.01) {
        newStatus = 'unpaid';
      }

      const newBalanceUSD = invoiceData.currency === 'USD' ? newBalance : newBalance / usdPkrRate;
      const newBalancePKR = invoiceData.currency === 'PKR' ? newBalance : newBalance * usdPkrRate;

      await updateDoc(invoiceDoc, {
        balance: newBalance,
        balanceUSD: newBalanceUSD,
        balancePKR: newBalancePKR,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // 4. If paid, check for service activation
      if (newStatus === 'paid') {
        await serviceCatalogService.checkAndActivateByInvoice(payment.invoiceId);
      }

      return paymentRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'payments');
      throw error;
    }
  },

  getFinancialSummary: async (startDate?: string, endDate?: string) => {
    try {
      const invoicesSnap = await getDocs(collection(db, 'invoices'));
      const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
      
      const paymentsSnap = await getDocs(collection(db, 'payments'));
      const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));

      // Filter by date if provided
      const filteredInvoices = startDate && endDate 
        ? invoices.filter(inv => inv.issueDate >= startDate && inv.issueDate <= endDate)
        : invoices;

      const filteredPayments = startDate && endDate
        ? payments.filter(p => p.date >= startDate && p.date <= endDate)
        : payments;

      const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
      const settings = settingsSnap.exists() ? settingsSnap.data() as any : {};
      const usdPkrRate = settings.usdPkrRate || 280;

      const totalRevenuePKR = filteredPayments.reduce((sum, p) => 
        sum + (p.currency === 'USD' ? p.amount * usdPkrRate : p.amount), 0);
      const totalRevenueUSD = filteredPayments.reduce((sum, p) => 
        sum + (p.currency === 'PKR' ? p.amount / usdPkrRate : p.amount), 0);
      
      const totalInvoicedPKR = filteredInvoices.reduce((sum, inv) => 
        sum + (inv.currency === 'USD' ? inv.total * usdPkrRate : inv.total), 0);
      const totalInvoicedUSD = filteredInvoices.reduce((sum, inv) => 
        sum + (inv.currency === 'PKR' ? inv.total / usdPkrRate : inv.total), 0);

      const totalOutstandingPKR = filteredInvoices.reduce((sum, inv) => 
        sum + (inv.currency === 'USD' ? inv.balance * usdPkrRate : inv.balance), 0);
      const totalOutstandingUSD = filteredInvoices.reduce((sum, inv) => 
        sum + (inv.currency === 'PKR' ? inv.balance / usdPkrRate : inv.balance), 0);

      // Service-wise earnings in PKR (normalized)
      const serviceEarningsPKR: Record<string, number> = {};
      filteredInvoices.forEach(inv => {
        const rate = inv.currency === 'USD' ? usdPkrRate : 1;
        (inv.items || []).forEach(item => {
          if (item.serviceType) {
            serviceEarningsPKR[item.serviceType] = (serviceEarningsPKR[item.serviceType] || 0) + (item.total * rate);
          }
        });
      });

      return {
        totalRevenuePKR,
        totalRevenueUSD,
        totalInvoicedPKR,
        totalInvoicedUSD,
        totalOutstandingPKR,
        totalOutstandingUSD,
        serviceEarningsPKR,
        invoiceCount: filteredInvoices.length,
        paymentCount: filteredPayments.length
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'invoices');
      throw error;
    }
  },

  checkRecurringInvoices: async () => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
      const settings = settingsSnap.exists() ? settingsSnap.data() as any : {};
      const usdPkrRate = settings.usdPkrRate || 280;

      // Fetch all invoices to check items
      const snapshot = await getDocs(collection(db, 'invoices'));
      
      for (const invoiceDoc of snapshot.docs) {
        const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;
        
        // Find recurring items that need renewal
        const recurringItemsToRenew = (invoice.items || []).filter(item => 
          item.billingType === 'recurring' && 
          item.isActive !== false && 
          item.nextRenewalDate && 
          item.nextRenewalDate <= todayStr
        );

        if (recurringItemsToRenew.length > 0) {
          const newInvoiceNumber = await financeService.generateInvoiceNumber();
          
          // Use the earliest nextRenewalDate as the issue date for the new invoice
          const issueDate = recurringItemsToRenew.sort((a, b) => a.nextRenewalDate!.localeCompare(b.nextRenewalDate!))[0].nextRenewalDate!;
          
          const newItems: InvoiceItem[] = recurringItemsToRenew.map(item => {
            const nextDate = new Date(item.nextRenewalDate!);
            if (item.interval === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
            else if (item.interval === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
            else if (item.interval === 'annually') nextDate.setFullYear(nextDate.getFullYear() + 1);
            
            return {
              ...item,
              id: Math.random().toString(36).substr(2, 9),
              nextRenewalDate: nextDate.toISOString().split('T')[0]
            };
          });

          const invCurrency = invoice.currency || 'PKR';
          const newTotals = financeService.calculateInvoiceTotals(newItems, invCurrency, usdPkrRate);

          // Create new renewal invoice
          await addDoc(collection(db, 'invoices'), {
            clientId: invoice.clientId,
            clientName: invoice.clientName,
            invoiceNumber: newInvoiceNumber,
            issueDate: issueDate,
            dueDate: new Date(new Date(issueDate).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: newItems,
            subtotal: newTotals.subtotal,
            taxTotal: newTotals.taxTotal,
            discountTotal: newTotals.discountTotal,
            total: newTotals.total,
            balance: newTotals.total,
            status: 'unpaid',
            currency: invoice.currency || 'PKR',
            notes: `Renewal invoice for recurring services from ${invoice.invoiceNumber}`,
            createdAt: serverTimestamp()
          });

          // Update original items' nextRenewalDates and mark them as successfully renewed
          const updatedItems = (invoice.items || []).map(item => {
            const renewedItem = newItems.find(ni => ni.description === item.description && ni.billingType === 'recurring');
            if (renewedItem) {
              return {
                ...item,
                nextRenewalDate: renewedItem.nextRenewalDate
              };
            }
            return item;
          });

          await updateDoc(doc(db, 'invoices', invoice.id), {
            items: updatedItems,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error('Error checking recurring invoices:', error);
    }
  },

  getMonthlyPoints: async (employeeId: string, month: number, year: number) => {
    try {
      const startOfMonth = new Date(year, month, 1).toISOString();
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const endOfMonth = new Date(nextYear, nextMonth, 0, 23, 59, 59).toISOString();
      
      const q = query(
        collection(db, 'point_history'),
        where('userId', '==', employeeId),
        where('type', '==', 'earned'),
        where('createdAt', '>=', startOfMonth),
        where('createdAt', '<=', endOfMonth)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.reduce((sum, doc) => sum + (doc.data().points || 0), 0);
    } catch (error) {
      console.error('Error fetching monthly points:', error);
      return 0;
    }
  },

  calculatePayroll: async (employeeId: string, month: number, year: number) => {
    try {
      const empSnap = await getDoc(doc(db, 'users', employeeId));
      if (!empSnap.exists()) throw new Error('Employee not found');
      const employee = { id: empSnap.id, ...empSnap.data() } as any;

      const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
      const settings = settingsSnap.exists() ? settingsSnap.data() as any : {};
      const pointRate = settings.pointRate || 0;
      const usdPkrRate = settings.usdPkrRate || 280;

      const points = await financeService.getMonthlyPoints(employeeId, month, year);
      const pointsValue = points * pointRate; // Points value is assumed in PKR
      
      const baseSalaryRaw = employee.baseSalary || 0;
      const baseSalaryPKR = employee.baseSalaryCurrency === 'USD' ? baseSalaryRaw * usdPkrRate : baseSalaryRaw;
      
      const grossSalaryPKR = Math.max(pointsValue, baseSalaryPKR);

      const startOfMonth = new Date(year, month, 1).toISOString();
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const endOfMonth = new Date(nextYear, nextMonth, 0, 23, 59, 59).toISOString();
      
      const paymentsQ = query(
        collection(db, 'salaryPayments'),
        where('employeeId', '==', employeeId),
        where('date', '>=', startOfMonth),
        where('date', '<=', endOfMonth)
      );
      const paymentsSnap = await getDocs(paymentsQ);
      
      // Calculate total paid in PKR (normalized)
      const paidAmountPKR = paymentsSnap.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.currency === 'USD' ? data.amount * usdPkrRate : data.amount);
      }, 0);

      const netSalaryPKR = grossSalaryPKR; 
      const balancePKR = Math.max(0, netSalaryPKR - paidAmountPKR);

      return {
        employeeId,
        employeeName: employee.name,
        month,
        year,
        pointsEarned: points,
        pointsValue,
        baseSalary: baseSalaryPKR,
        grossSalary: grossSalaryPKR,
        netSalary: netSalaryPKR,
        paidAmount: paidAmountPKR,
        balance: balancePKR,
        currency: 'PKR', // Baseline for calculations
        usdEquiv: {
          grossSalary: grossSalaryPKR / usdPkrRate,
          paidAmount: paidAmountPKR / usdPkrRate,
          balance: balancePKR / usdPkrRate
        },
        status: balancePKR <= 0 ? 'paid' : (paidAmountPKR > 0 ? 'partially_paid' : 'pending')
      };
    } catch (error) {
      console.error('Error calculating payroll:', error);
      throw error;
    }
  },

  recordSalaryPayment: async (payment: any) => {
    try {
      const docRef = await addDoc(collection(db, 'salaryPayments'), {
        ...payment,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'salaryPayments');
       throw error;
    }
  }
};
