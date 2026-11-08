import { Link } from "react-router";
import { cn } from "@/lib/utils";

export interface Segment {
  to: string;
  label: string;
  // Shown muted after the label, such as how many films a tab holds; none while unknown.
  count?: number;
  current: boolean;
}

// A segmented control whose segments are links, each to its own address, with the current one
// raised and marked for screen readers. Full width on a phone; from `md` only as wide as it needs.
export function SegmentedLinks({ label, segments }: { label: string; segments: Segment[] }) {
  return (
    <nav
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-xl bg-muted p-0.75 md:flex md:self-start"
    >
      {segments.map(({ to, label: segmentLabel, count, current }) => (
        <Link
          key={to}
          to={to}
          aria-current={current ? "page" : undefined}
          className={cn(
            "flex h-9.5 items-center justify-center gap-1 rounded-lg font-semibold text-sm md:h-9 md:px-4.5",
            current && "bg-card shadow-sm",
          )}
        >
          {segmentLabel}
          {count !== undefined && (
            <span className="font-medium text-muted-foreground">{count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
