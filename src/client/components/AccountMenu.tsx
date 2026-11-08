import { ChevronDown, LogOut, Settings, Ticket, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useMatch } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { t } from "../i18n/t";
import {
  menuSheetIconClasses as iconClasses,
  MenuSheetContent,
  menuSheetItemClasses,
} from "./MenuSheetContent";

// The page the User is on is marked.
const itemClasses = cn(menuSheetItemClasses, "aria-[current=page]:bg-muted");

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
      <MenuSheetContent open={open} align="end">
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
      </MenuSheetContent>
    </DropdownMenu>
  );
}
