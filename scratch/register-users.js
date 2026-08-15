const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: 'c:/Users/Yash/Desktop/VS Code/TaikaiX/.env' });

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (!privateKey) {
  console.error("FIREBASE_ADMIN_PRIVATE_KEY is missing from environment!");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: privateKey
  })
});

const usersToCreate = [
  { email: 'example@gmail.com', password: 'password123' },
  { email: 'admin@taikaix.com', password: 'password123' }
];

async function seedUsers() {
  for (const u of usersToCreate) {
    try {
      console.log(`Checking if user exists: ${u.email}...`);
      const userRecord = await admin.auth().getUserByEmail(u.email);
      console.log(`User already exists: ${userRecord.email}`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log(`Creating user: ${u.email}...`);
        const userRecord = await admin.auth().createUser({
          email: u.email,
          emailVerified: true,
          password: u.password,
          displayName: u.email.split('@')[0]
        });
        console.log(`Successfully created user: ${userRecord.uid}`);
      } else {
        console.error(`Error checking/creating user ${u.email}:`, err);
      }
    }
  }
}

seedUsers().then(() => {
  console.log("Seeding complete!");
  process.exit(0);
}).catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
