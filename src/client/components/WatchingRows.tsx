import { Check } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import type { LibraryItem, RemovedListItem } from "../../shared/api";
import { progressFor } from "../../shared/progress";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { mediaWord, progressWord } from "../i18n/media-words";
import { formatNearCalendarDate, t, tRich } from "../i18n/t";
import { useSeriesProgress } from "../in-progress/use-series-progress";
import { type Series, watchingOf } from "../in-progress/watching";
import { userToday } from "../log/user-day";
import { itemPath } from "../navigation/paths";
import { MediaItemLogEntryDialog } from "./LogEntryDialog";
import { Poster } from "./Poster";
import { EpisodeMeter } from "./ProgressMeter";
import { episodeLabel } from "./SeriesProgress";
import { type FilmAction, FilmActionMessage, Toast } from "./Toast";

// A series' Library item.
type SeriesInProgress = LibraryItem & { mediaItem: Series };

function isSeries(item: LibraryItem): item is SeriesInProgress {
  return item.mediaItem.mediaType === "series";
}

function labelOf({ metadata }: Series): string {
  return metadata ? filmLabel(metadata) : mediaWord("series", "unknown");
}

// What the toast under the rows says: a save that failed, or what followed from Finished.
type ToastContent = { series: Series } & (
  | { kind: "saveFailed" }
  | { kind: "action"; action: FilmAction }
);

// The series a User is watching, one row each (`docs/mockups/series-progress/`), on Saved under
// the `heading` "Watching now" and on the Watching tab, as the list named `label`: one column on a
// phone, two from `md`. Finished opens the Log Entry dialog, and `onChanged` reloads the rows once
// a series has left them. With no series it shows nothing but its toast, which outlives the last
// row, so it stays on the page while the rows may come and go.
export function WatchingRows({
  items,
  label,
  heading,
  onChanged,
}: {
  items: readonly LibraryItem[];
  label?: string;
  heading?: string;
  onChanged: () => Promise<void>;
}) {
  const headingId = useId();
  const [finishing, setFinishing] = useState<SeriesInProgress | null>(null);
  const [said, setSaid] = useState<ToastContent | null>(null);

  async function logged(item: SeriesInProgress, saved: api.SavedLogEntry) {
    setFinishing(null);
    await onChanged();
    const { removedFromBacklog } = saved;
    setSaid({
      series: item.mediaItem,
      kind: "action",
      action: { kind: "logged", mediaItemId: item.mediaItem.id, removedFromBacklog },
    });
  }

  // Puts a series back on the Watchlist where it was, when finishing it took it off.
  async function undo(series: Series, removed: RemovedListItem) {
    const outcome = await api.plan({ mediaItemId: series.id, ...removed });
    if (outcome.ok) await onChanged();
    setSaid(outcome.ok ? { series, kind: "action", action: { kind: "putBack" } } : null);
  }

  const series = items.filter(isSeries);
  const rows = series.length > 0 && (
    <ul aria-label={label} className="grid gap-2.5 md:grid-cols-2 md:gap-3">
      {series.map((item) => (
        <WatchingRow
          key={item.mediaItem.id}
          item={item}
          onFinish={() => setFinishing(item)}
          onFailed={() => setSaid({ series: item.mediaItem, kind: "saveFailed" })}
        />
      ))}
    </ul>
  );
  return (
    <>
      {rows && heading ? (
        <section aria-labelledby={headingId} className="flex flex-col gap-3 md:gap-3.5">
          <h2 id={headingId} className="font-semibold text-xl tracking-tight">
            {heading}
          </h2>
          {rows}
        </section>
      ) : (
        rows
      )}
      {finishing && (
        <MediaItemLogEntryDialog
          mediaItem={finishing.mediaItem}
          open
          inLog={finishing.log !== null}
          inBacklog={finishing.backlog !== null}
          finishing
          onClose={() => setFinishing(null)}
          onLogged={(saved) => logged(finishing, saved)}
        />
      )}
      <Toast onDismiss={() => setSaid(null)}>
        {said &&
          (said.kind === "saveFailed" ? (
            <p>{t("progress.saveFailed", { film: labelOf(said.series) })}</p>
          ) : (
            <FilmActionMessage
              action={said.action}
              film={labelOf(said.series)}
              mediaType="series"
              onUndo={(_, removed) => undo(said.series, removed)}
            />
          ))}
      </Toast>
    </>
  );
}

const strong = (text: ReactNode) => (
  <b key="strong" className="font-semibold text-foreground">
    {text}
  </b>
);

// One series: a link to its page (its poster, title, what comes next and the bar) and, behind a
// divider, the check that marks the next episode watched, or Finished once the User is caught up.
// The link and the button are siblings, so a tap on the check never opens the page. A series
// that lists no seasons, as one added by hand, has no bar and is never caught up.
function WatchingRow({
  item,
  onFinish,
  onFailed,
}: {
  item: SeriesInProgress;
  onFinish: () => void;
  onFailed: () => void;
}) {
  const { mediaItem, inProgress } = item;
  const saved = progressFor(inProgress?.progress, "series");
  const { progress, markWatched } = useSeriesProgress(mediaItem.id, saved, onFailed);
  const { next, airs, meter } = watchingOf(mediaItem, progress);
  // The zone behind the divider, as tall as the row.
  const zone = "h-auto min-w-16 rounded-none border-l px-2.5 md:min-w-17 md:px-3.5";
  const title = mediaItem.metadata?.title ?? mediaWord("series", "unknown");
  return (
    <li className="flex items-stretch overflow-hidden rounded-xl border bg-card has-[a:hover]:border-muted-foreground">
      <Link
        to={itemPath(mediaItem.id)}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1.5 pl-2.5 outline-none focus-visible:bg-accent md:gap-3.5 md:pr-2"
      >
        <Poster subject={mediaItem} size="thumbnail" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-semibold">{title}</span>
          <span className="text-[0.8125rem] text-muted-foreground leading-tight md:text-sm">
            {next && tRich("progress.nextEpisode", { episode: episodeLabel(next), b: strong })}
            {!next && !airs && strong(t("progress.caughtUp"))}
            {!next &&
              airs &&
              tRich("progress.caughtUpUntil", {
                episode: episodeLabel(airs.episode),
                date: formatNearCalendarDate(airs.date, userToday()),
                b: strong,
              })}
          </span>
          {meter && <EpisodeMeter {...meter} size="row" />}
        </span>
      </Link>
      {next ? (
        <Button
          variant="ghost"
          className={zone}
          aria-label={t("progress.markFilmWatched", { episode: episodeLabel(next), film: title })}
          title={t("progress.markWatched", { episode: episodeLabel(next) })}
          onClick={() => markWatched(next)}
        >
          <span className="flex size-10 items-center justify-center rounded-full border-[1.5px] border-primary-strong text-primary-strong">
            <Check aria-hidden className="size-5.5" />
          </span>
        </Button>
      ) : (
        <Button
          variant="ghost"
          className={zone}
          aria-label={t("progress.finishFilm", { film: title })}
          onClick={onFinish}
        >
          <span className="flex h-9 items-center rounded-full bg-primary px-3.5 font-semibold text-primary-foreground text-sm">
            {progressWord("series", "finish")}
          </span>
        </Button>
      )}
    </li>
  );
}
