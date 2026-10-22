import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import type { RegisterRequest, User } from "../shared/api";
import * as api from "./api";
import { t } from "./i18n/t";

// A User who logged in with a Temporary Password the Operator issued must set their own before
// anything else; their Username is known only when they logged in on this page load.
type AuthState =
  | { status: "checking" }
  | { status: "anonymous" }
  | { status: "passwordChangeRequired"; username: string | null }
  | { status: "authenticated"; user: User };

function stateOf(current: User | null | "password_change_required"): AuthState {
  if (current === "password_change_required") {
    return { status: "passwordChangeRequired", username: null };
  }
  return current ? { status: "authenticated", user: current } : { status: "anonymous" };
}

interface Auth {
  state: AuthState;
  logIn(username: string, password: string): Promise<api.LoginResult>;
  register(request: RegisterRequest): Promise<api.RegisterResult>;
  // The User as saved, or null when the Display Name couldn't be; null or empty puts the
  // Username back.
  setDisplayName(displayName: string | null): Promise<User | null>;
  // Sets the User's own password in place of the temporary one, which lets them in.
  setNewPassword(newPassword: string): Promise<api.NewPasswordResult>;
  logOut(): Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    api
      .fetchCurrentUser()
      .catch(() => null)
      .then((current) => {
        if (!cancelled) setState(stateOf(current));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const auth: Auth = {
    state,
    async logIn(username, password) {
      const result = await api.logIn(username, password);
      if (result.ok) {
        setState(
          result.passwordChangeRequired
            ? { status: "passwordChangeRequired", username: result.user.username }
            : { status: "authenticated", user: result.user },
        );
      }
      return result;
    },
    async register(request) {
      const result = await api.register(request);
      if (result.ok) setState({ status: "authenticated", user: result.user });
      return result;
    },
    async setDisplayName(displayName) {
      const user = await api.setDisplayName(displayName);
      if (user) setState({ status: "authenticated", user });
      return user;
    },
    async setNewPassword(newPassword) {
      const result = await api.setNewPassword(newPassword);
      if (result.ok) setState(stateOf(await api.fetchCurrentUser().catch(() => null)));
      return result;
    },
    async logOut() {
      await api.logOut();
      setState({ status: "anonymous" });
    },
  };

  return <AuthContext value={auth}>{children}</AuthContext>;
}

export function useAuth(): Auth {
  const auth = use(AuthContext);
  if (!auth) throw new Error("useAuth needs an AuthProvider");
  return auth;
}

// Where the login page sends the User once they are in.
export interface LoginLocationState {
  from?: string;
}

// Renders its child routes for a logged-in User and sends everyone else to the login page, or a
// User with a Temporary Password to set their own, remembering where they were going.
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === "checking") {
    return <p className="text-muted-foreground">{t("auth.checking")}</p>;
  }
  if (state.status === "anonymous" || state.status === "passwordChangeRequired") {
    const from = location.pathname + location.search;
    const to = state.status === "anonymous" ? "/login" : "/new-password";
    return <Navigate to={to} replace state={{ from } satisfies LoginLocationState} />;
  }
  return <Outlet />;
}
