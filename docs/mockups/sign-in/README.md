# Sign in: Log in, Register, Set a new password

**Issue:** none yet.
**Picked:** variant A, "Plain card" (2026-11-07).
**Canvas:** <https://claude.ai/artifact/BBVA5bbe38tn7KpHXVm4Sj> (private). One variant a row, each on an iPhone 17 Pro (402×874) and on the web: A plain card, B poster wall (posters beside the form, errors under their field), C editorial (the app name large, Log in and Register as tabs).

Variant A keeps today's forms: the fields and copy of `LoginPage`, `RegisterPage` and `NewPasswordPage` and their strings in `en.ts`. It moves them into the Gold · Paper frame of the redesign ([`saved/`](../saved/)).

## Files

| File | Shows |
| --- | --- |
| `sign-in-a.html` | All three forms at any width. States by hash: Log in with no hash, `#loginError`, `#locked`, `#deleted`, `#register`, `#inviteExpired`, `#inviteUsed`, `#inviteUnknown`, `#usernameTaken`, `#newPassword`, `#passwordReused`. The links, the submits, the Username check as you type and the account menu work. |
| `sign-in-a-390-light.png`, `-390-dark.png`, `-1440-light.png`, `-1440-dark.png` | Log in |
| `sign-in-a-390-loginError-light.png`, `-dark`, `-1440-…` | Log in, "Wrong Username or password" |
| `sign-in-a-390-register-light.png`, `-dark`, `-1440-…` | Register |
| `sign-in-a-390-inviteExpired-light.png`, `-dark`, `-1440-…` | Register, the Invite Code has expired |
| `sign-in-a-390-usernameTaken-light.png`, `-dark`, `-1440-…` | Register, the Username is taken |
| `sign-in-a-390-newPassword-light.png`, `-dark`, `-1440-…` | Set a new password, with the account menu in the header |
| `canvas/` | All three variants as canvas sources. `Main.dc.html` and `AWeb.dc.html` are variant A. |

## Variant A, as picked

- **Frame, logged out.** The header holds the app name only (Fraunces italic). No tab bar, no section nav. From `md` the footer "Film data from TMDB · v0.6.0" shows, as on every page.
- **Frame, a new password to set.** The app name and, on the right, the avatar (with the name from `md`). Its menu holds one item: Log out, with its icon. No tab bar, no section nav.
- **Card.** One centred card, `max-w-sm` (24rem), on `bg-card` with a `border-border` line and an 18px radius. Full width less 16px gutters on a phone; from `md` a light shadow and 72px above it.
- **Heading.** 24px bold: "Log in", "Register", "Set a new password".
- **Fields.** A label in 14px semibold above each 44px input. Inputs use 16px text on a phone, so iOS does not zoom.
- **Rules.** Under a field in 13px `muted-foreground`, as today: "3–30 characters: letters, digits and underscores", "10–128 characters, anything you like", "10–128 characters, anything you like, but not the Temporary Password".
- **Errors.** Above the button, as in the app now, in `destructive`, with a small alert-circle icon. The field at fault gets a `destructive` border and `aria-invalid`.
- **Button.** Full width, 44px, `bg-primary`: "Log in", "Register", "Set password".
- **Switch link.** Centred under the button in `muted-foreground`, the link in `primary-strong`: "Have an Invite Code? Register", "Already have an account? Log in".

### Log in

- Username, Password.
- After deleting the account: "Your account and everything in it have been deleted." in `muted-foreground`, above the button.
- Errors: "Wrong Username or password"; "Too many failed attempts. Try again in 15 minutes."; "Couldn't log in. Please try again."

### Register

- Invite Code (letter-spaced, autocapitalised), Username, Password, each with its rule.
- The Username rule turns `destructive` as you type an invalid name; Register does nothing until it is valid.
- Errors: "That Invite Code has expired. Ask for a new one."; "That Invite Code has already been used. Ask for a new one."; "That Invite Code doesn't exist. Check it, or ask for a new one." (all three mark the Invite Code field); "That Username is taken. Please choose another." (marks the Username field). Typing in the marked field clears the error.

### Set a new password

- Under the heading: "You logged in with a Temporary Password. Choose your own to carry on; it logs you out everywhere else."
- New password, with its rule.
- Error: "That's the Temporary Password. Choose one of your own." Typing clears it.

## Settled

Settled in a grilling on 2026-11-08. Where the mockup differs, this section wins.

- **Register** has no Display Name field; it defaults to the Username and changes in Settings.
- **"Forgot password?"** goes under the Password field once Recovery Codes ship. Not drawn now.
- **Errors** mark the field they are about, the Invite Code field too.
- **The error icon** goes on every form error, here and in Settings.
- **Register's header** has no "Log in" link; the switch link under the form is enough.
