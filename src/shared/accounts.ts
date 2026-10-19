// Account rules shared by the Worker, which enforces them, and the client, which checks them while
// the User types. Plain values, so the client bundle doesn't pull in the API schemas.

// Username rules (PRD #1): 3–30 ASCII letters, digits or underscores. ASCII keeps case-insensitive
// uniqueness simple and rules out look-alike letters from other scripts.
export const usernamePattern = /^[A-Za-z0-9_]{3,30}$/;

// Any 10–128 characters, with no composition rules, so long passphrases work.
export const passwordLength = { min: 10, max: 128 } as const;

// A User may hold this many active (unused, unexpired) Invite Codes, so invitations stay deliberate.
export const maxActiveInviteCodes = 5;
