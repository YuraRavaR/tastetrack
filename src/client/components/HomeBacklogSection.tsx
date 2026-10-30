import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import type { Backlog, ListItem } from "../../shared/api";
import * as api from "../api";
import { useMetadataFill } from "../catalog/use-metadata-fill";
import { mediaWord, pageMediaType } from "../i18n/media-words";
import { t } from "../i18n/t";
import { FilmFacts, FilmTitle } from "./FilmTitle";
import { Poster } from "./Poster";

type BacklogState =
  | { status: "loading" }
  | { status: "loaded"; backlog: Backlog }
  | { status: "failed" };

const shown = 5;

// Home's view of the User's Backlog: its first five films in their saved order, view-only, each
// linking to its Item History, and a link to the whole Watchlist. Its heading shows whatever state
// the Backlog is in.
export function HomeBacklogSection() {
  const backlogName = mediaWord(pageMediaType, "backlog");
  const headingId = useId();
  const [state, setState] = useState<BacklogState>({ status: "loading" });
  const next = state.status === "loaded" ? state.backlog.items.slice(0, shown) : [];
  const fill = useMetadataFill(next.map((item) => item.mediaItem));

  useEffect(() => {
    let cancelled = false;
    api
      .fetchBacklog()
      .then((backlog) => {
        if (!cancelled) setState({ status: "loaded", backlog });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="font-semibold text-lg tracking-tight">
          {t("home.backlog.title", { backlogName })}
        </h2>
        {state.status === "loaded" && state.backlog.items.length > 0 && (
          <Link
            to="/watchlist"
            className="whitespace-nowrap text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("home.backlog.all", { backlogName, count: state.backlog.items.length })}
          </Link>
        )}
      </div>
      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("backlog.loading", { backlogName })}</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("backlog.unavailable", { backlogName })}
        </p>
      )}
      {state.status === "loaded" && state.backlog.items.length === 0 && (
        <p className="rounded-lg border px-3 py-4 text-muted-foreground text-sm">
          {t("backlog.empty", { backlogName })}
        </p>
      )}
      {next.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {next.map((item) => (
            <HomeBacklogItem
              key={item.id}
              item={{ ...item, mediaItem: fill.filled(item.mediaItem) }}
              loading={fill.loading(item.mediaItem)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function HomeBacklogItem({ item, loading }: { item: ListItem; loading: boolean }) {
  return (
    <li className="flex gap-3 px-3 py-3">
      <Poster item={item.mediaItem} size="thumbnail" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link
          to={`/items/${item.mediaItem.id}`}
          className="underline-offset-4 hover:underline focus-visible:underline"
        >
          <FilmTitle metadata={item.mediaItem.metadata} loading={loading} />
        </Link>
        <FilmFacts metadata={item.mediaItem.metadata} />
        {item.note && <p className="truncate text-sm">{item.note}</p>}
      </div>
    </li>
  );
}
