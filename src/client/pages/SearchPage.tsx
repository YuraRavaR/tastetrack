import { useSearchQuery } from "../catalog/use-search-query";
import { FilmSearch } from "../components/FilmSearch";
import { t } from "../i18n/t";
import { usePageTitle } from "../navigation/page-title";

// The Search section: the film search, its field's label as the page's heading. The browser tab
// names the query too, as it stands in the address.
export function SearchPage() {
  const [query] = useSearchQuery();
  const typed = query.trim();
  const section = t("search.title");
  usePageTitle(typed ? [t("search.queryTitle", { query: typed }), section] : [section]);
  return <FilmSearch />;
}
