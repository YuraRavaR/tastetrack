// The MusicBrainz catalog source of albums (ADR-0013): an album is a release group, the work across
// all its editions, and a search or an album's details are one MusicBrainz request each. Covers
// come from the Cover Art Archive by release-group MBID, linked and never fetched. MusicBrainz
// allows about one request a second, so every call of this isolate waits its turn in one queue.
// Everything MusicBrainz-shaped stays in this file.
import { z } from "zod";
import type { AlbumCacheExtra } from "../../../db/schema";
import type { CoverUrls } from "../../../shared/api";
import { appVersion } from "../../version";
import {
  type CatalogEntry,
  type CatalogEnv,
  type CatalogSearchMatch,
  type CatalogSource,
  SourceBusy,
  type SourceFailure,
  SourceUnavailable,
  shownTitles,
} from "../source";
import { searchLanguage } from "./search-language";

const mbidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const mbid = new RegExp(`^${mbidPattern}$`);

// A release group's page on MusicBrainz, for its User to follow to its track list and editions.
function pageOf(id: string): string {
  return `https://musicbrainz.org/release-group/${id}`;
}

// The cover's reference is its release group's address on the Cover Art Archive, which answers
// with the front cover in the size asked for, or 404 when it has none. It holds the archive's base
// URL, which is each deployment's own; an entry made under another one is refreshed within a week.
function coverRefFor(env: CatalogEnv, id: string): string {
  return `${env.COVER_ART_ARCHIVE_BASE_URL}/release-group/${id}`;
}

// Square covers, 250 pixels wide for a thumbnail and 500 for a grid or the album's page.
function coverUrls(coverRef: string | null): CoverUrls | null {
  if (!coverRef) return null;
  return { small: `${coverRef}/front-250`, large: `${coverRef}/front-500` };
}

// The cover reference back out of a thumbnail URL this module made, or null for any other URL.
function coverRefOf(url: string | null, env: CatalogEnv): string | null {
  const prefix = `${env.COVER_ART_ARCHIVE_BASE_URL}/release-group/`;
  if (!url?.startsWith(prefix)) return null;
  const match = new RegExp(`^(${mbidPattern})/front-250$`).exec(url.slice(prefix.length));
  return match?.[1] ? coverRefFor(env, match[1]) : null;
}

// Only the fields we use, so MusicBrainz adding or dropping others doesn't break us. A search
// leaves out secondary-types when there are none, and a lookup gives them as an empty list.
const ArtistCredit = z.array(
  z.object({
    name: z.string(),
    joinphrase: z.string().nullish(),
    artist: z.object({ id: z.string() }),
  }),
);

const ReleaseGroup = z.object({
  id: z.string().regex(mbid),
  title: z.string(),
  "first-release-date": z.string().nullish(),
  "primary-type": z.string().nullish(),
  "secondary-types": z.array(z.string()).nullish(),
  "artist-credit": ArtistCredit.optional(),
});

type ReleaseGroup = z.infer<typeof ReleaseGroup>;

const SearchResponse = z.object({ "release-groups": z.array(z.unknown()) });

// The types that make a release group a Media Item, and the secondary types that keep one out:
// spoken word, not music.
const primaryTypes = ["Album", "EP"] as const;

type PrimaryType = (typeof primaryTypes)[number];

const excludedSecondaryTypes = [
  "Spokenword",
  "Interview",
  "Audiobook",
  "Audio drama",
  "Field recording",
];

function primaryTypeOf(group: ReleaseGroup): PrimaryType | null {
  const type = group["primary-type"];
  return primaryTypes.find((each) => each === type) ?? null;
}

function secondaryTypesOf(group: ReleaseGroup): string[] {
  return group["secondary-types"] ?? [];
}

// A release group's primary type if it is a Media Item: Album or EP, and not spoken word
// (ADR-0013). Null for any other.
function mediaItemType(group: ReleaseGroup): PrimaryType | null {
  const spoken = secondaryTypesOf(group).some((type) => excludedSecondaryTypes.includes(type));
  return spoken ? null : primaryTypeOf(group);
}

// Albums before EPs, and within each, a plain one, with no secondary type, before the rest.
function rank(group: ReleaseGroup, primaryType: PrimaryType): number {
  return (primaryType === "Album" ? 0 : 2) + (secondaryTypesOf(group).length > 0 ? 1 : 0);
}

// The words of a query or a name, to compare them: lowercased, without accents, apostrophes or
// punctuation, so "Pink Floyd’s" is one word, "floyds".
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’`]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const articles = new Set(["the", "a", "an"]);

// Whether every word of a name is in the query, its articles aside: "The Beatles" is in
// "abbey road beatles", and "The Dark Side of the Moon" in "pink floyd dark side of the moon".
function namedIn(queryWords: Set<string>, name: string): boolean {
  const words = wordsOf(name);
  const significant = words.filter((word) => !articles.has(word));
  const asked = significant.length > 0 ? significant : words;
  return asked.length > 0 && asked.every((word) => queryWords.has(word));
}

// How much of a release group the query names: one for its title, one for any of its credited
// artists. A tribute names the original in its own title ("The String Quartet Tribute to Pink
// Floyd’s The Dark Side of the Moon"), which MusicBrainz ranks high, so the album whose title and
// artist the query names outranks it whatever their types.
function namedByQuery(queryWords: Set<string>, group: ReleaseGroup): number {
  const title = namedIn(queryWords, group.title) ? 1 : 0;
  const artist = (group["artist-credit"] ?? []).some((credit) => namedIn(queryWords, credit.name));
  return title + (artist ? 1 : 0);
}

// The year of the first release, from a date MusicBrainz writes as YYYY, YYYY-MM or YYYY-MM-DD.
function yearOf(group: ReleaseGroup): number | null {
  const year = /^(\d{4})/.exec(group["first-release-date"] ?? "")?.[1];
  return year ? Number(year) : null;
}

// The artist credit as MusicBrainz shows it: each credited name followed by its join phrase.
function artistCreditOf(group: ReleaseGroup): string | null {
  const credit = (group["artist-credit"] ?? [])
    .map((artist) => artist.name + (artist.joinphrase ?? ""))
    .join("")
    .trim();
  return credit || null;
}

// MusicBrainz takes no key, so a 401 or 403 means it is blocking us; a 404 is a release group it
// doesn't have. A 503 is MusicBrainz throttling us or busy, and like any other 5xx is worth trying
// again, never a sign the album is gone.
function classifyFailure(status: number): SourceFailure {
  if (status === 404) return "gone";
  if (status === 401 || status === 403) return "access";
  return "temporary";
}

// The least time between two calls, when the Worker configuration doesn't say.
const defaultInterval = 1100;

function intervalOf(env: CatalogEnv): number {
  const configured = Number(env.MUSICBRAINZ_INTERVAL_MS);
  return env.MUSICBRAINZ_INTERVAL_MS && configured >= 0 ? configured : defaultInterval;
}

// How long one call may take before it counts as unanswered.
const callTimeout = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The queue: the end of the last call to be made, how many are waiting or under way, and when the
// last one ended.
let queueTail: Promise<void> = Promise.resolve();
let queued = 0;
let lastEnded = 0;

// Runs `call` once every call queued before it has ended, and at least the interval after the last
// one ended, so this isolate makes one call at a time, whichever request or cron run it is for. A
// request that is cancelled mid-call never ends its call, so no call waits longer than the calls
// ahead of it could have taken.
async function paced<T>(env: CatalogEnv, call: () => Promise<T>): Promise<T> {
  const interval = intervalOf(env);
  const ahead = queued;
  queued += 1;
  const previous = queueTail;
  let release = () => {};
  queueTail = new Promise((resolve) => {
    release = resolve;
  });
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      previous,
      new Promise((resolve) => {
        timer = setTimeout(resolve, ahead * (interval + callTimeout));
      }),
    ]);
    clearTimeout(timer);
    const wait = lastEnded + interval - Date.now();
    if (wait > 0) await sleep(wait);
    return await call();
  } finally {
    lastEnded = Date.now();
    queued -= 1;
    release();
  }
}

interface Answer {
  status: number;
  location: string | null;
  body: unknown;
}

// One GET, through the queue, read to the end before the next call may start. Redirects aren't
// followed by fetch, which would make the second request at once, without the interval.
async function getOnce(env: CatalogEnv, url: URL): Promise<Answer> {
  return paced(env, async () => {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(callTimeout),
        headers: {
          "User-Agent": `TasteTrack/${appVersion} (${env.OPEN_LIBRARY_CONTACT})`,
          Accept: "application/json",
        },
      });
      const body: unknown = await response.json().catch(() => undefined);
      return { status: response.status, location: response.headers.get("Location"), body };
    } catch (error) {
      throw new SourceUnavailable(`MusicBrainz ${url.pathname} failed`, "temporary", {
        cause: error,
      });
    }
  });
}

// One MusicBrainz request, under its base URL. A 503 is asked again once, through the queue, and a
// second one is MusicBrainz busy. Every request says who is asking, TasteTrack, its version and
// how to reach its Operator, as MusicBrainz asks; without the contact we don't ask at all.
async function get(env: CatalogEnv, path: string, params: Record<string, string>) {
  if (!env.OPEN_LIBRARY_CONTACT) {
    throw new SourceUnavailable("OPEN_LIBRARY_CONTACT is not set", "access");
  }
  const url = new URL(`${env.MUSICBRAINZ_BASE_URL}${path}`);
  url.search = new URLSearchParams({ ...params, fmt: "json" }).toString();
  let answer = await getOnce(env, url);
  if (answer.status === 503) answer = await getOnce(env, url);
  if (answer.status === 503) throw new SourceBusy(`MusicBrainz ${path} answered 503 twice`);
  return answer;
}

// The answer's body, unless MusicBrainz answered with an error.
function bodyOf(path: string, answer: Answer): unknown {
  if (answer.status < 200 || answer.status > 299) {
    throw new SourceUnavailable(
      `MusicBrainz ${path} answered ${answer.status}`,
      classifyFailure(answer.status),
    );
  }
  return answer.body;
}

// Lucene's special characters, which a query would otherwise use as its syntax.
function escaped(query: string): string {
  return query.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, (char) => `\\${char}`);
}

// The release groups that are Media Items, Album or EP, which the query asks for so that the limit
// counts only those; the secondary types that keep one out are left out here, after.
const mediaItemsOnly = "(primarytype:album OR primarytype:ep)";

// The first matches that are Media Items, reranked: the ones whose title and artist the query names
// first, then those that name one of the two; within each, albums before EPs, plain ones before the
// rest, then in MusicBrainz's order. A Cyrillic query is sent as typed and finds albums titled in
// their original script; an album has one title, so the query's language only says which it ran in.
async function searchAlbums(env: CatalogEnv, query: string): Promise<CatalogSearchMatch[]> {
  const path = "/release-group/";
  const answer = await get(env, path, {
    query: `(${escaped(query)}) AND ${mediaItemsOnly}`,
    limit: "25",
  });
  const body = SearchResponse.safeParse(bodyOf(path, answer));
  if (!body.success) {
    throw new SourceUnavailable("MusicBrainz search answered in an unknown shape", "temporary");
  }
  const groups = body.data["release-groups"].flatMap((each) => {
    const group = ReleaseGroup.safeParse(each);
    const primaryType = group.success ? mediaItemType(group.data) : null;
    return group.success && primaryType ? [{ group: group.data, primaryType }] : [];
  });
  const queryWords = new Set(wordsOf(query));
  const ranked = groups
    .map((found, order) => ({
      ...found,
      order,
      named: namedByQuery(queryWords, found.group),
      rank: rank(found.group, found.primaryType),
    }))
    .sort((a, b) => b.named - a.named || a.rank - b.rank || a.order - b.order);
  const titleLanguage = searchLanguage(query) === "uk-UA" ? "uk" : "en";
  return ranked.map(({ group, primaryType }) => ({
    externalReference: { source: "musicbrainz", mediaType: "album", id: group.id },
    title: group.title,
    originalTitle: group.title,
    year: yearOf(group),
    posterUrl: coverUrls(coverRefFor(env, group.id))?.small ?? null,
    titleLanguage,
    authors: [],
    artistCredit: artistCreditOf(group),
    primaryType,
    secondaryTypes: secondaryTypesOf(group),
  }));
}

const redirectTarget = new RegExp(`/release-group/(${mbidPattern})(?:[/?]|$)`);

// One release group's lookup with its artists, URL relations and aliases. A merged release group
// answers 301 to the one it became, which is looked up in its place, through the queue, so its
// refresh costs two calls; the entry stays under the MBID asked for.
async function lookup(env: CatalogEnv, id: string): Promise<ReleaseGroup> {
  const params = { inc: "artist-credits+url-rels+aliases" };
  const path = `/release-group/${id}`;
  let answer = await get(env, path, params);
  if (answer.status === 301) {
    const target = redirectTarget.exec(answer.location ?? "")?.[1];
    if (!target) {
      throw new SourceUnavailable(`MusicBrainz moved ${id} somewhere unknown`, "temporary");
    }
    answer = await get(env, `/release-group/${target}`, params);
  }
  const group = ReleaseGroup.safeParse(bodyOf(path, answer));
  if (!group.success) {
    throw new SourceUnavailable(
      "MusicBrainz's release group answered in an unknown shape",
      "temporary",
    );
  }
  return group.data;
}

// One request for everything an album's entry holds. Its title is its Original Title, and it has
// no Localized Title in any language.
async function albumDetails(env: CatalogEnv, id: string): Promise<CatalogEntry<"album">> {
  if (!mbid.test(id)) throw new SourceUnavailable(`MusicBrainz has no release group ${id}`, "gone");
  const group = await lookup(env, id);
  const extra: AlbumCacheExtra = {
    artistCredit: artistCreditOf(group),
    artists: (group["artist-credit"] ?? []).map(({ name, artist }) => ({ name, mbid: artist.id })),
    primaryType: primaryTypeOf(group),
    secondaryTypes: secondaryTypesOf(group),
    url: pageOf(group.id),
  };
  return {
    englishTitle: null,
    ukrainianTitle: null,
    originalTitle: group.title,
    year: yearOf(group),
    coverRef: coverRefFor(env, group.id),
    extra,
  };
}

// MusicBrainz's albums, kept with no maximum age: its data is CC0, and a cover's URL is keyed by
// the MBID. Each costs the cron one call, two for a merged one, and albums take at most 10 of a
// run's subrequests, which with the queue's interval is about 11 seconds of waiting.
export const musicBrainzAlbums: CatalogSource<"album"> = {
  externalSource: "musicbrainz",
  mediaType: "album",
  refreshCost: 1,
  refreshShare: 10,
  maxEntryAge: null,
  search: searchAlbums,
  details: albumDetails,
  coverRefOf,
  emptyExtra: { artistCredit: null, artists: [], primaryType: null, secondaryTypes: [], url: null },
  coverUrls,
  classifyFailure,
  metadataOf: (entry) => ({
    ...shownTitles(entry),
    ukrainianTitle: null,
    year: entry.year,
    coverUrls: coverUrls(entry.coverRef),
    artistCredit: entry.extra.artistCredit,
    artists: entry.extra.artists.map((artist) => artist.name),
    primaryType: entry.extra.primaryType,
    secondaryTypes: entry.extra.secondaryTypes,
    url: entry.extra.url,
  }),
  // An album has no About block: MusicBrainz has no description of its own.
  aboutOf: () => null,
};
