# Series Progress: the Watching now row, a series' page, Watch more, the Watching tab

**Issue:** #211, part of the series spec #207 (ADR-0005). #213 (Watching) and #214 (Watch more) are built and checked against this folder.
**Picked:** on 2026-11-15, over two canvas rounds. The row: variant A, a bar in the row and a round check behind a divider. A series' page: variant A, a Watching card with two steppers. Round 2 was accepted as drawn.
**Canvas:** <https://claude.ai/artifact/DB8T66tEwPQyj8VRepT17x> (private). Two pages:

1. **Round 1 · The row and the page.**
   - The row, on a phone and on the web, beside a book's "Reading now" row: **A** a bar in the row, a round check, the air date in the status line (the pick); **B** a labelled "Watched" button, a bar along the card's edge, the date on its own line; **C** a pie as Sequel has, a filled check, the date as a chip.
   - A series' page while Watching: **A** a Watching card, a round check, two steppers (the pick); **B** a labelled button, seasons and episodes as a list; **C** a compact strip with a pie, two dropdowns and the ordinary action row.
2. **Round 2 · States, Watch more, the Watching tab.** Built from the picks: the page not started, Caught up, rated before and added by hand; the Watch more choice; the Watching tab.

All series data is real TMDB data from 2026-11-15 (titles, years, seasons, episode counts, the last and next episode). "Леся + Рома" stands for a series added by hand.

## Why A and A

- **The row.** The check sits behind a divider as tall as the row, so where "open the series" ends and "mark the episode" begins is visible. B's label "Watched" means a Log Entry everywhere else in the app, and its button takes a third of a phone row. A 16 px pie (C) cannot tell 24% from 30%; bars in neighbouring rows compare at a glance. The date in the status line adds no extra line or element.
- **The page.** Steppers are the only picker that works without bounds: the User may set an episode TMDB doesn't list yet, and a series added by hand has no seasons or episode counts at all. A list (B) and dropdowns (C) need the list. The card repeats books' Reading card, so start date, Finished and Stop are where they already are.

## Files

| File | Shows |
| --- | --- |
| `series-progress-saved.html` | Saved with the Series tile, "Reading now" and "Watching now" with every state of the row. |
| `series-progress-page.html` | A series' page: Watching (no hash), not started (`#before`), Caught up (`#caught-up`), rated before (`#rated`), Watching a series added by hand (`#manual`). |
| `series-progress-watch-more.html` | The Watch more choice as it opens (no hash), with the User's own season and episode (`#own`), for a series added by hand (`#manual`). |
| `series-progress-watching.html` | The Series page on its Watching tab. |
| `<page>-<390\|1440>-<light\|dark>.png` | Each page as it opens. |
| `<page>-<390\|1440>-<state>-<light\|dark>.png` | Each `#state` above. Watch more is shot at one screen's height (390×844, 1440×900), since the sheet is fixed to the screen. |
| `canvas/` | Both rounds as canvas sources. Images are canvas uploads (`/_blob/…`), so they show only on the canvas. |

The static pages load posters and backdrops from `image.tmdb.org` and one cover from `covers.openlibrary.org`, so they need a network connection.

## The row

One component, used by "Watching now" on Saved and by the Watching tab.

| Part | Phone (below `md`) | From `md` |
| --- | --- | --- |
| **Card** | `bg-card`, `border`, 16 px radius; one column, 10 px apart | Two columns, 12 px apart |
| **Link** (poster, title, status, bar) | Opens the series' page. 10 px padding, 12 px gap | 14 px gap |
| **Poster** | 48×72, 6 px radius. No poster: `bg-primary-soft` with the series icon in `text-primary-strong` | The same |
| **Title** | 16 px, 600, one line, cut with an ellipsis | The same |
| **Status** | 13 px, `text-muted-foreground`; the episode and "Caught up" in `text-foreground`, 600. May wrap to two lines | 14 px |
| **Bar and count** | A 5 px bar, `bg-muted` filled with `bg-primary-strong`, then "15 of 62" at 12 px | 13 px; the bar is at most 340 px with its count |
| **Check zone** | A button as tall as the row and at least 64 px wide, behind a 1 px `border-border` divider | At least 68 px wide |

- **Next episode.** Status "Next: **S2 · E9**". The zone holds a 40 px circle with a 1.5 px `primary-strong` outline and a 22 px check. Its name is "Mark S2 · E9 of Breaking Bad watched". One tap sets the Progress to that episode and the row shows the one after it; there is no toast and no undo. A wrong tap is put right with the steppers on the series' page.
- **Caught up.** Status "**Caught up**", and when TMDB gives the next air date, " · S4 · E1 on 8 Jul 2027". The zone holds "Finished", a 36 px `bg-primary` pill, which opens the Log Entry dialog as Finished does on the page. When a newer episode has aired, the row shows "Next" again.
- **Just started.** "Next: **S1 · E1**" and an empty bar, "0 of 19".
- **Added by hand.** "Next: **S1 · E4**" and the check; no bar, no count, never "Caught up".
- **The count** is the episodes watched over every episode TMDB lists in the regular seasons, so a caught-up series whose next episode is already listed reads "30 of 31".
- **Dates** in a row use the short month ("8 Jul"), and the year only when it is not the current one.
- **A book's row** keeps what it has (the author and since when) in the same card, with a chevron in a 44 px zone and no divider: the whole row is one link.
- **Tap targets.** The link and the check are siblings, never nested, so a tap on the check cannot open the page. The check zone is at least 64×92 px.

## Saved

- The sections follow the tiles: "Reading now", then "Watching now". Each shows only when it has something.
- Rows are ordered as "Reading now" is: the latest started first.
- The Series tile reads "3 to watch · 5 watching · 9 watched", with "watching" left out when it is none.

## The Watching tab

- The same rows as on Saved: one column on a phone, two from `md`. Not the poster grid the Watchlist and Watched tabs have: a poster a third of a phone wide has no room for the bar and a thumb-sized check.
- No sort or filter chips. The latest started comes first.

## A series' page

The top is the film page's (`film-banner/`): the backdrop, the poster over it, the titles, and under them the facts line "2008–2013 · 5 seasons · Ended" ("2022– · 2 seasons · Returning" while it runs). A series added by hand has no picture area and no facts.

### Not started (`#before`)

The action row: **Watched** (primary), **Want to watch** (a toggle), **Start watching**, **Add to collection**. Start watching opens no dialog; the page then shows the Watching card with "Next: S1 · E1".

### Watching

The Watching card takes the place of Watched, Want to watch and Start watching, as the Reading card does for a book. Add to collection stays under it. The card is `bg-primary-soft` with a `border-primary-strong`, 16 px radius.

| Part | Phone (below `sm`) | From `sm` |
| --- | --- | --- |
| **Top** | The series icon on `bg-card` (40 px), "Watching" (16 px, 700), "Since 2 November 2026" (14 px, muted), a pencil (44 px) that changes the start date, as for a book | The pencil is 36 px and sits by the text; Finished and Stop watching move to the right of this row, 40 px tall |
| **Next** (a `bg-card` panel, 12 px radius) | "Next" (13 px, muted), "S2 · E9" (19 px, 700), "Season 2, episode 9 of 13" (14 px, muted); a 52 px `bg-primary` circle with a 26 px check. Under them a 6 px bar and "15 of 62" (13 px) | The left half of the card; the check is 48 px |
| **Last watched** | The label (13 px, 600, muted), then "Season" and "Episode", each with a stepper: minus, the number (16 px, 700), plus; 44 px buttons | The right half; 40 px buttons |
| **Buttons** | Finished (primary, with a check) and Stop watching (`bg-card`), two equal columns, 48 px | In the top row |

- **The check** marks the next episode watched: the same action as on the row.
- **The steppers** set the last episode watched, not the next one. Season starts at 1; Episode starts at 0, which means none of this season watched yet. Neither has an upper end, so an episode TMDB doesn't list yet can be set. A run of taps is saved once, when the User stops (about a second), so it costs one write (ADR-0006).
- **Finished** opens the Log Entry dialog; **Stop watching** takes the series out of Watching with no Log Entry. Both drop the Progress.
- **Caught up** (`#caught-up`): the panel says "Caught up" (19 px, 700) and, when known, "S4 · E1 airs 8 July 2027"; the bar stays; there is no check. The steppers still work.
- **Added by hand** (`#manual`): "Season 1, episode 4" with no "of 13", no bar, and the check.

### Rated before (`#rated`)

The stat tiles, then **Watched again** (primary), **Want to watch**, **Watch more** in Start watching's place, **Add to collection**. Watch more opens the choice below.

## The Watch more choice

A bottom sheet on a phone (28 px top corners) and a centred 480 px dialog from `md`, as the Log Entry dialog is. Title "Watch more", the series' title under it, a close button.

- Three options, each a 60 px row (56 px from `md`) with a radio, a label (16 px, 600) and a hint (13 px, muted). The chosen one has a `border-primary-strong` and `bg-primary-soft`.
  1. **From season 5**, hint "Next: S5 · E1". The latest season TMDB lists; chosen when the sheet opens.
  2. **From the start**, hint "Next: S1 · E1".
  3. **Choose where you are**, hint "Set the last episode you watched". Once chosen, the hint becomes the next episode ("Next: S3 · E5") and the "Last watched" steppers of the series' page show under it.
- **A series added by hand** has only "From the start", chosen when the sheet opens, and "Choose where you are".
- **Start watching** (primary) is the only button on a phone, 50 px; from `md` Cancel sits beside it, both 40 px. It starts the series from the choice and closes the sheet.

## Not in these mockups

- A Rating and Review for each season: the user set it aside on 2026-11-15. Several Log Entries on one series already give a history season by season (spec #207).
- The other series screens (Search, the Watchlist and Watched tabs, Collections), which reuse the film and book designs (#210).

## Open questions

None that #213 or #214 depend on.

- On a phone, a tile's three counts ("8 to read · 1 reading · 23 read") run under the fan of covers. The tile is `books/`'s and #210's; these pages only show it.
