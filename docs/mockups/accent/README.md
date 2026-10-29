# Accent colour: gold on paper

**Issue:** #63, "Give the accent a colour that doesn't read as an error".
**Picked:** Gold · Paper (2026-10-29). A yellow-gold accent on a cream "paper" ground. The type follows Gold · Cinema instead: Fraunces italic for the app name only (decided with the "Watched" dialog, see [`log-entry-dialog/`](../log-entry-dialog/)).
**Canvas:** <https://claude.ai/artifact/5yaKsgb6CfDyN2oHRnki2h> (private). It shows today's red, ink, blue and ochre on the first row, and gold in four looks on the second, each in light and dark.

## Files

| File | Shows |
| --- | --- |
| `accent-gold-paper.html` | One phone screen with everything the accent touches. |
| `accent-gold-paper-390-light.png`, `-390-dark.png` | Phone |
| `accent-gold-paper-1440-*.png` | The same column on a desktop |
| `canvas/` | Every palette and look as canvas sources. `GoldPaper.dc.html` is the pick; `Screen.dc.html` holds all the token values. |

The specimen screen has:

- the search field focused, with a theme-coloured clear button;
- the "In your Log" and "On your Watchlist" marks and the stars;
- a primary "Watched" button;
- the edit dialog, with Delete next to Save;
- the delete confirmation;
- the active bottom tab.

## What changes

1. **The accent is gold, not red.** Red is left to destructive actions, and is darker and redder than today, so Save and Delete never look alike.
2. **Gold needs dark text.** White on yellow-gold fails contrast, so `--primary-foreground` is a dark brown in both themes.
3. **Accent text needs its own token.** Gold text on a light surface fails contrast. A new `--primary-strong`, a darker gold, carries every accent used as text or outline on light surfaces: the marks, the active tab, the star outlines. In dark theme it equals `--primary`.
4. **Marks sit on a soft gold pill.** A new `--primary-soft` gives "In your Log", "On your Watchlist" and the active tab their background.
5. **The ground is paper.** The background, cards and muted surfaces are slightly warmer cream.
6. **Only the app name is a serif.** A new font token, `--font-brand`, set to Fraunces, is used for "TasteTrack" in the header, in italic at weight 600, as in Gold · Cinema. Everything else stays in the system sans, including headings, dialog titles and Media Item titles.

   The specimen page and `GoldPaper.dc.html` still show Fraunces on headings and titles, as first picked. This rule replaces them.
7. **The focus ring is neutral grey.**
8. **Radius grows from 10px to 14px.** Buttons and fields stay at `rounded-md` (10px).
9. **The search field's native clear button goes.** Hide `::-webkit-search-cancel-button` and use a shadcn ghost icon button in `bg-muted` / `text-muted-foreground` instead.

## Tokens for `src/client/styles.css`

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `oklch(0.97 0.012 80)` | `oklch(0.18 0.01 60)` |
| `--foreground` | `oklch(0.2 0.01 50)` | `oklch(0.96 0.004 75)` |
| `--card`, `--popover` | `oklch(0.995 0.006 85)` | `oklch(0.22 0.012 60)` |
| `--card-foreground`, `--popover-foreground` | = foreground | = foreground |
| `--primary` | `oklch(0.82 0.16 88)` | `oklch(0.84 0.16 90)` |
| `--primary-foreground` | `oklch(0.22 0.02 60)` | `oklch(0.17 0.006 50)` |
| `--primary-strong` (new) | `oklch(0.52 0.11 80)` | `oklch(0.84 0.16 90)` |
| `--primary-soft` (new) | primary at 20% over card, ≈ `oklch(0.96 0.037 87)` | primary at 15% over card, ≈ `oklch(0.31 0.034 85)` |
| `--secondary`, `--muted` | `oklch(0.935 0.016 75)` | `oklch(0.28 0.014 60)` |
| `--secondary-foreground` | `oklch(0.25 0.01 50)` | = foreground |
| `--muted-foreground` | `oklch(0.47 0.02 60)` | `oklch(0.74 0.02 70)` |
| `--accent` (hover) | `oklch(0.93 0.035 85)` | `oklch(0.3 0.03 85)` |
| `--accent-foreground` | `oklch(0.25 0.01 50)` | = foreground |
| `--destructive` | `oklch(0.46 0.18 25)` | `oklch(0.66 0.2 22)` |
| `--destructive-foreground` | `oklch(0.985 0 0)` | `oklch(0.17 0.006 50)` |
| `--border` | `oklch(0.88 0.015 75)` | `oklch(1 0 0 / 11%)` |
| `--input` | `oklch(0.85 0.015 75)` | `oklch(1 0 0 / 15%)` |
| `--ring` | `oklch(0.55 0.012 55)` | `oklch(0.66 0.012 60)` |
| `--radius` | `0.875rem` | |
| `--font-brand` (new) | `"Fraunces Variable", Georgia, serif` | |

Each new token also gets its `@theme inline` line (`--color-primary-strong`, `--color-primary-soft`, `--font-brand`), so `text-primary-strong`, `bg-primary-soft` and `font-brand` exist.

**Where the classes change:**

- `text-primary` marks become `text-primary-strong`.
- `Rating` keeps `fill-primary` and draws the star outline with `text-primary-strong`.

**The font:** self-host Fraunces from `@fontsource-variable/fraunces` (the italic file only; it is used at weight 600) instead of loading it from Google, in line with ADR-0001. The mockup loads it from Google only for convenience.

## Contrast (computed from the OKLCH values, WCAG 2)

| Pair | Light | Dark | Needs |
| --- | --- | --- | --- |
| Text on background | 16.6 | 16.8 | 4.5 |
| Muted text on card / on muted | 6.8 / 5.7 | 7.5 / 6.3 | 4.5 |
| Text on primary (Save, Watched) | 9.9 | 11.7 | 4.5 |
| Accent text on card | 5.5 | 10.6 | 4.5 |
| Accent text on its soft pill | 5.0 | 8.0 | 4.5 |
| Destructive text on card | 7.7 | 5.1 | 4.5 |
| Text on destructive (Delete) | 7.5 | 5.6 | 4.5 |
| Focus ring on background | 4.5 | 6.0 | 3 |
| Star outline on card | 5.5 | 10.6 | 3 |

For comparison, today's dark theme puts white text on the destructive red at 2.8:1, which fails.

## Open questions

1. ~~**Star outline.**~~ Settled: `--primary-strong`, which reads browner than the canvas's lighter gold (`oklch(0.66 0.14 78)`, 3.2:1) but needs no extra token.
2. ~~**Serif for Media Item titles everywhere?**~~ Settled: no. Titles are in the sans; only the app name is a serif.
3. ~~**Cyrillic.**~~ Settled by 2: Ukrainian Localized Titles are in the sans, which has Cyrillic. The serif sets only the Latin word "TasteTrack".
