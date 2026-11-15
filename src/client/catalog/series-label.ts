import type { SeriesMetadata, SeriesStatus } from "../../shared/api";
import { t } from "../i18n/t";

// The statuses under which TMDB has more of a series coming: it is being made, or comes back.
const runningStatuses: readonly SeriesStatus[] = ["returning", "in_production"];

// The years a series aired: "2008–2013", "2019" when it began and ended in one year, and "2019–"
// while it is running. Null when only the year it began is known, since its title says that.
function yearsOf({ firstAirYear, lastAirYear, status }: SeriesMetadata): string | null {
  if (firstAirYear === null) return null;
  const first = String(firstAirYear);
  if (status && runningStatuses.includes(status)) return t("series.yearsRunning", { first });
  if (lastAirYear === null) return null;
  if (lastAirYear === firstAirYear) return first;
  return t("series.yearsRange", { first, last: String(lastAirYear) });
}

// What a series' page says under its title, as far as it is known: the years it aired, how many
// seasons it has and whether more are coming, "2008–2013 · 5 seasons · Ended". Null when none
// of it is known, as of a series added by hand.
export function seriesFacts(metadata: SeriesMetadata): string | null {
  const { seasons, status } = metadata;
  const facts = [
    yearsOf(metadata),
    seasons.length > 0 ? t("series.seasons", { count: seasons.length }) : null,
    status ? t(`series.status.${status}`) : null,
  ].filter((fact) => fact !== null);
  return facts.length > 0 ? facts.join(" · ") : null;
}
