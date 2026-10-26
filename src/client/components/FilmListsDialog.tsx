import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ListItemPlace, MediaItem, MediaItemList, RemovedListItem } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import { t } from "../i18n/t";

// A film to put on Lists: its label, and how to get its Media Item, which for a TMDB search
// result adds it to the catalog first. Kept in state by the opener, so it loads once per opening.
export type ListsFilm = { label: string; mediaItem: () => Promise<MediaItem | null> };

// Every one of the User's Lists with a checkbox, ticked where the film is already: ticking adds
// the film at the end, unticking takes it off. A List unticked and ticked again before the dialog
// closes gets the film back where it was, with its Note. The dialog is open while `film` is set.
export function FilmListsDialog({
  film,
  onClose,
}: {
  film: ListsFilm | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={film !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{film && <FilmLists film={film} />}</DialogContent>
    </Dialog>
  );
}

type ListsState =
  | { status: "loading" }
  | { status: "loaded"; mediaItemId: number; lists: MediaItemList[] }
  | { status: "failed" };

async function loadLists(film: ListsFilm): Promise<ListsState> {
  try {
    const mediaItem = await film.mediaItem();
    const lists = mediaItem && (await api.fetchMediaItemLists(mediaItem.id));
    return mediaItem && lists
      ? { status: "loaded", mediaItemId: mediaItem.id, lists }
      : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}

function FilmLists({ film }: { film: ListsFilm }) {
  const [state, setState] = useState<ListsState>({ status: "loading" });
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<api.AddToListError | null>(null);
  // Where the film was in each List it was taken off since the dialog opened, by List id.
  const [removed, setRemoved] = useState<ReadonlyMap<number, RemovedListItem>>(new Map());

  useEffect(() => {
    let cancelled = false;
    loadLists(film).then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [film]);

  function setBusyOf(listId: number, isBusy: boolean) {
    setBusy((current) => {
      const next = new Set(current);
      if (isBusy) next.add(listId);
      else next.delete(listId);
      return next;
    });
  }

  function place(listId: number, listItem: ListItemPlace | null) {
    setState((current) =>
      current.status === "loaded"
        ? {
            ...current,
            lists: current.lists.map((list) => (list.id === listId ? { ...list, listItem } : list)),
          }
        : current,
    );
  }

  async function toggle(mediaItemId: number, list: MediaItemList) {
    setError(null);
    setBusyOf(list.id, true);
    if (list.listItem) {
      const { id, position, note } = list.listItem;
      if (await api.removeListItem(id)) {
        setRemoved((current) => new Map(current).set(list.id, { position, note }));
        place(list.id, null);
      } else {
        setError("unavailable");
      }
    } else {
      const outcome = await api.addToList(list.id, { mediaItemId, ...removed.get(list.id) });
      if (outcome.ok) {
        const { id, position, note } = outcome.listItem;
        place(list.id, { id, position, note });
      } else if (outcome.error === "already_in_list") {
        // Added elsewhere since the dialog opened: show the List as it is now.
        setState(await loadLists(film));
      } else {
        setError(outcome.error);
      }
    }
    setBusyOf(list.id, false);
  }

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("filmLists.title", { film: film.label })}</DialogTitle>
        <DialogDescription>{t("filmLists.description")}</DialogDescription>
      </DialogHeader>
      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("filmLists.loading")}</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("filmLists.unavailable")}
        </p>
      )}
      {state.status === "loaded" && state.lists.length === 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-muted-foreground">{t("filmLists.empty")}</span>
          <Button variant="outline" size="sm" asChild>
            <Link to="/lists">{t("filmLists.make")}</Link>
          </Button>
        </div>
      )}
      {state.status === "loaded" && state.lists.length > 0 && (
        <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {state.lists.map((list) => (
            <ListCheckbox
              key={list.id}
              name={list.name}
              checked={list.listItem !== null}
              disabled={busy.has(list.id)}
              onToggle={() => toggle(state.mediaItemId, list)}
            />
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error === "list_full" ? t("list.full", { max: maxListItems }) : t("list.updateFailed")}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button">{t("filmLists.done")}</Button>
        </DialogClose>
      </DialogFooter>
    </div>
  );
}

function ListCheckbox({
  name,
  checked,
  disabled,
  onToggle,
}: {
  name: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  return (
    <li className="flex items-center gap-3">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={onToggle} />
      <Label htmlFor={id} className="break-words">
        {name}
      </Label>
    </li>
  );
}
