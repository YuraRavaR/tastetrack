import { ListCheck } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { List } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import { type Found, foundKey, foundLabel, mediaItemKey, mediaItemOf } from "../catalog/found";
import { useCatalogSearch } from "../catalog/use-catalog-search";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { Poster } from "./Poster";
import { SearchField } from "./SearchField";

// Search as you type, as on the home page, the User's own Manual Media Items first, where each
// film not yet in the List can be added to its end. `onAdded` reloads the List, which then marks
// the film as in it.
export function AddToListSearch({ list, onAdded }: { list: List; onAdded: () => Promise<void> }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const search = useCatalogSearch(query);
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<api.AddToListError | null>(null);
  const inList = new Set(list.items.map((item) => mediaItemKey(item.mediaItem)));

  function setAddingOf(found: Found, busy: boolean) {
    setAdding((current) => {
      const next = new Set(current);
      if (busy) next.add(foundKey(found));
      else next.delete(foundKey(found));
      return next;
    });
  }

  async function add(found: Found) {
    setError(null);
    setAddingOf(found, true);
    const mediaItem = await mediaItemOf(found);
    const outcome = mediaItem
      ? await api.addToList(list.id, { mediaItemId: mediaItem.id })
      : ({ ok: false, error: "unavailable" } as const);
    if (!outcome.ok) setError(outcome.error);
    await onAdded();
    setAddingOf(found, false);
  }

  return (
    <section aria-label={t("list.addLabel")} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{mediaWord(list.mediaType, "search")}</Label>
        <SearchField id={inputId} value={query} onChange={setQuery} />
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
          {search.results.map((found) => {
            const key = foundKey(found);
            return (
              <li key={key} className="flex items-center gap-3 px-3 py-2">
                <Poster item={found} size="thumbnail" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="break-words">{foundLabel(found)}</span>
                  {inList.has(key) && (
                    <Badge variant="soft">
                      <ListCheck aria-hidden />
                      {t("list.inList")}
                    </Badge>
                  )}
                </div>
                {!inList.has(key) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={adding.has(key)}
                    onClick={() => add(found)}
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
