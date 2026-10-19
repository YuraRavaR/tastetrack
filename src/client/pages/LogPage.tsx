import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { LogEntry } from "../../shared/api";
import * as api from "../api";
import { FilmTitle } from "../components/FilmTitle";
import { Poster } from "../components/Poster";
import { RatingStars } from "../components/Rating";
import { formatCalendarDate, t } from "../i18n/t";

type LogState =
  | { status: "loading" }
  | { status: "loaded"; entries: LogEntry[] }
  | { status: "failed" };

// The User's Log, in Log Order as the API gives it.
export function LogPage() {
  const [log, setLog] = useState<LogState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    api
      .fetchLog()
      .then((entries) => {
        if (!cancelled) setLog({ status: "loaded", entries });
      })
      .catch(() => {
        if (!cancelled) setLog({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold text-2xl tracking-tight">{t("log.title")}</h1>
      {log.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("log.loading")}</p>
      )}
      {log.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("log.unavailable")}
        </p>
      )}
      {log.status === "loaded" && log.entries.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("log.empty")}</p>
      )}
      {log.status === "loaded" && log.entries.length > 0 && (
        <ul aria-label={t("log.listLabel")} className="flex flex-col divide-y rounded-lg border">
          {log.entries.map((entry) => (
            <LogEntryItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LogEntryItem({ entry }: { entry: LogEntry }) {
  return (
    <li className="flex gap-3 px-3 py-3">
      <Poster url={entry.mediaItem.metadata?.posterUrl ?? null} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <FilmTitle metadata={entry.mediaItem.metadata} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
          <RatingStars rating={entry.rating} />
          <span>{entry.date ? formatCalendarDate(entry.date) : t("logEntry.noDate")}</span>
          {entry.revisit && <Badge variant="secondary">{t("logEntry.revisit")}</Badge>}
        </div>
        {entry.review && <p className="whitespace-pre-line break-words text-sm">{entry.review}</p>}
      </div>
    </li>
  );
}
