import { type LucideIcon, Plus, Search } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MediaItem, MediaType } from "../../shared/api";
import { mediaTypeIcon } from "../catalog/media-types";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { type LibraryTile, libraryPath } from "../library/library-tabs";
import { searchPathOf } from "../navigation/paths";
import { Poster } from "./Poster";

// What a built Media Type's tile knows of its Library: nothing yet, its counts and covers, or
// that it couldn't load them.
export type TileState =
  | { status: "loading" }
  | { status: "loaded"; tile: LibraryTile }
  | { status: "failed" };

// A built Media Type's tile in Saved: its icon, its name, the counts of its tabs and a fan of
// the covers last added to its Backlog. The name is the link that opens the Media Type's page, and
// it stretches over the whole tile. A Library with nothing in it shows empty slots and a way to
// find something instead; the tile still opens the empty tabs.
export function MediaTypeTile({ mediaType, state }: { mediaType: MediaType; state: TileState }) {
  const countsId = useId();
  const empty = state.status === "loaded" && state.tile.empty;
  const covers = state.status === "loaded" ? state.tile.covers : [];

  return (
    <Card
      className={cn(
        "relative grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr_auto] gap-x-3 gap-y-0 overflow-hidden rounded-xl p-4.5 shadow-none [grid-template-areas:'icon_fan'_'words_fan'_'action_action'] has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50 has-[a:hover]:border-muted-foreground md:min-h-55 md:gap-x-4 md:p-6",
        empty ? "md:[grid-template-areas:'icon_fan'_'words_fan'_'action_fan']" : "h-43 md:h-55",
      )}
    >
      <TileIcon icon={mediaTypeIcon(mediaType)} />
      <div className="flex flex-col gap-1 self-end [grid-area:words]">
        <h2 className="font-bold text-2xl tracking-tight md:text-3xl">
          <Link
            to={libraryPath(mediaType, "backlog")}
            aria-describedby={countsId}
            className="outline-none after:absolute after:inset-0"
          >
            {mediaWord(mediaType, "tab")}
          </Link>
        </h2>
        <TileCounts id={countsId} mediaType={mediaType} state={state} />
      </div>
      <Fan covers={covers} adding={empty} />
      {empty && (
        // Above the link stretched over the tile, so it opens Search rather than the tabs.
        <Button
          asChild
          className="relative mt-4.5 h-12 rounded-xl px-5 font-semibold [grid-area:action] md:mt-3.5 md:h-11 md:justify-self-start md:px-4.5"
        >
          <Link to={searchPathOf(mediaType)}>
            <Search aria-hidden />
            {mediaWord(mediaType, "find")}
          </Link>
        </Button>
      )}
    </Card>
  );
}

function TileCounts({
  id,
  mediaType,
  state,
}: {
  id: string;
  mediaType: MediaType;
  state: TileState;
}) {
  let text: ReactNode = null;
  if (state.status === "failed") text = t("saved.unavailable");
  if (state.status === "loaded") {
    text = state.tile.empty
      ? t("saved.nothingYet")
      : mediaWord(mediaType, "tileCounts", state.tile.counts);
  }
  // A line's height even while loading, so the tile doesn't shift when the counts arrive.
  return (
    <p
      id={id}
      className={cn(
        "min-h-5 text-sm md:text-[0.9375rem]",
        state.status === "failed" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {text}
    </p>
  );
}

// Where each of the fan's three slots sits, front first: the front one upright and larger in the
// middle, the next tilted left behind it, the last tilted right.
const fanSlots = [
  "top-1.5 right-9 z-10 h-29.25 w-19.5 md:top-2.5 md:right-11.5 md:h-39 md:w-26",
  "top-5.5 right-17.5 -rotate-9 md:top-7.5 md:right-23",
  "top-5.5 right-2 rotate-9 md:top-7.5",
];

// Up to three covers fanned out, and an empty dashed slot for each missing one. While `adding`,
// the front slot carries a plus, as an invitation to fill it.
function Fan({ covers, adding }: { covers: readonly MediaItem[]; adding: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none relative h-31 w-37.5 [grid-area:fan] md:h-43 md:w-50"
    >
      {fanSlots.map((place, index) => {
        const cover = covers[index];
        const front = index === 0;
        return (
          <div
            key={place}
            className={cn(
              "absolute h-26.25 w-17.5 rounded-md md:h-34.5 md:w-23",
              place,
              cover && "shadow-md",
              !cover && "border-[1.5px] border-border border-dashed",
              !cover &&
                front &&
                adding &&
                "flex items-center justify-center border-muted-foreground bg-background text-muted-foreground",
            )}
          >
            {cover && <Poster subject={cover} size="fan" />}
            {!cover && front && adding && <Plus className="size-5.5" />}
          </div>
        );
      })}
    </div>
  );
}

// The tile of a Media Type still to come: dashed, muted, disabled, and labelled "Coming soon".
export function ComingSoonTile({ name, icon }: { name: string; icon: LucideIcon }) {
  const soonId = useId();
  return (
    <button
      type="button"
      disabled
      aria-describedby={soonId}
      className="grid h-30 grid-cols-[minmax(0,1fr)_auto] content-start items-start gap-x-3 gap-y-3.5 rounded-xl border-[1.5px] border-border border-dashed p-4.5 text-left text-muted-foreground [grid-template-areas:'icon_badge'_'words_badge'] md:h-55 md:grid-rows-[auto_1fr] md:content-stretch md:p-6"
    >
      <TileIcon icon={icon} muted />
      <span className="font-semibold text-xl tracking-tight [grid-area:words] md:self-end md:text-2xl">
        {name}
      </span>
      {/* Out of the tile's name, which is the Media Type's alone; the description still reads it. */}
      <Badge
        id={soonId}
        aria-hidden
        variant="secondary"
        className="bg-muted px-2.5 py-1 font-semibold text-muted-foreground [grid-area:badge]"
      >
        {t("saved.comingSoon")}
      </Badge>
    </button>
  );
}

function TileIcon({ icon: Icon, muted = false }: { icon: LucideIcon; muted?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-10 items-center justify-center self-start rounded-lg [grid-area:icon] md:size-11",
        muted ? "bg-muted" : "bg-primary-soft text-primary-strong",
      )}
    >
      <Icon aria-hidden className="size-5.5" />
    </span>
  );
}
