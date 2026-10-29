# The "Watched" dialog (a new Log Entry)

**Issue:** none yet.
**Picked:** variant A, full form (2026-10-29), with the type of Gold · Cinema: Fraunces italic for the app name only, the system sans for everything else (see [`accent/README.md`](../accent/README.md)).
**Canvas:** <https://claude.ai/artifact/4UZspYZfZfh5dyjrLFGknL> (private). It has three variants, each on an iPhone 17 Pro (402×874) and the web.

## Files

| File | Shows |
| --- | --- |
| `log-entry-dialog-a.html` | Variant A at any width. Below 768px it is a bottom sheet; from 768px it is a centred dialog. Stars, date chips, Rewatch, Save and Close work. Open it with `#unrated` to start with no Rating. |
| `log-entry-dialog-a-390-light.png`, `-390-dark.png` | Phone: bottom sheet |
| `log-entry-dialog-a-390-other-date-light.png` | Phone, "Other date" picked: the date field shows |
| `log-entry-dialog-a-390-no-rating-light.png` | Phone, Save pressed with no Rating: the error shows |
| `log-entry-dialog-a-1440-light.png`, `-1440-dark.png` | Desktop: centred dialog |
| `canvas/` | All three variants as canvas sources. `Main.dc.html` and `FormWeb.dc.html` are variant A. |

## Why A

Every field is in view, so nothing is hidden behind a tap, and the form stays close to today's `LogEntryDialog`. It changes how the dialog looks and how a date is picked, not what it asks for.

These variants were not picked:

- **B, stars first.** Big stars, with the date and the Review in rows that open on tap. It is quicker for a Rating alone, but it hides the date and the Review.
- **C, review first.** A near full-height sheet built around the Review, with the date and Rewatch as chips next to Save. On the web it is a side panel.

## Layout, top to bottom (phone first)

It is one shadcn `Dialog` at every width, restyled below `md`. There is no `Drawer` or `Sheet` and no new dependency.

**Phone (below `md`).** The dialog sits at the bottom over a scrim, as a sheet. It has a `rounded-t-[28px]` top and a sticky footer padded for the home indicator with `env(safe-area-inset-bottom)`. It grows up to 48px below the top of the screen, and its body scrolls. It has no grabber and no swipe to close: Close, Cancel (from `md`) and Esc close it.

**From `md`.** A centred dialog, `max-w-[480px]`, 72px from the top. Cancel sits next to Save.

1. **Header.**
   - A poster thumbnail: 36×54 on a phone, 40×60 from `md`, or the no-poster placeholder.
   - The eyebrow "Watched" in `text-primary-strong text-xs font-semibold`.
   - The film's title as the dialog title (`text-xl font-semibold`, sans), with the year and runtime in `text-muted-foreground text-sm`.
   - A 44×44 ghost close button, named "Close".
2. **Rating.** Legend "Rating".
   - Five stars, 44px on a phone and 40px from `md`. Each star is two radio inputs, its left and right halves, as in `RatingInput` today.
   - The Rating as a number beside the stars ("4.5"), or "–" with none.
   - Saving without a Rating shows "Choose a Rating." in `text-destructive` under the stars.
3. **Date (optional).** Four toggle chips:
   - **Today** (picked by default), **Yesterday**, **Other date** and **No date**.
   - "Other date" shows a native date input under the chips, from 1900-01-01 to today in the User's time zone.
   - A chip is `rounded-full`, 44px tall on a phone and 36px from `md`. A picked chip has `border-primary-strong bg-primary-soft font-semibold`.
4. **Review (optional).** A labelled 4-row textarea with the placeholder "What stayed with you?" and a 10,000 character limit.
5. **Rewatch.** Above a top border, the label "Rewatch" and the hint "You've watched it before", with a switch on the right (`role="switch"`). The switch track is `bg-primary` when on and `bg-input` when off. It starts on when the User already has a Log Entry for the film.
6. **Footer.**
   - Save is `bg-primary`: full width and 50px tall on a phone, beside Cancel (outline) from `md`.
   - The hint "Saving takes it off your Watchlist" shows only when the film is on the Backlog. It sits under Save on a phone and left of the buttons from `md`.

After Save, the dialog closes and the toast "Added {film} to your Log." appears (the existing `logEntry.saved`).

## Copy

| Key | Text | New? |
| --- | --- | --- |
| Eyebrow | Watched | reuses `search.watched` |
| Dialog title | {film} | replaces `logEntry.title` "Log {film}" |
| Date chips | Today · Yesterday · Other date · No date | new, except `logEntry.noDate` |
| Date input | Date watched (accessible name) | new |
| Review placeholder | What stayed with you? | new |
| Optional marker | (optional) | replaces the date hint "Optional. Leave it empty if you don't remember." |
| Backlog hint | Saving takes it off your Watchlist | new |

`logEntry.description` ("Rate it, and add when you watched it…") goes. The dialog keeps an accessible description by pointing `aria-describedby` at the year and runtime line.

## Open questions

1. ~~**Date by default.**~~ Settled: "Today" starts picked, so a Log Entry has a date unless the User picks "No date".
2. ~~**Bottom sheet component.**~~ Settled: the existing `Dialog`, restyled below `md`. `Drawer` (vaul) would add swipe to close, but it needs a new dependency and a second component for the web, and swipes are harder to test. `Sheet` has neither swipe nor a grabber. Without swipe, a grabber would invite a drag that does nothing, so the sheet has none.
3. ~~**"No date" wraps on a 390px phone.**~~ Settled: the wrap stays, and the labels keep their full text.
4. ~~**Edit uses the same form.**~~ Settled: the edit dialog ("Edit your entry for {film}") gets the same layout, with Delete in the footer. It isn't mocked yet. It opens with the chip that matches the entry's date: "Today" or "Yesterday" for those dates, "No date" for an undated entry, and "Other date", with the date in the field, for any other.
