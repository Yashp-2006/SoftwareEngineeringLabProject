import { config } from 'dotenv';
config({ path: '.env.local' });
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function run() {
  const ref = doc(db, 'competitions', 'TESTCOMP', 'categories', 'TESTCAT');
  
  await setDoc(ref, {
    name: 'TEST CATEGORY',
    athletes: [{ name: 'Test Athlete' }],
    entries: 1
  });
  
  console.log('Set initial data.');
  
  await setDoc(ref, {
    name: 'TEST CATEGORY',
    entries: 1,
    status: 'upcoming'
  }, { merge: true });
  
  console.log('Merged new data.');
  
  const d = await getDoc(ref);
  console.log('Resulting doc:', d.data());
  process.exit(0);
}

run().catch(console.error);
