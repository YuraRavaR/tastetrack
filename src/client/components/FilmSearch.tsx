import { Film } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogSearchResult } from "../../shared/api";
import { filmLabel } from "../catalog/film-label";
import { useCatalogSearch } from "../catalog/use-catalog-search";
import { t } from "../i18n/t";

// Search as you type, with no button: results follow a short pause in typing.
export function FilmSearch() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const search = useCatalogSearch(query);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{t("search.label")}</Label>
        <Input
          id={inputId}
          type="search"
          autoComplete="off"
          maxLength={100}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p aria-live="polite" className="text-muted-foreground text-sm empty:hidden">
        {search.status === "searching" && t("search.searching")}
        {search.status === "done" && search.results.length === 0 && t("search.none")}
      </p>
      {search.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("search.unavailable")}
        </p>
      )}
      {search.results.length > 0 && (
        <ul
          aria-label={t("search.resultsLabel")}
          className="flex flex-col divide-y rounded-lg border"
        >
          {search.results.map((result) => (
            <SearchResult
              key={`${result.externalReference.source}:${result.externalReference.id}`}
              result={result}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SearchResult({ result }: { result: CatalogSearchResult }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      {result.posterUrl ? (
        <img
          src={result.posterUrl}
          alt=""
          loading="lazy"
          className="h-18 w-12 shrink-0 rounded-sm bg-muted object-cover"
        />
      ) : (
        <div className="flex h-18 w-12 shrink-0 items-center justify-center rounded-sm bg-muted">
          <Film aria-hidden className="size-5 text-muted-foreground" />
        </div>
      )}
      <span className="min-w-0 break-words">{filmLabel(result)}</span>
    </li>
  );
}
