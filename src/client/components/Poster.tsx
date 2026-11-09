import { cn } from "@/lib/utils";
import type { MediaItem } from "../../shared/api";
import {
  type CoverImageSize,
  type CoverShape,
  coverOf,
  coverShape,
  placeholderFor,
} from "../catalog/cover";
import type { Found } from "../catalog/found";
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

// A film's poster, or a placeholder when it has none. Only the grid and large sizes have room for
// the placeholder's caption, the large one (the film page's) only from `sm`, and
// `showCaption={false}` leaves it out, as under controls laid over the poster. The rest show their
// icon.
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

  const placeholder = placeholderFor(cover.mediaItemId);
  const Icon = placeholder.icon;
  const large = size === "large";
  const withCaption = large || size === "grid";
  return (
    <div
      role="img"
      aria-label={t("poster.none")}
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
