import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InProgress } from "../../shared/api";
import { type Episode, firstSeason, progressFor, type SeriesProgress } from "../../shared/progress";
import { formatCalendarDate, t } from "../i18n/t";
import { useSeriesProgress } from "../in-progress/use-series-progress";
import {
  lastWatched,
  type Series,
  stepEpisode,
  stepSeason,
  watchingOf,
} from "../in-progress/watching";
import { EpisodeMeter } from "./ProgressMeter";

// An episode in short, "S2 · E9".
export function episodeLabel({ season, episode }: Episode): string {
  return t("progress.episode", { season, episode });
}

// How long the picker waits after the User's last tap before saving, so a run of taps is one
// write.
const pickerDelay = 1000;

// What a series' Watching card holds between its heading and its buttons
// (`docs/mockups/series-progress/`): the next episode with the check that marks it watched, or
// "Caught up" with the day the next one airs, over the bar; and the picker, two steppers that set
// the last episode watched by hand. `onChange` tells the page the User changed their Progress,
// and `onFailed` that saving it failed, after which the card shows what was last saved.
export function SeriesProgressPanel({
  series,
  inProgress,
  onChange,
  onFailed,
}: {
  series: Series;
  inProgress: InProgress;
  onChange: () => void;
  onFailed: () => void;
}) {
  const saved = progressFor(inProgress?.progress, "series");
  const { progress, change, markWatched } = useSeriesProgress(series.id, saved, onFailed);
  const { next, airs, meter } = watchingOf(series, progress);
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
      <div className="flex flex-col justify-center gap-2.5 rounded-xl border bg-card p-3 sm:p-3.5">
        {next ? (
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-[0.8125rem] text-muted-foreground">{t("progress.next")}</span>
              <span className="font-bold text-[1.1875rem] tracking-tight sm:text-xl">
                {episodeLabel(next)}
              </span>
              <span className="text-muted-foreground text-sm">
                {next.seasonLength === null
                  ? t("progress.episodeInFull", { ...next })
                  : t("progress.episodeInFullOf", { ...next, count: next.seasonLength })}
              </span>
            </div>
            <Button
              size="icon"
              className="ml-auto size-13 rounded-full sm:size-12"
              aria-label={t("progress.markWatched", { episode: episodeLabel(next) })}
              title={t("progress.markWatched", { episode: episodeLabel(next) })}
              onClick={() => {
                onChange();
                markWatched(next);
              }}
            >
              <Check aria-hidden className="size-6.5" strokeWidth={2.4} />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="font-bold text-[1.1875rem] tracking-tight sm:text-xl">
              {t("progress.caughtUp")}
            </span>
            {airs && (
              <span className="text-muted-foreground text-sm">
                {t("progress.airs", {
                  episode: episodeLabel(airs.episode),
                  date: formatCalendarDate(airs.date),
                })}
              </span>
            )}
          </div>
        )}
        {meter && <EpisodeMeter {...meter} size="card" />}
      </div>
      <LastWatchedPicker
        className="justify-center"
        progress={progress}
        onChange={(next) => {
          onChange();
          change(next, pickerDelay);
        }}
      />
    </div>
  );
}

// The picker: two steppers that set the last episode watched, on a series' Watching card and in
// Watch more. Season starts at 1 and Episode at 0, none of that season watched; neither has an
// upper end.
export function LastWatchedPicker({
  progress,
  className,
  onChange,
}: {
  progress: SeriesProgress | null;
  className?: string;
  onChange: (progress: SeriesProgress) => void;
}) {
  const last = lastWatched(progress);
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-2", className)}>
      <legend className="mb-2 font-semibold text-[0.8125rem] text-muted-foreground">
        {t("progress.lastWatched")}
      </legend>
      <Stepper
        name={t("progress.season")}
        value={last.season}
        atStart={last.season <= firstSeason}
        previous={t("progress.previousSeason")}
        next={t("progress.nextSeason")}
        onStep={(by) => onChange(stepSeason(progress, by))}
      />
      <Stepper
        name={t("progress.episodeNumber")}
        value={last.episode}
        atStart={last.episode <= 0}
        previous={t("progress.previousEpisode")}
        next={t("progress.nextEpisodeNumber")}
        onStep={(by) => onChange(stepEpisode(progress, by))}
      />
    </fieldset>
  );
}

// A number with a button either side of it. It has no upper end.
function Stepper({
  name,
  value,
  atStart,
  previous,
  next,
  onStep,
}: {
  name: string;
  value: number;
  atStart: boolean;
  previous: string;
  next: string;
  onStep: (by: 1 | -1) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 text-[0.9375rem]">
      <span>{name}</span>
      <span className="flex items-center overflow-hidden rounded-xl border bg-background">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-none sm:size-10"
          aria-label={previous}
          title={previous}
          disabled={atStart}
          onClick={() => onStep(-1)}
        >
          <Minus aria-hidden />
        </Button>
        <output aria-label={name} className="min-w-10 text-center font-bold text-base">
          {value}
        </output>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-none sm:size-10"
          aria-label={next}
          title={next}
          onClick={() => onStep(1)}
        >
          <Plus aria-hidden />
        </Button>
      </span>
    </div>
  );
}
