# TasteTrack

## Git workflow

Never commit or push to `main`. Every change, including docs, goes on its own branch and lands through a pull request; `main` is protected on GitHub and rejects direct pushes.

- Branch off an up-to-date `main`: `git switch main && git pull && git switch -c <type>/<short-slug>`.
- Branch types: `feat/`, `fix/`, `docs/`, `chore/`, `test/`, `refactor/`. Add the issue number when there is one, e.g. `feat/12-log-entry-form`.
- Open the PR with `gh pr create`, link the issue with `Closes #<n>` in the body.
- If you find yourself on `main` with uncommitted work, create a branch first (`git switch -c ...`); the work moves with you.
- A pre-commit hook in `.githooks/` blocks commits on `main`. Enable it once per clone with `git config core.hooksPath .githooks`.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on YuraRavaR/tastetrack, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
