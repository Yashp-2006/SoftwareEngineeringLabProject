import * as dotenv from 'dotenv';
dotenv.config();

import { GoogleAuth } from 'google-auth-library';

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

const keyFile = {
  project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
  client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  private_key: privateKey
};

async function test() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  
  try {
    console.log("Creating client from JSON...");
    const client = auth.fromJSON(keyFile);
    console.log("Client created successfully. Getting access token...");
    const token = await client.getAccessToken();
    console.log("Token obtained successfully!", !!token.token);
  } catch (err) {
    console.error("Auth library error:", err);
  }
}

test();
