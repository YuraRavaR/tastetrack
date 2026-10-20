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

// Makes a film List, or renames one and changes its description when `list` is given. The dialog
// is open while `open` is set, and stays open until the List is saved.
export function ListFormDialog({
  open,
  list,
  onClose,
  onSaved,
}: {
  open: boolean;
  list?: ListSummary;
  onClose: () => void;
  onSaved: (list: ListSummary) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>{open && <ListForm list={list} onSaved={onSaved} />}</DialogContent>
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

function ListForm({ list, onSaved }: { list?: ListSummary; onSaved: (list: ListSummary) => void }) {
  const ids = { name: useId(), description: useId(), hint: useId(), error: useId() };
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
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t(list ? "listForm.editTitle" : "listForm.newTitle")}</DialogTitle>
        <DialogDescription>
          {t(list ? "listForm.editDescription" : "listForm.newDescription")}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.name}>{t("listForm.name")}</Label>
        <Input
          id={ids.name}
          required
          autoComplete="off"
          maxLength={maxListNameLength}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={nameError || undefined}
          aria-describedby={error ? ids.error : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.description}>{t("listForm.description")}</Label>
        <Textarea
          id={ids.description}
          rows={3}
          maxLength={maxListDescriptionLength}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-describedby={ids.hint}
        />
        <p id={ids.hint} className="text-muted-foreground text-sm">
          {t("listForm.descriptionHint")}
        </p>
      </div>
      {error && (
        <p id={ids.error} role="alert" className="text-destructive text-sm">
          {errorMessage(error)}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t("listForm.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {list
            ? t(saving ? "listForm.saving" : "listForm.save")
            : t(saving ? "listForm.creating" : "listForm.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
