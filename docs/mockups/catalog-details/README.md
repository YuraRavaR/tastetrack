# Catalog details: what a film or a book is about, on its page

**Issue:** #203 (investigation; the spec follows this folder).
**Picked:** variant A, under the title, on 2026-11-13.
**Canvas:** <https://claude.ai/artifact/V5rvj4MzVkxSLprPhm6vnD> (private). Three variants, each on a phone (a film and two books side by side) and on the web (the film):

- **A · Under the title.** The tagline, the overview cut at a few lines, then the director and cast, between the titles and the actions. The pick.
- **B · About after the actions.** Stat tiles and actions first, then an "About" section with an EN / УК switch; on the web a card beside the actions and Viewings.
- **C · Teaser and a sheet.** Only a two-line teaser card on the page; the rest opens in a bottom sheet on a phone, a centred dialog on the web.

## Why

A Media Item's page shows only its poster or cover, titles, year, runtime and genres or authors. To decide whether to put something on the Watchlist or the Reading list, the User leaves the app to read what it is about. A answers "what is it about" first, right under the title, which is the question the page is opened with; the actions move down by a few lines.

## What the sources give, and what it costs

Checked against the real APIs on 2026-11-13.

| | Film (TMDB) | Book (Open Library) |
| --- | --- | --- |
| **Shown** | Overview and tagline, English and Ukrainian; the director(s); the first 5 cast members | The work's description, as it comes |
| **Where from** | The details call we already make: `overview`, `tagline`; the Ukrainian ones in the `translations` it already appends; `credits` added to `append_to_response` | `description` from search, a third call: search answers 500 whenever `description` and `editions` are both in `fields`, and the two calls we make need `editions` for the titles |
| **Extra subrequests** | None | One per book: `refreshCost` 2 → 3, so the cron refreshes 13 books a run instead of 20, and a page that fills 10 books makes 30 |
| **Not shown** | The rest of the cast and crew | `first_sentence` (from a random edition: Greek for Harry Potter, Catalan for 1984) and `subjects` (108 for Harry Potter, with typos and "Miniature books") |
| **Coverage** | Almost every film has an English overview; all 4 checked had a Ukrainian one too | About half the works have a description; its language is whatever someone typed: Voroshilovgrad's is in Russian |

Everything is kept in the catalog cache's `extra`, refreshed with it (ADR-0004, ADR-0011): no fetch on page view, no migration, no more D1 rows written. A row filled before this ships has none of it until the cron refreshes it, within 7 days.

**Terms.** TMDB's licence covers text as TMDB Content, with the attribution the app already shows, cached for at most 6 months (we keep 90 days); it forbids derivatives, so the overview is shown unedited (cutting it visually with More is fine). Open Library asserts no rights over its data; the existing credit covers it.

## Files

| File | Shows |
| --- | --- |
| `catalog-details.html` | Amélie, not watched yet: tagline, overview cut, More · Українською, director and cast |
| `catalog-details-book.html` | Harry Potter, not read yet: the description cut, More, no tagline, credits or language switch |
| `*-390-*.png`, `*-1440-*.png` | Both pages on a phone and on the desktop, light and dark |
| `canvas/` | All three variants. `Main.dc.html` is A on a phone (Amélie, Harry Potter, Voroshilovgrad), `AWeb.dc.html` A on the web; More and the language switch work in Play there. Images are canvas uploads (`/_blob/…`), so they show only on the canvas. |

## Layout

The page keeps `film-banner/`'s banner and `books/`'s book page; one block, **About**, goes between the poster row and the stat tiles (or the actions, when there are no tiles). Top to bottom inside it:

| | Phone (below `sm`) | From `sm` |
| --- | --- | --- |
| **Tagline** (films; none when empty) | 15 px, italic, 500 | 17 px |
| **Overview / description** | 15 px, line height 1.5, cut at **4 lines** | 16 px, 1.55, cut at **3 lines**, at most 680 px wide |
| **Links row** | **More** / **Less**, then for a film with a Ukrainian overview **· Українською** / **In English**; "From TMDB" or "From Open Library" on the right, 12 px muted. Links are `text-primary-strong`, 14 px 600, 44 px tall. | 15 px; the source 13 px |
| **Credits** (films) | A two-column list: **Director** and **Cast** in muted, names after; 14 px | 15 px |

- **More** shows only when the text is longer than the cut, measured as `components/NoteBubble.tsx` does it; Less cuts it again. While cut, paragraph breaks become spaces, so the cut never ends on an empty line; More shows the paragraphs.
- **Language.** English first. Українською swaps the tagline and the overview for TMDB's Ukrainian ones, and is shown only when a Ukrainian overview exists; a film with only a Ukrainian overview shows it with no switch. The choice is not remembered.
- **Director** lists every crew member with the job Director ("Directors" when more than one). **Cast** is the first 5 in TMDB's order. Either row is left out when empty.
- **Nothing to show.** A book with no description, a film with no overview and no credits, a Manual Media Item and an entry filled from a search result alone show no About block at all, and no empty box.
- **Books** get no tagline, credits or language switch. A description is shown as is, whatever its language; `\r\n` becomes a paragraph break, and nothing is rewritten.

## Open questions

- Should a Manual Media Item get an overview the User writes? Left out of #203; a separate issue if wanted.
- Open Library descriptions can carry Markdown links (`[source][1]` and a link list at the end). Shown as plain text, or with the link list cut off? To settle in the spec.
