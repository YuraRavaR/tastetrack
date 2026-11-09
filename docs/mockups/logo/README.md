# Logo: the cover fan and a stacked Sora wordmark

**Issue:** #147, "Logo: a wordmark for the header and a mark for icons". The favicon (#149) and the link preview (#150) build on it.
**Picked:** the cover fan mark (round 1, variant D) with wordmark 7, Sora stacked (round 3), on 2026-11-09.
**Canvas:** <https://claude.ai/artifact/X1WWdVwjzPgZUMkeve5SFr> (private). Four pages:

1. **Round 1 · Marks.** A bookmark with a star cut out, an italic T on a gold tile, a ticket stub, and the cover fan. Each in the header (phone and web, light and dark), alone at 16, 32, 180 and 512 px, and on a 1200×630 card.
2. **Round 2 · Wordmark.** The cover fan with four plain sans wordmarks: Geist, DM Sans lowercase, Manrope in two weights, Instrument Sans in spaced capitals.
3. **Round 3 · Modern wordmark.** Eight more, from Geist lowercase to a serif and sans mix. Number 7 is Sora 700 on two lines.
4. **Pick.** The pick in every place the issue asks for.

## Files

| File | Shows |
| --- | --- |
| `logo.html` | The header with the logo (the section nav from `md`), the mark alone at 16 px in a browser tab, 32 px, 180 px on a home-screen tile and 512 px, then the link card scaled to the column. |
| `logo-390-light.png`, `-390-dark.png` | Phone |
| `logo-1440-light.png`, `-1440-dark.png` | Desktop |
| `canvas/` | Every round as canvas sources. `DSheet.dc.html` is the mark, `R3b.dc.html` holds wordmark 7, `Pick.dc.html` is the pick. |

## The pick

**The mark.** Three covers fanned like the Saved tile: two behind, turned 14° either way about the bottom centre, and one in front with a five-point star. On a 32 grid (`viewBox="0 0 32 32"`), each cover is 13×19 at (9.5, 6.5) with a 2.5 corner, turned about (16, 25.5); the star's path is in `logo.html`.

| Part | Colour |
| --- | --- |
| Outline of every cover, 1.75 wide | `currentColor`: the text colour, so dark on paper and near white in dark theme |
| Front cover | `--primary` |
| Covers behind | `--primary-soft` |
| Star | `--primary-foreground`, in both themes: dark on gold, like the text on a primary button |

**The wordmark.** "Taste" over "Track", Sora 700, line height 0.95, letter spacing −0.035em. It replaces Fraunces italic: `--font-brand` becomes Sora.

**In the header.** The link holds the mark, then the wordmark, and keeps a 44 px touch target.

| | Phone (below `md`) | From `md` |
| --- | --- | --- |
| Mark | 34 px | 36 px |
| Wordmark | 16 px | 17 px |
| Gap | 7 px | 8 px |

**The link card.** 1200×630, always in light colours: the mark at 232 px and the wordmark at 112 px (line height 0.92, letter spacing −0.045em), 28 px apart; under them the slogan "Your taste, on the record" at 38 px in `--muted-foreground`. Padding 88 px top and bottom, 96 px at the sides. Built in #150.

## Settled

Settled with the User on 2026-11-09. Where the mockup differs, this section wins.

- **The font.** Sora 700 is self-hosted from `@fontsource/sora` (weight 700 only), in line with ADR-0001, and `@fontsource-variable/fraunces` goes. This replaces rule 6 of [`accent/`](../accent/): the app name is no longer a serif.
- **Text, not a picture.** The wordmark is HTML text in `font-brand`, so it stays sharp and follows the theme; the link's accessible name stays "TasteTrack" (`t("app.name")`), and the two lines are hidden from screen readers. The mark is an SVG in `src/client/assets/` whose parts use the colours above: no new token.
- **The star stays dark** in dark theme; only the outline turns light. A light star on gold does not show.
- **Fixed colours belong to the icons.** A favicon or a PNG cannot follow the theme, so the favicon's colours are #149's call and the card's PNG is #150's. #147 builds the header and the SVG.
- **The slogan** is "Your taste, on the record". It appears on the link card; nowhere in the app yet.
