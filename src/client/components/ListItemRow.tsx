import { ArrowDown, ArrowUp, ArrowUpToLine } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import type { ListItem } from "../../shared/api";
import { filmLabel } from "../catalog/film-label";
import { t } from "../i18n/t";
import { FilmFacts, FilmTitle } from "./FilmTitle";
import { Poster } from "./Poster";

export function listItemLabel(item: ListItem): string {
  const metadata = item.mediaItem.metadata;
  return metadata ? filmLabel(metadata) : t("film.unknown");
}

// One film of a List or the Watchlist, with its runtime, genres and Note, and buttons to move, note or remove it.
export function ListItemRow({
  item,
  loading,
  first,
  last,
  onMove,
  onNote,
  onRemove,
}: {
  item: ListItem;
  // True while the page loads the film's metadata.
  loading: boolean;
  first: boolean;
  last: boolean;
  onMove: (position: number) => void;
  onNote: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-3 py-3">
      <div className="flex gap-3">
        <Poster item={item.mediaItem} size="thumbnail" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Link
            to={`/items/${item.mediaItem.id}`}
            className="underline-offset-4 hover:underline focus-visible:underline"
          >
            <FilmTitle metadata={item.mediaItem.metadata} loading={loading} />
          </Link>
          <FilmFacts metadata={item.mediaItem.metadata} />
          {item.note && <p className="whitespace-pre-line break-words text-sm">{item.note}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("listItem.moveToTop")}
          title={t("listItem.moveToTop")}
          disabled={first}
          onClick={() => onMove(0)}
        >
          <ArrowUpToLine aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("listItem.moveUp")}
          title={t("listItem.moveUp")}
          disabled={first}
          onClick={() => onMove(item.position - 1)}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("listItem.moveDown")}
          title={t("listItem.moveDown")}
          disabled={last}
          onClick={() => onMove(item.position + 1)}
        >
          <ArrowDown aria-hidden />
        </Button>
        <Button variant="outline" size="sm" onClick={onNote}>
          {t(item.note ? "listItem.editNote" : "listItem.addNote")}
        </Button>
        <Button variant="outline" size="sm" onClick={onRemove}>
          {t("listItem.remove")}
        </Button>
      </div>
    </li>
  );
}
