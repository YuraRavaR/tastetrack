import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { maxDisplayNameLength, passwordLength } from "../../shared/accounts";
import type { User } from "../../shared/api";
import * as api from "../api";
import { useAuth } from "../auth";
import { FormError } from "../components/FormError";
import { FormField } from "../components/FormField";
import { t } from "../i18n/t";
import { usePageTitle } from "../navigation/page-title";

// The User's own settings: the Display Name others see on Share Links, their password, and
// deleting their account. Three cards stacked (`docs/mockups/account/`).
export function SettingsPage() {
  const { state } = useAuth();
  usePageTitle([t("settings.title")]);
  if (state.status !== "authenticated") return null;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <h1 className="font-bold text-[1.75rem] leading-tight tracking-tight md:text-[2rem]">
        {t("settings.title")}
      </h1>
      <DisplayNameSection user={state.user} />
      <PasswordSection username={state.user.username} />
      <DeletionSection username={state.user.username} />
    </div>
  );
}

// A card that is a landmark named by its title, so each form's messages stay apart from the
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
    <Card
      aria-labelledby={titleId}
      role="region"
      className="gap-3.5 rounded-xl p-4.5 shadow-none md:gap-4 md:p-6"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id={titleId} className="font-semibold text-lg leading-tight">
          {title}
        </h2>
        {description && <p className="text-muted-foreground text-sm leading-snug">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

// Fields sit on the page's ground so they stand out from the card, and stop at 28rem from `md`.
const fieldClasses = "bg-background md:max-w-md dark:bg-background";
const buttonClasses = "h-11 px-4.5 font-semibold";

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
      <form className="flex flex-col gap-3.5 md:gap-4" onSubmit={submit}>
        <FormField
          id="displayName"
          label={t("settings.displayName")}
          rules={t("settings.displayNameHint", {
            max: maxDisplayNameLength,
            username: user.username,
          })}
          className={fieldClasses}
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            setOutcome(null);
          }}
          maxLength={maxDisplayNameLength}
          autoComplete="nickname"
        />
        {outcome === "saved" && (
          <p role="status" className="text-muted-foreground text-sm">
            {t("settings.displayNameSaved")}
          </p>
        )}
        {outcome === "failed" && <FormError>{t("settings.displayNameFailed")}</FormError>}
        <div>
          <Button type="submit" className={buttonClasses} disabled={saving}>
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
      <form className="flex flex-col gap-3.5 md:gap-4" onSubmit={submit}>
        {/* Tells a password manager whose password this is. */}
        <input
          type="text"
          name="username"
          value={username}
          autoComplete="username"
          readOnly
          hidden
        />
        <FormField
          id="currentPassword"
          label={t("settings.currentPassword")}
          className={fieldClasses}
          type="password"
          autoComplete="current-password"
          required
          invalid={outcome === "wrong_password"}
          // Typing in the field at fault clears the error, as on the sign-in card.
          onChange={() => outcome === "wrong_password" && setOutcome(null)}
        />
        <FormField
          id="newPassword"
          label={t("settings.newPassword")}
          rules={t("settings.newPasswordRules")}
          className={fieldClasses}
          type="password"
          minLength={passwordLength.min}
          maxLength={passwordLength.max}
          autoComplete="new-password"
          required
        />
        {outcome === "changed" && (
          <p role="status" className="text-muted-foreground text-sm">
            {t("settings.passwordChanged")}
          </p>
        )}
        {outcome && outcome !== "changed" && (
          <FormError>
            {t(outcome === "wrong_password" ? "settings.wrongPassword" : "settings.passwordFailed")}
          </FormError>
        )}
        <div>
          <Button type="submit" className={buttonClasses} disabled={changing}>
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
      <form className="flex flex-col gap-3.5 md:gap-4" onSubmit={submit}>
        {/* Tells a password manager whose password this is. */}
        <input
          type="text"
          name="username"
          value={username}
          autoComplete="username"
          readOnly
          hidden
        />
        <FormField
          id="deletionPassword"
          label={t("settings.deletePassword")}
          className={fieldClasses}
          type="password"
          autoComplete="current-password"
          required
          invalid={error === "wrong_password"}
          onChange={() => error === "wrong_password" && setError(null)}
        />
        {error && (
          <FormError>
            {t(
              error === "wrong_password" ? "settings.deleteWrongPassword" : "settings.deleteFailed",
            )}
          </FormError>
        )}
        <div>
          <Button type="submit" variant="destructive" className={buttonClasses} disabled={deleting}>
            {t(deleting ? "settings.deletingAccount" : "settings.deleteAccount")}
          </Button>
        </div>
      </form>
    </Section>
  );
}
