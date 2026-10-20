import { useEffect, useState } from "react";
import * as api from "../api";
import { type Found, foundIn } from "./found";

// How long typing has to pause before a search runs.
export const searchDelayMs = 400;

export interface CatalogSearch {
  status: "idle" | "searching" | "done" | "failed";
  // The latest results, the User's own Manual Media Items first, kept while the next search runs
  // so the list doesn't flicker.
  results: Found[];
}

const idle: CatalogSearch = { status: "idle", results: [] };

// Searches the catalog for `query` once it has stopped changing for searchDelayMs. A newer query
// cancels the pending or running search, so an older answer never replaces a newer one.
export function useCatalogSearch(query: string): CatalogSearch {
  const [search, setSearch] = useState<CatalogSearch>(idle);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) {
      setSearch(idle);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearch((current) => ({ ...current, status: "searching" }));
      const outcome = await api.searchCatalog(trimmed, controller.signal);
      if (controller.signal.aborted) return;
      setSearch(
        outcome.ok
          ? { status: "done", results: foundIn(outcome.manualResults, outcome.results) }
          : { status: "failed", results: [] },
      );
    }, searchDelayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  return search;
}
