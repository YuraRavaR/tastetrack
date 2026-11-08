import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { MediaItem } from "../../shared/api";
import { t } from "../i18n/t";
import { Poster } from "./Poster";

// One Media Item in a grid of posters: the poster, with optional marks in its corners, the title
// in two lines at most, and a meta line, such as the year or the Current Rating. All of it opens
// the Media Item's page, unless it is `unlinked`, as on a Share Link's page. `children`, such as
// a Note, go under it, outside the link.
export function PosterGridItem({
  mediaItem,
  loading = false,
  meta,
  mark,
  place,
  unlinked = false,
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
  // True where the Media Item's page isn't for the viewer, as on a Share Link's page.
  unlinked?: boolean;
  // What goes under the title and meta line, outside the link, such as a Note.
  children?: ReactNode;
}) {
  const title = mediaItem.metadata?.title ?? t(loading ? "film.loading" : "film.unknown");
  const body = (
    <>
      <span className="relative block">
        <Poster subject={mediaItem} size="grid" />
        {place !== undefined && (
          <span
            aria-hidden
            className="absolute top-2 left-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-foreground/75 px-1.5 font-bold text-background text-xs md:top-2.5 md:left-2.5 md:h-6.5 md:min-w-6.5"
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
    <li className="flex min-w-0 flex-col gap-2">
      {unlinked ? (
        <div className={bodyClass}>{body}</div>
      ) : (
        <Link to={`/items/${mediaItem.id}`} className={bodyClass}>
          {body}
        </Link>
      )}
      {children}
    </li>
  );
}
