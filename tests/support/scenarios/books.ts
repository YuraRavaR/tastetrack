import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import type { ExternalReference } from "@shared/api";
import type { ApiClient } from "../api/ApiClient";
import { expectBody } from "../api/responses";

// Locally the Worker calls an Open Library fake with fixed data; on staging, the real Open Library.
// So tests use only the works the fake mirrors, and check only what both answer alike.

// Real Open Library is called on staging, and locally when .dev.vars sets OPEN_LIBRARY_BASE_URL.
// Only the fake can be made to fail, or has a work no one has added.
export function callsRealOpenLibrary(): boolean {
  if (process.env.BASE_URL) return true;
  try {
    return /^OPEN_LIBRARY_BASE_URL=/m.test(readFileSync(".dev.vars", "utf8"));
  } catch {
    return false;
  }
}

export function bookReference(id: string) {
  return { source: "openlibrary", mediaType: "book", id } as const satisfies ExternalReference;
}

export async function bookSearchResults(client: ApiClient, query: string) {
  const search = client.catalog.searchCatalog({ mediaType: "book", query });
  return (await expectBody(search)).results;
}

export async function bookSearchResult(client: ApiClient, query: string, id: string) {
  const results = await bookSearchResults(client, query);
  const result = results.find((r: { externalReference: { id: string } }) => {
    return r.externalReference.id === id;
  });
  expect(result, `Open Library work ${id} among the results for "${query}"`).toBeDefined();
  return result;
}

// A book's Media Item, as adding it from search makes or finds it.
export async function book(client: ApiClient, query: string, id: string) {
  const result = await bookSearchResult(client, query, id);
  const response = await client.catalog.addCatalogItem(result);
  expect([200, 201]).toContain(response.status());
  return (await response.json()).mediaItem;
}

// A Ukrainian novel with a Ukrainian edition and a cover, and no English edition.
export const tyhrolovyId = "OL2094429W";
export const tyhrolovy = (client: ApiClient) => book(client, "Тигролови", tyhrolovyId);
// A Ukrainian novel Open Library holds only in translation, under its transliterated title.
export const voroshilovgradId = "OL19962759W";
export const voroshilovgrad = (client: ApiClient) => {
  return book(client, "Voroshilovgrad", voroshilovgradId);
};
// A work with English and Ukrainian editions, titled differently.
export const harryPotterId = "OL82563W";
export const harryPotter = (client: ApiClient) => {
  return book(client, "Harry Potter and the Philosopher's Stone", harryPotterId);
};
// A Japanese novel with an English edition and no Ukrainian one.
export const kafkaOnTheShoreId = "OL2625431W";
export const kafkaOnTheShore = (client: ApiClient) => {
  return book(client, "Kafka on the Shore", kafkaOnTheShoreId);
};
// A work without a cover.
export const hymnId = "OL12697597W";
export const hymn = (client: ApiClient) => book(client, "Himn demokratychnoï molodi", hymnId);

// A work Open Library merged into another, "One Coffee With": its old id answers with a redirect
// to the work it became, and search no longer finds it. So a test adds it as a client that found
// it before the merge would.
export const mergedWorkId = "OL100005W";
export const mergedInto = {
  id: "OL99995W",
  title: "One Coffee With (Sigrid Harald Mysteries)",
  author: "Margaret Maron",
  year: 1981,
};
export const mergedWorkFromSearch = {
  externalReference: bookReference(mergedWorkId),
  title: "One Coffee With",
  originalTitle: "One Coffee With",
  year: 1981,
  posterUrl: null,
  titleLanguage: "en",
} as const;

// A query the Open Library fake answers with one work no one has added yet, whatever earlier test
// runs left in local D1, and that work's title. Only the fake knows it.
export function newBook() {
  const id = `OL${Math.floor(Math.random() * 1e11) + 9e11}W`;
  return { id, query: `open library fake new book ${id}`, title: `New book ${id}` };
}

export function coverUrl(coverId: number, size: "M" | "L"): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

// Leaves every Open Library cover loading for good, so a browser test sees the page before any
// image arrives and asks nothing of Open Library.
export async function holdCovers(page: Page): Promise<void> {
  await page.route("https://covers.openlibrary.org/**", () => {});
}
