import { describe, expect, it } from "vitest";
import { recordingQuery, songSearchMatches } from "./musicbrainz-songs";
import {
  dejaVuNoRapAccented,
  dejaVuNoRapUnaccented,
  glitchgirlRemix,
  johnVanderslice,
  karmaPolice,
  obiimy,
  onACompilation,
  onTheSingle,
  type Recording,
  runningUpThatHill,
  stefania,
  symphonyOfBritishMusic,
  timeOfMyLifeStraightApostrophe,
  timeOfMyLifeWithAmpersand,
  timeOfMyLifeWithAnd,
  timeOfMyLifeWithoutIveHad,
  withMichaelStipe,
  zemlya,
} from "./test-data/musicbrainz-recordings";

// Song search's rules (ADR-0013, Songs) on MusicBrainz's own answers, which the browser applies to
// what MusicBrainz answers it.

const coverArtArchive = "https://coverartarchive.test";

function cover(groupId: string): string {
  return `${coverArtArchive}/release-group/${groupId}/front-250`;
}

// The search rows for `query` from a MusicBrainz answer holding these recordings, in its order.
function search(query: string, recordings: Recording[]) {
  const answer = { count: recordings.length, offset: 0, recordings };
  return songSearchMatches(query, answer, coverArtArchive) ?? [];
}

describe("a recording search's query", () => {
  it("asks for every word in the title or the artist, hiding and boosting in the query", () => {
    expect(recordingQuery("Karma Police RADIOHEAD")).toBe(
      "+((recording:karma OR artist:karma) AND (recording:police OR artist:police) AND " +
        "(recording:radiohead OR artist:radiohead) AND NOT video:true AND NOT comment:live AND " +
        "NOT comment:karaoke AND reid:*) secondarytype:compilation^5 secondarytype:soundtrack^5 " +
        "primarytype:single^5 primarytype:album^5",
    );
  });

  it("escapes Lucene's special characters in a word", () => {
    expect(recordingQuery("AC/DC")).toContain("(recording:ac\\/dc OR artist:ac\\/dc)");
  });

  it("is null, so no request is made, for a query with no letter or digit", () => {
    expect(recordingQuery("!!! & ?")).toBeNull();
  });
});

describe("song search", () => {
  it("finds Karma Police first and once, with its artist, year, album and cover", () => {
    const results = search("Karma Police Radiohead", [onACompilation, karmaPolice, onTheSingle]);

    expect(results).toEqual([
      {
        externalReference: { source: "musicbrainz", mediaType: "song", id: karmaPolice.id },
        title: "Karma Police",
        originalTitle: "Karma Police",
        year: 1997,
        posterUrl: cover("b1392450-e666-3926-a536-22c65f834433"),
        titleLanguage: "en",
        authors: [],
        artistCredit: "Radiohead",
        album: "OK Computer",
        disambiguation: null,
      },
    ]);
  });

  it("drops video, release-less, live and karaoke recordings that the query let through", () => {
    const results = search("Karma Police Radiohead", [
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
    ]);

    expect(results.map((result) => result.externalReference.id)).toEqual([
      karmaPolice.id,
      "033887ea-984b-474b-addf-2bd379b9be50",
    ]);
  });

  it("shows recordings of one title, ignoring case, and one credit once, as the one on the most releases", () => {
    const results = search("Karma Police", [
      onACompilation,
      { ...onTheSingle, title: "KARMA POLICE" },
      karmaPolice,
      withMichaelStipe,
    ]);

    expect(results.map((result) => [result.externalReference.id, result.artistCredit])).toEqual([
      [karmaPolice.id, "Radiohead"],
      [withMichaelStipe.id, "Radiohead feat. Michael Stipe"],
    ]);
  });

  it("shows recordings whose titles differ only in accents and punctuation once", () => {
    const results = search("deja vu beyonce", [dejaVuNoRapUnaccented, dejaVuNoRapAccented]);

    expect(results.map((result) => [result.externalReference.id, result.title])).toEqual([
      [dejaVuNoRapAccented.id, "Déjà Vu (Freemasons club mix) (no rap)"],
    ]);
  });

  it('shows recordings whose credits differ only in "&" against "and" once, as the one on the most releases', () => {
    const results = search("time of my life bill medley jennifer warnes", [
      timeOfMyLifeWithAmpersand,
      timeOfMyLifeWithAnd,
      timeOfMyLifeStraightApostrophe,
    ]);

    expect(results.map((result) => [result.externalReference.id, result.artistCredit])).toEqual([
      [timeOfMyLifeWithAnd.id, "Bill Medley and Jennifer Warnes"],
    ]);
  });

  it("keeps a title that lacks a word of a look-alike's as a row of its own", () => {
    const results = search("time of my life bill medley jennifer warnes", [
      timeOfMyLifeWithAmpersand,
      timeOfMyLifeWithAnd,
      timeOfMyLifeStraightApostrophe,
      timeOfMyLifeWithoutIveHad,
    ]);

    expect(results.map((result) => `${result.title} · ${result.artistCredit}`)).toEqual([
      "Time of My Life · Bill Medley & Jennifer Warnes",
      "(I’ve Had) The Time of My Life · Bill Medley and Jennifer Warnes",
    ]);
  });

  it("takes the earliest of recordings on as many releases, a year alone counting as its end", () => {
    const results = search("Karma Police", [onACompilation, onTheSingle]);

    expect(results.map((result) => [result.externalReference.id, result.year])).toEqual([
      [onTheSingle.id, 1997],
    ]);
  });

  it("puts the song whose title and artist the query names first, then the one on more releases", () => {
    const results = search("Karma Police Radiohead", [
      johnVanderslice,
      withMichaelStipe,
      onACompilation,
      karmaPolice,
    ]);

    expect(results.map((result) => `${result.title} · ${result.artistCredit}`)).toEqual([
      "Karma Police · Radiohead",
      "Karma Police · Radiohead feat. Michael Stipe",
      "Karma Police (Radiohead Cover) · John Vanderslice",
    ]);
  });

  it("finds the Cyrillic Обійми from the studio Album Земля, with its cover, before a single or a compilation dated by its year alone", () => {
    const [result] = search("Обійми Океан Ельзи", [obiimy]);

    expect(result).toMatchObject({
      title: "Обійми",
      album: "Земля",
      posterUrl: cover(zemlya.id),
      year: 2013,
      titleLanguage: "uk",
    });
  });

  it("shows the disambiguation, no album for a song on no studio Album, and the cover of its studio EP before compilations", () => {
    const [result] = search("Stefania Kalush Orchestra", [stefania]);

    expect(result).toMatchObject({
      album: null,
      posterUrl: cover("e715b41e-d879-4c25-aeed-3962ca2a0425"),
      disambiguation: "Ukraine, Eurovision 2022 entry",
    });
  });

  it("counts a soundtrack as a studio Album, before a remix single", () => {
    const [result] = search("Running Up That Hill Kate Bush", [runningUpThatHill]);

    expect(result).toMatchObject({
      album: symphonyOfBritishMusic.title,
      posterUrl: cover(symphonyOfBritishMusic.id),
    });
  });

  it("shows no album and no cover for a song on no Official release", () => {
    const [result] = search("Stefania Glitchgirl", [glitchgirlRemix]);

    expect(result).toMatchObject({ album: null, posterUrl: null, disambiguation: null });
  });

  it("leaves out a recording of unknown shape, and keeps the rest", () => {
    const results = search("Karma Police", [
      { ...karmaPolice, id: "not-an-mbid" },
      karmaPolice,
    ] as Recording[]);

    expect(results.map((result) => result.externalReference.id)).toEqual([karmaPolice.id]);
  });

  it("is null for an answer of unknown shape", () => {
    expect(songSearchMatches("Karma Police", { error: "Oops" }, coverArtArchive)).toBeNull();
    expect(songSearchMatches("Karma Police", "<html>", coverArtArchive)).toBeNull();
  });
});
