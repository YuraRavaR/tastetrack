import { X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { ListSummary } from "../../shared/api";
import { maxListDescriptionLength, maxListNameLength, maxLists } from "../../shared/lists";
import * as api from "../api";
import { t } from "../i18n/t";
import { FormError } from "./FormError";
import { sheetClasses } from "./sheet";

// The fields of a List that the form edits.
type ListFields = Pick<ListSummary, "id" | "name" | "description">;

// Makes a film List, or renames one and changes its description when `list` is given. The dialog
// is open while `open` is set, and stays open until the List is saved. A bottom sheet on a phone,
// a centred dialog from `md`.
export function ListFormDialog({
  open,
  list,
  onClose,
  onSaved,
}: {
  open: boolean;
  list?: ListFields;
  onClose: () => void;
  onSaved: (list: ListSummary) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} className={sheetClasses}>
        {open && <ListForm list={list} onSaved={onSaved} />}
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

function ListForm({ list, onSaved }: { list?: ListFields; onSaved: (list: ListSummary) => void }) {
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
      : await api.createList({ ...fields, mediaType: "film" });
    setSaving(false);
    setError(saved.ok ? null : saved.error);
    if (saved.ok) onSaved(saved.list);
  }

  const nameError = error === "list_name_reserved" || error === "list_name_taken";

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-3 pt-4 pr-2.5 pb-1 pl-5 md:pt-5 md:pr-3 md:pl-6">
        <DialogHeader className="min-w-0 flex-1 gap-1 pt-1 text-left">
          <DialogTitle className="break-words text-xl leading-tight tracking-tight">
            {t(list ? "listForm.editTitle" : "listForm.newTitle")}
          </DialogTitle>
          <DialogDescription>
            {t(list ? "listForm.editDescription" : "listForm.newDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 rounded-full text-muted-foreground md:size-10 md:rounded-md"
            aria-label={t("dialog.close")}
            title={t("dialog.close")}
          >
            <X aria-hidden className="size-5" />
          </Button>
        </DialogClose>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-3.5 pb-5 md:px-6 md:pt-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.name}>{t("listForm.name")}</Label>
          <Input
            id={ids.name}
            required
            autoComplete="off"
            maxLength={maxListNameLength}
            placeholder={t("listForm.namePlaceholder")}
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
      <DialogFooter className="grid grid-cols-2 gap-3 border-t px-5 pt-3 pb-[calc(0.75rem+max(1.375rem,env(safe-area-inset-bottom)))] md:flex md:flex-row md:justify-end md:px-6 md:pt-4 md:pb-5">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="h-12.5 text-base md:h-10 md:text-sm">
            {t("listForm.cancel")}
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={saving}
          className="h-12.5 font-semibold text-base md:h-10 md:text-sm"
        >
          {list
            ? t(saving ? "listForm.saving" : "listForm.save")
            : t(saving ? "listForm.creating" : "listForm.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
