import { useEffect, useState } from "react";
import type { HealthResponse } from "../../shared/api";
import { FilmSearch } from "../components/FilmSearch";
import { t } from "../i18n/t";

type HealthStatus = "checking" | "ok" | "unavailable";

export function HomePage() {
  const [health, setHealth] = useState<HealthStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
        const body = (await response.json()) as HealthResponse;
        setHealth(body.status === "ok" ? "ok" : "unavailable");
      })
      .catch(() => {
        if (!controller.signal.aborted) setHealth("unavailable");
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl tracking-tight">{t("app.tagline")}</h1>
        <p role="status" className="text-muted-foreground text-sm">
          {t(`health.${health}`)}
        </p>
      </div>
      <FilmSearch />
    </div>
  );
}
