import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Initialize Firebase Admin SDK (singleton)
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    }

    const adminDb = getFirestore();
    const adminRtdb = getDatabase();
    
    const timestamp = new Date().toISOString();
    
    // 1. Test Firestore (Main Database)
    const testDocRef = adminDb.collection('system_tests').doc('connection_test');
    await testDocRef.set({
      lastTest: timestamp,
      status: 'OK',
      database: 'Firestore'
    });
    
    // 2. Test Realtime Database (Live Scoreboard)
    const rtdbRef = adminRtdb.ref('system_tests/connection_test');
    await rtdbRef.set({
      lastTest: timestamp,
      status: 'OK',
      database: 'Realtime Database'
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to both Firestore and Realtime Database!',
      timestamp
    });
  } catch (error: any) {
    console.error('Firebase Connection Test Failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to connect to Firebase. Check your .env.local keys.',
      error: error.message
    }, { status: 500 });
  }
}
