import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LogEntry } from "../../shared/api";
import { t } from "../i18n/t";
import { logEntryDateLabel } from "./LogEntryDetails";
import { RatingStars } from "./Rating";

// One compact row of an Item History: the date, Rating and Revisit mark, the start of the Review,
// and a "⋯" menu to edit or delete the Log Entry.
export function ItemHistoryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: LogEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const date = logEntryDateLabel(entry);
  return (
    <li className="flex items-center gap-2 py-2 pr-1 pl-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
          <span className="font-medium">{date}</span>
          <RatingStars rating={entry.rating} />
          {entry.revisit && <Badge variant="secondary">{t("logEntry.revisit")}</Badge>}
        </div>
        {entry.review && <p className="truncate text-muted-foreground text-sm">{entry.review}</p>}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground"
            aria-label={t("logEntry.actions", { date })}
          >
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-42">
          <DropdownMenuItem className="min-h-11" onSelect={onEdit}>
            <Pencil aria-hidden />
            {t("logEntry.edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={onDelete}>
            <Trash2 aria-hidden />
            {t("logEntry.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
