# Artists: seven Media Types, Search, an artist's page, Favourite artists and links from albums and songs

**Issue:** #300, part of the artists spec #298 (ADR-0013, "Artists"). #302 (the artists UI) and #303 (Favourite artists) are built and checked against this folder.
**Picked:** on 2026-11-24, in one canvas round.

| Screen | Pick |
| --- | --- |
| Media Type chips | A: seven equal segments; the Artists icon is Lucide's `mic-vocal` |
| Search row | A: the initials, the facts, then two labelled buttons, ♥ Favourite and Add to collection |
| Artists the User already keeps | 1: the "In your Collections" strip, round photos |
| Favourite artists full | 2: the error under the button |
| An artist's page | B: the whole photo, as Commons has it, over its blurred copy; albums in a grid |
| Collections on Artists | A: Favourite artists as the first collage card, "♥ 10 artists · Ranked" |
| Favourite artists | 2: numbered rows, the ↑↓ arrows always there |
| A Share Link to Favourite artists | 2: a ranked list, big numbers |
| No artists yet in Collections | 1: today's quiet empty state, with Find artists and New collection |
| Artists on album and song pages | a: each name in the facts line is a link |

**Canvas:** <https://claude.ai/artifact/PYBnbKFhdV5b1pBhwjrWwq> (private). One page, **Round 1 · Artist screens**:

- The chips: **A** seven equal segments (the pick); **B** a scrolling row; **C** two rows, four and three; **D** icons only, the chosen one labelled. The Artists icon: **1** `mic-vocal` (the pick), **2** `users-round`, **3** `user-round`.
- A Search row: **A** two labelled buttons under the facts (the pick); **B** two icon buttons at the right; **C** ♥ as an icon, Add to collection labelled.
- Search's states: kept artists **1** a strip first (the pick) or **2** left in the results with badges; nothing typed, nothing found, busy; Favourites full **1** a toast or **2** under the button (the pick).
- An artist's page: **A** a round photo over its blurred copy; **B** the whole photo (the pick); **C** the photo the full width. Albums in a grid (A's, the pick), as rows (B's) or a strip (C's). The canvas draws B with rows; the pick is B with the grid.
- The page's states (no photo, ended, added by hand) are drawn on A; this folder redraws them on B.
- Collections: **A** Favourite artists as the first card (the pick); **B** a wide card of the top five faces; **C** a numbered strip over the Collections.
- Favourite artists: **1** today's grid of round photos; **2** numbered rows (the pick); its ⋯ menu; full at 100.
- A Share Link: **1** a grid; **2** a ranked list (the pick).
- Empty: **1** the quiet state (the pick); **2** an empty Favourite artists card.
- Links: **a** in the facts line (the pick); **b** a chip per artist; **c** an "Artist" row under the actions.

The artists, types, countries, years, disambiguations, albums and photos are real MusicBrainz, Wikidata and Wikimedia Commons data from 2026-11-23, run through ADR-0013's rules, with the Cover Art Archive's covers. Favourite artists, its Notes, the Collections and the artist added by hand ("Сусіди знизу") are demo content.

## Why these

- **Chips A** keeps the control Search and Collections already have. Seven segments fit down to 320 px: see "Media Type chips".
- **Row A** names both actions. A row of artists has only these two, and the labels say what ♥ does before a User taps it.
- **The strip** keeps Search's order for every Media Type: the User's own first. It is the only place in Search with a photo, as the Worker already holds the User's artists; rows from MusicBrainz keep initials (#298, story 6).
- **Full 2** puts the reason where the tap was, and needs no toast component.
- **Page B** shows the whole photo. Commons' photos of groups are wide (Radiohead 500×182, Pink Floyd 500×241, Kalush Orchestra a stage at 3:2), and a round crop from the centre keeps one face or none. A round crop stays for small sizes: Search, the strip, Favourites, a Share Link.
- **The grid** of albums is the grid a Collection of albums has, square covers, so an artist's albums look as they do everywhere else.
- **Collections A** is today's card; Favourite artists is set apart by the ♥ and "Ranked", not by a second layout.
- **Favourites 2** shows the places and the arrows at all times, as a top is made to be reordered. No Reorder mode.
- **Share Link 2** matches Favourites 2, and the big numbers carry the ranking to a friend.
- **Empty 1** is today's empty state, with the two ways in.
- **Links a** changes one line and takes no room.

## Files

| File | Shows |
| --- | --- |
| `artists-search.html` | Search on Artists. No hash: "kalush", Kalush Orchestra kept (4th in Favourites) and four results. `#versions` "alice cooper", the singer and the band told apart by disambiguation; `#empty` nothing typed; `#nomatch` "kazka plakala", nothing found; `#busy` MusicBrainz answered 503 twice; `#full` ♥ on KALUSH with Favourite artists full. |
| `artists-page.html` | An artist's page. No hash: Океан Ельзи, 1st in Favourites and in a Collection, 11 albums; `#no-photo` Ігор Діденчук, no photo and no albums, kept nowhere; `#ended` Pink Floyd, 1965–2014, 19 Albums and EPs; `#portrait` Христина Соловій, a tall photo; `#manual` an artist added by hand. |
| `artists-collections.html` | Collections on Artists; `#empty` none yet. |
| `artists-favourites.html` | Favourite artists, 10 of them; `#menu` its ⋯ menu; `#full` 100 of 100. |
| `artists-shared.html` | The public page a Share Link to Favourite artists opens. |
| `artists-links.html` | The top of an album's page (Земля); `#song` a song's page with two artists (Teresa & Maria). |
| `artists-reference.html` | Reference: the chips at 390 and 320 px, the initials at every size. |
| `<page>-<390\|1440>-<light\|dark>.png` | Each page as it opens. |
| `<page>-<390\|1440>-<state>-<light\|dark>.png` | Each `#state` above. |
| `canvas/` | The round as canvas sources, all variants included. Images are canvas uploads (`/_blob/…`), so they show only on the canvas. |

The static pages load photos from Wikimedia Commons (`Special:FilePath/<file>?width=500`) and covers from `coverartarchive.org`, as the app will, so they need a network connection. Only what artists add is drawn: adding an artist by hand, the Collection picker, a Note's form and an ordinary Collection's page follow songs (`songs/`) and albums (`albums/`) with the artist words.

## Media Type chips

- Seven equal segments, in ADR-0005's order: Films, Books, Series, Games, Albums, Songs, Artists, in Search and in Collections. 56 px tall, the icon (18 px) over the label.
- **Label sizes**, measured with system-ui: on a phone 12 px ("Albums", the widest, is 43.4 px in a 48 px segment at 390 px); from `md` 13 px. **Below 360 px** 11 px with `-0.02em` tracking, the control's padding 3 px and its gaps 1 px: "Albums" is 38.8 px in a 39 px segment at 320 px. Without the tracking and the smaller gaps it overflows by 2 px.
- **The Artists icon** is Lucide's `mic-vocal`, in the chips, the empty states and a Collection's card. It never stands in for a face: no photo means initials.

## Photos and initials

- **Round** everywhere but the page: 56 px in a Search row (48 px from `md`), 120 px in the strip, 48 px in Favourite artists, 64 px on a Share Link, the page's Collection rows 48 px. `object-fit: cover`, centred.
- **No photo:** the initials in `text-muted-foreground` on `bg-muted`, with `border-border`, the same quiet note songs have. The first letter of the first two words, upper case ("ІД", "AC", "K"). `role="img"`, named with the artist's name. A photo that doesn't load counts as none.
- **The credit:** "Photo: <author> · <licence> · Wikimedia Commons", 12 px, `text-muted-foreground`, under the photo, linked to the file's page on Commons in a new tab. Only on the artist's page; the footer adds no line.

## Search on Artists

- **Field:** "Artist or band". Empty (`#empty`): "Type an artist or band to search your Collections and MusicBrainz."
- **In your Collections** first: the strip, each with the round photo (or initials), the name, the type and where the artist is. Favourite artists comes first, with its place ("♥ Favourites · 4th"); otherwise the oldest Collection holding it, with the list icon. An artist shown here isn't repeated below.
- **From MusicBrainz**, with the count, one card of rows. Each row:
  - the initials (56 px, 48 px from `md`), never a photo;
  - the name, wrapped, never cut;
  - one muted line, **"type · country · years"**, a missing part left out with its dot;
  - the disambiguation under it, 12 px, italic, muted;
  - **Favourite** (♥, outline; "In Favourites", filled, on `primary-soft`, when liked) and **Add to collection** (`list-plus`). On a phone both run under the whole row, side by side, 44 px; from `md` at the right, 36 px.
  - The whole row opens the artist's page.
- **Favourite artists full** (`#full`): the ♥ stays off and the error shows under the buttons, in `destructive`, tied to the button with `aria-describedby`: "Favourite artists is full (100). Remove one first."
- **Nothing found** (`#nomatch`): "No artists found for “kazka plakala”.", "Try the name as it is spelled on the album.", then Add manually.
- **Busy** (`#busy`): the strip still shows, then the clock, "MusicBrainz is busy, try again in a moment." and Try again.

## An artist's page

- **On a phone** (B): the photo blurred (`blur(30px)`, `saturate(1.3)`) in a 16:9 band fading into the page; over it, 44% of the width up, the **whole photo** at the full width, at most 420 px tall, a 14 px radius and a shadow, with the credit under it. Then, centred, the name (26 px), "type · country · years", the disambiguation (13 px, italic) and On MusicBrainz.
- **From `sm`:** the band is 21:9; the photo (360 px wide, at most 360 px tall) at the left, the facts beside it at the left, bottom aligned, the name at 34 px. A tall photo (`#portrait`) is narrower than 360 px, its credit at the left under it.
- **On MusicBrainz:** to `https://musicbrainz.org/artist/<MBID>` in a new tab.
- **Actions:** Favourite / In Favourites and Add to collection, each half the width and 48 px on a phone, as wide as their label and 40 px from `sm`.
- **In your Collections:** one card of rows, as on a song's page. Favourite artists comes first, with a ♥ tile on `primary-soft` and the place, "1st of 10". Each other row has its Collection's first photo (square, 6 px radius) and its count. None (`#no-photo`): "Not in Favourites or any of your Collections yet." in a dashed box.
- **Albums and EPs**, with the count: ADR-0013's list, oldest first. A grid of square covers, three columns on a phone, `auto-fill` of at least 150 px from `md`; the title in two lines and the year, "· EP" after an EP's year. A cell opens the album's page. None (`#no-photo`): "MusicBrainz has no albums or EPs by this artist yet." in a dashed box.
- **No photo** (`#no-photo`): no band. The initials at 136 px at the left, the name (22 px) beside them; 176 px and 34 px from `sm`.
- **Added by hand** (`#manual`): initials, no link, no albums, and "You added this artist manually. Only you can see it." with Edit artist and Delete artist.
- **No History, Thoughts, About, Planned or Listened.**

## Collections on Artists

- **Favourite artists** is the first card, as soon as it exists (the first Like): today's collage of the top four, square, "♥ 10 artists · Ranked", the ♥ in `primary-strong`, then "Shared by link" when it has a Share Link. It has no ⋯ on the card.
- **Other Collections** follow in today's order, with the `mic-vocal` icon: "6 artists".
- **None yet** (`#empty`): no Favourite artists card either. "Rank your Favourite artists, or gather them into Collections, like Bands to show a friend", then **Find artists** (primary, to Search on Artists) and **New collection**. Before #303 ships, #302 shows the songs' form: "Gather artists into Collections, like Bands to show a friend" and New collection.

## Favourite artists

- **The top:** All Collections, the ⋯ menu, the title with a filled ♥ in `primary-strong`, "10 artists · Shared by link", then **Find artists** (full width, 48 px on a phone; as wide as its label, 40 px, from `md`).
- **Rows**, in one card: the place (20 px, bold, tabular; 1–3 in `primary-strong`), the round photo (48 px), the name, the facts and the Note with its icon. Then ↑ and ↓ (44×36 px each, the first's ↑ and the last's ↓ disabled) and the row's ⋯ (Edit note, Remove from Favourites). The row opens the artist's page.
- **The ⋯ menu** (`#menu`): **Share** and **Edit description**, then "Favourite artists can’t be renamed or deleted. Take an artist out with ♥ on their page." No Reorder: the arrows are always there.
- **Full** (`#full`): "Favourite artists is full (100). Remove one first, then ♥ another artist." on `primary-soft` with a `primary-strong` border, above Find artists.

## A Share Link to Favourite artists

- Today's public page: the logo and Log in, then "Artist collection" with `mic-vocal`, the title with a filled ♥, "Shared by admin1 · 10 artists".
- **A ranked list**: each artist in its own card, the place (26 px, extra bold, 1–3 in `primary-strong`), the round photo (64 px), the name, the facts and the Note on `bg-muted`. One column on a phone, two from `md`.

## Artists on album and song pages

- **The facts line** keeps its order ("year · artist credit · type" on an album's page, "year · artist credit · from album" on a song's). Each credited artist with an MBID is a link: `font-semibold`, `text-foreground`, underlined in `primary-strong`, 2 px, 3 px offset; `primary-strong` on hover. The credit's joining phrases (" & ", " feat. ") stay text.
- A manual album's or song's artists stay text.
- `artists-links.html` draws both tops with the song page's layout; an album's page keeps its own (`albums/`), and only its facts line changes.

## Copy

The catalogue's case is kept: "Add to collection" and "New collection", where #298 writes "Add to Collection" and "New Collection".

| Where | Text |
| --- | --- |
| Chips | Films · Books · Series · Games · Albums · Songs · Artists |
| Search | Artist or band · Type an artist or band to search your Collections and MusicBrainz. · In your Collections · Favourites · {place} · From MusicBrainz · Favourite · In Favourites · Add to collection · Favourite artists is full (100). Remove one first. · No artists found for “{query}”. · Try the name as it is spelled on the album. · MusicBrainz is busy, try again in a moment. · Try again · Can’t find it? · Add manually |
| An artist's page | Photo: {author} · {licence} · Wikimedia Commons · On MusicBrainz · In your Collections · {place} of {count} · Not in Favourites or any of your Collections yet. · Albums and EPs · EP · MusicBrainz has no albums or EPs by this artist yet. · You added this artist manually. Only you can see it. · Edit artist · Delete artist |
| Collections | Favourite artists · {n} artists · Ranked · Rank your Favourite artists, or gather them into Collections, like Bands to show a friend · Find artists |
| Favourite artists | All Collections · Share · Edit description · Favourite artists can’t be renamed or deleted. Take an artist out with ♥ on their page. · Favourite artists is full (100). Remove one first, then ♥ another artist. · Move {name} up · Move {name} down |
| Share Link | Artist collection · Shared by {user} · {n} artists |

## Where the picks differ from #298

- **The photo on the page.** #298 (story 22) and #302 have "a round photo over its blurred copy". The pick is the whole photo, as Commons has it.
- **A Search row's photo.** None, as #298 asks (story 6); only the strip of the User's own artists has photos.

## For the tickets

Found in the code and the data on 2026-11-24.

1. **Every Collection is already numbered.** `ListPage.tsx` and `SharedListPage.tsx` pass `place={index + 1}` to each cell, on the owner's page and on a Share Link. So a Share Link to Favourites needs no flag to tell the client to number (#298, #303); Favourites differs in its layout (numbered rows), not in having numbers. For #303.
2. **The place in Favourites** ("1st of 10" on the page, "Favourites · 4th" in the strip) needs the artist's position in Favourites with the Media Item's Lists. For #303, and the strip's data for #302.
3. **The strip** needs the User's artists matching the query, with their photo, as the Worker searches artists (ADR-0013). For #302.
4. **Lists already have a description**, edited with the name in "Edit collection". Favourites needs a form for the description alone, or no description. For #303.

## Open questions

1. **Coverage of photos.** Of the 13 lesser-known artists in the check, one had a P18 image, so initials will be common outside well-known artists.
2. **Soundtracks in the albums list.** ADR-0013's query keeps Soundtrack release groups (Pink Floyd's More and Obscured by Clouds); #301 says "no secondary type". The page shows them as albums.
3. **Share Link title.** "Favourite artists" alone, or "admin1's Favourite artists" for a friend who opens it cold. Settled in #303: "admin1's Favourite artists", as a shared Backlog is "admin1's Watchlist".
