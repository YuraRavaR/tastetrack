# Albums: five Media Types, Search, an album's page and square covers

**Issue:** #268, part of the albums spec #266 (ADR-0013). #270 (the albums UI) is built and checked against this folder.
**Picked:** on 2026-11-21, in one canvas round and an icon pick.

| Screen | Pick |
| --- | --- |
| Saved, phone | A: the 2×2 grid stays, then Albums as a wide tile |
| Saved, web | B: three tiles, then two |
| Media Type chips | A: today's segmented control with five segments |
| The Albums icon | Lucide `disc-3`, a record |
| Search row | A: one muted line, artist · year · type |
| An album's page, phone | C: the cover the full width, fading into the page, no blur |
| An album's page, web | A: the book page's layout, the blurred cover as the banner, the square cover at the left |
| Grid | A: three columns on a phone |
| No cover | 1: a typeset square, as a book's |

**Canvas:** <https://claude.ai/artifact/KYEC7Ptyo5UcSNz21eEdsG> (private). One page, **Round 1 · Album screens**:

- Saved on a phone: **A** 2×2, then a wide Albums tile (the pick); **B** one shorter row per type; **C** three small tiles, then two. Saved on the web: **A** 2×2, then Albums the full width; **B** three, then two (the pick); **C** five in a row.
- The chips: **A** five equal segments (the pick); **B** a scrolling row of pills; **C** icons, the pressed one named. The Albums icon: **1** a record (the pick); **2** a note; **3** headphones; **4** a sound wave. The canvas boards other than the icon board still draw the first icon tried, Lucide `disc-album`, which looked strange.
- A Search row: **A** "The Beatles · 2012 · Remix" (the pick); **B** the artist on its own line; **C** the type as a tag. Search's states: a Cyrillic query, nothing found, MusicBrainz busy.
- An album's page: **A** the book page, a 136 px cover at the left; **B** a 216 px cover centred; **C** the cover the full width (the pick on a phone). The web page, drawn as A (the pick on the web).
- Square covers in a grid: **A** three columns (the pick); **B** two.
- No cover: **1** typeset (the pick); **2** one quiet icon; **3** a record sleeve.

All album data is real MusicBrainz data from 2026-11-21, and the covers are the Cover Art Archive's for those release groups: the search results for "beatles abbey road", "океан ельзи земля" and "Тиждень Вовчика" (no results), Земля, 1944 as an EP, Live From Madison Square Garden, and the albums without a cover.

## Why these

- **Saved: A on a phone, B on the web.** On a phone the four tiles keep the grid #250 settled, and Albums takes a row of its own, so no tile is narrower than today's. On the web a row of three and a row of two fill the width with no tile alone in a row.
- **Chips A.** It is today's control; five segments of about 66 px fit "Albums" at 13 px on a 390 px phone. Pills hide types off the edge, and icons alone make the User learn them.
- **The record icon.** An album is a record. The note (`music`) stays free for Songs, the next music spec.
- **Row A.** It reads as games' and books' rows do, one line under the title.
- **Page C on a phone.** A square cover is as wide as the phone and isn't stretched, so it is the banner itself; a blurred copy behind a smaller square adds nothing on a narrow screen. On the web a full-width square would be taller than the window, so the web keeps the book page's banner.
- **Grid A** keeps the poster grid's three columns; a square cell is only shorter.
- **No cover 1** is the typeset cover books and games already have, square.

## Files

| File | Shows |
| --- | --- |
| `albums-saved.html` | Saved with five tiles: on a phone the 2×2 grid and a wide Albums tile, from `md` three tiles, then Games and Albums. The rows in progress (Reading now, Watching now, Playing now) are unchanged; albums have none. |
| `albums-search.html` | Search on Albums. No hash: "beatles abbey road", Abbey Road in the User's Saved and five MusicBrainz results, three of them without a cover and one without a year. `#cyrillic` "океан ельзи земля"; `#nomatch` "Тиждень Вовчика", nothing found; `#busy` MusicBrainz answered 503 twice; `#empty` nothing typed yet. |
| `albums-page.html` | An album's page. No hash: Земля, listened twice. `#before` 1944, an EP, not listened yet; `#listening-list` Live From Madison Square Garden, a live album by two artists, on the Listening list; `#no-cover` Abbey Road Remix, no cover, so no picture. |
| `albums-grid.html` | The Albums page. No hash: the Listening list tab; `#listened` the Listened tab, with each Current Rating; `#collection` a Collection of albums, "Albums to start with Ukrainian rock". |
| `albums-covers.html` | Reference: covers that aren't square, the typeset square at every size, the chips and the icon. |
| `<page>-<390\|1440>-<light\|dark>.png` | Each page as it opens. |
| `<page>-<390\|1440>-<state>-<light\|dark>.png` | Each `#state` above. |
| `canvas/` | The round as canvas sources, all variants included. Images are canvas uploads (`/_blob/…`), so they show only on the canvas. |

The static pages load covers from `coverartarchive.org` by release-group MBID, as the app will, and the other types' covers from TMDB, Open Library and IGDB, so they need a network connection. Only what albums add is drawn. The Listened sheet (with Relisten), History and Thoughts, adding an album by hand and a Share Link's page follow the film, book and Collection screens (`log-entry-dialog/`, `thoughts/`, `books/`, `shared-collection/`) with the album words below.

## Media Type chips

- Today's segmented control with **five** equal segments, in the order Films, Books, Series, Games, Albums (ADR-0005), at every width: about 66 px a segment on a phone, the icon (18 px) over the label (13 px).
- **The Albums icon** is Lucide's `disc-3` (`Disc3`), in the chips, on the tile and in the "nothing found" box.

## Saved

- **On a phone** (below `md`): Films, Books, Series and Games in today's 2×2 grid. **Albums** is a tile the full width under it, 132 px tall, 16/18 px padding: the icon (36 px) at the top left, the name and counts at the bottom left (the counts at most 170 px wide), and the fan of three square covers at the right (66 px, the front one 84 px, the outer two turned 9°).
- **From `md`:** a row of three (Films, Books, Series), then a row of two (Games, Albums), every tile 220 px tall. The three take a smaller fan (posters 62×93, the front one 70×105) and 26 px names. Games and Albums take today's full fan; the album fan is squares of 112 px, the front one 128 px.
- **The Albums tile:** "Albums" and "7 to listen · 14 listened". The fan shows the three albums last added to the Listening list.
- **No "Listening now":** an album is never In Progress, so the rows in progress don't change.

## Search on Albums

- **Field:** placeholder "Album and artist". With an empty field: "Type an album and its artist to search your Saved and MusicBrainz." (`#empty`).
- **In your Saved** first, as for the other types: square covers in the strip (120 px on a phone), with the status line ("★ 5 · Listened", "Listening list" or a Collection's name).
- **From MusicBrainz** with the count, one card of rows. Each row: the square cover (72 px on a phone, 56 px from `md`), the title, then **"artist · year · type"**, then **Mark listened**, the **Want to listen** bookmark toggle and **Add to collection**. The whole row opens the album's page.
  - **The type** shows only for a release group that isn't a plain studio album: "EP", or the secondary type ("Live", "Remix", "Soundtrack", "Compilation"). A part MusicBrainz doesn't have is left out with its dot ("The Beatles" for Abbey Road Working Version, which has no date).
  - **The artist** is MusicBrainz's artist credit as it is, joining phrases included ("Eric Clapton & Steve Winwood").
- **Nothing found** (`#nomatch`): the empty box with the record icon, "No albums found for “Тиждень Вовчика”.", then "Try adding the artist: MusicBrainz finds an album best by its title and artist together.", then "Add manually". MusicBrainz matches any word of a query, so this is rare.
- **MusicBrainz busy** (`#busy`, two 503s after the retry): the box with a clock icon, "MusicBrainz is busy, try again in a moment.", a line on what the User's Saved found, and **Try again** (primary). It replaces the MusicBrainz results; "In your Saved" still shows when something matches.
- **The credit:** in the footer, a line under the IGDB one: "Album data from MusicBrainz.", with "MusicBrainz" a link to `https://musicbrainz.org/`. From `md` the version moves to the end of that line.

## An album's page

- **On a phone** (below `sm`, variant C): the cover the full width of the screen (390×390 at 390 px, the 500 px image), its bottom 30% fading into the page with a mask, no blur. The title (26 px, bold), the facts line and the MusicBrainz link sit under it, overlapping the fade by 36 px.
- **From `sm`** (variant A): the book page's banner, the cover blurred (`blur(36px)`, `saturate(1.3)`), and a square cover (176 px, 14 px radius, a shadow) at the left, with the title (34 px), the facts line and the link beside it.
- **Title:** MusicBrainz's title, in its original script, without a year in brackets. Albums have one title (ADR-0013), so there is no second line.
- **The facts line:** "year · artist credit · type", the type as in Search ("2013 · Океан Ельзи", "2016 · Jamala · EP", "2009 · Eric Clapton & Steve Winwood · Live").
- **On MusicBrainz:** a link under the facts line, in `primary-strong` with an external-link icon, to `https://musicbrainz.org/release-group/<MBID>` in a new tab. No About block.
- **No cover** (`#no-cover`): no picture area at any width; the typeset square (136 px on a phone, 176 px from `sm`) at the left, the title beside it.
- **Stat tiles** once listened: Listened ("Once", "Twice", "3 times"), Your rating, First listened.
- **Actions:**
  - Before a first Listened: **Listened** (primary, a check), **Want to listen** (the Backlog toggle), **Add to collection**.
  - Once listened: **Listened again** (primary, a replay icon), **Want to listen**, **Add to collection**.
  - No Start listening: an album is never In Progress.
- **History** (`thoughts/`): a Log Entry from a second Listened on carries the "Relisten" badge. Empty: "Nothing here yet" and "Mark it Listened to keep the date, Rating and Review here, or add a thought at any time, even before you listen."

## Square covers

- **Square everywhere:** Search rows, the In your Saved strip, the tile fan, grids and the page. `object-fit: cover` in a square, never 2:3. A cover that isn't quite square fills the square (На межі is 250×227, The Road 250×224 on the Cover Art Archive), losing a few pixels.
- **Sizes:** `front-250` for rows and grids, `front-500` for the fan, the strip and the page.
- **The grid** (the Albums page tabs and a Collection, variant A): three columns on a phone with 16/10 px gaps, each cell the square, the title (two lines, 13 px) and the artist (one line, 12 px); on the Listened tab the Current Rating under them. From `md`, `auto-fill` columns of at least 150 px.
- **The Albums page:** "‹ Saved" on a phone, "Saved › Albums" from `md`, then two tabs, **Listening list · Listened**, each with its count. Sort and filters as films': Listening list by Date added with Decade; Listened by Last listened with Decade and Rating.

## An album without a cover

The typeset cover books and games have (`books/`), square: `bg-primary-soft`, `border-border`, a thin inner frame in `primary-strong` at 45% opacity, the title in bold at the top, the **artist credit** at the foot in `text-muted-foreground`. Sizes: 9/8 px at 72 px, 13/10 px in a grid, 16/12 px at 136 and 176 px; at 56 px (a web Search row) the title alone at 8 px. `role="img"`, named "No cover".

## Copy

| Where | Text |
| --- | --- |
| Chips | Films · Books · Series · Games · Albums |
| Saved | Albums · {n} to listen · {n} listened |
| Search | Album and artist · Type an album and its artist to search your Saved and MusicBrainz. · From MusicBrainz · Mark listened · Want to listen · Add to collection · No albums found for “{query}”. · Try adding the artist: MusicBrainz finds an album best by its title and artist together. · MusicBrainz is busy, try again in a moment. · Try again |
| Status line | ★ {rating} · Listened · ★ {rating} · Listening list · Listening list |
| An album's page | On MusicBrainz · Listened · Listened again · Want to listen · Listened (a tile) · Once · Twice · {n} times · Your rating · First listened · Relisten |
| The Albums page | Albums · Listening list · Listened · Date added · Last listened |
| History, empty | Nothing here yet · Mark it Listened to keep the date, Rating and Review here, or add a thought at any time, even before you listen. |
| Credit | Album data from MusicBrainz. |

## Open questions

1. **Search ranking (for #269).** With ADR-0013's order (Album, then no secondary type, then MusicBrainz's order), "beatles abbey road" lists Vorticaunt's "The Beatles’ Abbey Road but with the Earthbound Sound font" and "Enjoy The Beatles!" by an artist called Abbey Road before The Beatles' own Abbey Road Remix. Drawn as the ADR has it; the ranking may want the artist's match too.
2. **A type with several secondary types** (a soundtrack compilation is "Compilation, Soundtrack"): drawn with one type only, as no drawn album has two. Show the first, or all of them joined by a dot?
