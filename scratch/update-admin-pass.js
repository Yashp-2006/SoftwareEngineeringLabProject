const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/Yash/Desktop/VS Code/TaikaiX/.env' });

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: privateKey
  })
});

async function updateAdmin() {
  const user = await admin.auth().getUserByEmail('admin@taikaix.com');
  console.log("Found admin user:", user.uid);
  await admin.auth().updateUser(user.uid, {
    password: 'password123'
  });
  console.log("Updated password of admin@taikaix.com to password123 successfully!");
}

updateAdmin().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
