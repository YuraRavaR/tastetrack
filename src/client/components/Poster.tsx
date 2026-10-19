import { Film } from "lucide-react";

// A poster thumbnail, or a film icon in its place when there is none.
export function Poster({ url }: { url: string | null }) {
  return url ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="h-18 w-12 shrink-0 rounded-sm bg-muted object-cover"
    />
  ) : (
    <div className="flex h-18 w-12 shrink-0 items-center justify-center rounded-sm bg-muted">
      <Film aria-hidden className="size-5 text-muted-foreground" />
    </div>
  );
}
