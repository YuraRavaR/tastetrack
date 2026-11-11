import { ChevronRight } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import type { LibraryItem, MediaType } from "../../shared/api";
import * as api from "../api";
import { authorName } from "../catalog/book-label";
import { canProgress, type ProgressMediaType, savedMediaTypes } from "../catalog/media-types";
import { ComingSoonTile, MediaTypeTile, type TileState } from "../components/MediaTypeTile";
import { Poster } from "../components/Poster";
import { mediaWord, progressWord } from "../i18n/media-words";
import { formatCalendarDayAndMonth, t } from "../i18n/t";
import { libraryTile } from "../library/library-tabs";
import { usePageTitle } from "../navigation/page-title";
import { itemPath } from "../navigation/paths";

// The built Media Types Saved offers, in its order.
const builtMediaTypes = savedMediaTypes.flatMap((choice) =>
  choice.status === "built" ? [choice.mediaType] : [],
);

// Saved at "/": one tile per Media Type Saved offers, in the order every section keeps. A built one
// opens its tabs; one still to come is a disabled stub. The heading names the list of tiles. Under
// them, for each Media Type that has In Progress, what the User has In Progress, if anything
// (`docs/mockups/books/`). Being the home page, its title is the app's name alone.
export function SavedPage() {
  const headingId = useId();
  usePageTitle([]);
  const tiles = useTiles();
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <h1 id={headingId} className="font-bold text-3xl tracking-tight md:text-4xl">
        {t("saved.title")}
      </h1>
      <ul aria-labelledby={headingId} className="grid gap-3.5 md:grid-cols-2 md:gap-5">
        {savedMediaTypes.map((choice) =>
          choice.status === "built" ? (
            <li key={choice.mediaType} className="grid">
              <MediaTypeTile mediaType={choice.mediaType} state={tiles[choice.mediaType]} />
            </li>
          ) : (
            <li key={choice.name} className="grid">
              <ComingSoonTile name={t(choice.name)} icon={choice.icon} />
            </li>
          ),
        )}
      </ul>
      {builtMediaTypes.filter(canProgress).map((mediaType) => {
        const tile = tiles[mediaType];
        return (
          tile.status === "loaded" &&
          tile.tile.inProgress.length > 0 && (
            <InProgressNow key={mediaType} mediaType={mediaType} items={tile.tile.inProgress} />
          )
        );
      })}
    </div>
  );
}

const loading: TileState = { status: "loading" };

// Each built Media Type's tile, read from the same Library its page reads, one request each.
function useTiles(): Record<MediaType, TileState> {
  const [tiles, setTiles] = useState<Record<MediaType, TileState>>({
    film: loading,
    book: loading,
  });

  useEffect(() => {
    let cancelled = false;
    const settle = (mediaType: MediaType, state: TileState) => {
      if (!cancelled) setTiles((current) => ({ ...current, [mediaType]: state }));
    };
    for (const mediaType of builtMediaTypes) {
      api.fetchLibrary(mediaType).then(
        (items) => settle(mediaType, { status: "loaded", tile: libraryTile(items) }),
        () => settle(mediaType, { status: "failed" }),
      );
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return tiles;
}

// "Reading now": one row per Media Item In Progress, the latest started first, each opening its
// page. Two columns from `md`.
function InProgressNow({
  mediaType,
  items,
}: {
  mediaType: ProgressMediaType;
  items: readonly LibraryItem[];
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 md:gap-3.5">
      <h2 id={headingId} className="font-semibold text-xl tracking-tight">
        {progressWord(mediaType, "inProgressNow")}
      </h2>
      <ul className="grid gap-2.5 md:grid-cols-2 md:gap-3">
        {items.map((item) => (
          <InProgressRow key={item.mediaItem.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

// What a row says under its title: the first author and since when, "Susanna Clarke · since Oct
// 12", leaving out whichever is unknown.
function rowMeta({ mediaItem, inProgress }: LibraryItem): string | null {
  const firstAuthor = mediaItem.mediaType === "book" ? mediaItem.metadata?.authors[0] : undefined;
  const author = firstAuthor ? authorName(firstAuthor) : null;
  const date = inProgress?.startDate ? formatCalendarDayAndMonth(inProgress.startDate) : null;
  if (author && date) return t("inProgress.authorAndSince", { author, date });
  if (date) return t("inProgress.since", { date });
  return author;
}

function InProgressRow({ item }: { item: LibraryItem }) {
  const { mediaItem } = item;
  const meta = rowMeta(item);
  return (
    <li className="grid">
      <Link
        to={itemPath(mediaItem.id)}
        className="flex items-center gap-3.5 rounded-xl border bg-card p-2.5 pr-4 hover:border-muted-foreground"
      >
        <Poster subject={mediaItem} size="thumbnail" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold">
            {mediaItem.metadata?.title ?? mediaWord(mediaItem.mediaType, "unknown")}
          </span>
          {meta && <span className="truncate text-muted-foreground text-sm">{meta}</span>}
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
