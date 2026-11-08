import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { maxActiveInviteCodes } from "../../shared/accounts";
import type { InviteCode } from "../../shared/api";
import * as api from "../api";
import { FormError } from "../components/FormError";
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

  // The address of this deployment, so the text names the one the friend should open.
  const registerUrl = `${window.location.origin}/register`;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <h1 className="font-bold text-[1.75rem] leading-tight tracking-tight md:text-[2rem]">
        {t("invites.title")}
      </h1>
      <p className="text-muted-foreground text-sm leading-snug md:max-w-160 md:text-[15px]">
        {t("invites.explanation", { registerUrl, max: maxActiveInviteCodes })}
      </p>
      <div>
        <Button className="h-11 px-4.5 font-semibold" onClick={generate} disabled={generating}>
          {t(generating ? "invites.generating" : "invites.generate")}
        </Button>
      </div>
      {error && (
        <FormError>
          {error === "limit"
            ? t("invites.limit", { max: maxActiveInviteCodes })
            : t("invites.unavailable")}
        </FormError>
      )}
      {codes.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("invites.loading")}</p>
      )}
      {codes.status === "failed" && <FormError>{t("invites.unavailable")}</FormError>}
      {codes.status === "loaded" && codes.codes.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("invites.none")}</p>
      )}
      {codes.status === "loaded" && codes.codes.length > 0 && (
        <ul
          aria-label={t("invites.listLabel")}
          className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card"
        >
          {codes.codes.map((code) => (
            <li
              key={code.code}
              className="flex flex-col gap-1 px-4.5 py-3.5 md:min-h-15 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-4 md:px-6 md:py-3"
            >
              <code className="font-mono text-lg tracking-[0.08em]">{code.code}</code>
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
