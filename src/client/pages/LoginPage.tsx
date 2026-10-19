import { type FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router";
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
  const [error, setError] = useState<Extract<LoginResult, { ok: false }>["error"] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (state.status === "authenticated") {
    const from = (location.state as LoginLocationState | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    const result = await logIn(String(form.get("username")), String(form.get("password")));
    setSubmitting(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("login.title")}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
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
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {t(
                error === "invalid_credentials" ? "login.invalidCredentials" : "login.unavailable",
              )}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {t(submitting ? "login.submitting" : "login.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
