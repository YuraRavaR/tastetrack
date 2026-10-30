import { X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maxSearchQueryLength } from "../../shared/catalog";
import { t } from "../i18n/t";

// The field a film search is typed into. Its own clear button stands in for the browser's, which
// can't be themed, and leaves the cursor in the field, ready for the next search.
export function SearchField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <Input
        ref={input}
        id={id}
        type="search"
        autoComplete="off"
        maxLength={maxSearchQueryLength}
        placeholder={t("search.placeholder")}
        className="pr-9 [&::-webkit-search-cancel-button]:hidden"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value !== "" && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1 right-1 size-7 rounded-full bg-muted text-muted-foreground"
          aria-label={t("search.clear")}
          title={t("search.clear")}
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
