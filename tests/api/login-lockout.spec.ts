import { type APIRequestContext, expect, test } from "@playwright/test";
import { at } from "../support/clock";
import { createUser, uniqueUsername } from "../support/users";

const minute = 60 * 1000;

function logIn(
  api: APIRequestContext,
  credentials: { username: string; password: string },
  time: number,
  headers: Record<string, string> = {},
) {
  return api.post("/api/auth/login", {
    data: credentials,
    headers: { ...at(time).headers, ...headers },
  });
}

async function failLogins(api: APIRequestContext, username: string, count: number, time: number) {
  for (let i = 0; i < count; i++) {
    const failed = await logIn(api, { username, password: "not the password" }, time);
    expect(failed.status()).toBe(401);
  }
}

// The project's base URL with its host replaced. Local Wrangler listens on IPv4 and IPv6
// loopback and reports each as the client IP it is, so the two loopback hosts are two real IPs.
function onHost(baseURL: string | undefined, host: string): string {
  if (!baseURL) throw new Error("The lockout tests need the project's baseURL");
  const url = new URL(baseURL);
  url.hostname = host;
  return url.origin;
}

test("5 failed logins lock the Username from that IP for 15 minutes", async ({ request }) => {
  const user = await createUser();
  const start = Date.now();
  await failLogins(request, user.username, 5, start);

  // The right password is refused too while the lockout lasts.
  const locked = await logIn(request, user, start);
  expect(locked.status()).toBe(429);
  expect(await locked.json()).toEqual({ error: "too_many_attempts" });
  expect(locked.headers()["retry-after"]).toBe("900");

  // Attempts during the lockout don't make it any longer.
  const lastSecond = await logIn(request, user, start + 15 * minute - 1000);
  expect(lastSecond.status()).toBe(429);
  expect(lastSecond.headers()["retry-after"]).toBe("1");
  expect((await logIn(request, user, start + 15 * minute)).status()).toBe(200);
});

test("the lockout matches the Username in any letter case", async ({ request }) => {
  const user = await createUser();
  const start = Date.now();
  await failLogins(request, user.username.toUpperCase(), 5, start);

  expect((await logIn(request, user, start)).status()).toBe(429);
});

test("the same Username from another IP is unaffected", async ({ playwright, baseURL }) => {
  const user = await createUser();
  const ipv4 = await playwright.request.newContext({ baseURL: onHost(baseURL, "127.0.0.1") });
  const ipv6 = await playwright.request.newContext({ baseURL: onHost(baseURL, "[::1]") });
  const start = Date.now();
  await failLogins(ipv4, user.username, 5, start);
  expect((await logIn(ipv4, user, start)).status()).toBe(429);

  const otherIp = await logIn(ipv6, user, start);

  expect(otherIp.status()).toBe(200);
  // Failures from the other IP add nothing to this one's count either.
  await failLogins(ipv6, user.username, 4, start);
  expect((await logIn(ipv6, user, start)).status()).toBe(200);
  await ipv4.dispose();
  await ipv6.dispose();
});

test("a successful login resets the failure count", async ({ request }) => {
  const user = await createUser();
  const start = Date.now();
  await failLogins(request, user.username, 4, start);
  expect((await logIn(request, user, start)).status()).toBe(200);

  // Without the reset, the fifth of these would lock the Username.
  await failLogins(request, user.username, 4, start);

  expect((await logIn(request, user, start)).status()).toBe(200);
});

test("failures stop counting 15 minutes after the last one", async ({ request }) => {
  const user = await createUser();
  const start = Date.now();
  await failLogins(request, user.username, 4, start);

  // The fifth failure comes too late to join the first four.
  await failLogins(request, user.username, 4, start + 15 * minute);

  expect((await logIn(request, user, start + 15 * minute)).status()).toBe(200);
});

test("a locked unknown Username looks the same as a locked User", async ({ request }) => {
  const user = await createUser();
  const unknown = { username: uniqueUsername(), password: user.password };
  const start = Date.now();
  await failLogins(request, user.username, 5, start);
  await failLogins(request, unknown.username, 5, start);

  const lockedUser = await logIn(request, user, start);
  const lockedUnknown = await logIn(request, unknown, start);

  expect(lockedUnknown.status()).toBe(lockedUser.status());
  expect(await lockedUnknown.json()).toEqual(await lockedUser.json());
  expect(lockedUnknown.headers()["retry-after"]).toBe(lockedUser.headers()["retry-after"]);
});

test("a forwarding header doesn't change the IP a login counts against", async ({ request }) => {
  const user = await createUser();
  const start = Date.now();
  for (let i = 0; i < 5; i++) {
    const failed = await logIn(request, { ...user, password: "not the password" }, start, {
      "X-Forwarded-For": `203.0.113.${i}`,
    });
    expect(failed.status()).toBe(401);
  }

  const forwarded = await logIn(request, user, start, { "X-Forwarded-For": "198.51.100.1" });

  expect(forwarded.status()).toBe(429);
});
