import { ChevronRight, ListPlus } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import type { MediaItem, MediaItemList } from "../../shared/api";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { listPath } from "../navigation/paths";
import { FilmListsDialog, type ListsFilm } from "./FilmListsDialog";
import { Poster } from "./Poster";

type HoldingState =
  | { status: "loading" }
  | { status: "loaded"; lists: MediaItemList[] }
  | { status: "failed" };

// What a Media Item that lives only in Collections, a song, has on its page in place of the
// Library's actions (`docs/mockups/songs/`): Add to collection, which opens the picker, and "In
// your Collections", a row for each Collection holding it, with its first cover, its name and how
// many it holds, opening the Collection, or a dashed box while none does. On a phone the button
// is the full width; from `sm` it is as wide as its label, and all of it is centred. The rows are
// read again as the picker closes.
export function MediaItemCollections({ mediaItem }: { mediaItem: MediaItem }) {
  const headingId = useId();
  const { mediaType } = mediaItem;
  const label = mediaItem.metadata
    ? filmLabel(mediaItem.metadata)
    : mediaWord(mediaType, "unknown");
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
    <div className="flex flex-col gap-5 sm:items-center">
      <Button
        className="h-12 w-full font-semibold text-base sm:h-10 sm:w-auto sm:px-4 sm:text-sm"
        onClick={() => setListing({ label, mediaType, mediaItem: async () => mediaItem })}
      >
        <ListPlus aria-hidden />
        {t("filmLists.open")}
      </Button>
      <section aria-labelledby={headingId} className="flex w-full flex-col gap-2.5 sm:max-w-140">
        <h2
          id={headingId}
          className="font-semibold text-lg tracking-tight sm:text-center sm:text-xl"
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
