import { Star } from "lucide-react";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { ratingStars } from "../../shared/log";
import { t } from "../i18n/t";

const starCount = ratingStars.max;
const starNumbers = Array.from({ length: starCount }, (_, i) => i + 1);

// One star, filled in full, by half or not at all.
function StarShape({ fill, className }: { fill: 0 | 0.5 | 1; className: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block", className)}>
      <Star className="absolute inset-0 size-full text-muted-foreground" />
      {fill > 0 && (
        <span
          className={cn(
            "absolute inset-y-0 left-0 overflow-hidden",
            fill === 1 ? "w-full" : "w-1/2",
          )}
        >
          <Star className={cn("fill-primary text-primary-strong", className)} />
        </span>
      )}
    </span>
  );
}

function fillOf(star: number, rating: number | null): 0 | 0.5 | 1 {
  if (rating === null || rating <= star - 1) return 0;
  return rating >= star ? 1 : 0.5;
}

// A Rating shown as five stars, read out as e.g. "4.5 stars".
export function RatingStars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={t("rating.stars", { stars: rating })} className="flex">
      {starNumbers.map((star) => (
        <StarShape key={star} fill={fillOf(star, rating)} className="size-4" />
      ))}
    </span>
  );
}

// A Rating shown as one filled star and its number, read out the same way.
export function RatingValue({ rating }: { rating: number }) {
  return (
    <span
      role="img"
      aria-label={t("rating.stars", { stars: rating })}
      className="flex items-center gap-1.5"
    >
      <StarShape fill={1} className="size-4.5" />
      {t("rating.value", { stars: rating })}
    </span>
  );
}

// Picks a Rating in half stars: each star is two radio buttons, its left and right halves, so the
// arrow keys step through the Ratings half a star at a time. The Rating shows as a number beside
// the stars, `hint` sits beside the legend, and `error` says under them what's wrong.
export function RatingInput({
  value,
  onChange,
  hint = null,
  error,
}: {
  value: number | null;
  onChange: (rating: number) => void;
  hint?: ReactNode;
  error: string | null;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex w-full items-baseline justify-between gap-2 font-medium text-sm">
        {t("rating.label")}
        {hint}
      </legend>
      <div className="flex items-center gap-3.5">
        <div className="flex gap-0.5">
          {starNumbers.map((star) => (
            <span key={star} className="relative">
              <StarShape
                fill={fillOf(star, value)}
                className="size-11 md:size-10 [&_svg]:stroke-[1.4]"
              />
              {[star - ratingStars.step, star].map((rating) => (
                <input
                  key={rating}
                  type="radio"
                  name={name}
                  value={rating}
                  checked={value === rating}
                  onChange={() => onChange(rating)}
                  aria-label={t("rating.stars", { stars: rating })}
                  aria-invalid={error !== null || undefined}
                  className={cn(
                    "absolute inset-y-0 w-1/2 cursor-pointer appearance-none rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                    rating === star ? "right-0" : "left-0",
                  )}
                />
              ))}
            </span>
          ))}
        </div>
        <span className="font-semibold text-2xl tabular-nums">
          {value === null ? t("rating.none") : t("rating.value", { stars: value })}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
