# TMDB as the film metadata source; we own only identifiers and user data

Film metadata (titles, posters, years, credits) comes from the TMDB API under its non-commercial licence. We persist only the External Reference of each catalog-backed Media Item plus data our Users create (Log Entries, Lists, Manual Media Items); TMDB remains the source of truth for everything else.

## Consequences

- TasteTrack must stay non-commercial: TMDB's licence forbids commercial use (for example charging users) without a separate agreement.
- The UI must show the TMDB logo and the notice "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB."
- TMDB metadata is cached, which the terms allow for up to 6 months; we use a hard expiry of 90 days. The cache is disposable: the app must keep working if it is wiped, and if API access ends all cached TMDB content must be purged.
- Metadata comes in two languages, English and Ukrainian, and no others (revised 2026-10-19, when the interface switched from Ukrainian to English):
  - **Search** makes one TMDB call in the query's language: uk-UA when the query contains a Cyrillic letter, otherwise en-US. Results are shown in that language; a film TMDB has no translation for in that language comes back titled with its Original Title, not the English one.
  - **Stored titles**: each cache entry holds the English Localized Title, the Ukrainian Localized Title when TMDB has one, and the Original Title, so the cache is keyed by External Reference alone, not by language. All three come from the single details call made on add: `/movie/{id}?language=en-US&append_to_response=translations`. The English title is the response's `title`, the Ukrainian one is the `data.title` of the translation whose `iso_639_1` is `uk`, and the Original Title is `original_title`. The `translations` list holds only real translations, with no fallback from another language, and an entry can exist with an empty title: an empty or missing Ukrainian title counts as none. (Checked against the real TMDB API on 2026-10-19: `append_to_response=translations` is supported, and both the search and the details `title` fall back to the Original Title, never to English, when the requested language has no translation.)
  - **Display**: the English Localized Title first, falling back to the Original Title, with the Original Title and year alongside when it differs (e.g. "Amélie (Le Fabuleux Destin d'Amélie Poulain, 2001)"); the Ukrainian Localized Title, when present and different, as a secondary line ("Амелі").
  - Manual Media Items are User data with a title in any language and are shown unchanged.
- The cache lives in D1, not KV: KV Free allows only 1,000 writes a day.
- Workers Free allows 50 external subrequests per invocation, cron runs included, so the cache is filled when an item is added (search result plus one details call) and there is **no refresh-on-read**. A Cron Trigger every 15 minutes refreshes a small batch of the oldest entries and detects Unavailable Media Items. A page fetches at most 10 cache misses and shows placeholders for the rest. Only items referenced by a Log Entry or List Item are refreshed; unreferenced entries are deleted.
- Only a TMDB 404 counts toward unavailability, and only after 3 checks at least 24 hours apart with no success in between. 401/403 indicate an API access problem: they alert the Operator and never trigger conversion.
- Manual Media Items are User data, not TMDB content: they are never cached, never expire and are unaffected by a purge.

## MVP phasing

The MVP ships the cache filled on add (including the details call), the cron refresh and the D1 storage. Unavailable Media Item detection, auto-conversion and Operator alerts come later. Until then, an item TMDB deletes keeps its cached title only until the 90-day hard expiry.

## Judgement call: converting Unavailable Media Items

When TMDB stops returning an item and its title is still cached, every affected User gets their own Manual Media Item, and their Log Entries and List Items move to it. Only bare facts (title, year) are copied into this user-owned data, never TMDB's descriptive content or images. We treat a work's title and year as facts about the work rather than TMDB Content, so these converted items are permanent User data and survive a purge. Without this, a TMDB deletion would leave Users with ratings and Reviews attached to an unnamed ID.
