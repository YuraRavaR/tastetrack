import { Bookmark, Clock, House, List, type LucideIcon } from "lucide-react";
import { NavLink } from "react-router";
import { pageMediaType } from "../i18n/media-words";
import { type MessageId, t } from "../i18n/t";

// The app's sections, the one list the header and the tab bar both render. A Media Type is a
// filter inside a section, so this list doesn't grow with them.
const sections: { to: string; icon: LucideIcon; label: MessageId }[] = [
  { to: "/", icon: House, label: "home.nav" },
  { to: "/log", icon: Clock, label: "log.nav" },
  { to: "/watchlist", icon: Bookmark, label: `mediaType.${pageMediaType}.backlog` },
  { to: "/lists", icon: List, label: "lists.nav" },
];

// The sections as text links in the header, from `md`. NavLink marks the current one.
export function SectionHeaderLinks() {
  return (
    <nav aria-label={t("nav.label")} className="hidden gap-1 md:flex">
      {sections.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className="flex h-9 items-center rounded-md px-3 font-medium text-muted-foreground text-sm hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
        >
          {t(label)}
        </NavLink>
      ))}
    </nav>
  );
}

// The sections as a bottom tab bar, below `md`. It sticks to the bottom of the screen and pads for
// the iPhone home indicator.
export function SectionTabBar() {
  return (
    <nav
      aria-label={t("nav.label")}
      className="sticky bottom-0 z-10 grid grid-cols-4 border-t bg-card px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] md:hidden"
    >
      {sections.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className="group flex min-h-11 flex-col items-center justify-center gap-0.5 font-medium text-muted-foreground text-xs aria-[current=page]:font-bold aria-[current=page]:text-primary-strong"
        >
          <span className="flex rounded-full px-4 py-0.5 group-aria-[current=page]:bg-primary-soft">
            <Icon aria-hidden className="size-5" />
          </span>
          {t(label)}
        </NavLink>
      ))}
    </nav>
  );
}
