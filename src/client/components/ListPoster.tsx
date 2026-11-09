import {
  ArrowUpToLine,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  type LucideIcon,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ListItem } from "../../shared/api";
import { filmLabel } from "../catalog/film-label";
import { t } from "../i18n/t";
import { MenuSheetContent, menuSheetIconClasses, menuSheetItemClasses } from "./MenuSheetContent";
import { Poster } from "./Poster";
import { PosterGridItem } from "./PosterGridItem";

export function listItemLabel(item: ListItem): string {
  const metadata = item.mediaItem.metadata;
  return metadata ? filmLabel(metadata) : t("film.unknown");
}

type ListPosterProps = {
  item: ListItem;
  // True while the page loads the film's metadata.
  loading: boolean;
  // 1 for the first film.
  place: number;
  listName: string;
  last: boolean;
  // True while the User reorders the List: arrows over the poster replace its link and ⋯.
  reordering: boolean;
  // Moves the film to `position`, counted from 0, and settles once the List shows the new order.
  onMove: (position: number) => Promise<void>;
  onNote: () => void;
  onRemove: () => void;
};

// One film in a List's grid of posters (`docs/mockups/collections/`): its place, poster, title and
// year, which open the film's page; a ⋯ menu over the poster's corner to note, move to the top or
// remove it; and its Note under it, cut at three lines, which opens the Note too. While the User
// reorders the List, arrows over the poster move it instead.
export function ListPoster(props: ListPosterProps) {
  const { item, loading, place, reordering, onNote } = props;
  const year = item.mediaItem.metadata?.year ?? null;
  return (
    <PosterGridItem
      mediaItem={item.mediaItem}
      loading={loading}
      meta={year !== null ? String(year) : undefined}
      place={place}
      corner={reordering ? undefined : <PosterMenu {...props} />}
      overlay={reordering ? <MoveArrows {...props} /> : undefined}
    >
      {item.note && (
        <Button
          variant="ghost"
          aria-label={t("listItem.noteButton", { film: listItemLabel(item), note: item.note })}
          onClick={onNote}
          className="-mx-1 h-auto min-h-11 items-start justify-start gap-1.25 whitespace-normal rounded-t-none border-t px-1 py-1.5 text-left font-normal text-muted-foreground md:-mx-1.5 md:min-h-0 md:gap-1.5 md:px-1.5 md:py-2"
        >
          <MessageSquare aria-hidden className="mt-0.5 size-3 shrink-0" strokeWidth={2} />
          <span className="line-clamp-3 whitespace-pre-line break-words text-xs italic leading-[1.35] md:text-[13px] md:leading-[1.4]">
            {item.note}
          </span>
        </Button>
      )}
    </PosterGridItem>
  );
}

type Arrow = "top" | "earlier" | "later";

// Each arrow's name, which says which film it moves, and its tooltip.
const arrowLabels = {
  top: ["listItem.moveFilmToTop", "listItem.moveToTop"],
  earlier: ["listItem.moveFilmEarlier", "listItem.moveEarlier"],
  later: ["listItem.moveFilmLater", "listItem.moveLater"],
} as const;

// The three arrows over a poster while the User reorders the List: Move to top in the top right
// corner, Move earlier and Move later at the bottom, each off where it would go past an end. A
// moved poster changes place in the page, which can take the keyboard's focus from the arrow, and
// an arrow that reached an end goes off and drops it. So once the List shows the move, the arrow
// gets the focus back, or if it went off, the arrow that moves the other way.
function MoveArrows({ item, place, last, onMove }: ListPosterProps) {
  const film = listItemLabel(item);
  const first = place === 1;
  const buttons = useRef<Partial<Record<Arrow, HTMLButtonElement | null>>>({});
  const [refocus, setRefocus] = useState<Arrow | null>(null);

  useEffect(() => {
    if (!refocus) return;
    setRefocus(null);
    const order: Arrow[] = [refocus, "later", "earlier"];
    order
      .map((arrow) => buttons.current[arrow])
      .find((button) => button && !button.disabled)
      ?.focus();
  }, [refocus]);

  const arrow = (name: Arrow, Icon: LucideIcon, disabled: boolean, position: number) => {
    const [label, title] = arrowLabels[name];
    return (
      <Button
        ref={(button) => {
          buttons.current[name] = button;
        }}
        variant="ghost"
        size="icon"
        aria-label={t(label, { film })}
        title={t(title)}
        disabled={disabled}
        onClick={async (event) => {
          const focused = document.activeElement === event.currentTarget;
          await onMove(position);
          if (focused) setRefocus(name);
        }}
        className="size-11 rounded-lg text-overlay-foreground hover:bg-transparent hover:text-overlay-foreground disabled:opacity-35 dark:hover:bg-transparent"
      >
        <Icon aria-hidden className="size-5.5" strokeWidth={2.5} />
      </Button>
    );
  };

  return (
    <span className="absolute inset-0 flex flex-col justify-between rounded-lg bg-overlay outline-2 outline-primary outline-offset-2">
      <span className="flex justify-end">{arrow("top", ArrowUpToLine, first, 0)}</span>
      <span className="flex justify-between">
        {arrow("earlier", ChevronLeft, first, item.position - 1)}
        {arrow("later", ChevronRight, last, item.position + 1)}
      </span>
    </span>
  );
}

// The ⋯ over a poster's corner and its menu: a bottom sheet on a phone, headed by the film and its
// place, and a dropdown from `md`.
function PosterMenu({ item, place, listName, onMove, onNote, onRemove }: ListPosterProps) {
  const film = listItemLabel(item);
  const [open, setOpen] = useState(false);
  const first = place === 1;
  const metadata = item.mediaItem.metadata;
  const year = metadata?.year ?? null;
  const placeLine =
    year !== null
      ? t("listItem.placeWithYear", { year: String(year), place, list: listName })
      : t("listItem.place", { place, list: listName });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label={t("listItem.more", { film })}
          title={t("listItem.more", { film })}
          className="size-11 items-start justify-end rounded-lg p-1.25 hover:bg-transparent md:p-1.5 dark:hover:bg-transparent"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-overlay text-overlay-foreground md:size-7.5">
            <Ellipsis aria-hidden className="size-4" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <MenuSheetContent open={open} align="end">
        <DropdownMenuLabel className="mb-1.5 flex items-center gap-3 border-b px-3 pt-1 pb-3 font-normal md:hidden">
          <Poster subject={item.mediaItem} size="dialog" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-semibold text-[17px]">
              {metadata?.title ?? t("film.unknown")}
            </span>
            <span className="truncate text-[13px] text-muted-foreground">{placeLine}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuItem className={menuSheetItemClasses} onSelect={onNote}>
          <MessageSquare aria-hidden className={menuSheetIconClasses} />
          {t(item.note ? "listItem.editNote" : "listItem.addNote")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuSheetItemClasses}
          disabled={first}
          onSelect={() => onMove(0)}
        >
          <ArrowUpToLine aria-hidden className={menuSheetIconClasses} />
          {t("listItem.moveToTop")}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          className={menuSheetItemClasses}
          onSelect={onRemove}
        >
          <Trash2 aria-hidden className={menuSheetIconClasses} />
          {t("listItem.remove")}
        </DropdownMenuItem>
      </MenuSheetContent>
    </DropdownMenu>
  );
}
