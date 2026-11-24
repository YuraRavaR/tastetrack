import { useId } from "react";
import type { ArtistAbout } from "../../shared/api";
import type { Found } from "../catalog/found";
import { factsLine } from "../catalog/game-label";
import {
  albumResult,
  useOpenThroughCatalog,
  withNoMarks,
} from "../catalog/use-open-through-catalog";
import { t } from "../i18n/t";
import { Poster } from "./Poster";

type ArtistAlbum = ArtistAbout["albums"][number];

// An album of the list as a search result not yet in the catalog, for its cover: the Cover Art
// Archive's, or the album's cover set in type where the archive has none.
function albumFound(album: ArtistAlbum, artistName: string): Found {
  return { kind: "catalog", ...withNoMarks(albumResult(album, artistName)) };
}

// "Albums and EPs" on an artist's page (`docs/mockups/artists/`): their albums list, oldest first
// as the Worker sends it (ADR-0013, Artists), as a grid of square covers, three columns on a phone
// and as many of at least 150 px as fit from md. Each has its title in two lines at most and its
// year, "· EP" after an EP's, and opens its album's page, adding it to the catalog first. With
// none, a dashed box says MusicBrainz has none yet.
export function ArtistAlbums({
  albums,
  artistName,
}: {
  albums: ArtistAbout["albums"];
  artistName: string;
}) {
  const headingId = useId();
  const { opening, failed, open } = useOpenThroughCatalog();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2.5">
      <h2 className="flex items-baseline gap-1.5 font-semibold text-lg tracking-tight sm:text-xl">
        <span id={headingId}>{t("artist.albums")}</span>
        <span className="font-medium text-muted-foreground text-sm">{albums.length}</span>
      </h2>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("search.openFailed", { film: failed })}
        </p>
      )}
      {albums.length > 0 ? (
        <ul
          aria-labelledby={headingId}
          className="grid grid-cols-3 gap-x-3 gap-y-4 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:gap-x-4 md:gap-y-5"
        >
          {albums.map((album) => (
            <li key={album.mbid} className="min-w-0">
              <button
                type="button"
                disabled={opening !== null}
                onClick={() => open(albumResult(album, artistName), album.title)}
                className="flex w-full cursor-pointer flex-col gap-0.75 text-left disabled:cursor-wait"
              >
                <span className="mb-1.25 block">
                  <Poster subject={albumFound(album, artistName)} size="grid" />
                </span>
                <span className="line-clamp-2 break-words font-semibold text-sm leading-tight">
                  {album.title}
                </span>
                <span className="text-[13px] text-muted-foreground empty:hidden">
                  {factsLine([
                    album.year === null ? null : String(album.year),
                    album.primaryType === "EP" ? t("artist.ep") : null,
                  ])}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-input border-dashed px-4 py-4.5 text-center text-muted-foreground text-sm">
          {t("artist.noAlbums")}
        </p>
      )}
    </section>
  );
}
