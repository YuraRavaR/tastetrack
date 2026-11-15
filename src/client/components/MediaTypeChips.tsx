import type { MediaType } from "../../shared/api";
import { mediaTypeIcon } from "../catalog/media-types";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";

// The Media Type chips under a section's field or heading: a segmented control the width of its
// column, with one equal segment per Media Type the section offers, each an icon over its name
// and thumb-sized on a phone. The current one is raised.
export function MediaTypeChips({
  choices,
  current,
  onChoose,
}: {
  choices: readonly MediaType[];
  current: MediaType;
  // Called with the Media Type the User picks, the current one included.
  onChoose?: (mediaType: MediaType) => void;
}) {
  return (
    <fieldset
      aria-label={t("mediaTypeChips.label")}
      className="grid min-w-0 auto-cols-fr grid-flow-col gap-0.5 rounded-lg bg-muted p-1"
    >
      {choices.map((mediaType) => (
        <MediaTypeChip
          key={mediaType}
          mediaType={mediaType}
          current={current}
          onChoose={onChoose}
        />
      ))}
    </fieldset>
  );
}

function MediaTypeChip({
  mediaType,
  current,
  onChoose,
}: {
  mediaType: MediaType;
  current: MediaType;
  onChoose?: ((mediaType: MediaType) => void) | undefined;
}) {
  const Icon = mediaTypeIcon(mediaType);
  return (
    <button
      type="button"
      aria-pressed={mediaType === current}
      onClick={() => onChoose?.(mediaType)}
      className="group flex h-14 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.75 rounded-md font-medium text-[13px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:shadow-sm"
    >
      <Icon aria-hidden className="size-4.5 group-aria-pressed:text-primary-strong" />
      {mediaWord(mediaType, "tab")}
    </button>
  );
}
