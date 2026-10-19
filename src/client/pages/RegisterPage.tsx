import { type FormEvent, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { passwordLength, usernamePattern } from "../../shared/accounts";
import type { RegisterError } from "../api";
import { useAuth } from "../auth";
import { type MessageId, t } from "../i18n/t";

const errorMessages: Record<RegisterError, MessageId> = {
  invite_code_unknown: "register.inviteCodeUnknown",
  invite_code_used: "register.inviteCodeUsed",
  invite_code_expired: "register.inviteCodeExpired",
  username_taken: "register.usernameTaken",
  unavailable: "register.unavailable",
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

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("register.title")}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="inviteCode">{t("register.inviteCode")}</Label>
            <Input
              id="inviteCode"
              name="inviteCode"
              defaultValue={searchParams.get("code") ?? ""}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">{t("register.username")}</Label>
            <Input
              id="username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={usernameInvalid}
              aria-describedby="username-rules"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <p
              id="username-rules"
              className={cn(
                "text-sm",
                usernameInvalid ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {t("register.usernameRules")}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("register.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={passwordLength.min}
              maxLength={passwordLength.max}
              aria-describedby="password-rules"
              autoComplete="new-password"
              required
            />
            <p id="password-rules" className="text-muted-foreground text-sm">
              {t("register.passwordRules")}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {t(errorMessages[error])}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {t(submitting ? "register.submitting" : "register.submit")}
          </Button>
        </form>
        <p className="text-center text-muted-foreground text-sm">
          {t("register.loginPrompt")}{" "}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            {t("register.loginLink")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
