import { useEffect } from "react";
import { t } from "../i18n/t";

// The browser tab's title for a page named by `names`, the page itself first and then what it
// belongs to, with the app's name last: ["Watchlist", "Films"] is "Watchlist · Films · TasteTrack",
// and no names is "TasteTrack".
export function pageTitle(names: readonly string[]): string {
  return names.reduceRight((rest, page) => t("app.pageTitle", { page, rest }), t("app.name"));
}

// Whether the tab still shows the title the page's HTML came with, which a Share Link's page has
// from the Worker, because no page has named the tab since.
let titledByHtml = true;

// Names the browser tab after the page, as `pageTitle` writes it. Every page calls it, so the
// title moves on with each page and never keeps the last one's. `null` is for a page still
// loading what names it: it keeps the title its HTML came with, if that is still showing, and is
// the app's name otherwise.
export function usePageTitle(names: readonly string[] | null): void {
  const title = names && pageTitle(names);
  useEffect(() => {
    if (title === null && titledByHtml) return;
    document.title = title ?? pageTitle([]);
    titledByHtml = false;
  }, [title]);
}
