import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import type { List, ListItem } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import { mediaTypeIcon } from "../catalog/media-types";
import { useMetadataFill } from "../catalog/use-metadata-fill";
import { AddToListSearch } from "../components/AddToListSearch";
import { DeleteListDialog } from "../components/DeleteListDialog";
import { EmptyState } from "../components/EmptyState";
import { ListFormDialog } from "../components/ListFormDialog";
import { ListPoster, listItemLabel } from "../components/ListPoster";
import { NoteDialog } from "../components/NoteDialog";
import { ShareLinkPanel } from "../components/ShareLinkPanel";
import { t } from "../i18n/t";
import { useListItemEditing } from "../lists/use-list-item-editing";
import { listsPath } from "../navigation/paths";

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

// One of the User's Lists in their own order, as a grid of posters with their Notes
// (`docs/mockups/collections/`), and a search to add films to it. Each poster's ⋯ menu notes,
// moves or removes its film, and a removal can be undone; the List itself can be renamed or
// deleted. After each change the page reloads, so the order is always the Worker's.
export function ListPage() {
  const listId = Number(useParams().listId);
  const navigate = useNavigate();
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [editingList, setEditingList] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Holds the search to add films, which the empty List's button takes the User to.
  const addFilms = useRef<HTMLDivElement>(null);
  const reload = useCallback(async () => setState(await loadList(listId)), [listId]);

  // Puts a removed film back where it was, with its Note.
  async function putBack({ mediaItem, position, note }: ListItem) {
    const outcome = await api.addToList(listId, { mediaItemId: mediaItem.id, position, note });
    if (outcome.ok) return null;
    return outcome.error === "list_full" ? "full" : "unavailable";
  }

  const editing = useListItemEditing({ reload, putBack });
  const { removed, error } = editing;
  const fill = useMetadataFill(
    state.status === "loaded" ? state.list.items.map((item) => item.mediaItem) : [],
  );

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
        to={listsPath}
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
            <ShareLinkPanel
              listId={state.list.id}
              shareLink={state.list.shareLink}
              onChanged={reload}
            />
          </div>
          <div ref={addFilms}>
            <AddToListSearch list={state.list} onAdded={reload} />
          </div>
          <div role="status" className="empty:hidden md:self-start">
            {removed && (
              <p className="flex items-center justify-between gap-2.5 rounded-xl bg-muted py-1 pr-1 pl-3.5 text-sm">
                {t("list.removed", { film: listItemLabel(removed) })}
                <Button
                  variant="ghost"
                  className="h-10 shrink-0 rounded-full px-3.5 font-bold text-primary-strong hover:bg-transparent hover:text-primary-strong hover:underline dark:hover:bg-transparent"
                  onClick={() => editing.undo(removed)}
                >
                  {t("listItem.undo")}
                </Button>
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error === "full" ? t("list.full", { max: maxListItems }) : t("list.updateFailed")}
            </p>
          )}
          {state.list.items.length === 0 ? (
            <EmptyState
              icon={mediaTypeIcon(state.list.mediaType)}
              message={t("list.empty")}
              action={{
                label: t("list.addLabel"),
                onClick: () => addFilms.current?.querySelector("input")?.focus(),
              }}
            />
          ) : (
            <ol
              aria-label={state.list.name}
              className="grid grid-cols-3 items-start gap-x-3 gap-y-5 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:gap-x-5 md:gap-y-7"
            >
              {state.list.items.map((item, index, items) => (
                <ListPoster
                  key={item.id}
                  item={{ ...item, mediaItem: fill.filled(item.mediaItem) }}
                  loading={fill.loading(item.mediaItem)}
                  place={index + 1}
                  listName={state.list.name}
                  last={index === items.length - 1}
                  onMove={(position) => editing.move(item, position)}
                  onNote={() => editing.setNoting(item)}
                  onRemove={() => editing.remove(item)}
                />
              ))}
            </ol>
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
            onDeleted={() => navigate(listsPath)}
          />
        </>
      )}
    </div>
  );
}
