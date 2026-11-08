# Account menu, Settings and Invites

**Issue:** none yet.
**Picked:** variant A, "Stacked cards" (2026-11-07).
**Canvas:** <https://claude.ai/artifact/QETN25kkb658D8LjPRi8Pb> (private). One variant a row, each on an iPhone 17 Pro (402×874) and on the web: A stacked cards, B grouped list (settings as rows that open one form at a time), C one Account page (Settings and Invites as sections).

The account menu on the avatar is part of the frame from [`saved/`](../saved/). The Settings and Invites pages keep today's content, restyled to match the redesign.

## Files

| File | Shows |
| --- | --- |
| `account-a.html` | Settings at any width with no hash, the account menu open at `#menu`, Invite Codes at `#invites`, and Invite Codes with no active codes at `#invitesEmpty`. The menu opens and closes, its items switch pages, the forms show their result, and "Generate an Invite Code" adds codes up to 5, then shows the limit message. |
| `account-a-390-light.png`, `-390-dark.png`, `-1440-light.png`, `-1440-dark.png` | Settings |
| `account-a-390-menu-light.png`, `-dark`, `-1440-…` | The account menu: a bottom sheet on a phone, a dropdown on the web |
| `account-a-390-invites-light.png`, `-dark`, `-1440-…` | Invite Codes with two active codes |
| `account-a-390-invitesEmpty-light.png`, `-dark`, `-1440-…` | Invite Codes with none |
| `canvas/` | All three variants as canvas sources. `Main.dc.html` and `AWeb.dc.html` are variant A. |

## Variant A, as picked

**Frame.** The logged-in frame from [`saved/`](../saved/): header, bottom tab bar Saved · Collections · Search on a phone, header nav from `md`, footer "Film data from TMDB · v0.6.0". On Settings and Invites no tab and no header link is current.

**Account menu.**

- The trigger is the avatar on a phone. From `md` it is the avatar, the Display Name ("Yurii") and a chevron; it turns `bg-muted` while the menu is open. Its name is "Account menu" (`account.menu`).
- The items, top to bottom: Invites (ticket icon), Settings (gear icon), a separator, Log out (log-out icon). Icons are `text-muted-foreground`.
- The page you are on is marked with `bg-muted` in the menu.
- **Phone (below `md`).** A bottom sheet over the `--overlay` scrim, `rounded-t-[28px]`, its bottom padded with `env(safe-area-inset-bottom)`. Items are 52px tall, 17px text, 22px icons. A tap on the scrim, Esc, or an item closes it.
- **From `md`.** A dropdown under the trigger, right-aligned, at least 200px wide, `rounded-xl` with a border and shadow. Items are 44px tall, 15px text, 17px icons. A click outside, Esc, or an item closes it.

**Settings.**

- The heading "Settings", then three cards stacked: `bg-card`, a border, `rounded-[18px]` on a phone and `rounded-[20px]` from `md`, 18px padding on a phone and 24px from `md`.
- **Display Name.** Card title "Display Name". The field "Display Name" (filled with the current name), the hint under it, then "Save Display Name" (primary). On save, "Display Name saved." appears above the button.
- **Password.** Card title "Password" and its description. Fields "Current password" and "New password" with the rule "10–128 characters, anything you like". Then "Change password" (primary). On success, "Password changed. You've been logged out everywhere else."
- **Delete account.** Card title "Delete account" and its description. The field "Your password", then "Delete account" in `bg-destructive text-destructive-foreground`. A wrong password shows "That isn't your password. Nothing was deleted." in `text-destructive`.
- Inputs are 44px tall on `bg-background`; 16px text on a phone so iOS does not zoom, and at most 28rem wide from `md`.

**Invites.**

- The heading "Invite Codes", then the explanation (at most 40rem wide from `md`), then "Generate an Invite Code" (primary).
- Active codes in one card, divided by borders. Each row: the code in monospace, 18px, letter-spaced, and "Expires Nov 9, 2026" in `text-muted-foreground`. On a phone they stack; from `md` the code sits left and the date right.
- With no codes, "You have no active Invite Codes." replaces the card.
- At 5 active codes, Generate shows "You already have 5 active Invite Codes. Wait for one to be used or to expire." in `text-destructive`.

**Width.** Full width with 16px gutters on a phone. From `md` the Settings and Invites pages are `max-w-3xl` (48rem), centred.

**Copy.** Every string comes from `src/client/i18n/en.ts`, except these two, which follow the rule that List is "Collection" in UI copy. The implementer updates `en.ts`:

| Key | Today | New |
| --- | --- | --- |
| `settings.displayNameHint` | "How others see you on lists you share. …" | "How others see you on collections you share. …" |
| `settings.deleteDescription` | "… your Log, Watchlist, Lists, the films you added by hand, …" | "… your Log, Watchlist, Collections, the films you added by hand, …" |

**Changes from the canvas, for consistency.** The phone sheet has no grabber and a 28px top radius, like the log-entry dialog ([`log-entry-dialog/`](../log-entry-dialog/)). Its scrim uses `--overlay`. The canvas's `--dest`/`--destfg` are `--destructive`/`--destructive-foreground`. The mockup shows the register URL as `https://tastetrack.example/register`.

## Settled

Settled in a grilling on 2026-11-08. Where the mockup differs, this section wins.

- **Register URL** in the Invites text comes from the app's own origin; `tastetrack.example` is a stand-in.
- **No tab** and no header link is highlighted on Settings and Invites.
- **The current page** is marked in the account menu with `bg-muted` at every width.
- **Visibility** gets a setting here only when Friends ships; nothing is drawn now.
