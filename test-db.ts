import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const { adminDb } = await import('./backend/lib/firebase-admin');
  console.log("PROJECT_ID:", process.env.FIREBASE_ADMIN_PROJECT_ID);
  console.log("CLIENT_EMAIL:", process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
  console.log("PRIVATE_KEY exists:", !!process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  
  try {
    const snap = await adminDb.collection('competitions').get();
    console.log("SUCCESS! Found competitions count:", snap.size);
    snap.docs.forEach(d => console.log("- ID:", d.id, "Name:", d.data().name));
  } catch (err) {
    console.error("FIRESTORE ERROR:", err);
  }
}

test();
