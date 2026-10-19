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
import type { LogEntry } from "../../shared/api";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { t } from "../i18n/t";

// Asks before deleting a Log Entry, so a stray tap never removes one. `entry` is the one to
// delete; the dialog is open while it is set, and stays open until the deletion succeeds.
export function DeleteLogEntryDialog({
  entry,
  onClose,
  onDeleted,
}: {
  entry: LogEntry | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const metadata = entry?.mediaItem.metadata;

  async function confirm() {
    if (!entry) return;
    setDeleting(true);
    const deleted = await api.deleteLogEntry(entry.id);
    setDeleting(false);
    setFailed(!deleted);
    if (deleted) onDeleted();
  }

  return (
    <AlertDialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (open) return;
        setFailed(false);
        onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("logEntry.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("logEntry.deleteDescription", {
              film: metadata ? filmLabel(metadata) : t("film.unknown"),
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
