import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { List } from "../../shared/api";
import * as api from "../api";
import { t } from "../i18n/t";
import { FormError } from "./FormError";
import {
  SheetFooter,
  SheetHeader,
  sheetButtonClasses,
  sheetClasses,
  sheetMainButtonClasses,
} from "./sheet";

// Asks before deleting a List, so a stray tap never removes one, and says the Log is safe. The
// dialog is open while `open` is set, and stays open until the deletion succeeds. A bottom sheet
// on a phone, a centred dialog from `md`; an alert dialog, so a tap outside it doesn't answer it.
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
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        setFailed(false);
        onClose();
      }}
    >
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        className={sheetClasses}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <SheetHeader
          title={t("listDelete.title", { list: list.name })}
          description={t("listDelete.description")}
        />
        {failed && (
          <div className="px-5 pt-2 pb-4 md:px-6">
            <FormError>{t("listDelete.failed")}</FormError>
          </div>
        )}
        <SheetFooter className={cn(!failed && "mt-4")}>
          <DialogClose asChild>
            <Button type="button" variant="outline" className={sheetButtonClasses}>
              {t("listDelete.cancel")}
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={confirm}
            className={sheetMainButtonClasses}
          >
            {t(deleting ? "listDelete.deleting" : "listDelete.delete")}
          </Button>
        </SheetFooter>
      </DialogContent>
    </Dialog>
  );
}
