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
import type { CatalogSearchResult } from "../../shared/api";
import { earliestLogDate, latestLogDate, maxReviewLength } from "../../shared/log";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { t } from "../i18n/t";
import { RatingInput } from "./Rating";

// Marks a search result Experienced: asks for a Rating, and optionally a date, a Review and
// whether it is a Revisit, then adds the film to the catalog and records the Log Entry. `result`
// is the film to log; the dialog is open while it is set.
export function LogEntryDialog({
  result,
  onClose,
  onLogged,
}: {
  result: CatalogSearchResult | null;
  onClose: () => void;
  onLogged: (result: CatalogSearchResult) => void;
}) {
  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {result && (
          <LogEntryForm
            key={`${result.externalReference.source}:${result.externalReference.id}`}
            result={result}
            onLogged={onLogged}
          />
        )}
      </DialogContent>
    </Dialog>
  );
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
  result,
  onLogged,
}: {
  result: CatalogSearchResult;
  onLogged: (result: CatalogSearchResult) => void;
}) {
  const ids = {
    date: useId(),
    dateHint: useId(),
    review: useId(),
    revisit: useId(),
    revisitHint: useId(),
  };
  const [rating, setRating] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [review, setReview] = useState("");
  const [revisit, setRevisit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  // Today where the User is, which is the latest date the Worker accepts from them.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const latestDate = latestLogDate(new Date(), timeZone);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (rating === null) {
      setError("rating");
      return;
    }
    setSaving(true);
    const mediaItem = await api.addToCatalog(result);
    const outcome = mediaItem
      ? await api.createLogEntry({
          mediaItemId: mediaItem.id,
          rating,
          date: date || null,
          timeZone,
          review: review.trim() || null,
          revisit,
        })
      : ({ ok: false, error: "unavailable" } as const);
    setSaving(false);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    onLogged(result);
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("logEntry.title", { film: filmLabel(result) })}</DialogTitle>
        <DialogDescription>{t("logEntry.description")}</DialogDescription>
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
