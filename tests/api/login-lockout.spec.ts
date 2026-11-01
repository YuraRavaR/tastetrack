import type { ApiClient } from "../support/api/ApiClient";
import { at } from "../support/clock";
import { expect, test } from "../support/fixtures";
import { uniqueUsername } from "../support/scenarios/users";

const minute = 60 * 1000;

async function failLogins(api: ApiClient, username: string, count: number, time: number) {
  for (let i = 0; i < count; i++) {
    const failed = await api.auth.login({ username, password: "not the password" }, at(time));
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

test("5 failed logins lock the Username from that IP for 15 minutes", async ({
  api,
  registeredUser,
}) => {
  const start = Date.now();
  await failLogins(api, registeredUser.username, 5, start);

  // The right password is refused too while the lockout lasts.
  const locked = await api.auth.login(registeredUser, at(start));
  expect(locked.status()).toBe(429);
  expect(await locked.json()).toEqual({ error: "too_many_attempts" });
  expect(locked.headers()["retry-after"]).toBe("900");

  // Attempts during the lockout don't make it any longer.
  const lastSecond = await api.auth.login(registeredUser, at(start + 15 * minute - 1000));
  expect(lastSecond.status()).toBe(429);
  expect(lastSecond.headers()["retry-after"]).toBe("1");
  expect((await api.auth.login(registeredUser, at(start + 15 * minute))).status()).toBe(200);
});

test("the lockout matches the Username in any letter case", async ({ api, registeredUser }) => {
  const start = Date.now();
  await failLogins(api, registeredUser.username.toUpperCase(), 5, start);

  expect((await api.auth.login(registeredUser, at(start))).status()).toBe(429);
});

test("the same Username from another IP is unaffected", async ({
  createApiClient,
  baseURL,
  registeredUser,
}) => {
  const ipv4 = await createApiClient({ baseURL: onHost(baseURL, "127.0.0.1") });
  const ipv6 = await createApiClient({ baseURL: onHost(baseURL, "[::1]") });
  const start = Date.now();
  await failLogins(ipv4, registeredUser.username, 5, start);
  expect((await ipv4.auth.login(registeredUser, at(start))).status()).toBe(429);

  const otherIp = await ipv6.auth.login(registeredUser, at(start));

  expect(otherIp.status()).toBe(200);
  // Failures from the other IP add nothing to this one's count either.
  await failLogins(ipv6, registeredUser.username, 4, start);
  expect((await ipv6.auth.login(registeredUser, at(start))).status()).toBe(200);
});

test("a successful login resets the failure count", async ({ api, registeredUser }) => {
  const start = Date.now();
  await failLogins(api, registeredUser.username, 4, start);
  expect((await api.auth.login(registeredUser, at(start))).status()).toBe(200);

  // Without the reset, the fifth of these would lock the Username.
  await failLogins(api, registeredUser.username, 4, start);

  expect((await api.auth.login(registeredUser, at(start))).status()).toBe(200);
});

test("failures stop counting 15 minutes after the last one", async ({ api, registeredUser }) => {
  const start = Date.now();
  await failLogins(api, registeredUser.username, 4, start);

  // The fifth failure comes too late to join the first four.
  await failLogins(api, registeredUser.username, 4, start + 15 * minute);

  expect((await api.auth.login(registeredUser, at(start + 15 * minute))).status()).toBe(200);
});

test("a locked unknown Username looks the same as a locked User", async ({
  api,
  registeredUser,
}) => {
  const unknown = { username: uniqueUsername(), password: registeredUser.password };
  const start = Date.now();
  await failLogins(api, registeredUser.username, 5, start);
  await failLogins(api, unknown.username, 5, start);

  const lockedUser = await api.auth.login(registeredUser, at(start));
  const lockedUnknown = await api.auth.login(unknown, at(start));

  expect(lockedUnknown.status()).toBe(lockedUser.status());
  expect(await lockedUnknown.json()).toEqual(await lockedUser.json());
  expect(lockedUnknown.headers()["retry-after"]).toBe(lockedUser.headers()["retry-after"]);
});

test("a forwarding header doesn't change the IP a login counts against", async ({
  api,
  registeredUser,
}) => {
  const start = Date.now();
  const forwardedFrom = (ip: string) => {
    return { headers: { ...at(start).headers, "X-Forwarded-For": ip } };
  };
  for (let i = 0; i < 5; i++) {
    const failed = await api.auth.login(
      { ...registeredUser, password: "not the password" },
      forwardedFrom(`203.0.113.${i}`),
    );
    expect(failed.status()).toBe(401);
  }

  const forwarded = await api.auth.login(registeredUser, forwardedFrom("198.51.100.1"));

  expect(forwarded.status()).toBe(429);
});
