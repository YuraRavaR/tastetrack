import { useLayoutEffect } from "react";
import { useLocation, useSearchParams } from "react-router";

// The home search's query, kept in the URL as `?q=`, so going Back, reloading or sharing the link
// brings the results back. A change replaces the history entry, so typing doesn't fill the history,
// and an empty query leaves the URL without `q`.
export function useSearchQuery(): [string, (query: string) => void] {
  const [params, setParams] = useSearchParams();
  const setQuery = (query: string) => setParams(query ? { q: query } : {}, { replace: true });
  return [params.get("q") ?? "", setQuery];
}

// Keeps the place in the results for going Back from a film's page. The search runs again on the
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
