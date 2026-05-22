import * as admin from 'firebase-admin';

// Initialize the Firebase Admin SDK if it hasn't been initialized yet.
// Using a singleton pattern to prevent "already exists" errors in serverless environments.
if (!admin.apps.length) {
  try {
    // Parse the private key correctly, replacing escaped newlines.
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
      ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !privateKey) {
      throw new Error('Missing Firebase Admin environment variables. Please check .env.local');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL // Need RTDB URL for admin as well
    });
    
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Firebase Admin SDK initialization error', error);
  }
}

// Export the instances for use in API routes
export const adminDb = admin.firestore();
export const adminRtdb = admin.database();
export const adminAuth = admin.auth();
