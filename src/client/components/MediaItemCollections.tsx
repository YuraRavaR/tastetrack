import { ChevronRight, ListPlus } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaItem, MediaItemList } from "../../shared/api";
import * as api from "../api";
import { filmLabel, filmName } from "../catalog/film-label";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { listPath } from "../navigation/paths";
import { FilmListsDialog, type ListsFilm } from "./FilmListsDialog";
import { Poster } from "./Poster";

type HoldingState =
  | { status: "loading" }
  | { status: "loaded"; lists: MediaItemList[] }
  | { status: "failed" };

// What a Media Item that lives only in Collections, a song or an artist, has on its page in place
// of the Library's actions (`docs/mockups/songs/`, `docs/mockups/artists/`): Add to collection,
// which opens the picker, and "In your Collections", a row for each Collection holding it, with
// its first cover, its name and how many it holds, opening the Collection, or a dashed box while
// none does. On a phone the button is the full width; from `sm` it is as wide as its label. A
// song's are centred, under its centred cover, and an artist's at the left, as their page is,
// where the button is an outline beside the photo's facts. The rows are read again as the picker
// closes.
export function MediaItemCollections({
  mediaItem,
  centred,
}: {
  mediaItem: MediaItem;
  centred: boolean;
}) {
  const headingId = useId();
  const { mediaType } = mediaItem;
  // An artist is named without their year, which is when they began.
  const label = !mediaItem.metadata
    ? mediaWord(mediaType, "unknown")
    : mediaType === "artist"
      ? filmName(mediaItem.metadata)
      : filmLabel(mediaItem.metadata);
  const [state, setState] = useState<HoldingState>({ status: "loading" });
  const [listing, setListing] = useState<ListsFilm | null>(null);

  const load = useCallback(async () => {
    try {
      const lists = await api.fetchMediaItemLists(mediaItem.id);
      setState(lists ? { status: "loaded", lists } : { status: "failed" });
    } catch {
      setState({ status: "failed" });
    }
  }, [mediaItem.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const holding = state.status === "loaded" ? state.lists.filter((list) => list.listItem) : [];

  return (
    <div className={cn("flex flex-col gap-5", centred && "sm:items-center")}>
      <Button
        variant={centred ? "default" : "outline"}
        className={cn(
          "h-12 w-full font-semibold text-base sm:h-10 sm:w-auto sm:px-4 sm:text-sm",
          !centred && "sm:self-start",
        )}
        onClick={() => setListing({ label, mediaType, mediaItem: async () => mediaItem })}
      >
        <ListPlus aria-hidden />
        {t("filmLists.open")}
      </Button>
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
          (holding.length > 0 ? (
            <ul
              aria-labelledby={headingId}
              className="flex flex-col divide-y rounded-lg border bg-card"
            >
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
              {t("song.notInCollections")}
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
