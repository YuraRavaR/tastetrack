import { Bookmark, Check, ListPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ItemHistoryResponse, RemovedListItem } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { FilmListsDialog, type ListsFilm } from "./FilmListsDialog";
import { MediaItemLogEntryDialog } from "./LogEntryDialog";
import { type FilmAction, FilmActionMessage, Toast } from "./Toast";

type PlanError = "backlog_full" | "unavailable";

// What the User can do with a film from its page: mark it Experienced, or again once it has Log
// Entries, mark it Planned or take it off the Backlog, and put it on Lists. `onLogged` reloads the
// page for a new Log Entry, and `onPlanned` tells it whether the film is on the Backlog now.
export function FilmActions({
  history,
  onLogged,
  onPlanned,
}: {
  history: ItemHistoryResponse;
  onLogged: () => Promise<void>;
  onPlanned: (inBacklog: boolean) => void;
}) {
  const { mediaItem, logEntries, inBacklog } = history;
  const { mediaType } = mediaItem;
  const backlogName = mediaWord(mediaType, "backlog");
  const film = mediaItem.metadata ? filmLabel(mediaItem.metadata) : t("film.unknown");
  const experienced = logEntries.length > 0;
  const [logging, setLogging] = useState(false);
  const [listing, setListing] = useState<ListsFilm | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<PlanError | null>(null);
  const [lastAction, setLastAction] = useState<FilmAction | null>(null);

  async function togglePlanned() {
    const adding = !inBacklog;
    setPlanError(null);
    setPlanning(true);
    const outcome = adding
      ? await api.plan({ mediaItemId: mediaItem.id })
      : await api.removeFromBacklog(mediaItem.id);
    setPlanning(false);
    if (!outcome.ok) {
      setPlanError(outcome.error);
      return;
    }
    onPlanned(adding);
    setLastAction({ kind: adding ? "planned" : "unplanned" });
  }

  // The toggle and the toast's undo wait for the reload, whose answer would overwrite them.
  async function logged(saved: api.SavedLogEntry) {
    setLogging(false);
    setPlanError(null);
    setPlanning(true);
    await onLogged();
    setPlanning(false);
    setLastAction({
      kind: "logged",
      mediaItemId: mediaItem.id,
      removedFromBacklog: saved.removedFromBacklog,
    });
  }

  // Puts a logged film back on the Backlog where it was, with its Note.
  async function undo(mediaItemId: number, removed: RemovedListItem) {
    setPlanError(null);
    const outcome = await api.plan({ mediaItemId, ...removed });
    if (!outcome.ok) {
      setPlanError(outcome.error);
      return;
    }
    onPlanned(true);
    setLastAction({ kind: "putBack" });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button
          className="h-12 font-semibold text-base sm:h-10 sm:text-sm"
          onClick={() => setLogging(true)}
        >
          <Check aria-hidden />
          {mediaWord(mediaType, experienced ? "experiencedAgain" : "experienced")}
        </Button>
        <Button
          variant={inBacklog ? "pressed" : "outline"}
          className={cn(
            "h-12 gap-1.5 px-1.5 sm:h-10 sm:gap-2 sm:px-4",
            inBacklog && "font-semibold",
          )}
          disabled={planning}
          aria-pressed={inBacklog}
          onClick={togglePlanned}
        >
          <Bookmark aria-hidden className={cn(inBacklog && "fill-current")} />
          {inBacklog ? t("search.inBacklog", { backlogName }) : mediaWord(mediaType, "planned")}
        </Button>
        <Button
          variant="outline"
          className="col-span-2 h-11 sm:h-10"
          onClick={() => setListing({ label: film, mediaItem: async () => mediaItem })}
        >
          <ListPlus aria-hidden />
          {t("filmLists.open")}
        </Button>
      </div>
      {planError && (
        <p role="alert" className="text-destructive text-sm">
          {planError === "backlog_full"
            ? t("backlog.full", { backlogName, max: maxListItems })
            : t("backlog.updateFailed", { backlogName })}
        </p>
      )}
      <MediaItemLogEntryDialog
        mediaItem={mediaItem}
        open={logging}
        inLog={experienced}
        inBacklog={inBacklog}
        onClose={() => setLogging(false)}
        onLogged={logged}
      />
      <FilmListsDialog film={listing} onClose={() => setListing(null)} />
      <Toast onDismiss={() => setLastAction(null)}>
        {lastAction && (
          <FilmActionMessage
            action={lastAction}
            film={film}
            backlogName={backlogName}
            onUndo={undo}
          />
        )}
      </Toast>
    </div>
  );
}
