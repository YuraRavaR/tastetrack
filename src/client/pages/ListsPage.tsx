import { LayoutGrid, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ListPreview } from "../../shared/api";
import * as api from "../api";
import { EmptyState } from "../components/EmptyState";
import { ListCard } from "../components/ListCard";
import { ListFormDialog } from "../components/ListFormDialog";
import { MediaTypeChips } from "../components/MediaTypeChips";
import { t } from "../i18n/t";
import { listPath } from "../navigation/paths";

type ListsState =
  | { status: "loading" }
  | { status: "loaded"; lists: ListPreview[] }
  | { status: "failed" };

// Collections: the User's own Lists, oldest first, as cards with a collage of their first covers,
// under the Media Type chips, and the way to make a new one, which then opens. With none yet, the
// quiet empty state offers the same.
export function ListsPage() {
  const headingId = useId();
  const [state, setState] = useState<ListsState>({ status: "loading" });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

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

  const none = state.status === "loaded" && state.lists.length === 0;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 id={headingId} className="font-bold text-3xl tracking-tight md:text-4xl">
            {t("lists.title")}
          </h1>
          {/* With no Collections the empty state's button leads, so this one steps back. */}
          <Button
            variant={none ? "outline" : "default"}
            className={cn(
              "h-11 shrink-0 rounded-full px-4.5 font-semibold md:h-10",
              none && "bg-card",
            )}
            onClick={() => setCreating(true)}
          >
            <Plus aria-hidden />
            {t("lists.new")}
          </Button>
        </div>
        <MediaTypeChips current="film" />
      </div>
      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("lists.loading")}</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("lists.unavailable")}
        </p>
      )}
      {none && (
        <EmptyState
          icon={LayoutGrid}
          message={t("lists.empty")}
          action={{ label: t("lists.new"), onClick: () => setCreating(true) }}
        />
      )}
      {state.status === "loaded" && state.lists.length > 0 && (
        <ul
          aria-labelledby={headingId}
          className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] md:gap-x-5 md:gap-y-7"
        >
          {state.lists.map((list) => (
            <li key={list.id}>
              <ListCard list={list} />
            </li>
          ))}
        </ul>
      )}
      <ListFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(list) => navigate(listPath(list.id))}
      />
    </div>
  );
}
