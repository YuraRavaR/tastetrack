import { ListCheck } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogSearchResult, ExternalReference, List } from "../../shared/api";
import { maxSearchQueryLength } from "../../shared/catalog";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import { filmLabel } from "../catalog/film-label";
import { useCatalogSearch } from "../catalog/use-catalog-search";
import { t } from "../i18n/t";
import { Poster } from "./Poster";

function keyOf({ source, id }: ExternalReference): string {
  return `${source}:${id}`;
}

// Search as you type, as on the home page, where each film not yet in the List can be added to
// its end. `onAdded` reloads the List, which then marks the film as in it.
export function AddToListSearch({ list, onAdded }: { list: List; onAdded: () => Promise<void> }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const search = useCatalogSearch(query);
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<api.AddToListError | null>(null);
  const inList = new Set(list.items.map((item) => keyOf(item.mediaItem.externalReference)));

  function setAddingOf(result: CatalogSearchResult, busy: boolean) {
    setAdding((current) => {
      const next = new Set(current);
      if (busy) next.add(keyOf(result.externalReference));
      else next.delete(keyOf(result.externalReference));
      return next;
    });
  }

  async function add(result: CatalogSearchResult) {
    setError(null);
    setAddingOf(result, true);
    const mediaItem = await api.addToCatalog(result);
    const outcome = mediaItem
      ? await api.addToList(list.id, { mediaItemId: mediaItem.id })
      : ({ ok: false, error: "unavailable" } as const);
    if (!outcome.ok) setError(outcome.error);
    await onAdded();
    setAddingOf(result, false);
  }

  return (
    <section aria-label={t("list.addLabel")} className="flex flex-col gap-3">
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
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error === "list_full"
            ? t("list.full", { max: maxListItems })
            : error === "already_in_list"
              ? t("list.alreadyIn")
              : t("list.updateFailed")}
        </p>
      )}
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
          {search.results.map((result) => {
            const key = keyOf(result.externalReference);
            return (
              <li key={key} className="flex items-center gap-3 px-3 py-2">
                <Poster url={result.posterUrl} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="break-words">{filmLabel(result)}</span>
                  {inList.has(key) && (
                    <span className="flex items-center gap-1 text-muted-foreground text-sm">
                      <ListCheck aria-hidden className="size-4 text-primary" />
                      {t("list.inList")}
                    </span>
                  )}
                </div>
                {!inList.has(key) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={adding.has(key)}
                    onClick={() => add(result)}
                  >
                    {t("list.add")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
