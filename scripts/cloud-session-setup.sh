#!/usr/bin/env bash
# The SessionStart hook in .claude/settings.json. A Claude Code cloud session starts from a bare
# clone, so this installs the locked dependencies and the Chromium build the locked Playwright
# expects. Anywhere else CLAUDE_CODE_REMOTE is unset and it exits before touching anything.
# Whatever it prints reaches the agent's context. See docs/agents/cloud-sessions.md.
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0

# A new session can start from a cached clone that is behind GitHub, with origin's refs just as
# stale. On startup, catch the branch up, then run the updated copy of this script.
hook_input=""
IFS= read -r -t 1 -d '' hook_input
if [ -z "${CLOUD_SETUP_PULLED:-}" ] && echo "$hook_input" | grep -q '"source": *"startup"'; then
  before="$(git rev-parse HEAD)"
  if ! git pull --ff-only --quiet >/dev/null 2>&1; then
    echo "Cloud session: git pull failed, so this session works from $(git log -1 --oneline)."
  elif [ "$(git rev-parse HEAD)" != "$before" ]; then
    echo "Cloud session: the clone was behind GitHub; pulled up to $(git log -1 --oneline)."
  fi
  CLOUD_SETUP_PULLED=1 exec bash "$0" </dev/null
fi

known_failures() {
  cat <<'EOF'
Two test failures here come from the container, not the change under test:
- tests/api/login-lockout.spec.ts, "the same Username from another IP is unaffected", calls the
  server on IPv6 [::1], which this container lacks. CI runs it.
- A full Playwright run can fail a few random tests with SQLITE_BUSY in the Wrangler log. Rerun
  that project on its own before suspecting the change.
EOF
}

want="$(cut -d. -f1 .nvmrc)"
node_major() { "$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null; }

# The environment's setup script installs this Node with nvm or n, but the session's PATH can
# still lead to the image's own Node. Put the matching one first, for this script and, through
# CLAUDE_ENV_FILE, for the session's shell commands.
if [ "$(node_major node)" != "$want" ]; then
  for bin in "${NVM_DIR:-$HOME/.nvm}"/versions/node/v"$want".*/bin /root/.nvm/versions/node/v"$want".*/bin \
    /usr/local/n/versions/node/"$want".*/bin /usr/local/bin; do
    if [ "$(node_major "$bin/node")" = "$want" ]; then
      export PATH="$bin:$PATH"
      [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export PATH=\"$bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
      break
    fi
  done
fi

if [ "$(node_major node)" != "$want" ] || ! command -v pnpm >/dev/null; then
  echo "Cloud session setup skipped: it needs Node $want and pnpm, and found Node"
  echo "$(node -v 2>/dev/null || echo none) and pnpm $(pnpm -v 2>/dev/null || echo none). Node binaries on PATH:"
  which -a node 2>/dev/null | sed 's/^/  /'
  echo "The environment's setup script installs both; see docs/agents/cloud-sessions.md."
  known_failures
  exit 0
fi

log="${TMPDIR:-/tmp}/cloud-session-setup.log"
if ! {
  pnpm install --frozen-lockfile &&
    pnpm exec playwright install chromium &&
    git config core.hooksPath .githooks
} >"$log" 2>&1; then
  echo "Cloud session setup failed; the output is in $log."
  known_failures
  exit 0
fi

echo "Cloud session ready: Node $(node -v), dependencies, Chromium and the Git hooks are installed."
known_failures
