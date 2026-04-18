import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
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

  calculateInvoiceTotals: (items: InvoiceItem[]) => {
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

    return {
      subtotal,
      taxTotal,
      discountTotal,
      total: subtotal - discountTotal + taxTotal
    };
  },

  recordPayment: async (payment: Omit<Payment, 'id'>) => {
    try {
      // 1. Add payment record
      const paymentRef = await addDoc(collection(db, 'payments'), {
        ...payment,
        createdAt: serverTimestamp()
      });

      // 2. Update invoice balance and status
      const invoiceDoc = doc(db, 'invoices', payment.invoiceId);
      
      // We need to fetch current balance first or use increment
      // For status we need the full picture
      const invoiceSnap = await getDocs(query(collection(db, 'invoices'), where('__name__', '==', payment.invoiceId)));
      if (invoiceSnap.empty) throw new Error('Invoice not found');
      
      const invoiceData = invoiceSnap.docs[0].data() as Invoice;
      const newBalance = Math.max(0, invoiceData.balance - payment.amount);
      
      let newStatus: InvoiceStatus = 'partially_paid';
      if (newBalance === 0) {
        newStatus = 'paid';
      } else if (newBalance === invoiceData.total) {
        newStatus = 'unpaid';
      }

      await updateDoc(invoiceDoc, {
        balance: newBalance,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // 3. If paid, check for service activation
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

      const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
      const totalInvoiced = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalOutstanding = filteredInvoices.reduce((sum, inv) => sum + inv.balance, 0);

      // Service-wise earnings
      const serviceEarnings: Record<string, number> = {};
      filteredInvoices.forEach(inv => {
        inv.items.forEach(item => {
          if (item.serviceType) {
            serviceEarnings[item.serviceType] = (serviceEarnings[item.serviceType] || 0) + item.total;
          }
        });
      });

      return {
        totalRevenue,
        totalInvoiced,
        totalOutstanding,
        serviceEarnings,
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
      const today = new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, 'invoices'), 
        where('billingType', '==', 'recurring'),
        where('recurringDetails.isActive', '==', true),
        where('recurringDetails.nextGenerationDate', '<=', today)
      );
      
      const snapshot = await getDocs(q);
      
      for (const invoiceDoc of snapshot.docs) {
        const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;
        const details = invoice.recurringDetails!;
        
        // Generate new invoice based on this one
        const newInvoiceNumber = await financeService.generateInvoiceNumber();
        const nextIssueDate = details.nextGenerationDate;
        
        // Calculate next generation date
        const nextDate = new Date(nextIssueDate);
        if (details.interval === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        if (details.interval === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
        if (details.interval === 'annually') nextDate.setFullYear(nextDate.getFullYear() + 1);
        
        const nextGenDateStr = nextDate.toISOString().split('T')[0];

        // Create new invoice
        await addDoc(collection(db, 'invoices'), {
          ...invoice,
          id: undefined, // Let Firestore generate new ID
          invoiceNumber: newInvoiceNumber,
          issueDate: nextIssueDate,
          dueDate: new Date(new Date(nextIssueDate).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'unpaid',
          balance: invoice.total,
          recurringDetails: {
            ...details,
            nextGenerationDate: nextGenDateStr
          },
          createdAt: serverTimestamp()
        });

        // Update old invoice to mark next generation date (or deactivate if endDate reached)
        await updateDoc(doc(db, 'invoices', invoice.id), {
          'recurringDetails.nextGenerationDate': nextGenDateStr,
          'recurringDetails.isActive': details.endDate ? nextGenDateStr <= details.endDate : true
        });
      }
    } catch (error) {
      console.error('Error checking recurring invoices:', error);
    }
  }
};
