import { Ellipsis, MessageSquare, Pencil, Quote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MediaType, Thought } from "../../shared/api";
import type { ThoughtState } from "../../shared/thoughts";
import { mediaWord } from "../i18n/media-words";
import { formatCalendarDate, t } from "../i18n/t";
import { progressLabel } from "../in-progress/progress-label";

const stateWords = {
  planned: "thoughtPlanned",
  in_progress: "thoughtInProgress",
  experienced: "thoughtExperienced",
} as const;

// The state a Thought was written in, as its row says it after the date: "while reading". None
// says nothing.
export function thoughtStateLabel(mediaType: MediaType, state: ThoughtState): string | null {
  return state === "none" ? null : mediaWord(mediaType, stateWords[state]);
}

// One Thought in a Media Item's History: an icon that says whether it is a quote, its date, the
// state it was written in and its Progress on one line, then its whole text, a quote in italics
// and curly quotes, and a "⋯" menu to edit or delete it.
export function ThoughtRow({
  thought,
  mediaType,
  onEdit,
  onDelete,
}: {
  thought: Thought;
  mediaType: MediaType;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const date = formatCalendarDate(thought.date);
  const state = thoughtStateLabel(mediaType, thought.state);
  const Icon = thought.quote ? Quote : MessageSquare;
  return (
    <li className="flex items-start gap-2 py-2.5 pr-1 pl-3 sm:pl-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Icon
            role="img"
            aria-label={t(thought.quote ? "thought.quoteIcon" : "thought.icon")}
            className={cn(
              "size-3.5 shrink-0",
              thought.quote ? "text-primary-strong" : "text-muted-foreground",
            )}
          />
          <span className="font-medium text-sm">{date}</span>
          {state && <span className="text-[13px] text-muted-foreground">{state}</span>}
          {thought.progress && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-semibold text-xs tabular-nums">
              {progressLabel(thought.progress)}
            </span>
          )}
        </div>
        <p
          className={cn(
            "whitespace-pre-line break-words text-[15px] leading-[1.45] sm:max-w-[68ch]",
            thought.quote && "italic",
          )}
        >
          {thought.quote ? t("thought.quoted", { text: thought.text }) : thought.text}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground md:size-10"
            aria-label={t("thought.actions", { date })}
          >
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-42">
          <DropdownMenuItem className="min-h-11" onSelect={onEdit}>
            <Pencil aria-hidden />
            {t("logEntry.edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={onDelete}>
            <Trash2 aria-hidden />
            {t("logEntry.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
