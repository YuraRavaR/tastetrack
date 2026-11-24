import type { ReactNode } from "react";
import type { MediaItem } from "../../shared/api";
import { photoCredit } from "../catalog/artist-label";
import { FilmFacts, FilmTitle } from "./FilmTitle";
import { Poster } from "./Poster";
import { useImageFailure } from "./use-image-failure";

type ArtistMediaItem = Extract<MediaItem, { mediaType: "artist" }>;

// What opens an artist's page (`docs/mockups/artists/`, page B): their photo, whole, as Commons has
// it, over a blurred copy that fades into the page, with its credit under it, linked to its file
// on Commons. On a phone the copy runs edge to edge at 16:9, and the photo, at most 420 px tall, is
// pulled up over it, with the name, the facts, the disambiguation and the link to MusicBrainz
// centred under it. From `sm` the copy is 21:9 and the photo, at most 360 px wide and tall, sits at
// the left, with the facts beside it. Without a photo, or one that doesn't load, there is no copy:
// their initials at the left, with the name beside them.
export function ArtistBanner({
  mediaItem,
  sourceLink,
}: {
  mediaItem: ArtistMediaItem;
  sourceLink?: ReactNode;
}) {
  const metadata = mediaItem.metadata;
  const [photoUrl, photoFailed] = useImageFailure(metadata?.photoUrls?.large ?? null);
  const credit = metadata?.photoCredit ?? null;

  if (!photoUrl) {
    return (
      <div className="flex items-end gap-3.5 sm:mt-2 sm:gap-6">
        <Poster subject={mediaItem} size="large" />
        <div className="flex min-w-0 flex-col gap-1 pb-0.5 sm:pb-1.5">
          <h1 className="font-bold text-[22px] leading-[1.15] tracking-[-0.01em] [overflow-wrap:anywhere] sm:text-[34px] sm:leading-[1.12] sm:tracking-[-0.02em]">
            <FilmTitle mediaItem={mediaItem} />
          </h1>
          <FilmFacts mediaItem={mediaItem} />
          {sourceLink && <div className="-ml-2.5 self-start">{sourceLink}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="-mx-4 aspect-video overflow-hidden bg-muted backdrop-fade sm:mx-0 sm:aspect-[21/9]">
        <img
          src={photoUrl}
          alt=""
          className="size-full scale-130 object-cover blur-[30px] saturate-130"
        />
      </div>
      <div className="relative -mt-[44%] flex flex-col items-center gap-3 text-center sm:-mt-[26%] sm:flex-row sm:items-end sm:gap-7 sm:px-6 sm:text-left">
        <figure className="flex max-w-full flex-col items-center gap-1.5 sm:w-90 sm:flex-none sm:items-start">
          <img
            src={photoUrl}
            alt={metadata?.title ?? ""}
            onError={photoFailed}
            className="max-h-105 max-w-full rounded-[14px] bg-muted shadow-lg sm:max-h-90"
          />
          {credit && (
            <figcaption className="text-muted-foreground text-xs leading-[1.35]">
              <a
                href={credit.url}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {photoCredit(credit)}
              </a>
            </figcaption>
          )}
        </figure>
        <div className="flex min-w-0 flex-col items-center gap-1 sm:items-start sm:pb-7">
          <h1 className="font-bold text-[26px] leading-[1.15] tracking-[-0.01em] [overflow-wrap:anywhere] sm:text-[34px] sm:leading-[1.12] sm:tracking-[-0.02em]">
            <FilmTitle mediaItem={mediaItem} />
          </h1>
          <FilmFacts mediaItem={mediaItem} />
          {sourceLink && <div className="sm:-ml-2.5">{sourceLink}</div>}
        </div>
      </div>
    </div>
  );
}
