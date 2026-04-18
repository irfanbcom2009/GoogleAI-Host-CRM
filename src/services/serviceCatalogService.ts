import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ClientService, ServiceDefinition, ServiceTier } from '../types';

export const serviceCatalogService = {
  activateService: async (clientServiceId: string) => {
    try {
      const csRef = doc(db, 'client_services', clientServiceId);
      const csSnap = await getDoc(csRef);
      if (!csSnap.exists()) throw new Error('Client service not found');

      const csData = { id: csSnap.id, ...csSnap.data() } as ClientService;
      if (csData.isActivated) return;

      const serviceRef = doc(db, 'services', csData.serviceId);
      const serviceSnap = await getDoc(serviceRef);
      if (!serviceSnap.exists()) throw new Error('Service not found');
      
      const service = { id: serviceSnap.id, ...serviceSnap.data() } as ServiceDefinition;
      const tier = service.tiers.find(t => t.id === csData.tierId);
      if (!tier) throw new Error('Tier not found');

      // Auto-generate employee tasks
      const taskIds: string[] = [];
      for (const template of tier.employeeChecklist) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + template.daysToComplete);

        const taskData = {
          clientId: csData.clientId,
          clientName: csData.clientName,
          title: `${csData.serviceName} (${csData.tierName}): ${template.label}`,
          description: `Automated task for ${csData.serviceName} subscription.`,
          serviceType: 'Catalog Service',
          assignedTo: '',
          department: template.department,
          status: 'pending',
          priority: template.priority,
          dueDate: dueDate.toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isClientVisible: false,
          sourceId: clientServiceId,
          sourceType: 'client_service'
        };

        const taskRef = await addDoc(collection(db, 'tasks'), taskData);
        taskIds.push(taskRef.id);
      }

      // Calculate profit split
      const employeeEarnings = (csData.totalAmount || 0) * (tier.employeeSharePercentage / 100);
      const companyProfit = (csData.totalAmount || 0) - employeeEarnings;

      await updateDoc(csRef, {
        isActivated: true,
        status: 'Not Started',
        employeeTaskIds: taskIds,
        employeeEarnings,
        companyProfit,
        updatedAt: new Date().toISOString()
      });

      // Notification
      await addDoc(collection(db, 'notifications'), {
        title: 'Service Activated',
        message: `Service ${csData.serviceName} for ${csData.clientName} has been activated.`,
        type: 'success',
        userId: 'admin',
        read: false,
        createdAt: new Date().toISOString()
      });

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
        await serviceCatalogService.activateService(csDoc.id);
      }
    } catch (error) {
      console.error('Error checking service activation by invoice:', error);
    }
  }
};
