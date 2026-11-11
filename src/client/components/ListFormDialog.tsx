import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ListSummary, MediaType } from "../../shared/api";
import { maxListDescriptionLength, maxListNameLength, maxLists } from "../../shared/lists";
import * as api from "../api";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { FormError } from "./FormError";
import {
  SheetFooter,
  SheetHeader,
  sheetBodyClasses,
  sheetButtonClasses,
  sheetClasses,
  sheetMainButtonClasses,
} from "./sheet";

// The fields of a List that the form edits.
type ListFields = Pick<ListSummary, "id" | "name" | "description">;

// Makes a List of `mediaType`, or renames one and changes its description when `list` is given. The dialog
// is open while `open` is set, and stays open until the List is saved. A bottom sheet on a phone,
// a centred dialog from `md`. The dialog unmounts its form once closed, so each opening starts
// afresh.
export function ListFormDialog({
  open,
  mediaType,
  list,
  onClose,
  onSaved,
}: {
  open: boolean;
  // The new List's Media Type, or the edited one's.
  mediaType: MediaType;
  list?: ListFields;
  onClose: () => void;
  onSaved: (list: ListSummary) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className={sheetClasses}>
        <ListForm mediaType={mediaType} list={list} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function errorMessage(error: api.ListError): string {
  switch (error) {
    case "list_name_reserved":
      return t("listForm.nameReserved");
    case "list_name_taken":
      return t("listForm.nameTaken");
    case "too_many_lists":
      return t("listForm.tooMany", { max: maxLists });
    case "unavailable":
      return t("listForm.unavailable");
  }
}

function ListForm({
  mediaType,
  list,
  onSaved,
}: {
  mediaType: MediaType;
  list?: ListFields;
  onSaved: (list: ListSummary) => void;
}) {
  const ids = { name: useId(), description: useId(), error: useId() };
  const [name, setName] = useState(list?.name ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<api.ListError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const fields = { name: name.trim(), description: description.trim() || null };
    const saved = list
      ? await api.editList(list.id, fields)
      : await api.createList({ ...fields, mediaType });
    setSaving(false);
    setError(saved.ok ? null : saved.error);
    if (saved.ok) onSaved(saved.list);
  }

  const nameError = error === "list_name_reserved" || error === "list_name_taken";

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader
        title={t(list ? "listForm.editTitle" : "listForm.newTitle")}
        description={list ? t("listForm.editDescription") : mediaWord(mediaType, "collectionNew")}
      />
      <div className={sheetBodyClasses}>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.name}>{t("listForm.name")}</Label>
          <Input
            id={ids.name}
            required
            autoComplete="off"
            maxLength={maxListNameLength}
            placeholder={mediaWord(mediaType, "collectionNamePlaceholder")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameError || undefined}
            aria-describedby={nameError ? ids.error : undefined}
            className="h-11"
          />
          {nameError && (
            <div id={ids.error}>
              <FormError>{errorMessage(error)}</FormError>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.description} className="gap-1">
            {t("listForm.description")}
            <span className="font-normal text-muted-foreground">
              {t("listForm.descriptionHint")}
            </span>
          </Label>
          <Textarea
            id={ids.description}
            rows={3}
            maxLength={maxListDescriptionLength}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-22 resize-none md:resize-y"
          />
        </div>
        {error && !nameError && <FormError>{errorMessage(error)}</FormError>}
      </div>
      <SheetFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" className={sheetButtonClasses}>
            {t("listForm.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving} className={sheetMainButtonClasses}>
          {list
            ? t(saving ? "listForm.saving" : "listForm.save")
            : t(saving ? "listForm.creating" : "listForm.create")}
        </Button>
      </SheetFooter>
    </form>
  );
}
