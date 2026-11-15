import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { SeriesProgress } from "../../shared/progress";
import { filmName } from "../catalog/film-label";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { latestSeason, nextEpisodeOf, type Series, startOfSeason } from "../in-progress/watching";
import { episodeLabel, LastWatchedPicker } from "./SeriesProgress";
import {
  SheetHeader,
  sheetButtonClasses,
  sheetClasses,
  sheetMainButtonClasses,
  sheetSafeBottomClasses,
} from "./sheet";

// Where to start: the latest season, the first, or the User's own last episode watched.
type WatchMoreChoice = "latest" | "start" | "own";

// Where Watch more starts a series the User has already logged (`docs/mockups/series-progress/`):
// from its latest season, chosen when it opens, from the start, or from the User's own last
// episode watched. A series that lists no season after its first, as a manual one, offers only the
// last two. `onStart` gets the Progress to start with, null for the start.
export function WatchMoreDialog({
  series,
  open,
  onClose,
  onStart,
}: {
  series: Series;
  open: boolean;
  onClose: () => void;
  onStart: (progress: SeriesProgress | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className={sheetClasses}>
        {open && <WatchMoreForm series={series} onStart={onStart} />}
      </DialogContent>
    </Dialog>
  );
}

function WatchMoreForm({
  series,
  onStart,
}: {
  series: Series;
  onStart: (progress: SeriesProgress | null) => void;
}) {
  const latest = latestSeason(series);
  const [choice, setChoice] = useState<WatchMoreChoice>(latest === null ? "start" : "latest");
  const [ownProgress, setOwnProgress] = useState<SeriesProgress | null>(null);

  const progressOf: Record<WatchMoreChoice, SeriesProgress | null> = {
    latest: latest === null ? null : startOfSeason(latest),
    start: null,
    own: ownProgress,
  };

  // What a choice says it starts at: its next episode, or Caught up past all the series lists.
  function startsAt(progress: SeriesProgress | null): string {
    const next = nextEpisodeOf(series, progress);
    return next ? t("watchMore.next", { episode: episodeLabel(next) }) : t("progress.caughtUp");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onStart(progressOf[choice]);
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader
        title={t("watchMore.title")}
        description={series.metadata ? filmName(series.metadata) : mediaWord("series", "unknown")}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-3.5 pb-5 md:px-6 md:pb-5.5">
        <RadioGroup
          aria-label={t("watchMore.where")}
          value={choice}
          onValueChange={(value) => setChoice(value as WatchMoreChoice)}
          className="gap-2"
        >
          {latest !== null && (
            <WatchMoreOption
              value="latest"
              chosen={choice}
              label={t("watchMore.fromSeason", { season: latest })}
              hint={startsAt(progressOf.latest)}
            />
          )}
          <WatchMoreOption
            value="start"
            chosen={choice}
            label={t("watchMore.fromStart")}
            hint={startsAt(null)}
          />
          <WatchMoreOption
            value="own"
            chosen={choice}
            label={t("watchMore.own")}
            hint={choice === "own" ? startsAt(ownProgress) : t("watchMore.ownHint")}
          />
        </RadioGroup>
        {choice === "own" && (
          <LastWatchedPicker
            className="mt-3 px-0.5"
            progress={ownProgress}
            onChange={setOwnProgress}
          />
        )}
      </div>
      <DialogFooter
        className={cn(
          "flex-col gap-2 border-t px-5 pt-3 sm:flex-col md:flex-row md:items-center md:justify-end md:gap-3 md:px-6 md:pt-4 md:pb-4",
          sheetSafeBottomClasses,
        )}
      >
        <DialogClose asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(sheetButtonClasses, "hidden md:inline-flex")}
          >
            {t("logEntry.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" className={sheetMainButtonClasses}>
          {t("watchMore.start")}
        </Button>
      </DialogFooter>
    </form>
  );
}

// One place to start: a row with its radio, its name and the episode it starts at, the whole row
// a target. The chosen one is drawn in the primary colours.
function WatchMoreOption({
  value,
  chosen,
  label,
  hint,
}: {
  value: WatchMoreChoice;
  chosen: WatchMoreChoice;
  label: string;
  hint: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={`${id}-radio`}
      className={cn(
        "flex min-h-15 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2 md:min-h-14",
        value === chosen && "border-primary-strong bg-primary-soft",
      )}
    >
      <RadioGroupItem
        id={`${id}-radio`}
        value={value}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
      />
      <span className="flex min-w-0 flex-col gap-px">
        <span id={`${id}-label`} className="font-semibold text-base">
          {label}
        </span>
        <span id={`${id}-hint`} className="text-[0.8125rem] text-muted-foreground">
          {hint}
        </span>
      </span>
    </label>
  );
}
