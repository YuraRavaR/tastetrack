import type { ComponentProps } from "react";
import { DropdownMenuContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// A sheet's roomy rows on a phone, a dropdown's from `md`, for a menu's items.
export const menuSheetItemClasses =
  "min-h-13 gap-3.5 rounded-lg px-3 font-medium text-[17px] md:min-h-11 md:gap-2.5 md:rounded-md md:px-2.5 md:font-normal md:text-[15px]";
export const menuSheetIconClasses = "size-5.5 md:size-4.25";

// A dropdown menu's content that is a bottom sheet over a scrim below `md`, as the account menu
// and a poster's ⋯ are, and drops down under its trigger from `md`. `open` is the menu's own
// state, which shows the scrim.
export function MenuSheetContent({
  open,
  className,
  ...props
}: { open: boolean } & ComponentProps<typeof DropdownMenuContent>) {
  return (
    <>
      {/* The menu is modal, so a tap on the scrim lands outside it and closes it. In a portal, so
          nothing the trigger's container does can confine it. */}
      {open && (
        <DropdownMenuPortal>
          <div
            aria-hidden
            className="fade-in-0 fixed inset-0 z-40 animate-in bg-overlay md:hidden"
          />
        </DropdownMenuPortal>
      )}
      <DropdownMenuContent
        // Pins the menu to the bottom edge below `md`; see the rule in styles.css.
        data-sheet=""
        className={cn(
          "max-h-[calc(100dvh-3rem)] w-full rounded-t-sheet rounded-b-none border-x-0 border-b-0 bg-card p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:slide-in-from-bottom-8 md:max-h-(--radix-dropdown-menu-content-available-height) md:w-auto md:min-w-50 md:rounded-xl md:border md:p-1 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95 md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-bottom-0",
          className,
        )}
        {...props}
      />
    </>
  );
}
