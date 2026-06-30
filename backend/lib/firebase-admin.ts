import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

function initAdmin() {
  if (getApps().length > 0) return getApp();
  
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;
    
  if (process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://dummy.firebaseio.com'
    });
  }
  
  // Dummy initialization for Next.js build time
  return initializeApp({ 
    projectId: 'dummy-project',
    databaseURL: 'https://dummy.firebaseio.com'
  });
}

const app = initAdmin();

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export const adminRtdb = getDatabase(app);
