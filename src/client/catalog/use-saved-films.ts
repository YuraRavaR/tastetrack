import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaType } from "../../shared/api";
import * as api from "../api";
import { type SavedFilm, savedFilms } from "./saved-search";

export interface SavedFilms {
  status: "loading" | "loaded" | "failed";
  // Kept while a reload runs, so "In your Saved" doesn't flicker.
  films: SavedFilm[];
  // Says the User changed what they saved: the films load again once the query next changes.
  changed(): void;
}

// The User's saved films of the Media Type, from their Library and their Lists, loaded as the page
// opens. A change the User makes on the page reloads them only when the query next changes, so a
// film doesn't leave the results the User is acting on.
export function useSavedFilms(mediaType: MediaType, query: string): SavedFilms {
  const [state, setState] = useState<Omit<SavedFilms, "changed">>({
    status: "loading",
    films: [],
  });
  const trimmed = query.trim();
  // Only the latest load may answer; leaving the page counts as a newer one.
  const latestLoad = useRef(0);
  // The query the User last changed their saved films under, until the next load.
  const changedUnder = useRef<string | null>(null);

  const load = useCallback(async () => {
    const thisLoad = ++latestLoad.current;
    try {
      const [library, listed] = await Promise.all([
        api.fetchLibrary(mediaType),
        api.fetchListedMediaItems(mediaType),
      ]);
      if (thisLoad === latestLoad.current) {
        setState({ status: "loaded", films: savedFilms(library, listed) });
      }
    } catch {
      if (thisLoad === latestLoad.current)
        setState((current) => ({ ...current, status: "failed" }));
    }
  }, [mediaType]);

  useEffect(() => {
    void load();
    return () => {
      latestLoad.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (changedUnder.current === null || changedUnder.current === trimmed) return;
    changedUnder.current = null;
    void load();
  }, [trimmed, load]);

  return {
    ...state,
    changed: () => {
      changedUnder.current = trimmed;
    },
  };
}
