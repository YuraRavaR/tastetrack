// `bytes` random bytes as URL-safe base64 without padding, for tokens that go in cookies and URLs.
export function randomToken(bytes: number): string {
  const random = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...random))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

// Crockford's base32: digits and capitals without I, L, O and U, so a code read out or typed by
// hand has no look-alikes. 32 divides 256, so taking each random byte mod 32 is unbiased.
const codeAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// `length` random characters of Crockford's base32, for codes a person reads and types.
export function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => codeAlphabet[byte % codeAlphabet.length]).join("");
}
