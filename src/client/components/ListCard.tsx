import { Link2 } from "lucide-react";
import { useId } from "react";
import { Link } from "react-router";
import type { ListPreview } from "../../shared/api";
import { listCoverCount } from "../../shared/lists";
import { mediaTypeIcon } from "../catalog/media-types";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { listPath } from "../navigation/paths";
import { Poster } from "./Poster";

// One of the User's Lists on Collections: a square collage of its first covers in List order, its
// name, and a line with its Media Type's icon, how many it holds and whether it is shared. The
// name is the link that opens the List, and it stretches over the whole card.
export function ListCard({ list }: { list: ListPreview }) {
  const metaId = useId();
  const Icon = mediaTypeIcon(list.mediaType);
  return (
    <div className="group relative flex flex-col gap-2.5 md:gap-3">
      <Collage list={list} />
      <div className="flex flex-col gap-1 px-0.5">
        <h2 className="line-clamp-2 break-words font-semibold text-base leading-snug">
          <Link
            to={listPath(list.id)}
            aria-describedby={metaId}
            className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
          >
            {list.name}
          </Link>
        </h2>
        <p
          id={metaId}
          className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm"
        >
          <Icon
            role="img"
            aria-label={mediaWord(list.mediaType, "tab")}
            className="size-3.5 shrink-0"
          />
          <span>{t("films.count", { count: list.itemCount })}</span>
          {list.shared && (
            <>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1">
                <Link2 aria-hidden className="size-3.5 shrink-0" />
                <span className="md:hidden">{t("lists.sharedShort")}</span>
                <span className="hidden md:inline">{t("lists.shared")}</span>
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// A 2×2 grid of the first covers, an empty cell for each the List doesn't have.
function Collage({ list }: { list: ListPreview }) {
  const cells = Array.from({ length: listCoverCount }, (_, index) => list.covers[index]);
  return (
    <div
      aria-hidden
      className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl bg-background shadow-sm transition-shadow group-hover:shadow-md"
    >
      {cells.map((cover, index) => (
        // Cells don't move, and two may show the same placeholder, so the place is the key.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <div key={index} className="min-h-0 min-w-0 bg-muted">
          {cover && <Poster subject={cover} size="collage" />}
        </div>
      ))}
    </div>
  );
}
