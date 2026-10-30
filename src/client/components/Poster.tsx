import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

// A poster thumbnail, or a film icon in its place when there is none. `className` can resize it.
export function Poster({ url, className }: { url: string | null; className?: string }) {
  return url ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      className={cn("h-18 w-12 shrink-0 rounded-sm bg-muted object-cover", className)}
    />
  ) : (
    <div
      className={cn(
        "flex h-18 w-12 shrink-0 items-center justify-center rounded-sm bg-muted",
        className,
      )}
    >
      <Film aria-hidden className="size-5 text-muted-foreground" />
    </div>
  );
}
