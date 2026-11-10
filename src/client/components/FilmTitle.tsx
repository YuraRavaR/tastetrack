import { cn } from "@/lib/utils";
import type { MediaItem } from "../../shared/api";
import { authorNames } from "../catalog/book-label";
import { filmFacts, filmLabel } from "../catalog/film-label";
import { mediaWord } from "../i18n/media-words";

// A Media Item's label, "Amélie (Le Fabuleux Destin d'Amélie Poulain, 2001)", with its Ukrainian
// title as a secondary line when it has a different one. Without metadata it is a placeholder
// while the page is `loading` it, and says the details are unavailable after.
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
      <span className="break-words">{filmLabel(metadata)}</span>
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
// genres, "122 min · Comedy, Romance", a book's authors, "Сергій Жадан, Reilly Costigan-Humes +1".
// Nothing while its metadata is missing or holds none of it.
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
  }
}
