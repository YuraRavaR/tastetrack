import {
  ArrowLeft,
  ArrowRight,
  ArrowUpToLine,
  Ellipsis,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useState } from "react";
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
  onMove: (position: number) => void;
  onNote: () => void;
  onRemove: () => void;
};

// One film in a List's grid of posters (`docs/mockups/collections/`): its place, poster, title and
// year, which open the film's page; a ⋯ menu over the poster's corner to note, move or remove it;
// and its Note under it, cut at three lines, which opens the Note too.
export function ListPoster(props: ListPosterProps) {
  const { item, loading, place, onNote } = props;
  const year = item.mediaItem.metadata?.year ?? null;
  return (
    <PosterGridItem
      mediaItem={item.mediaItem}
      loading={loading}
      meta={year !== null ? String(year) : undefined}
      place={place}
      corner={<PosterMenu {...props} />}
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

// The ⋯ over a poster's corner and its menu: a bottom sheet on a phone, headed by the film and its
// place, and a dropdown from `md`.
function PosterMenu({ item, place, listName, last, onMove, onNote, onRemove }: ListPosterProps) {
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
          className={menuSheetItemClasses}
          disabled={first}
          onSelect={() => onMove(item.position - 1)}
        >
          <ArrowLeft aria-hidden className={menuSheetIconClasses} />
          {t("listItem.moveEarlier")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuSheetItemClasses}
          disabled={last}
          onSelect={() => onMove(item.position + 1)}
        >
          <ArrowRight aria-hidden className={menuSheetIconClasses} />
          {t("listItem.moveLater")}
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
