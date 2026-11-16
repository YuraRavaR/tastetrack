import { useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { About as AboutData } from "../../shared/api";
import { t } from "../i18n/t";

// A text in English and in Ukrainian, null where the source has none.
type LocalizedText = Extract<AboutData, { mediaType: "film" }>["overview"];

// One row of the credits: its label, such as "Director", and the names under it.
export interface CreditRow {
  label: string;
  names: string[];
}

// What the About block shows, whatever the Media Type: a book has no tagline, credits or Ukrainian
// text, a series names its creators where a film names its directors.
export interface AboutProps {
  tagline: LocalizedText;
  overview: LocalizedText;
  credits: CreditRow[];
  // Where the texts come from, such as "From TMDB".
  source: string;
}

// More, Less and the language switch: text links in the accent colour, 44 px tall to tap.
const linkClass =
  "h-11 rounded-lg px-2.5 font-semibold text-[14px] text-primary-strong " +
  "hover:text-primary-strong sm:text-[15px]";

// What a Media Item is about, under its titles: the tagline, the overview cut at 4 lines on a
// phone and 3 from `sm`, More and Less when it is longer than that, a switch to the Ukrainian
// tagline and overview when there is a Ukrainian overview, the credits and the source. While cut,
// the overview's paragraphs run together, so the cut never ends on an empty line. English comes
// first, and the language picked isn't remembered; an overview only in Ukrainian shows with no
// switch, and in Ukrainian the tagline is the Ukrainian one or none.
export function About({ tagline, overview, credits, source }: AboutProps) {
  const [picked, setPicked] = useState<"en" | "uk">("en");
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [text, setText] = useState<HTMLElement | null>(null);
  const switchable = overview.en !== null && overview.uk !== null;
  const language = overview.en === null && overview.uk !== null ? "uk" : picked;
  const shownOverview = overview[language];
  const shownTagline = tagline[language];
  const rows = credits.filter((row) => row.names.length > 0);

  // Measured while cut, as the Note bubble does, again whenever its width or text changes; an
  // open overview keeps its Less.
  useLayoutEffect(() => {
    if (!text || open || shownOverview === null) return;
    const measure = () => setOverflows(text.scrollHeight > text.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    return () => observer.disconnect();
  }, [text, open, shownOverview]);

  const textLanguage = language === "uk" ? "uk" : undefined;
  return (
    <section aria-label={t("about.label")} className="flex max-w-170 flex-col gap-2 sm:gap-2.5">
      {shownTagline && (
        <p lang={textLanguage} className="font-medium text-[15px] italic sm:text-[17px]">
          {shownTagline}
        </p>
      )}
      {shownOverview && (
        <p
          ref={setText}
          lang={textLanguage}
          className={cn(
            "break-words text-[15px] leading-[1.5] sm:text-base sm:leading-[1.55]",
            open ? "whitespace-pre-line" : "line-clamp-4 sm:line-clamp-3",
          )}
        >
          {open ? shownOverview : shownOverview.replace(/\s*\n\s*/g, " ")}
        </p>
      )}
      {/* The links are 44 px tall, so the row reaches past its neighbours' spacing. */}
      <div
        className={cn(
          "flex items-center gap-1",
          (overflows || switchable) && "-mt-2 -mb-1.5 -ml-2.5",
        )}
      >
        {overflows && (
          <Button
            variant="ghost"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className={linkClass}
          >
            {t(open ? "about.less" : "about.more")}
          </Button>
        )}
        {overflows && switchable && (
          <span aria-hidden="true" className="text-[14px] text-muted-foreground">
            ·
          </span>
        )}
        {switchable && (
          <Button
            variant="ghost"
            lang={language === "en" ? "uk" : "en"}
            onClick={() => setPicked(language === "en" ? "uk" : "en")}
            className={linkClass}
          >
            {t(language === "en" ? "about.ukrainian" : "about.english")}
          </Button>
        )}
        <span className="ml-auto text-muted-foreground text-xs sm:text-[13px]">{source}</span>
      </div>
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[14px] leading-[1.4] sm:gap-x-3.5 sm:text-[15px]">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd>{row.names.join(", ")}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

// What a Media Item's page passes its About block, by its Media Type.
export function aboutProps(about: AboutData): AboutProps {
  switch (about.mediaType) {
    case "film":
      return {
        tagline: about.tagline,
        overview: about.overview,
        credits: [
          {
            label: t("about.directors", { count: about.directors.length }),
            names: about.directors,
          },
          { label: t("about.cast"), names: about.cast },
        ],
        source: t("about.fromTmdb"),
      };
  }
}
