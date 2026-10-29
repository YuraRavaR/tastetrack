# Mockups

Approved designs, one folder per screen. An issue that changes a screen links its folder, and the implementation is checked against the screenshots in it.

## A screen's folder

| File | What it is |
| --- | --- |
| `README.md` | What was picked and why, the layout top to bottom, copy, states, and the questions still open. The source for the issue. |
| `<screen>.html` | The picked design as one static page. Open it in a browser; dark mode follows the system setting. |
| `<screen>-<width>-<light\|dark>.png` | Screenshots at 390 and 1440 px. An agent reads these with its image tool before writing code. |
| `canvas/` | The Design canvas sources (`canvas.json` and `*.dc.html`), all variants included, so the canvas can be rebuilt or extended. Not meant to be opened directly. |

The static pages use the colours from `src/client/styles.css`, copied as CSS variables. They are pictures of the design, not code to copy: the app builds the screen from shadcn/ui components and theme tokens, as `AGENTS.md` says.

## Workflow

1. **Explore on a canvas.** Claude draws 2–3 variants of the screen on a Design canvas on claude.ai, using real data from the glossary's language.
2. **Review in the browser.** Click an element, leave a comment, and send it to Claude. Claude changes the canvas and resolves the thread.
3. **Pick and save.** The picked variant becomes `<screen>.html` here, with its screenshots, its `README.md`, and the canvas in `canvas/`.
4. **Write the issue.** The issue links the folder and turns the README's decisions into acceptance criteria. Open questions are settled first.
5. **Build it.** On a `feat/` branch, with tests, matching the screenshots at 390 and 1440 px in light and dark.

## Screenshots

```sh
node docs/mockups/shoot.mjs <folder>
```

Shoots every `.html` in the folder at 390 and 1440 px, in light and dark, with the Chromium Playwright already uses. Extra states (a menu open, say) are shot by hand and named `<screen>-<width>-<state>-<light|dark>.png`.

## Screens

| Folder | Screen | Issue | Picked |
| --- | --- | --- | --- |
| [`film-page/`](film-page/) | The film's page (Item History) | #64 | Variant C, stats strip |
| [`accent/`](accent/) | Accent colour, ground and display font | #63 | Gold · Paper |
| [`navigation/`](navigation/) | Header, bottom tab bar and home with several Media Types | #58 (phone header), new issues to come | Variant A, by section |
| [`log-entry-dialog/`](log-entry-dialog/) | The "Watched" dialog: Rating, date, Review, Rewatch; a bottom sheet on a phone | none yet | Variant A, full form |
| [`search-results/`](search-results/) | Search results, and the film's page before a first viewing | #62 | Search C, icon actions; page A, button row |
