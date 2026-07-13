import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Initialize Firebase using a singleton pattern
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export the client SDK instances for use in React components
// We wrap in try-catch to avoid crashing the Next.js build process when evaluating the module on the server
let db: ReturnType<typeof getFirestore>;
let rtdb: ReturnType<typeof getDatabase>;
let auth: ReturnType<typeof getAuth>;

try {
  db = getFirestore(app);
  rtdb = getDatabase(app);
  auth = getAuth(app);
} catch (error) {
  console.warn('Firebase services failed to initialize synchronously. This is normal during Next.js build.', error);
}

export { db, rtdb, auth };
