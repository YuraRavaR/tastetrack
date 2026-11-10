import { useId } from "react";
import type { MediaType } from "../../shared/api";
import { type MediaTypeChoice, mediaTypeIcon } from "../catalog/media-types";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";

// The Media Type chips under a section's field or heading: a segmented control the width of its
// column, with one equal segment per Media Type the section offers, each an icon over its name
// and thumb-sized on a phone. The current one is raised. One still to come is disabled, with
// "Soon" under its name on a phone and "Coming soon" from `md`.
export function MediaTypeChips({
  choices,
  current,
  onChoose,
}: {
  choices: readonly MediaTypeChoice[];
  current: MediaType;
  // Called with the built Media Type the User picks, the current one included.
  onChoose?: (mediaType: MediaType) => void;
}) {
  return (
    <fieldset
      aria-label={t("mediaTypeChips.label")}
      className="grid min-w-0 auto-cols-fr grid-flow-col gap-0.5 rounded-lg bg-muted p-1"
    >
      {choices.map((choice) => (
        <MediaTypeChip
          key={choice.status === "built" ? choice.mediaType : choice.name}
          choice={choice}
          current={current}
          onChoose={onChoose}
        />
      ))}
    </fieldset>
  );
}

const chipClass =
  "group flex h-14 min-w-0 flex-col items-center justify-center gap-0.75 rounded-md font-medium text-[13px]";

function MediaTypeChip({
  choice,
  current,
  onChoose,
}: {
  choice: MediaTypeChoice;
  current: MediaType;
  onChoose?: ((mediaType: MediaType) => void) | undefined;
}) {
  const soonId = useId();
  if (choice.status === "built") {
    const Icon = mediaTypeIcon(choice.mediaType);
    return (
      <button
        type="button"
        aria-pressed={choice.mediaType === current}
        onClick={() => onChoose?.(choice.mediaType)}
        className={`${chipClass} cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:shadow-sm`}
      >
        <Icon aria-hidden className="size-4.5 group-aria-pressed:text-primary-strong" />
        {mediaWord(choice.mediaType, "tab")}
      </button>
    );
  }
  const Icon = choice.icon;
  return (
    <button
      type="button"
      disabled
      aria-describedby={soonId}
      className={`${chipClass} text-muted-foreground`}
    >
      <Icon aria-hidden className="size-4.5" />
      {t(choice.name)}
      {/* Out of the chip's name, which is the Media Type's alone; its description says it whole. */}
      <span aria-hidden className="font-semibold text-[11px] leading-none">
        <span className="md:hidden">{t("mediaTypeChips.soon")}</span>
        <span className="hidden md:inline">{t("saved.comingSoon")}</span>
      </span>
      <span id={soonId} hidden>
        {t("saved.comingSoon")}
      </span>
    </button>
  );
}
