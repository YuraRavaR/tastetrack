import { ChevronDown, ChevronUp, Ellipsis, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ListItem } from "../../shared/api";
import { mediaItemFacts, mediaItemLabel } from "../catalog/artist-label";
import { t } from "../i18n/t";
import { itemPath } from "../navigation/paths";
import { MenuSheetContent, menuSheetIconClasses, menuSheetItemClasses } from "./MenuSheetContent";
import { Poster } from "./Poster";

// A place in a ranking (`docs/mockups/artists/`): bold and tabular, the top three in
// `primary-strong`.
export function Place({ place, className }: { place: number; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 text-center font-bold tabular-nums",
        place <= 3 ? "text-primary-strong" : "text-muted-foreground",
        className,
      )}
    >
      {place}
    </span>
  );
}

// One artist in Favourite artists (`docs/mockups/artists/`, "Favourite artists"): their place,
// round photo, name, facts and Note, then ↑ and ↓, always there, the first's ↑ and the last's ↓
// off, and the row's ⋯, which notes them or takes them out. The name opens their page and
// stretches over the row; the buttons sit above it.
export function FavouriteRow({
  item,
  place,
  last,
  onMove,
  onNote,
  onRemove,
}: {
  item: ListItem;
  place: number;
  last: boolean;
  onMove: (position: number) => Promise<void>;
  onNote: () => void;
  onRemove: () => void;
}) {
  const name = mediaItemLabel(item.mediaItem);
  const facts = mediaItemFacts(item.mediaItem);
  return (
    <li className="relative flex min-h-20 items-center gap-2.5 py-2.5 pr-1.5 pl-2 md:gap-3.5 md:pl-3">
      <Place place={place} className="w-7 text-xl" />
      <Poster subject={item.mediaItem} size="ranked" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          to={itemPath(item.mediaItem.id)}
          className="break-words font-semibold underline-offset-4 after:absolute after:inset-0 hover:underline focus-visible:underline"
        >
          {name}
        </Link>
        {facts && <span className="break-words text-muted-foreground text-sm">{facts}</span>}
        {item.note && (
          <span className="flex items-start gap-1.5 break-words text-muted-foreground text-sm">
            <MessageSquare aria-hidden className="mt-0.75 size-3.5 shrink-0" />
            {item.note}
          </span>
        )}
      </div>
      <span className="relative flex shrink-0 flex-col">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("artist.moveUp", { name })}
          title={t("artist.moveUp", { name })}
          disabled={place === 1}
          className="h-9 w-11 disabled:opacity-35"
          onClick={() => onMove(item.position - 1)}
        >
          <ChevronUp aria-hidden className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("artist.moveDown", { name })}
          title={t("artist.moveDown", { name })}
          disabled={last}
          className="h-9 w-11 disabled:opacity-35"
          onClick={() => onMove(item.position + 1)}
        >
          <ChevronDown aria-hidden className="size-5" />
        </Button>
      </span>
      <RowMenu name={name} noted={item.note !== null} onNote={onNote} onRemove={onRemove} />
    </li>
  );
}

// A row's ⋯: Add or Edit Note, and Remove from Favourites. A bottom sheet on a phone, a dropdown
// from `md`.
function RowMenu({
  name,
  noted,
  onNote,
  onRemove,
}: {
  name: string;
  noted: boolean;
  onNote: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("listItem.more", { film: name })}
          title={t("listItem.more", { film: name })}
          className="relative size-11 shrink-0"
        >
          <Ellipsis aria-hidden className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <MenuSheetContent open={open} align="end">
        <DropdownMenuItem className={menuSheetItemClasses} onSelect={onNote}>
          <MessageSquare aria-hidden className={menuSheetIconClasses} />
          {t(noted ? "listItem.editNote" : "listItem.addNote")}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          className={menuSheetItemClasses}
          onSelect={onRemove}
        >
          <Trash2 aria-hidden className={menuSheetIconClasses} />
          {t("artist.unlike")}
        </DropdownMenuItem>
      </MenuSheetContent>
    </DropdownMenu>
  );
}
