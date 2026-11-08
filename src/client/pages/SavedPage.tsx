import { useEffect, useId, useState } from "react";
import type { MediaType } from "../../shared/api";
import * as api from "../api";
import { mediaTypeChoices } from "../catalog/media-types";
import { ComingSoonTile, MediaTypeTile, type TileState } from "../components/MediaTypeTile";
import { t } from "../i18n/t";
import { libraryTile } from "../library/library-tabs";

// Saved at "/": one tile per Media Type, in the order every section offers them. A built one opens
// its Backlog and experienced tabs; one still to come is a disabled stub. The heading names the
// list of tiles.
export function SavedPage() {
  const headingId = useId();
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <h1 id={headingId} className="font-bold text-3xl tracking-tight md:text-4xl">
        {t("saved.title")}
      </h1>
      <ul aria-labelledby={headingId} className="grid gap-3.5 md:grid-cols-2 md:gap-5">
        {mediaTypeChoices.map((choice) =>
          choice.status === "built" ? (
            <li key={choice.mediaType} className="grid">
              <BuiltTile mediaType={choice.mediaType} />
            </li>
          ) : (
            <li key={choice.name} className="grid">
              <ComingSoonTile name={t(choice.name)} icon={choice.icon} />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

// A built Media Type's tile, with what it shows read from the same Library its page reads.
function BuiltTile({ mediaType }: { mediaType: MediaType }) {
  const [state, setState] = useState<TileState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    api.fetchLibrary(mediaType).then(
      (items) => {
        if (!cancelled) setState({ status: "loaded", tile: libraryTile(items) });
      },
      () => {
        if (!cancelled) setState({ status: "failed" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  return <MediaTypeTile mediaType={mediaType} state={state} />;
}
