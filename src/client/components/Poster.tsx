import { cn } from "@/lib/utils";
import type { MediaItem } from "../../shared/api";
import { type CoverShape, coverOf, coverShape, placeholderFor } from "../catalog/cover";
import type { Found } from "../catalog/found";
import { t } from "../i18n/t";

type PosterSize = "thumbnail" | "search" | "large";

// Fixed heights, not an aspect ratio: a row's flex stretch would pull an auto height out of shape.
const sizeClasses: Record<CoverShape, Record<PosterSize, string>> = {
  "2:3": {
    thumbnail: "h-18 w-12 rounded-sm",
    search: "h-21 w-14 rounded-sm md:h-18 md:w-12",
    large: "h-42 w-28 rounded-md",
  },
};

// A film's poster, or a placeholder when it has none. Only the large size has room for the
// placeholder's caption; the rest show its icon.
export function Poster({ subject, size }: { subject: MediaItem | Found; size: PosterSize }) {
  const cover = coverOf(subject);
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

  const { icon: Icon, caption } = placeholderFor(cover.mediaItemId);
  const large = size === "large";
  return (
    <div
      role="img"
      aria-label={t("poster.none")}
      className={cn(
        "flex shrink-0 flex-col items-center justify-center gap-2 bg-muted text-center text-muted-foreground",
        large && "p-2.5",
        sizeClass,
      )}
    >
      <Icon aria-hidden className={large ? "size-9.5" : "size-5"} />
      {large && <p className="text-xs">{t(caption)}</p>}
    </div>
  );
}
