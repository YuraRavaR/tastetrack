import { Bookmark, BookOpen, Check, ListPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ItemHistoryResponse, RemovedListItem } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { can, canProgress } from "../catalog/media-types";
import { mediaWord, progressWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { userTimeZone, userToday } from "../log/user-day";
import { FilmListsDialog, type ListsFilm } from "./FilmListsDialog";
import { InProgressCard } from "./InProgressCard";
import { MediaItemLogEntryDialog } from "./LogEntryDialog";
import { type FilmAction, FilmActionMessage, Toast } from "./Toast";

type PlanError = "backlog_full" | "unavailable";

// What failed of the User's last action, which the page says under its buttons.
type ActionError = PlanError | "startFailed" | "stopFailed";

// What the User can do with a Media Item from its page: mark it Experienced, or again once it has
// Log Entries, mark it Planned or take it off the Backlog, and put it on Lists. A Media Type that
// has In Progress can be started too; while it is, a card says since when, and finishing it or
// stopping it take the place of marking it Experienced, Planned or started. `onChanged` reloads the
// page for a new Log Entry or a change to In Progress, and `onPlanned` tells it whether the Media
// Item is on the Backlog now.
export function FilmActions({
  history,
  onChanged,
  onPlanned,
}: {
  history: ItemHistoryResponse;
  onChanged: () => Promise<void>;
  onPlanned: (inBacklog: boolean) => void;
}) {
  const { mediaItem, logEntries, inBacklog, inProgress } = history;
  const { mediaType } = mediaItem;
  const backlogName = mediaWord(mediaType, "backlog");
  const film = mediaItem.metadata ? filmLabel(mediaItem.metadata) : mediaWord(mediaType, "unknown");
  const experienced = logEntries.length > 0;
  const loggable = can(mediaType, "log");
  const progressable = canProgress(mediaType);
  const started = progressable && inProgress !== null;
  const [logging, setLogging] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [listing, setListing] = useState<ListsFilm | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setActionError] = useState<ActionError | null>(null);
  const [lastAction, setLastAction] = useState<FilmAction | null>(null);

  async function togglePlanned() {
    const adding = !inBacklog;
    setActionError(null);
    setPlanning(true);
    const outcome = adding
      ? await api.plan({ mediaItemId: mediaItem.id })
      : await api.removeFromBacklog(mediaItem.id);
    setPlanning(false);
    if (!outcome.ok) {
      setActionError(outcome.error);
      return;
    }
    onPlanned(adding);
    setLastAction({ kind: adding ? "planned" : "unplanned" });
  }

  // Starts the Media Item today, taking it off the Backlog, which the toast offers to undo.
  async function start() {
    setActionError(null);
    setPlanning(true);
    const outcome = await api.startInProgress({
      mediaItemId: mediaItem.id,
      startDate: userToday(),
      timeZone: userTimeZone(),
    });
    if (!outcome.ok) {
      setPlanning(false);
      setActionError("startFailed");
      return;
    }
    await onChanged();
    setPlanning(false);
    setLastAction({ kind: "started", removedFromBacklog: outcome.removedFromBacklog });
  }

  async function stop() {
    setActionError(null);
    setStopping(true);
    const stopped = await api.stopInProgress(mediaItem.id);
    if (stopped) await onChanged();
    setStopping(false);
    if (!stopped) {
      setActionError("stopFailed");
      return;
    }
    setLastAction({ kind: "stopped" });
  }

  // The toggle and the toast's undo wait for the reload, whose answer would overwrite them.
  async function logged(saved: api.SavedLogEntry) {
    setLogging(false);
    setFinishing(false);
    setActionError(null);
    setPlanning(true);
    await onChanged();
    setPlanning(false);
    setLastAction({
      kind: "logged",
      mediaItemId: mediaItem.id,
      removedFromBacklog: saved.removedFromBacklog,
    });
  }

  // Puts a logged film back on the Backlog where it was, with its Note.
  async function undo(mediaItemId: number, removed: RemovedListItem) {
    setActionError(null);
    const outcome = await api.plan({ mediaItemId, ...removed });
    if (!outcome.ok) {
      setActionError(outcome.error);
      return;
    }
    onPlanned(true);
    setLastAction({ kind: "putBack" });
  }

  // Takes back a start: stops reading, and puts the Media Item back on the Backlog where it was,
  // with its Note, if starting took it off.
  async function undoStart(removed: RemovedListItem | null) {
    setActionError(null);
    setStopping(true);
    const stopped = await api.stopInProgress(mediaItem.id);
    const putBack =
      stopped && removed ? await api.plan({ mediaItemId: mediaItem.id, ...removed }) : null;
    if (stopped) await onChanged();
    setStopping(false);
    if (!stopped) {
      setActionError("stopFailed");
      return;
    }
    if (putBack && !putBack.ok) {
      setActionError(putBack.error);
      return;
    }
    setLastAction({ kind: putBack ? "putBack" : "stopped" });
  }

  return (
    <div className="flex flex-col gap-3">
      {started && (
        <InProgressCard
          mediaType={mediaType}
          mediaItemId={mediaItem.id}
          inProgress={inProgress}
          stopping={stopping}
          onFinish={() => setFinishing(true)}
          onStop={stop}
          onChanged={onChanged}
        />
      )}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {loggable && !started && (
          <Button
            className="h-12 font-semibold text-base sm:h-10 sm:text-sm"
            onClick={() => setLogging(true)}
          >
            <Check aria-hidden />
            {mediaWord(mediaType, experienced ? "experiencedAgain" : "experienced")}
          </Button>
        )}
        {!started && (
          <Button
            variant={inBacklog ? "pressed" : "outline"}
            className={cn(
              "h-12 gap-1.5 px-1.5 sm:h-10 sm:gap-2 sm:px-4",
              inBacklog && "font-semibold",
              !loggable && "col-span-2",
            )}
            disabled={planning}
            aria-pressed={inBacklog}
            onClick={togglePlanned}
          >
            <Bookmark aria-hidden className={cn(inBacklog && "fill-current")} />
            {inBacklog ? t("search.inBacklog", { backlogName }) : mediaWord(mediaType, "planned")}
          </Button>
        )}
        {progressable && !started && (
          <Button
            variant="outline"
            className="h-11 gap-1.5 px-1.5 sm:h-10 sm:gap-2 sm:px-4"
            disabled={planning}
            onClick={start}
          >
            <BookOpen aria-hidden />
            {progressWord(mediaType, experienced ? "startAgain" : "start")}
          </Button>
        )}
        {can(mediaType, "collect") && (
          <Button
            variant="outline"
            className={cn(
              "h-11 sm:h-10",
              !progressable && "col-span-2",
              started && "justify-self-start px-4",
            )}
            onClick={() => setListing({ label: film, mediaType, mediaItem: async () => mediaItem })}
          >
            <ListPlus aria-hidden />
            {t("filmLists.open")}
          </Button>
        )}
      </div>
      {planError && (
        <p role="alert" className="text-destructive text-sm">
          {actionErrorMessage(planError)}
        </p>
      )}
      <MediaItemLogEntryDialog
        mediaItem={mediaItem}
        open={logging || finishing}
        inLog={experienced}
        inBacklog={inBacklog}
        finishing={finishing}
        onClose={() => {
          setLogging(false);
          setFinishing(false);
        }}
        onLogged={logged}
      />
      <FilmListsDialog film={listing} onClose={() => setListing(null)} />
      <Toast onDismiss={() => setLastAction(null)}>
        {lastAction && (
          <FilmActionMessage
            action={lastAction}
            film={film}
            mediaType={mediaType}
            onUndo={undo}
            onUndoStart={undoStart}
          />
        )}
      </Toast>
    </div>
  );

  function actionErrorMessage(error: ActionError): string {
    if (error === "backlog_full") return mediaWord(mediaType, "backlogFull", { max: maxListItems });
    if ((error === "startFailed" || error === "stopFailed") && progressable) {
      return progressWord(mediaType, error);
    }
    return t("backlog.updateFailed", { backlogName });
  }
}
