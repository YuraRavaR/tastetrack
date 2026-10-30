import { Bookmark, Check, ListPlus, X } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { RemovedListItem } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import {
  type Found,
  foundKey,
  foundLabel,
  foundManual,
  foundMediaItemId,
  foundMediaType,
  mediaItemOf,
} from "../catalog/found";
import { useCatalogSearch } from "../catalog/use-catalog-search";
import { useResultsScroll, useSearchQuery } from "../catalog/use-search-query";
import { mediaWord, pageMediaType } from "../i18n/media-words";
import { t } from "../i18n/t";
import { FilmListsDialog, type ListsFilm } from "./FilmListsDialog";
import { LogEntryDialog } from "./LogEntryDialog";
import { ManualMediaItemDialog } from "./ManualMediaItemDialog";
import { Poster } from "./Poster";
import { SearchField } from "./SearchField";
import { UndoLine } from "./UndoLine";

// What the toast says after each of the User's actions on a result, but logging, which says more.
const actionMessages = {
  putBack: "backlog.putBack",
  planned: "backlog.planned",
  unplanned: "backlog.takenOff",
  added: "manualItem.added",
} as const;

// The User's last action on a result, which the toast reports.
type LastAction =
  | {
      kind: "logged";
      found: Found;
      mediaItemId: number;
      removedFromBacklog: RemovedListItem | null;
    }
  | { kind: keyof typeof actionMessages; found: Found };

// What the toast fills in: the film, and the Backlog of its Media Type.
function actionValues(found: Found) {
  return { film: foundLabel(found), backlogName: mediaWord(foundMediaType(found), "backlog") };
}

type PlanError = "backlog_full" | "unavailable";

// Search as you type, with no button: results follow a short pause in typing, the User's own
// Manual Media Items first, and the query lives in the URL. A result with a Media Item links to its
// film's page. Any result can be marked Watched, which records a Log Entry for it, as
// a Revisit by default if it is in the Log, and takes it off the Watchlist with an undo. Want to
// watch is a toggle, which puts a result on the Watchlist or takes it off again, and any result can
// be added to or taken off the User's Lists. Below the results, a film search doesn't find can be
// added by hand, and then shows first. With `labelAsHeading` the field's label is the page's
// heading.
export function FilmSearch({ labelAsHeading = false }: { labelAsHeading?: boolean }) {
  const searchLabel = mediaWord(pageMediaType, "search");
  const backlogName = mediaWord(pageMediaType, "backlog");
  const inputId = useId();
  const [query, setQuery] = useSearchQuery();
  const search = useCatalogSearch(query);
  const rememberScroll = useResultsScroll(search.status === "done");
  const [logging, setLogging] = useState<Found | null>(null);
  const [listing, setListing] = useState<ListsFilm | null>(null);
  const [addingManually, setAddingManually] = useState(false);
  // Films added by hand since the search ran, by the query they were added from.
  const [added, setAdded] = useState<{ query: string; found: Found[] }>({ query: "", found: [] });
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [planError, setPlanError] = useState<PlanError | null>(null);
  // Results logged since the search ran, which the search's own marks don't know about yet.
  const [loggedNow, setLoggedNow] = useState<ReadonlySet<string>>(new Set());
  // Results put on or taken off the Watchlist since the search ran, by whether they are on it.
  const [plannedNow, setPlannedNow] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [planning, setPlanning] = useState<ReadonlySet<string>>(new Set());
  // Results that joined the catalog since the search ran, by their Media Item's id.
  const [catalogedNow, setCatalogedNow] = useState<ReadonlyMap<string, number>>(new Map());

  const inLog = (found: Found) => found.inLog || loggedNow.has(foundKey(found));
  const inBacklog = (found: Found) => plannedNow.get(foundKey(found)) ?? found.inBacklog;
  const mediaItemIdOf = (found: Found) => {
    return catalogedNow.get(foundKey(found)) ?? foundMediaItemId(found);
  };

  const trimmed = query.trim();
  const searched = new Set(search.results.map(foundKey));
  const results = [
    ...(added.query === trimmed
      ? added.found.filter((found) => !searched.has(foundKey(found)))
      : []),
    ...search.results,
  ];

  function markCataloged(found: Found, mediaItemId: number) {
    setCatalogedNow((current) => new Map(current).set(foundKey(found), mediaItemId));
  }

  // Adds a result to the catalog, as mediaItemOf does, so that it links to its page from now on.
  async function addToCatalog(found: Found) {
    const mediaItem = await mediaItemOf(found);
    if (mediaItem) markCataloged(found, mediaItem.id);
    return mediaItem;
  }

  function markPlanned(found: Found, planned: boolean) {
    setPlannedNow((current) => new Map(current).set(foundKey(found), planned));
  }

  function setPlanningOf(found: Found, busy: boolean) {
    setPlanning((current) => {
      const next = new Set(current);
      if (busy) next.add(foundKey(found));
      else next.delete(foundKey(found));
      return next;
    });
  }

  async function togglePlanned(found: Found) {
    const adding = !inBacklog(found);
    setPlanError(null);
    setPlanningOf(found, true);
    const mediaItem = await addToCatalog(found);
    const outcome = !mediaItem
      ? ({ ok: false, error: "unavailable" } as const)
      : adding
        ? await api.plan({ mediaItemId: mediaItem.id })
        : await api.removeFromBacklog(mediaItem.id);
    setPlanningOf(found, false);
    if (!outcome.ok) {
      setPlanError(outcome.error);
      return;
    }
    markPlanned(found, adding);
    setLastAction({ kind: adding ? "planned" : "unplanned", found });
  }

  function logged(found: Found, saved: api.SavedLogEntry) {
    setLogging(null);
    setPlanError(null);
    setLastAction({
      kind: "logged",
      found,
      mediaItemId: saved.logEntry.mediaItem.id,
      removedFromBacklog: saved.removedFromBacklog,
    });
    setLoggedNow((current) => new Set(current).add(foundKey(found)));
    markCataloged(found, saved.logEntry.mediaItem.id);
    if (saved.removedFromBacklog) markPlanned(found, false);
  }

  // Puts a logged film back on the Watchlist where it was, with its Note.
  async function undo(found: Found, mediaItemId: number, removed: RemovedListItem) {
    setPlanError(null);
    const outcome = await api.plan({ mediaItemId, ...removed });
    if (!outcome.ok) {
      setPlanError(outcome.error);
      return;
    }
    markPlanned(found, true);
    setLastAction({ kind: "putBack", found });
  }

  function addedManually(found: Found) {
    setAddingManually(false);
    setPlanError(null);
    setAdded((current) => ({
      query: trimmed,
      found: [found, ...(current.query === trimmed ? current.found : [])],
    }));
    setLastAction({ kind: "added", found });
  }

  const takenOff = lastAction?.kind === "logged" ? lastAction.removedFromBacklog : null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {labelAsHeading ? (
          <h1 className="font-semibold text-2xl tracking-tight">
            <Label htmlFor={inputId} className="font-semibold text-2xl leading-8">
              {searchLabel}
            </Label>
          </h1>
        ) : (
          <Label htmlFor={inputId}>{searchLabel}</Label>
        )}
        <SearchField id={inputId} value={query} onChange={setQuery} />
      </div>
      <p aria-live="polite" className="text-muted-foreground text-sm empty:hidden">
        {search.status === "searching" && t("search.searching")}
        {search.status === "done" && search.results.length === 0 && t("search.none")}
      </p>
      {/* A toast floats above the tab bar, so it shows from any result and never moves the list. */}
      <div
        role="status"
        className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-lg border bg-popover py-1 pr-1 pl-4 text-popover-foreground text-sm shadow-lg empty:hidden md:inset-x-auto md:bottom-6 md:left-1/2 md:w-max md:max-w-xl md:-translate-x-1/2"
      >
        {lastAction && (
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {lastAction.kind === "logged" ? (
                <>
                  <p>
                    {t("logEntry.saved", { film: foundLabel(lastAction.found) })}{" "}
                    <Link
                      to="/log"
                      className="text-primary-strong underline-offset-4 hover:underline"
                    >
                      {t("log.view")}
                    </Link>
                  </p>
                  {takenOff && (
                    <UndoLine
                      message={t("backlog.takenOff", actionValues(lastAction.found))}
                      onUndo={() => undo(lastAction.found, lastAction.mediaItemId, takenOff)}
                    />
                  )}
                </>
              ) : (
                <p>{t(actionMessages[lastAction.kind], actionValues(lastAction.found))}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:size-9"
              aria-label={t("search.dismiss")}
              title={t("search.dismiss")}
              onClick={() => setLastAction(null)}
            >
              <X aria-hidden />
            </Button>
          </>
        )}
      </div>
      {planError && (
        <p role="alert" className="text-destructive text-sm">
          {planError === "backlog_full"
            ? t("backlog.full", { backlogName, max: maxListItems })
            : t("backlog.updateFailed", { backlogName })}
        </p>
      )}
      {search.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("search.unavailable")}
        </p>
      )}
      {results.length > 0 && (
        <ul
          aria-label={t("search.resultsLabel")}
          className="flex flex-col divide-y rounded-lg border bg-card"
        >
          {results.map((found) => (
            <SearchResult
              key={foundKey(found)}
              found={found}
              mediaItemId={mediaItemIdOf(found)}
              onOpened={rememberScroll}
              inLog={inLog(found)}
              inBacklog={inBacklog(found)}
              planning={planning.has(foundKey(found))}
              onExperienced={() => setLogging(found)}
              onTogglePlanned={() => togglePlanned(found)}
              onListed={() =>
                setListing({ label: foundLabel(found), mediaItem: () => addToCatalog(found) })
              }
            />
          ))}
        </ul>
      )}
      {search.status === "done" && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-muted-foreground">{t("search.notFound")}</span>
          <Button variant="outline" size="sm" onClick={() => setAddingManually(true)}>
            {t("search.addManually")}
          </Button>
        </div>
      )}
      <LogEntryDialog
        found={logging}
        inLog={logging !== null && inLog(logging)}
        inBacklog={logging !== null && inBacklog(logging)}
        onClose={() => setLogging(null)}
        onLogged={logged}
      />
      <FilmListsDialog film={listing} onClose={() => setListing(null)} />
      <ManualMediaItemDialog
        open={addingManually}
        title={trimmed}
        onClose={() => setAddingManually(false)}
        onSaved={(mediaItem) => addedManually(foundManual(mediaItem))}
      />
    </section>
  );
}

function SearchResult({
  found,
  mediaItemId,
  onOpened,
  inLog,
  inBacklog,
  planning,
  onExperienced,
  onTogglePlanned,
  onListed,
}: {
  found: Found;
  mediaItemId: number | null;
  onOpened: () => void;
  inLog: boolean;
  inBacklog: boolean;
  planning: boolean;
  onExperienced: () => void;
  onTogglePlanned: () => void;
  onListed: () => void;
}) {
  // One mark: a film back on the Watchlist for a Revisit shows its pressed bookmark.
  const mark = inLog
    ? t("search.inLog")
    : inBacklog
      ? t("search.inBacklog", { backlogName: mediaWord(foundMediaType(found), "backlog") })
      : null;

  return (
    <li className="flex items-start gap-3 p-3 md:items-center">
      <Poster subject={found} size="search" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {mediaItemId !== null ? (
            <Link
              to={`/items/${mediaItemId}`}
              onClick={onOpened}
              className="break-words font-semibold underline-offset-4 hover:underline focus-visible:underline"
            >
              {foundLabel(found)}
            </Link>
          ) : (
            <span className="break-words font-semibold">{foundLabel(found)}</span>
          )}
          <span className="flex flex-wrap items-center gap-x-2 text-xs empty:hidden">
            {found.kind === "manual" && (
              <span className="font-medium text-muted-foreground">{t("search.addedByYou")}</span>
            )}
            {mark && <span className="font-semibold text-primary-strong">{mark}</span>}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* The source order is the desktop's, where the Tab key is used; a phone leads with Watched. */}
          <Button
            variant={inBacklog ? "pressed" : "outline"}
            size="icon"
            className="size-11 md:size-9"
            disabled={planning}
            aria-pressed={inBacklog}
            aria-label={t("search.planned")}
            title={t("search.planned")}
            onClick={onTogglePlanned}
          >
            <Bookmark aria-hidden className={cn(inBacklog && "fill-current")} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 md:size-9"
            aria-label={t("filmLists.open")}
            title={t("filmLists.open")}
            onClick={onListed}
          >
            <ListPlus aria-hidden />
          </Button>
          <Button
            className="order-first h-11 font-semibold md:order-none md:h-9"
            onClick={onExperienced}
          >
            <Check aria-hidden />
            {mediaWord(foundMediaType(found), "experienced")}
          </Button>
        </div>
      </div>
    </li>
  );
}
