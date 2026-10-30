import { Badge } from "@/components/ui/badge";
import type { LogEntry } from "../../shared/api";
import { formatCalendarDate, t } from "../i18n/t";
import { RatingStars } from "./Rating";

// A Log Entry's date as the UI shows it, whether or not it has one.
export function logEntryDateLabel(entry: LogEntry): string {
  return entry.date ? formatCalendarDate(entry.date) : t("logEntry.noDate");
}

// A Log Entry's Rating, date and Revisit mark on one line.
export function LogEntryMeta({ entry }: { entry: LogEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
      <RatingStars rating={entry.rating} />
      <span>{logEntryDateLabel(entry)}</span>
      {entry.revisit && <Badge variant="secondary">{t("logEntry.revisit")}</Badge>}
    </div>
  );
}

// A Log Entry's meta line, and its Review below.
export function LogEntryDetails({ entry }: { entry: LogEntry }) {
  return (
    <>
      <LogEntryMeta entry={entry} />
      {entry.review && <p className="whitespace-pre-line break-words text-sm">{entry.review}</p>}
    </>
  );
}
