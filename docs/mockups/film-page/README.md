# The film's page (Item History)

**Issue:** #64, "Lead the film's page with how the User rated and watched it".
**Picked:** variant C, stats strip (2026-10-29). Also picked: all ten no-poster placeholders.
**Canvas:** <https://claude.ai/artifact/2miePqiQMqeF73w9q2HmKN> (private; variants A, B and C side by side).

## Files

| File | Shows |
| --- | --- |
| `film-page-c.html` | Variant C, a film watched 3 times, without a poster |
| `film-page-c-390-light.png`, `-390-dark.png` | Phone |
| `film-page-c-390-menu-light.png` | Phone, the "⋯" menu of the latest entry open |
| `film-page-c-1440-light.png`, `-1440-dark.png` | Desktop (the column stops at `max-w-3xl`, as on every page) |
| `placeholders.html` and its PNGs | The ten no-poster placeholders, at poster size with a caption and at thumbnail size icon-only |
| `canvas/` | All three variants as canvas sources. `Stats.dc.html` is variant C. |

## Why C

The page exists to answer "how did I rate this film, and how often have I watched it". C answers it in one row of three tiles, before the entry list. The entries become compact rows with one quiet "⋯" button, instead of a stack of equal Edit and Delete buttons.

## Layout, top to bottom (phone first)

1. **Banner.** Full column width, `h-46` (184px) on a phone and taller from `sm:`, `rounded-lg`. It shows the film's image, or a no-poster placeholder when it has none. The space is reserved before the image loads, so nothing shifts.
2. **Title block.** `h1` is the film's label, as `FilmTitle` renders it today. Below it are the Ukrainian Localized Title and `FilmFacts`, both `text-muted-foreground text-sm`.
3. **Stat tiles.** A `grid-cols-3 gap-2` row of bordered `bg-card` tiles. Each has a `text-xs` muted label above a `text-lg font-semibold` value:
   - **Watched**: "3 times" (the number of Log Entries).
   - **Your rating**: one filled star and the Current Rating ("5", "4.5").
   - **First watched**: the earliest date among the Log Entries, "Mar 2, 2019".
4. **Actions.** Since #62: Watched again, the Want to watch toggle and Add to list. See [`search-results/film-page-watched.html`](../search-results/film-page-watched.html).
5. **"Viewings"** (`h2`) and the Item History as one bordered `divide-y` list, **newest first**. Each row has:
   - a first line with the date (`font-medium`), the Rating as small stars, and the "Rewatch" badge on a Revisit;
   - a second line with the Review, truncated to one line in `text-muted-foreground`;
   - a 44×44 ghost "⋯" icon button on the right. It opens a shadcn `DropdownMenu` with **Edit**, a separator, and **Delete** in `text-destructive` with a trash icon. Its accessible name is "Actions for {date}".

Labels use sentence case throughout: "Your rating", not "Current Rating".

## No-poster placeholders

A film without a poster shows one of ten placeholders instead of the plain film icon. All ten are approved.

- **Which one.** `mediaItem.id % 10`, the same as placeholder No. `id % 10 + 1` in the table below. It is stable per film, so the placeholder does not change between visits.
- **Look.** `bg-muted`, a `text-muted-foreground` lucide icon, and the caption in `text-xs` below it.
- **Size.** Where the image is 112×168 or larger (this page's banner, any larger poster), the icon is about a third of the shorter side and the caption shows. Smaller thumbnails, like `Poster`'s 48×72 in lists, show the icon only.
- **Accessible name.** "No poster"; the caption is decoration.

| No. | lucide icon | Caption |
| --- | --- | --- |
| 1 | `Popcorn` | Eaten with the popcorn. |
| 2 | `Ghost` | This poster is a ghost. |
| 3 | `Clapperboard` | Still in makeup. |
| 4 | `Film` | Lost in the projector. |
| 5 | `SearchX` | 404: poster not found. |
| 6 | `MoonStar` | The poster is napping. |
| 7 | `Cat` | The cat knocked it down. |
| 8 | `Send` | Flew off to Cannes. |
| 9 | `Lightbulb` | Imagine something great. |
| 10 | `Glasses` | Poster went incognito. |

The mockup draws its own icons. The app uses the lucide ones named above, which differ in detail.

## Copy

New UI text goes into `src/client/i18n/en.ts`:

| Where | Text |
| --- | --- |
| Tile labels | Watched · Your rating · First watched |
| Watched value | {count} time / {count} times |
| List heading | Viewings |
| Entry menu | Actions for {date} · Edit · Delete |
| Placeholders | "No poster", and the ten captions above |

## Open questions (settle before the issue)

1. **Banner image.** The banner is wide (about 2:1), but the app stores only the `w92` poster (`src/worker/catalog/tmdb.ts`). Should it use TMDB's backdrop, which means a new `backdrop_path` field and a stored URL? Or should it show a larger poster (`w342`) beside the title, with the banner only as the no-poster fallback?
2. **First watched without dates.** What does the tile show when no Log Entry has a date? It could hide, show "No date", or fall back to the first entry's creation date.
3. **Watched once.** Should the value read "1 time" or "Once"?
4. ~~**Never watched.**~~ Settled in [`search-results/`](../search-results/): the banner and title, no tiles, the actions Watched, Want to watch and Add to list, and an empty "Viewings".
5. **Placeholders elsewhere.** The placeholders are approved for this page. Should `Poster` use them in every list (Log, Watchlist, Lists, search), icon-only at thumbnail size?
6. **Accent colour.** The stars and Delete are both red today, so Delete stands out less. That is #63's question; this page follows whatever it decides.
