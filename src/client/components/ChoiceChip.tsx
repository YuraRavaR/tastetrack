import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { t } from "../i18n/t";

export interface Choice {
  value: string;
  label: string;
}

// A sort or filter chip: a pill showing the current choice that opens a menu of single choices,
// the current one checked. `set` marks a chip whose filter narrows the list, which then looks
// selected. A screen reader hears what the chip sets and its choice: "Genre: Any genre".
export function ChoiceChip({
  name,
  icon: Icon,
  shown,
  choices,
  chosen,
  set = false,
  onChoose,
}: {
  name: string;
  icon?: LucideIcon;
  // What the pill says, such as "Genre" while unset and "Drama" once set.
  shown: string;
  choices: readonly Choice[];
  chosen: string;
  set?: boolean;
  onChoose(value: string): void;
}) {
  const chosenLabel = choices.find((choice) => choice.value === chosen)?.label ?? shown;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("saved.chip", { chip: name, choice: chosenLabel })}
        className={cn(
          "flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-card pr-2.5 pl-3 font-medium text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
          set && "border-primary-strong bg-primary-soft",
        )}
      >
        {Icon && <Icon aria-hidden className="size-3.75" />}
        {shown}
        <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48 rounded-xl p-1">
        <DropdownMenuRadioGroup value={chosen} onValueChange={onChoose}>
          {choices.map((choice) => (
            <DropdownMenuPrimitive.RadioItem
              key={choice.value}
              value={choice.value}
              className="flex h-11 cursor-default select-none items-center justify-between gap-2.5 rounded-lg px-2.5 text-[15px] outline-hidden focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-muted"
            >
              {choice.label}
              <DropdownMenuPrimitive.ItemIndicator>
                <Check aria-hidden className="size-4 text-primary-strong" strokeWidth={2.25} />
              </DropdownMenuPrimitive.ItemIndicator>
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
