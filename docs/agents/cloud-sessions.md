# Cloud sessions

Claude Code cloud sessions (claude.ai/code, `claude --remote`) run in a fresh container. The setup comes in two parts:

- **The environment** on claude.ai provides the tools: Node and pnpm. Its image ships Node 22, whose Corepack can't run pnpm 12, so the setup script installs both itself.
- **The SessionStart hook** in `.claude/settings.json` runs `scripts/cloud-session-setup.sh` once the repo is cloned. A new session can start from a cached clone that is behind GitHub, so on startup the script first pulls (from `main` on a session's own `claude/` branch, which has no upstream) and then runs its updated copy. The session's PATH can still lead to the image's Node 22, so the script first puts the setup script's Node 24 ahead of it, for the whole session. Then it runs `pnpm install`, the Chromium build that the locked Playwright expects (the image's preinstalled one is older), and the Git hooks. Locally `CLAUDE_CODE_REMOTE` is unset, so the script exits straight away.

Start each session with `YuraRavaR/tastetrack` selected; without it the container has no repo, and the session can't push a branch.

## The environment

**Network access:** Limited, with package managers on, plus these domains:

```
nodejs.org
cdn.playwright.dev
playwright.download.prss.microsoft.com
playwright.azureedge.net
```

**Setup script:**

```bash
#!/bin/bash
set -euo pipefail

# Node 24, the major in .nvmrc
if ! node -v | grep -q '^v24'; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh"
    nvm install 24
    nvm alias default 24
  else
    npm install -g n
    n 24
    hash -r
  fi
fi

# pnpm switches itself to the exact version in package.json's packageManager
npm install -g pnpm@12
```

Bump both majors here when `.nvmrc` or `packageManager` moves to a new one.

**Environment variables:** `WRANGLER_SEND_METRICS=false`. Leave `BASE_URL` unset, since it points the tests at a deployed environment (see ADR-0006), and leave `CI` unset, since it adds the GitHub reporter.

## Skills

A cloud session can't install the `mattpocock-skills` plugin, since it sees only what the repo holds. So `.claude/skills/` carries a copy of the plugin's skills (v1.3.1, commit `49dd158`, MIT), and `.claude/settings.json` turns the plugin off in this repo to avoid listing each skill twice. To update them, re-copy from a newer plugin release, leaving out `implement` and each skill's `agents/` folder. Claude Code's built-in `code-review` shows up in place of the copy with that name.

`/implement <issue>` is this repo's own skill, not the plugin's. A user invokes it by typing it; it stays out of the skill list a session's agent reports.

## GitHub access

Pushing needs the Claude GitHub App on the repo; reading works without it. Connect it at https://claude.ai/connect-github, then start a new session.

## Known failures in the container

The hook's output lists the test failures that come from the container rather than the code, and the blocked GitHub GraphQL calls, so the agent sees them at the start of each session. `session_notes` in `scripts/cloud-session-setup.sh` is the one place to keep them current.
