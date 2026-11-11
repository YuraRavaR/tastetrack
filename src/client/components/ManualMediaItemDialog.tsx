import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MediaItem, MediaType } from "../../shared/api";
import {
  earliestBookYear,
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
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import {
  SheetFooter,
  SheetHeader,
  sheetBodyClasses,
  sheetButtonClasses,
  sheetClasses,
  sheetMainButtonClasses,
} from "./sheet";

// The item to edit, or the Media Type of a new one, which starts from a title.
type Editing = { mediaItem: MediaItem } | { mediaType: MediaType; title?: string };

// Adds a film or a book by hand as a Manual Media Item, or edits one, in a sheet on a phone and a
// centred dialog from `md`. The dialog is open while `open` is set, and stays open until the item
// is saved.
export function ManualMediaItemDialog({
  open,
  onClose,
  onSaved,
  ...editing
}: Editing & {
  open: boolean;
  onClose: () => void;
  onSaved: (mediaItem: MediaItem) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className={sheetClasses}>
        {open && <ManualMediaItemForm editing={editing} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

// What the dialog says when the Worker refuses the item.
function errorMessage(error: api.ManualMediaItemError, mediaType: MediaType): string {
  switch (error) {
    case "possible_duplicate":
      return mediaWord(mediaType, "manualDuplicate");
    case "invalid_request":
      return mediaWord(mediaType, "manualInvalid");
    case "too_many_manual_media_items":
      return t("manualItem.tooMany", { max: maxManualMediaItems });
    case "unavailable":
      return t("manualItem.unavailable");
  }
}

// The authors typed in one field, separated by commas.
function authorsOf(value: string): string[] {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
}

// A number field's value, or null when it is empty.
function numberOf(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function ManualMediaItemForm({
  editing,
  onSaved,
}: {
  editing: Editing;
  onSaved: (mediaItem: MediaItem) => void;
}) {
  const ids = {
    title: useId(),
    originalTitle: useId(),
    originalTitleHint: useId(),
    year: useId(),
    runtime: useId(),
    genres: useId(),
    authors: useId(),
    authorsHint: useId(),
    error: useId(),
  };
  const mediaItem = "mediaItem" in editing ? editing.mediaItem : null;
  const mediaType = mediaItem
    ? mediaItem.mediaType
    : (editing as { mediaType: MediaType }).mediaType;
  const metadata = mediaItem?.metadata ?? null;
  const film = mediaItem?.mediaType === "film" ? mediaItem.metadata : null;
  const book = mediaItem?.mediaType === "book" ? mediaItem.metadata : null;
  const [title, setTitle] = useState(
    metadata?.title ?? ("title" in editing ? (editing.title ?? "") : ""),
  );
  // The title stands in for an Original Title the item doesn't have, so it shows as none here.
  const [originalTitle, setOriginalTitle] = useState(
    metadata && metadata.originalTitle !== metadata.title ? metadata.originalTitle : "",
  );
  const [year, setYear] = useState(metadata?.year?.toString() ?? "");
  const [runtime, setRuntime] = useState(film?.runtime?.toString() ?? "");
  const [genres, setGenres] = useState<ReadonlySet<string>>(new Set(film?.genres));
  const [authors, setAuthors] = useState(book?.authors.join(", ") ?? "");
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
    const titles = {
      title: title.trim(),
      originalTitle: originalTitle.trim() || null,
      year: numberOf(year),
    };
    const fields =
      mediaType === "film"
        ? {
            ...titles,
            runtime: numberOf(runtime),
            genres: filmGenres.filter((genre) => genres.has(genre)),
          }
        : { ...titles, authors: authorsOf(authors) };
    const saved = mediaItem
      ? await api.editManualMediaItem(mediaItem.id, fields)
      : await api.createManualMediaItem(
          mediaType === "film"
            ? { mediaType, ...fields, allowDuplicate: warned }
            : { mediaType, ...fields, allowDuplicate: warned },
        );
    setSaving(false);
    setError(saved.ok ? null : saved.error);
    if (saved.ok) onSaved(saved.mediaItem);
  }

  // Changing a title or the year is another item, which may not be a duplicate.
  function clearWarning() {
    if (warned) setError(null);
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader
        title={
          metadata
            ? t("manualItem.editTitle", { film: filmLabel(metadata) })
            : mediaWord(mediaType, "manualNew")
        }
        description={mediaWord(
          mediaType,
          metadata ? "manualEditDescription" : "manualNewDescription",
        )}
      />
      <div className={sheetBodyClasses}>
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
            onChange={(event) => {
              setOriginalTitle(event.target.value);
              clearWarning();
            }}
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
              <span className="font-normal text-muted-foreground">
                ({t("manualItem.optional")})
              </span>
            </Label>
            <Input
              id={ids.year}
              type="number"
              inputMode="numeric"
              min={mediaType === "film" ? earliestFilmYear : earliestBookYear}
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
          {mediaType === "film" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={ids.runtime}>
                {t("manualItem.runtime")}{" "}
                <span className="font-normal text-muted-foreground">
                  ({t("manualItem.optional")})
                </span>
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
          )}
        </div>
        {mediaType === "film" && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 font-medium text-sm">
              {t("manualItem.genres")}{" "}
              <span className="font-normal text-muted-foreground">
                ({t("manualItem.optional")})
              </span>
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
        )}
        {mediaType === "book" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.authors}>
              {t("manualItem.authors")}{" "}
              <span className="font-normal text-muted-foreground">
                ({t("manualItem.optional")})
              </span>
            </Label>
            <Input
              id={ids.authors}
              autoComplete="off"
              value={authors}
              onChange={(event) => setAuthors(event.target.value)}
              aria-describedby={ids.authorsHint}
            />
            <p id={ids.authorsHint} className="text-muted-foreground text-sm">
              {t("manualItem.authorsHint")}
            </p>
          </div>
        )}
        {error && (
          <p
            id={ids.error}
            role="alert"
            className={warned ? "text-sm" : "text-destructive text-sm"}
          >
            {errorMessage(error, mediaType)}
          </p>
        )}
      </div>
      <SheetFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" className={sheetButtonClasses}>
            {t("manualItem.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving} className={sheetMainButtonClasses}>
          {mediaItem
            ? t(saving ? "manualItem.saving" : "manualItem.save")
            : t(saving ? "manualItem.adding" : warned ? "manualItem.addAnyway" : "manualItem.add")}
        </Button>
      </SheetFooter>
    </form>
  );
}
