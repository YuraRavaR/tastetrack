import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";
import type { CatalogSearchResult, ExternalReference, NewManualAlbumRequest } from "@shared/api";
import type { ApiClient } from "../api/ApiClient";
import { expectBody } from "../api/responses";

// Locally the Worker calls a MusicBrainz fake with fixed data; on staging, the real MusicBrainz.
// The fake's release groups mirror MusicBrainz as it was on 2026-11-21, so tests check only what
// both answer alike, or skip on real MusicBrainz (callsRealMusicBrainz).

// Real MusicBrainz is called on staging, and locally when .dev.vars sets MUSICBRAINZ_BASE_URL.
// Only the MusicBrainz fake can be made busy, or counts the calls it refused.
export function callsRealMusicBrainz(): boolean {
  if (process.env.BASE_URL) return true;
  try {
    return /^MUSICBRAINZ_BASE_URL=/m.test(readFileSync(".dev.vars", "utf8"));
  } catch {
    return false;
  }
}

// An album's External Reference, by its release group's MBID.
export function albumReference(id: string) {
  return { source: "musicbrainz", mediaType: "album", id } as const satisfies ExternalReference;
}

// The MusicBrainz results of an album search, as the Worker answers them.
export async function albumSearchResults(client: ApiClient, query: string) {
  const search = client.catalog.searchCatalog({ mediaType: "album", query });
  return (await expectBody(search)).results;
}

// One album among the results of a search, which must find it.
export async function albumSearchResult(client: ApiClient, query: string, id: string) {
  const results = await albumSearchResults(client, query);
  const result = results.find((r: CatalogSearchResult) => r.externalReference.id === id);
  if (!result) throw new Error(`Release group ${id} isn't among the results for "${query}"`);
  return result;
}

// An album's Media Item, as adding it from search makes or finds it.
export async function album(client: ApiClient, query: string, id: string) {
  const result = await albumSearchResult(client, query, id);
  const response = await client.catalog.addCatalogItem(result);
  expect([200, 201]).toContain(response.status());
  return (await response.json()).mediaItem;
}

// An album the User adds by hand, as a Manual Media Item.
export async function manualAlbum(
  client: ApiClient,
  data: Omit<NewManualAlbumRequest, "mediaType">,
) {
  const created = client.catalog.addManualMediaItem({ mediaType: "album", ...data });
  return (await expectBody(created, 201)).mediaItem;
}

// An album of six releases, titled in Cyrillic, which a Cyrillic query finds.
export const zemlyaId = "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8";
export const zemlya = (client: ApiClient) => album(client, "Океан Ельзи Земля", zemlyaId);
// Abbey Road, which MusicBrainz finds with its remix album, which has no cover, and with albums
// and a single of other artists that share its title.
export const abbeyRoadId = "9162580e-5df4-32de-80cc-f45a8d8a9b1d";
export const abbeyRoad = (client: ApiClient) => album(client, "Abbey Road Beatles", abbeyRoadId);
export const abbeyRoadRemixId = "42ef6001-3113-440c-ae7c-3667c7351e35";
export const abbeyRoadSingleId = "284326a7-edbb-4b9b-82cf-dc53863759ef";
// 1944 by Jamala, as an EP, an album and a single, which MusicBrainz ranks in that order.
export const jamala1944AlbumId = "68b61f05-aa49-4dda-9cdc-1104e4541aed";
export const jamala1944EpId = "b7f51377-4088-43bc-beb7-58705d9af90e";
export const jamala1944SingleId = "04d4b9ba-6f72-4c52-b907-8536ff96f304";
export const jamala1944 = (client: ApiClient) => album(client, "1944 Jamala", jamala1944AlbumId);
// A live album and a soundtrack, albums of their own.
export const hollywoodBowlId = "eabb68b3-d57c-359a-8215-91f38d365da5";
export const interstellarId = "4513c7b9-854e-457f-81d6-3dbeb001beb8";
// The Dark Side of the Moon, which MusicBrainz ranks behind a plain studio album that pays tribute
// to it, and MTV Unplugged in New York, a live album, with a plain studio album of covers of it.
export const darkSideOfTheMoonId = "f5093c06-23e3-404f-aeaa-40f72885ee3a";
export const darkSideTributeId = "6d3d6885-651b-3d8e-a67b-7832248abb52";
export const unpluggedInNewYorkId = "fb3770f6-83fb-32b7-85c4-1f522a92287e";
export const unpluggedTributeId = "9be783c7-57c1-4555-ab44-188b569bae04";
// An interview and an audiobook, which search hides.
export const beatlesStoryId = "84225cac-5cd3-3389-a84e-e673e3bf3242";
export const troyAudiobookId = "a9e84258-d41b-4c64-84e3-654e71eb8154";
// An EP credited to two artists, with no cover.
export const bedouinReworksId = "67210625-2acc-4689-8b76-a43181af8a10";
// A release group merged into Bye Bye Birdie, whose old MBID MusicBrainz redirects.
export const mergedId = "a51b25f4-2dc1-4787-b779-51abcdb170ff";
export const byeByeBirdieId = "9cd2811d-a999-326e-8945-a8b6b44b9e92";

// A cover from the Cover Art Archive, as the Worker links it, by its release group and size,
// wherever the archive is.
export function coverArt(id: string, size: 250 | 500) {
  return expect.stringMatching(new RegExp(`/release-group/${id}/front-${size}$`));
}

// A release group's page on MusicBrainz.
export function musicBrainzPage(id: string) {
  return `https://musicbrainz.org/release-group/${id}`;
}
