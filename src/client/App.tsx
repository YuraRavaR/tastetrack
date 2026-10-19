import { useEffect, useState } from "react";
import type { HealthResponse } from "../shared/api";
import { t } from "./i18n/t";

type HealthStatus = "checking" | "ok" | "unavailable";

export function App() {
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
    <main>
      <h1>{t("app.name")}</h1>
      <p>{t("app.tagline")}</p>
      <p role="status">{t(`health.${health}`)}</p>
    </main>
  );
}
