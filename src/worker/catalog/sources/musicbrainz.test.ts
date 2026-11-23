import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogEnv } from "../source";
import { musicBrainzAlbums } from "./musicbrainz";

// Album search's ranking against MusicBrainz's own answers (checked 2026-11-21), which matches
// with any word of the query, unlike the fake, which needs every word.

const env = {
  MUSICBRAINZ_BASE_URL: "https://musicbrainz.test/ws/2",
  COVER_ART_ARCHIVE_BASE_URL: "https://coverartarchive.test",
  OPEN_LIBRARY_CONTACT: "https://example.test/contact",
  MUSICBRAINZ_INTERVAL_MS: "0",
} as unknown as CatalogEnv;

interface Group {
  id: string;
  title: string;
  type: "Album" | "EP";
  artist: string;
  releases: number;
}

// A search answer holding these release groups, in MusicBrainz's order.
function answer(groups: Group[]) {
  return Response.json({
    "release-groups": groups.map((group) => ({
      id: group.id,
      title: group.title,
      count: group.releases,
      "primary-type": group.type,
      "first-release-date": "2007",
      "artist-credit": [{ name: group.artist, artist: { id: group.id } }],
    })),
  });
}

async function searchTitles(query: string, groups: Group[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => answer(groups)),
  );
  const results = (await musicBrainzAlbums.search?.(env, query)) ?? [];
  return results.map((result) => `${result.title} · ${result.artistCredit}`);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("album search", () => {
  it("counts a word of the query once, for the title or the artist, never both", async () => {
    const titles = await searchTitles("OK Computer", [
      {
        id: "40684055-b3dd-49d0-b376-bffc8458a2ba",
        title: "Computer",
        type: "EP",
        artist: "Computer",
        releases: 1,
      },
      {
        id: "b1392450-e666-3926-a536-22c65f834433",
        title: "OK Computer",
        type: "Album",
        artist: "Radiohead",
        releases: 39,
      },
    ]);

    expect(titles).toEqual(["OK Computer · Radiohead", "Computer · Computer"]);
  });

  it("puts the album with more releases first when the query names two alike", async () => {
    const titles = await searchTitles("Radiohead In Rainbows", [
      {
        id: "d5eb0376-6f0f-4b28-b5d1-4584b9be8d75",
        title: "Radiohead",
        type: "Album",
        artist: "In Rainbows",
        releases: 1,
      },
      {
        id: "6e335887-60ba-38f0-95af-fae7774336bf",
        title: "In Rainbows",
        type: "Album",
        artist: "Radiohead",
        releases: 20,
      },
    ]);

    expect(titles).toEqual(["In Rainbows · Radiohead", "Radiohead · In Rainbows"]);
  });

  it("puts the album with more releases first among ones of the title a bare title names", async () => {
    const titles = await searchTitles("Abbey Road", [
      {
        id: "004a4e79-ac6c-448a-9d7f-b1b1714aa22a",
        title: "Abbey Road",
        type: "Album",
        artist: "Various Artists",
        releases: 1,
      },
      {
        id: "9162580e-5df4-32de-80cc-f45a8d8a9b1d",
        title: "Abbey Road",
        type: "Album",
        artist: "The Beatles",
        releases: 75,
      },
    ]);

    expect(titles).toEqual(["Abbey Road · The Beatles", "Abbey Road · Various Artists"]);
  });
});
