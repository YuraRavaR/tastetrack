// `bytes` random bytes as URL-safe base64 without padding, for tokens that go in cookies and URLs.
export function randomToken(bytes: number): string {
  const random = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...random))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
