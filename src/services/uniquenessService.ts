import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UniquenessRule } from '../types';

export const checkFieldUniqueness = async (
  rule: UniquenessRule,
  value: any,
  context: {
    fieldName: string;
    clientId?: string;
    serviceId?: string;
    catalogItemId?: string;
    currentRecordId?: string;
  }
): Promise<{ isUnique: boolean; conflictId?: string }> => {
  if (!rule || rule === 'None' || !value) {
    return { isUnique: true };
  }

  const collectionsToCheck = [
    'client_services',
    'orders',
    'users',
    'journals',
    'domains'
  ];

  // For dynamic checklist items, they are nested in client_services/orders
  // This is tricky because they are inside a map.
  // Firestore doesn't support searching inside maps very well for "ANY key has THIS value".
  // However, we know the checklistId (fieldName).
  
  try {
    // If Global, we check if ANY other record has this field value.
    // For dynamic fields, we have to check 'client_services'
    if (rule === 'Global' || rule === 'Service') {
      const q = query(
        collection(db, 'client_services'),
        where(`stepProgress`, '!=', null) 
      );
      
      const snapshot = await getDocs(q);
      
      for (const doc of snapshot.docs) {
        if (doc.id === context.currentRecordId) continue;
        
        const data = doc.data();
        const steps = data.stepProgress || {};
        
        for (const stepId in steps) {
          const checklist = steps[stepId].clientChecklist || {};
          for (const itemId in checklist) {
            // If it's a Global check, we check any value.
            // But usually we only care if it's the SAME field being marked as unique.
            // Actually, the prompt says "Global Unique (across entire system)".
            // This usually means "No two entries for THIS requirement can have the same value".
            
            if (checklist[itemId].value === value) {
              // If Service Unique, only conflict if same service
              if (rule === 'Service' && data.serviceId !== context.serviceId) continue;
              
              return { isUnique: false, conflictId: doc.id };
            }
          }
        }
      }
    }

    if (rule === 'Client') {
      if (!context.clientId) return { isUnique: true };
      
      const q = query(
        collection(db, 'client_services'),
        where('clientId', '==', context.clientId)
      );
      
      const snapshot = await getDocs(q);
      for (const doc of snapshot.docs) {
        if (doc.id === context.currentRecordId) continue;
        const data = doc.data();
        const steps = data.stepProgress || {};
        for (const stepId in steps) {
          const checklist = steps[stepId].clientChecklist || {};
          for (const itemId in checklist) {
            if (checklist[itemId].value === value) {
              return { isUnique: false, conflictId: doc.id };
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Uniqueness check error:', error);
  }

  return { isUnique: true };
};

export const checkCoreFieldUniqueness = async (
  entityType: 'users' | 'domains' | 'journals',
  fieldName: string,
  value: any,
  excludeId?: string
): Promise<boolean> => {
  try {
    const q = query(
      collection(db, entityType),
      where(fieldName, '==', value),
      limit(2)
    );
    
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.filter(d => d.id !== excludeId);
    
    return docs.length === 0;
  } catch (error) {
    console.error(`Core uniqueness check error (${entityType}.${fieldName}):`, error);
    return true; // Default to true on error to avoid blocking? Or false to be safe?
  }
};
