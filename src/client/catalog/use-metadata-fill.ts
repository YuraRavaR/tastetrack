import { useEffect, useRef, useState } from "react";
import type { FilmMetadata, MediaItem } from "../../shared/api";
import { maxMetadataFills } from "../../shared/catalog";
import * as api from "../api";

export interface MetadataFill {
  // The Media Item with the metadata a follow-up found for it, if any.
  filled(mediaItem: MediaItem): MediaItem;
  // True while a catalog-backed Media Item the page showed without metadata waits for a follow-up.
  loading(mediaItem: MediaItem): boolean;
}

// A page fills only a few films missing from the TMDB cache and shows the rest as placeholders
// (ADR-0004). This loads those, `maxMetadataFills` at a time, one request after another, in page
// order, and each film once per page view: one TMDB doesn't answer for stays unavailable.
export function useMetadataFill(mediaItems: readonly MediaItem[]): MetadataFill {
  // What follow-ups found, by Media Item id: null where TMDB didn't answer.
  const [found, setFound] = useState<ReadonlyMap<number, FilmMetadata | null>>(new Map());
  const requested = useRef(new Set<number>());
  const missing = [
    ...new Set(mediaItems.filter((item) => isMissing(item)).map((item) => item.id)),
  ].join(",");

  useEffect(() => {
    let cancelled = false;
    const all = missing.split(",").filter(Boolean).map(Number);
    // The page already tried its first `maxMetadataFills` misses, in this order, and TMDB didn't
    // answer for them, so asking again would only repeat those calls.
    const tried = all.slice(0, maxMetadataFills).filter((id) => !requested.current.has(id));
    for (const id of tried) requested.current.add(id);
    if (tried.length > 0) {
      setFound((before) => new Map([...before, ...tried.map((id) => [id, null] as const)]));
    }
    const ids = all.filter((id) => !requested.current.has(id));
    (async () => {
      for (let start = 0; start < ids.length && !cancelled; start += maxMetadataFills) {
        const batch = ids.slice(start, start + maxMetadataFills);
        for (const id of batch) requested.current.add(id);
        const loaded = await api.fetchMediaItems(batch);
        setFound((before) => {
          const after = new Map(before);
          for (const id of batch) after.set(id, loaded.get(id)?.metadata ?? null);
          return after;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missing]);

  return {
    filled(mediaItem) {
      const metadata = found.get(mediaItem.id);
      return metadata && !mediaItem.metadata ? { ...mediaItem, metadata } : mediaItem;
    },
    loading(mediaItem) {
      return isMissing(mediaItem) && !found.has(mediaItem.id);
    },
  };
}

function isMissing(mediaItem: MediaItem): boolean {
  return mediaItem.externalReference !== null && mediaItem.metadata === null;
}
