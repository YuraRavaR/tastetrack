import { MessageSquarePlus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ItemHistoryResponse, LogEntry, Thought } from "../../shared/api";
import { isLight } from "../../shared/catalog";
import * as api from "../api";
import { filmTitleAndYear } from "../catalog/film-label";
import { can } from "../catalog/media-types";
import { About, aboutIsEmpty, aboutProps, SourceLink } from "../components/About";
import { ArtistAlbums } from "../components/ArtistAlbums";
import { ArtistBanner } from "../components/ArtistBanner";
import { BackLink } from "../components/BackLink";
import { DeleteLogEntryDialog } from "../components/DeleteLogEntryDialog";
import { DeleteManualMediaItemDialog } from "../components/DeleteManualMediaItemDialog";
import { DeleteThoughtDialog } from "../components/DeleteThoughtDialog";
import { FilmActions } from "../components/FilmActions";
import { FilmBanner } from "../components/FilmBanner";
import { ItemHistoryRow } from "../components/ItemHistoryRow";
import { ItemHistoryStats } from "../components/ItemHistoryStats";
import { EditLogEntryDialog } from "../components/LogEntryDialog";
import { ManualMediaItemDialog } from "../components/ManualMediaItemDialog";
import { MediaItemCollections } from "../components/MediaItemCollections";
import { ThoughtDialog } from "../components/ThoughtDialog";
import { ThoughtRow } from "../components/ThoughtRow";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { libraryPath } from "../library/library-tabs";
import { historyNewestFirst } from "../log/history";
import { usePageTitle } from "../navigation/page-title";
import { listsPathOf } from "../navigation/paths";

type HistoryState =
  | { status: "loading" }
  | { status: "loaded"; history: ItemHistoryResponse }
  | { status: "notFound" }
  | { status: "failed" };

async function loadHistory(mediaItemId: number): Promise<HistoryState> {
  if (!Number.isSafeInteger(mediaItemId) || mediaItemId <= 0) return { status: "notFound" };
  try {
    const history = await api.fetchItemHistory(mediaItemId);
    return history ? { status: "loaded", history } : { status: "notFound" };
  } catch {
    return { status: "failed" };
  }
}

// One Media Item's page, its Item History: on a phone, Back, then a banner with its title, then,
// indented with it from `sm`, what it is about when the Worker says, tiles for how the User watched
// and rated it, the actions they can take on it, and its History: every Log Entry and Thought,
// newest first, each of which can be edited or deleted, and Add a thought, which writes a new one.
// A Media Item with no Log Entries has no tiles, and one with neither says what will show in
// History. After a new entry or Thought, an edit or a delete it reloads, so the order and the
// Current Rating are always the Worker's. A Media Item the User added manually can be edited too,
// or deleted with everything that goes with it. A Media Type that can't be logged has the banner
// and its actions alone; a song, which lives only in Collections, has Add to collection and the
// Collections holding it in place of the Library's actions (`docs/mockups/songs/`). An artist, who
// lives only in Collections too, has their photo over its blurred copy, and their albums list
// under their Collections (`docs/mockups/artists/`).
export function ItemHistoryPage() {
  const mediaItemId = Number(useParams().mediaItemId);
  const navigate = useNavigate();
  const historyHeadingId = useId();
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [deleting, setDeleting] = useState<LogEntry | null>(null);
  // The Thought form, for a new Thought (null) or one to change.
  const [thoughtForm, setThoughtForm] = useState<{ thought: Thought | null } | null>(null);
  const [deletingThought, setDeletingThought] = useState<Thought | null>(null);
  const [editingMediaItem, setEditingMediaItem] = useState(false);
  const [deletingMediaItem, setDeletingMediaItem] = useState(false);
  // The page belongs to no section, so until the film is known the tab shows the app's name alone.
  // An artist is named without their year.
  const mediaItemShown = state.status === "loaded" ? state.history.mediaItem : null;
  const metadata = mediaItemShown?.metadata ?? null;
  usePageTitle(
    metadata
      ? [mediaItemShown?.mediaType === "artist" ? metadata.title : filmTitleAndYear(metadata)]
      : [],
  );

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadHistory(mediaItemId).then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaItemId]);

  async function reload() {
    setState(await loadHistory(mediaItemId));
  }

  if (state.status === "loading") {
    return <p className="text-muted-foreground text-sm">{t("itemHistory.loading")}</p>;
  }
  if (state.status !== "loaded") {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t(state.status === "notFound" ? "itemHistory.notFound" : "itemHistory.unavailable")}
      </p>
    );
  }

  const { mediaItem, logEntries, thoughts, about, inProgress } = state.history;
  const history = historyNewestFirst(logEntries, thoughts);
  const manual = mediaItem.externalReference === null;
  const loggable = can(mediaItem.mediaType, "log");
  const light = isLight(mediaItem.mediaType);
  // A game's source links to its page on IGDB, an album's to its release group on MusicBrainz, a
  // song's to its recording there and an artist's to the artist. With nothing else to show, the
  // About block gives way to that link under the facts line, as an album, a song or an artist,
  // which has none, always has it (`docs/mockups/games/`, `docs/mockups/albums/`,
  // `docs/mockups/songs/`, `docs/mockups/artists/`).
  const onMusicBrainz =
    mediaItem.mediaType === "album" ||
    mediaItem.mediaType === "song" ||
    mediaItem.mediaType === "artist";
  const sourceUrl =
    mediaItem.mediaType === "game" || onMusicBrainz ? (mediaItem.metadata?.url ?? null) : null;
  const sourceName = t(onMusicBrainz ? "about.onMusicBrainz" : "about.fromIgdb");
  const shownAbout = about && aboutProps(about);
  const aboutShown = shownAbout && !(sourceUrl && aboutIsEmpty(shownAbout)) ? shownAbout : null;
  const artistAlbums = about?.mediaType === "artist" ? about.albums : null;
  return (
    <div className="flex flex-col gap-4.5 sm:gap-5.5">
      <div className="flex flex-col gap-1">
        <BackLink mediaType={mediaItem.mediaType} />
        {mediaItem.mediaType === "artist" ? (
          <ArtistBanner
            mediaItem={mediaItem}
            sourceLink={sourceUrl && <SourceLink source={sourceName} url={sourceUrl} />}
          />
        ) : (
          <FilmBanner
            mediaItem={mediaItem}
            sourceLink={
              sourceUrl &&
              !aboutShown && (
                <SourceLink
                  source={sourceName}
                  url={sourceUrl}
                  className={cn("-ml-2.5 self-start", light && "sm:ml-0 sm:self-center")}
                />
              )
            }
          />
        )}
      </div>
      <div className="flex flex-col gap-4.5 sm:gap-5 sm:px-6">
        {aboutShown && <About {...aboutShown} sourceUrl={sourceUrl} />}
        {logEntries.length > 0 && <ItemHistoryStats history={state.history} />}
        {light ? (
          <MediaItemCollections mediaItem={mediaItem} centred={mediaItem.mediaType === "song"} />
        ) : (
          <FilmActions
            history={state.history}
            onChanged={reload}
            onPlanned={(inBacklog) =>
              setState((current) =>
                current.status === "loaded"
                  ? { ...current, history: { ...current.history, inBacklog } }
                  : current,
              )
            }
          />
        )}
        {manual && (
          <div
            className={cn(
              "flex flex-col gap-3",
              mediaItem.mediaType === "song" && "sm:items-center sm:text-center",
            )}
          >
            <p className="text-muted-foreground text-sm">
              {mediaWord(mediaItem.mediaType, "manualAddedByYou")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingMediaItem(true)}>
                {mediaWord(mediaItem.mediaType, "manualEdit")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDeletingMediaItem(true)}>
                {mediaWord(mediaItem.mediaType, "manualDelete")}
              </Button>
            </div>
          </div>
        )}
        {artistAlbums && <ArtistAlbums albums={artistAlbums} artistName={metadata?.title ?? ""} />}
        {loggable && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 id={historyHeadingId} className="font-semibold text-lg tracking-tight sm:text-xl">
                {t("history.title")}
              </h2>
              <Button
                variant="outline"
                className="h-10 md:h-9"
                onClick={() => setThoughtForm({ thought: null })}
              >
                <MessageSquarePlus aria-hidden />
                {t("thought.add")}
              </Button>
            </div>
            {history.length > 0 ? (
              <ul
                aria-labelledby={historyHeadingId}
                className="flex flex-col divide-y rounded-lg border bg-card"
              >
                {history.map((item) =>
                  item.kind === "logEntry" ? (
                    <ItemHistoryRow
                      key={`entry-${item.logEntry.id}`}
                      entry={item.logEntry}
                      onEdit={() => setEditing(item.logEntry)}
                      onDelete={() => setDeleting(item.logEntry)}
                    />
                  ) : (
                    <ThoughtRow
                      key={`thought-${item.thought.id}`}
                      thought={item.thought}
                      mediaType={mediaItem.mediaType}
                      onEdit={() => setThoughtForm({ thought: item.thought })}
                      onDelete={() => setDeletingThought(item.thought)}
                    />
                  ),
                )}
              </ul>
            ) : (
              <div className="flex flex-col gap-1 rounded-lg border border-input border-dashed px-4 py-5 text-center">
                <p className="font-semibold">{t("history.empty")}</p>
                <p className="mx-auto max-w-[46ch] text-muted-foreground text-sm">
                  {mediaWord(mediaItem.mediaType, "historyEmptyHint")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <EditLogEntryDialog
        entry={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await reload();
        }}
        onDelete={() => {
          setDeleting(editing);
          setEditing(null);
        }}
      />
      <ThoughtDialog
        mediaItem={mediaItem}
        inProgress={inProgress}
        thought={thoughtForm?.thought ?? null}
        open={thoughtForm !== null}
        onClose={() => setThoughtForm(null)}
        onSaved={async () => {
          setThoughtForm(null);
          await reload();
        }}
        onDelete={setDeletingThought}
      />
      <DeleteThoughtDialog
        mediaItem={mediaItem}
        thought={deletingThought}
        onClose={() => setDeletingThought(null)}
        onDeleted={async () => {
          setDeletingThought(null);
          setThoughtForm(null);
          await reload();
        }}
      />
      <DeleteLogEntryDialog
        entry={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={async () => {
          setDeleting(null);
          await reload();
        }}
      />
      {manual && (
        <>
          <ManualMediaItemDialog
            open={editingMediaItem}
            mediaItem={mediaItem}
            onClose={() => setEditingMediaItem(false)}
            onSaved={async () => {
              setEditingMediaItem(false);
              await reload();
            }}
          />
          <DeleteManualMediaItemDialog
            mediaItem={mediaItem}
            open={deletingMediaItem}
            onClose={() => setDeletingMediaItem(false)}
            onDeleted={() =>
              navigate(
                light
                  ? listsPathOf(mediaItem.mediaType)
                  : libraryPath(mediaItem.mediaType, "experienced"),
                { replace: true },
              )
            }
          />
        </>
      )}
    </div>
  );
}
