import { useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { t } from "../i18n/t";

// The bubble: a muted box with a small tail at its top left, pointing up at the poster above it.
const bubbleClass =
  "relative flex w-full flex-col items-start gap-1 rounded-lg bg-muted px-2.5 py-2 text-left " +
  "text-[13px] leading-[1.4] md:px-3 md:py-2.5 md:text-sm md:leading-[1.45] " +
  "before:absolute before:-top-1.25 before:left-3.5 before:size-2.5 before:rotate-45 " +
  "before:bg-muted md:before:left-4";

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

  if (!overflows) return <p className={bubbleClass}>{content}</p>;
  return (
    <Button
      variant="ghost"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cn(
        bubbleClass,
        "h-auto min-h-11 justify-start whitespace-normal font-normal hover:before:bg-accent dark:hover:before:bg-accent/50",
      )}
    >
      {content}
      <span className="font-semibold text-primary-strong text-xs md:text-[13px]">
        {t(open ? "shared.noteLess" : "shared.noteMore")}
      </span>
    </Button>
  );
}
