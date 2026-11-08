# Search

**Issue:** none yet.
**Picked:** variant A, "Poster strip" (2026-11-07).
**Canvas:** <https://claude.ai/artifact/RTifkSwnPwJG8DGinbyBru> (private). One variant a row, each on an iPhone 17 Pro (402×874) and on the web: A poster strip, B status rows, C one merged list.

This is the Search section of the redesign in [`saved/`](../saved/). It replaces the search *page* of [`search-results/`](../search-results/), the home with a query in its field. It keeps that folder's row design, revision #82 included, for the "From TMDB" block.

## Files

| File | Shows |
| --- | --- |
| `search-a.html` | Search at any width: the empty field with no hash, results for "par" at `#results`, nothing found for "prasite" at `#nomatch`. Typing, the clear button and the Want to watch toggle with its toast work. Posters are coloured placeholders. |
| `search-a-390-light.png`, `-390-dark.png`, `-1440-light.png`, `-1440-dark.png` | The empty field with its hint |
| `search-a-390-results-light.png`, `-dark`, `-1440-…` | Results for "par": the strip of 4 Saved films, then 6 TMDB rows |
| `search-a-390-nomatch-light.png`, `-dark`, `-1440-…` | "No films found." and "Can't find it? Add manually" |
| `canvas/` | All three variants as canvas sources. `Main.dc.html` (phone) and `AWeb.dc.html` (web) are variant A. |

## Variant A, as picked

- **Frame.** The logged-in frame of [`saved/`](../saved/): Search is current in the bottom tab bar on a phone and in the header nav from `md`. Tapping Search again clears the field. The content column is 52rem wide from `md`, centred under the 72rem header.
- **Heading.** "Search" (`h1`), the label of the field.
- **Field.** 48px tall, a search icon on the left, the placeholder "Title in English or Ukrainian". While it holds text, a round clear button sits at its right end ("Clear search"); the browser's own cancel button is hidden.
- **Category chips.** Under the field, as in Saved: **Films**, pressed, on `bg-primary-soft` with a `primary-strong` border; **Books**, disabled, with a dashed border and a "Coming soon" badge. Each chip has a 44px tap target on a phone.
- **Results as you type.** No submit button. Both blocks follow the field.
- **Empty field.** A search icon on `bg-muted` and the hint "Type a title. Films in your Saved show first, then more from TMDB." On a phone it sits plainly; from `md` it is in a dashed box.
- **In your Saved.** `h2` "In your Saved" with the count beside it in `text-muted-foreground`.
  - On a phone, a sideways strip of covers, 104px wide (2:3), bleeding to the screen edges, scrolled with a finger. From `md`, a grid of `minmax(120px, 1fr)` columns.
  - Under each cover the title (two lines at most) and **one status line**, cut with an ellipsis. The first that applies:
    1. Logged: a star and the Current Rating, then "On Watchlist" if it is planned for a rewatch, else "Watched" ("★ 5 · On Watchlist", "★ 4.5 · Watched"), in `text-primary-strong font-semibold`.
    2. On the Backlog: a filled bookmark and "On Watchlist", in `text-muted-foreground`.
    3. On a Collection: a Collection icon and the name of the oldest Collection holding it ("Road movies"), in `text-muted-foreground`.
  - The whole cover links to the film's page. There are no buttons here: a film in Saved is acted on from its page.
- **From TMDB.** `h2` "From TMDB" with the count. One bordered `divide-y` card of rows, as in [`search-results/`](../search-results/) and its revision (#82):
  - Poster 72×108 on a phone, top-aligned, the text and actions beside it; 48×72 from `md`, the actions at the end of the row.
  - The title, then the year in `text-muted-foreground`.
  - **Mark watched** (outline, opens the Watched dialog), the **Want to watch** bookmark toggle, and **Add to collection** (`ListPlus`). 44px tall on a phone, 36px from `md`, where Mark watched is 150px wide. The icon buttons have accessible names and tooltips.
  - Pressing the bookmark shows the toast "Put {film} on your Watchlist."; pressing it again, "Took {film} off your Watchlist."
  - Films already in Saved are left out, so every row here reads "Mark watched", never "Watched again".
- **No match.** With text in the field and no result in either block: "No films found."
- **Add manually.** Under the results whenever the field holds text: "Can't find it?" and an "Add manually" button.
- **Toast.** A card above the tab bar on a phone, bottom right from `md`, with a Dismiss button.

## Copy

| Where | Text |
| --- | --- |
| Heading | Search |
| Placeholder | Title in English or Ukrainian |
| Clear button | Clear search (accessible name and tooltip) |
| Chips | Films · Books · Coming soon |
| Empty field | Type a title. Films in your Saved show first, then more from TMDB. |
| Blocks | In your Saved · From TMDB |
| Status line | ★ {rating} · On Watchlist · ★ {rating} · Watched · On Watchlist · {Collection name} |
| Row actions | Mark watched · Want to watch · Add to collection |
| Toasts | Put {film} on your Watchlist. · Took {film} off your Watchlist. |
| No match | No films found. |
| Manual | Can't find it? · Add manually |

## Settled

Settled in a grilling on 2026-11-08. Where the mockup differs, this section wins.

- **In your Saved** matches film titles only. Collections are found under Collections.
- **No duplicates.** From TMDB hides films already in Saved.
- **TMDB calls.** Saved is searched live (our own data); TMDB keeps today's timing, so the redesign adds no TMDB calls (ADR-0004).
- **Empty field.** The hint "Type a title to search your Saved and TMDB." under the chips.
- **Status line.** Shortened to "★ 5 · Watchlist" so it fits a 104 px cover.
- **The query in the URL.** `?q=` with `replace`, as [`search-results/`](../search-results/) settled.
