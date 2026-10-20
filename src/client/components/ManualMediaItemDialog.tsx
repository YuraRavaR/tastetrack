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
import type { MediaItem } from "../../shared/api";
import {
  earliestFilmYear,
  type FilmGenre,
  filmGenres,
  filmRuntime,
  latestFilmYear,
  maxManualMediaItems,
  maxManualTitleLength,
} from "../../shared/catalog";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { t } from "../i18n/t";

// Adds a film by hand as a Manual Media Item, starting from `title`, or edits `mediaItem` when it
// is given. The dialog is open while `open` is set, and stays open until the film is saved.
export function ManualMediaItemDialog({
  open,
  title,
  mediaItem,
  onClose,
  onSaved,
}: {
  open: boolean;
  title?: string;
  mediaItem?: MediaItem;
  onClose: () => void;
  onSaved: (mediaItem: MediaItem) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {open && <ManualMediaItemForm title={title} mediaItem={mediaItem} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

const errorMessages = {
  possible_duplicate: "manualItem.possibleDuplicate",
  too_many_manual_media_items: "manualItem.tooMany",
  invalid_request: "manualItem.invalid",
  unavailable: "manualItem.unavailable",
} as const;

// A number field's value, or null when it is empty.
function numberOf(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function ManualMediaItemForm({
  title: initialTitle = "",
  mediaItem,
  onSaved,
}: {
  title?: string;
  mediaItem?: MediaItem;
  onSaved: (mediaItem: MediaItem) => void;
}) {
  const ids = {
    title: useId(),
    originalTitle: useId(),
    originalTitleHint: useId(),
    year: useId(),
    runtime: useId(),
    genres: useId(),
    error: useId(),
  };
  const metadata = mediaItem?.metadata;
  const [title, setTitle] = useState(metadata?.title ?? initialTitle);
  // The title stands in for an Original Title the film doesn't have, so it shows as none here.
  const [originalTitle, setOriginalTitle] = useState(
    metadata && metadata.originalTitle !== metadata.title ? metadata.originalTitle : "",
  );
  const [year, setYear] = useState(metadata?.year?.toString() ?? "");
  const [runtime, setRuntime] = useState(metadata?.runtime?.toString() ?? "");
  const [genres, setGenres] = useState<ReadonlySet<string>>(new Set(metadata?.genres));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<api.ManualMediaItemError | null>(null);
  // Once warned of a possible duplicate, sending the same title and year again makes it anyway.
  const warned = error === "possible_duplicate";

  function toggleGenre(genre: FilmGenre, checked: boolean) {
    setGenres((current) => {
      const next = new Set(current);
      if (checked) next.add(genre);
      else next.delete(genre);
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const fields = {
      title: title.trim(),
      originalTitle: originalTitle.trim() || null,
      year: numberOf(year),
      runtime: numberOf(runtime),
      genres: filmGenres.filter((genre) => genres.has(genre)),
    };
    const saved = mediaItem
      ? await api.editManualMediaItem(mediaItem.id, fields)
      : await api.createManualMediaItem({ mediaType: "film", ...fields, allowDuplicate: warned });
    setSaving(false);
    setError(saved.ok ? null : saved.error);
    if (saved.ok) onSaved(saved.mediaItem);
  }

  // Changing the title or year is another film, which may not be a duplicate.
  function clearWarning() {
    if (warned) setError(null);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>
          {metadata
            ? t("manualItem.editTitle", { film: filmLabel(metadata) })
            : t("manualItem.newTitle")}
        </DialogTitle>
        <DialogDescription>
          {t(metadata ? "manualItem.editDescription" : "manualItem.newDescription")}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.title}>{t("manualItem.title")}</Label>
        <Input
          id={ids.title}
          required
          autoComplete="off"
          maxLength={maxManualTitleLength}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            clearWarning();
          }}
          aria-describedby={error ? ids.error : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.originalTitle}>
          {t("manualItem.originalTitle")}{" "}
          <span className="font-normal text-muted-foreground">({t("manualItem.optional")})</span>
        </Label>
        <Input
          id={ids.originalTitle}
          autoComplete="off"
          maxLength={maxManualTitleLength}
          value={originalTitle}
          onChange={(event) => setOriginalTitle(event.target.value)}
          aria-describedby={ids.originalTitleHint}
        />
        <p id={ids.originalTitleHint} className="text-muted-foreground text-sm">
          {t("manualItem.originalTitleHint")}
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.year}>
            {t("manualItem.year")}{" "}
            <span className="font-normal text-muted-foreground">({t("manualItem.optional")})</span>
          </Label>
          <Input
            id={ids.year}
            type="number"
            inputMode="numeric"
            min={earliestFilmYear}
            max={latestFilmYear(new Date())}
            step={1}
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              clearWarning();
            }}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.runtime}>
            {t("manualItem.runtime")}{" "}
            <span className="font-normal text-muted-foreground">({t("manualItem.optional")})</span>
          </Label>
          <Input
            id={ids.runtime}
            type="number"
            inputMode="numeric"
            min={filmRuntime.min}
            max={filmRuntime.max}
            step={1}
            value={runtime}
            onChange={(event) => setRuntime(event.target.value)}
            className="w-28"
          />
        </div>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-medium text-sm">
          {t("manualItem.genres")}{" "}
          <span className="font-normal text-muted-foreground">({t("manualItem.optional")})</span>
        </legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {filmGenres.map((genre) => {
            const id = `${ids.genres}-${genre}`;
            return (
              <div key={genre} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={genres.has(genre)}
                  onCheckedChange={(checked) => toggleGenre(genre, checked === true)}
                />
                <Label htmlFor={id} className="font-normal">
                  {t(`genre.${genre}`)}
                </Label>
              </div>
            );
          })}
        </div>
      </fieldset>
      {error && (
        <p id={ids.error} role="alert" className={warned ? "text-sm" : "text-destructive text-sm"}>
          {t(errorMessages[error], { max: maxManualMediaItems })}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t("manualItem.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {mediaItem
            ? t(saving ? "manualItem.saving" : "manualItem.save")
            : t(saving ? "manualItem.adding" : warned ? "manualItem.addAnyway" : "manualItem.add")}
        </Button>
      </DialogFooter>
    </form>
  );
}
