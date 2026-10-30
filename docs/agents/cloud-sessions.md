# Cloud sessions

Claude Code cloud sessions (claude.ai/code, `claude --remote`) run in a fresh container. The setup comes in two parts:

- **The environment** on claude.ai provides the tools: Node and pnpm. Its image ships Node 22, whose Corepack can't run pnpm 12, so the setup script installs both itself.
- **The SessionStart hook** in `.claude/settings.json` runs `scripts/cloud-session-setup.sh` once the repo is cloned. The session's PATH can still lead to the image's Node 22, so the script first puts the setup script's Node 24 ahead of it, for the whole session. Then it runs `pnpm install`, the Chromium build that the locked Playwright expects (the image's preinstalled one is older), and the Git hooks. Locally `CLAUDE_CODE_REMOTE` is unset, so the script exits straight away.

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

## Known failures in the container

The hook's output lists the test failures that come from the container rather than the code, so the agent sees them at the start of each session. That list in `scripts/cloud-session-setup.sh` is the one to keep current.
