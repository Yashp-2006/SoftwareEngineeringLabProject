import { adminDb } from './src/lib/firebase-admin';

async function run() {
  const docs = await adminDb.collection('competitions').doc('R8n2f9tPjYvYwE1j9VfM').collection('categories').get();
  const doc = docs.docs[0];
  await doc.ref.update({ athletes: [{ id: 'test', name: 'TEST ATHLETE' }] });
  console.log('updated');
}

run();
