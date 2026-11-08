import { Search, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maxSearchQueryLength } from "../../shared/catalog";
import { t } from "../i18n/t";

// The field a film search is typed into. Its own clear button stands in for the browser's, which
// can't be themed, and leaves the cursor in the field, ready for the next search. A `prominent`
// field, the Search section's own, is taller, with a search icon, and its clear button has a
// thumb-sized target.
export function SearchField({
  id,
  value,
  onChange,
  prominent = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  prominent?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      {prominent && (
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground"
        />
      )}
      <Input
        ref={input}
        id={id}
        type="search"
        autoComplete="off"
        maxLength={maxSearchQueryLength}
        placeholder={t("search.placeholder")}
        className={cn(
          "pr-9 [&::-webkit-search-cancel-button]:hidden",
          prominent && "h-12 rounded-xl bg-card pr-12 pl-10.5 text-base md:text-base",
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value !== "" && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={cn(
            "absolute rounded-full text-muted-foreground",
            prominent
              ? "top-0.5 right-0.5 size-11 hover:bg-transparent"
              : "top-1 right-1 size-7 bg-muted",
          )}
          aria-label={t("search.clear")}
          title={t("search.clear")}
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
        >
          {prominent ? (
            <span className="flex size-7 items-center justify-center rounded-full bg-muted">
              <X aria-hidden />
            </span>
          ) : (
            <X aria-hidden />
          )}
        </Button>
      )}
    </div>
  );
}
