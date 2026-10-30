import { Star, X } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { LogEntry, MediaItem, MediaType } from "../../shared/api";
import { earliestLogDate, latestLogDate, maxReviewLength } from "../../shared/log";
import * as api from "../api";
import { filmName, filmYearAndRuntime } from "../catalog/film-label";
import {
  type Found,
  foundKey,
  foundMediaType,
  foundName,
  foundYearAndRuntime,
  mediaItemOf,
} from "../catalog/found";
import { mediaWord } from "../i18n/media-words";
import { formatCalendarDate, t } from "../i18n/t";
import { type DateChip, dateChipFor, dateChips, dateOfChip } from "../log/date-chips";
import { Poster } from "./Poster";
import { RatingInput } from "./Rating";

// A bottom sheet below `md`, with no swipe to close, and a centred dialog from `md`. Its form's
// body scrolls between a header and a footer that stay put.
const sheetClasses =
  "top-auto bottom-0 left-0 flex max-h-[calc(100dvh-3rem)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-sheet rounded-b-none border-x-0 border-b-0 p-0 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:slide-in-from-bottom-8 sm:max-w-none md:top-[72px] md:bottom-auto md:left-[50%] md:max-h-[calc(100dvh-9rem)] md:w-[calc(100%-2rem)] md:max-w-[480px] md:translate-x-[-50%] md:rounded-lg md:border md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-bottom-0";

const userTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const userToday = () => latestLogDate(new Date(), userTimeZone());

// A new Log Entry's form: a Revisit when the User already has a Log Entry for the film.
const newEntry = (inLog: boolean): FormValues => ({
  rating: null,
  date: userToday(),
  review: "",
  revisit: inLog,
});

// What the form warns of when saving takes the film off the Backlog.
function backlogHint(mediaType: MediaType, inBacklog: boolean): string | null {
  return inBacklog
    ? t("logEntry.backlogHint", { backlogName: mediaWord(mediaType, "backlog") })
    : null;
}

// The last of a Media Item's Log Entries, from its Item History once that has loaded. When it
// doesn't load, the form only goes without the hint it is for.
function useLastLogEntry(mediaItemId: number | null): LogEntry | null {
  const [last, setLast] = useState<LogEntry | null>(null);
  useEffect(() => {
    if (mediaItemId === null) return;
    let cancelled = false;
    api.fetchItemHistory(mediaItemId).then(
      (history) => {
        if (!cancelled) setLast(history?.logEntries.at(-1) ?? null);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [mediaItemId]);
  return last;
}

// The Rating and date of the User's last Log Entry for the film, beside the new Rating's legend.
function LastTime({ entry }: { entry: LogEntry }) {
  return (
    <span className="flex items-center gap-1 font-normal text-muted-foreground text-xs">
      {t("logEntry.lastTime")} <Star aria-hidden className="size-3 fill-current" />
      {entry.date
        ? t("logEntry.lastRatingAndDate", {
            rating: entry.rating,
            date: formatCalendarDate(entry.date),
          })
        : t("rating.value", { stars: entry.rating })}
    </span>
  );
}

// Marks a film search found Experienced: asks for a Rating, and optionally a date, a Review and
// whether it is a Revisit, then adds a TMDB result to the catalog and records the Log Entry, which
// takes the film off the Backlog. `found` is the film to log; the dialog is open while it is set.
// For a film in the Log, with its Media Item as `mediaItemId`, Revisit starts on and the form says
// what the User gave it last time.
export function LogEntryDialog({
  found,
  mediaItemId,
  inLog,
  inBacklog,
  onClose,
  onLogged,
}: {
  found: Found | null;
  mediaItemId: number | null;
  inLog: boolean;
  inBacklog: boolean;
  onClose: () => void;
  onLogged: (found: Found, saved: api.SavedLogEntry) => void;
}) {
  async function save(fields: LogEntryFields): Promise<api.SaveLogEntryResult> {
    if (!found) throw new Error("Saving a Log Entry with no film to log");
    const mediaItem = await mediaItemOf(found);
    if (!mediaItem) return { ok: false, error: "unavailable" };
    return api.createLogEntry({ mediaItemId: mediaItem.id, ...fields });
  }

  return (
    <Dialog open={found !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className={sheetClasses}>
        {found && (
          <LogEntryForm
            key={foundKey(found)}
            subject={found}
            mediaType={foundMediaType(found)}
            title={foundName(found)}
            yearAndRuntime={foundYearAndRuntime(found)}
            initial={newEntry(inLog)}
            loggedMediaItemId={inLog ? mediaItemId : null}
            hint={backlogHint(foundMediaType(found), inBacklog)}
            save={save}
            onSaved={(saved) => onLogged(found, saved)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Marks a film Experienced from its page, as LogEntryDialog does from search, for a Media Item that
// is already in the catalog. The dialog is open while `open` is set.
export function MediaItemLogEntryDialog({
  mediaItem,
  open,
  inLog,
  inBacklog,
  onClose,
  onLogged,
}: {
  mediaItem: MediaItem;
  open: boolean;
  inLog: boolean;
  inBacklog: boolean;
  onClose: () => void;
  onLogged: (saved: api.SavedLogEntry) => void;
}) {
  const { metadata, mediaType } = mediaItem;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className={sheetClasses}>
        <LogEntryForm
          subject={mediaItem}
          mediaType={mediaType}
          title={metadata ? filmName(metadata) : t("film.unknown")}
          yearAndRuntime={metadata ? filmYearAndRuntime(metadata) : null}
          initial={newEntry(inLog)}
          loggedMediaItemId={inLog ? mediaItem.id : null}
          hint={backlogHint(mediaType, inBacklog)}
          save={(fields) => api.createLogEntry({ mediaItemId: mediaItem.id, ...fields })}
          onSaved={onLogged}
        />
      </DialogContent>
    </Dialog>
  );
}

// Edits any field of a Log Entry, or hands it over to be deleted. `entry` is the one to edit; the
// dialog is open while it is set.
export function EditLogEntryDialog({
  entry,
  onClose,
  onSaved,
  onDelete,
}: {
  entry: LogEntry | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const metadata = entry?.mediaItem.metadata;
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className={sheetClasses}>
        {entry && (
          <LogEntryForm
            key={entry.id}
            subject={entry.mediaItem}
            mediaType={entry.mediaItem.mediaType}
            title={t("logEntry.editTitle", {
              film: metadata ? filmName(metadata) : t("film.unknown"),
            })}
            yearAndRuntime={metadata ? filmYearAndRuntime(metadata) : null}
            initial={{
              rating: entry.rating,
              date: entry.date,
              review: entry.review ?? "",
              revisit: entry.revisit,
            }}
            save={(fields) => api.editLogEntry(entry.id, fields)}
            onSaved={onSaved}
            onDelete={onDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// What the form sends: every field, with an empty Review as none.
interface LogEntryFields {
  rating: number;
  date: string | null;
  timeZone: string;
  review: string | null;
  revisit: boolean;
}

interface FormValues {
  rating: number | null;
  date: string | null;
  review: string;
  revisit: boolean;
}

type FormError = "rating" | api.LogEntryError;

const errorMessages = {
  rating: "logEntry.ratingRequired",
  invalid_date: "logEntry.invalidDate",
  date_too_early: "logEntry.dateTooEarly",
  date_in_future: "logEntry.dateInFuture",
  unavailable: "logEntry.unavailable",
} as const;

const chipLabels = {
  today: "logEntry.today",
  yesterday: "logEntry.yesterday",
  other: "logEntry.otherDate",
  none: "logEntry.noDate",
} as const;

function LogEntryForm<Saved>({
  subject,
  mediaType,
  title,
  yearAndRuntime,
  initial,
  loggedMediaItemId = null,
  hint = null,
  save,
  onSaved,
  onDelete,
}: {
  subject: MediaItem | Found;
  mediaType: MediaType;
  title: string;
  yearAndRuntime: string | null;
  initial: FormValues;
  // The film's Media Item, when this is another Log Entry for a film in the Log.
  loggedMediaItemId?: number | null;
  hint?: string | null;
  save: (fields: LogEntryFields) => Promise<api.SaveLogEntryResult<Saved>>;
  onSaved: (saved: { ok: true } & Saved) => void;
  onDelete?: () => void;
}) {
  const ids = { review: useId(), revisit: useId(), revisitHint: useId() };
  // Today where the User is, which is the latest date the Worker accepts from them. It is read once,
  // so an entry opened before midnight doesn't change day when it is saved after.
  const [today] = useState(userToday);
  const [rating, setRating] = useState(initial.rating);
  const [chip, setChip] = useState(() => dateChipFor(initial.date, today));
  const [otherDate, setOtherDate] = useState(() => (chip === "other" ? (initial.date ?? "") : ""));
  const [review, setReview] = useState(initial.review);
  const [revisit, setRevisit] = useState(initial.revisit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const lastEntry = useLastLogEntry(loggedMediaItemId);
  const dateError =
    error === "invalid_date" || error === "date_too_early" || error === "date_in_future";

  // An error can be scrolled out of the body, as the footer stays put.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) bodyRef.current?.querySelector("[role=alert]")?.scrollIntoView({ block: "nearest" });
  }, [error]);

  function pickChip(picked: DateChip) {
    setChip(picked);
    if (dateError) setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (rating === null) {
      setError("rating");
      return;
    }
    if (chip === "other" && !otherDate) {
      setError("invalid_date");
      return;
    }
    setSaving(true);
    const outcome = await save({
      rating,
      date: dateOfChip(chip, today, otherDate),
      timeZone: userTimeZone(),
      review: review.trim() || null,
      revisit,
    });
    setSaving(false);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    onSaved(outcome);
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 pt-4 pr-2.5 pb-1 pl-5 md:gap-3.5 md:pt-5 md:pr-3 md:pl-6">
        <Poster subject={subject} size="dialog" />
        <DialogHeader className="min-w-0 flex-1 gap-0.5 text-left">
          <p className="font-semibold text-primary-strong text-xs">
            {mediaWord(mediaType, loggedMediaItemId === null ? "experienced" : "experiencedAgain")}
          </p>
          <DialogTitle className="break-words text-xl leading-tight tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="empty:hidden">{yearAndRuntime}</DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 self-start rounded-full text-muted-foreground md:size-10 md:rounded-md"
            aria-label={t("dialog.close")}
            title={t("dialog.close")}
          >
            <X aria-hidden className="size-5" />
          </Button>
        </DialogClose>
      </div>
      <div
        ref={bodyRef}
        className="flex min-h-0 flex-1 flex-col gap-5.5 overflow-y-auto px-5 pt-3.5 pb-5 md:gap-5 md:px-6 md:pt-4"
      >
        <RatingInput
          value={rating}
          onChange={(stars) => {
            setRating(stars);
            if (error === "rating") setError(null);
          }}
          hint={lastEntry && <LastTime entry={lastEntry} />}
          error={error === "rating" ? t(errorMessages.rating) : null}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium text-sm">
            {t("logEntry.date")}{" "}
            <span className="font-normal text-muted-foreground">{t("logEntry.optional")}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {dateChips.map((option) => (
              <Button
                key={option}
                type="button"
                variant={chip === option ? "pressed" : "outline"}
                aria-pressed={chip === option}
                className={cn(
                  "h-11 rounded-full px-3.5 font-normal md:h-9",
                  chip === option && "font-semibold text-foreground",
                )}
                onClick={() => pickChip(option)}
              >
                {t(chipLabels[option])}
              </Button>
            ))}
          </div>
          {chip === "other" && (
            <Input
              type="date"
              aria-label={mediaWord(mediaType, "dateExperienced")}
              min={earliestLogDate}
              max={today}
              value={otherDate}
              onChange={(event) => {
                setOtherDate(event.target.value);
                if (dateError) setError(null);
              }}
              aria-invalid={dateError || undefined}
              className="h-11 w-auto self-start md:h-10"
            />
          )}
          {dateError && (
            <p role="alert" className="text-destructive text-sm">
              {t(errorMessages[error])}
            </p>
          )}
        </fieldset>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.review} className="gap-1">
            {t("logEntry.review")}
            <span className="font-normal text-muted-foreground">{t("logEntry.optional")}</span>
          </Label>
          <Textarea
            id={ids.review}
            rows={4}
            maxLength={maxReviewLength}
            placeholder={t("logEntry.reviewPrompt")}
            value={review}
            onChange={(event) => setReview(event.target.value)}
            className="min-h-27 resize-none md:resize-y"
          />
        </div>
        <div className="flex items-center gap-3 border-t pt-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Label htmlFor={ids.revisit}>{t("logEntry.revisit")}</Label>
            <p id={ids.revisitHint} className="text-muted-foreground text-sm">
              {t("logEntry.revisitHint")}
            </p>
          </div>
          <Switch
            id={ids.revisit}
            checked={revisit}
            onCheckedChange={setRevisit}
            aria-describedby={ids.revisitHint}
          />
        </div>
        {error === "unavailable" && (
          <p role="alert" className="text-destructive text-sm">
            {t(errorMessages.unavailable)}
          </p>
        )}
      </div>
      <DialogFooter className="flex-col gap-2 border-t px-5 pt-3 pb-[calc(0.75rem+max(1.375rem,env(safe-area-inset-bottom)))] sm:flex-col md:flex-row md:items-center md:gap-3 md:px-6 md:pt-4 md:pb-5">
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            className="h-11 text-destructive hover:text-destructive md:mr-auto md:h-10"
            onClick={onDelete}
          >
            {t("logEntry.delete")}
          </Button>
        )}
        {hint && (
          <p className="text-center text-muted-foreground text-xs md:flex-1 md:text-left">{hint}</p>
        )}
        <DialogClose asChild>
          <Button type="button" variant="outline" className="hidden md:inline-flex md:h-10">
            {t("logEntry.cancel")}
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={saving}
          className="order-first h-12.5 font-semibold text-base md:order-none md:h-10 md:text-sm"
        >
          {t(saving ? "logEntry.saving" : "logEntry.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
