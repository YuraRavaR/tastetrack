import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import type { MediaType, RemovedListItem } from "../../shared/api";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { libraryPath } from "../library/library-tabs";
import { UndoLine } from "./UndoLine";

// A toast floats above the tab bar, so it shows from anywhere and never moves the page. It is empty
// until there is something to say, and it stays in the page so that a screen reader announces it.
export function Toast({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-lg border bg-popover py-1 pr-1 pl-4 text-popover-foreground text-sm shadow-lg empty:hidden md:inset-x-auto md:bottom-6 md:left-1/2 md:w-max md:max-w-xl md:-translate-x-1/2"
    >
      {children && (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 md:size-9"
            aria-label={t("search.dismiss")}
            title={t("search.dismiss")}
            onClick={onDismiss}
          >
            <X aria-hidden />
          </Button>
        </>
      )}
    </div>
  );
}

// What the toast says after each of the User's actions on a film, but logging, which says more.
const actionMessages = {
  putBack: "backlog.putBack",
  planned: "backlog.planned",
  unplanned: "backlog.takenOff",
  added: "manualItem.added",
} as const;

// The User's last action on a film, which the toast reports.
export type FilmAction =
  | { kind: "logged"; mediaItemId: number; removedFromBacklog: RemovedListItem | null }
  | { kind: keyof typeof actionMessages };

// Reports a film's action: `film` is its label. Logging links to Saved's tab of what the User
// experienced, and takes a film off the Backlog, which `onUndo` puts back where it was.
export function FilmActionMessage({
  action,
  film,
  mediaType,
  onUndo,
}: {
  action: FilmAction;
  film: string;
  mediaType: MediaType;
  onUndo: (mediaItemId: number, removed: RemovedListItem) => void;
}) {
  const backlogName = mediaWord(mediaType, "backlog");
  if (action.kind !== "logged") {
    return <p>{t(actionMessages[action.kind], { film, backlogName })}</p>;
  }
  const { mediaItemId, removedFromBacklog } = action;
  return (
    <>
      <p>
        {t("logEntry.saved", { film })}{" "}
        <Link
          to={libraryPath(mediaType, "experienced")}
          className="text-primary-strong underline-offset-4 hover:underline"
        >
          {t("saved.goTo", { tab: mediaWord(mediaType, "experienced") })}
        </Link>
      </p>
      {removedFromBacklog && (
        <UndoLine
          message={t("backlog.takenOff", { film, backlogName })}
          onUndo={() => onUndo(mediaItemId, removedFromBacklog)}
        />
      )}
    </>
  );
}
