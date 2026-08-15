import { adminDb } from './src/lib/firebase-admin';

async function run() {
  const ref = adminDb.collection('competitions').doc('TESTCOMP').collection('categories').doc('TESTCAT');
  
  await ref.set({
    name: 'TEST CATEGORY',
    athletes: [{ name: 'Test Athlete' }],
    entries: 1
  });
  
  console.log('Set initial data.');
  
  await ref.set({
    name: 'TEST CATEGORY',
    entries: 1,
    status: 'upcoming'
  }, { merge: true });
  
  console.log('Merged new data.');
  
  const doc = await ref.get();
  console.log('Resulting doc:', doc.data());
}

run().catch(console.error);
