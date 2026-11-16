# Book Progress: a book's Reading card and the Reading now row

**Issue:** #235, part of the book Progress spec #204 (ADR-0005). #236 (the Progress API and UI) is built and checked against this folder.
**Picked:** on 2026-11-16, in one canvas round. The card: variant A, Change turns the panel into two fields in the card. The row: variant A, the author and the start date stay and the page is a third line.
**Canvas:** <https://claude.ai/artifact/UcuXvLi4gUczDpV9CDRUoT> (private). One page, **Round 1 · The Reading card and the row**:

- The Reading card on a book's page, on a phone in five states and on the web: **A** Change opens two fields in the card, with Clear, Cancel and Save (the pick); **B** the panel is one button that opens a sheet on a phone (a dialog on the web), with a big page field between − and +; **C** the fields are always open, a stepper for the page, saved a second after the last change, as a series' steppers are.
- "Reading now" on Saved beside "Watching now", on a phone and on the web: **A** a third line for the page (the pick); **B** the page takes the start date's place in the status line.

The books are real Open Library data from 2026-11-16: Piranesi, Susanna Clarke (272 pages, the median of its editions), Kafka on the Shore, Haruki Murakami, and Ворошиловград, Сергій Жадан. The page counts are drawn as a User would type them for their own edition.

## Why A and A

- **The card.** The panel reads as it does on a series' card (a label, a big number, a bar) until the User asks to change it, so the page is not an open form every time the book's page loads. Save is explicit, which suits typing a number better than saving on a pause: a half-typed "16" on the way to "168" is never written (ADR-0006). B adds a sheet and a dialog for two numbers, and its − and + barely help with pages. C's stepper is the series' picker, but pages move by tens, not ones, and its always-open fields made the card the tallest thing on the page.
- **The row.** Nothing a book's row shows today goes away, so a book without Progress and a book with it read alike. The page sits where a series' bar sits, so the two sections line up. B drops the start date once there is a page, and a row would then change shape depending on its Progress.

## Files

| File | Shows |
| --- | --- |
| `book-progress-page.html` | A book's page while Reading: a page and the page count (no hash), no Progress yet (`#none`), a page only (`#page`), the editor open (`#edit`), a page above the page count refused (`#refused`). |
| `book-progress-saved.html` | Saved: "Reading now" with every state of the row, and "Watching now" under it. |
| `<page>-<390\|1440>-<light\|dark>.png` | Each page as it opens. |
| `<page>-<390\|1440>-<state>-<light\|dark>.png` | Each `#state` above. |
| `canvas/` | The round as canvas sources, all variants included. Images are canvas uploads (`/_blob/…`), so they show only on the canvas. |

The static pages load covers from `covers.openlibrary.org` and posters from `image.tmdb.org`, so they need a network connection. The rest of a book's page and Saved are `books/`'s and `series-progress/`'s, and are not drawn again.

## The Reading card

The card is today's (`books/`, `InProgressCard`), with the Progress in its `progress` slot, as a series' card has it (`series-progress/`). On a phone: the heading, the panel, then Finished and Stop reading, two equal 48 px columns. From `sm` the buttons sit beside the heading (40 px) and the panel takes the card's whole width under them.

### The panel

`bg-card`, `border`, 12 px radius, 12 px padding (14 px from `sm`).

| Part | Phone (below `sm`) | From `sm` |
| --- | --- | --- |
| **Label** | "Page", 13 px, 600, `text-muted-foreground` | The same |
| **Page** | "142", 19 px, 700 | 20 px |
| **To go** | "130 pages to go" (14 px, muted) under the page, only with a page count. "1 page to go"; "On the last page" when the page is the page count | The same |
| **Bar** | Under the page, the full width of the panel: `EpisodeMeter`'s card size, a 6 px bar and "142 of 272" at 13 px. Only with a page count | Beside the page, between it and Change, at most 340 px with its count |
| **Change** | "Change" with a pencil, a 44 px outline button on `bg-background`, at the right of the page | At the panel's right end, 40 px |

- **No Progress yet** (`#none`): "Page" over "Which page are you on?" (14 px, muted), and "Add page" with a plus in Change's place.
- **A page only** (`#page`): "Page" and "142", and Change. No "to go", no bar.
- **A page and the page count** (no hash): all of the above.
- The bar's name is "Page 142 of 272"; the count beside it is hidden from a screen reader, as `EpisodeMeter` does. The bar's share is the page over the page count.

### The editor (`#edit`)

Change (or Add page) puts the editor in the panel's place, inside the card; Finished and Stop reading stay where they are.

| Part | Phone (below `sm`) | From `sm` |
| --- | --- | --- |
| **Fields** | Two equal columns, 10 px apart: "Page" and "Pages in your edition", each a label (13 px, 600, muted) over a 48 px input, 18 px bold, `bg-background`, `border-input`, 12 px radius | In a row: Page 140 px wide, Pages in your edition 180 px; 40 px inputs, 16 px |
| **Placeholder** | Pages in your edition: "Optional" | The same |
| **Buttons** | Clear (a ghost button, `text-muted-foreground`) at the left; Cancel (outline, `bg-background`) and Save (primary) at the right; all 44 px | At the row's right end, 40 px |

- Both inputs are `inputmode="numeric"`, so a phone shows the number keyboard. They open filled with what is saved, and empty with no Progress. Focus goes to Page, its text selected, so typing replaces it.
- **Save** writes the whole Progress, `{ page, pageCount? }`, in one request and closes the editor. Enter saves too. An empty page count is saved without one. Save stays disabled while Page is empty.
- **Cancel** (and Escape) closes the editor and changes nothing.
- **Clear** removes the Progress (`progress: null`) at once, with no confirmation, and closes the editor; the panel then shows "Which page are you on?". It shows only when something is saved. Removing only the page count is emptying its field and saving.
- **Refused** (`#refused`): a page above the page count is not saved. The Page input gets a `border-destructive` and its ring, `aria-invalid`, and under the fields "Page 312 is past the last page, 272." (14 px, `text-destructive`, with an alert icon), tied to the input with `aria-describedby`. Save is disabled until the page or the page count changes. From `sm` the message takes its own line under the row.
- **Out of range** reads the same way, under the field it is about: a page above 100,000, "A page goes up to 100,000."; a page count of 0 or above 100,000, "An edition has from 1 to 100,000 pages." Page 0 is allowed: it means not started.
- **Saving fails:** the editor stays open with what was typed, and "Couldn't save your page of Piranesi. Please try again." shows where the refusal does.

## The Reading now row

The row is today's (`books/`, `InProgressRow`), with one line added under the author and since when. The whole row stays one link with a chevron in a 44 px zone.

| Line | Phone (below `md`) | From `md` |
| --- | --- | --- |
| **Title** | 16 px, 600, one line | The same |
| **Author and since when** | "Susanna Clarke · since 12 October", 13 px, muted, as today | 14 px |
| **With a page count** | `EpisodeMeter`'s row size: a 5 px bar and "142 of 272" at 12 px | 13 px; at most 340 px with its count |
| **With a page only** | "p. 88", 12 px, muted | 13 px |
| **Without Progress** | Nothing: the row is two lines, as today | The same |

The section's order, its two columns from `md` and its heading are as today: the latest started first. "Reading now" comes before "Watching now", and the two rows match in size, poster, bar and spacing.

## Not in these mockups

- A page count from Open Library: the spec (#204) takes it from the User only.
- Anything happening at the last page: Finished stays the User's own action.
- The Books tile's counts and the rest of Saved, which are `books/`'s and #210's.

## Open questions

None that #236 depends on.
