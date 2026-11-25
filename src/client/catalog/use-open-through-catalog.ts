import { useState } from "react";
import { useNavigate } from "react-router";
import type { ArtistAbout, CatalogSearchResult } from "../../shared/api";
import * as api from "../api";
import { itemPath } from "../navigation/paths";

// A work the page names by its MBID but has no Media Item of: what adding it to the catalog sends,
// without the marks a search result has for the User. The Worker's details call replaces all but
// the External Reference, so the rest stands in only when that call fails.
type UnmarkedResult = Omit<
  CatalogSearchResult,
  | "mediaItemId"
  | "inLog"
  | "inBacklog"
  | "inFavourites"
  | "currentRating"
  | "logEntryCount"
  | "lists"
>;

// The work as a search result that is in neither the catalog nor any of the User's Lists.
export function withNoMarks(result: UnmarkedResult): CatalogSearchResult {
  return {
    ...result,
    mediaItemId: null,
    inLog: false,
    inBacklog: false,
    inFavourites: false,
    currentRating: null,
    logEntryCount: 0,
    lists: [],
  };
}

// A credited artist, by their name and their artist MBID (ADR-0013, Artists).
export function artistResult(name: string, mbid: string): UnmarkedResult {
  return {
    externalReference: { source: "musicbrainz", mediaType: "artist", id: mbid },
    title: name,
    originalTitle: name,
    year: null,
    posterUrl: null,
    titleLanguage: "en",
    authors: [],
  };
}

// One album of an artist's albums list, by its release-group MBID, credited to the artist.
export function albumResult(
  album: ArtistAbout["albums"][number],
  artistName: string,
): UnmarkedResult {
  return {
    externalReference: { source: "musicbrainz", mediaType: "album", id: album.mbid },
    title: album.title,
    originalTitle: album.title,
    year: album.year,
    posterUrl: album.coverUrls.small,
    titleLanguage: "en",
    authors: [],
    artistCredit: artistName,
    primaryType: album.primaryType,
  };
}

export interface OpenThroughCatalog {
  // The key of the work whose page is opening, null when none is.
  opening: string | null;
  // The label of the work whose page couldn't open, until the next try.
  failed: string | null;
  open(result: UnmarkedResult, label: string): Promise<void>;
}

// Opens the page of a work the page names by its MBID, as an artist credited on an album or an
// album in an artist's list: adds it to the catalog first, which finds it if it is there already,
// then opens its page. One at a time; a failure says which work couldn't open.
export function useOpenThroughCatalog(): OpenThroughCatalog {
  const navigate = useNavigate();
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function open(result: UnmarkedResult, label: string) {
    if (opening !== null) return;
    setFailed(null);
    setOpening(result.externalReference.id);
    const mediaItem = await api.addToCatalog(withNoMarks(result));
    setOpening(null);
    if (!mediaItem) {
      setFailed(label);
      return;
    }
    navigate(itemPath(mediaItem.id));
  }

  return { opening, failed, open };
}
