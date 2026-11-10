import { describe, expect, it } from "vitest";
import { authorName, authorNames, authorsAndYear } from "./book-label";

describe("an author's name", () => {
  it("loses its stress marks", () => {
    expect(authorName("Сергі́й Ві́кторович Жада́н")).toBe("Сергій Вікторович Жадан");
  });

  it("keeps the accents that are part of its letters, however they are encoded", () => {
    expect(authorName("Andréa de Nerciat")).toBe("Andréa de Nerciat");
    expect(authorName("Andre\u0301a de Nerciat")).toBe("Andréa de Nerciat");
    expect(authorName("Василь Стефаник і Йосип")).toBe("Василь Стефаник і Йосип");
  });
});

describe("a book's authors in one line", () => {
  it.each([
    [[], null],
    [["Іван Багряний"], "Іван Багряний"],
    [["Terry Pratchett", "Neil Gaiman"], "Terry Pratchett, Neil Gaiman"],
    [
      ["Сергі́й Ві́кторович Жада́н", "Reilly Costigan-Humes", "Isaac Wheeler"],
      "Сергій Вікторович Жадан, Reilly Costigan-Humes +1",
    ],
    [["A", "B", "C", "D"], "A, B +2"],
  ])("%j → %s", (authors, expected) => {
    expect(authorNames(authors)).toBe(expected);
  });
});

describe("a book's authors and year", () => {
  it.each([
    [["Іван Багряний"], 1946, "Іван Багряний · 1946"],
    [["Іван Багряний"], null, "Іван Багряний"],
    [[], 1946, "1946"],
    [[], null, null],
  ])("%j, %s → %s", (authors, year, expected) => {
    expect(authorsAndYear({ authors, year })).toBe(expected);
  });
});
