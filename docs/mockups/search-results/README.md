# Search results and the film's page before a first viewing

**Issue:** #62, "Reach a film's page from search, and log or plan it from there".
**Picked:** search results from variant C, "icon actions", and the film's page from variant A, "button row" (2026-10-29).
**Canvas:** <https://claude.ai/artifact/PXhUJMGWLrn8NDnxr8NwxM> (private). It has three variants in rows. Each row shows the search and the film's page, on an iPhone 17 Pro (402×874) and on the web.

## Files

| File | Shows |
| --- | --- |
| `search-results-c.html` | Home with a film search for "paris", at any width. Watched, the bookmark and the clear button work. "Paris, 13th District" links to the film's page. |
| `search-results-c-390-light.png`, `-390-dark.png` | Phone: actions under each title, bottom tab bar |
| `search-results-c-1440-light.png`, `-1440-dark.png` | Desktop: actions at the end of each row, sections in the header |
| `film-page-unwatched-a.html` | The film's page for a film with no Log Entries. Want to watch toggles and Watched works. Open it with `#watchlist` for a film already on the Watchlist. |
| `film-page-unwatched-a-390-light.png`, `-390-dark.png` | Phone |
| `film-page-unwatched-a-390-watchlist-light.png` | Phone, film on the Watchlist: the toggle is pressed and reads "On your Watchlist" |
| `film-page-unwatched-a-1440-light.png`, `-1440-dark.png` | Desktop |
| `film-page-watched.html` | The same page once the film has been watched 3 times: film-page C with the same actions under the stat tiles. Watched again adds an entry; `#watchlist` works here too. |
| `film-page-watched-390-light.png`, `-390-dark.png`, `-1440-light.png`, `-1440-dark.png` | Phone and desktop |
| `canvas/` | All three variants as canvas sources. `C.dc.html` and `CWeb.dc.html` are the picked search, `AFilm.dc.html` and `AFilmWeb.dc.html` are the picked page, and `Watched.dc.html` and `WatchedWeb.dc.html` are the page once watched. |

## Why these

- **Search, C.** Watched is the one labelled, filled button. Want to watch and Add to list are outline icon buttons next to it, so a row stays short and Watched stands out. That is what #62 asks for.
- **Film's page, A.** It keeps film-page C's banner and title, and puts the actions where the stat tiles go once the film has been watched. The actions are labelled, so the page states what can be done before any viewing exists.

These were not picked:

- **Search A.** Three labelled buttons under every result. It reads clearly, but every row is tall.
- **Search B.** Only Watched and a "⋯" menu. It is the calmest list, but Want to watch moves behind a tap.
- **Page B.** A "Not watched yet" card holding the actions, in place of the tiles.
- **Page C.** A larger poster beside the title, empty dashed tiles, and the actions pinned above the tab bar on a phone.

## Search results (variant C)

The home page while the field holds a query: Latest in your Log and Up next are hidden, as today.

1. **Search field.** Focused, with the shadcn ghost clear button from the accent pass (`::-webkit-search-cancel-button` hidden).
2. **Results.** One bordered `divide-y` list, the User's Manual Media Items first. Each row has:
   - **Poster**: 56×84 on a phone, `Poster`'s 48×72 from `md`.
   - **Title**: a link to `/items/:id` when the result has a `mediaItemId`. A TMDB result not in the catalog yet keeps a plain-text title.
   - **Meta line**: the year and runtime, then one mark in `text-primary-strong text-xs font-semibold`: "In your Log" or "On your Watchlist". "Added by you" is in `text-muted-foreground`. The marks are text now, without the soft pill.
   - **Actions**: **Watched** is `bg-primary` with a check icon. **Want to watch** is an outline icon button with a bookmark. **Add to list** is an outline icon button with `ListPlus`. The two icon buttons have accessible names and a `title` tooltip.
   - **Bookmark state**: the bookmark is a toggle. While the film is on the Watchlist, it is pressed (`aria-pressed="true"`), filled, and drawn in `border-primary-strong bg-primary-soft text-primary-strong`. Pressing it again takes the film off the Watchlist, with the toast "Took {film} off your Watchlist."
3. **Phone (below `md`).** The actions sit in a row under the title and meta, 44px tall.
4. **From `md`.** The actions sit at the end of the row, 36px tall, in this order: bookmark, Add to list, Watched.
5. **"Can't find it? Add manually"** stays under the list.

Watched opens the existing `LogEntryDialog`, with Rewatch on when the film is in the Log. In the mockup it only shows the toast.

## The film's page before a first viewing (variant A)

The same route and layout as [`film-page/`](../film-page/) variant C, for a film with no Log Entries:

1. **Banner** and **title block** as in film-page C, with no mark: the Want to watch toggle shows the Watchlist state.
2. **Actions**, where the stat tiles go once the film has been watched.
   - **Phone:** Watched (`bg-primary`) and Want to watch (outline) share a row, 48px tall. Add to list sits full width below them.
   - **From `sm`:** all three sit in one row, 40px tall.
   - **Want to watch** is the same toggle as the bookmark in search. Pressed, it reads "On your Watchlist", is filled and drawn in `border-primary-strong bg-primary-soft text-primary-strong`, and pressing it again takes the film off the Watchlist. Its label stays on one line on a 390px phone.
3. **"Viewings"** (`h2`) with an empty state in a dashed `border-input` box: "No viewings yet" and "Each time you watch it, the date, Rating and Review show here."

## The film's page once watched

Film-page C, with Add to list replaced by the same action block as above, in the same place: under the stat tiles, which stay first as #64 wants.

1. Banner, title block and the three stat tiles, as in film-page C.
2. **Actions.** **Watched again** (`bg-primary`) opens `LogEntryDialog` with Rewatch on. Beside it is the Want to watch toggle, and below them Add to list, full width on a phone. From `sm`, all three sit in one row.
3. **"Viewings"**, newest first, as in film-page C.

So the page changes in only two places between the states. Before the first viewing it has no tiles, an empty Viewings box, and the label "Watched". After it, the tiles appear, Viewings fills, and the label becomes "Watched again".

## Copy

| Where | Text | New? |
| --- | --- | --- |
| Bookmark button | Want to watch (accessible name and tooltip) | reuses `search.planned` |
| List button | Add to list (accessible name and tooltip) | existing |
| Marks | In your Log · On your Watchlist · Added by you | existing |
| Empty Viewings | No viewings yet · Each time you watch it, the date, Rating and Review show here. | new |
| Want to watch, pressed | On your Watchlist | reuses `search.inBacklog` |
| Primary on a watched film | Watched again | new |
| Toasts | Put {film} on your Watchlist. · Took {film} off your Watchlist. | the second is new |

## Open questions

All settled.

1. ~~**The bookmark in search is a toggle.**~~ Settled: it stays a toggle, so search can take a film off the Watchlist. That needs a "take off" call from search.
2. ~~**Same control on the page?**~~ Settled: yes, the page's Want to watch toggles too.
3. ~~**Back link.**~~ Settled: no "‹ Search" link. The search keeps its query in the URL (`/?q=paris`), so the browser's back, or a swipe back on a phone, brings the results back as they were. The page is also reached from the Log, Lists and the Watchlist, where a "Search" link would be wrong.
4. ~~**"Watched again" on a watched film's page.**~~ Settled: the same action block, under the stat tiles. See `film-page-watched.html`.
5. ~~**Both marks.**~~ Settled: a film in the Log and back on the Watchlist (planned for a rewatch) shows "In your Log". The pressed bookmark already shows the Watchlist.
6. ~~**Taking a film off the Watchlist.**~~ Settled: a new `DELETE /backlog/items/{mediaItemId}`, the mirror of `POST /backlog/items`, used by search and the film's page. Search results then need no List Item id, and a search's D1 query count doesn't grow.
7. ~~**The query in the URL.**~~ Settled: typing writes `?q=` with `replace`, so a burst of typing makes one history entry, not one per key. Clearing the field removes `q`. Today the query isn't in the URL at all, so this is new.
8. ~~**Placeholders.**~~ Settled in [`film-page/`](../film-page/#no-poster-placeholders): a result without a poster shows its placeholder icon, and one not in the catalog yet shows No. 4, `Film`.
