import { useLayoutEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { t } from "../i18n/t";

// The bubble's tail, pointing up at the poster above it.
const bubble =
  "relative flex w-full flex-col gap-1 rounded-lg bg-muted px-2.5 py-2 text-left text-sm leading-snug " +
  "before:absolute before:-top-1.25 before:left-3.5 before:size-2.5 before:rotate-45 before:bg-muted " +
  "md:px-3 md:py-2.5 md:before:left-4";

// A Note under its film's poster, in a bubble. A Note longer than three lines at the current
// width is cut at three, and then the whole bubble is a button: More opens it, Less cuts it again.
// Screen readers hear whose Note it is first.
export function NoteBubble({ note, ownerName }: { note: string; ownerName: string }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  // A state, not a ref: the text's element is a new one when the bubble turns into a button.
  const [text, setText] = useState<HTMLElement | null>(null);

  // Measured while cut, again whenever its width changes; an open Note keeps its Less.
  useLayoutEffect(() => {
    if (!text || open) return;
    const measure = () => setOverflows(text.scrollHeight > text.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    return () => observer.disconnect();
  }, [text, open]);

  const content = (
    <>
      <span className="sr-only">{t("shared.noteBy", { name: ownerName })}</span>
      <span
        ref={setText}
        className={cn("whitespace-pre-line break-words", !open && "line-clamp-3")}
      >
        {note}
      </span>
    </>
  );

  if (!overflows) return <p className={bubble}>{content}</p>;
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cn(
        bubble,
        "min-h-11 cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      )}
    >
      {content}
      <span className="font-semibold text-primary-strong text-xs md:text-sm">
        {t(open ? "shared.noteLess" : "shared.noteMore")}
      </span>
    </button>
  );
}
