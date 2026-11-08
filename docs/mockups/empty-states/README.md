# Empty states

**Issue:** none yet.
**Picked:** variant A, "Quiet" (2026-11-07).
**Canvas:** <https://claude.ai/artifact/C1ZP67AvtcANWFpM9Hdadw> (private). One variant a row, each on an iPhone 17 Pro (402×874) and on the web: A quiet, B illustrated, C guided first run.

The empty versions of the redesign's screens ([`saved/`](../saved/), [`collections/`](../collections/), [`search/`](../search/)). Everything around the empty part stays as those folders draw it.

## Files

| File | Shows |
| --- | --- |
| `empty-states-a.html` | All five states at any width. No hash: a new User's Saved. `#watchlistEmpty`, `#watchedEmpty`, `#noCollections`, `#searchNoMatch` open the others. The tabs, the header and tab bar links, "Find a film", "Go to Watchlist", the New collection dialog and the search field work. Search with an empty field shows the hint line. Posters are coloured placeholders. |
| `empty-states-a-390-light.png`, `-390-dark.png`, `-1440-light.png`, `-1440-dark.png` | A new User's Saved |
| `empty-states-a-390-watchlistEmpty-light.png`, `-dark`, `-1440-…` | Films, the Watchlist empty, Watched has films |
| `empty-states-a-390-watchedEmpty-light.png`, `-dark`, `-1440-…` | Films, Watched empty, the Watchlist has films |
| `empty-states-a-390-noCollections-light.png`, `-dark`, `-1440-…` | Collections, none yet |
| `empty-states-a-390-searchNoMatch-light.png`, `-dark`, `-1440-…` | Search with no match |
| `canvas/` | All three variants as canvas sources. `Main.dc.html` and `AWeb.dc.html` are variant A. |

## Variant A, as picked

**The pattern.** Every empty state is the same three things, centred: an icon in a circle on `bg-primary-soft` in `primary-strong` (56 px on a phone, 64 px from `md`), one line of text in `foreground`, and one button. Nothing else: no headline, no illustration, no second line. The block sits about 72 px under the controls above it on a phone and 96 px from `md`.

**Primary button.** `bg-primary`, `primary-foreground` text, 48 px high on a phone and 44 px from `md`, `rounded-xl`. "Add manually" is the only outline button (a pill with a border on `bg-card`).

**A new User's Saved** (no hash: no Watchlist, no Watched):
- "Saved" heading, then the Films tile and the Books stub, as in [`saved/`](../saved/).
- The Films tile is a card, not a link. Left: the Films icon on `bg-primary-soft`, then "Films" and "Nothing saved yet." in `muted-foreground`. Right: three empty poster slots fanned like the covers of a full tile, the side ones with a dashed `border` outline, the middle one with a dashed `muted-foreground` outline on `bg-background` and a plus in it.
- "Find a film" with a search icon opens Search with an empty field. On a phone it runs the full width of the card under the slots; from `md` it sits under the text, left, and the slots fill the right.
- The Books stub is unchanged: dashed, muted, "Coming soon".

**Films, Watchlist empty** (`#watchlistEmpty`):
- "‹ Saved" and "Films" (breadcrumb from `md`), the tabs with their counts ("Watchlist 0", "Watched 9").
- The sort and filter chips are hidden while the tab is empty.
- Bookmark icon, "Nothing on your Watchlist yet.", "Find a film" (opens Search).

**Films, Watched empty** (`#watchedEmpty`):
- Same frame, the Watched tab picked ("Watched 0").
- Eye icon, "Films you mark Watched show up here.", "Go to Watchlist" (switches to the Watchlist tab).
- With nothing watched, no Watchlist poster carries the "Watched before" mark.

**Collections, none yet** (`#noCollections`):
- "Collections" heading with the outline "+ New collection" on the right, the Films · Books chips under it, as in [`collections/`](../collections/).
- Grid icon, "No collections yet.", "New collection".
- Both buttons open the New collection dialog: "New collection", "Collect films around a theme, in the order you choose.", Name (placeholder "Rainy Sunday films"), Description "Optional", Cancel and Create. A bottom sheet on a phone, a centred dialog from `md`, as [`log-entry-dialog/`](../log-entry-dialog/). Esc and the scrim (`overlay`) close it.

**Search, no match** (`#searchNoMatch`):
- The field (placeholder "Title in English or Ukrainian") with a clear button, the Films · Books chips. From `md` a "Search" heading above it and the column is 44rem wide; on a phone the label is visually hidden.
- Search-with-a-cross icon, "No films found for “Grand Budapest Hotle”." (the query in curly quotes), and the outline "Add manually", which opens today's "Add a film manually" dialog.
- With an empty field, instead: "Type a title to search your Saved and TMDB." in `muted-foreground`, no icon and no button.

**Words** (new strings for `en.ts`): "Nothing saved yet.", "Find a film", "Nothing on your Watchlist yet.", "Films you mark Watched show up here.", "Go to Watchlist", "No collections yet.", "No films found for “{query}”.", "Type a title to search your Saved and TMDB.", "Collect films around a theme, in the order you choose." They replace `backlog.empty`, `log.empty`, `lists.empty`, `filmLists.empty` and `search.none` where those screens change.

## Open questions

1. **A new User's Films tile.** Should it open the Films page with its empty tabs, or stay inert with only "Find a film" as drawn?
2. **Search with an empty field.** Should it show the hint line "Type a title to search your Saved and TMDB.", or nothing under the chips?
3. **Creating a Collection from the empty state.** After Create, should the new Collection open, or should the User stay on Collections with one card?
4. **The dialog's shape.** The canvas drew the sheet with a 22 px top radius and the web dialog 28rem wide and 160 px from the top; the static page follows [`log-entry-dialog/`](../log-entry-dialog/) instead (28 px, 480 px, 72 px). Confirm that the log-entry dialog's shape wins.
5. **An empty Collection and an empty Share Link page.** Not drawn here; do they take the same pattern (`list.empty`, `shared.empty`)?
