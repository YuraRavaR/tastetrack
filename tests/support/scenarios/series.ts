import { expect } from "@playwright/test";
import type { ExternalReference, NewManualSeriesRequest } from "@shared/api";
import type { ApiClient } from "../api/ApiClient";
import { expectBody } from "../api/responses";

// Locally the Worker calls a TMDB fake with fixed data; on staging, the real TMDB. The fake's
// series mirror TMDB as it was on 2026-11-15, and a running one changes on TMDB every week, so
// tests check only what both answer alike, or skip on real TMDB (callsRealTmdb).

export function seriesReference(id: string) {
  return { source: "tmdb", mediaType: "series", id } as const satisfies ExternalReference;
}

export async function seriesSearchResults(client: ApiClient, query: string) {
  const search = client.catalog.searchCatalog({ mediaType: "series", query });
  return (await expectBody(search)).results;
}

export async function seriesSearchResult(client: ApiClient, query: string, id: string) {
  const results = await seriesSearchResults(client, query);
  const result = results.find((r: { externalReference: { id: string } }) => {
    return r.externalReference.id === id;
  });
  expect(result, `TMDB series ${id} among the results for "${query}"`).toBeDefined();
  return result;
}

// A series' Media Item, as adding it from search makes or finds it.
export async function series(client: ApiClient, query: string, id: string) {
  const result = await seriesSearchResult(client, query, id);
  const response = await client.catalog.addCatalogItem(result);
  expect([200, 201]).toContain(response.status());
  return (await response.json()).mediaItem;
}

// A series the User adds by hand, as a Manual Media Item.
export async function manualSeries(
  client: ApiClient,
  data: Omit<NewManualSeriesRequest, "mediaType">,
) {
  const created = client.catalog.addManualMediaItem({ mediaType: "series", ...data });
  return (await expectBody(created, 201)).mediaItem;
}

// An ended miniseries, with a Ukrainian title.
export const chernobylId = "87108";
export const chernobyl = (client: ApiClient) => series(client, "chernobyl", chernobylId);
// An ended series with a season 0 of specials, and a Ukrainian title unlike its English one.
export const breakingBadId = "1396";
export const breakingBad = (client: ApiClient) => series(client, "breaking bad", breakingBadId);
// A running series whose current season lists an episode that hasn't aired yet. On real TMDB its
// last aired episode moves on every week.
export const mobLandId = "247718";
export const mobLand = (client: ApiClient) => series(client, "mobland", mobLandId);
// A series with a backdrop and no poster. Only the TMDB fake has it, so skip the test on real TMDB.
export const noPosterSeriesId = "999000102";
export const noPosterSeries = (client: ApiClient) => {
  return series(client, "tmdb fake no poster series", noPosterSeriesId);
};

export function posterUrl(path: string, size: "w92" | "w500") {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
