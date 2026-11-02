import type { Page } from "@playwright/test";
import { SearchResults } from "./components/SearchResults";

// A search result on the page, by its label. `searchResult` is the same result from the API.
export function searchResultRow(page: Page, label: string) {
  return new SearchResults(page.getByRole("list", { name: "Search results" })).result(label).root;
}
