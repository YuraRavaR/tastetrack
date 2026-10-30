import { useState } from "react";
import { FilmSearch } from "../components/FilmSearch";
import { HomeBacklogSection } from "../components/HomeBacklogSection";
import { HomeLogSection } from "../components/HomeLogSection";

// Home leads with the film search, and below it the latest of the User's Log beside the top of
// their Backlog. The sections hide while the search holds a query, and mount afresh when it is
// cleared, so they show what the User just logged from the results.
export function HomePage() {
  const [searching, setSearching] = useState(false);
  return (
    <div className="flex flex-col gap-8">
      <div className="w-full max-w-3xl">
        <FilmSearch labelAsHeading onSearchingChange={setSearching} />
      </div>
      {!searching && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
          <HomeLogSection />
          <HomeBacklogSection />
        </div>
      )}
    </div>
  );
}
