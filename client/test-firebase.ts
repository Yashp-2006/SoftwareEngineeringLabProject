import { loadEnvConfig } from '@next/env';
// Load environment variables from .env.local
const projectDir = process.cwd();
loadEnvConfig(projectDir);

import * as admin from 'firebase-admin';

async function testConnection() {
  try {
    const timestamp = new Date().toISOString();
    console.log('Testing connection to Delhi (asia-south2) servers...');
    
    // Initialize Admin SDK locally for test
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
    
    // Debug logging to diagnose formatting
    console.log('--- DEBUG INFO ---');
    console.log('Key starts with quotes?', privateKey.startsWith('"'));
    console.log('Key contains literal \\n strings?', privateKey.includes('\\n'));
    console.log('Key contains actual newlines?', privateKey.includes('\n'));
    console.log('Key length:', privateKey.length);
    console.log('Start of key:', privateKey.substring(0, 40));
    console.log('End of key:', privateKey.substring(privateKey.length - 40));
    console.log('------------------');

    // Exact quote stripping
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    
    // Replace escaped newlines with actual newlines, and strip any rogue Windows carriage returns
    privateKey = privateKey.replace(/\\n/g, '\n').replace(/\r/g, '').trim();

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey,
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });
    }

    const adminDb = admin.firestore();
    const adminRtdb = admin.database();
    
    // Test Firestore
    console.log('Writing to Firestore...');
    const testDocRef = adminDb.collection('system_tests').doc('connection_test');
    await testDocRef.set({
      lastTest: timestamp,
      status: 'OK',
      database: 'Firestore'
    });
    console.log('✅ Firestore write successful!');
    
    // Test RTDB
    console.log('Writing to Realtime Database...');
    const rtdbRef = adminRtdb.ref('system_tests/connection_test');
    await rtdbRef.set({
      lastTest: timestamp,
      status: 'OK',
      database: 'Realtime Database'
    });
    console.log('✅ Realtime Database write successful!');
    
    console.log('\nAll Firebase connections are working perfectly!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection Failed:', error);
    process.exit(1);
  }
}

testConnection();
