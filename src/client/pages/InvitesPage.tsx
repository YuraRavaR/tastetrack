import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { maxActiveInviteCodes } from "../../shared/accounts";
import type { InviteCode } from "../../shared/api";
import * as api from "../api";
import { formatDate, t } from "../i18n/t";

type Codes =
  | { status: "loading" }
  | { status: "loaded"; codes: InviteCode[] }
  | { status: "failed" };

export function InvitesPage() {
  const [codes, setCodes] = useState<Codes>({ status: "loading" });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<"limit" | "unavailable" | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchInviteCodes()
      .then((loaded) => {
        if (!cancelled) setCodes({ status: "loaded", codes: loaded });
      })
      .catch(() => {
        if (!cancelled) setCodes({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function generate() {
    setGenerating(true);
    const result = await api.generateInviteCode();
    setGenerating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    // The API lists codes soonest to expire first, so the newest goes last.
    setCodes((current) => ({
      status: "loaded",
      codes: [...(current.status === "loaded" ? current.codes : []), result.inviteCode],
    }));
  }

  const registerUrl = `${window.location.origin}/register`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold text-2xl tracking-tight">{t("invites.title")}</h1>
      <p className="text-muted-foreground text-sm">
        {t("invites.explanation", { registerUrl, max: maxActiveInviteCodes })}
      </p>
      <div>
        <Button onClick={generate} disabled={generating}>
          {t(generating ? "invites.generating" : "invites.generate")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error === "limit"
            ? t("invites.limit", { max: maxActiveInviteCodes })
            : t("invites.unavailable")}
        </p>
      )}
      {codes.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("invites.loading")}</p>
      )}
      {codes.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("invites.unavailable")}
        </p>
      )}
      {codes.status === "loaded" && codes.codes.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("invites.none")}</p>
      )}
      {codes.status === "loaded" && codes.codes.length > 0 && (
        <ul
          aria-label={t("invites.listLabel")}
          className="flex flex-col divide-y rounded-lg border"
        >
          {codes.codes.map((code) => (
            <li
              key={code.code}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <code className="font-mono text-lg tracking-wider">{code.code}</code>
              <span className="text-muted-foreground text-sm">
                {t("invites.expires", { date: formatDate(new Date(code.expiresAt)) })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
