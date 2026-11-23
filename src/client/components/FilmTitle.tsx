import { cn } from "@/lib/utils";
import type { MediaItem } from "../../shared/api";
import { albumFacts } from "../catalog/album-label";
import { authorNames } from "../catalog/book-label";
import { filmFacts, filmLabel, filmName } from "../catalog/film-label";
import { gameFacts } from "../catalog/game-label";
import { seriesFacts } from "../catalog/series-label";
import { mediaWord } from "../i18n/media-words";

// A Media Item's label, "Amélie (Le Fabuleux Destin d'Amélie Poulain, 2001)", with its Ukrainian
// title as a secondary line when it has a different one. A game's or an album's has no year,
// which leads its facts line. Without metadata it is a placeholder while the page is `loading` it,
// and says the details are unavailable after.
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
        {mediaType === "game" || mediaType === "album" ? filmName(metadata) : filmLabel(metadata)}
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
// type, "2016 · Jamala · EP". Nothing while its metadata is missing or holds none of it.
export function FilmFacts({ mediaItem }: { mediaItem: MediaItem }) {
  const facts = factsOf(mediaItem);
  return facts ? <p className="text-[13px] text-muted-foreground sm:text-[15px]">{facts}</p> : null;
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
      // The songs UI (#283) writes a song's facts.
      return null;
  }
}
