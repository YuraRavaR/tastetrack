import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { MediaItem } from "../../shared/api";
import { t } from "../i18n/t";
import { Poster } from "./Poster";

// One Media Item in a grid of posters: the poster, with an optional mark in its corner, the title
// in two lines at most, and a meta line, such as the year or the Current Rating. All of it opens
// the Media Item's page.
export function PosterGridItem({
  mediaItem,
  loading = false,
  meta,
  mark,
}: {
  mediaItem: MediaItem;
  // True while the page waits for metadata the Media Item came without.
  loading?: boolean;
  meta?: ReactNode;
  // A label for the corner mark, such as "Watched before"; no mark without one.
  mark?: string;
}) {
  const title = mediaItem.metadata?.title ?? t(loading ? "film.loading" : "film.unknown");
  return (
    <li>
      <Link to={`/items/${mediaItem.id}`} className="flex flex-col gap-1.5 rounded-lg">
        <span className="relative block">
          <Poster subject={mediaItem} size="grid" />
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
      </Link>
    </li>
  );
}
