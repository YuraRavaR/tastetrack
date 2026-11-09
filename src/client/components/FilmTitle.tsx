import { cn } from "@/lib/utils";
import type { FilmMetadata } from "../../shared/api";
import { filmFacts, filmLabel } from "../catalog/film-label";
import { t } from "../i18n/t";

// A film's label, "Amélie (Le Fabuleux Destin d'Amélie Poulain, 2001)", with its Ukrainian title
// as a secondary line when it has a different one. Without metadata it is a placeholder while the
// page is `loading` it, and says the details are unavailable after.
export function FilmTitle({
  metadata,
  loading = false,
}: {
  metadata: FilmMetadata | null;
  loading?: boolean;
}) {
  if (!metadata) {
    return (
      <span className={cn("text-muted-foreground", loading && "animate-pulse")}>
        {t(loading ? "film.loading" : "film.unknown")}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-col">
      <span className="break-words">{filmLabel(metadata)}</span>
      {metadata.ukrainianTitle && (
        <span
          lang="uk"
          className="mt-0.5 break-words font-semibold text-muted-foreground text-sm tracking-normal sm:text-[15px]"
        >
          {metadata.ukrainianTitle}
        </span>
      )}
    </span>
  );
}

// A film's runtime and genres, as far as they are known: "122 min · Comedy, Romance". Nothing
// while its metadata is missing or holds neither.
export function FilmFacts({ metadata }: { metadata: FilmMetadata | null }) {
  const facts = metadata && filmFacts(metadata);
  return facts ? <p className="text-[13px] text-muted-foreground sm:text-[15px]">{facts}</p> : null;
}
