import { expect } from "@playwright/test";
import type { AddCatalogItemRequest, ExternalReference, NewManualSongRequest } from "@shared/api";
import type { ApiClient } from "../api/ApiClient";
import { expectBody } from "../api/responses";

// Locally the Worker looks songs up in a MusicBrainz fake with fixed data, and the browser's
// search is sent to it too (support/ui/musicbrainz.ts); on staging, the real MusicBrainz. The
// fake's recordings mirror MusicBrainz's answers of 2026-11-22, so tests check only what both
// answer alike, or skip on real MusicBrainz (callsRealMusicBrainz, in ./albums).

// A song's External Reference, by its recording's MBID.
export function songReference(id: string) {
  return { source: "musicbrainz", mediaType: "song", id } as const satisfies ExternalReference;
}

// What the browser's song search sends to add a song: the Worker keeps only its External
// Reference and these, and its details call fills in the rest. The Worker doesn't search songs
// (ADR-0013), so a test makes the result itself.
export function songResult(
  id: string,
  title: string,
  found: Partial<Pick<AddCatalogItemRequest, "year" | "posterUrl">> = {},
): AddCatalogItemRequest {
  return {
    externalReference: songReference(id),
    title,
    originalTitle: title,
    year: null,
    posterUrl: null,
    titleLanguage: /\p{Script=Cyrillic}/u.test(title) ? "uk" : "en",
    ...found,
  };
}

// A song's Media Item, as adding it from search makes or finds it.
export async function song(client: ApiClient, id: string, title: string) {
  const response = await client.catalog.addCatalogItem(songResult(id, title));
  expect([200, 201]).toContain(response.status());
  return (await response.json()).mediaItem;
}

// A song the User adds by hand, as a Manual Media Item.
export async function manualSong(client: ApiClient, data: Omit<NewManualSongRequest, "mediaType">) {
  const created = client.catalog.addManualMediaItem({ mediaType: "song", ...data });
  return (await expectBody(created, 201)).mediaItem;
}

// Обійми by Океан Ельзи, from the album Земля.
export const obiimyId = "d8d55f18-0c4b-4036-a16d-e273ac8953fc";
export const zemlyaGroupId = "080f0c63-6e0b-42d0-917d-e22d1d4bdaf8";
export const obiimy = (client: ApiClient) => song(client, obiimyId, "Обійми");
// Karma Police by Radiohead, from OK Computer.
export const karmaPoliceId = "9e2ad5bc-c6f9-40d2-a36f-3122ee2072a3";
export const karmaPolice = (client: ApiClient) => song(client, karmaPoliceId, "Karma Police");
// Шум by Go_A, its "original version".
export const shumId = "09aeabc9-988d-46d5-9e7a-1ab44a543b3b";
export const shum = (client: ApiClient) => song(client, shumId, "Шум");
// A recording merged into Kate Bush's 2012 remix of Running Up That Hill, whose old MBID
// MusicBrainz redirects.
export const mergedSongId = "fcde0790-ab0d-4f3f-b984-211b2b330af9";
export const runningUpThatHillRemixId = "7a0aecf5-0538-42d6-a468-78e0d3a9dead";

// A recording's page on MusicBrainz.
export function recordingPage(id: string) {
  return `https://musicbrainz.org/recording/${id}`;
}
