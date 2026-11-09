import { cn } from "@/lib/utils";
import type { MediaItem } from "../../shared/api";
import { FilmFacts, FilmTitle } from "./FilmTitle";
import { Poster } from "./Poster";

// What opens a film's page: its backdrop whole, at 16:9, fading into the page, with the poster
// pulled up over its bottom edge and the title beside it. On a phone the picture runs edge to edge
// under the header, out of the page's padding; from `sm` it fills the column. A film with a poster
// and no backdrop shows the poster in the picture's place, blurred: scaled past the picture's
// edges, so the blur's soft border is cropped away. Without either there is no picture, and the
// poster row starts at the top. The picture's box and the poster's size are fixed, so the page
// doesn't move when the images arrive.
export function FilmBanner({ mediaItem }: { mediaItem: MediaItem }) {
  const backdrop = mediaItem.metadata?.backdropUrls;
  const posterUrl = mediaItem.metadata?.posterUrls?.large;
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
      className="size-full scale-130 object-cover blur-xl saturate-130 sm:scale-125 sm:blur-[36px]"
    />
  ) : null;
  return (
    <div className="flex flex-col">
      {pictureImage && (
        <picture className="-mx-4 -mt-6 aspect-video overflow-hidden bg-muted backdrop-fade sm:mx-0 sm:mt-0">
          {pictureImage}
        </picture>
      )}
      <div
        className={cn(
          "relative flex items-end gap-3.5 sm:gap-7 sm:px-6",
          // Without a picture the row sits 16 px under the header on a phone, 40 px from sm.
          pictureImage ? "-mt-18 sm:-mt-43" : "-mt-2 sm:mt-4",
        )}
      >
        <Poster subject={mediaItem} size="large" />
        <div className="flex min-w-0 flex-col gap-0.75 pb-0.5 sm:gap-1 sm:pb-1">
          <h1 className="font-bold text-[21px] leading-[1.15] tracking-[-0.01em] sm:text-[34px] sm:leading-[1.12] sm:tracking-[-0.02em]">
            <FilmTitle metadata={mediaItem.metadata} />
          </h1>
          <FilmFacts metadata={mediaItem.metadata} />
        </div>
      </div>
    </div>
  );
}
