import type { APIRequestContext } from "@playwright/test";

// What a test can add to one request: `at()` from clock.ts, or its own headers.
export interface RequestOptions {
  headers?: Record<string, string>;
}

// One resource of the API. Its requests go through `requestContext`, so they share that context's
// session. Methods return the raw response: the test decides which status it expects.
export abstract class BaseController {
  constructor(protected readonly requestContext: APIRequestContext) {}
}
