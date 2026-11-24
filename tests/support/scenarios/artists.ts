import { expect } from "@playwright/test";
import type { CatalogSearchResult, ExternalReference, NewManualArtistRequest } from "@shared/api";
import type { ApiClient } from "../api/ApiClient";
import { expectBody } from "../api/responses";

// Locally the Worker calls a MusicBrainz fake and a Wikimedia fake with fixed data; on staging,
// the real ones. The fakes' artists mirror MusicBrainz's and Wikidata's answers of 2026-11-24, so
// tests check only what both answer alike, or skip on real MusicBrainz (callsRealMusicBrainz, in
// ./albums).

// An artist's External Reference, by their MBID.
export function artistReference(id: string) {
  return { source: "musicbrainz", mediaType: "artist", id } as const satisfies ExternalReference;
}

// The MusicBrainz results of an artist search, as the Worker answers them.
export async function artistSearchResults(client: ApiClient, query: string) {
  const search = client.catalog.searchCatalog({ mediaType: "artist", query });
  return (await expectBody(search)).results;
}

// One artist among the results of a search, which must find them.
export async function artistSearchResult(client: ApiClient, query: string, id: string) {
  const results = await artistSearchResults(client, query);
  const result = results.find((r: CatalogSearchResult) => r.externalReference.id === id);
  if (!result) throw new Error(`Artist ${id} isn't among the results for "${query}"`);
  return result;
}

// An artist's Media Item, as adding them from search makes or finds it.
export async function artist(client: ApiClient, query: string, id: string) {
  const result = await artistSearchResult(client, query, id);
  const response = await client.catalog.addCatalogItem(result);
  expect([200, 201]).toContain(response.status());
  return (await response.json()).mediaItem;
}

// An artist the User adds by hand, as a Manual Media Item.
export async function manualArtist(
  client: ApiClient,
  data: Omit<NewManualArtistRequest, "mediaType">,
) {
  const created = client.catalog.addManualMediaItem({ mediaType: "artist", ...data });
  return (await expectBody(created, 201)).mediaItem;
}

// Океан Ельзи, whose Latin aliases find them too, with a photo credited to its photographer.
export const okeanElzyId = "87a417d3-f118-43e0-bece-3de1bd90fce0";
export const okeanElzy = (client: ApiClient) => artist(client, "Океан Ельзи", okeanElzyId);
// Two groups that share a word: KALUSH, and Kalush Orchestra, whose Wikidata entity has a preferred
// image after one of normal rank.
export const kalushId = "628d9735-f961-4eb0-92ee-31d77f9c8b8f";
export const kalushOrchestraId = "45d9e75f-cbdf-47df-b4e6-1578d8a17e25";
export const radioheadId = "a74b1b7f-71a5-4011-9441-d0b5e4122711";
export const radiohead = (client: ApiClient) => artist(client, "Radiohead", radioheadId);
// A solo artist and a group of one name. The Wikimedia fake fails for the singer's entity.
export const aliceCooperId = "ee58c59f-8e7f-4430-b8ca-236c4d3745ae";
export const aliceCooperBandId = "4d7928cd-7ed2-4282-8c29-c0c9f966f1bd";
// An ended group, with a public-domain photo and soundtracks among its studio albums.
export const pinkFloydId = "83d91898-7763-47d7-b03b-b92132375c47";
// A tribute band with no Wikidata link, and the 1960s UK Nirvana, whose entity has no image.
export const celticPinkFloydId = "b32609b0-d91e-4227-a7c5-998facfe8741";
export const nirvanaUkId = "9282c8b4-ca0b-4c6b-b7e3-4f7762dfc4d6";
// The special-purpose Various Artists and [unknown], and two real artists named Various Artists.
export const variousArtistsId = "89ad4ac3-39f7-470e-963a-56509c546377";
export const unknownId = "125ec42a-7229-4250-afc5-e057484327fe";
export const variousArtistsTechnoId = "4e46dd54-81a6-4a75-a666-d0e447861e3f";
export const variousArtistsBristolId = "8e107957-c443-45b4-84f7-8b054499ef78";
// An artist merged into Taylor Dee, whose old MBID MusicBrainz redirects.
export const mergedArtistId = "e3329ebf-a7ee-45a0-98d5-c84a482a4611";
export const taylorDeeId = "24dad84a-2918-48aa-9337-07b675443f0d";

// An artist's page on MusicBrainz.
export function artistPage(id: string) {
  return `https://musicbrainz.org/artist/${id}`;
}

// A photo as the Worker links it, by its Commons file name and width, wherever Commons is.
export function commonsPhoto(file: string, width: 250 | 500) {
  const path = `/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
  return expect.stringMatching(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
}
