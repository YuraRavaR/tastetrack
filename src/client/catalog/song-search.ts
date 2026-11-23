// Song search, which the browser makes on MusicBrainz itself (ADR-0013): each User spends their
// own IP's share of MusicBrainz's limit, not the one every Worker shares, and the Worker parses
// nothing. MusicBrainz answers `access-control-allow-origin: *`. The browser can't set a
// User-Agent, so MusicBrainz knows these calls by their Origin. The Worker adds what TasteTrack
// holds about the rows, in one call once MusicBrainz has answered.
import { recordingQuery, songSearchLimit, songSearchMatches } from "../../shared/musicbrainz-songs";
import { type CatalogSearchOutcome, fetchSearchMarks } from "../api";

const musicBrainzBaseUrl = "https://musicbrainz.org/ws/2";
const coverArtArchiveBaseUrl = "https://coverartarchive.org";

// MusicBrainz allows each IP about one call a second: this tab's calls are at least this far
// apart, from the end of one to the start of the next.
const interval = 1100;

// How long one call may take before it counts as unanswered.
const callTimeout = 10_000;

// The queue: the turn of the last call queued, and when the last call made ended.
let lastTurn: Promise<void> = Promise.resolve();
let lastEnded = 0;

// Waits `ms`, or rejects as soon as the search is aborted.
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

// Runs `call` once every call queued before it in this tab has ended, and at least the interval
// after the last one ended. A call whose search the User has typed past (`signal` aborted) before
// its turn is dropped, never made; the calls behind it still wait for the ones ahead of it.
async function paced<T>(signal: AbortSignal, call: () => Promise<T>): Promise<T> {
  const ahead = lastTurn;
  let done = () => {};
  lastTurn = new Promise((resolve) => {
    done = resolve;
  });
  await ahead;
  try {
    signal.throwIfAborted();
    // A timer may end a little early by Date.now(), so the queue sleeps again until the whole
    // interval has passed.
    for (let wait = lastEnded + interval - Date.now(); wait > 0; ) {
      await sleep(wait, signal);
      wait = lastEnded + interval - Date.now();
    }
    try {
      return await call();
    } finally {
      lastEnded = Date.now();
    }
  } finally {
    done();
  }
}

// MusicBrainz's answer to one call: its status, and its body when it was JSON.
interface Answer {
  status: number;
  body: unknown;
}

// One GET through the queue, read to the end before the next call may start, or given up after
// callTimeout. Throws when it got no answer, the search's own abort among the reasons.
function getOnce(url: URL, signal: AbortSignal): Promise<Answer> {
  return paced(signal, async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), callTimeout);
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const body: unknown = await response.json().catch(() => undefined);
      return { status: response.status, body };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  });
}

// The recording search MusicBrainz answered, or why there is none. A 503 is asked again once,
// through the queue, and a second one is MusicBrainz busy.
async function searchMusicBrainz(
  query: string,
  signal: AbortSignal,
): Promise<{ ok: true; body: unknown } | { ok: false; error: "busy" | "unavailable" }> {
  const lucene = recordingQuery(query);
  if (lucene === null) return { ok: true, body: { recordings: [] } };
  const url = new URL(`${musicBrainzBaseUrl}/recording/`);
  url.search = new URLSearchParams({
    query: lucene,
    limit: String(songSearchLimit),
    fmt: "json",
  }).toString();
  let answer = await getOnce(url, signal);
  if (answer.status === 503) answer = await getOnce(url, signal);
  if (answer.status === 503) return { ok: false, error: "busy" };
  if (answer.status < 200 || answer.status > 299) return { ok: false, error: "unavailable" };
  return { ok: true, body: answer.body };
}

// A song search's results, as a search the Worker makes would answer them: MusicBrainz's rows
// with their marks merged in, and the User's own manual songs. A busy MusicBrainz shows no manual
// songs either. Anything else that fails, a timeout, a network failure, an answer of unknown
// shape or the Worker's call, is the search unavailable. There's no fallback to the Worker.
export async function searchSongs(
  query: string,
  signal: AbortSignal,
): Promise<CatalogSearchOutcome> {
  try {
    const found = await searchMusicBrainz(query, signal);
    if (!found.ok) return found;
    const matches = songSearchMatches(query, found.body, coverArtArchiveBaseUrl);
    if (matches === null) return { ok: false, error: "unavailable" };
    const ids = matches.map((match) => match.externalReference.id);
    const marked = await fetchSearchMarks(query, ids, signal);
    if (!marked.ok) return marked;
    const results = matches.flatMap((match) => {
      const marks = marked.marks[match.externalReference.id];
      return marks ? [{ ...match, ...marks }] : [];
    });
    return { ok: true, manualResults: marked.manualResults, results };
  } catch {
    return { ok: false, error: signal.aborted ? "aborted" : "unavailable" };
  }
}
