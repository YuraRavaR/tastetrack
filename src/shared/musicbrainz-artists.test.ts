import { describe, expect, it } from "vitest";
import {
  artistAlbums,
  artistAlbumsQuery,
  artistQuery,
  artistSearchMatches,
  artistYears,
} from "./musicbrainz-artists";
import {
  aliceCooper,
  aliceCooperBand,
  endlessRiver,
  kalush,
  kalushOrchestra,
  london1966,
  more,
  okeanElzy,
  pinkFloyd,
  piperAtTheGates,
  queen,
  saucerfulOfSecrets,
  theirFirstRecordings,
  ummagumma,
  unknown,
  variousArtists,
  variousArtistsBristol,
  variousArtistsTechno,
} from "./test-data/musicbrainz-artists";

// Artist search's rules (ADR-0013, Artists) on MusicBrainz's own answers.

describe("an artist search's query", () => {
  it("joins the User's words with AND, lowercased so none is an operator", () => {
    expect(artistQuery("Kalush  ORCHESTRA and Not")).toBe("kalush AND orchestra AND and AND not");
  });

  it("sends a Cyrillic query as typed, and escapes Lucene's special characters", () => {
    expect(artistQuery("Океан Ельзи")).toBe("океан AND ельзи");
    expect(artistQuery("AC/DC [unknown]")).toBe("ac\\/dc AND \\[unknown\\]");
  });

  it("is null, so no request is made, for a query with no letter or digit", () => {
    expect(artistQuery("!!! & ?")).toBeNull();
  });
});

// The search rows for `query` from a MusicBrainz answer holding these artists, in its order.
function search(query: string, artists: unknown[]) {
  return artistSearchMatches(query, { count: artists.length, offset: 0, artists }) ?? [];
}

describe("artist search", () => {
  it("gives each artist's name, type, country, years and disambiguation, with no photo", () => {
    expect(search("Alice Cooper", [aliceCooper, aliceCooperBand])).toEqual([
      {
        externalReference: { source: "musicbrainz", mediaType: "artist", id: aliceCooper.id },
        title: "Alice Cooper",
        originalTitle: "Alice Cooper",
        year: 1948,
        posterUrl: null,
        titleLanguage: "en",
        authors: [],
        artistType: "Person",
        country: "US",
        endYear: null,
        disambiguation: "the singer, active as a solo artist 1975–present",
      },
      {
        externalReference: { source: "musicbrainz", mediaType: "artist", id: aliceCooperBand.id },
        title: "Alice Cooper",
        originalTitle: "Alice Cooper",
        year: 1964,
        posterUrl: null,
        titleLanguage: "en",
        authors: [],
        artistType: "Group",
        country: "US",
        endYear: 1975,
        disambiguation: "the band, active 1964–1974/5",
      },
    ]);
  });

  it("names an artist in their original script, whatever the query's", () => {
    const [found] = search("Okean Elzy", [okeanElzy]);

    expect(found).toMatchObject({
      title: "Океан Ельзи",
      originalTitle: "Океан Ельзи",
      year: 1994,
      country: "UA",
      artistType: "Group",
      disambiguation: null,
      titleLanguage: "en",
    });
    expect(search("Океан Ельзи", [okeanElzy])[0]?.titleLanguage).toBe("uk");
  });

  it("hides Various Artists and [unknown] by MBID, and keeps real artists of those names", () => {
    const results = search("Various Artists", [
      variousArtists,
      variousArtistsTechno,
      unknown,
      variousArtistsBristol,
    ]);

    expect(results.map((result) => result.externalReference.id)).toEqual([
      variousArtistsTechno.id,
      variousArtistsBristol.id,
    ]);
  });

  it("keeps MusicBrainz's order, with no rerank", () => {
    const results = search("Kalush", [kalush, kalushOrchestra]);

    expect(results.map((result) => result.title)).toEqual(["KALUSH", "Kalush Orchestra"]);
  });

  it("gives no years without a begin year, and no end year for an ended artist without one", () => {
    expect(search("Queen", [queen])[0]).toMatchObject({ year: 1970, endYear: null });
    expect(search("Various Artists", [variousArtistsTechno])[0]).toMatchObject({
      year: null,
      endYear: null,
      artistType: "Person",
    });
    expect(
      search("Pink Floyd", [{ ...pinkFloyd, "life-span": { end: "2014", ended: true } }])[0],
    ).toMatchObject({ year: null, endYear: null });
    expect(
      search("Pink Floyd", [{ ...pinkFloyd, "life-span": { begin: "????-10-02" } }])[0],
    ).toMatchObject({ year: null, endYear: null });
  });

  it("gives no country for a row without one, or with a code that isn't one", () => {
    expect(search("Pink Floyd", [pinkFloyd])[0]?.country).toBeNull();
    expect(search("Pink Floyd", [{ ...pinkFloyd, country: "England" }])[0]?.country).toBeNull();
    expect(search("unknown", [{ ...okeanElzy, country: "XW" }])[0]?.country).toBe("XW");
  });

  it("leaves out an artist of unknown shape, and is null for an answer of unknown shape", () => {
    expect(search("Kalush", [{ id: "not an mbid", name: "Kalush" }, kalush])).toHaveLength(1);
    expect(artistSearchMatches("Kalush", { recordings: [] })).toBeNull();
  });
});

describe("an artist's years", () => {
  it("are the begin year and a dash, with the end year after it when there is one", () => {
    expect(artistYears(1994, null)).toBe("1994–");
    expect(artistYears(1965, 2014)).toBe("1965–2014");
    expect(artistYears(null, null)).toBeNull();
  });
});

// A release-group search's answer holding these release groups, in its order.
function releaseGroups(groups: unknown[]) {
  return { count: groups.length, offset: 0, "release-groups": groups };
}

describe("an artist's albums list", () => {
  it("is asked for as one release-group search of their official studio Albums and EPs", () => {
    expect(artistAlbumsQuery(pinkFloyd.id)).toBe(
      `arid:${pinkFloyd.id} AND (primarytype:album OR primarytype:ep) AND NOT ` +
        '(secondarytype:"compilation" OR secondarytype:"live" OR secondarytype:"remix" OR ' +
        'secondarytype:"dj-mix" OR secondarytype:"mixtape/street" OR secondarytype:"demo" OR ' +
        'secondarytype:"interview" OR secondarytype:"spokenword" OR secondarytype:"audiobook" OR ' +
        'secondarytype:"audio drama" OR secondarytype:"field recording") AND status:official',
    );
  });

  it("keeps Albums and EPs oldest first, soundtracks among them, a year-only date at its year's end", () => {
    const albums = artistAlbums(
      releaseGroups([
        endlessRiver,
        london1966,
        ummagumma,
        more,
        piperAtTheGates,
        theirFirstRecordings,
        saucerfulOfSecrets,
      ]),
    );

    expect(albums).toEqual([
      {
        mbid: piperAtTheGates.id,
        title: "The Piper at the Gates of Dawn",
        year: 1967,
        primaryType: "Album",
      },
      {
        mbid: saucerfulOfSecrets.id,
        title: "A Saucerful of Secrets",
        year: 1968,
        primaryType: "Album",
      },
      { mbid: more.id, title: "More", year: 1969, primaryType: "Album" },
      { mbid: ummagumma.id, title: "Ummagumma", year: 1969, primaryType: "Album" },
      { mbid: london1966.id, title: "London 1966/1967", year: 1995, primaryType: "EP" },
      { mbid: endlessRiver.id, title: "The Endless River", year: 2014, primaryType: "Album" },
      {
        mbid: theirFirstRecordings.id,
        title: "1965: Their First Recordings",
        year: 2015,
        primaryType: "EP",
      },
    ]);
  });

  it("drops what the search let through that isn't a studio Album or EP", () => {
    const albums = artistAlbums(
      releaseGroups([
        { ...ummagumma, "secondary-types": ["Live"] },
        { ...more, "secondary-types": ["Soundtrack", "Compilation"] },
        { ...piperAtTheGates, "primary-type": "Single" },
        { ...saucerfulOfSecrets, "primary-type": undefined },
        london1966,
      ]),
    );

    expect(albums?.map((album) => album.title)).toEqual(["London 1966/1967"]);
  });

  it("puts an album with no date last, then sorts by title, and leaves out one of unknown shape", () => {
    const albums = artistAlbums(
      releaseGroups([
        { ...ummagumma, "first-release-date": "" },
        { ...more, "first-release-date": undefined },
        { id: "not an mbid", title: "Meddle", "primary-type": "Album" },
        piperAtTheGates,
      ]),
    );

    expect(albums?.map((album) => [album.title, album.year])).toEqual([
      ["The Piper at the Gates of Dawn", 1967],
      ["More", null],
      ["Ummagumma", null],
    ]);
  });

  it("is null for an answer of unknown shape", () => {
    expect(artistAlbums({ artists: [] })).toBeNull();
  });
});
