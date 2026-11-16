// Thoughts' rules: their limits and the states they are written in. Plain values, shared by the
// Worker, which enforces them, and the client, which keeps input within them.

// The state a Media Item was in for the User when they wrote a Thought: on their Backlog, In
// Progress, Experienced, or none of these.
export const thoughtStates = ["planned", "in_progress", "experienced", "none"] as const;

export type ThoughtState = (typeof thoughtStates)[number];

// A Thought's text, trimmed, is 1 to this many characters.
export const maxThoughtLength = 2_000;

// The client shows how long the text is from this many characters.
export const thoughtCounterFrom = 1_800;

// A User keeps at most this many Thoughts on one Media Item.
export const maxThoughtsPerMediaItem = 500;
