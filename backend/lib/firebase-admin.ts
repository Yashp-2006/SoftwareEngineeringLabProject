import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

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
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://dummy.firebaseio.com',
    });
  }

  // Dummy initialization for Next.js build time
  return initializeApp({
    projectId: 'dummy-project',
    databaseURL: 'https://dummy.firebaseio.com',
  });
}

const app = initAdmin();

export const adminDb = getFirestore(app);
export const adminRtdb = getDatabase(app);

/**
 * Verify a Firebase ID token using the Firebase Auth REST API.
 * Avoids importing firebase-admin/auth → jwks-rsa → jose which causes
 * ERR_REQUIRE_ESM on Vercel Turbopack builds.
 */
export async function verifySession(
  token: string | null | undefined,
): Promise<{ uid: string | null; role: string | null }> {
  if (!token) return { uid: null, role: null };
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return { uid: null, role: null };

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      },
    );

    if (!res.ok) return { uid: null, role: null };

    const data = await res.json();
    const uid: string | undefined = data.users?.[0]?.localId;
    if (!uid) return { uid: null, role: null };

    const userDoc = await adminDb.collection('users').doc(uid).get();
    const role = userDoc.exists ? (userDoc.data()?.role ?? 'audience') : 'audience';
    return { uid, role };
  } catch (error) {
    console.error('Failed to verify session token:', error);
    return { uid: null, role: null };
  }
}
