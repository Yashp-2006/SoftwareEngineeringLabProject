export async function hashPassword(password: string): Promise<string> {
  // If it's already a 64-character hex string (a SHA-256 hash), don't double hash it
  // This helps with backward compatibility if somehow it's passed around
  if (/^[a-f0-9]{64}$/i.test(password)) {
    return password;
  }

  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(input: string, storedHashOrPlain: string): Promise<boolean> {
  // If the stored string is 64 hex characters, it's a hash. Check the hash.
  if (/^[a-f0-9]{64}$/i.test(storedHashOrPlain)) {
    const inputHash = await hashPassword(input);
    return inputHash === storedHashOrPlain;
  }
  // Fallback for plain-text backward compatibility
  return input === storedHashOrPlain;
}
