import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { earliestLogDate } from "../../shared/log";
import { t } from "../i18n/t";
import { type DateChip, dateChipFor, dateChips, dateOfChip } from "../log/date-chips";

// What the field holds: the chip picked, and the Other date's own field.
export interface LogDateValue {
  chip: DateChip;
  otherDate: string;
}

// The value that shows `date`, given the User's `today`.
export function logDateValue(date: string | null, today: string): LogDateValue {
  const chip = dateChipFor(date, today);
  return { chip, otherDate: chip === "other" ? (date ?? "") : "" };
}

// The date the value stands for.
export function logDateOf({ chip, otherDate }: LogDateValue, today: string): string | null {
  return dateOfChip(chip, today, otherDate);
}

const chipLabels = {
  today: "logEntry.today",
  yesterday: "logEntry.yesterday",
  other: "logEntry.otherDate",
  none: "logEntry.noDate",
} as const;

// An optional calendar date by a Log Entry date's rules, picked with chips: Today, Yesterday,
// Other date, which opens a date field, and No date. `dateLabel` names that field, and `error`
// shows under it.
export function LogDateField({
  legend,
  dateLabel,
  today,
  value,
  onChange,
  error,
}: {
  legend: string;
  dateLabel: string;
  today: string;
  value: LogDateValue;
  onChange: (value: LogDateValue) => void;
  error: string | null;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-sm">
        {legend} <span className="font-normal text-muted-foreground">{t("logEntry.optional")}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {dateChips.map((option) => (
          <Button
            key={option}
            type="button"
            variant={value.chip === option ? "pressed" : "outline"}
            aria-pressed={value.chip === option}
            className={cn(
              "h-11 rounded-full px-3.5 font-normal md:h-9",
              value.chip === option && "font-semibold text-foreground",
            )}
            onClick={() => onChange({ ...value, chip: option })}
          >
            {t(chipLabels[option])}
          </Button>
        ))}
      </div>
      {value.chip === "other" && (
        <Input
          type="date"
          aria-label={dateLabel}
          min={earliestLogDate}
          max={today}
          value={value.otherDate}
          onChange={(event) => onChange({ ...value, otherDate: event.target.value })}
          aria-invalid={error !== null || undefined}
          className="h-11 w-auto self-start md:h-10"
        />
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
