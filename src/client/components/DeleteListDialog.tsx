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
import type { List } from "../../shared/api";
import * as api from "../api";
import { t } from "../i18n/t";

// Asks before deleting a List, so a stray tap never removes one, and says the Log is safe. The
// dialog is open while `open` is set, and stays open until the deletion succeeds.
export function DeleteListDialog({
  list,
  open,
  onClose,
  onDeleted,
}: {
  list: List;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setDeleting(true);
    const deleted = await api.deleteList(list.id);
    setDeleting(false);
    setFailed(!deleted);
    if (deleted) onDeleted();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        setFailed(false);
        onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("listDelete.title", { list: list.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("listDelete.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("listDelete.failed")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("listDelete.cancel")}</AlertDialogCancel>
          <Button variant="destructive" disabled={deleting} onClick={confirm}>
            {t(deleting ? "listDelete.deleting" : "listDelete.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
