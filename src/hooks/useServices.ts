import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SERVICES_CATALOG } from '../constants/services';

export const useServices = () => {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const docRef = doc(db, 'settings', 'services');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setCatalog(docSnap.data().categories || []);
        } else {
          // Initialize with default catalog if not exists
          await setDoc(docRef, { categories: SERVICES_CATALOG, updatedAt: serverTimestamp() });
          setCatalog(SERVICES_CATALOG);
        }
      } catch (error) {
        console.error('Error fetching services catalog:', error);
        setCatalog(SERVICES_CATALOG);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, []);

  return { catalog, loading };
};
