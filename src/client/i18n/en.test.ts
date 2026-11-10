import IntlMessageFormat from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { en } from "./en";

// The words a User reads in a message: its literal text, plural and select branches included,
// but not argument names such as `{list}`.
function copyOf(elements: ReturnType<IntlMessageFormat["getAst"]>): string[] {
  return elements.flatMap((element) => {
    if ("options" in element) {
      return Object.values(element.options).flatMap((option) => copyOf(option.value));
    }
    if ("children" in element) return copyOf(element.children);
    return element.type === 0 ? [element.value] : [];
  });
}

// A List is "Collection" in UI copy (GLOSSARY); the word "list" stays in code, routes and the API.
// The one list in the copy is the book Backlog's name, "Reading list".
describe("the English catalogue", () => {
  it.each(Object.entries(en))("%s never calls a List a list", (_id, message) => {
    const copy = copyOf(new IntlMessageFormat(message, "en").getAst()).join(" ");
    expect(copy.replaceAll("Reading list", "")).not.toMatch(/\blists?\b/i);
  });
});
