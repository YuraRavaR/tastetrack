import { Bookmark, LayoutGrid, type LucideIcon, Search } from "lucide-react";
import { Link, matchPath, useLocation } from "react-router";
import { type MessageId, t } from "../i18n/t";
import { collectionsPath, savedPath, searchPath } from "../navigation/paths";

interface Section {
  to: string;
  icon: LucideIcon;
  label: MessageId;
  // The addresses that belong to the section, which mark it current.
  within: readonly string[];
}

// The app's sections, the one list the header and the tab bar both render. A Media Type is a
// filter inside a section, so this list doesn't grow with them. A page outside them all, such as
// a film's page or Settings, marks none.
const sections: readonly Section[] = [
  { to: savedPath, icon: Bookmark, label: "saved.nav", within: [savedPath, "/saved/*"] },
  { to: collectionsPath, icon: LayoutGrid, label: "lists.nav", within: [`${collectionsPath}/*`] },
  { to: searchPath, icon: Search, label: "search.nav", within: [searchPath] },
];

function useCurrentSection(): Section | undefined {
  const { pathname } = useLocation();
  return sections.find(({ within }) => within.some((pattern) => matchPath(pattern, pathname)));
}

// The sections as text links in the header, from `md`, the current one marked.
export function SectionHeaderLinks() {
  const current = useCurrentSection();
  return (
    <nav aria-label={t("nav.label")} className="hidden gap-1 md:flex">
      {sections.map((section) => (
        <Link
          key={section.to}
          to={section.to}
          aria-current={section === current ? "page" : undefined}
          className="flex h-9 items-center rounded-lg px-3.5 font-medium text-muted-foreground hover:text-foreground aria-[current=page]:bg-primary-soft aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
        >
          {t(section.label)}
        </Link>
      ))}
    </nav>
  );
}

// The sections as a bottom tab bar, below `md`, the current one marked. It sticks to the bottom of
// the screen and pads for the iPhone home indicator.
export function SectionTabBar() {
  const current = useCurrentSection();
  return (
    <nav
      aria-label={t("nav.label")}
      className="sticky bottom-0 z-10 grid grid-cols-3 gap-2 border-t bg-card px-3 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] md:hidden"
    >
      {sections.map((section) => (
        <Link
          key={section.to}
          to={section.to}
          aria-current={section === current ? "page" : undefined}
          className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl py-1 font-medium text-muted-foreground text-xs aria-[current=page]:bg-primary-soft aria-[current=page]:font-semibold aria-[current=page]:text-primary-strong"
        >
          <section.icon aria-hidden className="size-6" />
          {t(section.label)}
        </Link>
      ))}
    </nav>
  );
}
