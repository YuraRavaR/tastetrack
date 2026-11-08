import { Link, Outlet, useLocation, useMatch } from "react-router";
import { cn } from "@/lib/utils";
import { version } from "../../../package.json";
import tmdbLogo from "../assets/tmdb-logo.svg";
import { type LoginLocationState, useAuth } from "../auth";
import { t } from "../i18n/t";
import { listsPath, savedPath, searchPath } from "../navigation/paths";
import { AccountMenu } from "./AccountMenu";
import { SectionHeaderLinks, SectionTabBar } from "./SectionNav";

// The frame of every page: a header above a content column, and a footer with the app version and
// the credit TMDB's terms require (ADR-0004). Header and footer stop at `max-w-6xl`, which Saved
// uses for its tiles and grids of posters, Collections for its cards, and a Share Link's page for
// its grid; every other page
// keeps the narrower column, Search one a little wider for its grid of covers. Logged out, the
// header holds only the app name, and on a Share Link's page a "Log in" link that comes back to
// it. A logged-in User gets the sections, in a bottom tab
// bar on a phone and in the header from `md`, and the account menu. A User who must set a new
// password gets only the account menu, to log out.
export function AppLayout() {
  const { state } = useAuth();
  const authenticated = state.status === "authenticated";
  const sharePage = useMatch("/s/:token") !== null;
  const savedTiles = useMatch(savedPath) !== null;
  const savedTabs = useMatch("/saved/*") !== null;
  const collections = useMatch(listsPath) !== null;
  const wide = savedTiles || savedTabs || collections || sharePage;
  const searchPage = useMatch(searchPath) !== null;
  const location = useLocation();

  return (
    <div className="flex min-h-svh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center gap-7 px-4 md:min-h-15 md:px-6">
          <Link
            to={savedPath}
            className="flex min-h-11 items-center font-brand font-semibold text-lg italic tracking-tight"
          >
            {t("app.name")}
          </Link>
          {authenticated && <SectionHeaderLinks />}
          {(authenticated || state.status === "passwordChangeRequired") && <AccountMenu />}
          {sharePage && state.status === "anonymous" && (
            <Link
              to="/login"
              state={{ from: location.pathname } satisfies LoginLocationState}
              className="-mr-3 ml-auto flex min-h-11 items-center rounded-full px-3 font-semibold text-primary-strong"
            >
              {t("app.logIn")}
            </Link>
          )}
        </div>
      </header>
      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 py-6 md:px-6",
          wide ? "max-w-6xl" : searchPage ? "max-w-208" : "max-w-3xl",
        )}
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
