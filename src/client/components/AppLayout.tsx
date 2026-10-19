import { Link, Outlet } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "../auth";
import { t } from "../i18n/t";

// The frame of every page: a header with the app name and, once logged in, the User, the
// Invites page and a logout action, above a single content column. Mobile first: the column fills a phone screen
// and stops widening on larger ones.
export function AppLayout() {
  const { state, logOut } = useAuth();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4">
          <Link to="/" className="font-semibold text-lg tracking-tight">
            {t("app.name")}
          </Link>
          {state.status === "authenticated" && (
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span className="truncate text-muted-foreground text-sm">{state.user.username}</span>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/invites">{t("invites.nav")}</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => logOut()}>
                {t("auth.logout")}
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
