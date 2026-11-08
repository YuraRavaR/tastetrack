import { ChevronDown, LogOut, Settings, Ticket, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useMatch } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "../auth";
import { t } from "../i18n/t";

// A sheet's roomy rows on a phone, a dropdown's from `md`; the page the User is on is marked.
const itemClasses =
  "min-h-13 gap-3.5 rounded-lg px-3 font-medium text-[17px] aria-[current=page]:bg-muted md:min-h-11 md:gap-2.5 md:rounded-md md:px-2.5 md:font-normal md:text-[15px]";
const iconClasses = "size-5.5 md:size-4.25";

// The avatar button at the end of the header, with the User's Display Name from `md`, and its menu
// of the pages that aren't sections (`docs/mockups/account/`). Below `md` the menu is a bottom
// sheet over a scrim, from `md` a dropdown under the button. A User who must set a new password
// has only Log out.
export function AccountMenu() {
  const { state, logOut } = useAuth();
  const [open, setOpen] = useState(false);
  const onInvites = useMatch("/invites") !== null;
  const onSettings = useMatch("/settings") !== null;
  const user = state.status === "authenticated" ? state.user : null;
  // A User setting a new password has no Display Name yet to show, only the Username they typed.
  const shownName =
    user?.displayName ?? (state.status === "passwordChangeRequired" ? state.username : null);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="ml-auto h-11 min-w-0 rounded-full px-1 md:pr-2 md:data-[state=open]:bg-muted"
        >
          <span className="sr-only">{t("account.menu")}</span>
          <span className="flex size-8.5 items-center justify-center rounded-full bg-muted text-secondary-foreground">
            <UserRound aria-hidden className="size-5" />
          </span>
          {shownName && <span className="hidden max-w-48 truncate md:inline">{shownName}</span>}
          <ChevronDown aria-hidden className="hidden md:block" />
        </Button>
      </DropdownMenuTrigger>
      {/* The menu is modal, so a tap on the scrim lands outside it and closes it. */}
      {open && (
        <div aria-hidden className="fade-in-0 fixed inset-0 z-40 animate-in bg-overlay md:hidden" />
      )}
      <DropdownMenuContent
        align="end"
        // Pins the menu to the bottom edge below `md`; see the rule in styles.css.
        data-sheet=""
        className="max-h-[calc(100dvh-3rem)] w-full rounded-t-sheet rounded-b-none border-x-0 border-b-0 bg-card p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:slide-in-from-bottom-8 md:max-h-(--radix-dropdown-menu-content-available-height) md:w-auto md:min-w-50 md:rounded-xl md:border md:p-1 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95 md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-bottom-0"
      >
        {user && (
          <>
            <DropdownMenuItem asChild className={itemClasses}>
              <Link to="/invites" aria-current={onInvites ? "page" : undefined}>
                <Ticket aria-hidden className={iconClasses} />
                {t("invites.nav")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={itemClasses}>
              <Link to="/settings" aria-current={onSettings ? "page" : undefined}>
                <Settings aria-hidden className={iconClasses} />
                {t("settings.nav")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="mx-3 my-1.5 md:mx-1.5 md:my-1" />
          </>
        )}
        <DropdownMenuItem className={itemClasses} onSelect={() => logOut()}>
          <LogOut aria-hidden className={iconClasses} />
          {t("auth.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
