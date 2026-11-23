import { describe, expect, it } from "vitest";
import { searchLanguage } from "./search-language";

describe("the language a search runs in", () => {
  it.each([
    ["alien", "en-US"],
    ["Le Fabuleux Destin d'Amélie Poulain", "en-US"],
    ["2001", "en-US"],
    ["чужий", "uk-UA"],
    ["Тіні забутих предків", "uk-UA"],
    ["їжак", "uk-UA"],
    // One Cyrillic letter is enough, wherever it is.
    ["Alien Чужий", "uk-UA"],
    ["Brat 2 Брат", "uk-UA"],
  ])("%s → %s", (query, expected) => {
    expect(searchLanguage(query)).toBe(expected);
  });
});
