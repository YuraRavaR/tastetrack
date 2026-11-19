# Games: Saved, Search, a game's page and a game without a cover

**Issue:** #250, part of the games spec #248 (ADR-0012). #252 (the games UI) is built and checked against this folder, and #251 (the API) takes the banner rule from it.
**Picked:** on 2026-11-19, in one canvas round. Saved: tiles A (2×2, a small fan over the name). Search: row A (one line, year · platforms). A game's page: A (the facts line cut at three platforms, "From IGDB" as the link, a Genres row). The banner: rule 2, key art first. No cover: 1, a typeset cover as a book's.
**Canvas:** <https://claude.ai/artifact/AUd8zDabJQjJ5byMwk3EBG> (private). One page, **Round 1 · Games screens**:

- Saved on a phone: **A** a 2×2 grid, each tile a small fan of three covers over the name and counts (the pick); **B** 2×2 without a fan on a phone; **C** one shorter tile per row, 2×2 only from `md`. Saved on the web.
- A Search row: **A** one muted line, "1997 · PS1" (the pick); **B** the year, then the platforms as outlined tags; **C** "year · developer", then the platforms. Search's states: a Cyrillic query, nothing found, the IGDB credit.
- A game's page: **A** the facts line with "+4", "From IGDB" as the About block's link, a Genres row (the pick); **B** Platforms and Genres as rows, a "View on IGDB" button; **C** every platform in the facts line, genres as tags, a credit line. Its states (Playing, no art, no cover) and the web page.
- Which picture makes the banner: **1** the first artwork, as #248 had it; **2** key art first, by artwork type (the pick); **3** always a screenshot.
- No cover: **1** typeset, as a book (the pick); **2** one quiet icon, as a series; **3** a game case, the platform on a band.

All game data is real IGDB data from 2026-11-19: titles, years, developers, platforms, genres, summaries, covers and art, the search results for "final fantasy vii", "сталкер", "відьмак" and "disco" included.

## Why these

- **Tiles A.** It keeps the fan on a phone, so the four tiles still show what is in each Backlog; the counts wrap onto two lines, which fits. C kept the phone a long list of four tall tiles, which the 2×2 grid of #248 set out to avoid.
- **Row A.** It reads as books' "Author · year" does, one line under the title. Tags (B) are louder than the title on a long list, and the developer (C) would cost Search a field and a line.
- **Page A.** It is the film's About block, with "From IGDB" where films have "From TMDB", so the link to IGDB is the attribution as well. The facts line has the three main platforms; the rest are one tap away on IGDB.
- **Banner 2.** IGDB lists artworks in the order they were added, whatever their type. The first artwork of The Witcher 3 is a 128×128 icon, and Disco Elysium's is a logo with a transparent background, which the JPEG turns black. Each artwork has an `artwork_type`, so the rule picks key art and skips logos, icons and covers.
- **No cover 1.** It is the typeset cover books already have, with the developer where a book has its author, so a game without a cover looks like a book without one.

## Files

| File | Shows |
| --- | --- |
| `games-saved.html` | Saved with four tiles in a 2×2 grid and "Playing now" after "Reading now" and "Watching now", a game without a cover among them (no hash). `#not-playing` nothing is being played: the Games tile has no "playing" count and "Playing now" is gone. |
| `games-search.html` | Search on Games. No hash: "final fantasy vii", with a remake in the User's Saved and four IGDB results (the 1997 PS1 game, the 2005 Famicom game, Rebirth, Crisis Core – Reunion). `#cyrillic` "сталкер", which IGDB matches through Russian alternative names; `#nomatch` "відьмак", nothing found; `#no-cover` "disco", two results without a cover, one without a year; `#empty` nothing typed yet. |
| `games-page.html` | A game's page. No hash: The Witcher 3, played twice. `#playing` S.T.A.L.K.E.R. 2 being played, the Playing card; `#no-art` Final Fantasy VII (1997), with no art or screenshots on IGDB, so the banner is its blurred cover; `#no-cover` 80's Disco Brawl, with no cover and no art, so no banner, and in the Backlog. |
| `games-covers.html` | Reference: the typeset cover at every size, in a poster grid, and the banner the rule picks for four games. |
| `<page>-<390\|1440>-<light\|dark>.png` | Each page as it opens. |
| `<page>-<390\|1440>-<state>-<light\|dark>.png` | Each `#state` above. |
| `canvas/` | The round as canvas sources, all variants included. Images are canvas uploads (`/_blob/…`), so they show only on the canvas. |

The static pages load covers and art from `images.igdb.com`, `image.tmdb.org` and `covers.openlibrary.org`, so they need a network connection. Only what games add is drawn. The Backlog, Playing and Played tabs, the Played sheet, adding a game by hand, Collections and Share Links follow the books and series screens (`books/`, `series-progress/`, `log-entry-dialog/`, `collections/`, `shared-collection/`) with the game words below.

## Saved

- **Tiles:** four, in a 2×2 grid at every width, in the order Films, Books, Series, Games.
  - **On a phone** (below `md`) each tile is 206 px tall, 14 px padding: a fan of three covers (52×78, the outer two turned 9°) centred at the top, then the name (20 px, 700), then the counts (13 px, muted), which wrap. The icon is hidden.
  - **From `md`** the tile is today's: 220 px tall, the icon at the top left, the name (30 px) and counts at the bottom left, the fan (96×144) at the right.
- **The Games tile:** the gamepad icon (`Gamepad2`), "Games", and "5 to play · 3 playing · 12 played". The "playing" count shows only while at least one game is Playing (`#not-playing`). The fan shows the three games last added to the Backlog.
- **Playing now:** after "Reading now" and "Watching now", the order of the tiles. Each row is the "Reading now" row: the cover (48 px wide), the title (one line, cut with an ellipsis), "Developer · since 3 November", a chevron. No Progress, so no bar and no button. Two columns from `md`. Hidden when nothing is Playing.

## Search on Games

- **Chips:** the segmented control with four segments: Films, Books, Series, Games. Music is not shown until it is built.
- **Field:** placeholder "Title in English". The hint with an empty field: "Type a game's English title to search your Saved and IGDB." (`#empty`).
- **In your Saved** first, as for the other types. The status line: "★ 4.5 · Played", "Playing", "Backlog", or a Collection's name.
- **From IGDB** with the count, one card of rows. Each row: the cover (72×108 on a phone, 48×72 from `md`), the title, then **"year · platforms"**, then **Mark played**, the **Want to play** bookmark toggle, and **Add to collection**. The whole row opens the game's page (#165).
  - **Platforms:** at most three, then "+N" for the rest ("2015 · PC, PS4, PS5 +4"). Their order: PC first, then PlayStation from oldest to newest, then Xbox, then Nintendo, each from oldest to newest, then the rest by name. Each platform shows IGDB's abbreviation, or its name when it has none ("XONE", "Series X|S", "famicom", "ZXS").
  - **No year** (IGDB has no `first_release_date`): the platforms alone ("ZXS"). **No platforms:** the year alone. Neither: no line.
- **Cyrillic queries** show what IGDB returns: "сталкер" finds the S.T.A.L.K.E.R. games through their Russian alternative names (`#cyrillic`).
- **Nothing found** (`#nomatch`): the empty box with the gamepad icon, "No games found for “відьмак”.", then "Try the English title: IGDB knows games by their English names.", then "Can't find it? Add manually".
- **The IGDB credit:** in the footer, a line under the Open Library one: "Game data and covers from IGDB.", with "IGDB" a link to `https://www.igdb.com/`. From `md` the version moves to the end of that line.

## A game's page

The film's page, with [`film-banner/`](../film-banner/)'s layout and [`catalog-details/`](../catalog-details/)'s About block.

- **The banner** is the game's art, chosen by ADR-0012's rule (below). With no art and no screenshots it is the cover, blurred as a book's (`#no-art`). With no cover either, there is no banner: the cover placeholder and the title sit under the header (`#no-cover`).
- **Title:** the game's name, without a year in brackets, since the year leads the facts line. Games have one title (ADR-0012), so there is no second line.
- **The facts line:** "year · developer · platforms", the platforms as in Search ("2015 · CD Projekt RED · PC, PS4, PS5 +4"). A part IGDB doesn't have is left out with its dot.
- **About:** the summary, four lines on a phone and three from `sm`, with **More**; then **From IGDB** at the right, with an external-link icon, a link to the game's IGDB `url` in a new tab; then a **Genres** row with IGDB's genre names as they are ("Role-playing (RPG)", "Hack and slash/Beat 'em up"). No summary and no genres: no About block, and "From IGDB" moves under the facts line.
- **Stat tiles** once played: Played ("Once", "Twice", "3 times"), Your rating, First played.
- **Actions:**
  - Before a first Played: **Played** (primary, a check), **Want to play** (the Backlog toggle), **Start playing**, **Add to collection**.
  - Once played: **Played again** (a replay icon), **Want to play**, **Start replaying**, **Add to collection**.
  - While Playing (`#playing`): the Playing card, as books' Reading card: the gamepad icon, "Playing", "Since 3 November 2026", a pencil to change the start date, then **Finished** (primary; opens the Played sheet and ends Playing) and **Stop playing** (ends Playing, no Log Entry). Only **Add to collection** stays under it.
- **History** (`thoughts/`): a Log Entry from a second Played on carries the "Replay" badge. Empty: "Nothing here yet" and "Mark it Played to keep the date, Rating and Review here, or add a thought at any time, even before you play."

## The banner's picture

ADR-0012 changes with this pick: the first match, in this order.

1. An artwork whose `artwork_type` is key art without logo (2), then key art with logo (3), then artwork (1), then concept art (4), and which is landscape (wider than tall). Within a type, IGDB's order.
2. The first screenshot.
3. None: the page shows the cover, blurred, or no banner without a cover.

Never a logo (5, 6, 7, 13), an icon (12, 14), a cover (9, 10, 11) or an infographic (8). An artwork with no type counts as artwork (1).

## A game without a cover

The typeset cover books have (`books/`): `bg-primary-soft`, `border-border`, a thin inner frame in `primary-strong` at 45% opacity, the title in bold at the top, the **developer** at the foot in `text-muted-foreground` (none when IGDB has none). The same sizes as a book's: 11/9 px at 72×108, 14/11 px in a grid and at 104×156, 22/13 px at 176×264, the title alone at 8 px at 48×72. `role="img"`, named "No cover".

## Copy

| Where | Text |
| --- | --- |
| Chips | Films · Books · Series · Games |
| Saved | Games · {n} to play · {n} playing · {n} played · Playing now · {developer} · since {date} |
| Search | Title in English · Type a game's English title to search your Saved and IGDB. · From IGDB · Mark played · Want to play · Add to collection · No games found for “{query}”. · Try the English title: IGDB knows games by their English names. |
| Status line | ★ {rating} · Played · ★ {rating} · Backlog · Playing · Backlog |
| A game's page | Played · Played again · Want to play · Start playing · Start replaying · From IGDB · Genres · Played (a tile) · Once · Twice · {n} times · Your rating · First played · Replay |
| Playing | Playing · Since {date} · Finished · Stop playing · Change the start date |
| History, empty | Nothing here yet · Mark it Played to keep the date, Rating and Review here, or add a thought at any time, even before you play. |
| Credit | Game data and covers from IGDB. |

## Open questions

None that #251 or #252 depends on. A note for #251: IGDB's `game_status != 6` leaves out games with no status at all, which is most of them ("witcher 3" finds nothing). The filter needs `(game_status = null | game_status != 6)`. ADR-0012 now says so.
