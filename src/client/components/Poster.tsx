import { cn } from "@/lib/utils";
import type { MediaItem } from "../../shared/api";
import {
  type CoverImageSize,
  type CoverShape,
  coverOf,
  coverShape,
  placeholderFor,
  typesetCoverOf,
} from "../catalog/cover";
import type { Found } from "../catalog/found";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";

type PosterSize = "dialog" | "thumbnail" | "search" | "large" | "grid" | "fan" | "collage";

// Fixed heights, not an aspect ratio: a row's flex stretch would pull an auto height out of shape.
// A grid's poster is the exception: it fills its column's width, which a grid cell keeps fixed, and
// so is a fan's on Saved's tile, which fills the slot the fan sizes, and a collage's on a List's
// card, which fills its square cell and so loses a little of its top and bottom.
const sizeClasses: Record<CoverShape, Record<PosterSize, string>> = {
  "2:3": {
    dialog: "h-13.5 w-9 rounded-sm md:h-15 md:w-10",
    thumbnail: "h-18 w-12 rounded-sm",
    search: "h-27 w-18 rounded-sm md:h-18 md:w-12",
    large: "h-39 w-26 rounded-md border shadow-lg sm:h-66 sm:w-44 sm:rounded-lg",
    grid: "aspect-2/3 w-full rounded-lg",
    fan: "size-full rounded-md",
    collage: "size-full",
  },
};

// The small sizes, in dialogs and search results, take the small image. The rest, the film page's
// banner among them, are drawn some 80 to 220 CSS pixels wide, which would blur the small one.
const imageSizes: Record<PosterSize, CoverImageSize> = {
  dialog: "small",
  thumbnail: "small",
  search: "small",
  large: "large",
  grid: "large",
  fan: "large",
  collage: "large",
};

// What a cover set in type takes at each size: its padding and its title's size, how far in its
// frame sits, how many lines its title may take, and its author's size and lines. The smallest
// have room for the title alone.
interface Typeset {
  box: string;
  frame: string;
  title: string;
  author: string;
}

const titleOnly: Typeset = {
  box: "px-1.25 py-1.5 text-[8px]",
  frame: "hidden",
  title: "line-clamp-6",
  author: "hidden",
};
const compact: Typeset = {
  box: "px-2.25 pt-3 pb-2.25 text-[11px]",
  frame: "inset-1.25",
  title: "line-clamp-4",
  author: "line-clamp-1 text-[9px]",
};
const roomy: Typeset = {
  box: "px-3 pt-4 pb-3.25 text-sm",
  frame: "inset-1.5",
  title: "line-clamp-5",
  author: "line-clamp-2 text-[11px]",
};

const typesets: Record<PosterSize, Typeset> = {
  dialog: titleOnly,
  thumbnail: titleOnly,
  search: {
    box: `${compact.box} md:px-1.25 md:py-1.5 md:text-[8px]`,
    frame: `${compact.frame} md:hidden`,
    title: `${compact.title} md:line-clamp-6`,
    author: `${compact.author} md:hidden`,
  },
  large: {
    box: `${roomy.box} sm:px-4.5 sm:pt-6 sm:pb-5 sm:text-[22px]`,
    frame: `${roomy.frame} sm:inset-2`,
    title: roomy.title,
    author: `${roomy.author} sm:text-[13px]`,
  },
  grid: roomy,
  fan: compact,
  collage: compact,
};

// A Media Item's cover, a film's poster or a book's cover, or a placeholder when it has none. A
// film's is an icon: only the grid and large sizes have room for its caption too, the large one
// (the film page's) only from `sm`, and `showCaption={false}` leaves it out, as under controls
// laid over the poster. A book's is a cover set in type: its title at the top and its first author
// at the foot, inside a thin frame.
export function Poster({
  subject,
  size,
  showCaption = true,
}: {
  subject: MediaItem | Found;
  size: PosterSize;
  showCaption?: boolean;
}) {
  const cover = coverOf(subject, imageSizes[size]);
  const sizeClass = sizeClasses[coverShape(cover.mediaType)][size];
  if (cover.url) {
    return (
      <img
        src={cover.url}
        alt=""
        loading="lazy"
        className={cn("shrink-0 bg-muted object-cover", sizeClass)}
      />
    );
  }

  if (cover.mediaType === "book") {
    const { title, author } = typesetCoverOf(subject);
    const typeset = typesets[size];
    return (
      <div
        role="img"
        aria-label={mediaWord(cover.mediaType, "noCover")}
        className={cn(
          "relative flex shrink-0 flex-col overflow-hidden border border-border bg-primary-soft text-left leading-[1.1]",
          sizeClass,
          typeset.box,
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute rounded-sm border border-primary-strong/45",
            typeset.frame,
          )}
        />
        <b className={cn("[overflow-wrap:anywhere]", typeset.title)}>{title}</b>
        {author && (
          <span className={cn("mt-auto text-muted-foreground", typeset.author)}>{author}</span>
        )}
      </div>
    );
  }

  const placeholder = placeholderFor(cover.mediaItemId);
  const Icon = placeholder.icon;
  const large = size === "large";
  const withCaption = large || size === "grid";
  return (
    <div
      role="img"
      aria-label={mediaWord(cover.mediaType, "noCover")}
      className={cn(
        "flex shrink-0 flex-col items-center justify-center gap-2 bg-muted text-center text-muted-foreground",
        sizeClass,
        large && "shadow-none",
        withCaption && "p-2.5",
      )}
    >
      <Icon
        aria-hidden
        className={cn(withCaption ? "size-14" : "size-5", large && "size-8.5 sm:size-14")}
      />
      {withCaption && showCaption && (
        <p className={cn("text-xs", large && "hidden sm:block")}>{t(placeholder.caption)}</p>
      )}
    </div>
  );
}
