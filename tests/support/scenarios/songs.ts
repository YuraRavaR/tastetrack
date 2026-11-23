import { expect } from "@playwright/test";
import type { CatalogSearchResult, ExternalReference, NewManualSongRequest } from "@shared/api";
import type { ApiClient } from "../api/ApiClient";
import { expectBody } from "../api/responses";

// Locally the Worker calls a MusicBrainz fake with fixed data; on staging, the real MusicBrainz.
// The fake's recordings mirror MusicBrainz's answers of 2026-11-22, so tests check only what both
// answer alike, or skip on real MusicBrainz (callsRealMusicBrainz, in ./albums).

// A song's External Reference, by its recording's MBID.
export function songReference(id: string) {
  return { source: "musicbrainz", mediaType: "song", id } as const satisfies ExternalReference;
}

// The MusicBrainz results of a song search, as the Worker answers them.
export async function songSearchResults(client: ApiClient, query: string) {
  const search = client.catalog.searchCatalog({ mediaType: "song", query });
  return (await expectBody(search)).results;
}

// One song among the results of a search, which must find it.
export async function songSearchResult(client: ApiClient, query: string, id: string) {
  const results = await songSearchResults(client, query);
  const result = results.find((r: CatalogSearchResult) => r.externalReference.id === id);
  if (!result) throw new Error(`Recording ${id} isn't among the results for "${query}"`);
  return result;
}

// A song's Media Item, as adding it from search makes or finds it.
export async function song(client: ApiClient, query: string, id: string) {
  const result = await songSearchResult(client, query, id);
  const response = await client.catalog.addCatalogItem(result);
  expect([200, 201]).toContain(response.status());
  return (await response.json()).mediaItem;
}

// A song the User adds by hand, as a Manual Media Item.
export async function manualSong(client: ApiClient, data: Omit<NewManualSongRequest, "mediaType">) {
  const created = client.catalog.addManualMediaItem({ mediaType: "song", ...data });
  return (await expectBody(created, 201)).mediaItem;
}

// Обійми by Океан Ельзи, from the album Земля, with a bonus-track and a remix recording of its own.
export const obiimyId = "d8d55f18-0c4b-4036-a16d-e273ac8953fc";
export const obiimyBonusTrackId = "22ea4f0b-0db2-4e24-a0d0-b60fa92f340b";
export const obiimyRemixId = "f4100990-432c-47c3-adc4-29a868a2439b";
export const zemlyaGroupId = "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8";
export const obiimy = (client: ApiClient) => song(client, "Обійми Океан Ельзи", obiimyId);
// Karma Police on OK Computer, with two more Radiohead recordings of it, live ones and covers. The
// Brooke's cover is on an album the Cover Art Archive has no cover for.
export const karmaPoliceId = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";
export const karmaPoliceCompilationId = "6c4a524d-641b-413a-bfbe-878974b86345";
export const karmaPoliceSingleId = "4f3c5b08-fbac-44e1-9b40-6786fc489c05";
export const karmaPoliceLiveIds = [
  "95491132-b493-4399-893a-bf6031052db8",
  "f909d18e-d8bc-49dd-a405-113a680936f6",
  "98e67e07-e497-48b4-92d1-a0743e162cd2",
];
export const karmaPoliceWithStipeId = "adbf08e6-2cf8-4dd3-bb5b-bdddba25da27";
export const brookeCoverId = "47ee964f-95b6-4102-ae39-4d836e1939d1";
export const brookeCoverGroupId = "b77895f1-343b-4a15-bef4-7951ff460214";
export const okComputerId = "b1392450-e666-3926-a536-22c65f834433";
export const karmaPolice = (client: ApiClient) =>
  song(client, "Karma Police Radiohead", karmaPoliceId);
// Шум by Go_A, its "original version" and a radio edit, and two music videos.
export const shumId = "09aeabc9-988d-46d5-9e7a-1ab44a543b3b";
export const shumRadioEditId = "37f5dc8e-3b15-4953-a768-215d5ff651d3";
export const shumVideoIds = [
  "59d2f04f-d238-4b25-a63d-a4c2717628fc",
  "7b0367ef-82f0-4170-b26c-c9792b24fee6",
];
export const shumSingleId = "44965ed2-80bb-4787-9996-84c5d3937870";
export const shum = (client: ApiClient) => song(client, "Шум Go_A", shumId);
// Stefania by Kalush Orchestra, on an EP and a single, with a karaoke version and a remix on no
// Official release.
export const stefaniaId = "b3a54e3b-dadd-41f7-8efe-3f5c07e3259c";
export const stefaniaKaraokeId = "cd463bfb-e4d7-4eec-8aef-7b301442c4d1";
export const stefaniaRemixId = "47fd3d33-f944-4e87-b9cc-808ff7ce64a9";
export const stefaniaEpId = "e715b41e-d879-4c25-aeed-3962ca2a0425";
// A recording merged into Kate Bush's 2012 remix of Running Up That Hill, whose old MBID
// MusicBrainz redirects.
export const mergedSongId = "fcde0790-ab0d-4f3f-b984-211b2b330af9";
export const runningUpThatHillRemixId = "7a0aecf5-0538-42d6-a468-78e0d3a9dead";

// A recording's page on MusicBrainz.
export function recordingPage(id: string) {
  return `https://musicbrainz.org/recording/${id}`;
}
