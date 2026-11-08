import { type FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { passwordLength } from "../../shared/accounts";
import type { NewPasswordError } from "../api";
import { type LoginLocationState, useAuth } from "../auth";
import { AuthCard } from "../components/AuthCard";
import { FormError } from "../components/FormError";
import { FormField } from "../components/FormField";
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
    <AuthCard title={t("newPassword.title")} description={t("newPassword.description")}>
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
        <FormField
          id="newPassword"
          label={t("newPassword.label")}
          rules={t("newPassword.rules")}
          type="password"
          minLength={passwordLength.min}
          maxLength={passwordLength.max}
          autoComplete="new-password"
          required
          invalid={error === "temporary_password_reused"}
          onChange={() => setError(null)}
        />
        {error && (
          <FormError>
            {t(error === "temporary_password_reused" ? "newPassword.reused" : "newPassword.failed")}
          </FormError>
        )}
        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {t(submitting ? "newPassword.submitting" : "newPassword.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
