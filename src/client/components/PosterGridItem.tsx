import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import type { MediaItem } from "../../shared/api";
import { authorNames, authorsAndYear } from "../catalog/book-label";
import { mediaWord } from "../i18n/media-words";
import { itemPath } from "../navigation/paths";
import { Poster } from "./Poster";

// What a grid says under a Media Item's title by default: a film its year, a book its authors, in
// one line. Nothing while its metadata is unknown.
export function yearOrAuthors({ mediaType, metadata }: MediaItem): ReactNode {
  if (!metadata) return undefined;
  if (mediaType === "film") return metadata.year ?? undefined;
  const authors = authorNames(metadata.authors);
  return authors && <span className="min-w-0 truncate">{authors}</span>;
}

// The same with a book's year after its authors, for a grid with room for both, such as a
// Share Link's: "Іван Багряний · 1946".
export function yearOrAuthorsAndYear(mediaItem: MediaItem): ReactNode {
  if (mediaItem.mediaType === "film" || !mediaItem.metadata) return yearOrAuthors(mediaItem);
  const line = authorsAndYear(mediaItem.metadata);
  return line && <span className="min-w-0 truncate">{line}</span>;
}

// One Media Item in a grid of posters: the poster, with optional marks in its corners, the title
// in two lines at most, and a meta line, such as the year or the Current Rating. All of it opens
// the Media Item's page, unless it is `unlinked`, as on a Share Link's page. `corner`, such as a
// ⋯ menu, sits over the poster's top right corner, and `children`, such as a Note, go under it,
// both outside the link. `overlay`, such as the arrows that reorder a List, lies over the whole
// poster in place of the link.
export function PosterGridItem({
  mediaItem,
  loading = false,
  meta,
  mark,
  place,
  unlinked = false,
  corner,
  overlay,
  className,
  onOpened,
  children,
}: {
  mediaItem: MediaItem;
  // True while the page waits for metadata the Media Item came without.
  loading?: boolean;
  meta?: ReactNode;
  // A label for the corner mark, such as "Watched before"; no mark without one.
  mark?: string;
  // Its place in an ordered grid, 1 for the first, shown in the top left corner. The list's own
  // order says it to screen readers.
  place?: number;
  // True where the Media Item's page isn't for the viewer, as for a visitor to a Share Link.
  unlinked?: boolean;
  // A control over the poster's top right corner, outside the link, such as a ⋯ menu. Not with
  // a `mark`, which takes the same corner.
  corner?: ReactNode;
  // Controls over the whole poster, such as arrows that move it. The Media Item is then no link,
  // since a control can't sit inside one, and a placeholder poster shows no caption under them.
  overlay?: ReactNode;
  // Classes for the item itself, such as a fixed width in a sideways strip.
  className?: string;
  // Called as the link opens the Media Item's page, such as to remember the place in the results.
  onOpened?: () => void;
  // What goes under the title and meta line, outside the link, such as a Note.
  children?: ReactNode;
}) {
  const title =
    mediaItem.metadata?.title ?? mediaWord(mediaItem.mediaType, loading ? "loading" : "unknown");
  const body = (
    <>
      <span className="relative block">
        <Poster subject={mediaItem} size="grid" showCaption={!overlay} />
        {place !== undefined && (
          <span
            aria-hidden
            className="absolute top-2 left-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-overlay px-1.5 font-bold text-overlay-foreground text-xs md:top-2.5 md:left-2.5 md:h-6.5 md:min-w-6.5"
          >
            {place}
          </span>
        )}
        {mark && (
          <span
            role="img"
            aria-label={mark}
            className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
          >
            <Check aria-hidden className="size-3.5" strokeWidth={2.75} />
          </span>
        )}
        {overlay}
      </span>
      <span className="line-clamp-2 font-semibold text-sm leading-tight">{title}</span>
      {meta && (
        <span className="-mt-0.5 flex items-center gap-1 text-muted-foreground text-xs md:text-sm">
          {meta}
        </span>
      )}
    </>
  );
  const bodyClass = "flex flex-col gap-1.5 rounded-lg";
  return (
    <li className={cn("relative flex min-w-0 flex-col gap-2", className)}>
      {unlinked || overlay ? (
        <div className={bodyClass}>{body}</div>
      ) : (
        <Link to={itemPath(mediaItem.id)} onClick={onOpened} className={bodyClass}>
          {body}
        </Link>
      )}
      {corner && <div className="absolute top-0 right-0">{corner}</div>}
      {children}
    </li>
  );
}
