import { ArrowDownUp, Bookmark, ChevronLeft, Eye, type LucideIcon, Search } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import type { LibraryItem, MediaType } from "../../shared/api";
import { ratingStars } from "../../shared/log";
import * as api from "../api";
import { useMetadataFill } from "../catalog/use-metadata-fill";
import { type Choice, ChoiceChip } from "../components/ChoiceChip";
import { EmptyState } from "../components/EmptyState";
import { PosterGridItem } from "../components/PosterGridItem";
import { RatingValue } from "../components/Rating";
import { SegmentedLinks } from "../components/SegmentedLinks";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import {
  type LibraryTab,
  libraryPath,
  libraryTabItems,
  libraryTabOfSlug,
  libraryTabs,
  mediaTypeOfSlug,
} from "../library/library-tabs";
import {
  changeView,
  decadeChoices,
  filtersOf,
  genreChoices,
  type LibrarySort,
  type LibraryView,
  librarySorts,
  libraryView,
  ratingFloors,
  rememberedSort,
  rememberSort,
  showLibrary,
} from "../library/library-view";
import { savedPath, searchPath } from "../navigation/paths";

// What differs between the two tabs: the tab's name, its empty state, and what each poster shows
// besides its title.
interface TabParts {
  name: string;
  empty: {
    icon: LucideIcon;
    message: string;
    action: { label: string; to: string; icon?: LucideIcon };
  };
  meta(item: LibraryItem, year: number | null | undefined): ReactNode;
  mark(item: LibraryItem): string | undefined;
}

function tabParts(mediaType: MediaType): Record<LibraryTab, TabParts> {
  const backlogName = mediaWord(mediaType, "backlog");
  return {
    backlog: {
      name: backlogName,
      empty: {
        icon: Bookmark,
        message: mediaWord(mediaType, "backlogEmpty"),
        action: { label: mediaWord(mediaType, "find"), to: searchPath, icon: Search },
      },
      meta: (_item, year) => year,
      // A planned Media Item the User experienced before, planned again for a Revisit.
      mark: (item) => (item.log ? mediaWord(mediaType, "experiencedBefore") : undefined),
    },
    experienced: {
      name: mediaWord(mediaType, "experienced"),
      empty: {
        icon: Eye,
        message: mediaWord(mediaType, "experiencedEmpty"),
        action: {
          label: t("saved.goTo", { tab: backlogName }),
          to: libraryPath(mediaType, "backlog"),
        },
      },
      meta: (item) => item.log && <RatingValue rating={item.log.currentRating} compact />,
      mark: () => undefined,
    },
  };
}

type LibraryState =
  | { status: "loading" }
  | { status: "loaded"; tabs: Record<LibraryTab, LibraryItem[]> }
  | { status: "failed" };

// Saved for one Media Type at /saved/<type>/<tab>; an address naming no Media Type or tab opens
// the films' Watchlist.
export function LibraryPage() {
  const params = useParams();
  const mediaType = mediaTypeOfSlug(params.type);
  const tab = libraryTabOfSlug(params.tab);
  if (!mediaType || !tab) return <Navigate to={libraryPath("film", "backlog")} replace />;
  return <LibraryTabs mediaType={mediaType} tab={tab} />;
}

// The Media Type's heading, the way back up to Saved, its two tabs with their counts, and the open
// tab's grid of posters under its sort and filter chips. The Library loads once for both tabs; the
// open tab's view lives in the address.
function LibraryTabs({ mediaType, tab }: { mediaType: MediaType; tab: LibraryTab }) {
  const [state, setState] = useState<LibraryState>({ status: "loading" });
  const [params, setParams] = useSearchParams();
  const view = libraryView(tab, params, rememberedSort(mediaType, tab));
  // A choice replaces the history entry, so Back leaves the tab rather than undoing each choice.
  const changeTo = (change: Partial<LibraryView>) => {
    setParams(changeView(params, change), { replace: true });
  };
  // The filters go along to the other tab, as the address has them, so a Rating filter the
  // Watchlist ignores is back on Watched; each tab keeps its own sort.
  const filters = filtersOf(params).toString();
  const typeName = mediaWord(mediaType, "tab");
  const parts = tabParts(mediaType);
  const open = parts[tab];

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api.fetchLibrary(mediaType).then(
      (items) => {
        if (!cancelled) setState({ status: "loaded", tabs: libraryTabItems(items) });
      },
      () => {
        if (!cancelled) setState({ status: "failed" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  const tabItems = state.status === "loaded" ? state.tabs[tab] : [];
  const fill = useMetadataFill(tabItems.map((item) => item.mediaItem));
  // Sorts and filters read the metadata follow-ups found, too.
  const filled = tabItems.map((item) => ({ ...item, mediaItem: fill.filled(item.mediaItem) }));
  const visible = showLibrary(filled, view);

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex flex-col gap-1">
        <Link
          to={savedPath}
          className="-ml-2 flex h-9 items-center gap-0.5 self-start px-2 text-muted-foreground md:hidden"
        >
          <ChevronLeft aria-hidden className="size-4.5" />
          {t("saved.title")}
        </Link>
        <Breadcrumb aria-label={t("saved.breadcrumb")} className="hidden md:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={savedPath}>{t("saved.title")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{typeName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="font-bold text-3xl tracking-tight md:text-4xl">{typeName}</h1>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <SegmentedLinks
          label={t("saved.tabs")}
          segments={libraryTabs.map((each) => ({
            to: `${libraryPath(mediaType, each)}${filters && `?${filters}`}`,
            label: parts[each].name,
            count: state.status === "loaded" ? state.tabs[each].length : undefined,
            current: each === tab,
          }))}
        />
        {tabItems.length > 0 && (
          <LibraryChips
            mediaType={mediaType}
            tab={tab}
            view={view}
            items={filled}
            onSort={(sort) => {
              rememberSort(mediaType, tab, sort);
              changeTo({ sort });
            }}
            onFilter={changeTo}
          />
        )}
      </div>

      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("saved.loading")}</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("saved.unavailable")}
        </p>
      )}
      {state.status === "loaded" && tabItems.length === 0 && <EmptyState {...open.empty} />}
      {tabItems.length > 0 && visible.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-muted-foreground">
          <p>{mediaWord(mediaType, "noMatch")}</p>
          <Button
            variant="outline"
            className="h-10 rounded-full px-4 font-semibold"
            onClick={() => changeTo({ genre: null, decade: null, minRating: null })}
          >
            {t("saved.clearFilters")}
          </Button>
        </div>
      )}
      {visible.length > 0 && (
        <ul
          aria-label={open.name}
          className="grid grid-cols-3 gap-x-3 gap-y-4.5 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:gap-x-5 md:gap-y-6"
        >
          {visible.map((item) => (
            <PosterGridItem
              key={item.mediaItem.id}
              mediaItem={item.mediaItem}
              loading={fill.loading(item.mediaItem)}
              meta={open.meta(item, item.mediaItem.metadata?.year)}
              mark={open.mark(item)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// The value of a menu's first choice, which clears its filter.
const any = "any";

// The chips above the grid: the sort, then Genre and Decade, and on the experienced tab Rating.
// Each menu offers what the tab's films have, "Any …" first. On a phone the row scrolls sideways.
function LibraryChips({
  mediaType,
  tab,
  view,
  items,
  onSort,
  onFilter,
}: {
  mediaType: MediaType;
  tab: LibraryTab;
  view: LibraryView;
  items: readonly LibraryItem[];
  onSort(sort: LibrarySort): void;
  onFilter(change: Partial<LibraryView>): void;
}) {
  const sortName = (sort: LibrarySort) => {
    return sort === "experienced"
      ? mediaWord(mediaType, "lastExperienced")
      : t(`saved.sort.${sort}`);
  };
  const decadeName = (decade: number) => t("saved.decade.value", { decade: String(decade) });
  const ratingName = (floor: number) => {
    const id = floor === ratingStars.max ? "saved.rating.top" : "saved.rating.atLeast";
    return t(id, { rating: floor });
  };
  const anyChoice = (label: string): Choice => ({ value: any, label });
  const choiceOf = (value: string | number | null) => (value === null ? any : String(value));
  const chosenOf = (value: string) => (value === any ? null : value);

  return (
    // A fieldset is a group to screen readers; min-w-0 lets it scroll instead of widening the page.
    <fieldset
      aria-label={t("saved.view")}
      className="-mx-4 -my-1 flex min-w-0 gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      <ChoiceChip
        name={t("saved.sort")}
        icon={ArrowDownUp}
        shown={sortName(view.sort)}
        choices={librarySorts[tab].map((sort) => ({ value: sort, label: sortName(sort) }))}
        chosen={view.sort}
        onChoose={(sort) => onSort(sort as LibrarySort)}
      />
      <ChoiceChip
        name={t("saved.genre")}
        shown={view.genre ?? t("saved.genre")}
        choices={[
          anyChoice(t("saved.genre.any")),
          ...genreChoices(items, view.genre).map((genre) => ({ value: genre, label: genre })),
        ]}
        chosen={choiceOf(view.genre)}
        filtered={view.genre !== null}
        onChoose={(genre) => onFilter({ genre: chosenOf(genre) })}
      />
      <ChoiceChip
        name={t("saved.decade")}
        shown={view.decade === null ? t("saved.decade") : decadeName(view.decade)}
        choices={[
          anyChoice(t("saved.decade.any")),
          ...decadeChoices(items, view.decade).map((decade) => ({
            value: String(decade),
            label: decadeName(decade),
          })),
        ]}
        chosen={choiceOf(view.decade)}
        filtered={view.decade !== null}
        onChoose={(decade) => {
          const chosen = chosenOf(decade);
          onFilter({ decade: chosen === null ? null : Number(chosen) });
        }}
      />
      {tab === "experienced" && (
        <ChoiceChip
          name={t("saved.rating")}
          shown={view.minRating === null ? t("saved.rating") : ratingName(view.minRating)}
          choices={[
            anyChoice(t("saved.rating.any")),
            ...ratingFloors.map((floor) => ({ value: String(floor), label: ratingName(floor) })),
          ]}
          chosen={choiceOf(view.minRating)}
          filtered={view.minRating !== null}
          onChoose={(rating) => {
            const chosen = chosenOf(rating);
            onFilter({ minRating: chosen === null ? null : Number(chosen) });
          }}
        />
      )}
    </fieldset>
  );
}
