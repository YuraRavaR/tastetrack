import { Bookmark, ChevronLeft, Eye, type LucideIcon, Search } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { LibraryItem, MediaType } from "../../shared/api";
import * as api from "../api";
import { useMetadataFill } from "../catalog/use-metadata-fill";
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
// tab's grid of posters. The Library loads once for both tabs.
function LibraryTabs({ mediaType, tab }: { mediaType: MediaType; tab: LibraryTab }) {
  const [state, setState] = useState<LibraryState>({ status: "loading" });
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

  const items = state.status === "loaded" ? state.tabs[tab] : [];
  const fill = useMetadataFill(items.map((item) => item.mediaItem));

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

      <SegmentedLinks
        label={t("saved.tabs")}
        segments={libraryTabs.map((each) => ({
          to: libraryPath(mediaType, each),
          label: parts[each].name,
          count: state.status === "loaded" ? state.tabs[each].length : undefined,
          current: each === tab,
        }))}
      />

      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("saved.loading")}</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("saved.unavailable")}
        </p>
      )}
      {state.status === "loaded" && items.length === 0 && <EmptyState {...open.empty} />}
      {items.length > 0 && (
        <ul
          aria-label={open.name}
          className="grid grid-cols-3 gap-x-3 gap-y-4.5 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:gap-x-5 md:gap-y-6"
        >
          {items.map((item) => {
            const mediaItem = fill.filled(item.mediaItem);
            return (
              <PosterGridItem
                key={mediaItem.id}
                mediaItem={mediaItem}
                loading={fill.loading(item.mediaItem)}
                meta={open.meta(item, mediaItem.metadata?.year)}
                mark={open.mark(item)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
