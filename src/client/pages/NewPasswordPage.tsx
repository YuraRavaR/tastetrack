import { type FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordLength } from "../../shared/accounts";
import type { NewPasswordError } from "../api";
import { type LoginLocationState, useAuth } from "../auth";
import { t } from "../i18n/t";

// Where a User who logged in with a Temporary Password the Operator issued sets their own, before
// anything else; then they go where they were going.
export function NewPasswordPage() {
  const { state, setNewPassword } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<NewPasswordError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (state.status === "checking") {
    return <p className="text-muted-foreground">{t("auth.checking")}</p>;
  }
  if (state.status === "anonymous") return <Navigate to="/login" replace />;
  if (state.status === "authenticated") {
    const from = (location.state as LoginLocationState | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    const result = await setNewPassword(String(form.get("newPassword")));
    setSubmitting(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("newPassword.title")}</h1>
        </CardTitle>
        <CardDescription>{t("newPassword.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          {/* Tells a password manager whose password this is, when the login just happened. */}
          {state.username && (
            <input
              type="text"
              name="username"
              value={state.username}
              autoComplete="username"
              readOnly
              hidden
            />
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="newPassword">{t("newPassword.label")}</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              minLength={passwordLength.min}
              maxLength={passwordLength.max}
              aria-describedby="newPassword-rules"
              autoComplete="new-password"
              required
              onChange={() => setError(null)}
            />
            <p id="newPassword-rules" className="text-muted-foreground text-sm">
              {t("newPassword.rules")}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {t(
                error === "temporary_password_reused" ? "newPassword.reused" : "newPassword.failed",
              )}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {t(submitting ? "newPassword.submitting" : "newPassword.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
