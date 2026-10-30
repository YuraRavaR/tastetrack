import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, RequireAuth } from "./auth";
import { AppLayout } from "./components/AppLayout";
import { BacklogPage } from "./pages/BacklogPage";
import { HomePage } from "./pages/HomePage";
import { InvitesPage } from "./pages/InvitesPage";
import { ItemHistoryPage } from "./pages/ItemHistoryPage";
import { ListPage } from "./pages/ListPage";
import { ListsPage } from "./pages/ListsPage";
import { LoginPage } from "./pages/LoginPage";
import { LogPage } from "./pages/LogPage";
import { NewPasswordPage } from "./pages/NewPasswordPage";
import { RegisterPage } from "./pages/RegisterPage";
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
              <Route index element={<HomePage />} />
              <Route path="/log" element={<LogPage />} />
              <Route path="/watchlist" element={<BacklogPage />} />
              <Route path="/lists" element={<ListsPage />} />
              <Route path="/lists/:listId" element={<ListPage />} />
              <Route path="/items/:mediaItemId" element={<ItemHistoryPage />} />
              <Route path="/invites" element={<InvitesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
