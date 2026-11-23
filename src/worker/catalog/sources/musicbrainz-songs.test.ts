import { afterEach, describe, expect, it, vi } from "vitest";
import {
  obiimy,
  runningUpThatHill,
  symphonyOfBritishMusic,
  zemlya,
} from "../../../shared/test-data/musicbrainz-recordings";
import type { CatalogEnv } from "../source";
import { musicBrainzSongs } from "./musicbrainz-songs";

// A song's details against MusicBrainz's own answers. The browser searches songs, so their search
// rules are tested in src/shared/musicbrainz-songs.test.ts.

const env = {
  MUSICBRAINZ_BASE_URL: "https://musicbrainz.test/ws/2",
  COVER_ART_ARCHIVE_BASE_URL: "https://coverartarchive.test",
  OPEN_LIBRARY_CONTACT: "https://example.test/contact",
  MUSICBRAINZ_INTERVAL_MS: "0",
} as unknown as CatalogEnv;

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
