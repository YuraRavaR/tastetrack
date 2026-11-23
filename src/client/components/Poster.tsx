import { Music } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaItem } from "../../shared/api";
import {
  type CoverImageSize,
  type CoverShape,
  coverOf,
  coverShape,
  missingCover,
  placeholderFor,
  typesetCoverOf,
} from "../catalog/cover";
import type { Found } from "../catalog/found";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { useImageFailure } from "./use-image-failure";

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
  // An album's cover (`docs/mockups/albums/`): 72 px in a phone's Search row and 56 px from `md`,
  // 136 px on a page without a picture and 176 px from `sm`.
  "1:1": {
    dialog: "size-12 rounded-sm md:size-13",
    thumbnail: "size-14 rounded-sm",
    search: "size-18 rounded-sm md:size-14",
    large: "size-34 rounded-md border shadow-lg sm:size-44 sm:rounded-lg",
    grid: "aspect-square w-full rounded-lg",
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
// frame sits, how many lines its title may take, and its maker's size and lines. The smallest
// have room for the title alone.
interface Typeset {
  box: string;
  frame: string;
  title: string;
  maker: string;
}

const titleOnly: Typeset = {
  box: "px-1.25 py-1.5 text-[8px]",
  frame: "hidden",
  title: "line-clamp-6",
  maker: "hidden",
};
const compact: Typeset = {
  box: "px-2.25 pt-3 pb-2.25 text-[11px]",
  frame: "inset-1.25",
  title: "line-clamp-4",
  maker: "line-clamp-1 text-[9px]",
};
const roomy: Typeset = {
  box: "px-3 pt-4 pb-3.25 text-sm",
  frame: "inset-1.5",
  title: "line-clamp-5",
  maker: "line-clamp-2 text-[11px]",
};

const posterTypesets: Record<PosterSize, Typeset> = {
  dialog: titleOnly,
  thumbnail: titleOnly,
  search: {
    box: `${compact.box} md:px-1.25 md:py-1.5 md:text-[8px]`,
    frame: `${compact.frame} md:hidden`,
    title: `${compact.title} md:line-clamp-6`,
    maker: `${compact.maker} md:hidden`,
  },
  large: {
    box: `${roomy.box} sm:px-4.5 sm:pt-6 sm:pb-5 sm:text-[22px]`,
    frame: `${roomy.frame} sm:inset-2`,
    title: roomy.title,
    maker: `${roomy.maker} sm:text-[13px]`,
  },
  grid: roomy,
  // Saved's fan is 52 px wide on a phone, room for the title alone (`docs/mockups/games/`).
  fan: {
    box: `${titleOnly.box} md:px-2.25 md:pt-3 md:pb-2.25 md:text-[11px]`,
    frame: `${titleOnly.frame} md:block md:inset-1.25`,
    title: `${titleOnly.title} md:line-clamp-4`,
    maker: `${titleOnly.maker} md:line-clamp-1 md:text-[9px]`,
  },
  collage: compact,
};

// A square is shorter than a poster of its width, so an album's cover set in type takes smaller
// type: 9/8 px at 72 px, 13/10 px in a grid, 16/12 px on its page, and the title alone at 56 px
// (`docs/mockups/albums/`).
const squareTypesets: Record<PosterSize, Typeset> = {
  dialog: titleOnly,
  thumbnail: titleOnly,
  search: {
    box: `px-1.5 pt-2 pb-1.5 text-[9px] md:px-1.25 md:py-1.5 md:text-[8px]`,
    frame: "inset-1 md:hidden",
    title: "line-clamp-3 md:line-clamp-4",
    maker: "line-clamp-1 text-[8px] md:hidden",
  },
  large: {
    box: "px-3 pt-4 pb-3 text-base",
    frame: "inset-1.5 sm:inset-2",
    title: "line-clamp-4",
    maker: "line-clamp-2 text-xs",
  },
  grid: {
    box: "px-2.5 pt-3 pb-2.5 text-[13px]",
    frame: "inset-1.5",
    title: "line-clamp-3",
    maker: "line-clamp-1 text-[10px]",
  },
  fan: {
    box: "px-1.5 pt-2 pb-1.5 text-[9px] md:px-2.25 md:pt-3 md:pb-2.25 md:text-[11px]",
    frame: "inset-1 md:inset-1.25",
    title: "line-clamp-3 md:line-clamp-4",
    maker: "line-clamp-1 text-[8px] md:text-[9px]",
  },
  collage: compact,
};

// A song's note at each size (`docs/mockups/songs/`): 22 px in 48 and 56 px, 26 px in 72 px and a
// collage, 40 px in a grid, 48 px at 136 px and 56 px at 176 px.
const noteSizes: Record<PosterSize, string> = {
  dialog: "size-5.5",
  thumbnail: "size-5.5",
  search: "size-6.5 md:size-5.5",
  large: "size-12 sm:size-14",
  grid: "size-10",
  fan: "size-6.5",
  collage: "size-6.5",
};

const typesets: Record<CoverShape, Record<PosterSize, Typeset>> = {
  "2:3": posterTypesets,
  "1:1": squareTypesets,
};

// A Media Item's cover, a film's poster or a book's cover, or a placeholder when it has none. A
// film's is an icon: only the grid and large sizes have room for its caption too, the large one
// (the film page's) only from `sm`, and `showCaption={false}` leaves it out, as under controls
// laid over the poster. A book's, a game's or an album's is a cover set in type: its title at the
// top and its first author, its developer or its artist credit at the foot, inside a thin frame.
// A song's is a quiet note on muted, with no caption. An album's or a song's image that doesn't
// load counts as none, since its cover is linked whether or not the Cover Art Archive has one
// (ADR-0013).
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
  const shape = coverShape(cover.mediaType);
  const sizeClass = sizeClasses[shape][size];
  const [url, failed] = useImageFailure(cover.url);
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={shape === "1:1" ? failed : undefined}
        className={cn("shrink-0 bg-muted object-cover", sizeClass)}
      />
    );
  }

  const missing = missingCover(cover.mediaType);
  if (missing === "note") {
    return (
      <div
        role="img"
        aria-label={mediaWord(cover.mediaType, "noCover")}
        className={cn(
          "flex shrink-0 items-center justify-center bg-muted text-muted-foreground",
          size !== "collage" && "border border-border",
          sizeClass,
          size === "large" && "shadow-none",
        )}
      >
        <Music aria-hidden className={noteSizes[size]} />
      </div>
    );
  }

  if (missing === "typeset") {
    const { title, maker } = typesetCoverOf(subject);
    const typeset = typesets[shape][size];
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
        {maker && (
          <span className={cn("mt-auto text-muted-foreground", typeset.maker)}>{maker}</span>
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
