---
name: implement
description: Take a GitHub issue from a fresh branch to an open pull request.
argument-hint: "#<issue>"
disable-model-invocation: true
---

Implement issue $ARGUMENTS. Work through the steps in order; each ends on its done condition.

If a `mattpocock-skills` skill named below isn't available, do that step by hand and say so in the hand-over.

## 1. Read the issue

Fetch the issue as `docs/agents/issue-tracker.md` describes and state its title. Read its parent, its comments and every mockup or design it links.

Stop and ask the user when the issue lacks the `ready-for-agent` label, an issue blocking it is still open, or `gh` can't reach GitHub.

**Done:** you can name every acceptance criterion.

## 2. Branch

Start from the newest `main`, whatever the session checked out:

```bash
git fetch origin main
git switch -c <type>/<n>-<slug> FETCH_HEAD
```

**Done:** `HEAD` is the commit `git ls-remote origin main` reports.

## 3. Build

Call `mattpocock-skills:tdd` and work red to green, one acceptance criterion at a time. Run the typecheck and the touched test files often. Commit as you go.

**Done:** every acceptance criterion has a test that went red and then green, or a stated reason it has none.

## 4. Review

Call `mattpocock-skills:code-review` on the changes since the commit this branch started from, and fix what it finds.

**Done:** every finding is fixed, or listed for the hand-over with a reason.

## 5. Verify

Run `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` and `pnpm exec playwright test`.

**Done:** all four are green, apart from failures the cloud session's setup message names as known.

## 6. Open the pull request

Push the branch. Write the body with `mattpocock-skills:pr`, put `Closes #<n>` in it, and open it with `gh pr create`.

When the cloud session refuses the branch name, push to the branch it allows. When `gh` can't open the pull request, give the user the branch, the title and the body.

**Done:** the pull request exists and CI has started, or the user holds everything needed to open it.

## 7. Hand over

The user reviews every design by hand, so report:

- the pull request link
- each changed screen with its route and the state to reach it
- anything left undone, and each review finding you left open
