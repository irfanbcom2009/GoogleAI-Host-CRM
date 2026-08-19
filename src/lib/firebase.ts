import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  persistentSingleTabManager,
  doc, 
  addDoc, 
  collection, 
  deleteDoc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Import the Firebase configuration from the root
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Resilient Firestore initialization with persistent local cache fallback
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true
  }, firebaseConfig.firestoreDatabaseId);
  console.log("Firestore successfully initialized with multi-tab offline persistence and long-polling.");
} catch (e: any) {
  console.warn("Could not enable multi-tab local cache. Trying single-tab local cache fallback...", e);
  try {
    if (e.message?.includes('already been initialized')) {
      dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    } else {
      dbInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentSingleTabManager({})
        }),
        experimentalForceLongPolling: true
      }, firebaseConfig.firestoreDatabaseId);
      console.log("Firestore initialized with single-tab offline persistence.");
    }
  } catch (e2: any) {
    console.warn("Could not enable single-tab local cache either. Falling back to basic Firestore.", e2);
    try {
      if (e2.message?.includes('already been initialized')) {
        dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
      } else {
        dbInstance = initializeFirestore(app, {
          experimentalForceLongPolling: true
        }, firebaseConfig.firestoreDatabaseId);
      }
    } catch (e3) {
      dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
  }
}

// Connection validation helper
export async function checkFirestoreConnection(): Promise<boolean> {
  try {
    // Attempt to fetch a dummy document from the server
    await getDocFromServer(doc(dbInstance, 'test', 'connection_probe'));
    return true;
  } catch (error: any) {
    const code = error?.code;
    const message = error?.message || String(error);
    // If the error code is 'permission-denied', we reached the Firestore backend successfully!
    if (code === 'permission-denied' || message.includes('permission-denied') || message.includes('insufficient permissions')) {
      return true;
    }
    // Otherwise, we likely have a connection failure (offline, DNS block, or adblocker)
    console.warn("Firestore connection check failed:", error);
    return false;
  }
}

// Call probe automatically on boot to print diagnostic
checkFirestoreConnection().then(connected => {
  if (connected) {
    console.log("Firestore connection probe: ONLINE");
  } else {
    console.warn("Firestore connection probe: OFFLINE or BLOCKED. The app will run in offline mode.");
  }
});

export const db = dbInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);


export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getErrorMessage(error: any): string {
  try {
    const parsed = JSON.parse(error.message);
    if (parsed.error && parsed.error.includes('Missing or insufficient permissions')) {
      return "You don't have permission to perform this action. Please contact your administrator.";
    }
  } catch (e) {
    // If it's not a JSON string, handle common Firebase error codes or messages
    const message = error.message || String(error);
    if (message.includes('permission-denied') || message.includes('insufficient permissions')) {
      return "Access denied. You may need higher privileges for this operation.";
    }
    if (message.includes('quota-exceeded')) {
      return "Daily limit reached. Please try again tomorrow.";
    }
    if (message.includes('offline')) {
      return "Check your internet connection and try again.";
    }
  }
  return "Something went wrong. Please try again or contact support.";
}

export async function logActivity(userId: string, userName: string, action: string, details: string, userPhotoURL?: string) {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      userId,
      userName,
      userPhotoURL: userPhotoURL || null,
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

export async function moveToTrash(collectionName: string, id: string, data: any, deletedBy: string) {
  try {
    // Sanitize data to remove undefined values which Firestore doesn't like
    const sanitizedData = JSON.parse(JSON.stringify(data));
    
    await addDoc(collection(db, 'trash'), {
      originalCollection: collectionName,
      data: sanitizedData,
      deletedAt: serverTimestamp(),
      deletedBy: deletedBy
    });
    
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    console.error(`Error moving ${collectionName}/${id} to trash:`, error);
    handleFirestoreError(error, OperationType.DELETE, `trash/${collectionName}`);
  }
}

export async function sendNotification(userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', link?: string) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      message,
      type,
      link,
      isRead: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}
