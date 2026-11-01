import { type APIResponse, expect } from "@playwright/test";
import type { z } from "zod";

// Expects a response to have `status`, and returns its JSON body. A `schema` checks the body too and
// gives the result its type: pass one when a test checks only part of a response, and for one happy
// path per route. A full `toEqual` needs none. The body comes back unparsed, because parsing drops
// unknown fields and `toEqual` would then miss a leaked one.
export async function expectBody<Schema extends z.ZodType = z.ZodAny>(
  pending: APIResponse | Promise<APIResponse>,
  status = 200,
  schema?: Schema,
): Promise<z.infer<Schema>> {
  const response = await pending;
  expect(response.status(), `${response.url()} ${await response.text()}`).toBe(status);
  const body = await response.json();
  schema?.parse(body);
  return body;
}
