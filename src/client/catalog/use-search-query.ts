import { useLayoutEffect } from "react";
import { useLocation, useSearchParams } from "react-router";
import type { MediaType } from "../../shared/api";
import { searchMediaTypes } from "./media-types";

// Search's query, kept in the URL as `?q=`, so going Back, reloading or sharing the link brings
// the results back. A change replaces the history entry, so typing doesn't fill the history, and
// an empty query leaves the URL without `q`. The Media Type stays as it is.
export function useSearchQuery(): [string, (query: string) => void] {
  const [params, setParams] = useSearchParams();
  const setQuery = (query: string) => setParams(withParam(params, "q", query), { replace: true });
  return [params.get("q") ?? "", setQuery];
}

// The Media Type Search is on, kept in the URL as `?type=`, so reloading, going Back or sharing
// the link keeps it. Without one, or with one Search doesn't have, it is on films, and choosing
// films leaves the URL without `type`. A change replaces the history entry, as typing does, and
// keeps the query.
export function useSearchMediaType(): [MediaType, (mediaType: MediaType) => void] {
  const [params, setParams] = useSearchParams();
  const asked = params.get("type");
  const offered = searchMediaTypes.flatMap((choice) =>
    choice.status === "built" ? [choice.mediaType] : [],
  );
  const mediaType = offered.find((each) => each === asked) ?? defaultMediaType;
  const setMediaType = (chosen: MediaType) => {
    setParams(withParam(params, "type", chosen === defaultMediaType ? "" : chosen), {
      replace: true,
    });
  };
  return [mediaType, setMediaType];
}

const defaultMediaType: MediaType = "film";

// The URL's parameters with one set, or left out when its value is empty.
function withParam(params: URLSearchParams, name: string, value: string): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(name, value);
  else next.delete(name);
  return next;
}

// Keeps the place in the results for going Back from a Media Item's page. The search runs again on the
// way back, so the page is short until `resultsReady`, and only then can it scroll there. The
// returned function records the place in the history entry; a new query replaces the entry and
// forgets it. Call it as the User leaves.
export function useResultsScroll(resultsReady: boolean): () => void {
  const [params, setParams] = useSearchParams();
  const scrollY: unknown = useLocation().state?.scrollY;

  useLayoutEffect(() => {
    if (resultsReady && typeof scrollY === "number") window.scrollTo(0, scrollY);
  }, [resultsReady, scrollY]);

  return () => setParams(params, { replace: true, state: { scrollY: window.scrollY } });
}
