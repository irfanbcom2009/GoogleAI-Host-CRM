import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Journal, User, ServiceType } from '../types';

export type JournalWorkflowStageId = 
  | 'client_management'
  | 'domain_hosting'
  | 'ojs_setup'
  | 'content_management'
  | 'compliance_registration'
  | 'indexing'
  | 'ongoing_tracking';

export interface WorkflowStageDefinition {
  id: JournalWorkflowStageId;
  label: string;
  order: number;
}

export const WORKFLOW_STAGES: WorkflowStageDefinition[] = [
  { id: 'client_management', label: 'Client Management', order: 1 },
  { id: 'domain_hosting', label: 'Domain & Hosting', order: 2 },
  { id: 'ojs_setup', label: 'OJS Setup', order: 3 },
  { id: 'content_management', label: 'Content Management', order: 4 },
  { id: 'compliance_registration', label: 'Compliance & Registration', order: 5 },
  { id: 'indexing', label: 'Indexing', order: 6 },
  { id: 'ongoing_tracking', label: 'Status Tracking (Ongoing)', order: 7 },
];

export const workflowService = {
  /**
   * Update Journal Lifecycle Status and Log Event
   */
  updateJournalLifecycle: async (
    journalId: string, 
    fromStatus: string, 
    toStatus: string, 
    userId: string, 
    userName: string, 
    notes?: string
  ) => {
    const journalRef = doc(db, 'journals', journalId);
    const eventId = crypto.randomUUID();
    
    const event = {
      id: eventId,
      fromStatus,
      toStatus,
      timestamp: new Date().toISOString(),
      triggeredBy: userName,
      triggeredById: userId,
      notes
    };

    await updateDoc(journalRef, {
      lifecycleStatus: toStatus,
      lifecycleHistory: (window as any).firebase?.firestore?.FieldValue?.arrayUnion(event) || [event],
      updatedAt: serverTimestamp()
    });
  },

  /**
   * Auto-generate invoice for Domain purchases with financial tracking
   */
  generateDomainInvoice: async (
    clientId: string,
    clientName: string,
    journalId: string,
    journalTitle: string,
    domainName: string,
    costPrice: number,
    salePrice: number,
    performedBy: { id: string, name: string }
  ) => {
    const invoiceNumber = `INV-DOM-${Date.now().toString().slice(-6)}`;
    const profit = salePrice - costPrice;

    const invoiceData = {
      invoiceNumber,
      clientId,
      clientName,
      journalId,
      journalTitle,
      date: new Date().toISOString().split('T')[0],
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'unpaid',
      currency: 'PKR',
      items: [
        {
          id: crypto.randomUUID(),
          description: `Domain Purchase: ${domainName} (Profit Tracking: ${profit})`,
          quantity: 1,
          rate: salePrice,
          total: salePrice,
          serviceType: 'Domain'
        }
      ],
      subtotal: salePrice,
      total: salePrice,
      balance: salePrice,
      costPrice,
      profit,
      createdAt: new Date().toISOString(),
      createdById: performedBy.id,
      createdBy: performedBy.name
    };

    await addDoc(collection(db, 'invoices'), invoiceData);
    return invoiceNumber;
  },

  /**
   * Determine the current active stage of a journal based on its tasks and data
   */
  getJournalProgress: async (journalId: string): Promise<Record<JournalWorkflowStageId, 'pending' | 'in_progress' | 'completed'>> => {
    const journalSnap = await getDocs(query(collection(db, 'journals'), where('id', '==', journalId)));
    if (journalSnap.empty) return {} as any;
    
    const journal = journalSnap.docs[0].data() as Journal;
    const progress: any = {};

    // 1. Client Management
    progress.client_management = journal.clientId ? 'completed' : 'pending';

    // 2. Domain & Hosting
    progress.domain_hosting = journal.domainId ? 'completed' : 'pending';

    // 3. OJS Setup
    progress.ojs_setup = journal.isOjsSubscribedFromUs ? 'completed' : 'pending';

    // Fetch tasks to refine others
    const taskQuery = query(collection(db, 'tasks'), where('journalId', '==', journalId));
    const taskSnap = await getDocs(taskQuery);
    const tasks = taskSnap.docs.map(d => d.data());

    const checkService = (type: string) => {
      const relatedTasks = tasks.filter(t => t.serviceType === type);
      if (relatedTasks.length === 0) return 'pending';
      const allDone = relatedTasks.every(t => t.status === 'completed');
      return allDone ? 'completed' : 'in_progress';
    };

    progress.content_management = checkService('Editorial');
    progress.compliance_registration = checkService('ISSN');
    progress.indexing = checkService('Indexing');
    
    // Ongoing Tracking (Scopus, HEC etc)
    const ongoingServices = ['HEC Indexing', 'Scopus Indexing', 'DOI', 'Call for Papers'];
    const ongoingTasks = tasks.filter(t => ongoingServices.includes(t.serviceType as string));
    if (ongoingTasks.length > 0) {
      const anyDone = ongoingTasks.some(t => t.status === 'completed');
      progress.ongoing_tracking = anyDone ? 'in_progress' : 'pending';
    } else {
      progress.ongoing_tracking = 'pending';
    }

    return progress;
  }
};
