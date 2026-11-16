import { cn } from "@/lib/utils";
import { t } from "../i18n/t";

// The bar and its count in a row, and a little larger on a Media Item's page.
const meterSizes = {
  row: { box: "gap-2 text-xs md:max-w-85 md:gap-2.5 md:text-[0.8125rem]", bar: "h-1.25" },
  card: { box: "gap-2.5 text-[0.8125rem]", bar: "h-1.5" },
};

type MeterSize = keyof typeof meterSizes;

// How far through a Media Item the User is: a bar, then the count, "15 of 62". The bar reads out
// as `label`, which says the count in full, so the count beside it is hidden from a screen
// reader. A series and a book share it, so the two read as one system.
function ProgressMeter({
  done,
  count,
  label,
  size,
  className,
}: {
  done: number;
  count: number;
  label: string;
  size: MeterSize;
  className?: string;
}) {
  const share = count > 0 ? Math.min(100, Math.round((done / count) * 100)) : 0;
  return (
    <span
      className={cn(
        "flex items-center whitespace-nowrap text-muted-foreground",
        meterSizes[size].box,
        className,
      )}
    >
      <span
        role="img"
        aria-label={label}
        className={cn("min-w-0 flex-1 overflow-hidden rounded-full bg-muted", meterSizes[size].bar)}
      >
        <span
          className="block h-full rounded-full bg-primary-strong"
          style={{ width: `${share}%` }}
        />
      </span>
      <span aria-hidden>{t("progress.watched", { watched: done, count })}</span>
    </span>
  );
}

// How much of a series is watched, "15 of 62", read out as "15 of 62 episodes watched".
export function EpisodeMeter({
  watched,
  count,
  size,
}: {
  watched: number;
  count: number;
  size: MeterSize;
}) {
  const label = t("progress.watchedEpisodes", { watched, count });
  return <ProgressMeter done={watched} count={count} label={label} size={size} />;
}

// How far through their edition of a book the User is, "142 of 272", read out as "Page 142 of
// 272".
export function PageMeter({
  page,
  pageCount,
  size,
  className,
}: {
  page: number;
  pageCount: number;
  size: MeterSize;
  className?: string;
}) {
  const label = t("progress.pageOfCount", { page, count: pageCount });
  return (
    <ProgressMeter done={page} count={pageCount} label={label} size={size} className={className} />
  );
}
