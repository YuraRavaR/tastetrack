import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";
import type { ExternalReference, NewManualGameRequest } from "@shared/api";
import type { ApiClient } from "../api/ApiClient";
import { expectBody } from "../api/responses";

// Locally the Worker calls an IGDB fake with fixed data; on staging, the real IGDB. The fake's
// games mirror IGDB as it was on 2026-11-19, so tests check only what both answer alike, or skip on
// real IGDB (callsRealIgdb).

// Real IGDB is called on staging, and locally when .dev.vars sets IGDB_BASE_URL. Only the IGDB
// fake can be made to fail or to refuse a token.
export function callsRealIgdb(): boolean {
  if (process.env.BASE_URL) return true;
  try {
    return /^IGDB_BASE_URL=/m.test(readFileSync(".dev.vars", "utf8"));
  } catch {
    return false;
  }
}

export function gameReference(id: string) {
  return { source: "igdb", mediaType: "game", id } as const satisfies ExternalReference;
}

export async function gameSearchResults(client: ApiClient, query: string) {
  const search = client.catalog.searchCatalog({ mediaType: "game", query });
  return (await expectBody(search)).results;
}

export async function gameSearchResult(client: ApiClient, query: string, id: string) {
  const results = await gameSearchResults(client, query);
  const result = results.find((r: { externalReference: { id: string } }) => {
    return r.externalReference.id === id;
  });
  expect(result, `IGDB game ${id} among the results for "${query}"`).toBeDefined();
  return result;
}

// A game's Media Item, as adding it from search makes or finds it.
export async function game(client: ApiClient, query: string, id: string) {
  const result = await gameSearchResult(client, query, id);
  const response = await client.catalog.addCatalogItem(result);
  expect([200, 201]).toContain(response.status());
  return (await response.json()).mediaItem;
}

// A game the User adds by hand, as a Manual Media Item.
export async function manualGame(client: ApiClient, data: Omit<NewManualGameRequest, "mediaType">) {
  const created = client.catalog.addManualMediaItem({ mediaType: "game", ...data });
  return (await expectBody(created, 201)).mediaItem;
}

// A main game, which IGDB finds with its DLC, expansions, editions, a bundle, an update and a mod.
export const witcher3Id = "1942";
export const witcher3 = (client: ApiClient) => game(client, "witcher 3", witcher3Id);
// A game with a Russian alternative name, which a Cyrillic query matches.
export const stalkerId = "320";
export const stalker = (client: ApiClient) => game(client, "stalker", stalkerId);
// The 1997 PS1 Final Fantasy VII, which has no artworks or screenshots for a banner, and of its
// namesakes on IGDB: the International edition, a port, the 2005 Famicom game, and the cancelled
// Super Famicom one.
export const finalFantasy7Id = "393025";
export const finalFantasy7 = (client: ApiClient) => {
  return game(client, "final fantasy vii", finalFantasy7Id);
};
export const finalFantasy7International = "427";
export const finalFantasy7Port = "207026";
export const finalFantasy7Famicom = "2406";
export const finalFantasy7Cancelled = "381337";
// A game without a cover, artworks or screenshots.
export const spiritGlaiveId = "365395";

export function igdbImage(size: string, imageId: string) {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}
