import { useSearchParams } from "react-router";

// The home search's query, kept in the URL as `?q=`, so going Back, reloading or sharing the link
// brings the results back. A change replaces the history entry, so typing doesn't fill the history,
// and an empty query leaves the URL without `q`.
export function useSearchQuery(): [string, (query: string) => void] {
  const [params, setParams] = useSearchParams();
  const setQuery = (query: string) => setParams(query ? { q: query } : {}, { replace: true });
  return [params.get("q") ?? "", setQuery];
}
