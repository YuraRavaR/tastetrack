import { BrowserRouter, Navigate, Route, Routes, useParams, useSearchParams } from "react-router";
import { AuthProvider, RequireAuth } from "./auth";
import { AppLayout } from "./components/AppLayout";
import { libraryPath } from "./library/library-tabs";
import { collectionPath, collectionsPath, searchPath } from "./navigation/paths";
import { InvitesPage } from "./pages/InvitesPage";
import { ItemHistoryPage } from "./pages/ItemHistoryPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ListPage } from "./pages/ListPage";
import { ListsPage } from "./pages/ListsPage";
import { LoginPage } from "./pages/LoginPage";
import { NewPasswordPage } from "./pages/NewPasswordPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SharedListPage } from "./pages/SharedListPage";

export function App() {
  return (
    <AuthProvider>
      {/* No transitions: the search field's value is the URL, and a controlled field has to
          update in the keystroke's own render. */}
      <BrowserRouter useTransitions={false}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/new-password" element={<NewPasswordPage />} />
            <Route path="/s/:token" element={<SharedListPage />} />
            <Route element={<RequireAuth />}>
              <Route index element={<HomeRedirect />} />
              <Route path="/saved/:type/:tab?" element={<LibraryPage />} />
              <Route path={collectionsPath} element={<ListsPage />} />
              <Route path={collectionPath(":listId")} element={<ListPage />} />
              <Route path={searchPath} element={<SearchPage />} />
              <Route path="/items/:mediaItemId" element={<ItemHistoryPage />} />
              <Route path="/invites" element={<InvitesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              {/* The addresses of the sections before Saved, Collections and Search. */}
              <Route path="/watchlist" element={<Redirect to={libraryPath("film", "backlog")} />} />
              <Route path="/log" element={<Redirect to={libraryPath("film", "experienced")} />} />
              <Route path="/lists" element={<Redirect to={collectionsPath} />} />
              <Route path="/lists/:listId" element={<ListRedirect />} />
              <Route path="*" element={<Redirect to="/" />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function Redirect({ to }: { to: string }) {
  return <Navigate to={to} replace />;
}

// Until Saved has its tiles, "/" opens the films' Watchlist. A link to the old home's search,
// `/?q=`, opens Search on that query.
function HomeRedirect() {
  const query = useSearchParams()[0].get("q");
  if (query) return <Redirect to={`${searchPath}?${new URLSearchParams({ q: query })}`} />;
  return <Redirect to={libraryPath("film", "backlog")} />;
}

function ListRedirect() {
  return <Redirect to={collectionPath(useParams().listId ?? "")} />;
}
