import { Bookmark, ChevronLeft, Eye, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { cn } from "@/lib/utils";
import type { LibraryItem, MediaType } from "../../shared/api";
import * as api from "../api";
import { useMetadataFill } from "../catalog/use-metadata-fill";
import { EmptyState } from "../components/EmptyState";
import { PosterGridItem } from "../components/PosterGridItem";
import { RatingValue } from "../components/Rating";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import {
  isLibraryTab,
  type LibraryTab,
  libraryPath,
  libraryTabs,
  mediaTypeOfSlug,
  tabItems,
} from "../library/library-tabs";

// Where Saved's tiles are, which the way back up leads to.
const savedPath = "/";

// Where the film search is, which an empty Watchlist sends the User to.
const searchPath = "/";

type LibraryState =
  | { status: "loading" }
  | { status: "loaded"; items: LibraryItem[] }
  | { status: "failed" };

// Saved for one Media Type at /saved/<type>/<tab>; an address naming no Media Type or tab opens
// the films' Watchlist.
export function LibraryPage() {
  const params = useParams();
  const mediaType = mediaTypeOfSlug(params.type);
  if (!mediaType || !isLibraryTab(params.tab)) {
    return <Navigate to={libraryPath("film", "watchlist")} replace />;
  }
  return <LibraryTabs mediaType={mediaType} tab={params.tab} />;
}

// The tab's name, the Backlog's or the Experienced verb: "Watchlist", "Watched".
function tabName(mediaType: MediaType, tab: LibraryTab): string {
  return mediaWord(mediaType, tab === "watchlist" ? "backlog" : "experienced");
}

// The Media Type's heading, the way back up to Saved, its Watchlist and Watched tabs with their
// counts, and the open tab's grid of posters. The Library loads once for both tabs.
function LibraryTabs({ mediaType, tab }: { mediaType: MediaType; tab: LibraryTab }) {
  const [state, setState] = useState<LibraryState>({ status: "loading" });
  const typeName = mediaWord(mediaType, "tab");

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api.fetchLibrary(mediaType).then(
      (items) => {
        if (!cancelled) setState({ status: "loaded", items });
      },
      () => {
        if (!cancelled) setState({ status: "failed" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  const items = state.status === "loaded" ? tabItems(tab, state.items) : [];
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
        <nav aria-label={t("saved.breadcrumb")} className="hidden md:block">
          <ol className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <li>
              <Link to={savedPath} className="hover:text-foreground">
                {t("saved.title")}
              </Link>
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden>›</span>
              <span aria-current="page">{typeName}</span>
            </li>
          </ol>
        </nav>
        <h1 className="font-bold text-3xl tracking-tight md:text-4xl">{typeName}</h1>
      </div>

      <nav
        aria-label={t("saved.tabs")}
        className="grid grid-cols-2 gap-0.5 self-stretch rounded-xl bg-muted p-0.75 md:flex md:self-start"
      >
        {libraryTabs.map((each) => (
          <Link
            key={each}
            to={libraryPath(mediaType, each)}
            aria-current={each === tab ? "page" : undefined}
            className={cn(
              "flex h-9.5 items-center justify-center gap-1 rounded-lg font-semibold text-sm md:h-9 md:px-4.5",
              each === tab && "bg-card shadow-sm",
            )}
          >
            {tabName(mediaType, each)}
            {state.status === "loaded" && (
              <span className="font-medium text-muted-foreground">
                {tabItems(each, state.items).length}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("saved.loading")}</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("saved.unavailable")}
        </p>
      )}
      {state.status === "loaded" && items.length === 0 && (
        <TabEmptyState mediaType={mediaType} tab={tab} />
      )}
      {items.length > 0 && (
        <ul
          aria-label={tabName(mediaType, tab)}
          className="grid grid-cols-3 gap-x-3 gap-y-4.5 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:gap-x-5 md:gap-y-6"
        >
          {items.map((item) => {
            const mediaItem = fill.filled(item.mediaItem);
            const year = mediaItem.metadata?.year;
            return (
              <PosterGridItem
                key={mediaItem.id}
                mediaItem={mediaItem}
                loading={fill.loading(item.mediaItem)}
                meta={
                  tab === "watched" && item.log ? (
                    <RatingValue rating={item.log.currentRating} compact />
                  ) : (
                    year
                  )
                }
                mark={
                  tab === "watchlist" && item.log
                    ? mediaWord(mediaType, "experiencedBefore")
                    : undefined
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TabEmptyState({ mediaType, tab }: { mediaType: MediaType; tab: LibraryTab }) {
  if (tab === "watchlist") {
    return (
      <EmptyState
        icon={Bookmark}
        message={mediaWord(mediaType, "backlogEmpty")}
        action={{ label: mediaWord(mediaType, "find"), to: searchPath, icon: Search }}
      />
    );
  }
  return (
    <EmptyState
      icon={Eye}
      message={mediaWord(mediaType, "experiencedEmpty")}
      action={{
        label: t("saved.goTo", { backlogName: mediaWord(mediaType, "backlog") }),
        to: libraryPath(mediaType, "watchlist"),
      }}
    />
  );
}
