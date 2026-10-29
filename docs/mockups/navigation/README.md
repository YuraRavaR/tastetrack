# Navigation and home with several Media Types

**Picked:** variant A, "by section" (2026-10-29).
**Canvas:** <https://claude.ai/artifact/CZZHxh7zSKTAziwzsW8T6w> (private). Variant A is on the top row and variant B, "by type", on the bottom row, each on an iPhone 17 Pro (402×874) and the web.

## Files

| File | Shows |
| --- | --- |
| `navigation-a.html` | Home with films, books, music and games, at any width. The type picker, the Up next tabs and the account menu work. |
| `navigation-a-390-light.png`, `-390-dark.png` | Phone: bottom tab bar |
| `navigation-a-1440-light.png`, `-1440-dark.png` | Desktop: sections in the header, two columns |
| `canvas/` | Both variants as canvas sources. `Main.dc.html` and `SectionWeb.dc.html` are variant A. |

## The decision

Navigation is by **section**, and the **Media Type is a filter** inside a section. The type is not a top-level split.

- The Log is one per User across every Media Type (GLOSSARY), so a type-first app would have no place for "what I watched, read and played lately".
- The header holds four sections however many Media Types there are. A type-first header grows with every type and no longer fits a phone.
- Each Backlog and each List keeps its single Media Type (ADR-0005). The type filter selects which one is shown.

Variant B (type first, everything scoped to the chosen type) was rejected for both reasons.

## Layout

### Sections

| Section | Shows |
| --- | --- |
| Home | Search and the two blocks below |
| Log | The whole Log, with a type filter (not mocked yet) |
| Up next | The Backlogs, one per Media Type, switched with type tabs |
| Lists | The User's Lists, with a type filter (not mocked yet) |

**Phone (below `md`).** A top bar holds the app name and an avatar button. The four sections sit in a bottom tab bar, each with an icon and a label; the current one is in `text-primary`. The bar is sticky and pads for the iPhone home indicator with `env(safe-area-inset-bottom)`.

**From `md`.** The sections move into the header as text links, the current one on `bg-muted`. The bottom bar is hidden.

**Account menu.** The avatar button (with the Display Name from `md`) opens a menu with Invites, Settings, a separator and Log out. These pages leave the main nav.

### Home

1. **Search with a type picker.** A button inside the field shows the Media Type ("Films ▾") and opens a menu of the types, each with its icon. The placeholder and the field's accessible name follow the type: "Search films", "Search books", "Search albums", "Search games". Search queries one External Source at a time.
2. **Latest in your Log.** The last five Log Entries of every type, latest first.
   - Each row has a cover sized to its type: poster 2:3 for films and books, square for albums, 3:4 for games.
   - The second line starts with the type ("Album · Radiohead, 2000").
   - The meta line pairs the Rating with the type's verb: "Listened Oct 25", "Read Oct 20".
   - "All 24 in your Log" links to the Log.
3. **Up next.** Tabs Films · Books · Music · Games, full width on a phone and beside the heading from `md`. They show the first items of that type's Backlog. The link names the type's Backlog: "All 12 in your Watchlist", "All 7 in your Reading list".
4. **Footer.** Attribution for every External Source in use. TMDB's logo stays as ADR-0004 requires.

On a phone the blocks stack, Log first. From `md` they sit side by side.

## While films are the only Media Type

The type UI appears only once a second Media Type ships. Until then:

- no type picker in the search;
- no type tabs in Up next;
- no "Film ·" prefix on rows.

The only visible change is the new navigation: the bottom tab bar on a phone, and the account menu replacing the Invites and Settings links and the Log out button. That part can be built now. It also settles #58, the phone header that doesn't fit on one line.

The section that holds the Backlogs is labelled **Watchlist** and links to `/watchlist` until a second Media Type ships. Renaming it to "Up next" is a separate issue for then.

### Built now so a second Media Type is easy to add

Only what costs little now, no UI ahead of time:

- The UI words in [Wording per Media Type](#wording-per-media-type) sit in `en.ts` under keys per Media Type (`mediaType.film.verb` is "Watched", `mediaType.film.backlog` is "Watchlist", and so on). Components pick them by the Media Item's type and don't hard-code "Watched".
- `Poster` takes its cover shape from the Media Type. Films are 2:3, the only shape today.
- The sections are data (one array the tab bar and the header both render), not markup written twice.

The type picker, the Up next tabs and the Log and Lists filters are not built.

## The frame

- **Widths.** The header and the footer stop at `max-w-6xl` (72rem, the mockup's 70rem). Each page sets its own column: home is wide, so its blocks sit side by side from `md`; the film's page, the Log, Lists, the Watchlist, Invites and Settings stay at `max-w-3xl`.
- **Footer.** The TMDB attribution, and the app version from `package.json` ("v0.5.0") in `text-muted-foreground text-xs` beside it.
- **Logged out** (login, register, a Share Link page): the app name alone, with no tab bar and no account menu.
- **A User who must set a new password**: the app name and the account menu holding only Log out, with no tab bar.

## Wording per Media Type

The domain terms stay generic (GLOSSARY, ADR-0005); these are UI words in `en.ts`:

| Media Type | Tab | Row prefix | Verb (Experienced) | Backlog | Search placeholder |
| --- | --- | --- | --- | --- | --- |
| Film | Films | Film | Watched | Watchlist | Search films |
| Book | Books | Book | Read | Reading list | Search books |
| Album | Music | Album | Listened | Listen later | Search albums |
| Game | Games | Game | Played | Play next | Search games |

"Up next" is the section that holds every Backlog. Series, already planned in the glossary, become one more row here and one more tab.

## Open questions

Questions 1, 2, 4, 5 and 6 matter only once a second Media Type ships, and wait for then. Questions 3 and 7 are settled.

1. **Games.** Games are not yet a planned Media Type in the glossary or ADR-0005. Adding them needs a glossary entry and an ADR choosing the External Source (IGDB needs a Twitch app login; RAWG is simpler).
2. **External Sources for books and music.** Open Library and MusicBrainz are proposals only. Each needs an ADR like ADR-0004 (TMDB): terms, rate limits, attribution.
3. ~~**"Up next" while only films exist.**~~ Settled: "Watchlist" until a second type ships, then "Up next" in an issue of its own. Over a single Watchlist, "Up next" adds nothing, and "Watchlist" matches the route, home's "Next on your Watchlist" (#66) and the toasts.
4. **Which type is selected first.** The search picker and the Up next tabs could open on the last type the User used (stored per User or per device), or always on Films.
5. **Empty types.** Should Up next show a tab for a type whose Backlog is empty, or only the types the User has used?
6. **Log and Lists filters.** These pages need an "All · Films · Books · …" filter. Not mocked yet.
7. ~~**Tablet.**~~ Settled: from `md` (768px) the nav is in the header, on a tablet in portrait too, as mocked.
