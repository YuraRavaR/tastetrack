import { useSearchParams } from "react-router";
import type { MediaType } from "../../shared/api";

// The Media Type a section is on, kept in the URL as `?type=`, so reloading, going Back or sharing
// the link keeps it. Without one, or with one the section doesn't offer, it is on films, and
// choosing films leaves the URL without `type`. A change replaces the history entry and keeps the
// URL's other parameters.
export function useMediaTypeParam(
  offered: readonly MediaType[],
): [MediaType, (mediaType: MediaType) => void] {
  const [params, setParams] = useSearchParams();
  const asked = params.get("type");
  const mediaType = offered.find((each) => each === asked) ?? defaultMediaType;
  const setMediaType = (chosen: MediaType) => {
    setParams(withParam(params, "type", chosen === defaultMediaType ? "" : chosen), {
      replace: true,
    });
  };
  return [mediaType, setMediaType];
}

export const defaultMediaType: MediaType = "film";

// The URL's parameters with one set, or left out when its value is empty.
export function withParam(params: URLSearchParams, name: string, value: string): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(name, value);
  else next.delete(name);
  return next;
}
