import { BrowserRouter, Navigate, Route, Routes, useParams, useSearchParams } from "react-router";
import { AuthProvider, RequireAuth } from "./auth";
import { AppLayout } from "./components/AppLayout";
import { libraryPath } from "./library/library-tabs";
import { listPath, listsPath, searchPath } from "./navigation/paths";
import { InvitesPage } from "./pages/InvitesPage";
import { ItemHistoryPage } from "./pages/ItemHistoryPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ListPage } from "./pages/ListPage";
import { ListsPage } from "./pages/ListsPage";
import { LoginPage } from "./pages/LoginPage";
import { NewPasswordPage } from "./pages/NewPasswordPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SavedPage } from "./pages/SavedPage";
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
              <Route index element={<SavedHome />} />
              <Route path="/saved/:type/:tab?" element={<LibraryPage />} />
              <Route path={listsPath} element={<ListsPage />} />
              <Route path={listPath(":listId")} element={<ListPage />} />
              <Route path={searchPath} element={<SearchPage />} />
              <Route path="/items/:mediaItemId" element={<ItemHistoryPage />} />
              <Route path="/invites" element={<InvitesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              {/* The addresses of the sections before Saved, Collections and Search. */}
              <Route
                path="/watchlist"
                element={<Navigate to={libraryPath("film", "backlog")} replace />}
              />
              <Route
                path="/log"
                element={<Navigate to={libraryPath("film", "experienced")} replace />}
              />
              <Route path="/lists" element={<Navigate to={listsPath} replace />} />
              <Route path="/lists/:listId" element={<ListRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

// "/" is Saved's tiles. A link to the old home's search, `/?q=`, opens Search on that query.
function SavedHome() {
  const query = useSearchParams()[0].get("q");
  if (query) return <Navigate to={`${searchPath}?${new URLSearchParams({ q: query })}`} replace />;
  return <SavedPage />;
}

// An old address of a List, /lists/:listId, opens it at its new one.
function ListRedirect() {
  return <Navigate to={listPath(useParams().listId ?? "")} replace />;
}
