// Catalog rules shared by the Worker, which enforces them, and the client, which keeps input within
// them. Plain values, so the client bundle doesn't pull in the API schemas.

// Longer queries are refused; no title worth finding needs more.
export const maxSearchQueryLength = 100;
