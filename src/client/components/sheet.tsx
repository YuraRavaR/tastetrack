import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { t } from "../i18n/t";

// The shell of the redesign's dialogs, as the Watched dialog drew it: a bottom sheet below `md`, with no
// swipe to close, and a centred dialog from `md`. Its form's body scrolls between a header and a
// footer that stay put. For DialogContent, with its own close button off.
export const sheetClasses =
  "top-auto bottom-0 left-0 flex max-h-[calc(100dvh-3rem)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-sheet rounded-b-none border-x-0 border-b-0 p-0 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:slide-in-from-bottom-8 sm:max-w-none md:top-[72px] md:bottom-auto md:left-[50%] md:max-h-[calc(100dvh-9rem)] md:w-[calc(100%-2rem)] md:max-w-[480px] md:translate-x-[-50%] md:rounded-lg md:border md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-bottom-0";

// A sheet's body, which scrolls between its header and footer.
export const sheetBodyClasses =
  "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-3.5 pb-5 md:px-6 md:pt-4";

// A sheet's buttons: taller on a phone, for a thumb. Its main button is bold too.
export const sheetButtonClasses = "h-12.5 text-base md:h-10 md:text-sm";
export const sheetMainButtonClasses = cn(sheetButtonClasses, "font-semibold");

// Room under a sheet's last row for the phone's home indicator.
export const sheetSafeBottomClasses =
  "pb-[calc(0.75rem+max(1.375rem,env(safe-area-inset-bottom)))]";

// A sheet's title and text, with a Close button beside them at every width.
export function SheetHeader({ title, description }: { title: ReactNode; description: ReactNode }) {
  return (
    <div className="flex items-start gap-3 pt-4 pr-2.5 pb-1 pl-5 md:pt-5 md:pr-3 md:pl-6">
      <DialogHeader className="min-w-0 flex-1 gap-1 pt-1 text-left">
        <DialogTitle className="break-words text-xl leading-tight tracking-tight">
          {title}
        </DialogTitle>
        <DialogDescription>{description}</DialogDescription>
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
  );
}

// A sheet's Cancel and main buttons: side by side across a phone, on the right from `md`, above
// the phone's home indicator.
export function SheetFooter({ className, ...props }: ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn(
        "grid grid-cols-2 gap-3 border-t px-5 pt-3 md:flex md:flex-row md:justify-end md:px-6 md:pt-4 md:pb-5",
        sheetSafeBottomClasses,
        className,
      )}
      {...props}
    />
  );
}
