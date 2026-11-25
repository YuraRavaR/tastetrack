import { ArrowLeft, Ellipsis, Heart, Link2, Pencil, Search } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Favourites, FavouritesMediaType, ListItem } from "../../shared/api";
import { hasFavourites } from "../../shared/catalog";
import { maxFavourites, maxListDescriptionLength } from "../../shared/lists";
import * as api from "../api";
import { useMetadataFill } from "../catalog/use-metadata-fill";
import { EmptyState } from "../components/EmptyState";
import { FavouriteRow, rankedName } from "../components/FavouriteRow";
import {
  MenuSheetContent,
  menuSheetIconClasses,
  menuSheetItemClasses,
} from "../components/MenuSheetContent";
import { NoteDialog } from "../components/NoteDialog";
import { ShareLinkDialog } from "../components/ShareLinkDialog";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { useListItemEditing } from "../lists/use-list-item-editing";
import { usePageTitle } from "../navigation/page-title";
import { listsPath, listsPathOf, searchPathOf } from "../navigation/paths";

type FavouritesState =
  | { status: "loading" }
  | { status: "loaded"; favourites: Favourites | null }
  | { status: "failed" };

async function loadFavourites(mediaType: FavouritesMediaType): Promise<FavouritesState> {
  try {
    return { status: "loaded", favourites: await api.fetchFavourites(mediaType) };
  } catch {
    return { status: "failed" };
  }
}

// The address names the Media Type; one with no Favourites goes back to Collections.
export function FavouritesPage() {
  const { mediaType } = useParams();
  if (!mediaType || !hasFavourites(mediaType)) return <Navigate to={listsPath} replace />;
  return <FavouritesOf mediaType={mediaType} />;
}

// The User's Favourite artists (`docs/mockups/artists/`, "Favourite artists"): a ranked list of
// rows, each with its place, the artist's photo, name, facts and Note, the ↑↓ arrows always there,
// and a ⋯ that notes it or takes it out, with an undo. The ⋯ by the heading shares the Favourites or
// edits their description; they can't be renamed or deleted. Find artists opens Search on artists,
// and once they hold `maxFavourites`, a notice says to take one out first. After each change the
// page reloads, so what it shows is the Worker's.
function FavouritesOf({ mediaType }: { mediaType: FavouritesMediaType }) {
  const [state, setState] = useState<FavouritesState>({ status: "loading" });
  const [sharing, setSharing] = useState(false);
  const [describing, setDescribing] = useState(false);
  const reload = useCallback(async () => setState(await loadFavourites(mediaType)), [mediaType]);
  usePageTitle([t("artist.favourites")]);

  // Puts a removed artist back where they were, with their Note.
  async function putBack({ mediaItem, position, note }: ListItem) {
    const liked = await api.like(mediaItem.id);
    if (!liked.ok) return liked.error === "favourites_full" ? "full" : "unavailable";
    const placed = await api.editListItem(liked.listItem.id, { position, note });
    return placed ? null : "unavailable";
  }

  const editing = useListItemEditing({ reload, putBack });
  const { removed, error } = editing;
  const favourites = state.status === "loaded" ? state.favourites : null;
  const fill = useMetadataFill(favourites ? favourites.items.map((item) => item.mediaItem) : []);

  useEffect(() => {
    let cancelled = false;
    loadFavourites(mediaType).then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  const findButton = (
    <Button
      asChild
      className="h-12 w-full rounded-full font-semibold text-base md:h-10 md:w-auto md:self-start md:px-4.5 md:text-sm"
    >
      <Link to={searchPathOf(mediaType)}>
        <Search aria-hidden />
        {t("artist.findArtists")}
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={listsPathOf(mediaType)}
          className="flex items-center gap-1 self-start text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t("list.back")}
        </Link>
        {favourites && (
          <FavouritesActionsMenu
            shared={favourites.shareLink !== null}
            onShare={() => setSharing(true)}
            onDescribe={() => setDescribing(true)}
          />
        )}
      </div>
      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("artist.favouritesLoading")}</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("artist.favouritesUnavailable")}
        </p>
      )}
      {state.status === "loaded" && (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 break-words font-semibold text-2xl tracking-tight">
              <Heart aria-hidden className="size-6 shrink-0 fill-current text-primary-strong" />
              {t("artist.favourites")}
            </h1>
            {favourites?.description && (
              <p className="whitespace-pre-line break-words">{favourites.description}</p>
            )}
            {favourites && favourites.items.length > 0 && (
              <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
                <span>{mediaWord(mediaType, "count", { count: favourites.items.length })}</span>
                {favourites.shareLink && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="flex items-center gap-1">
                      <Link2 aria-hidden className="size-3.5" />
                      {t("lists.shared")}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
          {favourites && favourites.items.length >= maxFavourites && (
            <p
              role="status"
              className="rounded-xl border border-primary-strong bg-primary-soft px-3.5 py-2.5 text-sm"
            >
              {t("artist.favouritesFullNotice", { max: maxFavourites })}
            </p>
          )}
          {favourites && favourites.items.length > 0 && findButton}
          <div role="status" className="empty:hidden md:self-start">
            {removed && (
              <p className="flex items-center justify-between gap-2.5 rounded-xl bg-muted py-1 pr-1 pl-3.5 text-sm">
                {t("artist.removed", { name: rankedName(removed.mediaItem) })}
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
                ? t("artist.favouritesFull", { max: maxFavourites })
                : t("list.updateFailed")}
            </p>
          )}
          {!favourites || favourites.items.length === 0 ? (
            <EmptyState
              icon={Heart}
              message={t("artist.favouritesNone")}
              action={{
                label: t("artist.findArtists"),
                icon: Search,
                to: searchPathOf(mediaType),
              }}
            />
          ) : (
            <ol
              aria-label={t("artist.favourites")}
              className="flex flex-col divide-y rounded-lg border bg-card"
            >
              {favourites.items.map((item, index, items) => (
                <FavouriteRow
                  key={item.id}
                  item={{ ...item, mediaItem: fill.filled(item.mediaItem) }}
                  place={index + 1}
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
          {favourites && (
            <>
              <ShareLinkDialog
                open={sharing}
                list={{ ...favourites, name: t("artist.favourites") }}
                onClose={() => setSharing(false)}
                onChanged={reload}
              />
              <DescriptionDialog
                open={describing}
                mediaType={mediaType}
                description={favourites.description}
                onClose={() => setDescribing(false)}
                onSaved={async () => {
                  setDescribing(false);
                  await reload();
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

// The ⋯ by the heading of Favourite artists (`#menu`): Share, or Share Link once shared, and Edit
// description, then why there is no rename or delete. A bottom sheet on a phone, a dropdown from
// `md`.
function FavouritesActionsMenu({
  shared,
  onShare,
  onDescribe,
}: {
  shared: boolean;
  onShare: () => void;
  onDescribe: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("artist.favouritesActions")}
          title={t("artist.favouritesActions")}
          className="size-11 shrink-0 rounded-full"
        >
          <Ellipsis aria-hidden className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <MenuSheetContent open={open} align="end">
        <DropdownMenuItem className={menuSheetItemClasses} onSelect={onShare}>
          <Link2 aria-hidden className={menuSheetIconClasses} />
          {t(shared ? "list.shareLink" : "list.share")}
        </DropdownMenuItem>
        <DropdownMenuItem className={menuSheetItemClasses} onSelect={onDescribe}>
          <Pencil aria-hidden className={menuSheetIconClasses} />
          {t("artist.editDescription")}
        </DropdownMenuItem>
        <p className="max-w-72 px-3 pt-2 pb-1 text-muted-foreground text-sm md:px-2.5 md:text-[13px]">
          {t("artist.favouritesFixed")}
        </p>
      </MenuSheetContent>
    </DropdownMenu>
  );
}

// Changes or clears the description of the Favourites, the one thing about them that can change.
function DescriptionDialog({
  open,
  mediaType,
  description,
  onClose,
  onSaved,
}: {
  open: boolean;
  mediaType: FavouritesMediaType;
  description: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        {open && (
          <DescriptionForm mediaType={mediaType} description={description} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DescriptionForm({
  mediaType,
  description,
  onSaved,
}: {
  mediaType: FavouritesMediaType;
  description: string | null;
  onSaved: () => Promise<void>;
}) {
  const ids = { description: useId(), hint: useId() };
  const [text, setText] = useState(description ?? "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const saved = await api.editFavourites(mediaType, text.trim() || null);
    setSaving(false);
    setFailed(!saved);
    if (saved) await onSaved();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("artist.editDescription")}</DialogTitle>
        <DialogDescription>{t("artist.favourites")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.description}>{t("artist.description")}</Label>
        <Textarea
          id={ids.description}
          rows={4}
          maxLength={maxListDescriptionLength}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby={ids.hint}
        />
        <p id={ids.hint} className="text-muted-foreground text-sm">
          {t("artist.descriptionHint")}
        </p>
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("note.unavailable")}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t("note.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {t(saving ? "note.saving" : "note.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
