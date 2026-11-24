import { ChevronLeft, Plus } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  HoldingList,
  ListItemPlace,
  ListSummary,
  MediaItem,
  MediaItemList,
  MediaType,
  RemovedListItem,
} from "../../shared/api";
import { isLight } from "../../shared/catalog";
import { maxListItems, maxListNameLength } from "../../shared/lists";
import * as api from "../api";
import { mediaWord } from "../i18n/media-words";
import { type MessageId, t } from "../i18n/t";
import { listsPathOf } from "../navigation/paths";
import { listErrorMessage } from "./ListFormDialog";

// A film or book to put on Lists: its label, its Media Type, how to get its Media Item, which for
// a source's search result adds it to the catalog first, and who to tell which Lists hold it,
// oldest first, as that changes.
// Kept in state by the opener, so it loads once per opening.
export type ListsFilm = {
  label: string;
  mediaType: MediaType;
  mediaItem: () => Promise<MediaItem | null>;
  onHeld?: (lists: HoldingList[]) => void;
};

// Every one of the User's Lists with a checkbox, ticked where the film is already: ticking adds
// the film at the end, unticking takes it off. A List unticked and ticked again before the dialog
// closes gets the film back where it was, with its Note. The dialog is open while `film` is set.
//
// A song or an artist, which goes into Collections in one step, gets the picker drawn for a song
// (`docs/mockups/songs/`): its Collections come last used first, as the Worker orders them, each
// row toggling all of it, and New collection under them makes one in place, adds the song and puts
// the new one first, ticked. With none yet, the form shows at once, saying so.
// What the picker of a light Media Type says while the User has no Collection of it yet.
const noneYet: Partial<Record<MediaType, MessageId>> = {
  song: "filmLists.songsNone",
  artist: "filmLists.artistsNone",
};

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
  // Whether a Collection is made right here, as for a song.
  const inPlace = isLight(film.mediaType);
  const [state, setState] = useState<ListsState>({ status: "loading" });
  const [making, setMaking] = useState(false);
  // The state as of the last answer, which a change still saving when the dialog closes reads too.
  const latest = useRef(state);
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<api.AddToListError | null>(null);
  // Where the film was in each List it was taken off since the dialog opened, by List id.
  const [removed, setRemoved] = useState<ReadonlyMap<number, RemovedListItem>>(new Map());

  // Sets the state and tells the opener which Lists hold the film now.
  const show = useCallback(
    (next: ListsState) => {
      latest.current = next;
      setState(next);
      if (next.status !== "loaded") return;
      film.onHeld?.(
        next.lists.filter((list) => list.listItem !== null).map(({ id, name }) => ({ id, name })),
      );
    },
    [film],
  );

  useEffect(() => {
    let cancelled = false;
    loadLists(film).then((loaded) => {
      if (!cancelled) show(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [film, show]);

  function setBusyOf(listId: number, isBusy: boolean) {
    setBusy((current) => {
      const next = new Set(current);
      if (isBusy) next.add(listId);
      else next.delete(listId);
      return next;
    });
  }

  function place(listId: number, listItem: ListItemPlace | null) {
    const current = latest.current;
    if (current.status !== "loaded") return;
    show({
      ...current,
      lists: current.lists.map((list) => (list.id === listId ? { ...list, listItem } : list)),
    });
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
        show(await loadLists(film));
      } else {
        setError(outcome.error);
      }
    }
    setBusyOf(list.id, false);
  }

  // Puts a Collection just made first, holding the Media Item where it was added, or not when that
  // failed, and goes back to the list.
  function made(list: ListSummary, listItem: ListItemPlace | null) {
    const current = latest.current;
    if (current.status !== "loaded") return;
    show({ ...current, lists: [{ ...list, listItem, firstMediaItem: null }, ...current.lists] });
    setMaking(false);
  }

  if (state.status === "loaded" && inPlace && (making || state.lists.length === 0)) {
    const none = state.lists.length === 0;
    return (
      <NewListForm
        film={film}
        mediaItemId={state.mediaItemId}
        heading={none ? t("filmLists.title", { film: film.label }) : t("filmLists.new")}
        intro={none ? t(noneYet[film.mediaType] ?? "filmLists.songsNone") : null}
        onBack={none ? null : () => setMaking(false)}
        onMade={(list, listItem, failed) => {
          made(list, listItem);
          setError(failed);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("filmLists.title", { film: film.label })}</DialogTitle>
        <DialogDescription>{mediaWord(film.mediaType, "collectionTick")}</DialogDescription>
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
            <Link to={listsPathOf(film.mediaType)}>{t("filmLists.make")}</Link>
          </Button>
        </div>
      )}
      {state.status === "loaded" && state.lists.length > 0 && (
        <div className="flex flex-col">
          <ul className={cn("flex max-h-80 flex-col overflow-y-auto", !inPlace && "gap-3")}>
            {state.lists.map((list) => (
              <ListCheckbox
                key={list.id}
                name={list.name}
                large={inPlace}
                checked={list.listItem !== null}
                disabled={busy.has(list.id)}
                onToggle={() => toggle(state.mediaItemId, list)}
              />
            ))}
          </ul>
          {inPlace && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMaking(true)}
              className="min-h-12 justify-start gap-3 px-0 font-semibold text-base text-primary-strong has-[>svg]:px-0 hover:bg-transparent"
            >
              <Plus aria-hidden className="size-5" />
              {t("filmLists.new")}
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error === "list_full"
            ? mediaWord(film.mediaType, "collectionFull", { max: maxListItems })
            : t("list.updateFailed")}
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

// One List's checkbox. A `large` one is a row at least 48 px tall, all of which toggles, with a
// 20 px checkbox (`docs/mockups/songs/`).
function ListCheckbox({
  name,
  large = false,
  checked,
  disabled,
  onToggle,
}: {
  name: string;
  large?: boolean;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  return (
    <li className="flex items-center gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
        className={cn(large && "size-5")}
      />
      <Label
        htmlFor={id}
        className={cn("break-words", large && "min-h-12 flex-1 cursor-pointer text-base")}
      >
        {name}
      </Label>
    </li>
  );
}

// What a List that couldn't be made says, a taken name naming the Media Type of the List that has
// it.
function refusalMessage(refused: api.ListRefusal): string {
  return refused.error === "list_name_taken"
    ? t("filmLists.nameTaken", { mediaType: refused.takenBy })
    : listErrorMessage(refused.error);
}

// The picker's own New collection: a name, and Create and add, which makes the List and adds the
// Media Item to it. `onBack` leads back to the list of Lists, when there is one.
function NewListForm({
  film,
  mediaItemId,
  heading,
  intro,
  onBack,
  onMade,
}: {
  film: ListsFilm;
  mediaItemId: number;
  heading: string;
  intro: string | null;
  onBack: (() => void) | null;
  onMade: (
    list: ListSummary,
    listItem: ListItemPlace | null,
    failed: api.AddToListError | null,
  ) => void;
}) {
  const ids = { name: useId(), error: useId() };
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<api.ListRefusal | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const created = await api.createList({ name: name.trim(), mediaType: film.mediaType });
    if (!created.ok) {
      setSaving(false);
      setRefused(created);
      return;
    }
    const added = await api.addToList(created.list.id, { mediaItemId });
    setSaving(false);
    if (added.ok) {
      const { id, position, note } = added.listItem;
      onMade(created.list, { id, position, note }, null);
    } else {
      onMade(created.list, null, added.error);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {onBack && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("filmLists.back")}
          title={t("filmLists.back")}
          onClick={onBack}
          className="absolute top-3 left-3 opacity-70 hover:opacity-100"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </Button>
      )}
      <DialogHeader className={cn(onBack && "px-8")}>
        <DialogTitle>{heading}</DialogTitle>
        {intro ? (
          <DialogDescription>{intro}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">
            {mediaWord(film.mediaType, "collectionNew")}
          </DialogDescription>
        )}
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.name}>{t("filmLists.name")}</Label>
        <Input
          id={ids.name}
          required
          autoFocus
          autoComplete="off"
          maxLength={maxListNameLength}
          placeholder={mediaWord(film.mediaType, "collectionNamePlaceholder")}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setRefused(null);
          }}
          aria-invalid={refused ? true : undefined}
          aria-describedby={refused ? ids.error : undefined}
          className="h-11"
        />
        {refused && (
          <p id={ids.error} role="alert" className="text-destructive text-sm">
            {refusalMessage(refused)}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving}>
          {t(saving ? "filmLists.creating" : "filmLists.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
