// Comparing text the way a User reads it. Pure functions with no I/O, shared by the Worker and
// the client.

// What makes two names the same name: they match once trimmed, in one Unicode form and regardless
// of case, in any alphabet. Going through capitals first folds letters with more than one small
// form, or a capital of several letters, such as ß. SQLite's lower() folds ASCII alone, so the
// Worker stores this key beside a name it needs to compare in SQL.
export function textKey(text: string): string {
  return text.trim().normalize("NFC").toUpperCase().toLowerCase();
}
