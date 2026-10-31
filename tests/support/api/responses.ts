import { type APIResponse, expect } from "@playwright/test";

// The JSON body of a response, which must have `status`.
export async function bodyOf(pending: APIResponse | Promise<APIResponse>, status = 200) {
  const response = await pending;
  expect(response.status(), response.url()).toBe(status);
  return response.json();
}
