import { BookOpen, Check, Pencil, X } from "lucide-react";
import { type FormEvent, useState } from "react";
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
import type { InProgress } from "../../shared/api";
import * as api from "../api";
import type { ProgressMediaType } from "../catalog/media-types";
import { progressWord } from "../i18n/media-words";
import { formatCalendarDate, t } from "../i18n/t";
import { userTimeZone, userToday } from "../log/user-day";
import { LogDateField, type LogDateValue, logDateOf, logDateValue } from "./LogDateField";
import { sheetClasses } from "./sheet";

// The card a Media Item's page shows while the User has it In Progress (`docs/mockups/books/`):
// since when, with a button that changes the start date, then Finished, which `onFinish` takes
// to the Log Entry dialog, and Stop reading, which `onStop` handles. `onChanged` reloads the page
// after a new start date.
export function InProgressCard({
  mediaType,
  mediaItemId,
  inProgress,
  stopping,
  onFinish,
  onStop,
  onChanged,
}: {
  mediaType: ProgressMediaType;
  mediaItemId: number;
  inProgress: InProgress;
  stopping: boolean;
  onFinish: () => void;
  onStop: () => void;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const name = progressWord(mediaType, "inProgress");
  return (
    <section
      aria-label={name}
      className="flex flex-col gap-3.5 rounded-xl border border-primary-strong bg-primary-soft p-3.5 sm:gap-4 sm:p-4"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary-strong">
          <BookOpen aria-hidden className="size-5.5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="font-bold">{name}</p>
          {inProgress.startDate && (
            <p className="text-muted-foreground text-sm">
              {t("inProgress.since", { date: formatCalendarDate(inProgress.startDate) })}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 text-muted-foreground sm:size-9"
          aria-label={t("inProgress.changeStartDate")}
          title={t("inProgress.changeStartDate")}
          onClick={() => setEditing(true)}
        >
          <Pencil aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button className="h-12 font-semibold text-base sm:h-10 sm:text-sm" onClick={onFinish}>
          <Check aria-hidden />
          {progressWord(mediaType, "finish")}
        </Button>
        <Button
          variant="outline"
          className="h-12 bg-card text-base sm:h-10 sm:text-sm"
          disabled={stopping}
          onClick={onStop}
        >
          {progressWord(mediaType, "stop")}
        </Button>
      </div>
      <StartDateDialog
        open={editing}
        mediaItemId={mediaItemId}
        startDate={inProgress.startDate}
        onClose={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          await onChanged();
        }}
      />
    </section>
  );
}

const errorMessages = {
  invalid_date: "logEntry.invalidDate",
  date_too_early: "logEntry.dateTooEarly",
  date_in_future: "logEntry.dateInFuture",
  unavailable: "inProgress.unavailable",
} as const;

// Changes or clears the start date, with the date chips of a Log Entry: a sheet on a phone, a
// centred dialog from `md`.
function StartDateDialog({
  open,
  mediaItemId,
  startDate,
  onClose,
  onSaved,
}: {
  open: boolean;
  mediaItemId: number;
  startDate: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className={sheetClasses}>
        {open && (
          <StartDateForm mediaItemId={mediaItemId} startDate={startDate} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StartDateForm({
  mediaItemId,
  startDate,
  onSaved,
}: {
  mediaItemId: number;
  startDate: string | null;
  onSaved: () => Promise<void>;
}) {
  // Read once, as the Log Entry form does, so the day doesn't change while the form is open.
  const [today] = useState(userToday);
  const [value, setValue] = useState<LogDateValue>(() => logDateValue(startDate, today));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<api.LogEntryError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (value.chip === "other" && !value.otherDate) {
      setError("invalid_date");
      return;
    }
    setSaving(true);
    const outcome = await api.changeStartDate(mediaItemId, {
      startDate: logDateOf(value, today),
      timeZone: userTimeZone(),
    });
    if (!outcome.ok) {
      setSaving(false);
      setError(outcome.error);
      return;
    }
    await onSaved();
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 pt-4 pr-2.5 pb-1 pl-5 md:pt-5 md:pr-3 md:pl-6">
        <DialogHeader className="min-w-0 flex-1 gap-0.5 text-left">
          <DialogTitle className="text-xl leading-tight tracking-tight">
            {t("inProgress.changeStartDate")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("inProgress.startDate")}</DialogDescription>
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
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-3.5 pb-5 md:px-6 md:pt-4">
        <LogDateField
          legend={t("inProgress.startDate")}
          dateLabel={t("inProgress.startDate")}
          today={today}
          value={value}
          onChange={(changed) => {
            setValue(changed);
            if (error && error !== "unavailable") setError(null);
          }}
          error={error && error !== "unavailable" ? t(errorMessages[error]) : null}
        />
        {error === "unavailable" && (
          <p role="alert" className="text-destructive text-sm">
            {t(errorMessages.unavailable)}
          </p>
        )}
      </div>
      <DialogFooter className="flex-col gap-2 border-t px-5 pt-3 pb-[calc(0.75rem+max(1.375rem,env(safe-area-inset-bottom)))] sm:flex-col md:flex-row md:items-center md:justify-end md:gap-3 md:px-6 md:pt-4 md:pb-5">
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
          {t(saving ? "inProgress.saving" : "inProgress.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
