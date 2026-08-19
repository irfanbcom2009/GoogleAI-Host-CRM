import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  serverTimestamp, 
  increment, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserRole } from '../types';

export interface PointTransaction {
  userId: string;
  userName: string;
  amount: number;
  type: 'earned' | 'spent' | 'recharged' | 'withdrawn' | 'adjustment';
  reason: string;
  metadata?: {
    taskId?: string;
    journalId?: string;
    orderId?: string;
    performedById?: string;
    performedByName?: string;
  };
  timestamp: any;
}

export const pointsService = {
  /**
   * Award points to an employee for task completion
   */
  awardEmployeePoints: async (
    employeeId: string, 
    employeeName: string, 
    points: number, 
    reason: string, 
    metadata: PointTransaction['metadata']
  ) => {
    if (points <= 0) return;

    const batch = writeBatch(db);
    
    // 1. Create Transaction Log
    const logRef = doc(collection(db, 'point_history'));
    const transaction = {
      userId: employeeId,
      userName: employeeName,
      amount: points,
      points: points,
      type: 'earned',
      reason,
      metadata,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      createdById: metadata?.performedById || 'system',
      createdBy: metadata?.performedByName || 'System'
    };
    batch.set(logRef, transaction);

    // 2. Update Employee Profile Points
    const employeeRef = doc(db, 'users', employeeId);
    batch.update(employeeRef, {
      points: increment(points),
      totalEarnedPoints: increment(points),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  },

  /**
   * Deduct points from a client (e.g., for reassignment or repeated requests)
   */
  deductClientPoints: async (
    clientId: string, 
    clientName: string, 
    points: number, 
    reason: string, 
    metadata: PointTransaction['metadata']
  ) => {
    if (points <= 0) return;

    const batch = writeBatch(db);
    
    // 1. Create Transaction Log
    const logRef = doc(collection(db, 'point_history'));
    const transaction = {
      userId: clientId,
      userName: clientName,
      amount: -points,
      points: points,
      type: 'spent',
      reason,
      metadata,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      createdById: metadata?.performedById || 'system',
      createdBy: metadata?.performedByName || 'System'
    };
    batch.set(logRef, transaction);

    // 2. Update Client Profile Points (can go negative)
    const clientRef = doc(db, 'users', clientId);
    batch.update(clientRef, {
      points: increment(-points),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  },

  /**
   * Top-up client points
   */
  rechargeClientPoints: async (
    clientId: string, 
    clientName: string, 
    points: number, 
    reason: string,
    performedBy: { id: string, name: string }
  ) => {
    const batch = writeBatch(db);
    
    const logRef = doc(collection(db, 'point_history'));
    const transaction = {
      userId: clientId,
      userName: clientName,
      amount: points,
      points: points,
      type: 'recharged',
      reason: reason || 'Top-up recharge',
      metadata: {
        performedById: performedBy.id,
        performedByName: performedBy.name
      },
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      createdById: performedBy.id,
      createdBy: performedBy.name
    };
    batch.set(logRef, transaction);

    const clientRef = doc(db, 'users', clientId);
    batch.update(clientRef, {
      points: increment(points),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  },

  /**
   * Withdraw points (for employees)
   */
  withdrawEmployeePoints: async (
    employeeId: string, 
    employeeName: string, 
    points: number, 
    reason: string,
    performedBy: { id: string, name: string }
  ) => {
    const employeeSnap = await getDoc(doc(db, 'users', employeeId));
    const currentPoints = employeeSnap.data()?.points || 0;

    if (currentPoints < points) {
      throw new Error('Insufficient points balance for withdrawal');
    }

    const batch = writeBatch(db);
    
    const logRef = doc(collection(db, 'point_history'));
    const transaction = {
      userId: employeeId,
      userName: employeeName,
      amount: -points,
      points: points,
      type: 'withdrawn',
      reason: reason || 'Points withdrawal / Cash-out',
      metadata: {
        performedById: performedBy.id,
        performedByName: performedBy.name
      },
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      createdById: performedBy.id,
      createdBy: performedBy.name
    };
    batch.set(logRef, transaction);

    const employeeRef = doc(db, 'users', employeeId);
    batch.update(employeeRef, {
      points: increment(-points),
      totalWithdrawnPoints: increment(points),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }
};
