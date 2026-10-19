import { CircleCheck } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogSearchResult } from "../../shared/api";
import { maxSearchQueryLength } from "../../shared/catalog";
import { filmLabel } from "../catalog/film-label";
import { useCatalogSearch } from "../catalog/use-catalog-search";
import { t } from "../i18n/t";
import { LogEntryDialog } from "./LogEntryDialog";
import { Poster } from "./Poster";

function keyOf({ externalReference: { source, id } }: CatalogSearchResult): string {
  return `${source}:${id}`;
}

// Search as you type, with no button: results follow a short pause in typing. Any result can be
// marked Watched, which records a Log Entry for it.
export function FilmSearch() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const search = useCatalogSearch(query);
  const [logging, setLogging] = useState<CatalogSearchResult | null>(null);
  const [lastLogged, setLastLogged] = useState<CatalogSearchResult | null>(null);
  // Results logged since the search ran, which the search's own marks don't know about yet.
  const [loggedNow, setLoggedNow] = useState<ReadonlySet<string>>(new Set());

  function logged(result: CatalogSearchResult) {
    setLogging(null);
    setLastLogged(result);
    setLoggedNow((current) => new Set(current).add(keyOf(result)));
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{t("search.label")}</Label>
        <Input
          id={inputId}
          type="search"
          autoComplete="off"
          maxLength={maxSearchQueryLength}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p aria-live="polite" className="text-muted-foreground text-sm empty:hidden">
        {search.status === "searching" && t("search.searching")}
        {search.status === "done" && search.results.length === 0 && t("search.none")}
      </p>
      <p role="status" className="text-sm empty:hidden">
        {lastLogged && (
          <>
            {t("logEntry.saved", { film: filmLabel(lastLogged) })}{" "}
            <Link to="/log" className="text-primary underline-offset-4 hover:underline">
              {t("log.view")}
            </Link>
          </>
        )}
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
              key={keyOf(result)}
              result={result}
              inLog={result.inLog || loggedNow.has(keyOf(result))}
              onExperienced={() => setLogging(result)}
            />
          ))}
        </ul>
      )}
      <LogEntryDialog result={logging} onClose={() => setLogging(null)} onLogged={logged} />
    </section>
  );
}

function SearchResult({
  result,
  inLog,
  onExperienced,
}: {
  result: CatalogSearchResult;
  inLog: boolean;
  onExperienced: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <Poster url={result.posterUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="break-words">{filmLabel(result)}</span>
        {inLog && (
          <span className="flex items-center gap-1 text-muted-foreground text-sm">
            <CircleCheck aria-hidden className="size-4 text-primary" />
            {t("search.inLog")}
          </span>
        )}
      </div>
      <Button variant="outline" size="sm" className="shrink-0" onClick={onExperienced}>
        {t("search.watched")}
      </Button>
    </li>
  );
}
