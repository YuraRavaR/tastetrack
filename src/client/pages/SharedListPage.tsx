import { useEffect, useState } from "react";
import { useParams } from "react-router";
import type { SharedList } from "../../shared/api";
import * as api from "../api";
import { FilmTitle } from "../components/FilmTitle";
import { Poster } from "../components/Poster";
import { t } from "../i18n/t";

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

// The List behind a Share Link, for anyone holding it, logged in or not: its title, description,
// owner and films in order with their Notes, and nothing more. A link that doesn't work says so
// the same way whether it was revoked, replaced or never existed.
export function SharedListPage() {
  const token = useParams().token ?? "";
  const [state, setState] = useState<SharedListState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadSharedList(token).then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
  if (state.status === "notFound") {
    return <p className="text-muted-foreground text-sm">{t("shared.notFound")}</p>;
  }

  const { list } = state;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="break-words font-semibold text-2xl tracking-tight">{list.title}</h1>
        {list.description && <p className="whitespace-pre-line break-words">{list.description}</p>}
        <p className="text-muted-foreground text-sm">
          {t("shared.by", { name: list.owner.displayName })}
          {list.items.length > 0 && ` · ${t("films.count", { count: list.items.length })}`}
        </p>
      </div>
      {list.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("shared.empty")}</p>
      ) : (
        <ul aria-label={list.title} className="flex flex-col divide-y rounded-lg border">
          {list.items.map((item) => (
            <li key={item.position} className="flex gap-3 px-3 py-3">
              <Poster url={item.mediaItem.metadata?.posterUrl ?? null} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <FilmTitle metadata={item.mediaItem.metadata} />
                {item.note && (
                  <p className="whitespace-pre-line break-words text-sm">{item.note}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
