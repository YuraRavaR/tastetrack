import { LayoutGrid, Link2Off } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router";
import type { SharedList } from "../../shared/api";
import * as api from "../api";
import { useAuth } from "../auth";
import { useMetadataFill } from "../catalog/use-metadata-fill";
import { NoteBubble } from "../components/NoteBubble";
import { PosterGridItem } from "../components/PosterGridItem";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { usePageTitle } from "../navigation/page-title";

type SharedListState =
  | { status: "loading" }
  | { status: "loaded"; list: SharedList }
  | { status: "notFound" }
  | { status: "failed" };

async function loadSharedList(token: string): Promise<SharedListState> {
  try {
    const list = await api.fetchSharedList(token);
    return list ? { status: "loaded", list } : { status: "notFound" };
  } catch {
    return { status: "failed" };
  }
}

// What names the browser tab: the List once it loads, and the app's name alone if it can't.
// While it loads, nothing: the Worker named the List in the page's HTML already.
function titleNames(state: SharedListState): string[] | null {
  if (state.status === "loading") return null;
  return state.status === "loaded" ? [state.list.title] : [];
}

// The List behind a Share Link, for anyone holding it, logged in or not: its title, description,
// owner and films in order with their Notes, as a grid of posters, and nothing more. A poster
// opens its film's page only for a logged-in viewer, the one who can see that page. A link that doesn't work says so the same way whether it was revoked, replaced or never
// existed. A visitor without a session is told how to get an account.
export function SharedListPage() {
  const token = useParams().token ?? "";
  const authStatus = useAuth().state.status;
  const anonymous = authStatus === "anonymous";
  const [state, setState] = useState<SharedListState>({ status: "loading" });
  usePageTitle(titleNames(state));
  const fill = useMetadataFill(
    state.status === "loaded" ? state.list.items.map((item) => item.mediaItem) : [],
  );

  useEffect(() => {
    let cancelled = false;
    loadSharedList(token).then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const invite = anonymous && (
    <p className="text-muted-foreground text-sm md:text-base">{t("shared.invite")}</p>
  );

  if (state.status === "loading") {
    return <p className="text-muted-foreground text-sm">{t("shared.loading")}</p>;
  }
  if (state.status === "failed") {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t("shared.unavailable")}
      </p>
    );
  }
  if (state.status === "notFound") return <NotShared invite={invite} />;

  const { list } = state;
  const ownerName = list.owner.displayName;
  return (
    <div className="flex flex-col gap-5.5 md:gap-9 md:pt-4">
      <div className="flex flex-col gap-2 md:max-w-160 md:gap-2.5">
        <p className="flex items-center gap-1.5 font-semibold text-[13px] text-muted-foreground md:text-sm">
          <LayoutGrid aria-hidden className="size-4" />
          {mediaWord(list.mediaType, "collection")}
        </p>
        <h1 className="break-words font-bold text-3xl leading-tight tracking-tight md:text-[2.5rem]">
          {list.title}
        </h1>
        {list.description && (
          <p className="whitespace-pre-line break-words text-[15px] md:text-[17px]">
            {list.description}
          </p>
        )}
        <p className="flex items-center gap-2 text-muted-foreground text-sm md:text-[15px]">
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-strong text-xs md:size-6.5"
          >
            {initialOf(ownerName)}
          </span>
          <span>
            {t("shared.by", { name: ownerName })}
            {list.items.length > 0 && ` · ${t("films.count", { count: list.items.length })}`}
          </span>
        </p>
      </div>
      {list.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("shared.empty")}</p>
      ) : (
        <ol
          aria-label={list.title}
          className="grid grid-cols-2 items-start gap-x-3.5 gap-y-6.5 md:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] md:gap-x-5.5 md:gap-y-9"
        >
          {list.items.map((item, index) => {
            const mediaItem = fill.filled(item.mediaItem);
            const year = mediaItem.metadata?.year;
            return (
              <PosterGridItem
                key={item.position}
                mediaItem={mediaItem}
                loading={fill.loading(item.mediaItem)}
                meta={year != null ? String(year) : undefined}
                place={index + 1}
                unlinked={authStatus !== "authenticated"}
              >
                {item.note && <NoteBubble note={item.note} ownerName={ownerName} />}
              </PosterGridItem>
            );
          })}
        </ol>
      )}
      {invite}
    </div>
  );
}

// The first letter of a name, for the owner's circle: "Y" for "yurii".
function initialOf(name: string): string {
  return (Array.from(name)[0] ?? "").toLocaleUpperCase();
}

// What a link that no longer works shows: two empty poster outlines behind a broken link, and
// what to do about it.
function NotShared({ invite }: { invite: ReactNode }) {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3.5 px-3 py-12 text-center md:gap-4 md:py-20">
      <span aria-hidden className="relative mb-2 block h-30 w-30 md:h-37.5 md:w-40">
        <span className="absolute top-4 left-3.5 h-21 w-14 -rotate-8 rounded-md border-[1.5px] border-border border-dashed md:top-5 md:left-4 md:h-27.75 md:w-18.5" />
        <span className="absolute top-4 right-3.5 h-21 w-14 rotate-8 rounded-md border-[1.5px] border-border border-dashed md:top-5 md:right-4 md:h-27.75 md:w-18.5" />
        <span className="absolute top-1.5 left-7.5 flex h-22.5 w-15 items-center justify-center rounded-md bg-muted text-muted-foreground md:left-10 md:h-30 md:w-20">
          <Link2Off className="size-6" />
        </span>
      </span>
      <h1 className="font-bold text-2xl leading-tight tracking-tight md:text-[2rem]">
        {t("shared.notShared")}
      </h1>
      <p className="max-w-120 text-[15px] text-muted-foreground md:text-[17px]">
        {t("shared.notSharedHint")}
      </p>
      {invite}
    </div>
  );
}
