# Music metadata sources: which one backs an album?

**Question.** Music is the next Media Type, and its Media Item is an album. Which external source should hold album metadata, the way TMDB holds films and series (ADR-0004) and Open Library holds books (ADR-0011)?

**Checked** 2026-11-16, against official docs and the live APIs. This is a short pass, not an exhaustive survey: claims marked _not checked_ were not verified.

**Outcome.** MusicBrainz was chosen in #266 and recorded in ADR-0013. A check from a throwaway Worker and a CORS check on 2026-11-21 (below) settled the rate limit, merges and CORS, and search stays in the Worker. Songs followed in #279, on MusicBrainz recordings: the recording search check of 2026-11-22 (below) settled their query, album and cover.

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
- **Merges and deletions:** MusicBrainz merges entities and keeps the old MBID as a redirect. A merged release group answers 301 to the new one (checked 2026-11-21, below). How it answers for a deleted one was _not checked_.
- **Fallback for the rate limit:** cache search results for a short time, or call search from the browser instead of the Worker, so the per-IP limit applies to the user's own IP. Each needs a decision. MusicBrainz allows browser CORS (checked 2026-11-21, below).

## Open questions for the user

All seven were answered in the #266 grilling on 2026-11-21 and are recorded in ADR-0013: albums and EPs, no singles; live albums, soundtracks and compilations are albums of their own; artists are names, with their MBIDs kept; the Original Title alone; search in the Worker; no About block; no Progress.

1. Albums only, or EPs and singles too? Kalush Orchestra's best-known work is a single.
2. Compilations, live albums and soundtracks: separate Media Items, hidden, or a later decision?
3. Artists as metadata only, like book authors, with no artist pages?
4. An English Localized Title: is the Original Title alone enough for music, since album titles are rarely translated?
5. Search from the Worker, or from the browser, to escape the shared-IP limit?
6. Is a description (About block) needed for albums at launch?
7. Does a future Progress for albums (track N of M) matter? A release has a track list, but a release group doesn't: you would have to pick one release.

## Check from a Worker (2026-11-21)

**Why.** The 2026-11-16 checks ran from a home IP. In production the Worker calls MusicBrainz from Cloudflare's shared egress IPs, where other people's traffic spends the same per-IP limit. #266 set the rule: search moves to the browser if more than 10% of searches still get 503 after one retry.

**How.** A throwaway Worker, `tastetrack-mb-check-267` on `*.workers.dev`, outside TasteTrack's deployments, deployed with the Operator's approval and deleted after the run. Each call sent `User-Agent: TasteTrack/0.16.0 (<contact>)`, with the repository URL as the contact for this check (TasteTrack itself sends the Operator's contact, ADR-0013). Every call went through one queue, at least 1.1 s after the previous one, and a 503 was retried once through the same queue. The checks ran in two invocations, to stay under Workers Free's 50 subrequests each: 20 searches from 08:32 UTC (33 s), then 20 lookups and the merge checks from 08:33 UTC (31 s).

**Results.**

| | Calls | 503 on the first try | 503 after one retry |
|---|---|---|---|
| Release-group search | 20 | 11 (55%) | 1 (5%) |
| Release-group lookup | 20 | 5 (25%) | 0 |

5% is under the 10% rule, so search stays in the Worker. Throttling on the first try is common, so the single retry is required, not optional.

**Searches** used `/release-group/?query=(<q>) AND (primarytype:album OR primarytype:ep)&limit=10`. Artist names in the query still match with the type filter in place. Top hit, or the place of the album meant:

| Query | Result |
|---|---|
| Океан Ельзи Земля | Земля, Океан Ельзи, 2013, Album: first |
| Бумбокс Family бізнес | Family бізнес, Бумбокс, 2006, Album: first |
| Воплі Відоплясова Музіка | Музіка, 1997, Album: first (the 1996 single is filtered out) |
| Jinjer Wallflowers | Wallflowers, 2021, Album: first |
| 1944 Jamala | 1944, EP (2016-05-07) first, then the Album (2016-06-10) |
| Kalush Orchestra | 503 twice |
| Radiohead OK Computer | OK Computer, 1997, Album: first |
| Abbey Road Beatles | Abbey Road, 1969, Album: first; Abbey Road Remix (Album + Remix) second |
| Pink Floyd Dark Side of the Moon | Two tribute albums first; Pink Floyd third |
| DakhaBrakha | The Bedouin Reworks Of Dakhabrakha (EP) first, then The Road and Ptakh (Albums) |
| Скрябін Кінець фільму | Кінець фільму, 2015, EP + Compilation: first |
| Ruslana Wild Dances | Wild Dances, 2004, Album: first |
| The Hardkiss Залізна ластівка | Залiзна ластiвка, 2018, Album: first (MusicBrainz spells it with a Latin "i") |
| Христина Соловій Жива вода | Жива вода, 2015, Album: first |
| Daft Punk Random Access Memories | A Vitamin String Quartet tribute first; Daft Punk second |
| Kendrick Lamar To Pimp a Butterfly | To Pimp a Butterfly, 2015, Album: first |
| Taylor Swift 1989 | A lullaby tribute and two karaoke albums (Album + Remix); her album not in the top 3 |
| Miles Davis Kind of Blue | Kind of Blue, 1959, Album: first |
| Земля | Анна Ворфоломеева (EP), Butterfly Temple, then Океан Ельзи third |
| Abbey Road | Abbey's Road (Ada Montellanico), Various Artists, then the Beatles third |

**Lookups** used `/release-group/<mbid>?inc=artist-credits+url-rels+aliases` for 20 MBIDs from the searches. All 20 answered with the MBID asked for.

**Merges.** Wikidata marks some MusicBrainz release-group IDs as deprecated with the reason "redirect". Two of them were looked up from the Worker:

| Old MBID | `redirect: "manual"` | Followed |
|---|---|---|
| `a51b25f4-2dc1-4787-b779-51abcdb170ff` | 301, `Location` `…/release-group/9cd2811d-a999-326e-8945-a8b6b44b9e92?…` | 200, `id` 9cd2811d…, Bye Bye Birdie |
| `263247fc-e4a1-3164-9100-04c790e0a812` | 301, `Location` `…/release-group/2eb7ce56-2c3a-34a2-b587-d9072d4b0e1c?…` | 200, `id` 2eb7ce56…, Nö Sleep at All |

The `Location` keeps the query, `inc` included. The followed request is made by `fetch` itself, without the queue's interval, and both answered 200. ADR-0013 has the source follow the 301 itself, through its queue. The Cover Art Archive answers an old MBID with the same 307 to the same image as the new one (checked from a home IP).

**Covers.** `coverartarchive.org/release-group/<mbid>/front-250` for the 20 looked-up release groups: 18 answered 307, 2 answered 404 (Abbey Road Remix and The Bedouin Reworks Of Dakhabrakha). It answers with `access-control-allow-origin: *`.

## CORS check (2026-11-21)

MusicBrainz answers a release-group search with `access-control-allow-origin: *`, and its CORS preflight allows the request headers `Authorization, Content-Type, User-Agent`. A browser page could call search itself, so the limit would apply to the User's own IP. Chrome and Safari don't let a page set its own User-Agent, so such calls would be known to MusicBrainz only by their Origin.

## Recording search check (2026-11-22)

**Why.** #279 makes a song a MusicBrainz recording and left three things to a live check (#280): the query that finds a song with and without its artist in one request, whether a search result's release list is enough to collapse duplicates and choose the cover, and how much the hiding and collapsing remove.

**How.** From a developer machine on a home IP, one call at a time, at least 1.1 s after the last one ended, with one retry on a 503. The User-Agent was `TasteTrack/0.17.0`, **without the contact** TasteTrack itself sends (ADR-0013). Pilots on some of the queries chose the candidate. From 14:07 UTC each of 23 queries then ran in three forms with `limit=100` (69 searches), and those that got two 503s were asked again later. The Worker's rules were applied to the saved answers by a script. The boosts were tuned on "Bohemian Rhapsody" and tried on other queries in this set, so the bare-title score is likely kinder than new titles would get. Following up took more calls than the 20 or so planned: lookups, `rid:` searches and release browses for the songs found, and 93 lookups for the 25-release limit.

**Query forms.** A hit is the recording meant (of those with that title and artist in any answer, the one on the most releases) coming first after hiding, collapsing and ranking.

| Form | With the artist (15) | Bare title (8) |
|---|---|---|
| `recording:(<words>) AND artist:(<words>)`, limit 100 | 12 | 0 |
| Every word in the title or the artist, limit 100 | 12 | 3 |
| The same with the hiding and boosts (ADR-0013), limit 25 | 14 | 6 |
| **The same, limit 50 (chosen)** | **15** | **7** |
| The same, limit 100 | 15 | 7 |

In the pilots, free text put "Обійми" by Океан Ельзи 8th for a query that names its artist (1st after the Worker's rules), matched 3,370,935 recordings for "Шум Go_A", and didn't have Queen's "Bohemian Rhapsody" in its first 100, and the hiding without boosts didn't have Queen's in 100 either. A boost by release countries found Queen too, but its answers reached 5.8 MB.

The scores for 25 and 100 are from the answers at `limit=100`, cut to 25 for the first.

**Results of the chosen form,** from its live answers at `limit=50`. "Match" and "left by the query" are MusicBrainz's totals before and after the query's hiding. "Rows" is what was returned and what collapsing leaves. "Place" is the top song's place in MusicBrainz's order. "Without the studio rule" is the cover that ADR-0013's type and date rules give with no regard to secondary types.

| Query | Match | Left by the query | Rows | First after the Worker's rules | Place | Album | Cover | Without the studio rule |
|---|---|---|---|---|---|---|---|---|
| Обійми Океан Ельзи | 3 | 3 | 3 → 3 | Обійми, Океан Ельзи, 2013, 9 releases | 1 | Земля | Земля | same |
| Шум Go_A | 4 | 2 | 2 → 2 | Шум, Go_A, 2021, 1 release | 1 | none | Шум | same |
| Stefania Kalush Orchestra | 3 | 2 | 2 → 2 | Stefania, Kalush Orchestra, 2022, 11 releases | 1 | none | Stefania | Eurovision Song Contest: Turin 2022 |
| Бумбокс Вахтерам | 4 | 3 | 3 → 2 | Вахтёрам, Бумбокс, 2006, 4 releases | 1 | Family бізнес | Family бізнес | same |
| Плакала KAZKA | 3 | 2 | 2 → 2 | ПЛАКАЛА, KAZKA, 2018, 6 releases | 2 | KARMA | KARMA | same |
| Скрябін Старі фотографії | 6 | 5 | 5 → 4 | Старі фотографії, Скрябін, 2005, 4 releases | 1 | Танго | Танго | same |
| 1944 Jamala | 1 | 1 | 1 → 1 | 1944, Jamala, 2016, 11 releases | 1 | 1944 | 1944 | Eurovision Song Contest: Stockholm 2016 |
| Karma Police Radiohead | 293 | 91 | 50 → 10 | Karma Police, Radiohead, 1997, 151 releases | 1 | OK Computer | OK Computer | same |
| Bohemian Rhapsody Queen | 269 | 124 | 50 → 6 | Bohemian Rhapsody, Queen, 1975, 356 releases | 1 | A Night at the Opera | A Night at the Opera | same |
| Don't Stop Me Now Queen | 74 | 51 | 50 → 15 | Don’t Stop Me Now, Queen, 1978, 254 releases | 1 | Jazz | Jazz | same |
| The Sound of Silence Simon & Garfunkel | 107 | 84 | 50 → 2 | The Sound of Silence, Simon & Garfunkel, 1966, 261 releases | 3 | Sounds of Silence | Sounds of Silence | same |
| Highway to Hell AC/DC | 245 | 170 | 50 → 7 | Highway to Hell, AC/DC, 1979, 116 releases | 1 | Highway to Hell | Highway to Hell | same |
| Under Pressure Queen David Bowie | 58 | 45 | 45 → 32 | Under Pressure, Queen & David Bowie, 1981, 290 releases | 1 | Hot Space | Hot Space | Greatest Hits |
| Rock AND Roll Led Zeppelin | 610 | 73 | 50 → 5 | Rock and Roll, Led Zeppelin, 1971, 181 releases | 33 | [Led Zeppelin IV] | [Led Zeppelin IV] | same |
| Live Forever Oasis | 265 | 197 | 50 → 6 | Live Forever, Oasis, 1994, 139 releases | 3 | Definitely Maybe | Definitely Maybe | same |
| Обійми | 58 | 58 | 50 → 47 | Обійми, Океан Ельзи, 2013, 9 releases | 2 | Земля | Земля | same |
| Вахтерам | 4 | 3 | 3 → 2 | Вахтёрам, Бумбокс, 2006, 4 releases | 2 | Family бізнес | Family бізнес | same |
| Стефанія | 0 | 0 | 0 → 0 | Nothing |  |  |  |  |
| Bohemian Rhapsody | 883 | 695 | 50 → 49 | Bohemian Rhapsody, Queen, 1975, 356 releases | 1 | A Night at the Opera | A Night at the Opera | same |
| Karma Police | 461 | 246 | 50 → 30 | Karma Police, Radiohead, 1997, 151 releases | 1 | OK Computer | OK Computer | same |
| Smells Like Teen Spirit | 1190 | 693 | 50 → 50 | Smells Like Teen Spirit, Nirvana, 1991, 165 releases | 1 | Nevermind | Nevermind | same |
| Yesterday | 15531 | 14988 | 50 → 48 | Yesterday, The Beatles, 1965, 95 releases | 14 | Help! | Help! | same |
| Hello | 28957 | 27782 | 50 → 48 | Hello, Lionel Richie, 1983, 286 releases | 28 | Can’t Slow Down | Can’t Slow Down | same |

The query as ADR-0013 prints it was then sent at `limit=50` for all 23 and gave the same first song each time. It was also accepted with Lucene's special characters, with "NOT AND OR TO", and at the longest query TasteTrack takes, 100 characters.

**What hiding and collapsing remove.** The unfiltered form returned 1,318 rows over the 23 queries, at most 100 each:

| | Rows | Share |
|---|---|---|
| Disambiguation starts with "live" | 390 | 30% |
| Video | 68 | 5% |
| No release | 8 | 1% |
| Karaoke | 6 | under 1% |
| Collapsed as the same title and artist credit | 368 | 28% |
| Left | 478 | 36% |

With the hiding done in the query it's collapsing alone: 343 of the chosen form's 716 rows (48%) at `limit=50`, leaving 373. Hiding has to come before the limit: 87 of the 100 unfiltered rows for "Rock AND Roll Led Zeppelin" were live, and the studio recording wasn't among them. `comment:live` matches a word anywhere, so it also hides disambiguations that don't start with it. The answers had two such rows that the spec's rule would keep, a soundboard "recorded live" and a track of a DJ mix named "Live in Japan".

**Is the release list enough?** A search result's is. For the 18 distinct songs found its distinct releases equalled a browse's `release-count` every time. 5 of the lists repeated a release that has the recording twice, so they have to be counted by MBID. All 18 covers chosen answered 307 at `front-250`. Type and a plainly sorted date chose a compilation for 5 of the 18. Counting a partial date as the end of its period leaves 3 (Stefania, 1944, Under Pressure), and putting studio release groups first leaves none.

A lookup's is not always. MusicBrainz documents that "the number of linked entities returned is always limited to 25" ([API](https://musicbrainz.org/doc/MusicBrainz_API)).

| | Album differs from the whole list's | Cover differs |
|---|---|---|
| The 18 songs found | 0 | 0 |
| 93 recordings with more than 25 releases, from all the check's answers | 3 | 4 |

The four were Yesterday Man (Chris Andrews), Hello It's Me (Todd Rundgren), Yesterday (Ray Charles) and Einstein a Go-Go (Landscape). `status=official`, with and without `type`, fixed none of them. The lookup's first-release date equalled the search's for all 93.

**Unknown and merged recordings.** An unknown MBID answered 404 to a lookup and 200 with no rows to a `rid:` search. `fcde0790-ab0d-4f3f-b984-211b2b330af9`, which Wikidata marks as a redirect, answered 301 to a lookup, with a `Location` of `7a0aecf5-0538-42d6-a468-78e0d3a9dead` that keeps the query and answers 200, and no rows to a `rid:` search.

**Payload and CPU.** The largest answer was 0.9 MB at limit 50 and 1.5 MB at 100. Parsing and validating one took up to about 1.7 and 3 ms (the median of 41 runs for each answer) in Node 24 on the developer machine. CPU time on Workers was _not checked_.

**Throttling.** 37 of the 69 searches (54%) got a 503 on the first try and 15 (22%) after one retry, 4 of the 23 in the chosen form. 38 of the 93 lookups (41%) got a 503 on the first try and none after the retry. These are worse for searches than the 5% measured from a Worker on 2026-11-21, and over the 10% that #266 set as the limit for searching from the Worker. They aren't the same measurement: another IP, another time and a User-Agent without a contact. How recording searches fare from a Worker was _not checked_.

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
