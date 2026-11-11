import { ListCheck } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { List } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import {
  type Found,
  foundAuthorsAndYear,
  foundKey,
  foundLabel,
  foundName,
  mediaItemKey,
  mediaItemOf,
} from "../catalog/found";
import { useCatalogSearch } from "../catalog/use-catalog-search";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { Poster } from "./Poster";
import { SearchField } from "./SearchField";
import {
  SheetFooter,
  SheetHeader,
  sheetBodyClasses,
  sheetClasses,
  sheetMainButtonClasses,
} from "./sheet";

// "Add films" on a List (`docs/mockups/collections/`, Settled), or "Add books": a search of the
// List's Media Type as you type, as on the Search page, the User's own Manual Media Items first,
// where each one not yet in the List can be added to its end and each one in it says so. A book is
// named without its year, which follows its authors on the next line, as in Search. `onAdded` reloads the List, which then marks the
// film. A bottom sheet on a phone, a centred dialog from `md`, open while `open` is set. It
// unmounts its search once closed, so each opening starts afresh.
export function AddFilmsDialog({
  open,
  list,
  onClose,
  onAdded,
}: {
  open: boolean;
  list: List;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      {/* Full height on a phone, so the field stays put as results come and go. */}
      <DialogContent
        showCloseButton={false}
        className={cn(sheetClasses, "h-[calc(100dvh-3rem)] md:h-auto")}
      >
        <AddFilms list={list} onAdded={onAdded} />
      </DialogContent>
    </Dialog>
  );
}

function AddFilms({ list, onAdded }: { list: List; onAdded: () => Promise<void> }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const search = useCatalogSearch(list.mediaType, query);
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
    <>
      <SheetHeader
        title={mediaWord(list.mediaType, "collectionAddTitle", { list: list.name })}
        description={mediaWord(list.mediaType, "collectionAddDescription")}
      />
      {/* The field stays above the results, which scroll. */}
      <div className="px-5 pt-3.5 md:px-6 md:pt-4">
        <Label htmlFor={inputId} className="sr-only">
          {mediaWord(list.mediaType, "search")}
        </Label>
        <SearchField id={inputId} value={query} onChange={setQuery} prominent autoFocus />
      </div>
      <div className={cn(sheetBodyClasses, "gap-3 pt-3 md:pt-3")}>
        <p aria-live="polite" className="text-muted-foreground text-sm empty:hidden">
          {search.status === "searching" && t("search.searching")}
          {search.status === "done" && search.results.length === 0 && t("search.none")}
        </p>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error === "list_full"
              ? mediaWord(list.mediaType, "collectionFull", { max: maxListItems })
              : error === "already_in_list"
                ? mediaWord(list.mediaType, "collectionAlreadyIn")
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
              const book = list.mediaType === "book";
              const authorsAndYear = book ? foundAuthorsAndYear(found) : null;
              return (
                <li key={key} className="flex items-center gap-3 px-3 py-2">
                  <Poster subject={found} size="thumbnail" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="break-words">
                      {book ? foundName(found) : foundLabel(found)}
                    </span>
                    {authorsAndYear && (
                      <span className="break-words text-muted-foreground text-sm">
                        {authorsAndYear}
                      </span>
                    )}
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
                      className="h-10 shrink-0 rounded-full px-4 md:h-9"
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
      </div>
      <SheetFooter className="grid-cols-1">
        <DialogClose asChild>
          <Button type="button" className={sheetMainButtonClasses}>
            {t("addFilms.done")}
          </Button>
        </DialogClose>
      </SheetFooter>
    </>
  );
}
