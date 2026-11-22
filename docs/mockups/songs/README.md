# Songs: six Media Types, Search, the Collection picker and a song's page

**Issue:** #281, part of the songs spec #279 (ADR-0013, "Songs"). #283 (the songs UI) is built and checked against this folder.
**Picked:** on 2026-11-22, in one canvas round.

| Screen | Pick |
| --- | --- |
| Media Type chips | A: today's segmented control with six segments |
| Search row | A: one muted line, artist · year · album, then the labelled button |
| Songs the User already keeps | 1: today's strip, headed "In your Collections" |
| Collection picker | A: today's dialog with checkboxes, New collection as the last row |
| A song's page, phone | C: the cover the full width, fading into the page, no blur |
| A song's page, web (from `sm`) | B: the cover centred over its blurred copy |
| Its Collections, on the page | Rows with a cover and a count |
| No cover | 1: a quiet note on muted |
| A Collection of songs | A: today's grid, the artist under each title |

**Canvas:** <https://claude.ai/artifact/RABfpBupZrL7k8YzhD1bZK> (private). One page, **Round 1 · Song screens**:

- The chips: **A** six equal segments (the pick); **B** two rows of three; **C** a scrolling row of pills.
- A Search row: **A** one line and a labelled button (the pick); **B** the artist on its own line; **C** dense, one cut line.
- Kept songs in Search: **1** a strip first (the pick); **2** left in the results, with their Collections under them.
- The picker: **A** today's dialog (the pick); **B** a sheet of rows with covers; **C** the last used in one tap.
- A song's page: **A** the blurred banner, cover at the left; **B** the cover centred (the pick on the web); **C** the cover full width (the pick on a phone). Its Collections: **rows** (the pick) or badges. The canvas's drawing of B has badges; the pick is B with rows.
- No cover: **1** a quiet note (the pick); **2** a note in a gold frame; **3** typeset with a small note.
- A Collection: **A** today's grid (the pick); **B** numbered rows.

The songs, artists, years, albums and disambiguations are real MusicBrainz data from 2026-11-22, run through ADR-0013's rules, with the Cover Art Archive's covers. Collections, Notes and the song added by hand ("Пісня з гаража") are demo content.

## Why these

What each pick brings:

- **Chips A** is today's control. "Albums", the widest label, is 47.8 px at 13 px in a 56.7 px segment on a 390 px phone.
- **Row A** reads as an album's row, with room for the one button's label, since a song has no other button.
- **The strip** keeps Search's order for every Media Type: the User's own first. Songs are never in Saved, so its heading names Collections.
- **Picker A** is the dialog every Media Type already uses, so nothing new to learn.
- **Page C on a phone** is the album page as shipped. **B on the web** centres the cover, the facts and the one action, as a song's page has little else. The rows show which Collection is which and how big it is.
- **No cover 1** is quiet, on `bg-muted` as a film's placeholder is, and the note says it is a song.
- **The grid** needs no second layout, here or on a Share Link's page.

## Files

| File | Shows |
| --- | --- |
| `songs-search.html` | Search on Songs. No hash: "обійми", two kept songs and five of 45 results. `#versions` "Шум Go_A", with a disambiguation; `#long` long titles, two artists, rows without a cover and a kept song without one; `#empty` nothing typed; `#nomatch` "Стефанія", nothing found; `#busy` MusicBrainz answered 503 twice. |
| `songs-picker.html` | The picker over Search. No hash: four Collections, none ticked yet; `#none` no Collection of songs yet; `#new` New collection inside it; `#made` the new one first and ticked; `#taken` the name is an albums Collection's. |
| `songs-page.html` | A song's page. No hash: Обійми, in two Collections; `#disambiguation` Stefania; `#not-kept` in no Collection; `#no-cover` a long title without a cover; `#manual` a song added by hand. |
| `songs-collection.html` | A Collection of songs, with Notes, long credits and a song without a cover; `#empty` an empty one. |
| `songs-collections.html` | Collections on Songs; `#empty` none yet. |
| `songs-covers.html` | Reference: the note at every size, and the chips at 390 and 320 px. |
| `<page>-<390\|1440>-<light\|dark>.png` | Each page as it opens. |
| `<page>-<390\|1440>-<state>-<light\|dark>.png` | Each `#state` above. |
| `canvas/` | The round as canvas sources, all variants included, its state boards redrawn to the picks. Images are canvas uploads (`/_blob/…`), so they show only on the canvas. |

The static pages load covers from `coverartarchive.org` by release-group MBID, as the app will, so they need a network connection. Only what songs add is drawn: adding a song by hand, the Note and reorder controls, "Add songs" and a Share Link's page follow albums (`albums/`, `collections/`, `shared-collection/`) with the song words. Saved keeps its five tiles.

## Media Type chips

- Six equal segments, in ADR-0005's order: Films, Books, Series, Games, Albums, Songs, in Search and in Collections. 56 px tall, the icon (18 px) over the label (13 px). **Below 360 px the label is 12 px.**
- **The Songs icon** is Lucide's `music`, in the chips, the empty states, a Collection's card and the placeholder.

## Search on Songs

- **Field:** "Song and artist". Empty (`#empty`): "Type a song and its artist to search your Collections and MusicBrainz."
- **In your Collections** first: the strip of square covers (120 px on a phone, from `md` a grid of at least 120 px), each with the title, the artist and the oldest Collection holding it. A song shown here isn't repeated below.
- **From MusicBrainz**, with the count, one card of rows. Each row:
  - the square cover (72 px, 56 px from `md`);
  - the title, wrapped, never cut;
  - one muted line, **"artist · year · from album"**, wrapped, a missing part left out with its dot;
  - the disambiguation under it, 12 px, italic, muted;
  - **Add to collection**, outline, with its label and `list-plus`: 44 px tall under the words on a phone, 36 px at the right from `md`. No Planned bookmark and no Mark listened.
  - The whole row opens the song's page.
- **Nothing found** (`#nomatch`): the empty state with the note, "No songs found for “Стефанія”.", "Try adding the artist: MusicBrainz finds a song best by its title and artist together.", then Add manually.
- **Busy** (`#busy`): the album's empty state with a clock and Try again, the hint naming Collections in place of Saved.
- **The credit** in the footer: "Music data from MusicBrainz."

## The Collection picker

- **Today's dialog**, centred at every width (at most 512 px, 24 px padding, a 14 px radius): "Collections for Шум (2021)", "Tick a Collection to add the song, untick it to take the song off.", the checkboxes, then Done.
- **What changes in it:** the order, the rows' height, the checkbox's size (16 px today), New collection and the none-yet form, where today a link leads to Collections. They are drawn for songs; #279 asks nothing of the other Media Types' picker.
- **Only Collections of songs, the last used first.** The order is taken as the dialog opens and doesn't move as the User ticks. Each row is at least 48 px tall and all of it toggles; the checkbox is 20 px.
- **New collection** is the last row, under the scrolling list, so it shows however many Collections there are. It turns the dialog into "New collection" (`#new`): a back arrow, the Name field and **Create and add**. That makes the Collection, adds the song and returns to the list, with the new one first and ticked (`#made`).
- **None yet** (`#none`): the form at once, under "You have no Collections of songs yet. Make one, and this song goes into it."
- **A name that is taken** (`#taken`): the error under the field, in `destructive`. A name is unique across all Media Types, so it says which type has it: "You already have a Collection of albums with this name."

## A song's page

- **On a phone** (below `sm`, C): as an album's. The cover the full width, sharp, its bottom 30% fading into the page; the title (26 px) over the fade by 36 px, then the facts and the link, all at the left. Add to collection is the full width, 48 px.
- **From `sm`** (B): the album page's blurred banner (16:9, `blur(36px)`, `saturate(1.3)`), with everything centred:
  - the cover (176 px, 14 px radius, a shadow) pulled up over the banner by 32.25% of the column's width (310 px at 960 px);
  - 14 px under it the title (34 px, at most 720 px wide, balanced), the facts and the link;
  - Add to collection (40 px tall, as wide as its label);
  - "In your Collections", its rows at most 560 px wide.
- **Facts:** "year · artist credit · from album", the album as text, not a link. The disambiguation under them, 13 px, italic.
- **On MusicBrainz:** to `https://musicbrainz.org/recording/<MBID>` in a new tab.
- **In your Collections:** one card of rows, each at least 68 px: the Collection's first cover (48 px), its name, its count and a chevron; a row opens the Collection. None (`#not-kept`): "Not in any of your Collections yet." in a dashed box.
- **No cover** (`#no-cover`): no picture. On a phone the 136 px placeholder at the left and the title (21 px) beside it; from `sm` the 176 px placeholder centred.
- **Added by hand** (`#manual`): no link, the year only when given, and "You added this song manually. Only you can see it." with Edit song and Delete song under the Collections.
- **No section is marked** in the header or the tab bar, as on every Media Item's page.
- **No History, Thoughts, About, stat tiles, Planned or Listened.**

## A song without a cover

Lucide `music` in `text-muted-foreground` on `bg-muted`, with `border-border` (none inside a collage): no gold, no frame, no type and no caption. Icon sizes: 22 px in 48 and 56 px, 26 px in 72 px and a collage, 40 px in a grid and the strip, 48 px at 136 px, 56 px at 176 px. `role="img"`, named "No cover". A cover that doesn't load counts as none, as for albums.

## A Collection of songs

- **The grid** as for albums: three columns on a phone, `auto-fill` of at least 150 px from `md`. Each cell has the place, the ⋯ menu, the square cover, the title in two lines, the artist in one and the Note under them.
- **Empty:** the note, "This Collection is empty.", Add songs.
- **Collections on Songs:** today's collage cards. None yet: "Gather songs into Collections, like Favourite songs or For the road" and New collection.

## Copy

The catalogue's case is kept: "Add to collection" and "New collection", where #279 writes "Add to Collection" and "New Collection".

| Where | Text |
| --- | --- |
| Chips | Films · Books · Series · Games · Albums · Songs |
| Search | Song and artist · Type a song and its artist to search your Collections and MusicBrainz. · In your Collections · From MusicBrainz · from {album} · Add to collection · No songs found for “{query}”. · Try adding the artist: MusicBrainz finds a song best by its title and artist together. · MusicBrainz is busy, try again in a moment. · Nothing in your Collections matches “{query}”. · Try again |
| Picker | Collections for {song} · Tick a Collection to add the song, untick it to take the song off. · New collection · Back to your Collections · Name · Favourite songs (placeholder) · Create and add · Done · You have no Collections of songs yet. Make one, and this song goes into it. · You already have a Collection of {type} with this name. |
| A song's page | On MusicBrainz · Add to collection · In your Collections · Not in any of your Collections yet. · You added this song manually. Only you can see it. · Edit song · Delete song · No cover |
| Collections | {n} songs · Add songs · This Collection is empty. · Gather songs into Collections, like Favourite songs or For the road |
| Credit | Music data from MusicBrainz. |

## Where the picks differ from #279

- **The banner.** #279 has "the square cover over its blurred copy (the album page's banner)". On a phone the pick has no blur, as the shipped album page. On the web it keeps the album's banner and centres the cover, where an album's is at the left.
- **One tap.** #279's story 13 wants the usual choice in one tap. In picker A it is one tap on the first row; Done only closes the dialog.

## For the tickets

Found in the code on 2026-11-22. For #282, the Worker's part:

1. **The last used first** needs the Worker: a User's Lists come oldest first, and the only use stored is when a List Item was added, so "used" can only mean "last added to".
2. **The page's rows** need each Collection's first cover. The Media Item's Lists carry the count but no covers: a Worker change or a second request.
3. **The taken name's error** needs the Media Type of the List that has the name; the error carries only its code today.
For #283:

4. **The Planned bookmark** in a Search row and on a Media Item's page doesn't check `can(mediaType, "plan")`, so a song would show it unless that is added.

## Open questions

For #282, from the live data:

1. **Takes nothing hides.** "karma police radiohead" leaves 10 rows, 8 of them one-release takes that look like demos and bootlegs ("{MD122}", "(9.1)", "(Mansfield)"), with no disambiguation to hide them by.
2. **A query without the whole title.** "time of my life bill medley jennifer warnes" ranks a 2008 recording on 2 releases first and the 1987 one on 218 releases third, as the query lacks "I’ve Had". That row also says "from Bevergem: Soundtrack", as a soundtrack counts as a studio Album.
