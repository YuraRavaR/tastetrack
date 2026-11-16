# Thoughts: History on a Media Item's page, and the add and edit form

**Issue:** #241, part of the Thoughts spec #240. #242 (Thoughts end to end) is built and checked against this folder, and #243 (a Backlog Note kept as a Thought) uses its rows.
**Picked:** on 2026-11-16, in one canvas round. The row: variant A, one bordered list where a Thought's state and Progress sit on its date line. The form: variant A, the Watched sheet's shape.
**Canvas:** <https://claude.ai/artifact/6Nmshuox9aCR65TLLfHDk4> (private). One page, **Round 1 · History and the form**:

- History on a phone in five states, and the three rows side by side on the web: **A** one list, the state and Progress on the date line, a ⋯ menu (the pick); **B** a timeline with a dot per item, the state and Progress as chips, a "Write a thought…" box on top; **C** Log Entries as today, each Thought a soft card inside the list.
- The form on a phone in five states and as a web dialog: **A** the Watched sheet's shape, with a Quote switch, a Progress row and date chips (the pick); **B** write first, with Cancel · title · Save on top and a row of chips under the text.

The titles are real: Severance (Apple TV+), Piranesi (Susanna Clarke), Spirit: Stallion of the Cimarron, Kafka on the Shore (Haruki Murakami) and Perfect Days. The Thoughts are written as a User would write them.

## Why A and A

- **The row.** A Thought sits in the list a Log Entry already sits in, with the same ⋯ menu, so History is one list that reads top to bottom and nothing a User knows moves (spec story 14). The small icon and the full text set a Thought apart from a Log Entry, whose Review is cut to one muted line. B redraws Log Entries as a timeline as well, and its tap-anywhere items differ from a Log Entry's menu. C's cards are loud next to today's rows once there are many Thoughts.
- **The form.** It is the Watched sheet (`log-entry-dialog/`) with Thought fields: every choice is in view, and the date chips work as the Watched sheet's do. B hides the date and the Progress in chips, and its Save at the top differs from every other form in the app.

## Files

| File | Shows |
| --- | --- |
| `thoughts-history.html` | History on a Media Item's page. No hash: a book read for the second time (Piranesi). `#series` a series being watched (Severance); `#film` a film with Thoughts between its Log Entries and an undated Log Entry last; `#not-saved` a Thought on a book that is not in Saved; `#empty` the empty state; `#menu` a Thought's ⋯ menu open. |
| `thoughts-form.html` | The form, a sheet below `md` and a dialog from `md`. No hash: a new Thought on a series being watched, its episode filled in. `#episode` changing the episode; `#page` a quote, changing the page; `#no-page` the page removed; `#edit` editing, with another date, the counter and Delete; `#too-long` a film over 2,000 characters; `#failed` saving failed; `#delete` the Delete confirmation. |
| `<page>-<390\|1440>-<light\|dark>.png` | Each page as it opens. |
| `<page>-<390\|1440>-<state>-<light\|dark>.png` | Each `#state` above. |
| `canvas/` | The round as canvas sources, all variants included. Images are canvas uploads (`/_blob/…`), so they show only on the canvas. |

The static pages load posters from `image.tmdb.org` and covers from `covers.openlibrary.org`, so they need a network connection. Only the History section and the form are drawn. The rest of a Media Item's page (banner, About, the Watching or Reading card, actions) is in `film-banner/`, `catalog-details/`, `series-progress/` and `book-progress/`, and does not change.

## History

The section replaces today's Item History section in `ItemHistoryPage` and keeps its place and its bordered list (`rounded-lg border bg-card`, rows divided).

### The heading

- "History" for every Media Type (18 px, 600; 20 px from `sm`), replacing `mediaType.*.history` ("Viewings", "Readings").
- **Add a thought** at the heading's right end: an outline button with a message-square-plus icon, 40 px on a phone and 36 px from `md`. It shows in every state, the empty one included, and on a Manual Media Item too. It opens the form.

### The order

Newest first, one list:

- Log Entries keep their Log Order, so they sit where they sit today.
- A Thought sits by its date. On the same day, a Thought and a Log Entry go by creation time, newest first.
- An undated Log Entry stays at the bottom, as today (`#film`).

### A Log Entry's row

Unchanged: the date, the Rating, the Revisit badge, the Review cut to one muted line, and the ⋯ menu (`ItemHistoryRow`).

### A Thought's row

Padding 10 px top and bottom, 12 px left (14 px from `sm`), the ⋯ zone at the right as a Log Entry's.

| Part | What it shows |
| --- | --- |
| **Icon** | 14 px, first on the date line: a message-square in `text-muted-foreground` for a Thought, a quote mark in `text-primary-strong` for a quote. Named "Thought" or "Quote" for a screen reader. |
| **Date** | "15 Nov 2026", 14 px, 500, as a Log Entry's date (`formatCalendarDate`). |
| **State** | The state it was written in, 13 px, `text-muted-foreground`, after the date. None for `none`. |
| **Progress** | "p. 142", "S2 · E5", in a tag after the state: 12 px, 600, `bg-muted`, 6 px radius, tabular figures. Nothing when the Thought has none. |
| **Text** | Under the line, 15 px, 1.45 line height, in `text-foreground`, in full (never cut), its line breaks kept (`whitespace-pre-line`), long words broken (`break-words`), at most 68 characters wide from `sm`. |
| **Quote** | The same text in italics, inside curly quotes (“ ”) that the client adds. Never a left border. |
| **⋯** | 44 px (40 px from `md`), named "Actions for your thought of {date}". It opens Edit and Delete, as a Log Entry's menu does (`#menu`). Edit opens the form; Delete opens the confirmation. |

The date line wraps on a phone when the state and the Progress don't fit (`flex-wrap`, 4 px rows, 8 px columns).

### State labels

| State | Film | Series | Book |
| --- | --- | --- | --- |
| `planned` | while on your Watchlist | while on your Watchlist | while on your Reading list |
| `in_progress` | (films have no In Progress) | while watching | while reading |
| `experienced` | after watching | after watching | after reading |
| `none` | nothing | nothing | nothing |

A Thought copied from a Backlog Note (#243) is a `planned` Thought like any other and reads "while on your Watchlist". It has no mark of its own, since the model has none.

### The empty state (`#empty`)

Today's dashed box, with new copy:

- "Nothing here yet" (600).
- The hint, 14 px, muted, at most 46 characters wide: "Mark it Watched to keep the date, Rating and Review here, or add a thought at any time, even before you watch." For a book: "Mark it Read to keep the date, Rating and Review here, or add a thought at any time, even before you read."

## The form

The Watched sheet's shape and rules (`log-entry-dialog/`): one shadcn `Dialog`, restyled below `md` as a bottom sheet with a `rounded-t-[28px]` top, at most 48 px from the top of the screen, its body scrolling and its footer sticky above the home indicator. From `md` it is a centred dialog, `max-w-[480px]`, 72 px from the top. It is the same form for a new Thought and for editing one.

Top to bottom:

1. **Header.** The poster or cover, 36×54 on a phone and 40×60 from `md` (or the placeholder). The eyebrow "New thought" or "Edit thought" in `text-primary-strong text-xs font-semibold`. The Media Item's title as the dialog title (20 px, 600), and under it the year and the runtime, network or author, as the Watched sheet has them. A 44 px ghost Close button (40 px from `md`).
2. **Thought.** The label "Thought" over a textarea, 15 px, `bg-background`, at least 148 px tall, growing with the text; the placeholder "What's on your mind?". Focus goes here when the form opens, with the cursor at the end of the text when editing.
   - **The counter** shows from 1,800 characters, under the textarea at the right: "1,962 / 2,000", 13 px, muted, tabular figures (`#edit`).
   - **Over 2,000** (`#too-long`): the textarea gets `border-destructive` and its ring and `aria-invalid`, the line under it reads "A thought holds up to 2,000 characters." at the left and "2,014 / 2,000" at the right, both `text-destructive`, and Save is disabled. Typing is not cut off at 2,000, so a pasted text can be shortened.
   - Whitespace alone does not count: Save stays disabled while the trimmed text is empty.
3. **Quote.** A row above a top border: "Quote" and its hint ("Words from the film / series / book, not your own"), with a switch at the right (`role="switch"`), as the Watched sheet's Rewatch. Off by default. While it is on, the textarea's text is in italics.
4. **Progress**, only for a Media Type with a Progress (a series, a book). A row above a top border:
   - **Filled in** (no hash): the label ("Episode" or "Page"), the hint "From Watching" or "From Reading", the Progress at the right ("S2 · E5", "p. 142", 17 px, 700), then **Change** (a ghost button) and **×** (a 44 px ghost icon button named "Remove the episode" or "Remove the page"). The form fills it from the In Progress when it opens a new Thought, and from the Thought when it opens one to edit; the hint shows only while the value is still the one from In Progress.
   - **Change** (`#episode`, `#page`) puts number fields in the value's place, with Done: "Season" and "Episode" for a series, "Page" for a book; 72 px wide, 44 px tall, `inputmode="numeric"`, focus on the last one. For a book the hint says how far the In Progress is ("From Reading: 142 of 272"). Done, or Enter, closes the fields; nothing is saved until Save.
   - **Removed** (`#no-page`): the label, the hint "None on this thought", and "Add episode" or "Add page" (an outline button with a plus) in the value's place, which opens the fields empty. A Media Item that is not In Progress opens the form this way.
   - A book's Progress keeps the page count it was filled in with, so its shape stays `{ page, pageCount? }`; History shows only the page ("p. 142"). A page above the page count, or a number out of range, is refused under the fields with In Progress's messages (`book-progress/`).
5. **Date.** A row above a top border: the label "Date" and three chips, **Today** (picked for a new Thought), **Yesterday** and **Other date**, as the Watched sheet's but with no "No date", since a Thought always has a date. "Other date" shows a native date input under the chips, from 1900-01-01 to today in the User's time zone, with the Log Entry date rules and messages (`logDateProblem`). Editing opens with the chip that matches the Thought's date (`#edit`).
6. **Footer.**
   - **Save**: `bg-primary`, full width and 50 px tall on a phone, 40 px beside Cancel (outline) from `md`.
   - **Delete**, when editing only: a ghost button with a trash icon in `text-destructive`, at the footer's left. It opens the confirmation over the form.

After Save, the form closes and History reloads with the Thought in its place; there is no toast, since the Thought shows at once on the page. **Saving fails** (`#failed`): the form stays open with what was typed, and "Couldn't save your thought. Please try again." (14 px, `text-destructive`, an alert icon) shows above the footer. The 501st Thought on a Media Item reads "You've kept 500 thoughts on this one, the most it can hold." in the same place.

### Delete (`#delete`)

An alert dialog over the form, as a Log Entry's (`DeleteLogEntryDialog`): "Delete this thought?" and "Your thought of {date} about {title} will be removed for good. This can't be undone.", with Cancel and Delete (`bg-destructive`). Delete removes it, closes both dialogs and reloads History.

## Copy

| Key | Text |
| --- | --- |
| History heading | History |
| Add button | Add a thought |
| Empty title | Nothing here yet |
| Empty hint (film, series) | Mark it Watched to keep the date, Rating and Review here, or add a thought at any time, even before you watch. |
| Empty hint (book) | Mark it Read to keep the date, Rating and Review here, or add a thought at any time, even before you read. |
| State labels | See the table above |
| Row icon names | Thought · Quote |
| Row menu | Actions for your thought of {date} · Edit · Delete (the Log Entry's `logEntry.edit`, `logEntry.delete`) |
| Eyebrow | New thought · Edit thought |
| Text label, placeholder | Thought · What's on your mind? |
| Too long | A thought holds up to 2,000 characters. |
| Counter | {count} / 2,000 |
| Quote, its hint | Quote · Words from the film / series / book, not your own |
| Progress labels | Episode · Page · Season (a field) |
| Progress hints | From Watching · From Reading · From Reading: {page} of {pageCount} · None on this thought |
| Progress buttons | Change · Done · Add episode · Add page · Remove the episode · Remove the page |
| Date | Date · Today · Yesterday · Other date (the Watched sheet's) · Date of the thought (the input's name) |
| Save failed | Couldn't save your thought. Please try again. |
| Limit | You've kept 500 thoughts on this one, the most it can hold. |
| Delete title, text | Delete this thought? · Your thought of {date} about {title} will be removed for good. This can't be undone. |

## Not in these mockups

- Watching now, Reading now, the Watchlist grid and the Abandon and Watched dialogs, which don't change (#240).
- The Settings text about what deleting the account removes, which gains Thoughts in #242.
- Search over Thoughts, and a list of all of them (out of scope in #240).

## Open questions

None that #242 depends on.
