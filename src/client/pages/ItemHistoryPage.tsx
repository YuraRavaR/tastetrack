import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Button } from "@/components/ui/button";
import type { ItemHistoryResponse, LogEntry } from "../../shared/api";
import * as api from "../api";
import { DeleteLogEntryDialog } from "../components/DeleteLogEntryDialog";
import { FilmTitle } from "../components/FilmTitle";
import { LogEntryDetails } from "../components/LogEntryDetails";
import { EditLogEntryDialog } from "../components/LogEntryDialog";
import { Poster } from "../components/Poster";
import { RatingStars } from "../components/Rating";
import { t } from "../i18n/t";

type HistoryState =
  | { status: "loading" }
  | { status: "loaded"; history: ItemHistoryResponse }
  | { status: "notFound" }
  | { status: "failed" };

async function loadHistory(mediaItemId: number): Promise<HistoryState> {
  if (!Number.isSafeInteger(mediaItemId) || mediaItemId <= 0) return { status: "notFound" };
  try {
    const history = await api.fetchItemHistory(mediaItemId);
    return history ? { status: "loaded", history } : { status: "notFound" };
  } catch {
    return { status: "failed" };
  }
}

// One film's Item History: how many times the User watched it, its Current Rating, and every Log
// Entry in Log Order, each of which can be edited or deleted. After either, the page reloads, so
// the order and the Current Rating are always the Worker's.
export function ItemHistoryPage() {
  const mediaItemId = Number(useParams().mediaItemId);
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [deleting, setDeleting] = useState<LogEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadHistory(mediaItemId).then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaItemId]);

  async function reload() {
    setState(await loadHistory(mediaItemId));
  }

  if (state.status === "loading") {
    return <p className="text-muted-foreground text-sm">{t("itemHistory.loading")}</p>;
  }
  if (state.status !== "loaded") {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t(state.status === "notFound" ? "itemHistory.notFound" : "itemHistory.unavailable")}
      </p>
    );
  }

  const { mediaItem, logEntries, currentRating } = state.history;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4">
        <Poster url={mediaItem.metadata?.posterUrl ?? null} />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">
            <FilmTitle metadata={mediaItem.metadata} />
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("itemHistory.timesExperienced", { count: logEntries.length })}
          </p>
          {currentRating !== null && (
            <dl className="flex items-center gap-2 text-sm">
              <dt className="text-muted-foreground">{t("itemHistory.currentRating")}</dt>
              <dd>
                <RatingStars rating={currentRating} />
              </dd>
            </dl>
          )}
        </div>
      </div>
      {logEntries.length > 0 && (
        <ul
          aria-label={t("itemHistory.listLabel")}
          className="flex flex-col divide-y rounded-lg border"
        >
          {logEntries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <LogEntryDetails entry={entry} />
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(entry)}>
                  {t("logEntry.edit")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDeleting(entry)}>
                  {t("logEntry.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <EditLogEntryDialog
        entry={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await reload();
        }}
      />
      <DeleteLogEntryDialog
        entry={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={async () => {
          setDeleting(null);
          await reload();
        }}
      />
    </div>
  );
}
