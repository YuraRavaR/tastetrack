// The MusicBrainz catalog source of albums (ADR-0013): an album is a release group, the work across
// all its editions, and a search or an album's details are one MusicBrainz request each. Covers
// come from the Cover Art Archive by release-group MBID, linked and never fetched. MusicBrainz
// allows about one request a second, so every call of this isolate waits its turn in one queue.
// The queue, the calls and the covers are shared with songs' lookups (./musicbrainz-songs.ts) and
// artists (./musicbrainz-artists.ts), and the rules the searches use are in src/shared/, as the
// browser searches songs (ADR-0013).
import { z } from "zod";
import type { AlbumCacheExtra } from "../../../db/schema";
import type { CoverUrls } from "../../../shared/api";
import {
  ArtistCredit,
  creditOf,
  escaped,
  mbid,
  mbidPattern,
  namedIn,
  releaseGroupCoverRef,
  smallCoverOf,
  wordsOf,
  yearOfDate,
} from "../../../shared/musicbrainz";
import { searchLanguage } from "../../../shared/search-language";
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

// A release group's page on MusicBrainz, for its User to follow to its track list and editions.
function pageOf(id: string): string {
  return `https://musicbrainz.org/release-group/${id}`;
}

// The cover's reference is its release group's address on the Cover Art Archive, which answers
// with the front cover in the size asked for, or 404 when it has none. It holds the archive's base
// URL, which is each deployment's own; an entry made under another one is refreshed within a week.
export function coverRefFor(env: CatalogEnv, id: string): string {
  return releaseGroupCoverRef(env.COVER_ART_ARCHIVE_BASE_URL, id);
}

// Square covers, 250 pixels wide for a thumbnail and 500 for a grid or the album's page.
export function coversOf(coverRef: string): CoverUrls {
  return { small: smallCoverOf(coverRef), large: `${coverRef}/front-500` };
}

// The covers of a reference, or none without one.
export function coverUrls(coverRef: string | null): CoverUrls | null {
  return coverRef ? coversOf(coverRef) : null;
}

// The cover reference back out of a thumbnail URL this module made, or null for any other URL.
export function coverRefOf(url: string | null, env: CatalogEnv): string | null {
  const prefix = `${env.COVER_ART_ARCHIVE_BASE_URL}/release-group/`;
  if (!url?.startsWith(prefix)) return null;
  const match = new RegExp(`^(${mbidPattern})/front-250$`).exec(url.slice(prefix.length));
  return match?.[1] ? coverRefFor(env, match[1]) : null;
}

// Only the fields we use, so MusicBrainz adding or dropping others doesn't break us. A search
// leaves out secondary-types when there are none, and a lookup gives them as an empty list.
const ReleaseGroup = z.object({
  id: z.string().regex(mbid),
  title: z.string(),
  "first-release-date": z.string().nullish(),
  "primary-type": z.string().nullish(),
  "secondary-types": z.array(z.string()).nullish(),
  "artist-credit": z.optional(ArtistCredit),
  // How many releases it has; a search gives it, a lookup doesn't.
  count: z.number().nullish(),
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

// How much of a release group the query names: one for its title, and one for any of its credited
// artists in the words the title left. A tribute names the original in its own title ("The String
// Quartet Tribute to Pink Floyd’s The Dark Side of the Moon"), which MusicBrainz ranks high, so the
// album whose title and artist the query names outranks it whatever their types. A word counts
// once, so "OK Computer" names the title of an EP "Computer" by Computer, not its artist too.
function namedByQuery(queryWords: Set<string>, group: ReleaseGroup): number {
  const title = namedIn(queryWords, group.title);
  const left = new Set([...queryWords].filter((word) => !title?.includes(word)));
  const artist = (group["artist-credit"] ?? []).some((credit) => namedIn(left, credit.name));
  return (title ? 1 : 0) + (artist ? 1 : 0);
}

// How many releases a release group has, as a search counts them: an album pressed and reissued
// many times is the one people mean, and a duplicate someone entered by mistake has one.
function releasesOf(group: ReleaseGroup): number {
  return group.count ?? 0;
}

// The year of the first release.
function yearOf(group: ReleaseGroup): number | null {
  return yearOfDate(group["first-release-date"]);
}

function artistCreditOf(group: ReleaseGroup): string | null {
  return creditOf(group["artist-credit"]);
}

// Each credited name with the artist's MBID, in MusicBrainz's order.
export function creditedArtists(credits: ArtistCredit | null | undefined) {
  return (credits ?? []).map(({ name, artist }) => ({ name, mbid: artist.id }));
}

// MusicBrainz takes no key, so a 401 or 403 means it is blocking us; a 404 is a release group it
// doesn't have. A 503 is MusicBrainz throttling us or busy, and like any other 5xx is worth trying
// again, never a sign the album is gone.
export function classifyFailure(status: number): SourceFailure {
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
    // A timer may end a little before its time by Date.now() (#286), so the queue sleeps again
    // until the whole interval has passed.
    for (let wait = lastEnded + interval - Date.now(); wait > 0; ) {
      await sleep(wait);
      wait = lastEnded + interval - Date.now();
    }
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

// Who is asking, as MusicBrainz and Wikimedia both ask to be told: TasteTrack, its version and how
// to reach its Operator.
export function userAgentOf(env: CatalogEnv): string {
  return `TasteTrack/${appVersion} (${env.OPEN_LIBRARY_CONTACT})`;
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
          "User-Agent": userAgentOf(env),
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
export async function get(env: CatalogEnv, path: string, params: Record<string, string>) {
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
export function bodyOf(path: string, answer: Answer): unknown {
  if (answer.status < 200 || answer.status > 299) {
    throw new SourceUnavailable(
      `MusicBrainz ${path} answered ${answer.status}`,
      classifyFailure(answer.status),
    );
  }
  return answer.body;
}

// The release groups that are Media Items, Album or EP, which the query asks for so that the limit
// counts only those; the secondary types that keep one out are left out here, after.
const mediaItemsOnly = "(primarytype:album OR primarytype:ep)";

// The first matches that are Media Items, reranked: the ones whose title and artist the query names
// first, then those that name one of the two; within each, albums before EPs, plain ones before the
// rest, then the ones with more releases, then in MusicBrainz's order. A Cyrillic query is sent as typed and finds albums titled in
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
      releases: releasesOf(found.group),
    }))
    .sort(
      (a, b) =>
        b.named - a.named || a.rank - b.rank || b.releases - a.releases || a.order - b.order,
    );
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

// One lookup of a release group, a recording or an artist by MBID, and its body. A merged one
// answers 301 to the one it became, which is looked up in its place, through the queue, so its
// lookup costs two calls; the entry stays under the MBID asked for.
export async function lookUp(
  env: CatalogEnv,
  entity: "release-group" | "recording" | "artist",
  id: string,
  params: Record<string, string>,
): Promise<unknown> {
  const path = `/${entity}/${id}`;
  let answer = await get(env, path, params);
  if (answer.status === 301) {
    const redirectTarget = new RegExp(`/${entity}/(${mbidPattern})(?:[/?]|$)`);
    const target = redirectTarget.exec(answer.location ?? "")?.[1];
    if (!target) {
      throw new SourceUnavailable(`MusicBrainz moved ${id} somewhere unknown`, "temporary");
    }
    answer = await get(env, `/${entity}/${target}`, params);
  }
  return bodyOf(path, answer);
}

// One release group's lookup with its artists, URL relations and aliases.
async function lookUpReleaseGroup(env: CatalogEnv, id: string): Promise<ReleaseGroup> {
  const params = { inc: "artist-credits+url-rels+aliases" };
  const group = ReleaseGroup.safeParse(await lookUp(env, "release-group", id, params));
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
  const group = await lookUpReleaseGroup(env, id);
  const extra: AlbumCacheExtra = {
    artistCredit: artistCreditOf(group),
    artists: creditedArtists(group["artist-credit"]),
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
// the MBID. Each costs the cron one call, two for a merged one, and albums, songs and artists
// together take at most 10 of a run's subrequests, which with the queue's interval is about 11
// seconds of waiting.
export const musicBrainzRefreshShare = 10;

export const musicBrainzAlbums: CatalogSource<"album"> = {
  externalSource: "musicbrainz",
  mediaType: "album",
  refreshCost: 1,
  refreshShare: musicBrainzRefreshShare,
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
