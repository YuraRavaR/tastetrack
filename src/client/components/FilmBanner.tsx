import type { MediaItem } from "../../shared/api";
import { Poster } from "./Poster";

// The wide banner that opens a film's page: its backdrop, or else its poster or the placeholder,
// centred. The height is fixed, so the page doesn't move when the image arrives.
export function FilmBanner({ mediaItem }: { mediaItem: MediaItem }) {
  const backdrop = mediaItem.metadata?.backdropUrls;
  return (
    <div className="flex h-46 items-center justify-center overflow-hidden rounded-lg bg-muted sm:h-65">
      {backdrop ? (
        <picture className="size-full">
          {/* The sm: breakpoint, where the banner grows. */}
          <source media="(min-width: 40rem)" srcSet={backdrop.large} />
          <img src={backdrop.small} alt="" className="size-full object-cover" />
        </picture>
      ) : (
        <Poster subject={mediaItem} size="large" />
      )}
    </div>
  );
}
