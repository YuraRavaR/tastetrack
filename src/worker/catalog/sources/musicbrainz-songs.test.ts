import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogEnv } from "../source";
import { musicBrainzSongs } from "./musicbrainz-songs";

// Song search and details against MusicBrainz's own answers (checked 2026-11-22, in the recording
// search check of docs/research/music-metadata-sources.md), cut to the fields the Worker reads.

const env = {
  MUSICBRAINZ_BASE_URL: "https://musicbrainz.test/ws/2",
  COVER_ART_ARCHIVE_BASE_URL: "https://coverartarchive.test",
  OPEN_LIBRARY_CONTACT: "https://example.test/contact",
  MUSICBRAINZ_INTERVAL_MS: "0",
} as unknown as CatalogEnv;

const radiohead = { name: "Radiohead", artist: { id: "a74b1b7f-71a5-4011-9441-d0b5e4122711" } };
const okeanElzy = { name: "Океан Ельзи", artist: { id: "87a417d3-f118-43e0-bece-3de1bd90fce0" } };

interface Group {
  id: string;
  title: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
}

interface Release {
  id: string;
  status?: string | null;
  date?: string;
  "release-group": Group;
}

interface Recording {
  id: string;
  title: string;
  "artist-credit": { name: string; joinphrase?: string; artist: { id: string } }[];
  disambiguation?: string;
  video?: boolean;
  "first-release-date"?: string;
  releases?: Release[];
}

const okComputer: Group = {
  id: "b1392450-e666-3926-a536-22c65f834433",
  title: "OK Computer",
  "primary-type": "Album",
};
const karmaPoliceSingle: Group = {
  id: "d8758f15-65c9-3f34-baf9-475b30755e2b",
  title: "Karma Police",
  "primary-type": "Single",
};
const nowThatsMusic38: Group = {
  id: "26c77d0d-6361-3b85-ace9-70b476e53b25",
  title: "Now That’s What I Call Music! 38",
  "primary-type": "Album",
  "secondary-types": ["Compilation"],
};

// Karma Police on OK Computer, its single and a compilation, the second release listed twice, as
// a search lists a release that has the recording twice.
const karmaPolice: Recording = {
  id: "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3",
  title: "Karma Police",
  "artist-credit": [radiohead],
  disambiguation: "",
  "first-release-date": "1997-05-21",
  releases: [
    {
      id: "1834eae1-741b-3c03-9ca5-0df3decb43ea",
      status: "Official",
      date: "1997-05-21",
      "release-group": okComputer,
    },
    {
      id: "fba5f8fe-c6c8-4511-8562-c9febf482674",
      status: "Official",
      date: "1997-06-16",
      "release-group": okComputer,
    },
    {
      id: "fba5f8fe-c6c8-4511-8562-c9febf482674",
      status: "Official",
      date: "1997-06-16",
      "release-group": okComputer,
    },
    {
      id: "d6eb21af-6595-3aa9-9733-87bc0e245ec1",
      status: "Official",
      date: "1997-07",
      "release-group": karmaPoliceSingle,
    },
    {
      id: "6c939a5d-ea41-47aa-ad97-fb3c76279d72",
      status: "Official",
      date: "1997-11-17",
      "release-group": nowThatsMusic38,
    },
  ],
};

const leMeilleuxMix97: Group = {
  id: "db8199af-bf6b-4c37-a8ea-0d60c5ef6aca",
  title: "Le Meilleux Mix 97",
  "primary-type": "Album",
  "secondary-types": ["Compilation"],
};

// Two of Radiohead's other recordings of Karma Police, each on one release: a compilation dated by
// its year alone, and the single, dated to the day.
const onACompilation: Recording = {
  id: "6c4a524d-641b-413a-bfbe-878974b86345",
  title: "Karma Police",
  "artist-credit": [radiohead],
  disambiguation: "",
  "first-release-date": "1997",
  releases: [
    {
      id: "4427fb21-4465-480d-accc-899f481d3b38",
      status: "Official",
      date: "1997",
      "release-group": leMeilleuxMix97,
    },
  ],
};
const onTheSingle: Recording = {
  id: "4f3c5b08-fbac-44e1-9b40-6786fc489c05",
  title: "Karma Police",
  "artist-credit": [radiohead],
  disambiguation: "",
  "first-release-date": "1997-08-25",
  releases: [
    {
      id: "4dbc3e39-a89e-4433-a50a-3a4e7d072da2",
      status: "Official",
      date: "1997-08-25",
      "release-group": karmaPoliceSingle,
    },
  ],
};

const towering: Group = {
  id: "e449d0a3-5661-338c-a51e-a9910f725fa5",
  title: "Towering Above the Rest",
  "primary-type": "Album",
  "secondary-types": ["Compilation"],
};

// The same song credited to Radiohead with Michael Stipe, on two bootlegs.
const withMichaelStipe: Recording = {
  id: "adbf08e6-2cf8-4dd3-bb5b-bdddba25da27",
  title: "Karma Police",
  "artist-credit": [
    { ...radiohead, joinphrase: " feat. " },
    { name: "Michael Stipe", artist: { id: "905a8f9b-03dc-4f47-b9bb-ecce7ea13ab1" } },
  ],
  disambiguation: "",
  "first-release-date": "2004",
  releases: [
    {
      id: "70f80946-d618-496f-8384-4e6c5f0578a5",
      status: "Bootleg",
      date: "2004",
      "release-group": towering,
    },
    {
      id: "aa1e6810-906c-4d4d-b40b-01f277f6fbd2",
      status: "Bootleg",
      date: "2004",
      "release-group": towering,
    },
  ],
};

// A cover by another artist, whose title names Radiohead.
const johnVanderslice: Recording = {
  id: "6517f75e-f85c-4e3c-a25c-fa23d4a6eab8",
  title: "Karma Police (Radiohead Cover)",
  "artist-credit": [
    { name: "John Vanderslice", artist: { id: "5eaf11c4-12bf-4545-929b-76f2e03ca208" } },
  ],
  disambiguation: "",
  "first-release-date": "2017-08-18",
  releases: [
    {
      id: "0f26929e-01ef-481b-ac8e-0935ee537477",
      status: "Official",
      date: "2017-08-18",
      "release-group": {
        id: "c07c5ecb-0ec5-4cd0-8ae0-b8c4e28156b6",
        title: "Philia - Artists Rise Against Islamophobia",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
  ],
};

const zemlya: Group = {
  id: "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8",
  title: "Земля",
  "primary-type": "Album",
};

// Обійми on Земля, the single before it and compilations dated by their year alone; one Земля
// is a pseudo-release, a transliteration, which never counts.
const obiimy: Recording = {
  id: "d8d55f18-0c4b-4036-a16d-e273ac8953fc",
  title: "Обійми",
  "artist-credit": [okeanElzy],
  disambiguation: "",
  "first-release-date": "2013-02-14",
  releases: [
    {
      id: "f8cf20e6-8f2c-4968-a0a4-01c5d40f2adb",
      status: "Official",
      date: "2013",
      "release-group": {
        id: "4be03245-0fce-49fa-8f16-f52d14d6e5ca",
        title: "Избранное",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "f713f3af-51d2-441e-99eb-b239fd6d93c3",
      status: "Official",
      date: "2014",
      "release-group": {
        id: "4fd056c1-3439-4b4a-a923-294ac66cfd3e",
        title: "Найкраще",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "5ec4f47f-9d7c-4469-82ba-4d5982a6de74",
      status: "Official",
      date: "2013-05-15",
      "release-group": zemlya,
    },
    {
      id: "b0d3e010-533e-4182-99f5-14487806aafb",
      status: "Official",
      date: "2013-05",
      "release-group": zemlya,
    },
    {
      id: "c7fb8e45-e20a-43f0-92b6-9c2f6fa7975e",
      status: "Official",
      date: "2013-02-14",
      "release-group": {
        id: "5de21cba-b851-4960-a859-4a6a88060a1d",
        title: "Обійми",
        "primary-type": "Single",
      },
    },
    {
      id: "9025724e-6df0-4343-b45c-7fd8d2284050",
      status: "Pseudo-Release",
      date: "2013",
      "release-group": zemlya,
    },
  ],
};

const kalushOrchestra = {
  name: "Kalush Orchestra",
  artist: { id: "45d9e75f-cbdf-47df-b4e6-1578d8a17e25" },
};
const turin2022: Group = {
  id: "a6edf821-84f1-4bc5-a0a7-2d89e53bfd47",
  title: "Eurovision Song Contest: Turin 2022",
  "primary-type": "Album",
  "secondary-types": ["Compilation"],
};

// Stefania on compilations first, then its EP, and its single with no date.
const stefania: Recording = {
  id: "b3a54e3b-dadd-41f7-8efe-3f5c07e3259c",
  title: "Stefania",
  "artist-credit": [kalushOrchestra],
  disambiguation: "Ukraine, Eurovision 2022 entry",
  "first-release-date": "2022-02-07",
  releases: [
    {
      id: "a4063304-d3f7-4f9e-8126-0f7e8c3ac777",
      status: "Official",
      date: "2022-04-22",
      "release-group": turin2022,
    },
    {
      id: "f583ed22-4e4d-412e-b585-e27f2c130263",
      status: "Official",
      date: "2022-04-29",
      "release-group": {
        id: "3c507fbe-6ed2-4885-926a-7998a70644d0",
        title: "Bravo Hits 117",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "5901ed97-0fd3-471c-9bdb-c967e8ce54a8",
      status: "Official",
      date: "2022-05-20",
      "release-group": {
        id: "e715b41e-d879-4c25-aeed-3962ca2a0425",
        title: "Stefania",
        "primary-type": "EP",
      },
    },
    {
      id: "35ed2bd3-915a-4fb8-96ea-8d6f2aa07707",
      status: "Official",
      "release-group": {
        id: "56f1d0cf-adf5-4d83-a700-6dbe2232a6d8",
        title: "Stefania",
        "primary-type": "Single",
      },
    },
  ],
};

// A remix on a release with no status, so on no Official release.
const glitchgirlRemix: Recording = {
  id: "47fd3d33-f944-4e87-b9cc-808ff7ce64a9",
  title: "Stefania (Glitchgirl remix)",
  "artist-credit": [kalushOrchestra],
  disambiguation: "",
  "first-release-date": "2022-05-13",
  releases: [
    {
      id: "cfa61a92-251b-46b0-a191-84d0b7f62f99",
      status: null,
      date: "2022-05-13",
      "release-group": {
        id: "a9f0b088-ea8b-460c-9cc4-8516d841f544",
        title: "The Sound of a Remix: The Eurovision 2022 Song Contest",
        "primary-type": "Other",
        "secondary-types": ["Compilation", "Remix"],
      },
    },
  ],
};

// Running Up That Hill's 2012 remix: a remix single, then a soundtrack, which counts as a studio
// release, and compilations.
const symphonyOfBritishMusic: Group = {
  id: "93178ae7-7d14-4aec-af12-efb5633f6968",
  title:
    "A Symphony of British Music: Music for the Closing Ceremony of the London 2012 Olympic Games",
  "primary-type": "Album",
  "secondary-types": ["Soundtrack"],
};
const runningUpThatHill: Recording = {
  id: "7a0aecf5-0538-42d6-a468-78e0d3a9dead",
  title: "Running up That Hill (A Deal With God) (2012 remix)",
  "artist-credit": [{ name: "Kate Bush", artist: { id: "4b585938-f271-45e2-b19a-91c634b5e396" } }],
  disambiguation: "",
  "first-release-date": "2012-08-10",
  releases: [
    {
      id: "fed7fd8b-1129-428d-953d-8264c5dc5f70",
      status: "Official",
      date: "2012-08-10",
      "release-group": {
        id: "46278b1b-47fd-4655-ba14-2eac2a310808",
        title: "Running Up That Hill (A Deal With God) (2012 remix)",
        "primary-type": "Single",
        "secondary-types": ["Remix"],
      },
    },
    {
      id: "b28c1f07-ef8f-4738-9bdf-a31063f5b8b6",
      status: "Official",
      date: "2012-08-13",
      "release-group": symphonyOfBritishMusic,
    },
    {
      id: "75a9ae2e-586a-47c6-8e8b-74a2bae9be3c",
      status: "Official",
      date: "2018-11-30",
      "release-group": {
        id: "af71236e-1c04-431b-a53d-909b72ba9f2b",
        title: "The Other Sides",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
  ],
};

function cover(groupId: string): string {
  return `https://coverartarchive.test/release-group/${groupId}/front-250`;
}

// A search answer holding these recordings, in MusicBrainz's order.
function answer(recordings: Recording[]) {
  return Response.json({ count: recordings.length, offset: 0, recordings });
}

// Stubs fetch to answer `body`, and records the URLs asked for.
function stubFetch(body: () => Response): URL[] {
  const asked: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      asked.push(new URL(String(input)));
      return body();
    }),
  );
  return asked;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("song search", () => {
  it("asks for 50 recordings with every word in the title or the artist, hiding and boosting in the query", async () => {
    const asked = stubFetch(() => answer([karmaPolice]));

    await musicBrainzSongs.search(env, "Karma Police RADIOHEAD");

    expect(asked).toHaveLength(1);
    expect(asked[0]?.pathname).toBe("/ws/2/recording/");
    expect(asked[0]?.searchParams.get("limit")).toBe("50");
    expect(asked[0]?.searchParams.get("query")).toBe(
      "+((recording:karma OR artist:karma) AND (recording:police OR artist:police) AND " +
        "(recording:radiohead OR artist:radiohead) AND NOT video:true AND NOT comment:live AND " +
        "NOT comment:karaoke AND reid:*) secondarytype:compilation^5 secondarytype:soundtrack^5 " +
        "primarytype:single^5 primarytype:album^5",
    );
  });

  it("makes no request for a query with no letter or digit", async () => {
    const asked = stubFetch(() => answer([karmaPolice]));

    expect(await musicBrainzSongs.search(env, "!!! & ?")).toEqual([]);
    expect(asked).toHaveLength(0);
  });

  it("drops video, release-less, live and karaoke recordings that the query let through", async () => {
    stubFetch(() =>
      answer([
        // "livestream" isn't the word "live", so the query keeps it.
        {
          ...karmaPolice,
          id: "95491132-b493-4399-893a-bf6031052db8",
          disambiguation: "Livestream, 2020",
        },
        { ...karmaPolice, id: "f909d18e-d8bc-49dd-a405-113a680936f6", video: true },
        { ...karmaPolice, id: "98e67e07-e497-48b4-92d1-a0743e162cd2", releases: [] },
        {
          ...karmaPolice,
          id: "cd463bfb-e4d7-4eec-8aef-7b301442c4d1",
          disambiguation: "Eurovision 2022 entry, Karaoke version",
        },
        karmaPolice,
        // A title with "live" in it, and a disambiguation that has it only inside another word.
        {
          ...karmaPolice,
          id: "033887ea-984b-474b-addf-2bd379b9be50",
          title: "Karma Police (live)",
          disambiguation: "recorded alive",
        },
      ]),
    );

    const results = await musicBrainzSongs.search(env, "Karma Police Radiohead");

    expect(results.map((result) => result.externalReference.id)).toEqual([
      karmaPolice.id,
      "033887ea-984b-474b-addf-2bd379b9be50",
    ]);
  });

  it("shows recordings of one title, ignoring case, and one credit once, as the one on the most releases", async () => {
    stubFetch(() =>
      answer([
        onACompilation,
        { ...onTheSingle, title: "KARMA POLICE" },
        karmaPolice,
        withMichaelStipe,
      ]),
    );

    const results = await musicBrainzSongs.search(env, "Karma Police");

    expect(results.map((result) => [result.externalReference.id, result.artistCredit])).toEqual([
      [karmaPolice.id, "Radiohead"],
      [withMichaelStipe.id, "Radiohead feat. Michael Stipe"],
    ]);
  });

  it("takes the earliest of recordings on as many releases, a year alone counting as its end", async () => {
    stubFetch(() => answer([onACompilation, onTheSingle]));

    const results = await musicBrainzSongs.search(env, "Karma Police");

    expect(results.map((result) => [result.externalReference.id, result.year])).toEqual([
      [onTheSingle.id, 1997],
    ]);
  });

  it("puts the song whose title and artist the query names first, then the one on more releases", async () => {
    stubFetch(() => answer([johnVanderslice, withMichaelStipe, onACompilation, karmaPolice]));

    const results = await musicBrainzSongs.search(env, "Karma Police Radiohead");

    expect(results.map((result) => `${result.title} · ${result.artistCredit}`)).toEqual([
      "Karma Police · Radiohead",
      "Karma Police · Radiohead feat. Michael Stipe",
      "Karma Police (Radiohead Cover) · John Vanderslice",
    ]);
  });

  it("says the studio Album a song is from, with its cover, before a single or a compilation dated by its year alone", async () => {
    stubFetch(() => answer([obiimy]));

    const [result] = await musicBrainzSongs.search(env, "Обійми Океан Ельзи");

    expect(result).toMatchObject({ album: "Земля", posterUrl: cover(zemlya.id), year: 2013 });
  });

  it("shows no album for a song on no studio Album, and the cover of its studio EP before compilations", async () => {
    stubFetch(() => answer([stefania]));

    const [result] = await musicBrainzSongs.search(env, "Stefania Kalush Orchestra");

    expect(result).toMatchObject({
      album: null,
      posterUrl: cover("e715b41e-d879-4c25-aeed-3962ca2a0425"),
      disambiguation: "Ukraine, Eurovision 2022 entry",
    });
  });

  it("counts a soundtrack as a studio Album, before a remix single", async () => {
    stubFetch(() => answer([runningUpThatHill]));

    const [result] = await musicBrainzSongs.search(env, "Running Up That Hill Kate Bush");

    expect(result).toMatchObject({
      album: symphonyOfBritishMusic.title,
      posterUrl: cover(symphonyOfBritishMusic.id),
    });
  });

  it("shows no album and no cover for a song on no Official release", async () => {
    stubFetch(() => answer([glitchgirlRemix]));

    const [result] = await musicBrainzSongs.search(env, "Stefania Glitchgirl");

    expect(result).toMatchObject({ album: null, posterUrl: null, disambiguation: null });
  });
});

describe("a song's details", () => {
  it("are one lookup of the recording with its artists and releases", async () => {
    const asked = stubFetch(() => Response.json(obiimy));

    const entry = await musicBrainzSongs.details(env, obiimy.id);

    expect(asked).toHaveLength(1);
    expect(asked[0]?.pathname).toBe(`/ws/2/recording/${obiimy.id}`);
    expect(asked[0]?.searchParams.get("inc")).toBe("artist-credits+releases+release-groups");
    expect(entry).toEqual({
      englishTitle: null,
      ukrainianTitle: null,
      originalTitle: "Обійми",
      year: 2013,
      coverRef: `https://coverartarchive.test/release-group/${zemlya.id}`,
      extra: {
        artistCredit: "Океан Ельзи",
        artists: [{ name: "Океан Ельзи", mbid: "87a417d3-f118-43e0-bece-3de1bd90fce0" }],
        album: { title: "Земля", mbid: zemlya.id },
        coverMbid: zemlya.id,
        disambiguation: null,
        url: `https://musicbrainz.org/recording/${obiimy.id}`,
      },
    });
  });

  it("follow a merged recording's redirect, keeping what the one it became says", async () => {
    const old = "fcde0790-ab0d-4f3f-b984-211b2b330af9";
    let calls = 0;
    const asked = stubFetch(() => {
      calls += 1;
      if (calls === 1) {
        return new Response(null, {
          status: 301,
          headers: {
            Location: `https://musicbrainz.test/ws/2/recording/${runningUpThatHill.id}?inc=artist-credits+releases+release-groups&fmt=json`,
          },
        });
      }
      return Response.json(runningUpThatHill);
    });

    const entry = await musicBrainzSongs.details(env, old);

    expect(asked.map((url) => url.pathname)).toEqual([
      `/ws/2/recording/${old}`,
      `/ws/2/recording/${runningUpThatHill.id}`,
    ]);
    expect(entry.extra.album?.title).toBe(symphonyOfBritishMusic.title);
  });

  it("take a recording MusicBrainz answers 404 for as gone", async () => {
    stubFetch(() => Response.json({ error: "Not Found" }, { status: 404 }));

    await expect(
      musicBrainzSongs.details(env, "00000000-0000-4000-8000-000000000404"),
    ).rejects.toMatchObject({ failure: "gone" });
  });
});
