import { Star } from "lucide-react";
import { useId } from "react";
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
          <Star className={cn("fill-primary text-primary", className)} />
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

// Picks a Rating in half stars: each star is two radio buttons, its left and right halves, so the
// arrow keys step through the Ratings half a star at a time.
export function RatingInput({
  value,
  onChange,
  invalid,
}: {
  value: number | null;
  onChange: (rating: number) => void;
  invalid?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-sm">{t("rating.label")}</legend>
      <div className="flex">
        {starNumbers.map((star) => (
          <span key={star} className="relative">
            <StarShape fill={fillOf(star, value)} className="size-9" />
            {[star - ratingStars.step, star].map((rating) => (
              <input
                key={rating}
                type="radio"
                name={name}
                value={rating}
                checked={value === rating}
                onChange={() => onChange(rating)}
                aria-label={t("rating.stars", { stars: rating })}
                aria-invalid={invalid || undefined}
                className={cn(
                  "absolute inset-y-0 w-1/2 cursor-pointer appearance-none rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  rating === star ? "right-0" : "left-0",
                )}
              />
            ))}
          </span>
        ))}
      </div>
    </fieldset>
  );
}
