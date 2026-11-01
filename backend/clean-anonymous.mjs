import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
});

const auth = getAuth(app);

async function purgeAnonymousUsers() {
  console.log('Listing users from Firebase Auth...');
  let nextPageToken;
  let anonUids = [];
  let totalUsers = 0;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    totalUsers += listResult.users.length;
    for (const user of listResult.users) {
      if (user.providerData.length === 0 && !user.email && !user.phoneNumber) {
        anonUids.push(user.uid);
      }
    }
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`Total users found in Firebase Auth: ${totalUsers}`);
  console.log(`Anonymous users found: ${anonUids.length}`);

  if (anonUids.length > 0) {
    console.log(`Deleting ${anonUids.length} anonymous users...`);
    for (let i = 0; i < anonUids.length; i += 1000) {
      const batch = anonUids.slice(i, i + 1000);
      const res = await auth.deleteUsers(batch);
      console.log(`Batch deleted: ${res.successCount} success, ${res.failureCount} errors.`);
    }
  }

  console.log('Done!');
}

purgeAnonymousUsers().catch(console.error);
