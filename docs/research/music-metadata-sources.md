# Music metadata sources: which one backs an album?

**Question.** Music is the next Media Type, and its Media Item is an album. Which external source should hold album metadata, the way TMDB holds films and series (ADR-0004) and Open Library holds books (ADR-0011)?

**Checked** 2026-11-16, against official docs and the live APIs. This is a short pass, not an exhaustive survey: claims marked _not checked_ were not verified.

## Recommendation

**MusicBrainz for identity, search and metadata, and the Cover Art Archive for covers.** It is the only candidate that is free with no key, whose data is CC0, and that models an album as one entity over all its editions (the **release group**, the analog of an Open Library work). It found every Ukrainian album we tried, in Cyrillic, and gives a Wikidata link that can lead to a description.

Its two weak points are the reasons this needs an ADR, not just a choice:

1. **Rate limit of 1 request a second per source IP.** Workers share egress IPs, so other people's traffic can spend it. In our own checks it answered 503 to 8 of 20 searches, even at one every 2.5 seconds.
2. **Search ranking is poor for bare titles.** "Abbey Road" and "Dark Side of the Moon" don't put the Beatles or Pink Floyd first. A query with the artist in it works well. Search would need to rank albums above singles and EPs itself, or nudge users to type the artist.

**Runner-up: Deezer** for search only, if MusicBrainz search proves unusable from Workers. It has no key, ranks well and has covers, but it is a store catalog (each remaster is a separate album), its terms restrict use to non-commercial, and it can revoke access at any time. Not a source of identity.

## Comparison

| | MusicBrainz + CAA | Deezer | iTunes Search | Discogs | Spotify | Last.fm |
|---|---|---|---|---|---|---|
| Cost / key | Free, no key | Free, accept terms on login | Free, no key | Free; search needs a token | Needs Premium account and app | Free key |
| Rate limit | 1/s per IP, 503 past it | Not stated | ~20/min | 25/min without auth (header) | Not numeric, 30 s window | Discretionary |
| One album over its editions | Yes: release group | No: store albums | No: store albums | Yes: master | No | Partly |
| Ukrainian queries (our checks) | 6 of 6 that answered (3 got 503) | 7 of 9 | 7 of 9 (Latin artist names) | Lookup yes; search not checked | Not checked | Not checked |
| Covers | CAA, by MBID, no key | Yes | Yes, promo use only | Yes, auth for full size (_not checked_) | Must link back | Excluded from licence |
| Licence / terms | Core data CC0 | Non-commercial only | Only to promote store content | _Terms page refused fetch_ | No standalone metadata, link back | Non-commercial, credit |

## Candidates

### MusicBrainz + Cover Art Archive

**Pros**
- Core data is CC0: "The core data of the database is licensed under the CC0" ([Data License](https://musicbrainz.org/doc/About/Data_License)). No caching limit like TMDB's 90 days. Supplementary data (ratings, tags, annotations) is CC BY-NC-SA 3.0; we wouldn't use it.
- No key. Identification is by User-Agent, as with Open Library ([Rate Limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)).
- **Release group** = one album across all its releases. "Земля" by Океан Ельзи is one release group with 6 releases (live lookup). Its `primary-type` (Album, Single, EP, …) and `secondary-types` (Compilation, Live, Soundtrack, Remix, …) let us choose what counts as an album.
- Coverage: found Земля, Family бізнес, Музіка, Wallflowers, 1944, OK Computer and Abbey Road (with the artist in the query), all in their original script.
- Covers: `coverartarchive.org/release-group/{mbid}/front-{250|500|1200}` answers 307 to archive.org, or 404 when there is no front image ([CAA API](https://musicbrainz.org/doc/Cover_Art_Archive/API)). Both checked albums had one. The browser can load it directly, so it costs the Worker nothing.
- The release group links to Wikidata and Discogs (live lookup), which is a path to a description.

**Cons**
- Per-IP limit: "if that rate is too high, all your requests will be declined (http 503) … Currently that rate is (on average) 1 request per second" ([Rate Limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)). The same page says requests are also refused when the servers as a whole are busy. On shared Worker IPs this is the main risk. 8 of our 20 searches got 503.
- Ranking: a bare title returns singles and covers by unknown artists first (live checks for "Abbey Road", "Dark Side of the Moon").
- No English Localized Title for most Ukrainian albums: the release group "Земля" has no aliases. The artist has a Latin sort name ("Okean Elzy"). Transliterated pseudo-releases might exist for some albums: _not checked_.
- Cover images are "copyrighted by their respective copyright owners", and CAA grants no licence ([coverartarchive.org](https://coverartarchive.org/)). That's the same position as Open Library covers: hotlinked, not stored.
- No description of its own. Wikidata gives a Wikipedia article: "Земля" has a uk and a ru one but no English label (live check). The uk Wikipedia summary call returned nothing for the title we tried: _not checked_ further.

### Deezer

**Pros**
- No key for search, good ranking (Pink Floyd and Radiohead first), covers on every result, and 10 of 12 queries found the right album, 7 of the 9 Ukrainian ones (live checks).

**Cons**
- "The use of the Services is strictly limited for a non-commercial purpose", and access can be modified or revoked at any time ([terms](https://developers.deezer.com/termsofuse)). The API page asks you to log in and accept the terms ([API](https://developers.deezer.com/api)).
- Store catalog: Abbey Road comes back as "Remastered 2009", "Super Deluxe Edition" and "2019 Mix", which are three separate albums. Not a good identity.
- "Океан Ельзи Земля" found nothing, and "Кінець фільму" came back as a single.
- Rate limit and metadata caching are not stated on the pages read.

### iTunes Search API

**Pros**
- No key, found most Ukrainian albums, and the UA storefront gives Latin artist names (Okean Elzy, Boombox, Skryabin), which could fill an English Localized line.

**Cons**
- "Limited to approximately 20 calls per minute" ([Search API](https://performance-partners.apple.com/search-api)).
- Artwork may be used "only to promote store content", next to a Download on iTunes badge. That doesn't fit TasteTrack.
- Store catalog with split editions, like Deezer. "Dark Side of the Moon" did not return Pink Floyd.

### Discogs

**Pros**
- A **master** is one album over its releases, like a release group. A lookup without auth worked ("Земля", 2013, 16 images) with a 25-a-minute limit in the `x-discogs-ratelimit` header.
- MusicBrainz links to it, so it could be a second source later.

**Cons**
- Search without a token returned no results (live check), so search needs a personal token or OAuth.
- The developer and API terms pages answered 403, so terms on caching and images are _not checked_.

### Spotify

**Cons** (no real pros for us)
- "You need a Spotify Premium account to use the Web API" ([Web API](https://developer.spotify.com/documentation/web-api)). Development mode allows up to 5 users. Since 15 May 2025, extended quota is only for organisations with at least 250k MAUs ([quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)).
- February 2026 changes cut the search page size to 10 and removed batch album fetches for development-mode apps ([migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)).
- Cover art and metadata "must be accompanied by a link back" and may not be offered as a standalone product ([policy](https://developer.spotify.com/policy)).

### Last.fm

**Cons**
- Data "solely for non-commercial purposes", it must be credited with links, and images are "expressly excluded from this Agreement" ([API ToS](https://www.last.fm/api/tos)). No covers, so it's not a primary source.

### Not evaluated

Wikidata as a primary source (it could fill descriptions and labels), TheAudioDB, ListenBrainz, Bandcamp, Apple Music API and AllMusic were not looked at in this pass.

## If MusicBrainz is chosen: what an ADR has to settle

- **External Reference:** (`musicbrainz`, `album`, release-group MBID).
- **Search:** one call to `/ws/2/release-group/?query=<q>&fmt=json`. The Worker ranks by `primary-type` (Album first), and perhaps drops `secondary-types` such as Remix. Whether singles and EPs are offered at all is an open question below.
- **Adding an album:** one lookup, `/ws/2/release-group/{mbid}?inc=artist-credits+url-rels+aliases`, which gives title, artists, first-release date and the Wikidata link. A description would be one or two more calls (Wikidata, then Wikipedia): _not checked_.
- **Cover:** `https://coverartarchive.org/release-group/{mbid}/front-500` straight from the browser, with a placeholder on 404.
- **Identification:** `User-Agent: TasteTrack/<version> (<Operator contact>)` read from Worker configuration, as in ADR-0011.
- **503** means we were throttled, either by IP or globally: it's temporary and never counts toward unavailability. A cron run costs 1 subrequest an album (more if descriptions come from Wikidata), but it must keep to 1 a second, so it can't spend its 40 subrequests in a burst.
- **Merges and deletions:** MusicBrainz merges entities and keeps the old MBID as a redirect. How the API answers for a merged or deleted release group was _not checked_.
- **Fallback for the rate limit:** cache search results for a short time, or call search from the browser instead of the Worker, so the per-IP limit applies to the user's own IP. Each needs a decision and a check that MusicBrainz allows browser CORS: _not checked_.

## Open questions for the user

1. Albums only, or EPs and singles too? Kalush Orchestra's best-known work is a single.
2. Compilations, live albums and soundtracks: separate Media Items, hidden, or a later decision?
3. Artists as metadata only, like book authors, with no artist pages?
4. An English Localized Title: is the Original Title alone enough for music, since album titles are rarely translated?
5. Search from the Worker, or from the browser, to escape the shared-IP limit?
6. Is a description (About block) needed for albums at launch?
7. Does a future Progress for albums (track N of M) matter? A release has a track list, but a release group doesn't: you would have to pick one release.

## Raw live results (2026-11-16)

User-Agent `TasteTrack-research/0.1`, at most one request every 1.2–2.5 s.

**MusicBrainz release-group search** (top hit; 503 = throttled):

| Query | Result |
|---|---|
| Океан Ельзи Земля | Земля, Океан Ельзи, 2013, Album |
| Земля | Butterfly Temple first; Океан Ельзи third |
| Бумбокс Family бізнес | Family бізнес, Бумбокс, 2006, Album |
| Музіка | Музіка, Воплі Відоплясова: 1996 single, then 1997 album |
| Jinjer Wallflowers | Wallflowers, Jinjer, 2021, Album |
| 1944 Jamala | 1944, Jamala: EP, album and single, all with score 100 |
| Kalush Orchestra | Stefania (single) first |
| OK Computer | Lemaitre single first; Radiohead second |
| Abbey Road | Not the Beatles in the top 3 |
| Abbey Road Beatles | Abbey Road, The Beatles, 1969, Album |
| Dark Side of the Moon | No Pink Floyd in the top 3 |
| DakhaBrakha; Скрябін Кінець фільму; Ruslana Wild Dances; OK Computer (1st try); 1944 Jamala (1st try); a field query | 503 |

**Deezer `/search/album`** found: Radiohead, Beatles (3 editions), Pink Floyd, DakhaBrakha, Jinjer, Jamala, Бумбокс, Ruslana, ВВ and Kalush (singles). Not found: Океан Ельзи Земля (0 results). Скрябін Кінець фільму came back as a single.

**iTunes `/search?entity=album&country=UA`** found: Земля (Okean Elzy), Radiohead, Beatles (editions), DakhaBrakha, Jamala, Family бізнес (Boombox), Wild Dances, Музіка (Vopli Vidopliasova) and Kalush (singles). Not found: Jinjer Wallflowers (0), Pink Floyd, Кінець фільму.

**Discogs:** `/database/search` without auth returned 0 results; `/masters/593968` returned Земля, 2013, Океан Ельзи, 16 images, `x-discogs-ratelimit: 25`.

**Cover Art Archive:** release-group front-250 for Земля and OK Computer both answered 307 to archive.org.

**Wikidata** Q14633569 (Земля): sitelinks to uk, ru, hy and be Wikipedia; labels in uk and ru, none in en.
