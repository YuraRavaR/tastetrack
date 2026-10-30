import { Settings } from "lucide-react";
import { Link, Outlet } from "react-router";
import { Button } from "@/components/ui/button";
import tmdbLogo from "../assets/tmdb-logo.svg";
import { useAuth } from "../auth";
import { t } from "../i18n/t";

// The frame of every page: a header with the app name and, once logged in, the User, the Log,
// Watchlist, Lists, Invites and Settings pages and a logout action, above a single content
// column, and a footer crediting TMDB as its terms require (ADR-0004). Mobile first: the column
// fills a phone screen and stops widening on larger ones, the header wraps rather than overflow,
// Settings is an icon, and the User's Display Name shows only where there is room. A User who
// must set a new password gets only the logout action.
export function AppLayout() {
  const { state, logOut } = useAuth();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex min-h-14 w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:py-0">
          <Link to="/" className="font-brand font-semibold text-lg italic tracking-tight">
            {t("app.name")}
          </Link>
          {state.status === "passwordChangeRequired" && (
            <Button variant="outline" size="sm" onClick={() => logOut()}>
              {t("auth.logout")}
            </Button>
          )}
          {state.status === "authenticated" && (
            <div className="flex min-w-0 items-center sm:gap-3">
              <span className="hidden truncate text-muted-foreground text-sm sm:inline">
                {state.user.displayName}
              </span>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" asChild>
                <Link to="/log">{t("log.nav")}</Link>
              </Button>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" asChild>
                <Link to="/watchlist">{t("backlog.nav")}</Link>
              </Button>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" asChild>
                <Link to="/lists">{t("lists.nav")}</Link>
              </Button>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" asChild>
                <Link to="/invites">{t("invites.nav")}</Link>
              </Button>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" asChild>
                <Link to="/settings" aria-label={t("settings.nav")} title={t("settings.nav")}>
                  <Settings aria-hidden />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="ml-1 px-2 sm:ml-0 sm:px-3"
                onClick={() => logOut()}
              >
                {t("auth.logout")}
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer"
            className="shrink-0"
          >
            <img src={tmdbLogo} alt={t("attribution.tmdbLogo")} className="h-3 w-auto" />
          </a>
          <p className="text-muted-foreground text-xs">{t("attribution.tmdb")}</p>
        </div>
      </footer>
    </div>
  );
}
