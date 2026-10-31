# Changelog

## [0.6.0](https://github.com/YuraRavaR/tastetrack/compare/v0.5.0...v0.6.0) (2026-10-31)


### Features

* lead the film's page with stat tiles and newest-first Viewings ([#91](https://github.com/YuraRavaR/tastetrack/issues/91)) ([4e09828](https://github.com/YuraRavaR/tastetrack/commit/4e098281b8089b3c4c855f9cc122fdc1f6b0d23e))
* link search results to the film's page and keep the query in the URL ([#90](https://github.com/YuraRavaR/tastetrack/issues/90)) ([f0d8e0b](https://github.com/YuraRavaR/tastetrack/commit/f0d8e0b3d9924621983b3a21fbab4d8a111cf908))
* log and plan a film from its page ([#94](https://github.com/YuraRavaR/tastetrack/issues/94)) ([d101772](https://github.com/YuraRavaR/tastetrack/commit/d10177260c11d9cc2455f6848c67e7b7928fc4ea)), closes [#74](https://github.com/YuraRavaR/tastetrack/issues/74)
* open the film's page with its TMDB backdrop ([#92](https://github.com/YuraRavaR/tastetrack/issues/92)) ([12ca465](https://github.com/YuraRavaR/tastetrack/commit/12ca46520b6effd07f2a38820d87d70fa797d509)), closes [#72](https://github.com/YuraRavaR/tastetrack/issues/72)
* rebuild the Watched dialog with date chips, Today by default ([#93](https://github.com/YuraRavaR/tastetrack/issues/93)) ([15f7799](https://github.com/YuraRavaR/tastetrack/commit/15f77999ef51c646cf58aa1dbd9be1f3511f70dd))
* show a playful placeholder for a film without a poster ([#89](https://github.com/YuraRavaR/tastetrack/issues/89)) ([0c12867](https://github.com/YuraRavaR/tastetrack/commit/0c12867d4ee2ddd933de54b98b32391da1677349))
* show a search result's Rating and Lists, with Mark watched and Watched again ([#95](https://github.com/YuraRavaR/tastetrack/issues/95)) ([2cb121f](https://github.com/YuraRavaR/tastetrack/commit/2cb121fdef557eae1d7e8d3f01d51d8cb1cd7a98)), closes [#82](https://github.com/YuraRavaR/tastetrack/issues/82)
* take a film off the Watchlist from search, with Watched as the main action ([#80](https://github.com/YuraRavaR/tastetrack/issues/80)) ([80012e9](https://github.com/YuraRavaR/tastetrack/commit/80012e9309bad0eb6507fc1c80f3d40db18d9a85))


### Reverts

* remove the Claude Code cloud session setup ([#88](https://github.com/YuraRavaR/tastetrack/issues/88)) ([7dc4319](https://github.com/YuraRavaR/tastetrack/commit/7dc43194e9cf2e5ce6e9d4a0034837906ff0b5e8))

## [0.5.0](https://github.com/YuraRavaR/tastetrack/compare/v0.4.0...v0.5.0) (2026-10-30)


### Features

* add a film to Lists from home search and from its page ([#60](https://github.com/YuraRavaR/tastetrack/issues/60)) ([70cc984](https://github.com/YuraRavaR/tastetrack/commit/70cc984b65bc7610271903a711bf3e3b09ac629a))
* lead home with the search and the latest Log Entries ([#67](https://github.com/YuraRavaR/tastetrack/issues/67)) ([8ef785b](https://github.com/YuraRavaR/tastetrack/commit/8ef785b3255a815ec442b9fd8ee8ddca7fc82d73))
* navigate by section with a bottom tab bar and an account menu ([#79](https://github.com/YuraRavaR/tastetrack/issues/79)) ([74bbfda](https://github.com/YuraRavaR/tastetrack/commit/74bbfda298602a31065730ab2d0f6e9da974432e)), closes [#58](https://github.com/YuraRavaR/tastetrack/issues/58)
* repaint the app in Gold · Paper, with red only for destructive actions ([#78](https://github.com/YuraRavaR/tastetrack/issues/78)) ([1ddf1f1](https://github.com/YuraRavaR/tastetrack/commit/1ddf1f1c7e41b2d3a5c73b2a5b65f40c7c9920c1)), closes [#63](https://github.com/YuraRavaR/tastetrack/issues/63)
* show the top of the Watchlist beside the Log on home ([#77](https://github.com/YuraRavaR/tastetrack/issues/77)) ([f43a64d](https://github.com/YuraRavaR/tastetrack/commit/f43a64d619d014abd4f216132afa17b565b7eebd))

## [0.4.0](https://github.com/YuraRavaR/tastetrack/compare/v0.3.0...v0.4.0) (2026-10-26)


### Features

* show a film's runtime and genres on its page and in the Watchlist and Lists ([#51](https://github.com/YuraRavaR/tastetrack/issues/51)) ([2c0735d](https://github.com/YuraRavaR/tastetrack/commit/2c0735dad66cf2824367423f613a3cd7c804f604)), closes [#50](https://github.com/YuraRavaR/tastetrack/issues/50)
* write dates month first, "Oct 26, 2026" ([#54](https://github.com/YuraRavaR/tastetrack/issues/54)) ([897c611](https://github.com/YuraRavaR/tastetrack/commit/897c61191f9eb3bceda38cfbebf43e90739f0b6d)), closes [#53](https://github.com/YuraRavaR/tastetrack/issues/53)

## [0.3.0](https://github.com/YuraRavaR/tastetrack/compare/v0.2.0...v0.3.0) (2026-10-26)


### Features

* add films TMDB doesn't have as Manual Media Items, seen only by their User ([#36](https://github.com/YuraRavaR/tastetrack/issues/36)) ([7113921](https://github.com/YuraRavaR/tastetrack/commit/7113921da1e2f6dd3ffe008380879b9831907a37))
* build named Lists of films, ordered and noted, without touching the Log ([#35](https://github.com/YuraRavaR/tastetrack/issues/35)) ([a2c80a7](https://github.com/YuraRavaR/tastetrack/commit/a2c80a7446e690ee23d283e8430af95ff31bf537))
* keep the TMDB cache fresh from a cron, and fill a cold cache progressively ([#41](https://github.com/YuraRavaR/tastetrack/issues/41)) ([dc73b1f](https://github.com/YuraRavaR/tastetrack/commit/dc73b1fce7d80bb979289508b29aeb3dfb5bbcbb))
* let a User delete their account and everything in it, confirmed with their password ([#45](https://github.com/YuraRavaR/tastetrack/issues/45)) ([97ebbfd](https://github.com/YuraRavaR/tastetrack/commit/97ebbfde7e1ac6a325179b8c1864f64fbe09e085))
* let a User set their Display Name and change their password in Settings ([#42](https://github.com/YuraRavaR/tastetrack/issues/42)) ([5d59fac](https://github.com/YuraRavaR/tastetrack/commit/5d59facfccb1c63b69cf045effa1c2f2ec566ccd))
* let the Operator reset a forgotten password to a Temporary Password ([#43](https://github.com/YuraRavaR/tastetrack/issues/43)) ([24b8e0d](https://github.com/YuraRavaR/tastetrack/commit/24b8e0d1cb7b0de4e66995be7fb6090ed7434d2b))
* lock a Username for 15 minutes after 5 failed logins from one IP ([#44](https://github.com/YuraRavaR/tastetrack/issues/44)) ([5e8f16b](https://github.com/YuraRavaR/tastetrack/commit/5e8f16bc27cec083303a9108fd8bd2279d1c2b07)), closes [#9](https://github.com/YuraRavaR/tastetrack/issues/9)
* plan films on a Watchlist, reorder and note them, and logging takes them off with an undo ([#33](https://github.com/YuraRavaR/tastetrack/issues/33)) ([bbf032c](https://github.com/YuraRavaR/tastetrack/commit/bbf032cbebda970fce490a77048d5a18cce00264))
* share any List, the Watchlist included, through an unguessable Share Link ([#37](https://github.com/YuraRavaR/tastetrack/issues/37)) ([02f6179](https://github.com/YuraRavaR/tastetrack/commit/02f6179fdce551bb7244595f510803effc6e0831)), closes [#18](https://github.com/YuraRavaR/tastetrack/issues/18)


### Bug Fixes

* **catalog:** never show a TMDB cache entry past its 90-day hard expiry ([#46](https://github.com/YuraRavaR/tastetrack/issues/46)) ([0c81fd1](https://github.com/YuraRavaR/tastetrack/commit/0c81fd1bb86002c74e976dfdcb47fb27f574d40e))
* **catalog:** stop entries TMDB never answers for from taking every cron batch ([#49](https://github.com/YuraRavaR/tastetrack/issues/49)) ([20e1f3c](https://github.com/YuraRavaR/tastetrack/commit/20e1f3c1c75dfd6b1e637893f627bb41ad045ddc)), closes [#40](https://github.com/YuraRavaR/tastetrack/issues/40)
* **deps:** bump the production-dependencies group with 3 updates ([#47](https://github.com/YuraRavaR/tastetrack/issues/47)) ([4255766](https://github.com/YuraRavaR/tastetrack/commit/42557667025f921bdbf0c42e411e256062ca8eb4))

## [0.2.0](https://github.com/YuraRavaR/tastetrack/compare/v0.1.0...v0.2.0) (2026-10-19)


### Features

* film search as you type, in English or Ukrainian ([#30](https://github.com/YuraRavaR/tastetrack/issues/30)) ([1ecbd0a](https://github.com/YuraRavaR/tastetrack/commit/1ecbd0aceb815851021b17534f6d54eb7567fee6))
* invite codes and registration, on an English interface ([#29](https://github.com/YuraRavaR/tastetrack/issues/29)) ([e2c8332](https://github.com/YuraRavaR/tastetrack/commit/e2c8332d252817a1247a8e585e39585b5314e002))
* log a film from search with a Rating, and see it in the Log ([#31](https://github.com/YuraRavaR/tastetrack/issues/31)) ([55ad814](https://github.com/YuraRavaR/tastetrack/commit/55ad8141d22bd9ce79388558272fa394c87c6fdc)), closes [#13](https://github.com/YuraRavaR/tastetrack/issues/13)
* operator bootstrap, login and logout, on a shadcn/ui foundation ([#27](https://github.com/YuraRavaR/tastetrack/issues/27)) ([eb097c5](https://github.com/YuraRavaR/tastetrack/commit/eb097c5b8eec619f9c61976db8730e734fc00bc1))
* see a film's Item History and Current Rating, and edit or delete Log Entries ([#32](https://github.com/YuraRavaR/tastetrack/issues/32)) ([1db845e](https://github.com/YuraRavaR/tastetrack/commit/1db845e2b8f9d79daf07ffe82f939e7e4d6333e4))

## 0.1.0 (2026-10-19)


### Features

* walking skeleton with one Worker serving the API and the app ([#21](https://github.com/YuraRavaR/tastetrack/issues/21)) ([1a1489f](https://github.com/YuraRavaR/tastetrack/commit/1a1489f75bf3d98b204af9c6f05b6bd0d324d276))
