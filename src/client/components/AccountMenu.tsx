import { ChevronDown, UserRound } from "lucide-react";
import { Link } from "react-router";
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

// The avatar button at the end of the header, with the User's Display Name from `md`, and its menu
// of the pages that aren't sections. A User who must set a new password has only Log out.
export function AccountMenu() {
  const { state, logOut } = useAuth();
  const user = state.status === "authenticated" ? state.user : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="ml-auto h-11 min-w-0 rounded-full px-1 md:pr-2">
          <span className="sr-only">{t("account.menu")}</span>
          <span className="flex size-8.5 items-center justify-center rounded-full bg-muted text-secondary-foreground">
            <UserRound aria-hidden className="size-5" />
          </span>
          {user && <span className="hidden max-w-48 truncate md:inline">{user.displayName}</span>}
          <ChevronDown aria-hidden className="hidden md:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {user && (
          <>
            <DropdownMenuItem asChild className="min-h-11">
              <Link to="/invites">{t("invites.nav")}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="min-h-11">
              <Link to="/settings">{t("settings.nav")}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem className="min-h-11" onSelect={() => logOut()}>
          {t("auth.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
