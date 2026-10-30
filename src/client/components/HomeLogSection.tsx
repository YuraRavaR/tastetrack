import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import type { LogEntry } from "../../shared/api";
import * as api from "../api";
import { useMetadataFill } from "../catalog/use-metadata-fill";
import { t } from "../i18n/t";
import { FilmTitle } from "./FilmTitle";
import { LogEntryMeta } from "./LogEntryDetails";
import { Poster } from "./Poster";

type LogState =
  | { status: "loading" }
  | { status: "loaded"; entries: LogEntry[] }
  | { status: "failed" };

const shown = 5;

// Home's view of the User's Log: the last five Log Entries in Log Order, latest first, view-only,
// each film linking to its Item History, and a link to the whole Log. Its heading shows whatever
// state the Log is in.
export function HomeLogSection() {
  const headingId = useId();
  const [log, setLog] = useState<LogState>({ status: "loading" });
  const latest = log.status === "loaded" ? log.entries.slice(-shown).reverse() : [];
  const fill = useMetadataFill(latest.map((entry) => entry.mediaItem));

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
    <section aria-labelledby={headingId}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="font-semibold text-lg tracking-tight">
          {t("home.log.title")}
        </h2>
        {log.status === "loaded" && log.entries.length > 0 && (
          <Link
            to="/log"
            className="whitespace-nowrap text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("home.log.all", { count: log.entries.length })}
          </Link>
        )}
      </div>
      {log.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("log.loading")}</p>
      )}
      {log.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("log.unavailable")}
        </p>
      )}
      {log.status === "loaded" && log.entries.length === 0 && (
        <p className="rounded-lg border px-3 py-4 text-muted-foreground text-sm">
          {t("log.empty")}
        </p>
      )}
      {latest.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {latest.map((entry) => (
            <HomeLogEntry
              key={entry.id}
              entry={{ ...entry, mediaItem: fill.filled(entry.mediaItem) }}
              loading={fill.loading(entry.mediaItem)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function HomeLogEntry({ entry, loading }: { entry: LogEntry; loading: boolean }) {
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
        <LogEntryMeta entry={entry} />
      </div>
    </li>
  );
}
