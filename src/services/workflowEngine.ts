import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Task, 
  WorkflowTemplate, 
  Order, 
  User, 
  ServiceStatus,
  TaskStatus,
  TaskPriority
} from '../types';
import { addDays } from 'date-fns';

export class WorkflowEngine {
  /**
   * Generates tasks for an order based on the service's workflow template.
   */
  static async generateTasksForOrder(order: Order, createdBy: User) {
    try {
      // 1. Fetch template for the service
      const templatesRef = collection(db, 'workflows');
      const q = query(templatesRef, where('serviceId', '==', order.catalogItemId), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn(`No active workflow template found for service: ${order.catalogItemName}`);
        return;
      }

      const template = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as WorkflowTemplate;
      const tasksToCreate: Partial<Task>[] = [];
      const now = new Date();

      // 2. Iterate through stages and tasks
      for (const stage of template.stages) {
        for (const taskTemplate of stage.tasks) {
          const deadline = addDays(now, taskTemplate.estimatedDays);
          
          const task: Partial<Task> = {
            clientId: order.clientId,
            clientName: order.clientName,
            linkedOrderId: order.id,
            linkedServiceId: order.catalogItemId,
            serviceType: 'Catalog Service',
            title: taskTemplate.name,
            description: taskTemplate.description,
            assignedRole: taskTemplate.assignedRole,
            status: 'pending',
            priority: 'medium',
            basePoints: taskTemplate.basePoints,
            complexityMultiplier: taskTemplate.complexityMultiplier,
            urgencyBonus: 0,
            delayPenalty: 0,
            reworkPenalty: 0,
            dueDate: deadline.toISOString(),
            deadline: deadline.toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            activityLogs: [
              {
                text: `Task auto-generated from workflow template: ${template.name}`,
                userId: 'system',
                userName: 'Workflow Engine',
                timestamp: now.toISOString()
              }
            ],
            isClientVisible: true,
            assignedTo: '' // Will be assigned by Manager or Auto-assignment logic
          };

          tasksToCreate.push(task);
        }
      }

      // 3. Batch create tasks
      // For simplicity in this demo, creating them individually
      const tasksCollection = collection(db, 'tasks');
      for (const taskData of tasksToCreate) {
        await addDoc(tasksCollection, taskData);
      }

      // 4. Update order status
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        serviceStatus: 'In Progress' as ServiceStatus,
        progressPercentage: 0,
        currentStep: template.stages[0]?.name || 'Initial Stage',
        updatedAt: now.toISOString()
      });

      // 5. Notify managers
      await this.createNotification({
        userId: 'admin', // General admin or specific manager
        title: 'New Workflow Initiated',
        message: `Tasks for order ${order.orderNumber} have been generated.`,
        type: 'info',
        link: `/orders/${order.id}`,
        isRead: false,
        createdAt: now.toISOString()
      });

    } catch (error) {
      console.error('Error generating tasks:', error);
      throw error;
    }
  }

  static async createNotification(notification: any) {
    try {
      await addDoc(collection(db, 'notifications'), notification);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  /**
   * Recalculates order progress based on task completion.
   */
  static async updateOrderProgress(orderId: string) {
    const tasksRef = collection(db, 'tasks');
    const q = query(tasksRef, where('linkedOrderId', '==', orderId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    const tasks = snapshot.docs.map(doc => doc.data() as Task);
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const percentage = Math.round((completedTasks.length / tasks.length) * 100);

    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      progressPercentage: percentage,
      updatedAt: new Date().toISOString()
    });
  }
}
