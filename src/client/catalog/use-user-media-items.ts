import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaType } from "../../shared/api";
import * as api from "../api";
import { type UserMediaItem, userMediaItems } from "./user-media-items";

export interface UserMediaItems {
  status: "loading" | "loaded" | "failed";
  // Kept while a reload runs, so "In your Saved" doesn't flicker.
  items: UserMediaItem[];
  // Says the User changed their Library or Lists: the items load again once the query next
  // changes.
  changed(): void;
}

// The User's Media Items of the Media Type, from their Library and their Lists, loaded as the page
// opens. A change the User makes on the page reloads them only when the query next changes, so a
// Media Item doesn't leave the results the User is acting on.
export function useUserMediaItems(mediaType: MediaType, query: string): UserMediaItems {
  const [state, setState] = useState<Omit<UserMediaItems, "changed">>({
    status: "loading",
    items: [],
  });
  const trimmed = query.trim();
  // Only the latest load may answer; leaving the page counts as a newer one.
  const latestLoad = useRef(0);
  // The query the User last changed their Library or Lists under, until the next load.
  const changedUnder = useRef<string | null>(null);

  const load = useCallback(async () => {
    const thisLoad = ++latestLoad.current;
    try {
      const [library, listed] = await Promise.all([
        api.fetchLibrary(mediaType),
        api.fetchListedMediaItems(mediaType),
      ]);
      if (thisLoad === latestLoad.current) {
        setState({ status: "loaded", items: userMediaItems(library, listed) });
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
