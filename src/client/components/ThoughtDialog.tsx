import { Plus, Trash2, X } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
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
import type { InProgress, MediaItem, Thought } from "../../shared/api";
import {
  bookPageProblem,
  firstSeason,
  maxPage,
  type Progress,
  progressFor,
} from "../../shared/progress";
import {
  maxThoughtLength,
  maxThoughtsPerMediaItem,
  thoughtCounterFrom,
} from "../../shared/thoughts";
import * as api from "../api";
import { filmName } from "../catalog/film-label";
import { mediaItemYearAndRuntime } from "../catalog/found";
import { hasProgress, type ProgressKind } from "../catalog/media-types";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { progressLabel } from "../in-progress/progress-label";
import { userTimeZone, userToday } from "../log/user-day";
import { FormError } from "./FormError";
import { LogDateField, logDateOf, logDateValue } from "./LogDateField";
import { Poster } from "./Poster";
import { sheetClasses } from "./sheet";

// Keeps a new Thought on a Media Item, or changes one: its text, whether it is a quote, its
// Progress where the Media Type has one, and its date. A new Thought starts on today with the
// Progress of the In Progress, if any, which the User may change or remove. The dialog is open
// while `open` is set, for `thought` when it changes one; it saves only on Save.
export function ThoughtDialog({
  mediaItem,
  inProgress,
  thought,
  open,
  onClose,
  onSaved,
  onDelete,
}: {
  mediaItem: MediaItem;
  inProgress: InProgress | null;
  thought: Thought | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (thought: Thought) => void;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={sheetClasses}
        onOpenAutoFocus={(event) => {
          // The text, with the cursor at its end.
          event.preventDefault();
          const text = textRef.current;
          text?.focus();
          text?.setSelectionRange(text.value.length, text.value.length);
        }}
      >
        {open && (
          <ThoughtForm
            key={thought?.id ?? "new"}
            mediaItem={mediaItem}
            inProgress={inProgress}
            thought={thought}
            textRef={textRef}
            onSaved={onSaved}
            onDelete={thought ? () => onDelete(thought) : undefined}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Applies the Progress fields, if they are open: the Progress they hold, which is also set, or not
// ok when what they hold can't be one, which they then say.
type ApplyProgress = () => { ok: true; progress?: Progress } | { ok: false };

const dateErrors = {
  invalid_date: "logEntry.invalidDate",
  date_too_early: "logEntry.dateTooEarly",
  date_in_future: "logEntry.dateInFuture",
} as const;

function isDateError(error: api.ThoughtError | null): error is keyof typeof dateErrors {
  return error !== null && error in dateErrors;
}

function ThoughtForm({
  mediaItem,
  inProgress,
  thought,
  textRef,
  onSaved,
  onDelete,
}: {
  mediaItem: MediaItem;
  inProgress: InProgress | null;
  thought: Thought | null;
  textRef: RefObject<HTMLTextAreaElement | null>;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const { mediaType, metadata } = mediaItem;
  const ids = { text: useId(), textHint: useId(), quote: useId(), quoteHint: useId() };
  // Today where the User is, read once, as the Watched sheet does.
  const [today] = useState(userToday);
  const [text, setText] = useState(thought?.text ?? "");
  const [quote, setQuote] = useState(thought?.quote ?? false);
  const started = hasProgress(mediaType) ? progressFor(inProgress?.progress, mediaType) : null;
  const [progress, setProgress] = useState<Progress | null>(thought ? thought.progress : started);
  const [date, setDate] = useState(() => logDateValue(thought?.date ?? today, today));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<api.ThoughtError | null>(null);
  // Applies the Progress fields, if open, as Save does.
  const applyProgress = useRef<ApplyProgress>(() => ({ ok: true }));

  const length = text.trim().length;
  const tooLong = length > maxThoughtLength;

  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) bodyRef.current?.querySelector("[role=alert]")?.scrollIntoView({ block: "nearest" });
  }, [error]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (length === 0 || tooLong || saving) return;
    const applied = applyProgress.current();
    if (!applied.ok) return;
    if (date.chip === "other" && !date.otherDate) {
      setError("invalid_date");
      return;
    }
    const fields = {
      text: text.trim(),
      date: logDateOf(date, today) ?? today,
      quote,
      progress: applied.progress === undefined ? progress : applied.progress,
      timeZone: userTimeZone(),
    };
    setSaving(true);
    const saved = thought
      ? await api.editThought(thought.id, fields)
      : await api.createThought(mediaItem.id, fields);
    setSaving(false);
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 pt-4 pr-2.5 pb-1 pl-5 md:gap-3.5 md:pt-5 md:pr-3 md:pl-6">
        <Poster subject={mediaItem} size="dialog" />
        <DialogHeader className="min-w-0 flex-1 gap-0.5 text-left">
          <p className="font-semibold text-primary-strong text-xs">
            {t(thought ? "thought.editing" : "thought.new")}
          </p>
          <DialogTitle className="break-words text-xl leading-tight tracking-tight">
            {metadata ? filmName(metadata) : mediaWord(mediaType, "unknown")}
          </DialogTitle>
          <DialogDescription className="empty:hidden">
            {mediaItemYearAndRuntime(mediaItem)}
          </DialogDescription>
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
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-3.5 pb-5 md:px-6 md:pt-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.text}>{t("thought.label")}</Label>
          <Textarea
            ref={textRef}
            id={ids.text}
            placeholder={t("thought.placeholder")}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={tooLong || undefined}
            aria-describedby={length >= thoughtCounterFrom ? ids.textHint : undefined}
            className={cn(
              "min-h-37 resize-none bg-background text-[15px] md:resize-y md:text-[15px] dark:bg-background",
              quote && "italic",
            )}
          />
          {length >= thoughtCounterFrom && (
            <div
              id={ids.textHint}
              className={cn(
                "flex gap-3 text-[13px]",
                tooLong ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {tooLong && (
                <p className="flex-1">{t("thought.tooLong", { max: maxThoughtLength })}</p>
              )}
              <p className="ml-auto tabular-nums">
                {t("thought.counter", { count: length, max: maxThoughtLength })}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 border-t pt-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Label htmlFor={ids.quote}>{t("thought.quote")}</Label>
            <p id={ids.quoteHint} className="text-muted-foreground text-sm">
              {mediaWord(mediaType, "quoteHint")}
            </p>
          </div>
          <Switch
            id={ids.quote}
            checked={quote}
            onCheckedChange={setQuote}
            aria-describedby={ids.quoteHint}
          />
        </div>
        {hasProgress(mediaType) && (
          <ProgressRow
            mediaType={mediaType}
            started={started}
            value={progress}
            onChange={setProgress}
            applyRef={applyProgress}
          />
        )}
        <div className="border-t pt-4">
          <LogDateField
            required
            legend={t("logEntry.date")}
            dateLabel={t("thought.dateLabel")}
            today={today}
            value={date}
            onChange={(changed) => {
              setDate(changed);
              if (isDateError(error)) setError(null);
            }}
            error={isDateError(error) ? t(dateErrors[error]) : null}
          />
        </div>
        {error === "unavailable" && <FormError>{t("thought.saveFailed")}</FormError>}
        {error === "too_many_thoughts" && (
          <FormError>{t("thought.limit", { max: maxThoughtsPerMediaItem })}</FormError>
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
            <Trash2 aria-hidden />
            {t("logEntry.delete")}
          </Button>
        )}
        <DialogClose asChild>
          <Button type="button" variant="outline" className="hidden md:inline-flex md:h-10">
            {t("logEntry.cancel")}
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={saving || length === 0 || tooLong}
          className="order-first h-12.5 font-semibold text-base md:order-none md:h-10 md:text-sm"
        >
          {t(saving ? "logEntry.saving" : "logEntry.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

const progressWords = {
  series: {
    label: "progress.episodeNumber",
    from: "thought.fromWatching",
    add: "thought.addEpisode",
    remove: "thought.removeEpisode",
  },
  book: {
    label: "progress.page",
    from: "thought.fromReading",
    add: "thought.addPage",
    remove: "thought.removePage",
  },
} as const;

function sameProgress(a: Progress | null, b: Progress | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// What the number fields hold while they are open.
interface ProgressFields {
  season: string;
  episode: string;
  page: string;
}

const wholeNumber = /^\d+$/;

// A Thought's Progress: the episode or page it carries, filled in from the In Progress, with
// Change and × to change or remove it, or Add episode or Add page while it carries none. Change
// opens number fields in the value's place, which Done or Enter applies; nothing is saved until
// Save, which applies open fields through `applyRef` too.
function ProgressRow({
  mediaType,
  started,
  value,
  onChange,
  applyRef,
}: {
  mediaType: ProgressKind;
  started: Progress | null;
  value: Progress | null;
  onChange: (progress: Progress | null) => void;
  applyRef: RefObject<ApplyProgress>;
}) {
  const labelId = useId();
  const words = progressWords[mediaType];
  const [fields, setFields] = useState<ProgressFields | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const lastField = useRef<HTMLInputElement>(null);

  const fieldsOpen = fields !== null;
  useEffect(() => {
    if (fieldsOpen) lastField.current?.focus();
  }, [fieldsOpen]);

  function open(progress: Progress | null) {
    setProblem(null);
    setFields({
      season: progress?.mediaType === "series" ? String(progress.season) : "",
      episode: progress?.mediaType === "series" ? String(progress.episode) : "",
      page: progress?.mediaType === "book" ? String(progress.page) : "",
    });
  }

  // The Progress the fields hold, or the reason they can't be one.
  function read(held: ProgressFields): Progress | string {
    if (mediaType === "series") {
      const { season, episode } = held;
      if (!wholeNumber.test(season) || !wholeNumber.test(episode) || Number(season) < firstSeason) {
        return t("thought.invalidEpisode");
      }
      return { mediaType, season: Number(season), episode: Number(episode) };
    }
    // The page count the value was filled in with, or the In Progress's.
    const counted = value?.mediaType === "book" ? value : started;
    const pageCount = counted?.mediaType === "book" ? counted.pageCount : undefined;
    const page = wholeNumber.test(held.page) ? Number(held.page) : Number.NaN;
    const book = { mediaType, page, ...(pageCount === undefined ? {} : { pageCount }) } as const;
    const found = bookPageProblem(book);
    if (found === "past_last_page") return t("progress.pastLastPage", { page, count: pageCount });
    if (found) return t("progress.pageOutOfRange", { max: maxPage });
    return book;
  }

  function apply(): ReturnType<ApplyProgress> {
    if (!fields) return { ok: true };
    const progress = read(fields);
    if (typeof progress === "string") {
      setProblem(progress);
      return { ok: false };
    }
    onChange(progress);
    setFields(null);
    return { ok: true, progress };
  }
  applyRef.current = apply;

  function onEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    apply();
  }

  const fromInProgress = started !== null && sameProgress(value, started);
  let hint: string | null = null;
  if (fields) {
    if (started?.mediaType === "book" && started.pageCount !== undefined) {
      hint = t("thought.fromReadingOf", { page: started.page, count: started.pageCount });
    } else if (started) hint = t(words.from);
  } else if (value === null) hint = t("thought.noProgress");
  else if (fromInProgress) hint = t(words.from);

  const numberField = (name: keyof ProgressFields, label: string, last: boolean) => (
    <Input
      ref={last ? lastField : undefined}
      aria-label={label}
      inputMode="numeric"
      value={fields?.[name] ?? ""}
      onChange={(event) => {
        setProblem(null);
        setFields((current) => current && { ...current, [name]: event.target.value });
      }}
      onKeyDown={onEnter}
      aria-invalid={problem !== null || undefined}
      className="h-11 w-18 text-center font-semibold text-base tabular-nums"
    />
  );

  return (
    <fieldset aria-labelledby={labelId} className="flex flex-col gap-2 border-t pt-4">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id={labelId} className="font-medium text-sm leading-none">
            {t(words.label)}
          </span>
          {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
        </div>
        {fields ? (
          <>
            {mediaType === "series" && numberField("season", t("progress.season"), false)}
            {mediaType === "series"
              ? numberField("episode", t("progress.episodeNumber"), true)
              : numberField("page", t("progress.page"), true)}
            <Button type="button" variant="outline" className="h-11" onClick={apply}>
              {t("thought.done")}
            </Button>
          </>
        ) : value ? (
          <>
            <span className="font-bold text-[17px] tabular-nums">{progressLabel(value)}</span>
            <Button type="button" variant="ghost" className="h-11" onClick={() => open(value)}>
              {t("thought.change")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 text-muted-foreground"
              aria-label={t(words.remove)}
              title={t(words.remove)}
              onClick={() => onChange(null)}
            >
              <X aria-hidden className="size-5" />
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" className="h-11" onClick={() => open(null)}>
            <Plus aria-hidden />
            {t(words.add)}
          </Button>
        )}
      </div>
      {problem && (
        <p role="alert" className="text-destructive text-sm">
          {problem}
        </p>
      )}
    </fieldset>
  );
}
