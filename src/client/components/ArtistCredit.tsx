import type { AlbumMetadata } from "../../shared/api";
import { creditParts } from "../catalog/artist-label";
import { artistResult, useOpenThroughCatalog } from "../catalog/use-open-through-catalog";
import { t } from "../i18n/t";

// An album's or a song's artist credit on its page, each credited artist with an MBID opening
// their artist's page, adding them to the catalog first, and the joining phrases (" & ",
// " feat. ") text (`docs/mockups/artists/`, Links a). A manual one's artists are all text.
export function ArtistCredit({
  artistCredit,
  creditedArtists,
}: Pick<AlbumMetadata, "artistCredit" | "creditedArtists">) {
  const { opening, failed, open } = useOpenThroughCatalog();
  return (
    <>
      {creditParts(artistCredit, creditedArtists).map(({ text, mbid }, index) =>
        mbid === null ? (
          // The parts never change order, so their place keys them.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <span key={index}>{text}</span>
        ) : (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: one artist may be credited twice
            key={index}
            type="button"
            disabled={opening !== null}
            onClick={() => open(artistResult(text, mbid), text)}
            className="cursor-pointer font-semibold text-foreground underline decoration-2 decoration-primary-strong underline-offset-3 hover:text-primary-strong disabled:cursor-wait"
          >
            {text}
          </button>
        ),
      )}
      {failed && (
        <span role="alert" className="block text-destructive">
          {t("search.openFailed", { film: failed })}
        </span>
      )}
    </>
  );
}
