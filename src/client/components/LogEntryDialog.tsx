import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import type { LogEntry } from "../../shared/api";
import { earliestLogDate, latestLogDate, maxReviewLength } from "../../shared/log";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { type Found, foundKey, foundLabel, mediaItemOf } from "../catalog/found";
import { t } from "../i18n/t";
import { RatingInput } from "./Rating";

// Marks a film search found Experienced: asks for a Rating, and optionally a date, a Review and
// whether it is a Revisit, then adds a TMDB result to the catalog and records the Log Entry, which
// takes the film off the Backlog. `found` is the film to log; the dialog is open while it is set.
// Revisit starts ticked when the User already has a Log Entry for the film.
export function LogEntryDialog({
  found,
  inLog,
  onClose,
  onLogged,
}: {
  found: Found | null;
  inLog: boolean;
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
      <DialogContent>
        {found && (
          <LogEntryForm
            key={foundKey(found)}
            title={t("logEntry.title", { film: foundLabel(found) })}
            description={t("logEntry.description")}
            initial={{ rating: null, date: "", review: "", revisit: inLog }}
            save={save}
            onSaved={(saved) => onLogged(found, saved)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Edits any field of a Log Entry. `entry` is the one to edit; the dialog is open while it is set.
export function EditLogEntryDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: LogEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const metadata = entry?.mediaItem.metadata;
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {entry && (
          <LogEntryForm
            key={entry.id}
            title={t("logEntry.editTitle", {
              film: metadata ? filmLabel(metadata) : t("film.unknown"),
            })}
            description={t("logEntry.editDescription")}
            initial={{
              rating: entry.rating,
              date: entry.date ?? "",
              review: entry.review ?? "",
              revisit: entry.revisit,
            }}
            save={(fields) => api.editLogEntry(entry.id, fields)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// What the form sends: every field, with an empty date or Review as none.
interface LogEntryFields {
  rating: number;
  date: string | null;
  timeZone: string;
  review: string | null;
  revisit: boolean;
}

interface FormValues {
  rating: number | null;
  date: string;
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

function LogEntryForm({
  title,
  description,
  initial,
  save,
  onSaved,
}: {
  title: string;
  description: string;
  initial: FormValues;
  save: (fields: LogEntryFields) => Promise<api.SaveLogEntryResult>;
  onSaved: (saved: api.SavedLogEntry) => void;
}) {
  const ids = {
    date: useId(),
    dateHint: useId(),
    review: useId(),
    revisit: useId(),
    revisitHint: useId(),
  };
  const [rating, setRating] = useState(initial.rating);
  const [date, setDate] = useState(initial.date);
  const [review, setReview] = useState(initial.review);
  const [revisit, setRevisit] = useState(initial.revisit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  // Today where the User is, which is the latest date the Worker accepts from them.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const latestDate = latestLogDate(new Date(), timeZone);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (rating === null) {
      setError("rating");
      return;
    }
    setSaving(true);
    const outcome = await save({
      rating,
      date: date || null,
      timeZone,
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
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <RatingInput
        value={rating}
        onChange={(stars) => {
          setRating(stars);
          if (error === "rating") setError(null);
        }}
        invalid={error === "rating"}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.date}>{t("logEntry.date")}</Label>
        <Input
          id={ids.date}
          type="date"
          min={earliestLogDate}
          max={latestDate}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-describedby={ids.dateHint}
          aria-invalid={
            (error !== null && error !== "rating" && error !== "unavailable") || undefined
          }
          className="w-auto"
        />
        <p id={ids.dateHint} className="text-muted-foreground text-sm">
          {t("logEntry.dateHint")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.review}>
          {t("logEntry.review")}{" "}
          <span className="font-normal text-muted-foreground">({t("logEntry.reviewHint")})</span>
        </Label>
        <Textarea
          id={ids.review}
          rows={4}
          maxLength={maxReviewLength}
          value={review}
          onChange={(event) => setReview(event.target.value)}
        />
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id={ids.revisit}
          checked={revisit}
          onCheckedChange={(checked) => setRevisit(checked === true)}
          aria-describedby={ids.revisitHint}
          className="mt-0.5"
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={ids.revisit}>{t("logEntry.revisit")}</Label>
          <p id={ids.revisitHint} className="text-muted-foreground text-sm">
            {t("logEntry.revisitHint")}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {t(errorMessages[error])}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t("logEntry.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {t(saving ? "logEntry.saving" : "logEntry.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
