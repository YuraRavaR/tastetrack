import { CircleAlert, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { maxFavourites } from "../../shared/lists";
import type { LikeResult } from "../api";
import { t } from "../i18n/t";

// Why a Like, or taking one back, failed: Favourite artists is full, or the server couldn't be
// reached.
export type LikeError = Extract<LikeResult, { ok: false }>["error"];

// ♥ on an artist's search row and page (`docs/mockups/artists/`): "Favourite" as an outline, and
// "In Favourites", filled, on `primary-soft` once liked. A refusal shows under it, in `LikeErrorLine`,
// which `errorId` names.
export function LikeButton({
  liked,
  busy,
  errorId,
  className,
  onClick,
}: {
  liked: boolean;
  busy: boolean;
  errorId?: string | undefined;
  className?: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant={liked ? "pressed" : "outline"}
      className={cn("gap-1.5 font-semibold", className)}
      disabled={busy}
      aria-pressed={liked}
      aria-describedby={errorId}
      onClick={onClick}
    >
      <Heart aria-hidden className={cn(liked && "fill-current")} />
      {t(liked ? "artist.liked" : "artist.like")}
    </Button>
  );
}

// What went wrong with the last Like, in `destructive`, with its icon.
export function LikeErrorLine({ id, error }: { id: string; error: LikeError }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-destructive text-sm">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {error === "favourites_full"
        ? t("artist.favouritesFull", { max: maxFavourites })
        : t("artist.likeFailed")}
    </p>
  );
}
