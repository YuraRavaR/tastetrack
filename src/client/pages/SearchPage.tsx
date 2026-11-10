import { useId } from "react";
import { Label } from "@/components/ui/label";
import { searchMediaTypes } from "../catalog/media-types";
import { useSearchMediaType, useSearchQuery } from "../catalog/use-search-query";
import { FilmSearch } from "../components/FilmSearch";
import { MediaTypeChips } from "../components/MediaTypeChips";
import { SearchField } from "../components/SearchField";
import { mediaWord } from "../i18n/media-words";
import { t } from "../i18n/t";
import { usePageTitle } from "../navigation/page-title";

// The Search section: the field, its label as the page's heading, then the Media Type chips and
// what the search finds. The query and the Media Type both live in the address, so the browser
// tab names the query too, and a reload, Back or a shared link opens the same search. Choosing
// another Media Type keeps the query and starts its search anew.
export function SearchPage() {
  const inputId = useId();
  const [query, setQuery] = useSearchQuery();
  const [mediaType, setMediaType] = useSearchMediaType();
  const typed = query.trim();
  const section = t("search.title");
  usePageTitle(typed ? [t("search.queryTitle", { query: typed }), section] : [section]);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-3xl tracking-tight">
          <Label htmlFor={inputId} className="font-bold text-3xl leading-9">
            {section}
          </Label>
        </h1>
        <SearchField
          id={inputId}
          value={query}
          onChange={setQuery}
          placeholder={mediaWord(mediaType, "searchPlaceholder")}
          prominent
        />
        <MediaTypeChips choices={searchMediaTypes} current={mediaType} onChoose={setMediaType} />
      </div>
      <FilmSearch key={mediaType} mediaType={mediaType} />
    </section>
  );
}
