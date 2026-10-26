import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maxDisplayNameLength, passwordLength } from "../../shared/accounts";
import type { User } from "../../shared/api";
import * as api from "../api";
import { useAuth } from "../auth";
import { t } from "../i18n/t";

// The User's own settings: the Display Name others see on Share Links, their password, and
// deleting their account.
export function SettingsPage() {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold text-2xl tracking-tight">{t("settings.title")}</h1>
      <DisplayNameSection user={state.user} />
      <PasswordSection username={state.user.username} />
      <DeletionSection username={state.user.username} />
    </div>
  );
}

// A Card that is a landmark named by its title, so each form's messages stay apart from the
// other's.
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Card aria-labelledby={titleId} role="region">
      <CardHeader>
        <CardTitle>
          <h2 id={titleId} className="text-lg">
            {title}
          </h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DisplayNameSection({ user }: { user: User }) {
  const auth = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<"saved" | "failed" | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const saved = await auth.setDisplayName(displayName);
    setSaving(false);
    setOutcome(saved ? "saved" : "failed");
    // A cleared Display Name comes back as the Username, which the field then shows.
    if (saved) setDisplayName(saved.displayName);
  }

  return (
    <Section title={t("settings.displayNameTitle")}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="displayName">{t("settings.displayName")}</Label>
          <Input
            id="displayName"
            name="displayName"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setOutcome(null);
            }}
            maxLength={maxDisplayNameLength}
            aria-describedby="displayName-hint"
            autoComplete="nickname"
          />
          <p id="displayName-hint" className="text-muted-foreground text-sm">
            {t("settings.displayNameHint", {
              max: maxDisplayNameLength,
              username: user.username,
            })}
          </p>
        </div>
        {outcome === "saved" && (
          <p role="status" className="text-muted-foreground text-sm">
            {t("settings.displayNameSaved")}
          </p>
        )}
        {outcome === "failed" && (
          <p role="alert" className="text-destructive text-sm">
            {t("settings.displayNameFailed")}
          </p>
        )}
        <div>
          <Button type="submit" disabled={saving}>
            {t(saving ? "settings.saving" : "settings.saveDisplayName")}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PasswordSection({ username }: { username: string }) {
  const [changing, setChanging] = useState(false);
  const [outcome, setOutcome] = useState<"changed" | api.ChangePasswordError | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setChanging(true);
    const result = await api.changePassword({
      currentPassword: String(fields.get("currentPassword")),
      newPassword: String(fields.get("newPassword")),
    });
    setChanging(false);
    setOutcome(result.ok ? "changed" : result.error);
    if (result.ok) form.reset();
  }

  return (
    <Section title={t("settings.passwordTitle")} description={t("settings.passwordDescription")}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {/* Tells a password manager whose password this is. */}
        <input
          type="text"
          name="username"
          value={username}
          autoComplete="username"
          readOnly
          hidden
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="currentPassword">{t("settings.currentPassword")}</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="newPassword">{t("settings.newPassword")}</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            minLength={passwordLength.min}
            maxLength={passwordLength.max}
            aria-describedby="newPassword-rules"
            autoComplete="new-password"
            required
          />
          <p id="newPassword-rules" className="text-muted-foreground text-sm">
            {t("settings.newPasswordRules")}
          </p>
        </div>
        {outcome === "changed" && (
          <p role="status" className="text-muted-foreground text-sm">
            {t("settings.passwordChanged")}
          </p>
        )}
        {outcome && outcome !== "changed" && (
          <p role="alert" className="text-destructive text-sm">
            {t(outcome === "wrong_password" ? "settings.wrongPassword" : "settings.passwordFailed")}
          </p>
        )}
        <div>
          <Button type="submit" disabled={changing}>
            {t(changing ? "settings.changingPassword" : "settings.changePassword")}
          </Button>
        </div>
      </form>
    </Section>
  );
}

// The password is the confirmation, so a stray tap can't delete anything. Once the User is
// deleted, the app takes them to the login page.
function DeletionSection({ username }: { username: string }) {
  const auth = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<api.DeleteUserError | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setDeleting(true);
    const result = await auth.deleteUser(String(fields.get("deletionPassword")));
    if (result.ok) return;
    setDeleting(false);
    setError(result.error);
  }

  return (
    <Section title={t("settings.deleteTitle")} description={t("settings.deleteDescription")}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {/* Tells a password manager whose password this is. */}
        <input
          type="text"
          name="username"
          value={username}
          autoComplete="username"
          readOnly
          hidden
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="deletionPassword">{t("settings.deletePassword")}</Label>
          <Input
            id="deletionPassword"
            name="deletionPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {t(
              error === "wrong_password" ? "settings.deleteWrongPassword" : "settings.deleteFailed",
            )}
          </p>
        )}
        <div>
          <Button type="submit" variant="destructive" disabled={deleting}>
            {t(deleting ? "settings.deletingAccount" : "settings.deleteAccount")}
          </Button>
        </div>
      </form>
    </Section>
  );
}
