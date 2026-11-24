import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MediaItem } from "../../shared/api";
import { albumFacts } from "../catalog/album-label";
import { artistFacts } from "../catalog/artist-label";
import { authorNames } from "../catalog/book-label";
import { filmFacts, filmLabel, filmName } from "../catalog/film-label";
import { gameFacts } from "../catalog/game-label";
import { seriesFacts } from "../catalog/series-label";
import { disambiguationOf, songFacts } from "../catalog/song-label";
import { mediaWord } from "../i18n/media-words";
import { ArtistCredit } from "./ArtistCredit";

// A Media Item's label, "Amélie (Le Fabuleux Destin d'Amélie Poulain, 2001)", with its Ukrainian
// title as a secondary line when it has a different one. A game's, an album's or a song's has no
// year, which leads its facts line, and an artist's is their name alone. Without metadata it is a
// placeholder while the page is `loading` it, and says the details are unavailable after.
export function FilmTitle({
  mediaItem,
  loading = false,
}: {
  mediaItem: MediaItem;
  loading?: boolean;
}) {
  const { metadata, mediaType } = mediaItem;
  if (!metadata) {
    return (
      <span className={cn("text-muted-foreground", loading && "animate-pulse")}>
        {mediaWord(mediaType, loading ? "loading" : "unknown")}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-col">
      <span className="break-words">
        {mediaType === "game" ||
        mediaType === "album" ||
        mediaType === "song" ||
        mediaType === "artist"
          ? filmName(metadata)
          : filmLabel(metadata)}
      </span>
      {metadata.ukrainianTitle && (
        <span
          lang="uk"
          className="mt-0.5 break-words font-semibold text-muted-foreground text-sm tracking-normal sm:text-[15px]"
        >
          {metadata.ukrainianTitle}
        </span>
      )}
    </span>
  );
}

// What a Media Item's page says under its title, as far as it is known: a film's runtime and
// genres, "122 min · Comedy, Romance", a book's authors, "Сергій Жадан, Reilly Costigan-Humes +1",
// a series' years, seasons and status, "2008–2013 · 5 seasons · Ended", a game's year, developer
// and platforms, "2015 · CD Projekt RED · PC, PS4, PS5 +4", an album's year, artist credit and
// type, "2016 · Jamala · EP", a song's year, artist credit and album, "2013 · Океан Ельзи · from
// Земля", and an artist's type, country and years, "Group · Ukraine · 1994–", with a song's or an
// artist's disambiguation in italics under them. Nothing while its metadata is missing or
// holds none of it.
export function FilmFacts({ mediaItem }: { mediaItem: MediaItem }) {
  const facts = factsOf(mediaItem);
  const disambiguation = disambiguationOf(mediaItem);
  return (
    <>
      {facts && (
        <p className="text-[13px] text-muted-foreground sm:text-[15px]">
          {withCreditLinks(facts, mediaItem)}
        </p>
      )}
      {disambiguation && (
        <p className="text-[13px] text-muted-foreground italic">{disambiguation}</p>
      )}
    </>
  );
}

// The facts line with an album's or a song's artist credit as links to the artists' pages, where
// its artists have MBIDs; the line as it is otherwise (`docs/mockups/artists/`, Links a).
function withCreditLinks(facts: string, mediaItem: MediaItem): ReactNode {
  if (mediaItem.mediaType !== "album" && mediaItem.mediaType !== "song") return facts;
  const { artistCredit, creditedArtists } = mediaItem.metadata ?? {};
  if (!artistCredit || !creditedArtists?.length) return facts;
  const at = facts.indexOf(artistCredit);
  if (at === -1) return facts;
  return (
    <>
      {facts.slice(0, at)}
      <ArtistCredit artistCredit={artistCredit} creditedArtists={creditedArtists} />
      {facts.slice(at + artistCredit.length)}
    </>
  );
}

function factsOf(mediaItem: MediaItem): string | null {
  if (!mediaItem.metadata) return null;
  switch (mediaItem.mediaType) {
    case "film":
      return filmFacts(mediaItem.metadata);
    case "book":
      return authorNames(mediaItem.metadata.authors);
    case "series":
      return seriesFacts(mediaItem.metadata);
    case "game":
      return gameFacts(mediaItem.metadata);
    case "album":
      return albumFacts(mediaItem.metadata);
    case "song":
      return songFacts(mediaItem.metadata);
    case "artist":
      return artistFacts(mediaItem.metadata);
  }
}
