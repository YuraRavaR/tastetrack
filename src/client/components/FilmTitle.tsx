import type { FilmMetadata } from "../../shared/api";
import { filmLabel } from "../catalog/film-label";
import { t } from "../i18n/t";

// A film's label, "Amélie (Le Fabuleux Destin d'Amélie Poulain, 2001)", with its Ukrainian title
// as a secondary line when it has a different one.
export function FilmTitle({ metadata }: { metadata: FilmMetadata | null }) {
  if (!metadata) return <span className="text-muted-foreground">{t("film.unknown")}</span>;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="break-words">{filmLabel(metadata)}</span>
      {metadata.ukrainianTitle && (
        <span lang="uk" className="break-words text-muted-foreground text-sm">
          {metadata.ukrainianTitle}
        </span>
      )}
    </span>
  );
}
