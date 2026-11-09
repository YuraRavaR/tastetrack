# Books: every screen books change

**Issue:** #174, part of the books spec #170 (ADR-0011). The book tickets #175–#180 are built and checked against this folder.
**Picked:** on 2026-11-09, over three canvas rounds. Media Type chips: variant C, a segmented control, and on the web C2 (the phone's control, full width). Covers: A, cropped to 2:3. No cover: 2, a typeset cover. The screens of round 3 were accepted as drawn, with the seven decisions under [Settled](#settled).
**Canvas:** <https://claude.ai/artifact/BUn2m8BTq5Z9mzwjPQrzwP> (private). Three pages:

1. **Round 1 · Chips and covers.** Chips for five types: A one scrolling row, B wrapping, C a segmented control, D a dropdown (phone and web). Covers: A crop to 2:3, B the whole cover on a blurred copy, C the whole cover on a shelf, D natural height. No cover: 1 a joke and an icon (like films), 2 a typeset cover, 3 one quiet icon.
2. **Round 2 · Segmented chips on the web.** C1 a 40 px row, C2 the phone's control at full width, C3 a compact control on the heading's row.
3. **Round 3 · Book screens.** Search, a book's page, Saved, Collections, adding a book by hand, the Open Library credit.

All data is real Open Library data from 2026-11-09 (search results, authors, years, cover IDs), messy parts included.

## Files

| File | Shows |
| --- | --- |
| `books-search.html` | Search on Books: results for "night" (no hash), a Cyrillic query "жадан" (`#cyrillic`), nothing found for "Доця" (`#nomatch`). |
| `books-page.html` | A book's page: read twice (no hash), before a first Reading (`#before`), Reading, In Progress (`#reading`). |
| `books-saved.html` | Saved with the Books tile and "Reading now" (no hash); the Books page on Reading list (`#reading-list`), Read (`#read`), Reading (`#reading`). |
| `books-collections.html` | Collections on Books (no hash), one book Collection (`#collection`), the page its Share Link opens (`#shared`). |
| `books-add.html` | Adding a book by hand: a sheet on a phone, a centred dialog from `md`. |
| `books-covers.html` | Reference: how odd covers are cropped, the typeset cover at every size, the chips. |
| `<page>-<390\|1440>-<light\|dark>.png` | Each page as it opens. |
| `<page>-<390\|1440>-<state>-<light\|dark>.png` | Each `#state` above. |
| `canvas/` | All three rounds as canvas sources. Images are canvas uploads (`/_blob/…`), so they show only on the canvas. |

The static pages load covers from `covers.openlibrary.org` by cover ID, as the app will, so they need a network connection.

## Media Type chips

- **Variant C at every width:** a segmented control on `bg-muted`, `rounded-lg`, 4 px padding, five equal segments the full width of the column. Each segment is a 56 px button with the icon (18 px) over the label (13 px). The pressed one is on `bg-card` with a soft shadow, its label semibold and its icon `text-primary-strong`.
- **Types still to come** (Series, Music, Games) are disabled, in `text-muted-foreground`, with a second line: "Soon" on a phone, "Coming soon" from `md`. Their accessible description is "Coming soon".
- **On the web** (C2) the control stays full width under the search field (52rem column), and under the heading on Collections, at the search field's width (784 px).
- It replaces today's chips (`MediaTypeChips`) in Search and Collections. Series is the only type still to come after books (spec #170); Music and Games are drawn here only to test the width. The type lives in `?type=` and defaults to `film`.

## Covers

- **2:3, cropped** (`object-fit: cover`) at every size, the same as film posters. Open Library covers run from taller than 2:3 (Солодка Даруся, 289×500) to square (Тигролови, 500×500, a shop photo with white margins) and landscape (The Very Hungry Caterpillar, 400×311). All are cropped the same way; white margins and lost edges are accepted.
- **Sizes:** the M image (`-M.jpg`) for Search rows (72×108 on a phone, 48×72 from `md`); the L image (`-L.jpg`) for grids, the Saved strip, the tile fan and the book's page.
- **No cover: a typeset cover.** `bg-primary-soft`, `border-border`, a thin inner frame in `primary-strong` at 45% opacity, 6 px in from the edge. The title in bold at the top, the first author at the foot in `text-muted-foreground`. Sizes: 11/9 px at 72×108, 14/11 px in a grid and at 104×156, 22/13 px at 176×264. At 48×72 (a web Search row) only the title shows, at 8 px. It has `role="img"` and the name "No cover". No new token.

## Search on Books

The Search section of [`search/`](../search/), with books:

- **Field:** placeholder "Title or author". Hint with an empty field: "Type a title or author to search your Saved and Open Library."
- **In your Saved** first, as for films: covers in a strip on a phone, a grid from `md`. The status line under each cover, the first that applies:
  1. Logged: a star, the Current Rating, then "Reading list" if planned again, else "Read" ("★ 4 · Read"), in `text-primary-strong`.
  2. In Progress: an open-book icon and "Reading".
  3. On the Backlog: a bookmark and "Reading list".
  4. On a Collection: its name.
- **From Open Library** with the count: one card of rows. Each row has the cover, the title, then "Authors · first published year". Actions: **Mark read** (opens the Read dialog), the **Want to read** bookmark toggle, **Add to collection**. Books already in Saved are left out.
- **Cyrillic queries** show what Open Library returns, transliterated titles included ("Himn demokratychnoï molodi"). Most of Zhadan's works there have no cover.
- **Nothing found:** "No books found for “Доця”." with an open-book icon, then "Can't find it? Add manually".

## A book's page

The film's page with [`film-banner/`](../film-banner/)'s layout and its no-backdrop case: books have no backdrop, so the picture area is always the cover, blurred (`blur(24px)` on a phone, `36px` from `sm`, `saturate(1.3)`, scaled ~1.3).

- **Titles** by ADR-0004's display rules: the English Localized Title, with the Original Title and year alongside when it differs ("One Hundred Years of Solitude (Cien años de soledad, 1967)", "Kafka on the Shore (海辺のカフカ, 2002)"), else the title and year ("Piranesi (2020)"); the Ukrainian Localized Title as the second line; then the authors.
- **Stat tiles** once read: Read ("Once", "Twice", "3 times"), Your rating, First read.
- **Actions:**
  - Before a first Reading: **Read** (primary), **Want to read** (toggle), **Start reading**, **Add to collection**.
  - Once read: **Read again**, **Want to read**, **Start rereading**, **Add to collection**.
  - While Reading: a card on `bg-primary-soft` with a `primary-strong` border: an open-book icon, "Reading", "Since 12 October 2026" and a pencil button to change the start date, then **Finished** (primary; opens the Read dialog and ends In Progress) and **Stop reading** (clears In Progress, no Log Entry). Want to read and Start reading are hidden while Reading; Add to collection stays.
- **Readings:** as Viewings, in Log Order. A Revisit carries a "Reread" badge, and a Review shows under its row. Empty: "Not read yet".

## Saved

- **Tiles:** Films and Books side by side from `md`, stacked on a phone. Books: the open-book icon, "Books", "8 to read · 2 reading · 23 read", and a fan of the three latest Reading list covers.
- **Reading now:** under the tiles, one row per book In Progress (cover 44 px wide, title, "Author · since 12 October", a chevron), two columns from `md`. Hidden when nothing is In Progress.
- **The Books page:** "‹ Saved" on a phone, "Saved › Books" from `md`. Three tabs in lifecycle order: **Reading list · Reading · Read**, each with its count. Reading list is the default.
- **Chips:**

  | Tab | Sort (default first) | Filters |
  | --- | --- | --- |
  | Reading list | Date added, Title, First published | Decade |
  | Reading | Started (newest first) | none |
  | Read | Last read, Rating, Title, First published | Decade, Rating |

- **Under each cover:** the author on Reading list, the start date on Reading ("Since 12 October"), the Current Rating on Read. Read shows each book once.

## Collections

- Collections on Books: the chips under the heading; each card has a 2×2 collage of covers (dashed empty slots under 4), the name, an open-book icon and "6 books · Shared".
- One book Collection: as for films, with "Add books" in place of "Add films" ("Add books to {Collection}"). Under each cover: the title and the first author, then the Note.
- The Share Link page: under each cover, the title, then "Author · year", then the Note. "There are no books here yet." when empty.

## Adding a book by hand

- The Add manually dialog for films ([`log-entry-dialog/`](../log-entry-dialog/)'s sheet on a phone, a centred dialog from `md`) with books' fields: **Title**; **Original Title** (optional, same hint); **Year** (optional); **Authors** (optional).
- **Authors** is one text field. The hint is "Separate names with commas.", and the names are trimmed and stored as a list.
- Copy: "Add a book manually", "For a book search doesn't find. Only you will see it."

## The Open Library credit

In the footer, a line under the TMDB notice: "Book data and covers from Open Library.", with "Open Library" a link to `https://openlibrary.org/` (`text-foreground`, underlined). From `md` the version moves to the end of that line.

## Copy

| Where | Text |
| --- | --- |
| Chips | Films · Books · Series · Music · Games; Soon (phone) / Coming soon (from md) |
| Search | Title or author · In your Saved · From Open Library · Mark read · Want to read · Add to collection · No books found for “{query}”. |
| Status line | ★ {rating} · Read · ★ {rating} · Reading list · Reading · Reading list |
| Book page | Read · Read again · Want to read · Start reading · Start rereading · Readings · Reread · Not read yet · First read · Your rating |
| In Progress | Reading · Since {date} · Finished · Stop reading · Change the start date |
| Saved | Books · {n} to read · {n} reading · {n} read · Reading now · Reading list · Reading · Read · Last read · Started |
| Collections | {n} books · Add books · There are no books here yet. |
| Manual | Add a book manually · Authors · Separate names with commas. |
| Credit | Book data and covers from Open Library. |

## Settled

The user accepted these on 2026-11-09, as recommended:

1. **Authors field:** one field, names split by commas (not one field per author).
2. **Author names:** combining stress marks are stripped for display ("Сергі́й Ві́кторович Жада́н" shows as "Сергій Вікторович Жадан"), and at most two authors show, then "+N" ("Сергій Жадан, Reilly Costigan-Humes +1"). Open Library lists translators among a work's authors (ADR-0011).
3. **Reading now** stays on the Saved home page.
4. **Tab order:** Reading list · Reading · Read.
5. **Under a cover on Reading list:** the author, not the year.
6. **Filters:** books have no genres (Open Library's subjects aren't stored), so only Decade, plus Rating on Read.
7. **Start reading** is its own button ("Start rereading" once read). The Reading card uses "Finished" and "Stop reading".

## Open questions

None that a book ticket depends on. Two notes for the tickets:

- The Reading tab, "Reading now", the In Progress card and Start reading ship with In Progress, the last books ticket. Until then the Books page has two tabs (Reading list · Read), and the page shows no Start reading.
- Open Library's covers are sometimes another edition's (the solitude cover here is the German "Hundert Jahre Einsamkeit"). That is the data; the design doesn't try to fix it.
