import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { MediaItem, Thought } from "../../shared/api";
import * as api from "../api";
import { filmName } from "../catalog/film-label";
import { mediaWord } from "../i18n/media-words";
import { formatCalendarDate, t } from "../i18n/t";

// Asks before deleting a Thought, so a stray tap never removes one, over its form or from its row's
// menu. `thought` is the one to delete; the dialog is open while it is set, and stays open until
// the deletion succeeds.
export function DeleteThoughtDialog({
  mediaItem,
  thought,
  onClose,
  onDeleted,
}: {
  mediaItem: MediaItem;
  thought: Thought | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const { metadata, mediaType } = mediaItem;

  async function confirm() {
    if (!thought) return;
    setDeleting(true);
    const deleted = await api.deleteThought(thought.id);
    setDeleting(false);
    setFailed(!deleted);
    if (deleted) onDeleted();
  }

  return (
    <AlertDialog
      open={thought !== null}
      onOpenChange={(open) => {
        if (open) return;
        setFailed(false);
        onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("thought.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {thought &&
              t("thought.deleteDescription", {
                date: formatCalendarDate(thought.date),
                title: metadata ? filmName(metadata) : mediaWord(mediaType, "unknown"),
              })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("logEntry.deleteFailed")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("logEntry.cancel")}</AlertDialogCancel>
          <Button variant="destructive" disabled={deleting} onClick={confirm}>
            {t(deleting ? "logEntry.deleting" : "logEntry.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
