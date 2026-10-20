import { Button } from "@/components/ui/button";
import { t } from "../i18n/t";

// A message about something the User can take back, with the button that does.
export function UndoLine({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2">
      {message}
      <Button variant="link" size="sm" className="h-auto p-0" onClick={onUndo}>
        {t("listItem.undo")}
      </Button>
    </p>
  );
}
