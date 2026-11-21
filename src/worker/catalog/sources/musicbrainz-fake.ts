// A MusicBrainz fake with fixed data, and a Cover Art Archive fake beside it, mounted among the
// test hooks so that the `local` Worker calls them instead of the real ones (wrangler.jsonc). Like
// MusicBrainz it reads a release-group search's Lucene query, with the type filter inside it, and
// looks a release group up by MBID, answering a merged one's old MBID with a 301. Its release
// groups mirror real MusicBrainz data (checked 2026-11-21), so the same tests pass here and
// against MusicBrainz on staging.
//
// It enforces MusicBrainz's rate limit: a call sooner than MUSICBRAINZ_INTERVAL_MS after the one
// before gets a 503, as the real one answers, so a test sees a call the Worker didn't pace. Under
// /busy/<times>/<id>/ it answers 503 to the first <times> calls with that <id> too, which is how a
// test asks for MusicBrainz busy (X-Test-MusicBrainz-Busy), without another test's calls taking
// its 503s.
import { type Context, Hono } from "hono";

interface FakeCredit {
  name: string;
  joinphrase?: string;
  artistId: string;
}

interface FakeReleaseGroup {
  id: string;
  title: string;
  primaryType: "Album" | "EP" | "Single" | "Other" | null;
  secondaryTypes?: string[];
  firstReleaseDate?: string;
  credits: FakeCredit[];
  // How many releases it has, as MusicBrainz counts them.
  releases: number;
  // Whether the Cover Art Archive has a front cover for it.
  cover: boolean;
  // Its Wikidata and Discogs pages, of the URL relations MusicBrainz has.
  relations?: string[];
}

const beatles = { name: "The Beatles", artistId: "b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d" };
const jamala = { name: "Jamala", artistId: "3d264dc4-b1f2-409f-8ab4-3d17d8b42b02" };

// In the order MusicBrainz's search ranks them, which the Worker reranks.
const releaseGroups: FakeReleaseGroup[] = [
  // An album of six releases, titled in Cyrillic, with no aliases.
  {
    id: "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
    title: "Земля",
    primaryType: "Album",
    firstReleaseDate: "2013-05-15",
    credits: [{ name: "Океан Ельзи", artistId: "87a417d3-f118-43e0-bece-3de1bd90fce0" }],
    releases: 6,
    cover: true,
    relations: ["https://www.discogs.com/master/593968", "https://www.wikidata.org/wiki/Q14633569"],
  },
  // An EP of the same title by another artist.
  {
    id: "c70b84d2-1538-44c5-a7f0-71ed32508e92",
    title: "Земля",
    primaryType: "EP",
    firstReleaseDate: "2022-11-22",
    credits: [{ name: "Анна Ворфоломеева", artistId: "3b6f354a-c766-4147-8f25-6d13d6be9e1b" }],
    releases: 1,
    cover: true,
  },
  // Abbey Road, with its remix album, which has no cover, and among them albums of other artists
  // that share its title and a single.
  {
    id: "c0b2899c-41ab-4907-abf0-ff1962477ff2",
    title: "Abbey's Road",
    primaryType: "Album",
    firstReleaseDate: "2016",
    credits: [
      {
        name: "Ada Montellanico",
        joinphrase: " feat. ",
        artistId: "1aa00b34-ccfc-468d-aa4c-425e1b8eb7f8",
      },
      { name: "Giovanni Falzone", artistId: "e3fe8224-eb5f-4411-a922-26da0ebdc912" },
    ],
    releases: 2,
    cover: true,
  },
  {
    id: "284326a7-edbb-4b9b-82cf-dc53863759ef",
    title: "Abbey Road",
    primaryType: "Single",
    firstReleaseDate: "2026-01-02",
    credits: [{ name: "Diana Herrera", artistId: "b1609980-fe3c-45fa-8892-03f2f4864e4a" }],
    releases: 1,
    cover: true,
  },
  {
    id: "004a4e79-ac6c-448a-9d7f-b1b1714aa22a",
    title: "Abbey Road",
    primaryType: "Album",
    firstReleaseDate: "2012-08-14",
    credits: [{ name: "Various Artists", artistId: "89ad4ac3-39f7-470e-963a-56509c546377" }],
    releases: 1,
    cover: true,
  },
  {
    id: "42ef6001-3113-440c-ae7c-3667c7351e35",
    title: "Abbey Road Remix",
    primaryType: "Album",
    secondaryTypes: ["Remix"],
    firstReleaseDate: "2012",
    credits: [beatles],
    releases: 1,
    cover: false,
  },
  {
    id: "9162580e-5df4-32de-80cc-f45a8d8a9b1d",
    title: "Abbey Road",
    primaryType: "Album",
    firstReleaseDate: "1969-09-26",
    credits: [beatles],
    releases: 75,
    cover: true,
    relations: ["https://www.discogs.com/master/24047", "https://www.wikidata.org/wiki/Q173643"],
  },
  // A live album.
  {
    id: "eabb68b3-d57c-359a-8215-91f38d365da5",
    title: "The Beatles at the Hollywood Bowl",
    primaryType: "Album",
    secondaryTypes: ["Live"],
    firstReleaseDate: "1977-05-04",
    credits: [beatles],
    releases: 12,
    cover: true,
  },
  // An interview, which search hides though its primary type is Album, and one whose is Other.
  {
    id: "84225cac-5cd3-3389-a84e-e673e3bf3242",
    title: "The Beatles’ Story",
    primaryType: "Album",
    secondaryTypes: ["Interview"],
    firstReleaseDate: "1964-11-23",
    credits: [beatles],
    releases: 17,
    cover: true,
  },
  {
    id: "1068b40b-4a1f-3208-b009-42bf88fac2b9",
    title: "Interview Disc",
    primaryType: "Other",
    secondaryTypes: ["Interview"],
    firstReleaseDate: "1992",
    credits: [beatles],
    releases: 2,
    cover: false,
  },
  // 1944: MusicBrainz puts the EP first, then the album, then the single, all by Jamala, and EPs
  // and an album of that title by others.
  {
    id: "b7f51377-4088-43bc-beb7-58705d9af90e",
    title: "1944",
    primaryType: "EP",
    firstReleaseDate: "2016-05-07",
    credits: [jamala],
    releases: 1,
    cover: true,
  },
  {
    id: "68b61f05-aa49-4dda-9cdc-1104e4541aed",
    title: "1944",
    primaryType: "Album",
    firstReleaseDate: "2016-06-10",
    credits: [jamala],
    releases: 1,
    cover: true,
  },
  {
    id: "04d4b9ba-6f72-4c52-b907-8536ff96f304",
    title: "1944",
    primaryType: "Single",
    firstReleaseDate: "2016-02-12",
    credits: [jamala],
    releases: 1,
    cover: true,
  },
  {
    id: "d9e73c6c-2fd9-4652-b1b1-87031957d705",
    title: "1944",
    primaryType: "EP",
    secondaryTypes: ["Mixtape/Street"],
    firstReleaseDate: "2023-12-17",
    credits: [{ name: "À TERRE", artistId: "9b55410b-9e2e-490d-b803-09a4b0bdf66f" }],
    releases: 1,
    cover: true,
  },
  // A soundtrack.
  {
    id: "4513c7b9-854e-457f-81d6-3dbeb001beb8",
    title: "Interstellar: Original Motion Picture Soundtrack",
    primaryType: "Album",
    secondaryTypes: ["Soundtrack"],
    firstReleaseDate: "2014-11-17",
    credits: [{ name: "Hans Zimmer", artistId: "e6de1f3b-6484-491c-88dd-6d619f142abc" }],
    releases: 19,
    cover: true,
  },
  // An audiobook, which search hides though its primary type is Album, with no release date.
  {
    id: "a9e84258-d41b-4c64-84e3-654e71eb8154",
    title: "Troy: The Siege of Troy Retold",
    primaryType: "Album",
    secondaryTypes: ["Audiobook"],
    credits: [{ name: "Stephen Fry", artistId: "fad46635-5d90-484e-bcf9-5a8e3c1f8830" }],
    releases: 1,
    cover: true,
  },
  {
    id: "54dc9f4b-ed57-4ac7-9829-9df51ce2f78c",
    title: "TROY",
    primaryType: "EP",
    firstReleaseDate: "2015-07-10",
    credits: [{ name: "Jaime Woods", artistId: "1e10de66-d854-4091-b647-15bc86742f01" }],
    releases: 1,
    cover: true,
  },
  // Two credited artists, joined as MusicBrainz shows them, and no cover.
  {
    id: "67210625-2acc-4689-8b76-a43181af8a10",
    title: "The Bedouin Reworks Of Dakhabrakha",
    primaryType: "EP",
    firstReleaseDate: "2022-03-30",
    credits: [
      { name: "Bedouin", joinphrase: ", ", artistId: "c9b34ac9-83ab-44f4-8358-348d8ea8d6c2" },
      { name: "DakhaBrakha", artistId: "208334a1-abf0-4791-9705-b45838244b29" },
    ],
    releases: 1,
    cover: false,
  },
  // The release group a merged one became.
  {
    id: "9cd2811d-a999-326e-8945-a8b6b44b9e92",
    title: "Bye Bye Birdie",
    primaryType: "Album",
    secondaryTypes: ["Soundtrack"],
    firstReleaseDate: "1963",
    credits: [{ name: "Charles Strouse", artistId: "52eb3f6f-9601-4690-a336-536688082652" }],
    releases: 9,
    cover: true,
  },
];

// Old MBIDs of merged release groups, and the one each became.
const merged = new Map([
  ["a51b25f4-2dc1-4787-b779-51abcdb170ff", "9cd2811d-a999-326e-8945-a8b6b44b9e92"],
]);

// MBIDs the fake fails on as MusicBrainz does when it is down or busy, for the cron's tests.
export const musicBrainzFakeFailing = {
  serverError: "00000000-0000-4000-8000-000000000500",
  busy: "00000000-0000-4000-8000-000000000503",
};

// A credit as MusicBrainz writes one, the artist named as credited.
function creditOf(group: FakeReleaseGroup) {
  return group.credits.map((credit) => ({
    name: credit.name,
    joinphrase: credit.joinphrase ?? "",
    artist: { id: credit.artistId, name: credit.name, "sort-name": credit.name },
  }));
}

// A release group as search answers with it: secondary-types left out when there are none.
function searchResult(group: FakeReleaseGroup) {
  return {
    id: group.id,
    score: 100,
    count: group.releases,
    title: group.title,
    "first-release-date": group.firstReleaseDate ?? "",
    "primary-type": group.primaryType ?? undefined,
    ...(group.secondaryTypes && { "secondary-types": group.secondaryTypes }),
    "artist-credit": creditOf(group),
  };
}

// A release group as a lookup answers with it.
function lookupResult(group: FakeReleaseGroup) {
  return {
    id: group.id,
    title: group.title,
    disambiguation: "",
    "first-release-date": group.firstReleaseDate ?? "",
    "primary-type": group.primaryType,
    "secondary-types": group.secondaryTypes ?? [],
    "artist-credit": creditOf(group),
    aliases: [],
    relations: (group.relations ?? []).map((resource) => ({
      "target-type": "url",
      type: resource.includes("wikidata") ? "wikidata" : "discogs",
      url: { resource },
    })),
  };
}

// The words of a Lucene query, its escapes undone, lowercased.
function wordsOf(query: string): string[] {
  return query.replace(/\\(.)/g, "$1").toLowerCase().split(/\s+/).filter(Boolean);
}

// A search query of the shape the Worker sends, `(<words>) AND (primarytype:album OR …)`: the
// release groups whose title and artist credit hold every word, of the primary types it names.
function search(query: string): FakeReleaseGroup[] {
  const match = /^\((.*)\) AND \((.*)\)$/s.exec(query);
  const words = wordsOf(match?.[1] ?? query);
  const types = [...(match?.[2] ?? "").matchAll(/primarytype:(\w+)/g)].map((m) => m[1]);
  return releaseGroups.filter((group) => {
    const text = `${group.title} ${group.credits.map((c) => c.name).join(" ")}`.toLowerCase();
    const typed = types.length === 0 || types.includes(group.primaryType?.toLowerCase());
    return typed && words.every((word) => text.includes(word));
  });
}

const notFound = {
  error: "Not Found",
  help: "For usage, please see: https://musicbrainz.org/development/mmd",
};

// How many calls the rate limit has refused, which a test reads to see that the Worker paced every
// call, and when the last call came.
let rateLimited = 0;
let lastCall = 0;

// How many of a /busy/ id's calls have had their 503.
const busyAnswered = new Map<string, number>();

export const musicBrainzFakeCalls = {
  rateLimited: () => rateLimited,
};

const defaultInterval = 1100;

const api = new Hono<{ Bindings: Partial<Pick<Env, "MUSICBRAINZ_INTERVAL_MS">> }>();

// MusicBrainz takes the search with or without the trailing slash.
const searchHandler = (c: Context) => {
  const query = c.req.query("query") ?? "";
  const limit = Number(c.req.query("limit") ?? 25);
  const found = search(query);
  return c.json({
    created: "2026-11-21T09:38:48.318Z",
    count: found.length,
    offset: 0,
    "release-groups": found.slice(0, limit).map(searchResult),
  });
};

api.get("/ws/2/release-group", searchHandler);
api.get("/ws/2/release-group/", searchHandler);

api.get("/ws/2/release-group/:mbid", (c) => {
  const id = c.req.param("mbid");
  if (id === musicBrainzFakeFailing.serverError) return c.json({ error: "Server error" }, 500);
  if (id === musicBrainzFakeFailing.busy) return c.json({ error: "Service unavailable" }, 503);
  const target = merged.get(id);
  if (target) {
    const url = new URL(c.req.url);
    url.pathname = url.pathname.replace(id, target);
    return c.redirect(url.toString(), 301);
  }
  const group = releaseGroups.find((each) => each.id === id);
  return group ? c.json(lookupResult(group)) : c.json(notFound, 404);
});

export const musicBrainzFake = new Hono<{
  Bindings: Partial<Pick<Env, "MUSICBRAINZ_INTERVAL_MS">>;
}>();

// The rate limit, over every call, the busy ones' among them.
musicBrainzFake.use("*", async (c, next) => {
  const now = Date.now();
  const interval = Number(c.env?.MUSICBRAINZ_INTERVAL_MS ?? defaultInterval);
  const tooSoon = now - lastCall < interval;
  lastCall = now;
  if (tooSoon) {
    rateLimited += 1;
    return c.json({ error: "Your requests are exceeding the allowable rate limit." }, 503);
  }
  await next();
});

musicBrainzFake.use("/busy/:times/:id/*", async (c, next) => {
  const id = c.req.param("id");
  const answered = busyAnswered.get(id) ?? 0;
  if (answered < Number(c.req.param("times"))) {
    busyAnswered.set(id, answered + 1);
    return c.json({ error: "Service unavailable" }, 503);
  }
  await next();
});

musicBrainzFake.route("/busy/:times/:id", api);
musicBrainzFake.route("/", api);

// A square front cover, as the Cover Art Archive's image stands in for it here.
const coverImage =
  '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 1 1">' +
  '<rect width="1" height="1" fill="#777"/></svg>';

// The Cover Art Archive answers a release group with a front cover with its image, and one
// without, or one it doesn't know, with 404. A merged one's old MBID answers with the new one's.
export const coverArtArchiveFake = new Hono();

coverArtArchiveFake.get("/release-group/:mbid/:size{front-[0-9]+}", (c) => {
  const id = c.req.param("mbid");
  const group = releaseGroups.find((each) => each.id === (merged.get(id) ?? id));
  if (!group?.cover) return c.text("Not Found", 404);
  return c.body(coverImage, 200, { "Content-Type": "image/svg+xml" });
});
