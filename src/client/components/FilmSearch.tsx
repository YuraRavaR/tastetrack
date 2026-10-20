import { Bookmark, CircleCheck } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogSearchResult, RemovedListItem } from "../../shared/api";
import { maxSearchQueryLength } from "../../shared/catalog";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { useCatalogSearch } from "../catalog/use-catalog-search";
import { t } from "../i18n/t";
import { LogEntryDialog } from "./LogEntryDialog";
import { Poster } from "./Poster";
import { UndoLine } from "./UndoLine";

function keyOf({ externalReference: { source, id } }: CatalogSearchResult): string {
  return `${source}:${id}`;
}

// What the status line says after the User's last action on a result.
type Notice =
  | {
      kind: "logged";
      result: CatalogSearchResult;
      mediaItemId: number;
      removedFromBacklog: RemovedListItem | null;
    }
  | { kind: "putBack"; result: CatalogSearchResult };

type PlanError = "backlog_full" | "unavailable";

// Search as you type, with no button: results follow a short pause in typing. Any result can be
// marked Watched, which records a Log Entry for it, as a Revisit by default if it is in the Log,
// and takes it off the Watchlist with an undo. A result not on the Watchlist can be marked Want to
// watch, which puts it there.
export function FilmSearch() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const search = useCatalogSearch(query);
  const [logging, setLogging] = useState<CatalogSearchResult | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [planError, setPlanError] = useState<PlanError | null>(null);
  // Results logged since the search ran, which the search's own marks don't know about yet.
  const [loggedNow, setLoggedNow] = useState<ReadonlySet<string>>(new Set());
  // Results put on or taken off the Watchlist since the search ran, by whether they are on it.
  const [plannedNow, setPlannedNow] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [planning, setPlanning] = useState<ReadonlySet<string>>(new Set());

  const inLog = (result: CatalogSearchResult) => result.inLog || loggedNow.has(keyOf(result));
  const inBacklog = (result: CatalogSearchResult) =>
    plannedNow.get(keyOf(result)) ?? result.inBacklog;

  function markPlanned(result: CatalogSearchResult, planned: boolean) {
    setPlannedNow((current) => new Map(current).set(keyOf(result), planned));
  }

  function setPlanningOf(result: CatalogSearchResult, busy: boolean) {
    setPlanning((current) => {
      const next = new Set(current);
      if (busy) next.add(keyOf(result));
      else next.delete(keyOf(result));
      return next;
    });
  }

  async function planned(result: CatalogSearchResult) {
    setPlanError(null);
    setPlanningOf(result, true);
    const mediaItem = await api.addToCatalog(result);
    const outcome = mediaItem
      ? await api.plan({ mediaItemId: mediaItem.id })
      : ({ ok: false, error: "unavailable" } as const);
    setPlanningOf(result, false);
    if (!outcome.ok) {
      setPlanError(outcome.error);
      return;
    }
    markPlanned(result, true);
  }

  function logged(result: CatalogSearchResult, saved: api.SavedLogEntry) {
    setLogging(null);
    setPlanError(null);
    setNotice({
      kind: "logged",
      result,
      mediaItemId: saved.logEntry.mediaItem.id,
      removedFromBacklog: saved.removedFromBacklog,
    });
    setLoggedNow((current) => new Set(current).add(keyOf(result)));
    if (saved.removedFromBacklog) markPlanned(result, false);
  }

  // Puts a logged film back on the Watchlist where it was, with its Note.
  async function undo(result: CatalogSearchResult, mediaItemId: number, removed: RemovedListItem) {
    setPlanError(null);
    const outcome = await api.plan({ mediaItemId, ...removed });
    if (!outcome.ok) {
      setPlanError(outcome.error);
      return;
    }
    markPlanned(result, true);
    setNotice({ kind: "putBack", result });
  }

  const takenOff = notice?.kind === "logged" ? notice.removedFromBacklog : null;

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
        {notice?.kind === "logged" && (
          <>
            <p>
              {t("logEntry.saved", { film: filmLabel(notice.result) })}{" "}
              <Link to="/log" className="text-primary underline-offset-4 hover:underline">
                {t("log.view")}
              </Link>
            </p>
            {takenOff && (
              <UndoLine
                message={t("backlog.takenOff", { film: filmLabel(notice.result) })}
                onUndo={() => undo(notice.result, notice.mediaItemId, takenOff)}
              />
            )}
          </>
        )}
        {notice?.kind === "putBack" && (
          <p>{t("backlog.putBack", { film: filmLabel(notice.result) })}</p>
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
      {search.results.length > 0 && (
        <ul
          aria-label={t("search.resultsLabel")}
          className="flex flex-col divide-y rounded-lg border"
        >
          {search.results.map((result) => (
            <SearchResult
              key={keyOf(result)}
              result={result}
              inLog={inLog(result)}
              inBacklog={inBacklog(result)}
              planning={planning.has(keyOf(result))}
              onExperienced={() => setLogging(result)}
              onPlanned={() => planned(result)}
            />
          ))}
        </ul>
      )}
      <LogEntryDialog
        result={logging}
        inLog={logging !== null && inLog(logging)}
        onClose={() => setLogging(null)}
        onLogged={logged}
      />
    </section>
  );
}

function SearchResult({
  result,
  inLog,
  inBacklog,
  planning,
  onExperienced,
  onPlanned,
}: {
  result: CatalogSearchResult;
  inLog: boolean;
  inBacklog: boolean;
  planning: boolean;
  onExperienced: () => void;
  onPlanned: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Poster url={result.posterUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="break-words">{filmLabel(result)}</span>
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
