import type { Progress } from "../../shared/progress";
import { t } from "../i18n/t";

// A Progress in short, as a Thought shows it: "S2 · E5", "p. 142".
export function progressLabel(progress: Progress): string {
  return progress.mediaType === "series"
    ? t("progress.episode", { season: progress.season, episode: progress.episode })
    : t("progress.pageShort", { page: progress.page });
}
