import { useState } from "react";
import { FilmSearch } from "../components/FilmSearch";
import { HomeLogSection } from "../components/HomeLogSection";

// Home leads with the film search, and below it the latest of the User's Log. The section hides
// while the search holds a query, and mounts afresh when it is cleared, so it shows what the User
// just logged from the results.
export function HomePage() {
  const [searching, setSearching] = useState(false);
  return (
    <div className="flex flex-col gap-8">
      <FilmSearch labelAsHeading onSearchingChange={setSearching} />
      {!searching && (
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <HomeLogSection />
        </div>
      )}
    </div>
  );
}
