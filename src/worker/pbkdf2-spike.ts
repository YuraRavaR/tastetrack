// The PBKDF2 spike (issue #6, ADR-0007): one simulated login per request, with the iteration
// count as the only variable, so `wrangler tail` on staging reports the CPU time a real login
// would cost at that count. Reachable only with test hooks on.
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { appMeta } from "../db/schema";

// Fixed inputs from RFC 7914's PBKDF2-HMAC-SHA256 test vector, so the result is checkable.
// The salt's length doesn't change the cost: it only enters the first HMAC of each block.
const password = "passwd";
const salt = "salt";
const keyBits = 256;

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function simulateLogin(db: DrizzleD1Database, iterations: number): Promise<string> {
  const encoder = new TextEncoder();

  // Stands in for loading the User row by Username.
  await db.select().from(appMeta).limit(1);

  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations },
    key,
    keyBits,
  );

  // Stands in for checking the stored hash and issuing a session: a constant-time compare, a
  // random session token, and the SHA-256 of that token that would be stored.
  crypto.subtle.timingSafeEqual(derived, new ArrayBuffer(keyBits / 8));
  const token = crypto.getRandomValues(new Uint8Array(32));
  await crypto.subtle.digest("SHA-256", token);

  return toHex(derived);
}
