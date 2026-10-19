import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import type { RegisterRequest, User } from "../shared/api";
import * as api from "./api";
import { t } from "./i18n/t";

type AuthState =
  | { status: "checking" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: User };

interface Auth {
  state: AuthState;
  logIn(username: string, password: string): Promise<api.LoginResult>;
  register(request: RegisterRequest): Promise<api.RegisterResult>;
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
      .then((user) => {
        if (!cancelled)
          setState(user ? { status: "authenticated", user } : { status: "anonymous" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const auth: Auth = {
    state,
    async logIn(username, password) {
      const result = await api.logIn(username, password);
      if (result.ok) setState({ status: "authenticated", user: result.user });
      return result;
    },
    async register(request) {
      const result = await api.register(request);
      if (result.ok) setState({ status: "authenticated", user: result.user });
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

// Renders its child routes for a logged-in User and sends everyone else to the login page,
// remembering where they were going.
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === "checking") {
    return <p className="text-muted-foreground">{t("auth.checking")}</p>;
  }
  if (state.status === "anonymous") {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from } satisfies LoginLocationState} />;
  }
  return <Outlet />;
}
