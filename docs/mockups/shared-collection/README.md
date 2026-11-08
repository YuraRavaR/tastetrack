# Shared Collection: the public page a Share Link opens

**Issue:** none yet.
**Picked:** variant A, "Poster grid" (2026-11-07).
**Canvas:** <https://claude.ai/artifact/XExh1Bjw4owwPn7hB92pFJ> (private). One variant a row, each on an iPhone 17 Pro (402×874) and on the web: A poster grid, B editorial list, C hero and grid.

The page is drawn as a visitor sees it, logged out. A Share Link has the form `https://tastetrack.example/s/…`.

## Files

| File | Shows |
| --- | --- |
| `shared-collection-a.html` | The page at any width: the Collection with no hash, a link that no longer works at `#notshared`. More / Less on long Notes works. Posters are coloured placeholders. |
| `shared-collection-a-390-light.png`, `-390-dark.png`, `-1440-light.png`, `-1440-dark.png` | "Slow cinema" by Yurii, 10 films |
| `shared-collection-a-390-notshared-light.png`, `-dark`, `-1440-…` | "This Collection isn't shared any more" |
| `canvas/` | All three variants as canvas sources. `Main.dc.html` and `AWeb.dc.html` are variant A. |

## Variant A, as picked

- **Frame.** Logged out: the app name on the left, a "Log in" text link in `primary-strong` on the right. No tab bar and no section nav. The footer "Film data from TMDB · v0.6.0" shows at every width, the phone included.
- **Heading block.** Top to bottom: a small muted label with the Collections icon, "Film collection"; the Collection's name as the page heading ("Slow cinema"); its description in body text; then the owner, the initial "Y" in a `bg-primary-soft` circle and "Shared by Yurii · 10 films" in muted text. From `md` the block is at most 40rem wide.
- **Grid.** The films in the Collection's order, as an ordered list. 2 a row on a phone; from `md`, as many 176 px columns as fit (5 at 1440 px).
- **Each film.** The poster, with its place in the Collection (1, 2, 3 …) in a small dark circle in its top left corner; under it the title (two lines at most) and the year.
- **Note.** When the film has a Note, it sits under the title in a `bg-muted` bubble with a small tail pointing up at the poster. A Note longer than three lines is cut at three, with "More" under it; the whole bubble is a button, and it opens to the full Note with "Less". Short Notes have no button. Films without a Note show nothing there.
- **No "Log in" card.** The canvas ended the page with a "Have a TasteTrack account? Log in" card. It is dropped: the header link does that job on every screen.
- **Not shared any more** (`#notshared`). When the Share Link was turned off or replaced. In the middle of the page: an art of two dashed poster outlines behind a muted card with a broken-link icon; the heading "This Collection isn't shared any more"; the text "Its owner may have stopped sharing it or made a new link. Ask the person who sent it to you for the new one."; an outline button "Log in to TasteTrack".
- **Words.** "Collection", never "list", in all copy, as in [`saved/`](../saved/).

## Settled

Settled in a grilling on 2026-11-08. Where the mockup differs, this section wins.

- **Visitors without an account.** Under the grid: "Want your own? Ask someone on TasteTrack for an invite." On the not-shared page that line replaces the "Log in to TasteTrack" button, which repeated the header link.
- **Posters** are not links for a logged-out visitor.
- **A logged-in viewer** sees the same page with the normal header, avatar and tab bar. No actions on the films yet.
- **Words** as drawn: "Film collection", the owner's initial in a circle, "Yurii's note" for screen readers.
- **More** appears past three lines at the current width, so it may differ between a phone and the web.
- **Share Link URL.** Built from the app's own origin and `/s/:token`; `tastetrack.example` is a stand-in.
