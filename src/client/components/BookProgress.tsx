import { CircleAlert, Pencil, Plus } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { InProgress } from "../../shared/api";
import {
  type BookPageProblem,
  type BookProgress,
  bookPageProblem,
  progressFor,
} from "../../shared/progress";
import * as api from "../api";
import { t } from "../i18n/t";
import { PageMeter } from "./ProgressMeter";

// What a book's Reading card holds between its heading and its buttons
// (`docs/mockups/book-progress/`): the page the User is on, how many pages are left and the bar
// when they gave the page count, and Change, which puts the editor in the panel's place; or, with
// no Progress yet, "Which page are you on?" and Add page. `label` names the book in a message, and
// `onChanged` reloads the page once a change is saved.
export function BookProgressPanel({
  mediaItemId,
  label,
  inProgress,
  onChanged,
}: {
  mediaItemId: number;
  label: string;
  inProgress: InProgress;
  onChanged: () => Promise<void>;
}) {
  const progress = progressFor(inProgress.progress, "book");
  const [editing, setEditing] = useState(false);
  const change = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // Closing the editor puts focus back on the button that opened it.
  useEffect(() => {
    if (wasEditing.current && !editing) change.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  if (editing) {
    return (
      <PageEditor
        mediaItemId={mediaItemId}
        label={label}
        saved={progress}
        onClose={() => setEditing(false)}
        onSaved={async () => {
          await onChanged();
          setEditing(false);
        }}
      />
    );
  }
  const pageCount = progress?.pageCount;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 rounded-xl border bg-card p-3 sm:flex sm:gap-6 sm:p-3.5">
      <div className="flex min-w-0 flex-col sm:min-w-37.5 sm:flex-none">
        <span className="font-semibold text-[0.8125rem] text-muted-foreground">
          {t("progress.page")}
        </span>
        {progress ? (
          <span className="font-bold text-[1.1875rem] tracking-tight sm:text-xl">
            {progress.page}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">{t("progress.whichPage")}</span>
        )}
        {progress && pageCount !== undefined && (
          <span className="text-muted-foreground text-sm">
            {progress.page === pageCount
              ? t("progress.onLastPage")
              : t("progress.pagesToGo", { count: pageCount - progress.page })}
          </span>
        )}
      </div>
      <Button
        ref={change}
        variant="outline"
        className="h-11 bg-background sm:order-last sm:ml-auto sm:h-10"
        aria-label={progress ? t("progress.changePageLabel") : undefined}
        onClick={() => setEditing(true)}
      >
        {progress ? <Pencil aria-hidden /> : <Plus aria-hidden />}
        {t(progress ? "progress.changePage" : "progress.addPage")}
      </Button>
      {progress && pageCount !== undefined && (
        <PageMeter
          page={progress.page}
          pageCount={pageCount}
          size="card"
          className="col-span-2 sm:max-w-85 sm:flex-1"
        />
      )}
    </div>
  );
}

// Why the editor can't save: a page or page count the rules refuse, or a save that failed.
type EditorProblem = BookPageProblem | "failed";

// Only digits go into the fields, so what they hold is always a whole number or nothing.
function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

// The page and the page count, as two fields in the panel's place. Save writes them whole in one
// request, Clear removes the Progress, and Cancel or Escape closes the editor without a change.
// A page or page count the rules refuse is said under the fields, and Save waits for a change.
function PageEditor({
  mediaItemId,
  label,
  saved,
  onClose,
  onSaved,
}: {
  mediaItemId: number;
  label: string;
  saved: BookProgress | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [page, setPage] = useState(saved ? String(saved.page) : "");
  const [pageCount, setPageCount] = useState(saved?.pageCount?.toString() ?? "");
  const [problem, setProblem] = useState<EditorProblem | null>(null);
  const [saving, setSaving] = useState(false);
  const pageField = useRef<HTMLInputElement>(null);
  const pageId = useId();
  const pageCountId = useId();
  const problemId = useId();

  // Focus goes to the page, its text selected, so typing replaces it.
  useEffect(() => {
    pageField.current?.focus();
    pageField.current?.select();
  }, []);

  const refused = problem !== null && problem !== "failed";

  async function save(progress: BookProgress | null) {
    setProblem(null);
    setSaving(true);
    if (!(await api.changeProgress(mediaItemId, progress))) {
      setSaving(false);
      setProblem("failed");
      return;
    }
    await onSaved();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (page === "" || saving || refused) return;
    const progress: BookProgress = {
      mediaType: "book",
      page: Number(page),
      ...(pageCount === "" ? {} : { pageCount: Number(pageCount) }),
    };
    const found = bookPageProblem(progress);
    if (found) {
      setProblem(found);
      return;
    }
    void save(progress);
  }

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onClose();
  }

  const message = problem && problemMessage(problem);
  const pageInvalid = problem === "page_out_of_range" || problem === "past_last_page";
  const pageCountInvalid = problem === "page_count_out_of_range";
  return (
    <form
      noValidate
      onSubmit={submit}
      onKeyDown={closeOnEscape}
      className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-3.5"
    >
      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:gap-3">
        <NumberField
          ref={pageField}
          id={pageId}
          label={t("progress.page")}
          value={page}
          invalid={pageInvalid}
          describedBy={pageInvalid ? problemId : undefined}
          className="sm:w-35"
          onChange={(value) => {
            setPage(value);
            setProblem(null);
          }}
        />
        <NumberField
          id={pageCountId}
          label={t("progress.pageCount")}
          placeholder={t("progress.optional")}
          value={pageCount}
          invalid={pageCountInvalid}
          describedBy={pageCountInvalid ? problemId : undefined}
          className="sm:w-45"
          onChange={(value) => {
            setPageCount(value);
            setProblem(null);
          }}
        />
      </div>
      {message && (
        <p
          id={problemId}
          role="alert"
          className="flex items-start gap-1.5 text-destructive text-sm sm:order-3 sm:basis-full"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {message}
        </p>
      )}
      <div className="flex items-center gap-2 sm:ml-auto">
        {saved && (
          <Button
            type="button"
            variant="ghost"
            className="-ml-1 h-11 px-2.5 text-muted-foreground sm:h-10"
            disabled={saving}
            onClick={() => void save(null)}
          >
            {t("progress.clear")}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="ml-auto h-11 bg-background sm:ml-0 sm:h-10"
          onClick={onClose}
        >
          {t("progress.cancel")}
        </Button>
        <Button type="submit" className="h-11 sm:h-10" disabled={page === "" || saving || refused}>
          {t(saving ? "inProgress.saving" : "inProgress.save")}
        </Button>
      </div>
    </form>
  );

  function problemMessage(found: EditorProblem): string {
    if (found === "past_last_page") {
      return t("progress.pastLastPage", { page, count: pageCount });
    }
    if (found === "page_out_of_range") return t("progress.pageOutOfRange");
    if (found === "page_count_out_of_range") return t("progress.pageCountOutOfRange");
    return t("progress.pageSaveFailed", { film: label });
  }
}

// A labelled field that takes a whole number, with the phone's number keyboard.
function NumberField({
  ref,
  id,
  label,
  value,
  placeholder,
  invalid,
  describedBy,
  className,
  onChange,
}: {
  ref?: Ref<HTMLInputElement>;
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  invalid: boolean;
  describedBy?: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="font-semibold text-[0.8125rem] text-muted-foreground">
        {label}
      </Label>
      <Input
        ref={ref}
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="h-12 rounded-lg bg-background px-3 font-bold text-lg aria-invalid:ring-[3px] placeholder:font-normal placeholder:text-base sm:h-10 sm:rounded-md sm:text-base md:text-base dark:bg-background"
        onChange={(event) => onChange(digitsOf(event.target.value))}
      />
    </div>
  );
}

// A book's Progress on its row in "Reading now": the bar, "142 of 380", with a page count, and
// "p. 142" without one; nothing without Progress.
export function BookProgressLine({ inProgress }: { inProgress: InProgress | null }) {
  const progress = progressFor(inProgress?.progress, "book");
  if (!progress) return null;
  if (progress.pageCount === undefined) {
    return (
      <span className="text-muted-foreground text-xs md:text-[0.8125rem]">
        {t("progress.pageShort", { page: progress.page })}
      </span>
    );
  }
  return <PageMeter page={progress.page} pageCount={progress.pageCount} size="row" />;
}
