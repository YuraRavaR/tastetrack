# TMDB as the film metadata source; we own only identifiers and user data

Film metadata (titles, posters, years, credits) comes from the TMDB API under its non-commercial licence. We persist only the External Reference of each catalog-backed Media Item plus data our Users create (Log Entries, Lists, Manual Media Items); TMDB remains the source of truth for everything else.

## Consequences

- TasteTrack must stay non-commercial: TMDB's licence forbids commercial use (for example charging users) without a separate agreement.
- The UI must show the TMDB logo and the notice "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB."
- TMDB metadata is cached, which the terms allow for up to 6 months; we use a hard expiry of 90 days. The cache is disposable: the app must keep working if it is wiped, and if API access ends all cached TMDB content must be purged.
- Metadata is requested in Ukrainian (uk-UA) with English as fallback, so the cache key includes the language. The Original Title is always kept alongside the Localized Title.
- The cache lives in D1, not KV: KV Free allows only 1,000 writes a day.
- Workers Free allows 50 external subrequests per invocation, cron runs included, so the cache is filled when an item is added (search result plus one details call) and there is **no refresh-on-read**. A Cron Trigger every 15 minutes refreshes a small batch of the oldest entries and detects Unavailable Media Items. A page fetches at most 10 cache misses and shows placeholders for the rest. Only items referenced by a Log Entry or List Item are refreshed; unreferenced entries are deleted.
- Only a TMDB 404 counts toward unavailability, and only after 3 checks at least 24 hours apart with no success in between. 401/403 indicate an API access problem: they alert the Operator and never trigger conversion.
- Manual Media Items are User data, not TMDB content: they are never cached, never expire and are unaffected by a purge.

## MVP phasing

The MVP ships the cache filled on add (including the details call), the cron refresh and the D1 storage. Unavailable Media Item detection, auto-conversion and Operator alerts come later. Until then, an item TMDB deletes keeps its cached title only until the 90-day hard expiry.

## Judgement call: converting Unavailable Media Items

When TMDB stops returning an item and its title is still cached, every affected User gets their own Manual Media Item, and their Log Entries and List Items move to it. Only bare facts (title, year) are copied into this user-owned data, never TMDB's descriptive content or images. We treat a work's title and year as facts about the work rather than TMDB Content, so these converted items are permanent User data and survive a purge. Without this, a TMDB deletion would leave Users with ratings and Reviews attached to an unnamed ID.
