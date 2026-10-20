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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ListItem } from "../../shared/api";
import { maxNoteLength } from "../../shared/lists";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { t } from "../i18n/t";

// Adds, changes or clears a List Item's Note. `item` is the one to note; the dialog is open while
// it is set, and stays open until the Note is saved.
export function NoteDialog({
  item,
  onClose,
  onSaved,
}: {
  item: ListItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {item && <NoteForm key={item.id} item={item} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function NoteForm({ item, onSaved }: { item: ListItem; onSaved: () => void }) {
  const ids = { note: useId(), hint: useId() };
  const [note, setNote] = useState(item.note ?? "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const metadata = item.mediaItem.metadata;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const saved = await api.editListItem(item.id, { note: note.trim() || null });
    setSaving(false);
    setFailed(!saved);
    if (saved) onSaved();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>
          {t("note.title", { film: metadata ? filmLabel(metadata) : t("film.unknown") })}
        </DialogTitle>
        <DialogDescription>{t("note.description")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.note}>{t("note.label")}</Label>
        <Textarea
          id={ids.note}
          rows={4}
          maxLength={maxNoteLength}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-describedby={ids.hint}
        />
        <p id={ids.hint} className="text-muted-foreground text-sm">
          {t("note.hint")}
        </p>
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("note.unavailable")}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t("note.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {t(saving ? "note.saving" : "note.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
