import { type LucideIcon, Plus, Search } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MediaItem, MediaType } from "../../shared/api";
import { coverShape } from "../catalog/cover";
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
// find something instead; the tile still opens the empty tabs. On a phone, two tiles to a row, the
// fan is small and sits over the name, the counts wrap, and the icon is hidden
// (`docs/mockups/games/`); from `md` the icon is at the top left and the fan at the right. A `wide`
// tile, which takes a row of its own below `lg`, as the albums' does, has that layout at every
// width, and a `third` one, three to a row from `lg`, a smaller fan and name
// (`docs/mockups/albums/`).
export function MediaTypeTile({
  mediaType,
  state,
  wide = false,
  third = false,
}: {
  mediaType: MediaType;
  state: TileState;
  wide?: boolean;
  third?: boolean;
}) {
  const countsId = useId();
  const empty = state.status === "loaded" && state.tile.empty;
  const covers = state.status === "loaded" ? state.tile.covers : [];
  const fan = fans[coverShape(mediaType) === "1:1" ? "square" : third ? "posterThird" : "poster"];

  return (
    <Card
      className={cn(
        "relative gap-0 overflow-hidden rounded-xl shadow-none has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50 has-[a:hover]:border-muted-foreground md:grid md:min-h-55 md:grid-cols-[minmax(0,1fr)_auto] md:grid-rows-[auto_1fr_auto] md:gap-x-4 md:gap-y-0 md:p-6",
        wide
          ? "grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr_auto] gap-x-3 px-4.5 py-4"
          : "flex flex-col p-3.5",
        empty
          ? wide
            ? "[grid-template-areas:'icon_fan'_'words_fan'_'action_fan']"
            : "md:[grid-template-areas:'icon_fan'_'words_fan'_'action_fan']"
          : cn(
              "md:h-55",
              wide
                ? "h-33 [grid-template-areas:'icon_fan'_'words_fan'_'action_action']"
                : "h-51.5 md:[grid-template-areas:'icon_fan'_'words_fan'_'action_action']",
            ),
      )}
    >
      <TileIcon icon={mediaTypeIcon(mediaType)} wide={wide} />
      <div
        className={cn(
          "flex flex-col gap-0.5 md:mt-0 md:gap-1 md:self-end md:[grid-area:words]",
          wide ? "self-end [grid-area:words]" : "mt-auto",
        )}
      >
        <h2
          className={cn(
            "font-bold tracking-tight md:text-3xl",
            wide ? "text-[22px]" : "text-xl",
            third && "lg:text-[26px]",
          )}
        >
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
      <Fan covers={covers} adding={empty} fan={fan} />
      {empty && (
        // Above the link stretched over the tile, so it opens Search rather than the tabs.
        <Button
          asChild
          className={cn(
            "relative mt-3.5 h-11 rounded-xl px-3 font-semibold md:justify-self-start md:px-4.5 md:[grid-area:action]",
            wide && "justify-self-start [grid-area:action]",
          )}
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
        "min-h-5 text-[13px] leading-[1.35] md:text-[0.9375rem] md:leading-normal",
        state.status === "failed" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {text}
    </p>
  );
}

// How a fan lays out its box, its covers, and each of its three slots, front first: the front
// one upright in the middle, the next tilted left behind it, the last tilted right.
interface FanLayout {
  box: string;
  cover: string;
  slots: readonly [string, string, string];
}

// Posters fan out small over the name on a phone and at the right from `md`, the front one larger;
// a third of a row from `lg` takes smaller ones (`docs/mockups/albums/`). An album's square covers
// fan out at the right of its wide tile at every width: 66 px, the front one 84 px, on a phone,
// 112 and 128 px from `md`.
const posterBox =
  "order-first mt-0.5 mb-2.5 h-23 w-34 shrink-0 self-center md:order-none md:m-0 md:h-43 md:w-50 md:self-auto md:[grid-area:fan]";
const posterSlots = [
  "top-0 left-10.5 z-10 md:top-2.5 md:right-11.5 md:left-auto md:h-39 md:w-26",
  "top-2 left-1.5 -rotate-9 md:top-7.5 md:right-23 md:left-auto",
  "top-2 left-19.5 rotate-9 md:top-7.5 md:right-2 md:left-auto",
] as const;
const fans = {
  poster: { box: posterBox, cover: "h-19.5 w-13 md:h-34.5 md:w-23", slots: posterSlots },
  posterThird: {
    box: `${posterBox} lg:h-29 lg:w-37.5`,
    cover: "h-19.5 w-13 md:h-34.5 md:w-23 lg:h-23.25 lg:w-15.5",
    slots: [
      `${posterSlots[0]} lg:top-0 lg:right-10.75 lg:h-26.25 lg:w-17.5`,
      `${posterSlots[1]} lg:top-2.5 lg:right-19.5`,
      `${posterSlots[2]} lg:top-2.5 lg:right-1.5`,
    ],
  },
  square: {
    box: "h-23 w-40 shrink-0 self-center [grid-area:fan] md:h-36 md:w-62 md:self-auto",
    cover: "size-16.5 md:size-28",
    slots: [
      "top-0 left-9.5 z-10 size-21 md:left-15 md:size-32",
      "top-2.5 left-0 -rotate-9 md:top-4",
      "top-2.5 right-0 rotate-9 md:top-4",
    ],
  },
} satisfies Record<string, FanLayout>;

// Up to three covers fanned out, and an empty dashed slot for each missing one. While `adding`,
// the front slot carries a plus, as an invitation to fill it.
function Fan({
  covers,
  adding,
  fan,
}: {
  covers: readonly MediaItem[];
  adding: boolean;
  fan: FanLayout;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none relative", fan.box)}>
      {fan.slots.map((place, index) => {
        const cover = covers[index];
        const front = index === 0;
        return (
          <div
            key={place}
            className={cn(
              "absolute rounded-md",
              fan.cover,
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

// The Media Type's icon in the tile's corner, on a soft square of the primary colour.
// Hidden on a phone, but on a wide tile, where it is smaller.
function TileIcon({ icon: Icon, wide }: { icon: LucideIcon; wide: boolean }) {
  return (
    <span
      className={cn(
        "items-center justify-center self-start rounded-lg bg-primary-soft text-primary-strong md:flex md:size-11 md:[grid-area:icon]",
        wide ? "flex size-9 [grid-area:icon]" : "hidden",
      )}
    >
      <Icon aria-hidden className="size-5 md:size-5.5" />
    </span>
  );
}
