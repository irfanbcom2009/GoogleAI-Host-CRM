import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClientService, ServiceDefinition, ServiceTier, User as CRMUser, TaskLog } from '../types';

export const serviceCatalogService = {
  activateService: async (clientServiceId: string, performedBy: { id: string, name: string }) => {
    try {
      const csRef = doc(db, 'client_services', clientServiceId);
      const csSnap = await getDoc(csRef);
      if (!csSnap.exists()) throw new Error('Client service not found');

      const csData = { id: csSnap.id, ...csSnap.data() } as ClientService;
      
      // 1. Check duplicate execution (ServiceTaskRun)
      const runRef = doc(db, 'service_task_runs', clientServiceId);
      const runSnap = await getDoc(runRef);
      if (runSnap.exists() && runSnap.data().executed) {
        console.warn('Service tasks already generated for this activation.');
        return;
      }

      if (csData.isActivated) return;

      const serviceRef = doc(db, 'catalog', csData.serviceId);
      const serviceSnap = await getDoc(serviceRef);
      if (!serviceSnap.exists()) throw new Error('Service not found');
      
      const service = { id: serviceSnap.id, ...serviceSnap.data() } as ServiceDefinition;
      const tier = service.tiers.find(t => t.id === csData.tierId);
      if (!tier) throw new Error('Tier not found');

      const batch = writeBatch(db);
      const taskIds: string[] = [];

      // 2. Fetch potential employees for role-based assignment
      const employeesQuery = query(collection(db, 'users'), where('role', 'in', ['Admin', 'Manager', 'Employee']));
      const employeesSnap = await getDocs(employeesQuery);
      const employees = employeesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as CRMUser);

      // 3. Auto-generate employee tasks from Template
      if (tier.workflowConfig.generateTasksOnActivation) {
        const checklist = tier.employeeChecklist || [];
        
        for (const template of checklist) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + template.daysToComplete);

          // Assignment Logic (Least Loaded User of specific Role)
          const eligibleEmployees = employees.filter(e => e.role === template.assignedRole);
          // For now, picks first. Could be improved to workload-based as requested in design A.
          const assignedUser = eligibleEmployees[0] || null;

          const taskRef = doc(collection(db, 'tasks'));
          const taskData = {
            clientId: csData.clientId,
            clientName: csData.clientName,
            journalId: csData.journalId || '',
            title: `${csData.serviceName}: ${template.label}`,
            description: `Automated workflow task for ${csData.serviceName} (${csData.tierName})`,
            serviceType: 'Catalog Service',
            assignedTo: assignedUser?.id || '',
            assignedToName: assignedUser?.name || 'Unassigned',
            assignedRole: template.assignedRole,
            department: template.department,
            status: 'pending',
            priority: template.priority,
            points: template.points || 0,
            order: template.order || 0,
            dueDate: dueDate.toISOString().split('T')[0],
            deadline: dueDate.toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isClientVisible: false,
            sourceId: clientServiceId,
            sourceType: 'client_service',
            activityLogs: [{
              text: 'System generated task from service activation',
              userId: 'system',
              userName: 'Workflow Engine',
              timestamp: new Date().toISOString()
            }]
          };

          batch.set(taskRef, taskData);
          taskIds.push(taskRef.id);

          // 4. Create Task Log (Audit Trail)
          const logRef = doc(collection(db, 'task_logs'));
          const logData: TaskLog = {
            id: logRef.id,
            taskId: taskRef.id,
            action: 'created',
            by: performedBy.id,
            userName: performedBy.name,
            timestamp: serverTimestamp(),
            details: `Task auto-generated during ${csData.serviceName} activation.`
          };
          batch.set(logRef, logData);
        }
      }

      // 5. Calculate profit split
      let employeeEarnings = 0;
      let companyProfit = csData.totalAmount || 0;

      if (tier.workflowConfig.enableCommissions) {
        const commissionPercentage = tier.workflowConfig.employeeCommissionPercentage || tier.employeeSharePercentage || 0;
        employeeEarnings = (csData.totalAmount || 0) * (commissionPercentage / 100);
        companyProfit = (csData.totalAmount || 0) - employeeEarnings;

        // Try to find the primary manager/employee for this client to assign commission
        const clientRef = doc(db, 'users', csData.clientId);
        const clientSnap = await getDoc(clientRef);
        const assignedToId = clientSnap.exists() ? clientSnap.data().assignedTo : '';
        const assignedToName = clientSnap.exists() ? clientSnap.data().assignedToName : '';

        if (assignedToId && employeeEarnings > 0) {
          const commRef = doc(collection(db, 'commissions'));
          batch.set(commRef, {
            employeeId: assignedToId,
            employeeName: assignedToName,
            amount: employeeEarnings,
            currency: csData.currency,
            sourceType: 'service',
            sourceId: clientServiceId,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdById: 'system',
            createdBy: 'System Engine'
          });
        }
      }

      // 6. Mark execution (İdempotency)
      batch.set(runRef, {
        clientServiceId,
        executed: true,
        lastRun: serverTimestamp()
      });

      // 7. Update Client Service
      batch.update(csRef, {
        isActivated: true,
        status: 'In Progress',
        employeeTaskIds: taskIds,
        employeeEarnings,
        companyProfit,
        updatedAt: new Date().toISOString()
      });

      // 8. Notification
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        title: 'Service Activated',
        message: `Service ${csData.serviceName} for ${csData.clientName} has been activated.`,
        type: 'success',
        userId: 'admin',
        read: false,
        createdAt: new Date().toISOString()
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error activating service:', error);
      throw error;
    }
  },

  checkAndActivateByInvoice: async (invoiceId: string) => {
    try {
      const q = query(collection(db, 'client_services'), where('invoiceId', '==', invoiceId));
      const snapshot = await getDocs(q);
      
      for (const csDoc of snapshot.docs) {
        await serviceCatalogService.activateService(csDoc.id, { id: 'system', name: 'Invoice System' });
      }
    } catch (error) {
      console.error('Error checking service activation by invoice:', error);
    }
  }
};
