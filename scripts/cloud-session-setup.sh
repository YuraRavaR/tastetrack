#!/usr/bin/env bash
# The SessionStart hook in .claude/settings.json. A Claude Code cloud session starts from a bare
# clone, so this installs the locked dependencies and the Chromium build the locked Playwright
# expects. Anywhere else CLAUDE_CODE_REMOTE is unset and it exits before touching anything.
# Whatever it prints reaches the agent's context. See docs/agents/cloud-sessions.md.
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0

if [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" != "$(cut -d. -f1 .nvmrc)" ] ||
  ! command -v pnpm >/dev/null; then
  echo "Cloud session setup skipped: it needs Node $(cut -d. -f1 .nvmrc) and pnpm on PATH, and this"
  echo "container has Node $(node -v 2>/dev/null || echo none). The environment's setup script"
  echo "installs both; see docs/agents/cloud-sessions.md."
  exit 0
fi

log="${TMPDIR:-/tmp}/cloud-session-setup.log"
if ! {
  pnpm install --frozen-lockfile &&
    pnpm exec playwright install chromium &&
    git config core.hooksPath .githooks
} >"$log" 2>&1; then
  echo "Cloud session setup failed; the output is in $log."
  exit 0
fi

cat <<'EOF'
Cloud session ready: dependencies, Chromium and the Git hooks are installed.
Two test failures here come from the container, not the change under test:
- tests/api/login-lockout.spec.ts, "the same Username from another IP is unaffected", calls the
  server on IPv6 [::1], which this container lacks. CI runs it.
- A full Playwright run can fail a few random tests with SQLITE_BUSY in the Wrangler log. Rerun
  that project on its own before suspecting the change.
EOF
