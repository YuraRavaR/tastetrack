# Games metadata source

**Question.** Which External Source should TasteTrack use for the games Media Type (PC and PlayStation games)? The same criteria as ADR-0004 (TMDB) and ADR-0011 (Open Library) apply: cost under ADR-0001, whether it runs from a Cloudflare Worker (ADR-0002), terms on caching and attribution, covers, rate limits, how the catalog models a game, and search with en/uk titles.

**Checked:** 2026-11-16. Research stopped early, so some points could not be checked. Every claim not confirmed against a primary source or a live call is marked **unverified**.

**Updated:** 2026-11-19, with live IGDB calls made with a real key during the grilling session for #248 (see "Live checks on 2026-11-19" below). Claims those calls settled are marked **checked 2026-11-19**. The decisions are recorded in ADR-0012 and #248.

## Recommendation

**Use IGDB** (Twitch/Amazon) as the External Source for games. Its `game` record is the Media Item: one work across all its platforms. **Wikidata** is an optional add-on for the Ukrainian Localized Title. It needs no key and links to IGDB through property P5794 (IGDB game ID). There is no full fallback. A game IGDB lacks becomes a Manual Media Item, as books do with Open Library.

*Outcome (2026-11-19):* IGDB was adopted (ADR-0012). Wikidata was not: #248 decided that games have only an English title, so there is no Ukrainian Localized Title to fill.

Main reasons:

- **Free, server-side auth that suits a Worker.** IGDB says it "is free for non-commercial usage under the terms of the Twitch Developer Service Agreement", and its FAQ says it "is free for both non-commercial and commercial projects" ([IGDB docs, Getting Started and FAQ](https://api-docs.igdb.com/)). Auth is an OAuth client-credentials POST to `id.twitch.tv`. The API is server-only (no CORS), which is how we call it anyway.
- **The data model fits ADR-0005.** A `game` lists all its `platforms`, and its `release_dates` are split per platform and region. Editions (e.g. "Gold edition") hang off the main game through `version_parent`. DLC and expansions point to their game through `parent_game`. Remakes, remasters and ports are separate games, and `game_type` says which is which. "The Media Item is the game" maps onto it directly.
- **Caching is explicitly allowed by IGDB:** "Am I allowed to store/cache the data locally? Yes. In fact, we prefer if you store and serve the data to your end users." ([IGDB FAQ](https://api-docs.igdb.com/))
- **Portrait covers on a CDN.** `cover_big` is 264×374, and the `_2x` variant exists. I hotlinked them live with a foreign Referer and got 200 with `cache-control: public, max-age=31536000, immutable`.
- **The limit is per key, not per IP.** It is 4 requests a second with 8 open requests ([IGDB docs, Rate Limits](https://api-docs.igdb.com/)). One expanded query fills a cache entry, so adding or refreshing a game costs one subrequest, like a film.
- **Useful extras:** genres, involved companies (developer and publisher), `summary`, `storyline`, and `game_time_to_beat` (hastily, normally, completely, in seconds). `external_games` gives Steam, GOG and PlayStation Store (US) IDs.

Risks:

1. **The Twitch agreement contradicts the IGDB FAQ on storage.** The Twitch Developer Services Agreement, Schedule 1 §C, says: "Do not store copies of Twitch Content or Program Materials, unless you: (a) obtain prior written authorization from Twitch (through these terms or otherwise); … or (c) cache such information for only a twenty-four hour time period". IGDB's own FAQ allowing storage reads as that authorization "otherwise", but it is a judgement call to record in the ADR. The same agreement also requires: deleting all Twitch Data on termination (§VI.F and the Term clause), which matches ADR-0004's purge rule; "a clear path to the source from displays of Program Materials" plus attribution (§VII.C); and honouring deletions and changes (Schedule 1 §C). Twitch may also terminate "for any reason or no reason at all" ([Twitch Developer Services Agreement](https://legal.twitch.com/legal/developer-agreement/), shown as last modified 11/01/2023).
2. **IGDB has no Ukrainian titles** (**checked 2026-11-19**). IGDB's `game_localizations` are keyed by *region*, not language (a region's `category` is "locale" or "continent"), and `alternative_names` are free-text names with a `comment`. IGDB holds no Ukrainian names. Some games have Russian alternative names, and `search` matches Cyrillic only through them. Wikidata has uk/ru labels for the one game checked (below). #248 settled this by keeping games English-only.
3. **The schema keeps changing.** IGDB moved its enums to tables, with old field names removed after a migration window of "February 18 to August 31". The docs give no year (**unverified**, likely 2025). `category` → `game_type` and `status` → `game_status` are examples. Expect more such migrations.
4. **Covers disappear.** "Images that are removed or replaced from IGDB.com exist for 30 days before they are removed" ([IGDB docs, Images](https://api-docs.igdb.com/)). The cron has to refresh `cover.image_id` well within 30 days, or the page must fall back to a placeholder. ADR-0012 sets a maximum entry age of 21 days for this reason.
5. **Token handling.** "Your Access Token is only active for 60 days and your application can only have 25 active Access Tokens at one time, going over this limit starts to inactivate older tokens" (FAQ). The Worker has to store the token (for example in a D1 row) and reuse it, not request a new one per invocation. ADR-0012 stores it in a D1 table, `source_tokens`.
6. **The key holder needs a Twitch account with 2FA**, and the app registered as a Confidential client. This is a one-time Operator step.

## Comparison

| Source | Cost for us (2026-11) | Auth / Worker fit | Rate limit | Caching terms | Covers | Model: one game across platforms? | uk/Cyrillic | Verdict |
|---|---|---|---|---|---|---|---|---|
| **IGDB** | Free (non-commercial and commercial) | Twitch client credentials; server-only; fine | 4 req/s, 8 open, per key | IGDB FAQ: allowed and preferred; Twitch DSA: 24 h unless authorized (see risk 1) | Portrait `cover_big` 264×374 (+2x), hotlink OK (tested) | Yes: game + per-platform release dates; editions via `version_parent`, DLC via `parent_game` | Region-keyed localizations; no Ukrainian names; Cyrillic search matches Russian alternative names only (checked 2026-11-19) | **Recommended** (adopted, ADR-0012) |
| Wikidata | Free, no key | Plain GET; fine | Not checked (**unverified**) | Licence not re-checked this session (**unverified**; Wikidata states CC0) | None (P18 was a screenshot for the game checked) | Yes: one item, platforms P400, dates P577 with platform qualifiers | uk + ru labels found; Cyrillic search works (tested) | **Add-on** for uk titles and cross-IDs (not adopted: games have no Ukrainian title, #248) |
| RAWG | Free ≤ 20,000 req/month, non-commercial or small | `key` query param; fine | 20,000/month (per key) | Not addressed in ToS | Landscape `background_image` only; no portrait cover | Yes: game with `platforms[].released_at`; DLC/editions via `/additions`, `/parent-games` | `name_original`, `alternative_names`; Cyrillic **unverified** | Possible fallback, weaker |
| MobyGames | **Paid**: Hobbyist $9.99/month since ~March 2025 | `api_key`; fine | 0.2–1 req/s by tier (sources conflict) | Must credit; no resale | Yes (**unverified** details) | Yes (game with platforms) | **unverified** | Rejected (ADR-0001) |
| Giant Bomb | Free historically; API missing from Nov 2025 relaunch | API host serves a Cloudflare challenge to non-browser clients (tested) | ~200/resource/hour (**unverified**, secondary) | **unverified** | Yes | Yes | **unverified** | Rejected (availability) |
| TheGamesDB | Free key from forum; monthly allowance | `apikey` param | Monthly allowance (spec example: 249 left, 30-day refresh) | **unverified** | Box art | **No**: one record per game *per platform* | **unverified** | Rejected (model, quota) |
| Steam Store (unofficial) | Free, no key | GET; fine | Undocumented (**unverified**) | Web API ToS: 100,000 calls/day; store endpoints undocumented | Portrait `library_600x900` (tested) | PC only; one app per store product | uk descriptions/genres, but English names; Cyrillic search returned 0 (tested) | Rejected as source; maybe PC extras |
| PlayStation Store | No public API found | — | — | — | — | — | — | Rejected |
| ScreenScraper | Free dev account | `devid`/`devpassword` | Per-user quotas, threads | Data CC BY-NC-SA 4.0 (site footer) | Retro media | ROM-oriented | **unverified** | Rejected (retro/ROM focus) |
| OpenCritic | RapidAPI; free Basic ~200 req/day, 25 searches/day (**unverified**, secondary) | RapidAPI key | As left | **unverified** | Some | Review-focused | **unverified** | Rejected |

## Per-candidate findings

### IGDB

Owner: Twitch (Amazon). Docs: [api-docs.igdb.com](https://api-docs.igdb.com/), read in full on 2026-11-16. All quotes below are from that page unless marked otherwise.

- **Cost and eligibility.** "The IGDB.com API is free for non-commercial usage under the terms of the Twitch Developer Service Agreement." The FAQ says: "The API is free for both non-commercial and commercial projects". Commercial partners are asked for "user facing attribution to IGDB.com". Partners also get daily CSV data dumps, which are "exclusively available to our Data Partners".
- **Auth.** You need a Twitch account with 2FA, an app registered in the Twitch Developer Portal (OAuth Redirect URL `localhost`, Client Type Confidential) and a Client Secret. Then `POST https://id.twitch.tv/oauth2/token?client_id=…&client_secret=…&grant_type=client_credentials` returns `access_token` and `expires_in`. Every request sends the headers `Client-ID` and `Authorization: Bearer <token>`. Requests are `POST https://api.igdb.com/v4/<endpoint>` with an Apicalypse text body. Tokens last 60 days, and at most 25 can be active. Browsers get CORS errors: "The IGDB API does not support browser requests". A live call without a token got **401** with "Authorization Failure" tips.
- **Rate limits.** "There is a rate limit of 4 requests per second. If you go over this limit you will receive a response with status code 429 Too Many Requests. You are able to have up to 8 open requests at any moment in time." The limit is tied to the key. Whether IGDB also limits per IP is **unverified**, but no IP limit is documented.
- **Caching, attribution, alteration.**
  - The IGDB FAQ allows storage and prefers it (quoted above).
  - Under the Twitch DSA, Schedule 1 §C allows only 24 h of caching unless authorized "through these terms or otherwise". It also forbids "Re-syndication and re-distribution". Cached results must be updated, deleted when Twitch reports them deleted, and changes honoured.
  - §VII forbids commingling Program Materials or deleting the portions that "reveal incomplete data sets". It requires updating them "frequently" and "a clear path to the source", meaning a link to the IGDB page. §VI.F and the Term clause require deleting all Twitch Data on termination. ([Twitch DSA](https://legal.twitch.com/legal/developer-agreement/))
  - The FAQ also says partners may keep data after a partnership ends. That applies to commercial partnerships, not the plain DSA.
- **Covers.** The URL is `https://images.igdb.com/igdb/image/upload/t_{size}/{image_id}.jpg`. Sizes: `cover_small` 90×128, `cover_big` 264×374 (portrait, about 0.71), `720p`, `1080p`, `screenshot_*`, `thumb`, `micro`. Append `_2x` for retina. Live test on 2026-11-16: `t_cover_big`, `t_cover_big_2x` and `t_720p` all answered 200 `image/jpeg` with a foreign Referer, served by CloudFront with `max-age=31536000, immutable`. Removed or replaced images last 30 days.
- **Coverage.** The `platforms` endpoint covers all platforms. Main games per platform were counted on 2026-11-19 (**checked**, figures under "Live checks on 2026-11-19"). Indie titles were not counted separately. Wikidata does hold an IGDB ID for S.T.A.L.K.E.R. 2 (below).
- **Data model.**
  - `game` fields include `game_type` (main_game, dlc_addon, expansion, bundle, standalone_expansion, mod, episode, season, remake, remaster, expanded_game, port, fork, pack, update), `parent_game` ("If a DLC, expansion or part of a bundle, this is the main game or bundle"), `version_parent` and `version_title` ("If a version, this is the main game"; "Title of this version (i.e Gold edition)") and `platforms`.
  - It also has `release_dates`, one per platform and `release_region`, with a `date_format` precision (exact day, month, year, quarter or TBD). `first_release_date`, `remakes`, `remasters`, `ports`, `dlcs`, `expansions`, `bundles`, `franchises`, `collections` and `game_status` (released, early_access, cancelled, delisted…) are there too.
  - `external_games` gives the game's IDs elsewhere. Sources include steam, gog, epic_game_store, playstation_store_us and xbox_marketplace.
  - `expanded_game` is an edition kept as a game of its own, with a `parent_game` pointing to the main game (**checked 2026-11-19**). The Final Fantasy VII games #248's tests mirror show how IGDB splits one title: the 1997 PS1 game is 393025, its International edition is 427, a port is 207026, the 2005 Famicom game is 2406, and a cancelled one is 381337.
  - IDs are numeric, and there is a `slug`. Webhooks report create, update and delete, and a delete sends "only the ID". An unknown ID answers an empty array, not a 404 (**checked 2026-11-19**). Whether a *merged* ID answers the same way, or redirects, is still **unverified**.
- **Search.** `search "Halo";` on `/games`, or the `/search` endpoint, which returns `alternative_name` among its fields. The docs say nothing about fuzziness. A Cyrillic query matches only Russian alternative names: "сталкер" finds S.T.A.L.K.E.R.: Shadow of Chernobyl (320), and "відьмак" finds nothing (**checked 2026-11-19**). There are no Ukrainian results. Localized names come from `game_localizations` (`name`, `region`, and a `cover` per localization) and `alternative_names` (`name`, `comment`).
- **Extras.** `genres`, `themes`, `involved_companies` (each with `developer`, `publisher`, `porting` and `supporting` flags, per the docs' field list), `summary`, `storyline`, `game_time_to_beat`, `aggregated_rating`, `language_supports`.
- **Stability.** Twitch has owned IGDB since 2019 (**unverified** date), and the docs are actively maintained: a beta MCP server and PopScore are new. Signs of churn: the enum-to-table migration, and `follows` "DEPRECATED! - To be removed". The DSA lets Twitch revoke keys at will.

### Wikidata

- **No key.** A live `wbsearchentities` call with `search=Сталкер 2&language=uk` found Q10865101 "S.T.A.L.K.E.R. 2: Серце Чорнобиля" (description "українська відеогра 2024 року"). Its entity has labels in en ("S.T.A.L.K.E.R. 2: Heart of Chornobyl"), uk and ru ("S.T.A.L.K.E.R. 2: Сердце Чернобыля").
- **Platforms and release dates.** Platforms are under P400. Release dates are under P577, qualified by platform, so per-platform dates exist.
- **External IDs:** P5794 is the IGDB game ID, here a slug (`stalker-2-heart-of-chornobyl`). P1733 is the Steam application ID (`1643320`). P2725 holds GOG IDs, one per edition. P6278 is the Epic ID, and P5971 (Europe PlayStation Store ID) was empty for this game.
- **No covers.** P18 was a screenshot, since box art is usually non-free and absent from Commons.
- Licence, rate-limit and User-Agent policy were **unverified** in this session.

What it is good for: the Ukrainian Localized Title, taken from the Wikidata label of the item whose P5794 equals the IGDB slug, and possibly Cyrillic search. It costs one more subrequest per add or refresh. Coverage of small indie games is **unverified**.

### RAWG

- Operated by "Behind the Games, UAB". The ToS was last updated 1 March 2021 ([RAWG API ToS](https://rawg.io/tos_api)).
- **Free terms.** Free tier: "non-commercial projects only, up to 20,000 requests per month, and required backlinks". Free use requires attributing RAWG and adding "an active hyperlink from every page where the data of RAWG is used" ([rawg.io/apidocs](https://rawg.io/apidocs)). The OpenAPI spec also says "No cloning" ([spec](https://api.rawg.io/docs/?format=openapi)).
- **Storage and redistribution.** The ToS does not address caching. It forbids further distribution (4.3(5)) and copying or publishing content without consent (6.2), which is ambiguous for a cache.
- **Auth.** The key goes in the query string. A live call without it got 401 `{"error": "The key parameter is not provided"}`.
- **Model and search.**
  - A game has `name`, `name_original`, `alternative_names` and `platforms[]`, each with `released_at`.
  - `/games/{id}/additions` covers "DLC's for the game, GOTY and other editions", and `/parent-games` points from DLC and editions back to their game.
  - Search takes `search`, `search_precise` ("Disable fuzziness") and `search_exact`.
  - Some endpoints are business-tier only.
- **Images.** Only `background_image`, which is landscape. There is no portrait cover, so it does not fit the app's poster grid. Request quotas "might be changed by RAWG unilaterally" (8.5).
- **Unverified:** Cyrillic search, how actively it is maintained, and per-IP behaviour.

### MobyGames

- **Paid only.** Free API access ended in about March 2025. MobyGames' forum post "Important Changes to MobyPro Subscription Service" introduced a Hobbyist tier at $9.99/month for non-commercial use. The subscribe page lists Hobbyist at 1 request/s, while the forum post said 0.2/s, so the sources conflict.
  - Both pages are on mobygames.com and refused automated fetches (403). These facts come from search-index excerpts of [the forum post](https://www.mobygames.com/forum/3/thread/270120/important-changes-to-mobypro-subscription-service/) and [the subscribe page](https://www.mobygames.com/api/subscribe/), so they are **unverified** against the pages themselves.
  - A live call without a key got 401: "You must have an API key to use this resource."
- **Terms.** Data must credit MobyGames, with no repackaging or resale (**unverified**, from the same excerpt).
- **Rejected:** a recurring fee breaks ADR-0001.

### Giant Bomb

- **Ownership.** Fandom sold Giant Bomb in May 2025 ([Fandom announcement](https://about.fandom.com/news/fandom-sells-giant-bomb-to-independent-creators)). Operations moved to Jeffinitely, LLC as of 20 August 2025, per its privacy policy (**unverified**, from a search excerpt).
- **API status.** The relaunch post listed APIs among features "that won't be ready at launch" ([The brand new Giant Bomb site](https://giantbomb.com/articles/the-brand-new-giant-bomb-site), from a search excerpt, **unverified**). A January 2026 post said the video API was in testing.
- **Live test.** `/api/search/` redirected to `giantbomb.com` and then served a Cloudflare "Attention Required" challenge page to a non-browser client. A Worker would likely be blocked the same way.
- **Rejected:** availability and longevity.

### TheGamesDB

- **Spec.** The OpenAPI spec is served at [api.thegamesdb.net/spec.yaml](https://api.thegamesdb.net/spec.yaml). Its example responses show a monthly allowance: `remaining_monthly_allowance: 249`, `allowance_refresh_timer: 2592000` (30 days).
- **Keys.** You request one on the forum (**unverified**). A live call without a key got `418 I'm a teapot`.
- **Model.** Each game record has one `platform`, so a game on PC and PS5 is two records. That is the same split that ruled out Google Books in ADR-0011.
- **Rejected.**

### Steam Store (PC only)

- **Terms.** The [Steam Web API Terms of Use](https://steamcommunity.com/dev/apiterms) were last updated in July 2010. The API is free, with "one hundred thousand (100,000) calls to the Steam Web API per day". Valve "may change or terminate the Steam Web API entirely".
- **Undocumented endpoints.** The catalog endpoints, `store.steampowered.com/api/storesearch` and `/api/appdetails`, are not part of the documented Web API (**unverified** that they are covered by those terms).
- **Live tests.**
  - `storesearch?term=сталкер&l=ukrainian` returned `{"total":0}`, but `term=stalker` found S.T.A.L.K.E.R. 2.
  - `appdetails?appids=1643320&l=ukrainian` returned Ukrainian genres ("Бойовики"…), description and release date ("20 листоп. 2024"), but the name in English.
  - `library_600x900.jpg` portrait art answered 200.
- **Rejected as the source:** PC only, undocumented, and IDs belong to store products, not works. It could supply PC extras later, through IGDB's `external_games` Steam ID.

### PlayStation Store

No official public API was found. Only unofficial wrappers and paid scrapers exist (for example [mrt1m/playstation-store-api](https://github.com/mrt1m/playstation-store-api)). IGDB's `external_games` carries `playstation_store_us` IDs if store links are ever wanted. **Rejected.**

### ScreenScraper

- **Access.** The [API page](https://www.screenscraper.fr/webapi2.php) needs `devid` and `devpassword`. Quotas (`maxrequestspermin`, `maxrequestsperday`) and threads depend on the user's level.
- **Purpose.** It identifies games by ROM (CRC, file name), for emulator front-ends. Its footer says the data is "licensed under the terms of Creative Commons Attribution-NonCommercial-ShareAlike 4.0".
- **Rejected:** retro and ROM focus. Modern PS4/PS5 and PC coverage is **unverified**.

### OpenCritic

- Accessed through RapidAPI. A live call without a key got 400.
- A free Basic plan of about 200 requests/day and 25 searches/day is reported only by a secondary source (**unverified**).
- It is review-focused. **Rejected.**

### Not checked

PCGamingWiki (MediaWiki/Cargo API), SteamGridDB (images only) and HowLongToBeat (no official API) were not looked at (**unverified**).

## Live checks on 2026-11-19

Made with a real key during the grilling session for #248:

- **No Ukrainian names.** IGDB holds no Ukrainian names.
- **Cyrillic search.** It matches only Russian alternative names: "сталкер" finds S.T.A.L.K.E.R.: Shadow of Chernobyl (320), and "відьмак" finds nothing.
- **`expanded_game` is an edition.** It has a `parent_game`. So the Media Item filter leaves it out, along with games that have a `version_parent`.
- **An unknown ID answers an empty array**, not a 404.
- **Main games per platform:** PS1 about 3,500, PS2 about 3,700, PS3 about 3,600, PS4 about 13,600, PS5 about 9,700, PC about 181,000.

## Open questions for the domain design

Each question was decided in the grilling session for #248 on 2026-11-19 and recorded in ADR-0012. The decision follows each question.

1. **What a game Media Item is.** Proposal: an IGDB `game` whose `game_type` is main_game, remake, remaster, expanded_game, standalone_expansion or port, with External Reference (igdb, game, id). Is a remake or remaster its own Media Item? IGDB says yes. Are DLC and expansions (`parent_game` set) loggable at all, or hidden from Search? Editions (`version_parent` set) should probably fold into their main game, as book editions fold into a work.
   *Decided:* main_game, remake, remaster and standalone_expansion, with no `version_parent` and not cancelled. `expanded_game` is an edition and is left out, as are DLC and expansions. A remake or remaster is its own Media Item.
2. **Ports.** IGDB keeps some ports as separate games (`game_type` port). Should Search hide them, or show them as Media Items of their own?
   *Decided:* hidden. A port is the same work on another platform.
3. **Platforms.** Should a game show all its platforms, or only PC and PlayStation (PS1–PS5)? Should Search filter by them? Does a User's Log Entry or In Progress record *which platform they played on*? That is User data like a book's page count, and would be a new field.
   *Decided:* all platforms, by abbreviation, up to three in a result row and then "+N". No platform filter, and no platform on a Log Entry or an In Progress: a User who wants to note it writes it in their Review or a Thought.
4. **Year.** Should we show `first_release_date` (any platform, any region), or the earliest PC/PS date from `release_dates`?
   *Decided:* the year of `first_release_date`.
5. **Ukrainian Localized Title.** Should it come from IGDB `game_localizations` and `alternative_names` (shape unverified), from a Wikidata label via P5794, or not exist for games? Most games keep their English title in Ukraine. And how does a Cyrillic query search? Options: IGDB search as is, or a Wikidata uk search mapped back to IGDB.
   *Decided:* none. Games have only an English title, and IGDB search is used as is. When a query finds nothing, the UI says "Try the English title".
6. **Cache expiry.** TMDB sets 90 days and Open Library none. For IGDB, the FAQ allows storage, but the DSA's 24-hour clause is still in its text, and a refresh is needed within 30 days to keep covers. Is a refresh interval under 30 days and a "disposable cache, purge on termination" rule enough?
   *Decided:* yes. The IGDB FAQ is treated as the authorization "otherwise" that the DSA allows, the cache is purged if Twitch ends access, and the maximum entry age is 21 days.
7. **Progress shape for games.** Hours played, percent, or none? IGDB's `game_time_to_beat` could provide an estimate, but ADR-0005 says Progress is never checked against the cache.
   *Decided:* none. A game can be In Progress ("Playing") without Progress.
8. **Unavailable games.** What do a merged or deleted IGDB ID return? An empty array is likely (**unverified**). Do IGDB webhooks (deletes send only the ID) suit a Worker endpoint, or should the cron detect them as it does for TMDB?
   *Decided:* an unknown ID answers an empty array (checked), and that counts toward unavailability, as TMDB's 404 does. There are no webhooks: the cron finds changes.
9. **Attribution.** The UI needs an IGDB credit with "a clear path to the source": a link to the game's IGDB `url` on its page, next to the TMDB and Open Library credits.
   *Decided:* both, the link on the game's page and the credit line.
