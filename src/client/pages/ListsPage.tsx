import { LayoutGrid, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ListPreview } from "../../shared/api";
import * as api from "../api";
import { listsMediaTypes } from "../catalog/media-types";
import { useMediaTypeParam } from "../catalog/use-media-type-param";
import { EmptyState } from "../components/EmptyState";
import { ListCard } from "../components/ListCard";
import { ListFormDialog } from "../components/ListFormDialog";
import { MediaTypeChips } from "../components/MediaTypeChips";
import { t } from "../i18n/t";
import { usePageTitle } from "../navigation/page-title";
import { listPath } from "../navigation/paths";

type ListsState =
  | { status: "loading" }
  | { status: "loaded"; lists: ListPreview[] }
  | { status: "failed" };

// Collections: the User's own Lists of the Media Type the chips are on, which `?type=` names,
// oldest first, as cards with a collage of their first covers, and the way to make a new one of
// that type, which then opens. With none yet, the quiet empty state offers the same.
export function ListsPage() {
  const headingId = useId();
  const [state, setState] = useState<ListsState>({ status: "loading" });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const [mediaType, setMediaType] = useMediaTypeParam(listsMediaTypes);
  usePageTitle([t("lists.title")]);

  useEffect(() => {
    let cancelled = false;
    api.fetchLists().then(
      (lists) => !cancelled && setState({ status: "loaded", lists }),
      () => !cancelled && setState({ status: "failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const lists =
    state.status === "loaded" ? state.lists.filter((list) => list.mediaType === mediaType) : [];
  const noLists = state.status === "loaded" && lists.length === 0;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 id={headingId} className="font-bold text-3xl tracking-tight md:text-4xl">
            {t("lists.title")}
          </h1>
          {/* With no Collections the empty state's button leads, so this one steps back. */}
          <Button
            variant={noLists ? "outline" : "default"}
            className={cn(
              "h-11 shrink-0 rounded-full px-4.5 font-semibold md:h-10",
              noLists && "bg-card",
            )}
            onClick={() => setCreating(true)}
          >
            <Plus aria-hidden />
            {t("lists.new")}
          </Button>
        </div>
        <MediaTypeChips choices={listsMediaTypes} current={mediaType} onChoose={setMediaType} />
      </div>
      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("lists.loading")}</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("lists.unavailable")}
        </p>
      )}
      {noLists && (
        <EmptyState
          icon={LayoutGrid}
          message={t("lists.empty")}
          action={{ label: t("lists.new"), onClick: () => setCreating(true) }}
        />
      )}
      {lists.length > 0 && (
        <ul
          aria-labelledby={headingId}
          className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] md:gap-x-5 md:gap-y-7"
        >
          {lists.map((list) => (
            <li key={list.id}>
              <ListCard list={list} />
            </li>
          ))}
        </ul>
      )}
      <ListFormDialog
        open={creating}
        mediaType={mediaType}
        onClose={() => setCreating(false)}
        onSaved={(list) => navigate(listPath(list.id))}
      />
    </div>
  );
}
