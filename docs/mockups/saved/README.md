# Saved, Collections and Search: the redesign

**Issue:** none yet.
**Picked:** Saved from variant A, "tiles and chips" (2026-11-07). The decisions below were settled in a grilling the same day, before the canvas. Collections and Search are not drawn yet.
**Canvas:** <https://claude.ai/artifact/Umnyu6eb1GPsZhPwS1KPAn> (private). One variant a row, each on an iPhone 17 Pro (402×874) and on the web: A tiles and chips, B shelves with a sort-and-filter sheet, C square 2×2 tiles with icon menus.
**Inspiration:** the media tracker Sequel, for its patterns: a library split by Media Type and status, collections, and a search that finds your own things first. Nothing is copied one to one. Colours and type stay Gold · Paper with Gold · Cinema type ([`accent/`](../accent/)); Liquid Glass is not taken.

This replaces the section navigation of [`navigation/`](../navigation/) (Home · Log · Up next · Lists) and the old home with its "Latest in your Log" and "Up next" blocks.

## Files

| File | Shows |
| --- | --- |
| `saved-a.html` | Saved at any width: the categories with no hash, the Films Watchlist at `#watchlist`, Watched at `#watched`. The Films tile, the tabs, the sort and filter chips and Back work. Posters are coloured placeholders. |
| `saved-a-390-light.png`, `-390-dark.png`, `-1440-light.png`, `-1440-dark.png` | The categories |
| `saved-a-390-watchlist-light.png`, `-dark`, `-1440-…` | The Films Watchlist; Parasite carries the "watched before" mark |
| `saved-a-390-watched-light.png`, `-dark`, `-1440-…` | Watched, with the Rating under each poster and the Rating chip |
| `canvas/` | All three variants as canvas sources. `Main.dc.html` and `AWeb.dc.html` are variant A. |

## Variant A, as picked

- **Category tile.** A card per Media Type: its icon on `bg-primary-soft`, the name, "12 to watch · 14 watched", and a fan of three covers from the Backlog on the right. Two cards side by side from `md`, stacked on a phone.
- **Books stub.** The same card with a dashed border, muted, disabled, and a "Coming soon" badge.
- **Media Type page.** On a phone "‹ Saved" above the heading; from `md` a breadcrumb "Saved › Films" instead.
- **Tabs.** A segmented control, Watchlist and Watched, each with its count. Full width on a phone; from `md` it sits left and the chips sit right on the same row.
- **Chips.** Sort first, with a sort icon and the current order ("Date added"), then Genre and Decade, and on Watched also Rating. Each chip opens a menu of single choices with a check on the current one, "Any genre" and the like first. A chip with a filter set is on `bg-primary-soft` with a `primary-strong` border. On a phone the chips scroll sideways.
- **Grid.** 3 a row on a phone, as many 150 px columns as fit from `md`. Under each poster the title (two lines at most) and, on the Watchlist, the year; on Watched a star and the Current Rating.
- **Watched before.** A Watchlist poster of a film the User has watched carries a small `bg-primary` circle with a check in its top right corner, labelled "Watched before".
- **No match.** "No films match these filters." and a "Clear filters" button.

## Words

The domain terms stay; these are UI words in `en.ts` (GLOSSARY):

| Domain term | UI word |
| --- | --- |
| Library | Saved |
| List | Collection |
| Backlog (films) | Watchlist |
| Media Items with at least one Log Entry (films) | Watched |

## Navigation

Three sections: **Saved · Collections · Search**. On a phone they sit in the bottom tab bar, each with an icon and a label; from `md` they are text links in the header. The account menu on the avatar (Invites, Settings, Log out) is unchanged.

The Log page leaves the navigation. Every Log Entry of a film stays on its page, under Viewings.

## Media Types

Each section has a category picker: **Films** and **Books**. Books is shown now as a disabled stub labelled "Coming soon", so the design is built for several Media Types from the start. Music and Games are not shown until each has an ADR choosing its External Source (and games a glossary entry).

This overrides the rule in [`navigation/`](../navigation/) that the type UI appears only once a second Media Type ships.

## Saved

1. **`/`: the categories.** One tile per Media Type, with a collage of a few covers and a count ("Films · 42 saved"). Books is the stub. Tapping Saved in the tab bar again comes back here.
2. **`/saved/films/watchlist` and `/saved/films/watched`.** Tapping a tile opens its Watchlist; Watchlist and Watched are tabs.
3. **Grid of posters.** 3 a row on a phone, 5–6 on a desktop, the title under each poster. No list view.
4. **Watched** shows each Media Item once, with its Current Rating, however many Log Entries it has.
5. **A film in both tabs.** Logging a film takes it off the Backlog, but it can be planned again for a rewatch. Then it shows in both: on the Watchlist with a small "watched" mark on its poster, and in Watched with its Rating.
6. **Sort and filters** sit above the grid, and are kept in the URL so Back returns to them.

   | Tab | Sort (default first) | Filters |
   | --- | --- | --- |
   | Watchlist | Date added, Title, Release year | Genre, decade |
   | Watched | Last watched, Rating, Title, Release year | Genre, decade, Rating |

   The chosen sort is remembered per Media Type and tab in the browser.

## Collections

- A grid of cards: a 2×2 collage of the first posters, the name, the count and the Media Type's icon.
- The same category picker on top, Books as the stub.
- "New collection" in the heading.
- One Collection's page keeps what it does today, laid out as a grid of posters.

## Search

- One field, the category chips under it (Films · Books, Books disabled).
- Results in two blocks: **In your Saved** (the User's Library and Lists) first, then **From TMDB**.
- Each row as picked in [`search-results/`](../search-results/) and its revision (#82): the status button, Watched again, the list icon with the List names.

## The same on every screen

The user picked variant A on every redesign canvas (2026-11-07) and asked for one style and one set of words everywhere:

- **Words.** "Collection" and "Collections" in all UI copy, never "list"; the action is "Add to collection"; "New collection". Existing strings in `en.ts` that say "list" change with the screens that show them.
- **Colours.** Only the theme tokens in `src/client/styles.css`. Deletes and errors use `destructive`. No new tokens for these screens.
- **Logged-out frame.** The app name, and a "Log in" link on the right where it helps (a Share Link page). This loosens the rule in [`navigation/`](../navigation/), "the app name alone".
- **Dialogs.** A bottom sheet on a phone, a centred dialog from `md`, as [`log-entry-dialog/`](../log-entry-dialog/).

## Unchanged

The film's page ([`film-page/`](../film-page/), with Viewings and the action block), the Watched dialog, a Share Link page, login and register.

## Next

Every screen of the redesign has a picked variant; see the table in [`../README.md`](../README.md). The open questions in every folder were settled on 2026-11-08 (each README's "Settled" section). Next: the spec.

## Later, as separate issues

After the redesign's issues ship:

- **A new logo** for the app name and its mark.
- **Polish:** the page title in the browser tab per page, the favicon, and the page metadata (description, the preview a shared link shows).
