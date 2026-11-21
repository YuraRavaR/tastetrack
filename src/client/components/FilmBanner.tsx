import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MediaItem } from "../../shared/api";
import { coverOf, coverShape } from "../catalog/cover";
import { FilmFacts, FilmTitle } from "./FilmTitle";
import { Poster } from "./Poster";
import { useImageFailure } from "./use-image-failure";

// What opens a Media Item's page: a film's or a series' backdrop, or a game's art, whole, at 16:9,
// fading into the page, with the poster pulled up over its bottom edge and the title beside it. On
// a phone the picture runs edge to edge under the page's Back, out of the page's padding; from `sm`
// it fills the column. A film or a series with a poster and no backdrop, and every book with a
// cover, since a book has no backdrop, shows the cover in the picture's place, blurred: scaled past
// the picture's edges, so the blur's soft border is cropped away. Without either there is no
// picture, and the poster row starts at the top. The picture's box and the poster's size are fixed,
// so the page doesn't move when the images arrive.
//
// An album's square cover is as wide as a phone, so there it is the picture itself, sharp, its
// bottom fading into the page, with the title over the fade and no cover beside it; from `sm` it is
// blurred as a book's, with the square cover at the left (`docs/mockups/albums/`). A cover that
// doesn't load, as where the Cover Art Archive has none, counts as none.
export function FilmBanner({
  mediaItem,
  sourceLink,
}: {
  mediaItem: MediaItem;
  // A link to the Media Item's page at its source, under the facts, as a game's without an About
  // block or an album's has.
  sourceLink?: ReactNode;
}) {
  const square = coverShape(mediaItem.mediaType) === "1:1";
  const backdrop =
    mediaItem.mediaType === "book" || mediaItem.mediaType === "album"
      ? null
      : mediaItem.metadata?.backdropUrls;
  const [posterUrl, posterFailed] = useImageFailure(coverOf(mediaItem, "large").url);
  const pictureImage = backdrop ? (
    <>
      {/* The sm: breakpoint, where the picture leaves the phone's full bleed for the column. */}
      <source media="(min-width: 40rem)" srcSet={backdrop.large} />
      <img src={backdrop.small} alt="" className="size-full object-cover" />
    </>
  ) : posterUrl ? (
    <img
      src={posterUrl}
      alt=""
      onError={square ? posterFailed : undefined}
      className={cn(
        "size-full object-cover sm:scale-125 sm:blur-[36px] sm:saturate-130",
        !square && "scale-130 blur-xl saturate-130",
      )}
    />
  ) : null;
  // On a phone an album's picture is its cover, so the cover isn't shown again beside the title.
  const coverIsPicture = square && pictureImage !== null;
  return (
    <div className="flex flex-col">
      {pictureImage && (
        <picture
          className={cn(
            "-mx-4 overflow-hidden bg-muted sm:mx-0 sm:aspect-video",
            coverIsPicture ? "aspect-square cover-fade sm:backdrop-fade" : "aspect-video",
            !coverIsPicture && "backdrop-fade",
          )}
        >
          {pictureImage}
        </picture>
      )}
      <div
        className={cn(
          "relative flex items-end gap-3.5 sm:gap-7 sm:px-6",
          // Without a picture the row sits right under Back on a phone, and 40 px under the header
          // from sm. An album's title overlaps its cover's fade by 36 px.
          !pictureImage && "sm:mt-4",
          pictureImage && (coverIsPicture ? "-mt-9 sm:-mt-43" : "-mt-18 sm:-mt-43"),
        )}
      >
        {coverIsPicture ? (
          <div className="hidden shrink-0 sm:block">
            <Poster subject={mediaItem} size="large" />
          </div>
        ) : (
          <Poster subject={mediaItem} size="large" />
        )}
        <div className="flex min-w-0 flex-col gap-0.75 pb-0.5 sm:gap-1 sm:pb-1">
          <h1
            // The size comes before the leading: cn drops a leading that a later text size follows.
            className={cn(
              coverIsPicture ? "text-[26px]" : "text-[21px]",
              "font-bold leading-[1.15] tracking-[-0.01em] sm:text-[34px] sm:leading-[1.12] sm:tracking-[-0.02em]",
            )}
          >
            <FilmTitle mediaItem={mediaItem} />
          </h1>
          <FilmFacts mediaItem={mediaItem} />
          {sourceLink}
        </div>
      </div>
    </div>
  );
}
