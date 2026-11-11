import { ArrowLeft, Link2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { List, ListItem, MediaType } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import { mediaTypeIcon } from "../catalog/media-types";
import { useMetadataFill } from "../catalog/use-metadata-fill";
import { AddFilmsDialog } from "../components/AddFilmsDialog";
import { DeleteListDialog } from "../components/DeleteListDialog";
import { EmptyState } from "../components/EmptyState";
import { ListActionsMenu } from "../components/ListActionsMenu";
import { ListFormDialog } from "../components/ListFormDialog";
import { ListPoster, listItemLabel } from "../components/ListPoster";
import { NoteDialog } from "../components/NoteDialog";
import { ShareLinkDialog } from "../components/ShareLinkDialog";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { useListItemEditing } from "../lists/use-list-item-editing";
import { usePageTitle } from "../navigation/page-title";
import { listsPath, listsPathOf } from "../navigation/paths";

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

// Under a List's heading: how many items it holds, if any, and whether it is shared.
function ListMeta({
  mediaType,
  count,
  shared,
}: {
  mediaType: MediaType;
  count: number;
  shared: boolean;
}) {
  if (count === 0 && !shared) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
      {count > 0 && <span>{mediaWord(mediaType, "count", { count })}</span>}
      {count > 0 && shared && <span aria-hidden>·</span>}
      {shared && (
        <span className="flex items-center gap-1">
          <Link2 aria-hidden className="size-3.5" />
          {t("lists.shared")}
        </span>
      )}
    </p>
  );
}

// One of the User's Lists in their own order, as a grid of posters with their Notes
// (`docs/mockups/collections/`, and `docs/mockups/books/` for books). "Add films" by the heading,
// or "Add books", and in an empty List, opens a search to add them with. Each poster's ⋯ menu notes, moves to the top or removes its film, and a
// removal can be undone; the ⋯ by the heading edits, reorders, shares or deletes the List itself.
// Reorder films puts arrows on each poster in place of "Add films" and the posters' ⋯ until Done.
// After each change the page reloads, so what it shows is the Worker's.
export function ListPage() {
  const listId = Number(useParams().listId);
  const navigate = useNavigate();
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [editingList, setEditingList] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [addingFilms, setAddingFilms] = useState(false);
  const reload = useCallback(async () => setState(await loadList(listId)), [listId]);
  // The section names the tab until the List has loaded, and if it can't.
  usePageTitle([state.status === "loaded" ? state.list.name : t("lists.title")]);

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

  const empty = state.status === "loaded" && state.list.items.length === 0;

  // Back to Collections on the List's Media Type, once it is known.
  const back = (
    <Link
      to={state.status === "loaded" ? listsPathOf(state.list.mediaType) : listsPath}
      className="flex items-center gap-1 self-start text-muted-foreground text-sm underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {t("list.back")}
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">
      {state.status !== "loaded" && back}
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
          {/* On a phone the ⋯ sits across from the way back and "Add films" spans the width under
          the heading; from `md` both sit beside the heading. */}
          <div
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-start",
              reordering
                ? "[grid-template-areas:'back_more'_'lead_lead'] md:[grid-template-areas:'back_back_back'_'lead_more_more']"
                : "[grid-template-areas:'back_more'_'lead_lead'_'add_add'] md:[grid-template-areas:'back_back_back'_'lead_add_more']",
            )}
          >
            <div className="[grid-area:back]">{back}</div>
            <div className="flex flex-col gap-1 [grid-area:lead]">
              <h1 className="break-words font-semibold text-2xl tracking-tight">
                {state.list.name}
              </h1>
              {state.list.description && (
                <p className="whitespace-pre-line break-words">{state.list.description}</p>
              )}
              <ListMeta
                mediaType={state.list.mediaType}
                count={state.list.items.length}
                shared={state.list.shareLink !== null}
              />
            </div>
            {!reordering && (
              // With no films the empty state's button leads, so this one steps back.
              <Button
                variant={empty ? "outline" : "default"}
                className={cn(
                  "h-11 rounded-full px-4.5 font-semibold [grid-area:add]",
                  empty && "bg-card",
                )}
                onClick={() => setAddingFilms(true)}
              >
                <Plus aria-hidden />
                {mediaWord(state.list.mediaType, "collectionAdd")}
              </Button>
            )}
            <ListActionsMenu
              mediaType={state.list.mediaType}
              className="[grid-area:more]"
              shared={state.list.shareLink !== null}
              reorderable={state.list.items.length >= 2}
              onEdit={() => setEditingList(true)}
              onReorder={() => setReordering(true)}
              onShare={() => setSharing(true)}
              onDelete={() => setDeleting(true)}
            />
          </div>
          {reordering && (
            <div
              role="status"
              className="sticky top-0 z-10 flex items-center justify-between gap-2.5 rounded-xl border border-primary-strong bg-primary-soft py-2 pr-2 pl-3.5 text-sm md:top-3 md:pl-4 md:text-[15px]"
            >
              {mediaWord(state.list.mediaType, "collectionReorderHint")}
              <Button
                className="h-10 shrink-0 rounded-full px-4 font-semibold"
                onClick={() => setReordering(false)}
              >
                {t("list.reorderDone")}
              </Button>
            </div>
          )}
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
              {error === "full"
                ? mediaWord(state.list.mediaType, "collectionFull", { max: maxListItems })
                : t("list.updateFailed")}
            </p>
          )}
          {empty ? (
            <EmptyState
              icon={mediaTypeIcon(state.list.mediaType)}
              message={t("list.empty")}
              action={{
                label: mediaWord(state.list.mediaType, "collectionAdd"),
                onClick: () => setAddingFilms(true),
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
                  reordering={reordering}
                  onMove={(position) => editing.move(item, position)}
                  onNote={() => editing.setNoting(item)}
                  onRemove={() => editing.remove(item)}
                />
              ))}
            </ol>
          )}
          <AddFilmsDialog
            open={addingFilms}
            list={state.list}
            onClose={() => setAddingFilms(false)}
            onAdded={reload}
          />
          <NoteDialog
            item={editing.noting}
            onClose={() => editing.setNoting(null)}
            onSaved={editing.noteSaved}
          />
          <ListFormDialog
            open={editingList}
            mediaType={state.list.mediaType}
            list={state.list}
            onClose={() => setEditingList(false)}
            onSaved={async () => {
              setEditingList(false);
              await reload();
            }}
          />
          <ShareLinkDialog
            open={sharing}
            list={state.list}
            onClose={() => setSharing(false)}
            onChanged={reload}
          />
          <DeleteListDialog
            list={state.list}
            open={deleting}
            onClose={() => setDeleting(false)}
            onDeleted={() => navigate(listsPathOf(state.list.mediaType))}
          />
        </>
      )}
    </div>
  );
}
