// Search makes one TMDB call in the query's language (ADR-0004): Ukrainian when the query has any
// Cyrillic letter, English otherwise. No other languages.
export type SearchLanguage = "en-US" | "uk-UA";

const cyrillic = /\p{Script=Cyrillic}/u;

export function searchLanguage(query: string): SearchLanguage {
  return cyrillic.test(query) ? "uk-UA" : "en-US";
}
