import { useEffect, useId, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import type { ItemHistoryResponse, LogEntry } from "../../shared/api";
import * as api from "../api";
import { DeleteLogEntryDialog } from "../components/DeleteLogEntryDialog";
import { DeleteManualMediaItemDialog } from "../components/DeleteManualMediaItemDialog";
import { FilmActions } from "../components/FilmActions";
import { FilmBanner } from "../components/FilmBanner";
import { FilmFacts, FilmTitle } from "../components/FilmTitle";
import { ItemHistoryRow } from "../components/ItemHistoryRow";
import { ItemHistoryStats } from "../components/ItemHistoryStats";
import { EditLogEntryDialog } from "../components/LogEntryDialog";
import { ManualMediaItemDialog } from "../components/ManualMediaItemDialog";
import { mediaWord } from "../i18n/media-words";
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

// One film's Item History: a banner, tiles for how the User watched and rated it, the actions they
// can take on it, and every Log Entry, newest first, each of which can be edited or deleted. A film
// with no Log Entries has no tiles, and says what will show where its entries go. The Worker sends
// them in Log Order, and the page only reverses that for display. After a new entry, an edit or a
// delete it reloads, so the order and the Current Rating are always the Worker's. A film the User
// added manually can be edited too, or deleted with everything that goes with it.
export function ItemHistoryPage() {
  const mediaItemId = Number(useParams().mediaItemId);
  const navigate = useNavigate();
  const historyHeadingId = useId();
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [deleting, setDeleting] = useState<LogEntry | null>(null);
  const [editingFilm, setEditingFilm] = useState(false);
  const [deletingFilm, setDeletingFilm] = useState(false);

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

  const { mediaItem, logEntries } = state.history;
  const manual = mediaItem.externalReference === null;
  return (
    <div className="flex flex-col gap-6">
      <FilmBanner mediaItem={mediaItem} />
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl tracking-tight">
          <FilmTitle metadata={mediaItem.metadata} />
        </h1>
        <FilmFacts metadata={mediaItem.metadata} />
      </div>
      {logEntries.length > 0 && <ItemHistoryStats history={state.history} />}
      <FilmActions
        history={state.history}
        onLogged={reload}
        onPlanned={(inBacklog) =>
          setState((current) =>
            current.status === "loaded"
              ? { ...current, history: { ...current.history, inBacklog } }
              : current,
          )
        }
      />
      {manual && (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">{t("manualItem.addedByYou")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingFilm(true)}>
              {t("manualItem.edit")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeletingFilm(true)}>
              {t("manualItem.delete")}
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        <h2 id={historyHeadingId} className="font-semibold text-lg tracking-tight">
          {mediaWord(mediaItem.mediaType, "history")}
        </h2>
        {logEntries.length > 0 ? (
          <ul
            aria-labelledby={historyHeadingId}
            className="flex flex-col divide-y rounded-lg border bg-card"
          >
            {logEntries.toReversed().map((entry) => (
              <ItemHistoryRow
                key={entry.id}
                entry={entry}
                onEdit={() => setEditing(entry)}
                onDelete={() => setDeleting(entry)}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-1 rounded-lg border border-input border-dashed px-4 py-5 text-center">
            <p className="font-medium">{mediaWord(mediaItem.mediaType, "historyEmpty")}</p>
            <p className="text-muted-foreground text-sm">
              {mediaWord(mediaItem.mediaType, "historyEmptyHint")}
            </p>
          </div>
        )}
      </div>
      <EditLogEntryDialog
        entry={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await reload();
        }}
        onDelete={() => {
          setDeleting(editing);
          setEditing(null);
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
      {manual && (
        <>
          <ManualMediaItemDialog
            open={editingFilm}
            mediaItem={mediaItem}
            onClose={() => setEditingFilm(false)}
            onSaved={async () => {
              setEditingFilm(false);
              await reload();
            }}
          />
          <DeleteManualMediaItemDialog
            mediaItem={mediaItem}
            open={deletingFilm}
            onClose={() => setDeletingFilm(false)}
            onDeleted={() => navigate("/log", { replace: true })}
          />
        </>
      )}
    </div>
  );
}
