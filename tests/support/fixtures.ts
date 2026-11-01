import { type APIRequestContext, test as base, expect } from "@playwright/test";
import { ApiClient } from "./api/ApiClient";
import { createUser, type TestUser } from "./users";

interface Fixtures {
  api: ApiClient;
  loggedInApi: ApiClient;
  createApiClient: () => Promise<ApiClient>;
  otherUserApi: ApiClient;
  registeredUser: TestUser;
  loggedInUser: TestUser;
}

// `api` shares the session of the test's `request`. `createApiClient` makes a client with its own
// session, such as a second device, and closes it when the test ends. `otherUserApi` is such a
// client, logged in as a second User.
// `registeredUser` has no session anywhere; `loggedInUser` is that User, logged in on `api`.
// `loggedInApi` is that same `api`, for a test that needs the session but not the User.
export const test = base.extend<Fixtures>({
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },
  loggedInApi: async ({ api, loggedInUser: _loggedInUser }, use) => {
    await use(api);
  },
  createApiClient: async ({ playwright, baseURL }, use) => {
    const requestContexts: APIRequestContext[] = [];
    await use(async () => {
      const requestContext = await playwright.request.newContext({ baseURL });
      requestContexts.push(requestContext);
      return new ApiClient(requestContext);
    });
    await Promise.all(requestContexts.map((requestContext) => requestContext.dispose()));
  },
  otherUserApi: async ({ createApiClient }, use) => {
    const otherUserApi = await createApiClient();
    expect((await otherUserApi.auth.login(await createUser())).status()).toBe(200);
    await use(otherUserApi);
  },
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured first argument.
  registeredUser: async ({}, use) => {
    await use(await createUser());
  },
  loggedInUser: async ({ api, registeredUser }, use) => {
    expect((await api.auth.login(registeredUser)).status()).toBe(200);
    await use(registeredUser);
  },
});

export { expect };
