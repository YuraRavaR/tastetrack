import { Bookmark, List, ListPlus, RotateCw, SearchX, Star } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { HoldingList, RemovedListItem } from "../../shared/api";
import { maxListItems } from "../../shared/lists";
import * as api from "../api";
import {
  type Found,
  foundKey,
  foundLabel,
  foundManual,
  foundMediaItemId,
  foundMediaType,
  mediaItemOf,
} from "../catalog/found";
import { useCatalogSearch } from "../catalog/use-catalog-search";
import { useResultsScroll, useSearchQuery } from "../catalog/use-search-query";
import { useUserMediaItems } from "../catalog/use-user-media-items";
import {
  matchUserMediaItems,
  type UserMediaItem,
  userMediaItemStatus,
  withoutUserMediaItems,
} from "../catalog/user-media-items";
import { mediaWord, pageMediaType } from "../i18n/media-words";
import { t } from "../i18n/t";
import { listPath } from "../navigation/paths";
import { EmptyState } from "./EmptyState";
import { FilmListsDialog, type ListsFilm } from "./FilmListsDialog";
import { LogEntryDialog } from "./LogEntryDialog";
import { ManualMediaItemDialog } from "./ManualMediaItemDialog";
import { MediaTypeChips } from "./MediaTypeChips";
import { Poster } from "./Poster";
import { PosterGridItem } from "./PosterGridItem";
import { SearchField } from "./SearchField";
import { type FilmAction, FilmActionMessage, Toast } from "./Toast";

// The User's last action on a result, which the toast reports.
type LastAction = FilmAction & { found: Found };

// What the toast fills in: the film, and its Media Type.
function actionValues(found: Found) {
  return { film: foundLabel(found), mediaType: foundMediaType(found) };
}

type PlanError = "backlog_full" | "unavailable";

// What a result's row says of the User's Log Entries for it.
type RowLog = { currentRating: number | null; logEntryCount: number };

// How many of a result's Lists its row names, before saying how many more hold it.
const maxListChips = 2;

// Search as you type, with no button, under Media Type chips, with the query in the URL. The
// User's Media Items that match, those in their Library or on their Lists, come first, "In your
// Saved": a strip of covers matched against their titles on every keystroke, each with one status
// line and linking to its film's page. TMDB's results follow, "From TMDB", after a short pause in
// typing, without the User's Media Items,
// the User's own Manual Media Items first. A TMDB result with a Media Item links to its
// film's page, and shows the User's Current Rating, how many viewings they have and the Lists that
// hold it, and one without a Media Item yet adds it to the catalog when the User opens it, then opens
// its page. Any result can be marked Watched, which records a Log Entry for it, as a Revisit by
// default if it is in the Log, and takes it off the Watchlist with an undo. Want to watch is a
// toggle, which puts a result on the Watchlist or takes it off again, and any result can be added
// to or taken off the User's Lists. Below the results, a film search doesn't find can be added by
// hand, and then shows first.
export function FilmSearch() {
  const navigate = useNavigate();
  const backlogName = mediaWord(pageMediaType, "backlog");
  const inputId = useId();
  const [query, setQuery] = useSearchQuery();
  const search = useCatalogSearch(query);
  const userItems = useUserMediaItems(pageMediaType, query);
  // The User's Media Items have loaded, or failed to.
  const userItemsReady = userItems.status !== "loading";
  // Both blocks are in place once the User's Media Items are ready and TMDB answered.
  const rememberScroll = useResultsScroll(search.status === "done" && userItemsReady);
  const [logging, setLogging] = useState<Found | null>(null);
  const [listing, setListing] = useState<ListsFilm | null>(null);
  const [addingManually, setAddingManually] = useState(false);
  // Films added by hand since the search ran, by the query they were added from.
  const [added, setAdded] = useState<{ query: string; found: Found[] }>({ query: "", found: [] });
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [planError, setPlanError] = useState<PlanError | null>(null);
  // The result that couldn't join the catalog when the User opened it.
  const [openFailed, setOpenFailed] = useState<Found | null>(null);
  // Results logged since the search ran, which the search's own marks don't know about yet.
  const [loggedNow, setLoggedNow] = useState<ReadonlyMap<string, RowLog>>(new Map());
  // The Lists holding results since the User last put them on or took them off one.
  const [listedNow, setListedNow] = useState<ReadonlyMap<string, HoldingList[]>>(new Map());
  // Results put on or taken off the Watchlist since the search ran, by whether they are on it.
  const [plannedNow, setPlannedNow] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [planning, setPlanning] = useState<ReadonlySet<string>>(new Set());
  // Results that joined the catalog since the search ran, by their Media Item's id.
  const [catalogedNow, setCatalogedNow] = useState<ReadonlyMap<string, number>>(new Map());

  const logOf = (found: Found) => loggedNow.get(foundKey(found)) ?? found;
  const inLog = (found: Found) => logOf(found).logEntryCount > 0;
  const inBacklog = (found: Found) => plannedNow.get(foundKey(found)) ?? found.inBacklog;
  const mediaItemIdOf = (found: Found) => {
    return catalogedNow.get(foundKey(found)) ?? foundMediaItemId(found);
  };

  const trimmed = query.trim();
  const searched = new Set(search.results.map(foundKey));
  const matches = matchUserMediaItems(userItems.items, trimmed);
  const results = withoutUserMediaItems(
    [
      ...(added.query === trimmed
        ? added.found.filter((found) => !searched.has(foundKey(found)))
        : []),
      ...search.results,
    ],
    userItems.items,
  );
  // TMDB's results wait for the User's Media Items, so one never shows there before it moves up.
  const showResults = userItemsReady && results.length > 0;
  const noMatch =
    trimmed !== "" &&
    search.status === "done" &&
    userItemsReady &&
    matches.length === 0 &&
    results.length === 0;

  function markCataloged(found: Found, mediaItemId: number) {
    setCatalogedNow((current) => new Map(current).set(foundKey(found), mediaItemId));
  }

  // Adds a result to the catalog, as mediaItemOf does, so that it links to its page from now on.
  async function addToCatalog(found: Found) {
    const mediaItem = await mediaItemOf(found);
    if (mediaItem) markCataloged(found, mediaItem.id);
    return mediaItem;
  }

  // Opens a result's page, adding it to the catalog first when it has no Media Item yet.
  async function open(found: Found) {
    setOpenFailed(null);
    const mediaItem = await addToCatalog(found);
    if (!mediaItem) {
      setOpenFailed(found);
      return;
    }
    rememberScroll();
    navigate(`/items/${mediaItem.id}`);
  }

  function markPlanned(found: Found, planned: boolean) {
    setPlannedNow((current) => new Map(current).set(foundKey(found), planned));
  }

  function setPlanningOf(found: Found, busy: boolean) {
    setPlanning((current) => {
      const next = new Set(current);
      if (busy) next.add(foundKey(found));
      else next.delete(foundKey(found));
      return next;
    });
  }

  async function togglePlanned(found: Found) {
    const adding = !inBacklog(found);
    setPlanError(null);
    setPlanningOf(found, true);
    const mediaItem = await addToCatalog(found);
    const outcome = !mediaItem
      ? ({ ok: false, error: "unavailable" } as const)
      : adding
        ? await api.plan({ mediaItemId: mediaItem.id })
        : await api.removeFromBacklog(mediaItem.id);
    setPlanningOf(found, false);
    if (!outcome.ok) {
      setPlanError(outcome.error);
      return;
    }
    markPlanned(found, adding);
    userItems.changed();
    setLastAction({ kind: adding ? "planned" : "unplanned", found });
  }

  function logged(found: Found, entry: api.SavedLogEntry) {
    setLogging(null);
    setPlanError(null);
    setLastAction({
      kind: "logged",
      found,
      mediaItemId: entry.logEntry.mediaItem.id,
      removedFromBacklog: entry.removedFromBacklog,
    });
    const { currentRating, logEntryCount } = entry;
    setLoggedNow((current) => {
      return new Map(current).set(foundKey(found), { currentRating, logEntryCount });
    });
    markCataloged(found, entry.logEntry.mediaItem.id);
    if (entry.removedFromBacklog) markPlanned(found, false);
    userItems.changed();
  }

  // Puts a logged film back on the Watchlist where it was, with its Note.
  async function undo(found: Found, mediaItemId: number, removed: RemovedListItem) {
    setPlanError(null);
    const outcome = await api.plan({ mediaItemId, ...removed });
    if (!outcome.ok) {
      setPlanError(outcome.error);
      return;
    }
    markPlanned(found, true);
    userItems.changed();
    setLastAction({ kind: "putBack", found });
  }

  function markListed(found: Found, lists: HoldingList[]) {
    setListedNow((current) => new Map(current).set(foundKey(found), lists));
    userItems.changed();
  }

  function addedManually(found: Found) {
    setAddingManually(false);
    setPlanError(null);
    setAdded((current) => ({
      query: trimmed,
      found: [found, ...(current.query === trimmed ? current.found : [])],
    }));
    setLastAction({ kind: "added", found });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-3xl tracking-tight">
          <Label htmlFor={inputId} className="font-bold text-3xl leading-9">
            {t("search.title")}
          </Label>
        </h1>
        <SearchField id={inputId} value={query} onChange={setQuery} prominent />
        <MediaTypeChips current={pageMediaType} />
      </div>
      {trimmed === "" && (
        <p className="text-[0.9375rem] text-muted-foreground">{t("search.hint")}</p>
      )}
      <p aria-live="polite" className="text-muted-foreground text-sm empty:hidden">
        {search.status === "searching" && t("search.searching")}
      </p>
      <Toast onDismiss={() => setLastAction(null)}>
        {lastAction && (
          <FilmActionMessage
            action={lastAction}
            {...actionValues(lastAction.found)}
            onUndo={(mediaItemId, removed) => undo(lastAction.found, mediaItemId, removed)}
          />
        )}
      </Toast>
      {planError && (
        <p role="alert" className="text-destructive text-sm">
          {planError === "backlog_full"
            ? t("backlog.full", { backlogName, max: maxListItems })
            : t("backlog.updateFailed", { backlogName })}
        </p>
      )}
      {openFailed && (
        <p role="alert" className="text-destructive text-sm">
          {t("search.openFailed", { film: foundLabel(openFailed) })}
        </p>
      )}
      {trimmed !== "" && userItems.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("search.savedUnavailable")}
        </p>
      )}
      {search.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("search.unavailable")}
        </p>
      )}
      {matches.length > 0 && <UserMediaItemMatches items={matches} onOpened={rememberScroll} />}
      {showResults && (
        <ResultsBlock heading={t("search.tmdb")} count={results.length}>
          {(headingId) => (
            <ul
              aria-labelledby={headingId}
              className="flex flex-col divide-y rounded-lg border bg-card"
            >
              {results.map((found) => (
                <SearchResult
                  key={foundKey(found)}
                  found={found}
                  mediaItemId={mediaItemIdOf(found)}
                  onOpened={rememberScroll}
                  onOpen={() => open(found)}
                  log={logOf(found)}
                  lists={listedNow.get(foundKey(found)) ?? found.lists}
                  inBacklog={inBacklog(found)}
                  planning={planning.has(foundKey(found))}
                  onExperienced={() => setLogging(found)}
                  onTogglePlanned={() => togglePlanned(found)}
                  onListed={() =>
                    setListing({
                      label: foundLabel(found),
                      mediaItem: () => addToCatalog(found),
                      onHeld: (lists) => markListed(found, lists),
                    })
                  }
                />
              ))}
            </ul>
          )}
        </ResultsBlock>
      )}
      {noMatch ? (
        <EmptyState
          icon={SearchX}
          message={t("search.noMatch", { query: trimmed })}
          action={{
            label: t("search.addManually"),
            onClick: () => setAddingManually(true),
            outline: true,
          }}
        />
      ) : (
        trimmed !== "" &&
        search.status === "done" && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">{t("search.notFound")}</span>
            <Button variant="outline" size="sm" onClick={() => setAddingManually(true)}>
              {t("search.addManually")}
            </Button>
          </div>
        )
      )}
      <LogEntryDialog
        found={logging}
        mediaItemId={logging && mediaItemIdOf(logging)}
        inLog={logging !== null && inLog(logging)}
        inBacklog={logging !== null && inBacklog(logging)}
        onClose={() => setLogging(null)}
        onLogged={logged}
      />
      <FilmListsDialog film={listing} onClose={() => setListing(null)} />
      <ManualMediaItemDialog
        open={addingManually}
        title={trimmed}
        onClose={() => setAddingManually(false)}
        onSaved={(mediaItem) => addedManually(foundManual(mediaItem))}
      />
    </section>
  );
}

// One block of results: a heading with how many it holds, then its list, which the heading names.
function ResultsBlock({
  heading,
  count,
  children,
}: {
  heading: string;
  count: number;
  children: (headingId: string) => ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2.5">
      <h2 className="flex items-baseline gap-1.5 font-bold text-base">
        <span id={headingId}>{heading}</span>
        <span className="font-medium text-muted-foreground text-sm">{count}</span>
      </h2>
      {children(headingId)}
    </section>
  );
}

// "In your Saved": the User's Media Items that match, as covers in a sideways strip on a phone,
// bleeding to the screen's edges, and in a grid from md. Each cover opens its film's page, where
// the User acts on it, and remembers the place in the results for coming Back.
function UserMediaItemMatches({
  items,
  onOpened,
}: {
  items: readonly UserMediaItem[];
  onOpened: () => void;
}) {
  return (
    <ResultsBlock heading={t("search.saved")} count={items.length}>
      {(headingId) => (
        <ul
          aria-labelledby={headingId}
          className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] md:gap-x-4 md:gap-y-4.5 md:overflow-visible md:px-0 md:pb-0"
        >
          {items.map((item) => (
            <PosterGridItem
              key={item.mediaItem.id}
              mediaItem={item.mediaItem}
              meta={<UserMediaItemStatusLine item={item} />}
              className="w-26 shrink-0 md:w-auto"
              onOpened={onOpened}
            />
          ))}
        </ul>
      )}
    </ResultsBlock>
  );
}

// A User's Media Item's one status line, cut with an ellipsis: "★ 5 · Watchlist",
// "★ 4.5 · Watched", "Watchlist" with a bookmark, or the oldest of its Lists.
function UserMediaItemStatusLine({ item }: { item: UserMediaItem }) {
  const status = userMediaItemStatus(item);
  if (!status) return null;
  const mediaType = item.mediaItem.mediaType;
  if (status.kind === "rated") {
    return (
      <StatusLine
        icon={<Star role="img" aria-label={t("rating.label")} className="size-3 fill-current" />}
        className="font-semibold text-primary-strong"
      >
        {t("search.savedRating", {
          rating: status.rating,
          status: mediaWord(mediaType, status.inBacklog ? "backlog" : "experienced"),
        })}
      </StatusLine>
    );
  }
  if (status.kind === "backlog") {
    return (
      <StatusLine icon={<Bookmark aria-hidden className="size-3 fill-current" />}>
        {mediaWord(mediaType, "backlog")}
      </StatusLine>
    );
  }
  return (
    <StatusLine icon={<List role="img" aria-label={t("search.savedList")} className="size-3.5" />}>
      {status.name}
    </StatusLine>
  );
}

function StatusLine({
  icon,
  className = "font-medium",
  children,
}: {
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1 [&>svg]:shrink-0", className)}>
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

function SearchResult({
  found,
  mediaItemId,
  onOpened,
  onOpen,
  log,
  lists,
  inBacklog,
  planning,
  onExperienced,
  onTogglePlanned,
  onListed,
}: {
  found: Found;
  mediaItemId: number | null;
  onOpened: () => void;
  onOpen: () => Promise<void>;
  log: RowLog;
  lists: HoldingList[];
  inBacklog: boolean;
  planning: boolean;
  onExperienced: () => void;
  onTogglePlanned: () => void;
  onListed: () => void;
}) {
  const mediaType = foundMediaType(found);
  const { currentRating, logEntryCount } = log;
  const inLog = logEntryCount > 0;
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    await onOpen();
    setOpening(false);
  }

  return (
    <li className="flex items-start gap-3 p-3 md:items-center">
      <Poster subject={found} size="search" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {mediaItemId !== null ? (
            <Link
              to={`/items/${mediaItemId}`}
              onClick={onOpened}
              className="break-words font-semibold underline-offset-4 hover:underline focus-visible:underline"
            >
              {foundLabel(found)}
            </Link>
          ) : (
            <button
              type="button"
              onClick={open}
              disabled={opening}
              className="cursor-pointer break-words text-left font-semibold underline-offset-4 hover:underline focus-visible:underline disabled:cursor-wait"
            >
              {foundLabel(found)}
            </button>
          )}
          <span className="flex flex-wrap items-center gap-x-2 text-xs empty:hidden">
            {found.kind === "manual" && (
              <span className="font-medium text-muted-foreground">{t("search.addedByYou")}</span>
            )}
            {currentRating !== null && mediaItemId !== null && (
              <Link
                to={`/items/${mediaItemId}`}
                onClick={onOpened}
                className="flex items-center gap-1 font-semibold text-primary-strong underline-offset-4 hover:underline focus-visible:underline"
              >
                <Star role="img" aria-label={t("rating.label")} className="size-3 fill-current" />
                {mediaWord(mediaType, "ratingAndCount", {
                  rating: currentRating,
                  count: logEntryCount,
                })}
              </Link>
            )}
          </span>
          <ListChips lists={lists} onOpened={onOpened} />
        </div>
        <div className="flex shrink-0 gap-1.5 md:gap-2">
          <Button
            variant={inLog ? "pressed" : "outline"}
            className="h-11 gap-1.5 px-2 font-semibold has-[>svg]:px-2 md:h-9 md:w-37.5"
            onClick={onExperienced}
          >
            {inLog && <RotateCw aria-hidden className="hidden min-[380px]:block" />}
            {mediaWord(mediaType, inLog ? "experiencedAgain" : "markExperienced")}
          </Button>
          <Button
            variant={inBacklog ? "pressed" : "outline"}
            size="icon"
            className="size-11 md:size-9"
            disabled={planning}
            aria-pressed={inBacklog}
            aria-label={mediaWord(mediaType, "planned")}
            title={mediaWord(mediaType, "planned")}
            onClick={onTogglePlanned}
          >
            <Bookmark aria-hidden className={cn(inBacklog && "fill-current")} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 md:size-9"
            aria-label={t("filmLists.open")}
            title={t("filmLists.open")}
            onClick={onListed}
          >
            <ListPlus aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  );
}

// The User's Lists holding a result, each linking to its List: the first few, then how many more.
function ListChips({ lists, onOpened }: { lists: HoldingList[]; onOpened: () => void }) {
  if (lists.length === 0) return null;
  const more = lists.length - maxListChips;
  return (
    <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
      <List role="img" aria-label={t("search.lists")} className="mr-0.5 size-3.5 shrink-0" />
      {lists.slice(0, maxListChips).map((list) => (
        <Badge
          key={list.id}
          variant="outline"
          className="block min-w-0 max-w-1/2 shrink truncate text-muted-foreground"
          asChild
        >
          <Link to={listPath(list.id)} onClick={onOpened}>
            {list.name}
          </Link>
        </Badge>
      ))}
      {more > 0 && (
        <Badge variant="outline" className="text-muted-foreground">
          {t("search.moreLists", { count: more })}
        </Badge>
      )}
    </div>
  );
}
