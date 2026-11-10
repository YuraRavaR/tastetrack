import { t } from "../i18n/t";

// How many of a book's authors are named before the rest are counted.
const maxAuthorsNamed = 2;

// An author's name as it is shown, without the stress marks Open Library keeps in some names:
// "Сергі́й Жада́н" reads "Сергій Жадан". Only the combining acute goes, and only where it has no
// letter of its own to be part of, so "é" stays.
export function authorName(name: string): string {
  return name.normalize("NFC").replaceAll("\u0301", "");
}

// A book's authors in one line: the first two, then how many more, "Сергій Жадан, Reilly
// Costigan-Humes +1". Open Library lists translators among a work's authors (ADR-0011). Null for
// a book with none.
export function authorNames(authors: readonly string[]): string | null {
  if (authors.length === 0) return null;
  const named = authors.slice(0, maxAuthorsNamed).map(authorName).join(", ");
  const more = authors.length - maxAuthorsNamed;
  return more > 0 ? t("book.authorsAndMore", { authors: named, more }) : named;
}

// The authors and the first-published year, leaving out whichever is unknown: "Іван Багряний ·
// 1946". Null when neither is known.
export function authorsAndYear({
  authors,
  year,
}: {
  authors: readonly string[];
  year: number | null;
}): string | null {
  const names = authorNames(authors);
  if (year === null) return names;
  return names ? t("book.authorsAndYear", { authors: names, year: String(year) }) : String(year);
}
