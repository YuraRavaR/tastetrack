import { Bookmark, CircleCheck, PencilLine } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RemovedListItem } from "../../shared/api";
import { maxSearchQueryLength } from "../../shared/catalog";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import {
  type Found,
  foundKey,
  foundLabel,
  foundManual,
  foundPosterUrl,
  mediaItemOf,
} from "../catalog/found";
import { useCatalogSearch } from "../catalog/use-catalog-search";
import { t } from "../i18n/t";
import { LogEntryDialog } from "./LogEntryDialog";
import { ManualMediaItemDialog } from "./ManualMediaItemDialog";
import { Poster } from "./Poster";
import { UndoLine } from "./UndoLine";

// What the status line says after the User's last action on a result.
type LastAction =
  | {
      kind: "logged";
      found: Found;
      mediaItemId: number;
      removedFromBacklog: RemovedListItem | null;
    }
  | { kind: "putBack"; found: Found }
  | { kind: "added"; found: Found };

type PlanError = "backlog_full" | "unavailable";

// Search as you type, with no button: results follow a short pause in typing, the User's own
// Manual Media Items first. Any result can be marked Watched, which records a Log Entry for it, as
// a Revisit by default if it is in the Log, and takes it off the Watchlist with an undo. A result
// not on the Watchlist can be marked Want to watch, which puts it there. Below the results, a film
// search doesn't find can be added by hand, and then shows first.
export function FilmSearch() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const search = useCatalogSearch(query);
  const [logging, setLogging] = useState<Found | null>(null);
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

  const inLog = (found: Found) => found.inLog || loggedNow.has(foundKey(found));
  const inBacklog = (found: Found) => plannedNow.get(foundKey(found)) ?? found.inBacklog;

  const trimmed = query.trim();
  const searched = new Set(search.results.map(foundKey));
  const results = [
    ...(added.query === trimmed
      ? added.found.filter((found) => !searched.has(foundKey(found)))
      : []),
    ...search.results,
  ];

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

  async function planned(found: Found) {
    setPlanError(null);
    setPlanningOf(found, true);
    const mediaItem = await mediaItemOf(found);
    const outcome = mediaItem
      ? await api.plan({ mediaItemId: mediaItem.id })
      : ({ ok: false, error: "unavailable" } as const);
    setPlanningOf(found, false);
    if (!outcome.ok) {
      setPlanError(outcome.error);
      return;
    }
    markPlanned(found, true);
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
        <Label htmlFor={inputId}>{t("search.label")}</Label>
        <Input
          id={inputId}
          type="search"
          autoComplete="off"
          maxLength={maxSearchQueryLength}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p aria-live="polite" className="text-muted-foreground text-sm empty:hidden">
        {search.status === "searching" && t("search.searching")}
        {search.status === "done" && search.results.length === 0 && t("search.none")}
      </p>
      <div role="status" className="flex flex-col gap-1 text-sm empty:hidden">
        {lastAction?.kind === "logged" && (
          <>
            <p>
              {t("logEntry.saved", { film: foundLabel(lastAction.found) })}{" "}
              <Link to="/log" className="text-primary underline-offset-4 hover:underline">
                {t("log.view")}
              </Link>
            </p>
            {takenOff && (
              <UndoLine
                message={t("backlog.takenOff", { film: foundLabel(lastAction.found) })}
                onUndo={() => undo(lastAction.found, lastAction.mediaItemId, takenOff)}
              />
            )}
          </>
        )}
        {lastAction?.kind === "putBack" && (
          <p>{t("backlog.putBack", { film: foundLabel(lastAction.found) })}</p>
        )}
        {lastAction?.kind === "added" && (
          <p>{t("manualItem.added", { film: foundLabel(lastAction.found) })}</p>
        )}
      </div>
      {planError && (
        <p role="alert" className="text-destructive text-sm">
          {planError === "backlog_full"
            ? t("backlog.full", { max: maxListItems })
            : t("backlog.updateFailed")}
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
          className="flex flex-col divide-y rounded-lg border"
        >
          {results.map((found) => (
            <SearchResult
              key={foundKey(found)}
              found={found}
              inLog={inLog(found)}
              inBacklog={inBacklog(found)}
              planning={planning.has(foundKey(found))}
              onExperienced={() => setLogging(found)}
              onPlanned={() => planned(found)}
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
        onClose={() => setLogging(null)}
        onLogged={logged}
      />
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
  inLog,
  inBacklog,
  planning,
  onExperienced,
  onPlanned,
}: {
  found: Found;
  inLog: boolean;
  inBacklog: boolean;
  planning: boolean;
  onExperienced: () => void;
  onPlanned: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Poster url={foundPosterUrl(found)} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="break-words">{foundLabel(found)}</span>
          {found.kind === "manual" && (
            <span className="flex items-center gap-1 text-muted-foreground text-sm">
              <PencilLine aria-hidden className="size-4" />
              {t("search.addedByYou")}
            </span>
          )}
          {inLog && (
            <span className="flex items-center gap-1 text-muted-foreground text-sm">
              <CircleCheck aria-hidden className="size-4 text-primary" />
              {t("search.inLog")}
            </span>
          )}
          {inBacklog && (
            <span className="flex items-center gap-1 text-muted-foreground text-sm">
              <Bookmark aria-hidden className="size-4 text-primary" />
              {t("search.inBacklog")}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 self-end sm:self-auto">
        {!inBacklog && (
          <Button variant="outline" size="sm" disabled={planning} onClick={onPlanned}>
            {t("search.planned")}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onExperienced}>
          {t("search.watched")}
        </Button>
      </div>
    </li>
  );
}
