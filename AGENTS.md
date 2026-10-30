# TasteTrack

## Git workflow

Never commit or push to `main`. Every change, including docs, goes on its own branch and lands through a pull request; `main` is protected on GitHub and rejects direct pushes.

- Branch off an up-to-date `main`: `git switch main && git pull && git switch -c <type>/<short-slug>`.
- Branch types: `feat/`, `fix/`, `docs/`, `chore/`, `test/`, `refactor/`. Add the issue number when there is one, e.g. `feat/12-log-entry-form`.
- `prototype/<issue>-<slug>` holds a throwaway prototype. It is pushed but never gets a PR or merges; its issue links to it, and the chosen design is rebuilt with tests on a `feat/` branch.
- Open the PR with `gh pr create`, link the issue with `Closes #<n>` in the body.
- If you find yourself on `main` with uncommitted work, create a branch first (`git switch -c ...`); the work moves with you.
- Commit messages and PR titles follow Conventional Commits (`feat: ...`, `fix(scope): ...`); commitlint checks both in CI.
- Hooks in `.githooks/` block commits on `main` and run commitlint on each commit message. Enable them once per clone with `git config core.hooksPath .githooks`.

## Deployed environments

Staging and production share one D1 free-tier write budget per Cloudflare account (100,000 rows written a day); once it is spent, writes fail in production too. Tests against a deployed URL (`BASE_URL` set) must be smoke-only and write little: only tests tagged `@smoke` run there, and a `@smoke` test never fills Lists or the Watchlist in bulk. Tag a new test `@smoke` only when it covers a key journey no other smoke test does. Cron Triggers run in production only. See ADR-0006.

## UI conventions

- Build UI from shadcn/ui components in `src/client/components/ui/`. Add missing ones with `pnpm dlx shadcn@latest add <name>`, then point any `cn` import at `@/lib/utils`.
- Style with theme tokens only: semantic utilities such as `bg-primary`, `text-muted-foreground`, `border-border`, `rounded-lg`, never palette colours (`text-red-600`, `text-white`), hex values or inline colour styles. Every colour, the radius and the font are defined once in `src/client/styles.css`; a new colour need becomes a new token there, in both light and dark.
- Mobile first: write unprefixed classes for a phone screen, and add `sm:`/`md:` only to adapt upwards.
- UI text goes through `t()` and the English catalogue in `src/client/i18n/en.ts`.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on YuraRavaR/tastetrack, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Cloud sessions

Setting up or debugging a Claude Code cloud session: see `docs/agents/cloud-sessions.md`.
