import { useEffect, useState } from "react";
import type { Backlog, ListItem } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import { ListItemRow, listItemLabel } from "../components/ListItemRow";
import { NoteDialog } from "../components/NoteDialog";
import { UndoLine } from "../components/UndoLine";
import { t } from "../i18n/t";
import { useListItemEditing } from "../lists/use-list-item-editing";

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

// Puts a removed film back where it was, with its Note.
async function putBack({ mediaItem, position, note }: ListItem) {
  const outcome = await api.plan({ mediaItemId: mediaItem.id, position, note });
  if (outcome.ok) return null;
  return outcome.error === "backlog_full" ? "full" : "unavailable";
}

// The User's Watchlist, the film Backlog, in their own order. Each film can be moved, noted or
// removed, and a removal undone. After each change the page reloads, so the order is always the
// Worker's.
export function BacklogPage() {
  const [state, setState] = useState<BacklogState>({ status: "loading" });
  const editing = useListItemEditing({
    reload: async () => setState(await loadBacklog()),
    putBack,
  });
  const { removed, error } = editing;

  useEffect(() => {
    let cancelled = false;
    loadBacklog().then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
            message={t("backlog.removed", { film: listItemLabel(removed) })}
            onUndo={() => editing.undo(removed)}
          />
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error === "full" ? t("backlog.full", { max: maxListItems }) : t("backlog.updateFailed")}
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
            <ListItemRow
              key={item.id}
              item={item}
              first={index === 0}
              last={index === items.length - 1}
              onMove={(position) => editing.move(item, position)}
              onNote={() => editing.setNoting(item)}
              onRemove={() => editing.remove(item)}
            />
          ))}
        </ul>
      )}
      <NoteDialog
        item={editing.noting}
        onClose={() => editing.setNoting(null)}
        onSaved={editing.noteSaved}
      />
    </div>
  );
}
