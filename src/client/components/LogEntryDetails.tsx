import { Badge } from "@/components/ui/badge";
import type { LogEntry } from "../../shared/api";
import { formatCalendarDate, t } from "../i18n/t";
import { RatingStars } from "./Rating";

// A Log Entry's Rating, date and Revisit mark on one line, and its Review below.
export function LogEntryDetails({ entry }: { entry: LogEntry }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
        <RatingStars rating={entry.rating} />
        <span>{entry.date ? formatCalendarDate(entry.date) : t("logEntry.noDate")}</span>
        {entry.revisit && <Badge variant="secondary">{t("logEntry.revisit")}</Badge>}
      </div>
      {entry.review && <p className="whitespace-pre-line break-words text-sm">{entry.review}</p>}
    </>
  );
}
