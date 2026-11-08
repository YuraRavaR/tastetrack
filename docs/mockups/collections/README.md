# Collections

**Issue:** none yet.
**Picked:** variant A, "Collage cards" (2026-11-07).
**Canvas:** <https://claude.ai/artifact/TuLaQunVUSQKwtVD3Ygo9V> (private). One variant a row, each on an iPhone 17 Pro (402×874) and on the web: A collage cards, B wide rows, C stacked posters.

Part of the redesign in [`saved/`](../saved/): the Collections section of Saved · Collections · Search. A List is called a "Collection" in all UI copy.

## Files

| File | Shows |
| --- | --- |
| `collections-a.html` | Collections at any width. The grid with no hash, one Collection at `#collection`, Reorder films at `#reorder`, the New collection dialog at `#new`, the Share Link dialog at `#share`. Cards, Back, both ⋯ menus, the Note dialog, the forms, Share and Undo work. Posters are coloured placeholders; the add-films search is not wired. |
| `collections-a-390-light.png`, `-390-dark.png`, `-1440-light.png`, `-1440-dark.png` | The Collections grid |
| `collections-a-390-collection-light.png`, `-dark`, `-1440-…` | Slow cinema: the poster grid with a Note under some posters |
| `collections-a-390-reorder-light.png`, `-dark`, `-1440-…` | Slow cinema in Reorder films mode |
| `collections-a-390-new-light.png`, `-dark`, `-1440-…` | The New collection dialog over the grid |
| `collections-a-390-share-light.png`, `-dark`, `-1440-…` | Watch with Mum, already shared, with the Share Link dialog open |
| `canvas/` | All three variants as canvas sources. `Main.dc.html` and `AWeb.dc.html` are variant A. |

## Variant A, as picked

### The Collections grid (`/collections`)

- **Heading row.** "Collections" on the left, the primary pill button "+ New collection" on the right.
- **Category picker.** A radio group labelled "Media Type": the Films chip, picked, with the number of Collections ("Films 6"); then Books, disabled, with a dashed border and a "Coming soon" badge. A picked chip is `bg-primary-soft` with a `primary-strong` border, as on Saved.
- **Cards.** 2 a row on a phone; from `md`, as many 200 px columns as fit. Each card is one button:
  - A square 2×2 collage of the first four posters, in Collection order. An empty cell is `bg-muted`. Rounded corners, a light shadow, a stronger shadow on hover.
  - The name (two lines at most).
  - The Films icon (labelled "Films"), the count ("8 films", "1 film") and, when shared, "· [link icon] Shared" on a phone, "Shared by link" from `md`.
- **No Collections.** "You have no Collections yet. Make one to collect films around a theme." (today's `lists.empty`, reworded).

### One Collection (`/collections/:id`)

- **Top.** On a phone: "‹ Collections" on the left and a round ⋯ button ("Collection actions") on the right, then the name as the heading. From `md`: the breadcrumb "Collections › Slow cinema" above the heading, and the add-films search and the ⋯ button on the right of the heading.
- **Under the heading.** The Description, if there is one, then "8 films", and "· Shared by link" when shared.
- **Add films.** A search field, "Search films to add", full width under the heading on a phone, 280 px wide from `md`. Hidden while reordering.
- **Header ⋯ menu.** Every Collection action lives here: Edit collection, Reorder films (disabled under 2 films), Share (or "Share Link" once shared), a divider, Delete collection in `destructive`.
- **Poster grid.** 3 a row on a phone, 150 px columns from `md`, as on Saved. On each poster:
  - its position in the top left, a small round badge ("1", "2" …) on `overlay`;
  - its own ⋯ ("More for Perfect Days (2023)") in the top right.
  - Under the poster: the title (two lines at most), the year, and the Note if there is one.
- **Note under the poster.** Above a top border, a speech-bubble icon and the Note in italic `muted-foreground`, three lines at most. Tapping it opens the Note dialog.
- **Poster ⋯.** A bottom sheet on a phone, with the poster, the title and "2023 · number 1 in Slow cinema" on top; a dropdown menu from `md`. Both hold: Add a Note / Edit Note, Move to top (disabled on the first film), Remove from collection (`destructive`).
- **After Remove.** A muted bar "Removed Aftersun (2022) from this Collection." with an Undo button. No confirmation.
- **Empty Collection.** A dashed box with the Films icon and "This Collection is empty. Search for films to add to it."

### Reorder films

- Started from the header ⋯ menu. A sticky bar on `bg-primary-soft` with a `primary-strong` border: "Use the arrows on each poster to move it earlier or later, or to the top." and a "Done" pill.
- Each poster gets an `overlay` scrim and a 2 px `primary` outline. Its own title is hidden. Three 44×44 buttons: Move to top (top right), Move earlier (‹, bottom left), Move later (›, bottom right). They are named "Move Perfect Days to top", "… earlier", "… later", and are disabled at the ends.
- The add-films search and the poster ⋯ buttons are hidden while reordering. Each move saves at once.

### Dialogs

All are a bottom sheet on a phone and a centred dialog (480 px, 520 px for Share, 72 px from the top) from `md`, as [`log-entry-dialog/`](../log-entry-dialog/): a Close button at every width, no grabber, Esc closes. On a phone Cancel and the main button share a row; from `md` they sit right.

- **New collection.** Title "New collection", text "Collect films around a theme, in the order you choose.". Fields: Name; Media Type (Films picked, Books disabled with "Coming soon"); Description, marked "Optional". Buttons Cancel and Create. Errors under Name in `destructive`: "Give the Collection a name." and "You already have a Collection with this name.". Create opens the new, empty Collection.
- **Edit collection.** The same form without Media Type. Text "Change the Collection's name or description.". Button Save.
- **Note.** Title "Note for Perfect Days (2023)", text "Why it's here, or anything to remember about it.", a 4-row "Note" textarea, hint "Optional. Leave it empty to remove the Note.". Cancel and Save.
- **Share, not shared yet.** Title "Share Slow cinema", today's explanation (`share.explanation`), and one primary "Share" button that makes the link.
- **Share, shared.** Title "Shared by link", the same explanation, the read-only Share Link (`https://tastetrack.example/s/…`) with "Copy link" (then "Copied"), and "New link" and "Stop sharing" (`destructive` text). Each of the last two asks first, inside the dialog: "Make a new link?" / "Stop sharing?" with today's texts, Cancel, and "Make a new link" (primary) or "Stop sharing" (`destructive`).
- **Delete.** Title "Delete Slow cinema?", text "The Collection and its Notes will be deleted for good. Your Log stays as it is. This can't be undone.". Cancel and Delete (`destructive`). Back to the grid after.

### Words

- Buttons and headings are sentence case: "New collection", "Edit collection", "Delete collection", "Reorder films", "Remove from collection". The canvas said "Remove from this Collection"; it was shortened to match.
- In running text the domain word keeps its capital, as `en.ts` does today: "This Collection is empty.", "Removed … from this Collection.".
- The phone canvas showed Delete as a centred alert; the mockup makes it a bottom sheet, to follow the rule for every dialog.

## Settled

Settled in a grilling on 2026-11-08. Where the mockup differs, this section wins.

- **Description.** Kept, optional, as today.
- **Adding films.** "Add films" opens a sheet with the search and an "In this Collection" mark, like the film page's "Add to collection". There is no search field on the Collection's page.
- **Reorder.** In the grid the arrows point left and right and are named "Move earlier" and "Move later"; the `en.ts` keys are renamed to match.
- **Position.** "Move to top" puts the film at position 1. A new film goes to the end.
- **Card meta.** "Shared" on a phone, "Shared by link" from `md`.
- **Category chip.** No count on the Films chip; the cards carry the counts.
- **Share Link URL.** Built from the app's own origin and `/s/:token`; `tastetrack.example` in the mockup is a stand-in.
