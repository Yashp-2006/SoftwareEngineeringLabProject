import * as dotenv from 'dotenv';
dotenv.config();

const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';

console.log("Length:", pk.length);
console.log("Starts with '-----BEGIN PRIVATE KEY-----':", pk.startsWith('-----BEGIN PRIVATE KEY-----'));
console.log("Starts with '\"' (quote):", pk.startsWith('"'));
console.log("Ends with '\"' (quote):", pk.endsWith('"'));
console.log("Contains escaped \\n:", pk.includes('\\n'));
console.log("Contains carriage return \\r:", pk.includes('\r'));
console.log("Contains real newline:", pk.includes('\n'));
console.log("Snippet start:", pk.substring(0, 40));
console.log("Snippet end:", pk.substring(pk.length - 40));
