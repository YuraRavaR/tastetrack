import { describe, expect, it } from "vitest";
import { en } from "./en";

// A List is "Collection" in UI copy (GLOSSARY); the word "list" stays in code, routes and the API,
// so an argument such as `{list}` is not copy and is left out.
describe("the English catalogue", () => {
  it.each(Object.entries(en))("%s never calls a List a list", (_id, message) => {
    const copy = message.replace(/\{\s*\w+/g, "{");
    expect(copy).not.toMatch(/\blists?\b/i);
  });
});
