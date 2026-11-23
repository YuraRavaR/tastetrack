import { ChevronLeft } from "lucide-react";
import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { MediaType } from "../../shared/api";
import { isLight } from "../../shared/catalog";
import { t } from "../i18n/t";
import { libraryPath } from "../library/library-tabs";
import { listsPathOf } from "../navigation/paths";

// Whether the app has a page of its own to go back to. React Router numbers its entries in the
// browser's history from 0, the page the app opened on, and a redirect keeps the number: after a
// fresh start, a pasted link or the login a pasted link led to, the entry is still 0.
function openedFromInsideTheApp(): boolean {
  const index = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof index === "number" && index > 0;
}

// "‹ Back" at the top of a Media Item's page on a phone, drawn as Saved's, since an app installed
// on the home screen has no browser Back. It goes back to where the User opened the page from, so
// Search returns with its query; opened directly, to Saved of the Media Item's Media Type, or to
// Collections of songs for a song, which Saved never holds. A click that opens a new tab keeps the
// link's own address. From md the browser's Back is the way.
export function BackLink({ mediaType }: { mediaType: MediaType }) {
  const navigate = useNavigate();

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    const newTab =
      event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (newTab || !openedFromInsideTheApp()) return;
    event.preventDefault();
    navigate(-1);
  }

  return (
    <Link
      to={isLight(mediaType) ? listsPathOf(mediaType) : libraryPath(mediaType, "backlog")}
      onClick={goBack}
      className="-ml-2 flex h-9 items-center gap-0.5 self-start px-2 text-muted-foreground md:hidden"
    >
      <ChevronLeft aria-hidden className="size-4.5" />
      {t("itemHistory.back")}
    </Link>
  );
}
