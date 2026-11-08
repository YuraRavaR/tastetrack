import { type FormEvent, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { passwordLength, usernamePattern } from "../../shared/accounts";
import type { RegisterError } from "../api";
import { useAuth } from "../auth";
import { AuthCard, AuthField, SwitchFormLink } from "../components/AuthCard";
import { FormError } from "../components/FormError";
import { type MessageId, t } from "../i18n/t";

const errorMessages: Record<RegisterError, MessageId> = {
  invite_code_unknown: "register.inviteCodeUnknown",
  invite_code_used: "register.inviteCodeUsed",
  invite_code_expired: "register.inviteCodeExpired",
  username_taken: "register.usernameTaken",
  unavailable: "register.unavailable",
};

type RegisterField = "inviteCode" | "username";

// The field each error is about, which it marks until the User types there again.
const errorFields: Record<RegisterError, RegisterField | null> = {
  invite_code_unknown: "inviteCode",
  invite_code_used: "inviteCode",
  invite_code_expired: "inviteCode",
  username_taken: "username",
  unavailable: null,
};

export function RegisterPage() {
  const { state, register } = useAuth();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<RegisterError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (state.status === "authenticated") return <Navigate to="/" replace />;

  // The rules show from the start and turn into an error once what is typed breaks them.
  const usernameInvalid = username !== "" && !usernamePattern.test(username);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (usernameInvalid) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    const result = await register({
      inviteCode: String(form.get("inviteCode")),
      username,
      password: String(form.get("password")),
    });
    setSubmitting(false);
    if (!result.ok) setError(result.error);
  }

  const errorField = error ? errorFields[error] : null;

  // Typing in the field an error is about clears that error.
  function clearErrorAbout(field: RegisterField) {
    if (errorField === field) setError(null);
  }

  return (
    <AuthCard title={t("register.title")}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <AuthField
          id="inviteCode"
          label={t("register.inviteCode")}
          defaultValue={searchParams.get("code") ?? ""}
          onChange={() => clearErrorAbout("inviteCode")}
          invalid={errorField === "inviteCode"}
          className="tracking-wider"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
        />
        <AuthField
          id="username"
          label={t("register.username")}
          rules={t("register.usernameRules")}
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            clearErrorAbout("username");
          }}
          invalid={errorField === "username"}
          rulesBroken={usernameInvalid}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <AuthField
          id="password"
          label={t("register.password")}
          rules={t("register.passwordRules")}
          type="password"
          minLength={passwordLength.min}
          maxLength={passwordLength.max}
          autoComplete="new-password"
          required
        />
        {error && <FormError>{t(errorMessages[error])}</FormError>}
        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {t(submitting ? "register.submitting" : "register.submit")}
        </Button>
      </form>
      <SwitchFormLink
        prompt={t("register.loginPrompt")}
        to="/login"
        link={t("register.loginLink")}
      />
    </AuthCard>
  );
}
