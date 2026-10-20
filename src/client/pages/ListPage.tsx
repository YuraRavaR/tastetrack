import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import type { List, ListItem } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import { AddToListSearch } from "../components/AddToListSearch";
import { DeleteListDialog } from "../components/DeleteListDialog";
import { ListFormDialog } from "../components/ListFormDialog";
import { ListItemRow, listItemLabel } from "../components/ListItemRow";
import { NoteDialog } from "../components/NoteDialog";
import { UndoLine } from "../components/UndoLine";
import { t } from "../i18n/t";
import { useListItemEditing } from "../lists/use-list-item-editing";

type ListState =
  | { status: "loading" }
  | { status: "loaded"; list: List }
  | { status: "notFound" }
  | { status: "failed" };

async function loadList(listId: number): Promise<ListState> {
  try {
    const list = await api.fetchList(listId);
    return list ? { status: "loaded", list } : { status: "notFound" };
  } catch {
    return { status: "failed" };
  }
}

// One of the User's Lists in their own order, with a search to add films to it. Each film can be
// moved, noted or removed, and a removal undone; the List itself can be renamed or deleted. After
// each change the page reloads, so the order is always the Worker's.
export function ListPage() {
  const listId = Number(useParams().listId);
  const navigate = useNavigate();
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [editingList, setEditingList] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const reload = useCallback(async () => setState(await loadList(listId)), [listId]);

  // Puts a removed film back where it was, with its Note.
  async function putBack({ mediaItem, position, note }: ListItem) {
    const outcome = await api.addToList(listId, { mediaItemId: mediaItem.id, position, note });
    if (outcome.ok) return null;
    return outcome.error === "list_full" ? "full" : "unavailable";
  }

  const editing = useListItemEditing({ reload, putBack });
  const { removed, error } = editing;

  useEffect(() => {
    let cancelled = false;
    loadList(listId).then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [listId]);

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/lists"
        className="flex items-center gap-1 self-start text-muted-foreground text-sm underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t("list.back")}
      </Link>
      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("list.loading")}</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("list.unavailable")}
        </p>
      )}
      {state.status === "notFound" && (
        <p className="text-muted-foreground text-sm">{t("list.notFound")}</p>
      )}
      {state.status === "loaded" && (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="break-words font-semibold text-2xl tracking-tight">
                {state.list.name}
              </h1>
              {state.list.description && (
                <p className="whitespace-pre-line break-words">{state.list.description}</p>
              )}
              {state.list.items.length > 0 && (
                <p className="text-muted-foreground text-sm">
                  {t("films.count", { count: state.list.items.length })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingList(true)}>
                {t("list.edit")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDeleting(true)}>
                {t("list.delete")}
              </Button>
            </div>
          </div>
          <AddToListSearch list={state.list} onAdded={reload} />
          <div role="status" className="text-sm empty:hidden">
            {removed && (
              <UndoLine
                message={t("list.removed", { film: listItemLabel(removed) })}
                onUndo={() => editing.undo(removed)}
              />
            )}
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error === "full" ? t("list.full", { max: maxListItems }) : t("list.updateFailed")}
            </p>
          )}
          {state.list.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("list.empty")}</p>
          ) : (
            <ul aria-label={state.list.name} className="flex flex-col divide-y rounded-lg border">
              {state.list.items.map((item, index, items) => (
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
          <ListFormDialog
            open={editingList}
            list={state.list}
            onClose={() => setEditingList(false)}
            onSaved={async () => {
              setEditingList(false);
              await reload();
            }}
          />
          <DeleteListDialog
            list={state.list}
            open={deleting}
            onClose={() => setDeleting(false)}
            onDeleted={() => navigate("/lists")}
          />
        </>
      )}
    </div>
  );
}
