import { ArrowDown, ArrowUp, ArrowUpToLine } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import type { Backlog, ListItem } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { FilmTitle } from "../components/FilmTitle";
import { NoteDialog } from "../components/NoteDialog";
import { Poster } from "../components/Poster";
import { UndoLine } from "../components/UndoLine";
import { t } from "../i18n/t";

type BacklogState =
  | { status: "loading" }
  | { status: "loaded"; backlog: Backlog }
  | { status: "failed" };

async function loadBacklog(): Promise<BacklogState> {
  try {
    return { status: "loaded", backlog: await api.fetchBacklog() };
  } catch {
    return { status: "failed" };
  }
}

type UpdateError = "backlog_full" | "unavailable";

function labelOf(item: ListItem): string {
  const metadata = item.mediaItem.metadata;
  return metadata ? filmLabel(metadata) : t("film.unknown");
}

// The User's Watchlist, the film Backlog, in their own order. Each film can be moved, noted or
// removed, and a removal undone. After each change the page reloads, so the order is always the
// Worker's.
export function BacklogPage() {
  const [state, setState] = useState<BacklogState>({ status: "loading" });
  const [noting, setNoting] = useState<ListItem | null>(null);
  const [removed, setRemoved] = useState<ListItem | null>(null);
  const [error, setError] = useState<UpdateError | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBacklog().then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    setState(await loadBacklog());
  }

  async function move(item: ListItem, position: number) {
    setError(null);
    if (!(await api.editListItem(item.id, { position }))) setError("unavailable");
    await reload();
  }

  async function remove(item: ListItem) {
    setError(null);
    setRemoved(null);
    if (await api.removeListItem(item.id)) setRemoved(item);
    else setError("unavailable");
    await reload();
  }

  // Puts the removed film back where it was, with its Note.
  async function undo(item: ListItem) {
    setError(null);
    const { mediaItem, position, note } = item;
    const outcome = await api.plan({ mediaItemId: mediaItem.id, position, note });
    if (outcome.ok) setRemoved(null);
    else setError(outcome.error);
    await reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">{t("backlog.title")}</h1>
        {state.status === "loaded" && state.backlog.items.length > 0 && (
          <p className="text-muted-foreground text-sm">
            {t("films.count", { count: state.backlog.items.length })}
          </p>
        )}
      </div>
      <div role="status" className="text-sm empty:hidden">
        {removed && (
          <UndoLine
            message={t("backlog.removed", { film: labelOf(removed) })}
            onUndo={() => undo(removed)}
          />
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error === "backlog_full"
            ? t("backlog.full", { max: maxListItems })
            : t("backlog.updateFailed")}
        </p>
      )}
      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("backlog.loading")}</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("backlog.unavailable")}
        </p>
      )}
      {state.status === "loaded" && state.backlog.items.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("backlog.empty")}</p>
      )}
      {state.status === "loaded" && state.backlog.items.length > 0 && (
        <ul
          aria-label={t("backlog.listLabel")}
          className="flex flex-col divide-y rounded-lg border"
        >
          {state.backlog.items.map((item, index, items) => (
            <BacklogItem
              key={item.id}
              item={item}
              first={index === 0}
              last={index === items.length - 1}
              onMove={(position) => move(item, position)}
              onNote={() => setNoting(item)}
              onRemove={() => remove(item)}
            />
          ))}
        </ul>
      )}
      <NoteDialog
        item={noting}
        onClose={() => setNoting(null)}
        onSaved={async () => {
          setNoting(null);
          await reload();
        }}
      />
    </div>
  );
}

function BacklogItem({
  item,
  first,
  last,
  onMove,
  onNote,
  onRemove,
}: {
  item: ListItem;
  first: boolean;
  last: boolean;
  onMove: (position: number) => void;
  onNote: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-3 py-3">
      <div className="flex gap-3">
        <Poster url={item.mediaItem.metadata?.posterUrl ?? null} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Link
            to={`/items/${item.mediaItem.id}`}
            className="underline-offset-4 hover:underline focus-visible:underline"
          >
            <FilmTitle metadata={item.mediaItem.metadata} />
          </Link>
          {item.note && <p className="whitespace-pre-line break-words text-sm">{item.note}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("backlog.moveToTop")}
          title={t("backlog.moveToTop")}
          disabled={first}
          onClick={() => onMove(0)}
        >
          <ArrowUpToLine aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("backlog.moveUp")}
          title={t("backlog.moveUp")}
          disabled={first}
          onClick={() => onMove(item.position - 1)}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("backlog.moveDown")}
          title={t("backlog.moveDown")}
          disabled={last}
          onClick={() => onMove(item.position + 1)}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button variant="outline" size="sm" onClick={onNote}>
          {t(item.note ? "backlog.editNote" : "backlog.addNote")}
        </Button>
        <Button variant="outline" size="sm" onClick={onRemove}>
          {t("backlog.remove")}
        </Button>
      </div>
    </li>
  );
}
