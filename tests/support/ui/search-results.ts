import type { Page } from "@playwright/test";

// A search result on the page, by its label. `searchResult` is the same result from the API.
export function searchResultRow(page: Page, label: string) {
  return page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem")
    .filter({ has: page.getByText(label, { exact: true }) });
}
