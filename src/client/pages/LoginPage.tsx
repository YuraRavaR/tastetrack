import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LoginResult } from "../api";
import { type LoginLocationState, useAuth } from "../auth";
import { t } from "../i18n/t";

export function LoginPage() {
  const { state, logIn } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<Extract<LoginResult, { ok: false }> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (state.status === "authenticated") {
    const from = (location.state as LoginLocationState | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }
  // The User still goes where they were going once they have set their own password.
  if (state.status === "passwordChangeRequired") {
    return <Navigate to="/new-password" replace state={location.state} />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    const result = await logIn(String(form.get("username")), String(form.get("password")));
    setSubmitting(false);
    if (!result.ok) setError(result);
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("login.title")}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">{t("login.username")}</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("login.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state.status === "anonymous" && state.userDeleted && !error && (
            <p role="status" className="text-muted-foreground text-sm">
              {t("login.userDeleted")}
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {loginErrorMessage(error)}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {t(submitting ? "login.submitting" : "login.submit")}
          </Button>
        </form>
        <p className="text-center text-muted-foreground text-sm">
          {t("login.registerPrompt")}{" "}
          <Link to="/register" className="text-primary-strong underline-offset-4 hover:underline">
            {t("login.registerLink")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function loginErrorMessage(error: Extract<LoginResult, { ok: false }>): string {
  switch (error.error) {
    case "invalid_credentials":
      return t("login.invalidCredentials");
    case "too_many_attempts":
      // Whole minutes, rounded up, so the wait is never shorter than it says.
      return t("login.tooManyAttempts", {
        minutes: Math.max(1, Math.ceil(error.retryAfterSeconds / 60)),
      });
    case "unavailable":
      return t("login.unavailable");
  }
}
