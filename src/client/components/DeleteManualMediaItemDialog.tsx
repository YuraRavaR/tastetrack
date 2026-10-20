import { useEffect, useState } from "react";
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
import type { ManualMediaItemResponse, MediaItem } from "../../shared/api";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { t } from "../i18n/t";

type Usage = ManualMediaItemResponse["usage"];

// Asks before deleting a Manual Media Item, saying how many Log Entries and List Items, the
// Watchlist's included, go with it, so no history is lost by surprise. The dialog is open while
// `open` is set, and stays open until the deletion succeeds.
export function DeleteManualMediaItemDialog({
  mediaItem,
  open,
  onClose,
  onDeleted,
}: {
  mediaItem: MediaItem;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  // The counts are read as the dialog opens, so they are never stale. An item already gone has
  // nothing left to go with it, and deleting it again just succeeds.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setUsage(null);
    api
      .fetchManualMediaItem(mediaItem.id)
      .then((found) => {
        if (!cancelled) setUsage(found?.usage ?? { logEntries: 0, listItems: 0 });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mediaItem.id]);

  async function confirm() {
    setDeleting(true);
    const deleted = await api.deleteManualMediaItem(mediaItem.id);
    setDeleting(false);
    setFailed(!deleted);
    if (deleted) onDeleted();
  }

  const film = mediaItem.metadata ? filmLabel(mediaItem.metadata) : t("film.unknown");
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
          <AlertDialogTitle>{t("manualItem.deleteTitle", { film })}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">
              {usage ? (
                <>
                  <p>{t("manualItem.deleteLogEntries", { count: usage.logEntries })}</p>
                  <p>{t("manualItem.deleteListItems", { count: usage.listItems })}</p>
                  <p>{t("manualItem.deleteForGood")}</p>
                </>
              ) : (
                <p>{t("manualItem.deleteChecking")}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("manualItem.deleteFailed")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("manualItem.cancel")}</AlertDialogCancel>
          <Button variant="destructive" disabled={!usage || deleting} onClick={confirm}>
            {t(deleting ? "manualItem.deleting" : "manualItem.deleteConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
