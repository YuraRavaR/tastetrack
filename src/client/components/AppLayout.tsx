import { Link, Outlet, useMatch } from "react-router";
import { cn } from "@/lib/utils";
import { version } from "../../../package.json";
import tmdbLogo from "../assets/tmdb-logo.svg";
import { useAuth } from "../auth";
import { t } from "../i18n/t";
import { AccountMenu } from "./AccountMenu";
import { SectionHeaderLinks, SectionTabBar } from "./SectionNav";

// The frame of every page: a header above a content column, and a footer with the app version and
// the credit TMDB's terms require (ADR-0004). Header and footer stop at `max-w-6xl`, which home
// uses for its blocks side by side; every other page keeps the narrower column. Logged out, the
// header holds only the app name. A logged-in User gets the sections, in a bottom tab bar on a
// phone and in the header from `md`, and the account menu. A User who must set a new password gets
// only the account menu, to log out.
export function AppLayout() {
  const { state } = useAuth();
  const authenticated = state.status === "authenticated";
  const wide = useMatch("/") !== null;

  return (
    <div className="flex min-h-svh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center gap-7 px-4 md:min-h-15 md:px-6">
          <Link
            to="/"
            className="flex min-h-11 items-center font-brand font-semibold text-lg italic tracking-tight"
          >
            {t("app.name")}
          </Link>
          {authenticated && <SectionHeaderLinks />}
          {(authenticated || state.status === "passwordChangeRequired") && <AccountMenu />}
        </div>
      </header>
      <main
        className={cn("mx-auto w-full flex-1 px-4 py-6 md:px-6", wide ? "max-w-6xl" : "max-w-3xl")}
      >
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 md:px-6">
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer"
            className="shrink-0"
          >
            <img src={tmdbLogo} alt={t("attribution.tmdbLogo")} className="h-3 w-auto" />
          </a>
          <p className="text-muted-foreground text-xs">{t("attribution.tmdb")}</p>
          <p className="shrink-0 text-muted-foreground text-xs">{t("app.version", { version })}</p>
        </div>
      </footer>
      {authenticated && <SectionTabBar />}
    </div>
  );
}
