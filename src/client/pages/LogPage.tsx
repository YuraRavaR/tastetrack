import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { LogEntry } from "../../shared/api";
import * as api from "../api";
import { useMetadataFill } from "../catalog/use-metadata-fill";
import { FilmTitle } from "../components/FilmTitle";
import { LogEntryDetails } from "../components/LogEntryDetails";
import { Poster } from "../components/Poster";
import { t } from "../i18n/t";

type LogState =
  | { status: "loading" }
  | { status: "loaded"; entries: LogEntry[] }
  | { status: "failed" };

// The User's Log, in Log Order as the API gives it. Each film links to its Item History.
export function LogPage() {
  const [log, setLog] = useState<LogState>({ status: "loading" });
  const fill = useMetadataFill(
    log.status === "loaded" ? log.entries.map((entry) => entry.mediaItem) : [],
  );

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
            <LogEntryItem
              key={entry.id}
              entry={{ ...entry, mediaItem: fill.filled(entry.mediaItem) }}
              loading={fill.loading(entry.mediaItem)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function LogEntryItem({ entry, loading }: { entry: LogEntry; loading: boolean }) {
  return (
    <li className="flex gap-3 px-3 py-3">
      <Poster subject={entry.mediaItem} size="thumbnail" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link
          to={`/items/${entry.mediaItem.id}`}
          className="underline-offset-4 hover:underline focus-visible:underline"
        >
          <FilmTitle metadata={entry.mediaItem.metadata} loading={loading} />
        </Link>
        <LogEntryDetails entry={entry} />
      </div>
    </li>
  );
}
