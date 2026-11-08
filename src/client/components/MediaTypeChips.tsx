import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import type { MediaType } from "../../shared/api";
import { type MediaTypeChoice, mediaTypeChoices, mediaTypeIcon } from "../catalog/media-types";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";

// The category chips under a section's heading or field: one per Media Type, in the order every
// section offers them, the current one pressed. One still to come is dashed, disabled and
// labelled "Coming soon". Each chip has a thumb-sized target on a phone.
export function MediaTypeChips({ current }: { current: MediaType }) {
  return (
    <fieldset aria-label={t("mediaTypeChips.label")} className="flex min-w-0 flex-wrap gap-2">
      {mediaTypeChoices.map((choice) => (
        <MediaTypeChip key={choiceKey(choice)} choice={choice} current={current} />
      ))}
    </fieldset>
  );
}

function choiceKey(choice: MediaTypeChoice): string {
  return choice.status === "built" ? choice.mediaType : choice.name;
}

function MediaTypeChip({ choice, current }: { choice: MediaTypeChoice; current: MediaType }) {
  const soonId = useId();
  if (choice.status === "built") {
    const Icon = mediaTypeIcon(choice.mediaType);
    return (
      <button
        type="button"
        aria-pressed={choice.mediaType === current}
        className="group flex h-11 items-center rounded-full outline-none md:h-9"
      >
        <span className="flex h-9 items-center gap-1.5 rounded-full border border-border pr-3.5 pl-3 font-medium text-sm group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50 group-aria-pressed:border-primary-strong group-aria-pressed:bg-primary-soft group-aria-pressed:font-semibold">
          <Icon aria-hidden className="size-4" />
          {mediaWord(choice.mediaType, "tab")}
        </span>
      </button>
    );
  }
  const Icon = choice.icon;
  return (
    <button
      type="button"
      disabled
      aria-describedby={soonId}
      className="flex h-11 items-center text-muted-foreground md:h-9"
    >
      <span className="flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-border border-dashed pr-1.5 pl-3 font-medium text-sm">
        <Icon aria-hidden className="size-4" />
        {t(choice.name)}
        {/* Out of the chip's name, which is the Media Type's alone; the description still reads it. */}
        <Badge
          id={soonId}
          aria-hidden
          variant="secondary"
          className="bg-muted px-2 py-0.5 font-semibold text-muted-foreground text-xs"
        >
          {t("saved.comingSoon")}
        </Badge>
      </span>
    </button>
  );
}
