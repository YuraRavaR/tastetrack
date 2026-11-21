import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaType } from "../../shared/api";
import * as api from "../api";
import { type Found, foundIn } from "./found";

// How long typing has to pause before a search runs.
export const searchDelayMs = 400;

// A search's state. It is `busy` when the External Source refused it as too busy, as MusicBrainz
// does (ADR-0013), and `failed` for any other failure.
interface SearchState {
  status: "idle" | "searching" | "done" | "failed" | "busy";
  // The latest results, the User's own Manual Media Items first, kept while the next search runs
  // so the list doesn't flicker.
  results: Found[];
}

export interface CatalogSearch extends SearchState {
  // Runs the same search again at once, as after the source was busy.
  retry: () => void;
}

const idle: SearchState = { status: "idle", results: [] };

// Searches the Media Type's catalog for `query` once it has stopped changing for searchDelayMs,
// but the query the page opens with, which no one typed, at once. A newer query cancels the
// pending or running search, so an older answer never replaces a newer one. One search serves one
// Media Type: a page that changes it mounts the search anew. A retry runs the search again at once.
export function useCatalogSearch(mediaType: MediaType, query: string): CatalogSearch {
  const [search, setSearch] = useState<SearchState>(idle);
  const trimmed = query.trim();
  const openingQuery = useRef<string | null>(trimmed);
  // Each retry runs the effect again, for the same query, at once.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    openingQuery.current = trimmed;
    setAttempt((current) => current + 1);
  }, [trimmed]);

  useEffect(() => {
    // A retry's attempt runs the search again, though nothing else changed.
    void attempt;
    if (!trimmed) {
      setSearch(idle);
      return;
    }
    const controller = new AbortController();
    const delay = trimmed === openingQuery.current ? 0 : searchDelayMs;
    const timer = setTimeout(async () => {
      openingQuery.current = null;
      setSearch((current) => ({ ...current, status: "searching" }));
      const outcome = await api.searchCatalog(mediaType, trimmed, controller.signal);
      if (controller.signal.aborted) return;
      setSearch(
        outcome.ok
          ? { status: "done", results: foundIn(outcome.manualResults, outcome.results) }
          : { status: outcome.error === "busy" ? "busy" : "failed", results: [] },
      );
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mediaType, trimmed, attempt]);

  return { ...search, retry };
}
