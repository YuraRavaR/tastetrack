# Search results and the film's page before a first viewing

**Issue:** #62, "Reach a film's page from search, and log or plan it from there". The revision is #82.
**Picked:** search results from variant C, "icon actions", and the film's page from variant A, "button row" (2026-10-29). The search actions were revised on 2026-10-30, after #62 shipped: see [Revision: the button shows the state](#revision-the-button-shows-the-state). Where the two differ, the revision wins.
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
| `canvas/actions/` | The revision's canvas: variants A, B and C of the actions, and the three ways to log a rewatch. `Again3.dc.html` and `Again3Web.dc.html` are the picks, with `PosterTall.dc.html` for the poster, and `AgainSheet.dc.html` is the sheet they open. Its canvas is <https://claude.ai/artifact/QQecXvfzwCFQJkJeUZV6dP> (private). |
| `canvas/` | All three variants as canvas sources. `C.dc.html` and `CWeb.dc.html` are the picked search, `AFilm.dc.html` and `AFilmWeb.dc.html` are the picked page, and `Watched.dc.html` and `WatchedWeb.dc.html` are the page once watched. |

## Revision: the button shows the state

Seen live, a gold Watched with a check on every row read as "you've already watched all of these". Watched is an action, and a filled button with a check looks like a state. So gold now means done, and only that.

**Picked:** variant A, "the button shows the state", with mechanism 3, "Watched again". Not picked: B, a plain "+ Log" with a check on the poster, which said the same thing twice; C, three equal icons, where an eye without a label is unclear and Watched stops being the main action. Mechanism 1, tapping "✓ Watched", doesn't say what the tap does, and could read as undoing it. Mechanism 2, a split button, is the most complex control for an unlabelled ↻.

This replaces the Meta line, the Actions and step 4 of the section below:

- **Not logged.** **Mark watched** is an outline button, in the same weight as the icon buttons, and opens `LogEntryDialog`.
- **In the Log.** The button reads **Watched again** with a rotate icon, in `border-primary-strong bg-primary-soft text-primary-strong`. It opens `LogEntryDialog` with Rewatch on. Each rewatch is a new Log Entry with its own Rating, and the Current Rating follows the last one.
- **Meta line.** The Current Rating and the Item History's size, "★ 4 · 2 viewings", in `text-primary-strong text-xs font-semibold`, linking to the film's page. It replaces "In your Log". "On your Watchlist" goes too, since the pressed bookmark says that. "Added by you" stays.
- **Lists.** Under the meta line, a `List` icon named "Lists", then a chip for each of the User's Lists that hold the film, in `text-muted-foreground`, each linking to its List. Two chips at most, oldest List first, then "+{n}" for the rest. There is no line for a film on no List.
- **Poster.** 72×108 on a phone, the same for every row, top-aligned: a row with a Rating and Lists is taller than the old 84px poster. `Poster`'s 48×72 stays from `md`, where the text sits beside it. On a phone the three buttons have to fit beside that poster: the first is `text-sm` with 8px of padding, the gap is 6px, the icon buttons never shrink below 44px, and under 380px "Watched again" drops its icon. A poster that stretched with each row was not picked: a 2:3 image would crop harder the taller the row, and the column would be uneven.
- **Order.** Mark watched or Watched again, the bookmark, Add to list, on a phone and from `md` alike, so the source order is the visual one. From `md` the first button is 150px wide, so the columns line up.
- **The dialog.** The eyebrow reads "Watched again" for a film in the Log. Beside the Rating's legend, the hint "Last time ★ 4 · Mar 12, 2024" comes from the film's Item History, loaded when the dialog opens. The stars start empty, so the old Rating isn't saved by reflex.

Search needs more from the API: the Current Rating, the number of Log Entries and the Lists holding each result, in a fixed number of D1 queries however many results there are (ADR-0009).

**Later: the runtime.** The User wants the runtime in the meta line, as "117 min" before the Rating, and the canvas shows it there. It is left out of this revision and of the screenshots. TMDB's search doesn't return a runtime, only the details call per film does, and ADR-0004 limits those. A cached film or a Manual Media Item is cheap to show, but a search can bring 20 films that aren't cached, on every pause in typing.

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
| Watched, not logged | Mark watched | new, in the revision |
| Watched, in the Log | Watched again | shared with the film's page |
| Meta line | {rating} · {count} viewings | new, in the revision |
| Lists icon | Lists (accessible name) | new, in the revision |
| Dialog hint | Last time {rating} · {date} | new, in the revision |

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
