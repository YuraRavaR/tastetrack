import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import type { ListSummary } from "../../shared/api";
import * as api from "../api";
import { ListFormDialog } from "../components/ListFormDialog";
import { t } from "../i18n/t";

type ListsState =
  | { status: "loading" }
  | { status: "loaded"; lists: ListSummary[] }
  | { status: "failed" };

// The User's own Lists, oldest first, each with its description and how many films it holds,
// and the way to make a new one, which then opens.
export function ListsPage() {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl tracking-tight">{t("lists.title")}</h1>
          {state.status === "loaded" && state.lists.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {t("lists.count", { count: state.lists.length })}
            </p>
          )}
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          {t("lists.new")}
        </Button>
      </div>
      {state.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("lists.loading")}</p>
      )}
      {state.status === "failed" && (
        <p role="alert" className="text-destructive text-sm">
          {t("lists.unavailable")}
        </p>
      )}
      {state.status === "loaded" && state.lists.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("lists.empty")}</p>
      )}
      {state.status === "loaded" && state.lists.length > 0 && (
        <ul aria-label={t("lists.listLabel")} className="flex flex-col divide-y rounded-lg border">
          {state.lists.map((list) => (
            <li key={list.id} className="flex flex-col gap-1 px-3 py-3">
              <Link
                to={`/lists/${list.id}`}
                className="break-words font-medium underline-offset-4 hover:underline focus-visible:underline"
              >
                {list.name}
              </Link>
              {list.description && (
                <p className="line-clamp-2 break-words text-muted-foreground text-sm">
                  {list.description}
                </p>
              )}
              <p className="text-muted-foreground text-sm">
                {t("films.count", { count: list.itemCount })}
              </p>
            </li>
          ))}
        </ul>
      )}
      <ListFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(list) => navigate(`/lists/${list.id}`)}
      />
    </div>
  );
}
