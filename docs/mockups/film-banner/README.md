# Film banner: the whole backdrop, fading into the page

**Issue:** none yet. It replaces the banner in [`film-page/`](../film-page/README.md) (layout step 1), which `components/FilmBanner.tsx` builds today.
**Picked:** variant B, cinematic hero, on 2026-11-09. The phone as drawn in round 2, the web as "B · web v3" in round 2, and the edge cases in round 3.
**Canvas:** <https://claude.ai/artifact/MKCUw122dmo15QAit4WMdG> (private). Three pages:

1. **Round 1 · Amélie.** A: the whole picture at 16:9. B: a cinematic hero, the picture fading into the page. C: a sharp poster on the blurred backdrop. D: the same height as today, the picture whole, its sides filled with a blurred copy.
2. **Round 2 · B and C.** B and C with two awkward films: Spirit (2002), with a long title and five genres, and Hello Kitty (2028), not out yet, whose TMDB backdrop is a date card. B's web layout went through three versions; v3 is the pick.
3. **Round 3 · Edge cases.** Light theme, no backdrop (two options), no poster, neither.

## Why

Today the banner has a fixed height: `h-46` (184 px) on a phone, `sm:h-65` (260 px) from `sm`, with `object-cover`. TMDB backdrops are 16:9, so in the ~720 px web column (about 2.8:1) a third of the picture is cut off at the top and bottom. On a phone the loss is small (184 px against the 201 px the picture needs).

B shows the whole picture and makes the poster part of the page again, which the phone layout made the user like most. On the web, the first B (picture on the right, text on the left over its faded edge) read as two separate pieces; v3 is the phone layout scaled up into one column, so both widths share one composition.

## Files

| File | Shows |
| --- | --- |
| `film-banner.html` | The film's page of a film watched once, with a backdrop and a poster. Phone layout below `sm`, the column from `sm`. |
| `film-banner-390-light.png`, `-390-dark.png` | Phone |
| `film-banner-1440-light.png`, `-1440-dark.png` | Desktop |
| `film-banner-edge-cases.html` and its PNGs | No backdrop, no poster, and neither, top of the page only |
| `canvas/` | All three rounds as canvas sources. `R2BPhone.dc.html` is the phone pick, `R3BWeb.dc.html` the web pick, `EdgePhone.dc.html` and `EdgeWeb.dc.html` the edge cases. Images are canvas uploads (`/_blob/…`), so they show only on the canvas. |

## Layout, top to bottom

The film's page gets a wider column: from `max-w-3xl` (768 px) to 1008 px with 24 px padding (960 px of content), so the 16:9 picture has room on the web. The section below replaces the banner and the title block; the stat tiles, actions and Viewings keep their design from `film-page/` and `search-results/`, only moved under the poster.

| | Phone (below `sm`) | From `sm` |
| --- | --- | --- |
| **Picture** | The backdrop, `w780`, full bleed (no side padding, no corner radius), `aspect-ratio: 16 / 9`, `object-cover` (so nothing is cut). | The backdrop, `w1280`, the column's full width, 16:9. |
| **Picture's edges** | Only the bottom fades: a gradient from transparent at 45% to `--background` at 100%, over the picture. | Every edge is feathered with a `mask-image`, not an overlay: left and right fade over 18% of the width, the bottom from 45% down to 0 at 100%, the top barely (60% opacity at the very edge, full by 8%). The stops are eased (see `film-banner.html`), so no line shows where the fade starts. No glow or blurred copy behind it: the user tried one and it drew a dark band. |
| **Poster** | `w500`, 104×156, `rounded-md` (10 px), a border and a soft shadow, pulled up 72 px over the picture's bottom. | 176×264, `rounded-lg`, pulled up 172 px. |
| **Beside the poster** | Title (`h1`, 21 px, 700), Ukrainian Localized Title (14 px, 600, muted), facts (13 px, muted), bottom-aligned with the poster, 14 px gap. | 34 px title, 15 px lines, 28 px gap, the row indented 24 px from the column. |
| **Then** | Stat tiles, actions, Viewings, full width, 18 px apart. | The same, full column width, 20 px apart, indented like the poster row. |

The banner keeps reserving its space before the images arrive (the 16:9 box and the poster's size are fixed), so nothing shifts.

## Edge cases

| The film has | The picture area | The poster's place |
| --- | --- | --- |
| Backdrop and poster | The backdrop | The poster |
| Poster, no backdrop | **The poster, blurred** (`blur(24px)` on a phone, `36px` from `sm`, `saturate(1.3)`, scaled up ~1.3 so the blur has no soft border), with the same fades as a backdrop | The poster, sharp |
| Backdrop, no poster | The backdrop | The film's no-poster placeholder (`film-page/`'s ten). At 104×156 on a phone it is icon-only (smaller than 112×168); from `sm` it shows its caption. |
| Neither | **None**: the picture area is left out and the poster row starts at the top of the page (16 px from the header on a phone), not pulled up | The placeholder |

The user picked the blurred poster over leaving the area out when only the backdrop is missing ("poster only" was the other option), so a film without a backdrop still opens the same way.

## Light theme

The fades go to `--background` (cream), so the picture melts into the paper the same way it melts into the dark ground. Checked on round 3 and in the light screenshots; no change needed.

## Open questions

None raised by the user. For the issue: the full-bleed phone picture means the film's page drops its side padding above the poster row below `sm`.
