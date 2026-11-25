import { ChevronRight, Heart, ListPlus } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaItem, MediaItemFavourites, MediaItemList } from "../../shared/api";
import * as api from "../api";
import { filmLabel, filmName } from "../catalog/film-label";
import { can } from "../catalog/media-types";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { favouritesPath, listPath } from "../navigation/paths";
import { FilmListsDialog, type ListsFilm } from "./FilmListsDialog";
import { LikeButton, type LikeError, LikeErrorLine } from "./LikeButton";
import { Poster } from "./Poster";

type HoldingState =
  | { status: "loading" }
  | { status: "loaded"; lists: MediaItemList[]; favourites: MediaItemFavourites | null }
  | { status: "failed" };

// What a Media Item that lives only in Collections, a song or an artist, has on its page in place
// of the Library's actions (`docs/mockups/songs/`, `docs/mockups/artists/`): Add to collection,
// which opens the picker, and "In your Collections", a row for each Collection holding it, with
// its first cover, its name and how many it holds, opening the Collection, or a dashed box while
// none does. On a phone the button is the full width; from `sm` it is as wide as its label. A
// song's are centred, under its centred cover, and an artist's at the left, as their page is,
// where the button is an outline beside ♥, which Likes them or takes the Like back, each half the
// width on a phone. Their Favourite artists come first among the rows, with their place, "1st of
// 10". The rows are read again as the picker closes and after each Like.
export function MediaItemCollections({ mediaItem }: { mediaItem: MediaItem }) {
  const headingId = useId();
  const { mediaType } = mediaItem;
  const centred = mediaType === "song";
  // An artist is named without their year, which is when they began.
  const label = !mediaItem.metadata
    ? mediaWord(mediaType, "unknown")
    : mediaType === "artist"
      ? filmName(mediaItem.metadata)
      : filmLabel(mediaItem.metadata);
  const [state, setState] = useState<HoldingState>({ status: "loading" });
  const [listing, setListing] = useState<ListsFilm | null>(null);
  const likeable = can(mediaType, "like");
  const likeErrorId = useId();
  const [liking, setLiking] = useState(false);
  const [likeError, setLikeError] = useState<LikeError | null>(null);

  const load = useCallback(async () => {
    try {
      const held = await api.fetchMediaItemLists(mediaItem.id);
      setState(held ? { status: "loaded", ...held } : { status: "failed" });
    } catch {
      setState({ status: "failed" });
    }
  }, [mediaItem.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const holding = state.status === "loaded" ? state.lists.filter((list) => list.listItem) : [];
  const favourites = state.status === "loaded" ? state.favourites : null;
  const liked = favourites?.listItem != null;

  async function toggleLiked() {
    setLiking(true);
    setLikeError(null);
    const outcome = liked
      ? (await api.unlike(mediaItem.id))
        ? ({ ok: true } as const)
        : ({ ok: false, error: "unavailable" } as const)
      : await api.like(mediaItem.id);
    if (!outcome.ok) setLikeError(outcome.error);
    await load();
    setLiking(false);
  }

  const collectButton = (
    <Button
      variant={centred ? "default" : "outline"}
      className={cn(
        "h-12 w-full font-semibold text-base sm:h-10 sm:w-auto sm:px-4 sm:text-sm",
        !centred && "sm:self-start",
        likeable && "min-w-0 flex-1 px-2 sm:flex-none",
      )}
      onClick={() => setListing({ label, mediaType, mediaItem: async () => mediaItem })}
    >
      <ListPlus aria-hidden />
      {t("filmLists.open")}
    </Button>
  );

  return (
    <div className={cn("flex flex-col gap-5", centred && "sm:items-center")}>
      {likeable ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2.5">
            <LikeButton
              liked={liked}
              busy={liking || state.status !== "loaded"}
              errorId={likeError ? likeErrorId : undefined}
              className="h-12 min-w-0 flex-1 px-2 text-base sm:h-10 sm:flex-none sm:px-4 sm:text-sm"
              onClick={toggleLiked}
            />
            {collectButton}
          </div>
          {likeError && <LikeErrorLine id={likeErrorId} error={likeError} />}
        </div>
      ) : (
        collectButton
      )}
      <section aria-labelledby={headingId} className="flex w-full flex-col gap-2.5 sm:max-w-140">
        <h2
          id={headingId}
          className={cn(
            "font-semibold text-lg tracking-tight sm:text-xl",
            centred && "sm:text-center",
          )}
        >
          {t("song.inCollections")}
        </h2>
        {state.status === "failed" && (
          <p role="alert" className="text-destructive text-sm">
            {t("filmLists.unavailable")}
          </p>
        )}
        {state.status === "loaded" &&
          (holding.length > 0 || liked ? (
            <ul
              aria-labelledby={headingId}
              className="flex flex-col divide-y rounded-lg border bg-card"
            >
              {favourites?.listItem && (
                <li>
                  <Link
                    to={favouritesPath(mediaType)}
                    className="flex min-h-17 items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong md:size-13">
                      <Heart aria-hidden className="size-5 fill-current" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="break-words font-semibold text-[15px]">
                        {t("artist.favourites")}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {t("artist.favouritesPlace", {
                          place: favourites.listItem.position + 1,
                          count: favourites.itemCount,
                        })}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              )}
              {holding.map((list) => (
                <li key={list.id}>
                  <Link
                    to={listPath(list.id)}
                    className="flex min-h-17 items-center gap-3 px-3 py-2.5 text-left"
                  >
                    {list.firstMediaItem ? (
                      <Poster subject={list.firstMediaItem} size="dialog" />
                    ) : (
                      <span className="size-12 shrink-0" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="break-words font-semibold text-[15px]">{list.name}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {mediaWord(mediaType, "count", { count: list.itemCount })}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-input border-dashed px-4 py-4.5 text-center text-muted-foreground text-sm">
              {t(likeable ? "artist.notKept" : "song.notInCollections")}
            </p>
          ))}
      </section>
      <FilmListsDialog
        film={listing}
        onClose={() => {
          setListing(null);
          void load();
        }}
      />
    </div>
  );
}
