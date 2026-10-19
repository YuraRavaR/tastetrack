import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, RequireAuth } from "./auth";
import { AppLayout } from "./components/AppLayout";
import { HomePage } from "./pages/HomePage";
import { InvitesPage } from "./pages/InvitesPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<RequireAuth />}>
              <Route index element={<HomePage />} />
              <Route path="/invites" element={<InvitesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
