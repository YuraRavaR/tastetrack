import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ItemHistoryResponse } from "../../shared/api";
import { firstLogDate } from "../../shared/log";
import { mediaWord } from "../i18n/media-words";
import { formatCalendarDate, t } from "../i18n/t";
import { RatingValue } from "./Rating";

function Stat({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border bg-card px-3 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn("flex min-h-7 items-center font-semibold", className)}>{children}</dd>
    </div>
  );
}

// The three tiles that open a film's page once it has Log Entries: how often the User experienced
// it, their Current Rating, and when they first did. A tile with nothing to say stays, so the row
// always has three.
export function ItemHistoryStats({ history }: { history: ItemHistoryResponse }) {
  const { mediaItem, logEntries, currentRating } = history;
  const firstDate = firstLogDate(logEntries);
  return (
    <dl className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-3">
      <Stat label={mediaWord(mediaItem.mediaType, "experienced")} className="text-lg">
        {t("itemHistory.experiencedCount", { count: logEntries.length })}
      </Stat>
      <Stat label={t("itemHistory.yourRating")} className="text-lg">
        {currentRating !== null && <RatingValue rating={currentRating} />}
      </Stat>
      <Stat
        label={mediaWord(mediaItem.mediaType, "firstExperienced")}
        className="whitespace-nowrap text-sm sm:text-base"
      >
        {firstDate ? (
          formatCalendarDate(firstDate)
        ) : (
          <span role="img" aria-label={t("logEntry.noDate")}>
            {t("itemHistory.noFirstDate")}
          </span>
        )}
      </Stat>
    </dl>
  );
}
