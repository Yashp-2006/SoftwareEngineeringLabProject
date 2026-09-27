export async function hashPassword(password: string): Promise<string> {
  if (/^[a-f0-9]{64}$/i.test(password)) return password;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(input: string, stored: string): Promise<boolean> {
  return /^[a-f0-9]{64}$/i.test(stored) ? (await hashPassword(input)) === stored : input === stored;
}
