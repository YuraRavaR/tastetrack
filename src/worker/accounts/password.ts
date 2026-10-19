// PBKDF2-SHA256 password hashing through Web Crypto (ADR-0007). Standard Web Crypto only, so the
// Operator CLI hashes in Node exactly as the Worker does.

// The highest count that fits the free plan's 10 ms CPU budget, measured on staging (issue #6).
export const targetIterations = 20_000;

const saltBytes = 16;
const keyBits = 256;

export interface PasswordHash {
  hash: string;
  salt: string;
  iterations: number;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    keyBits,
  );
  return new Uint8Array(bits);
}

// Compares every byte whatever the first difference, so timing doesn't reveal how much matched.
function equalInConstantTime(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

export async function hashPassword(
  password: string,
  iterations = targetIterations,
): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
  const hash = await derive(password, salt, iterations);
  return { hash: toBase64(hash), salt: toBase64(salt), iterations };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const hash = await derive(password, fromBase64(stored.salt), stored.iterations);
  return equalInConstantTime(hash, fromBase64(stored.hash));
}
