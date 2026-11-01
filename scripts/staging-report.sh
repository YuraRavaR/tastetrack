#!/usr/bin/env bash
# Playwright traces and reports of a staging run record every request header, test hooks secret
# included, and test Users' logins, while this repo's artifacts are public. So staging runs publish
# them only encrypted (ADR-0010).
#
#   staging-report.sh pack        encrypt test-results/ and playwright-report/, in CI
#   staging-report.sh open <run>  download a run's report, decrypt it and open it in the browser
#
# The key is STAGING_REPORT_KEY, or on macOS the Keychain item `tastetrack-staging-report`.
set -euo pipefail

artifact=playwright-staging
encrypted=$artifact.enc

crypt() {
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -pass env:STAGING_REPORT_KEY "$@"
}

require_key() {
  if [ -z "${STAGING_REPORT_KEY:-}" ] && command -v security >/dev/null; then
    STAGING_REPORT_KEY=$(security find-generic-password -s tastetrack-staging-report -w 2>/dev/null || true)
  fi
  if [ -z "${STAGING_REPORT_KEY:-}" ]; then
    echo "Set STAGING_REPORT_KEY, or add it to the Keychain (see README)." >&2
    exit 1
  fi
  export STAGING_REPORT_KEY
}

case "${1:-}" in
  pack)
    require_key
    reports=$(ls -d test-results playwright-report 2>/dev/null || true)
    if [ -n "$reports" ]; then
      tar czf - $reports | crypt -out "$encrypted"
    fi
    ;;
  open)
    run=${2:?Usage: staging-report.sh open <run-id>}
    require_key
    dir=$(mktemp -d)
    trap 'rm -rf "$dir"' EXIT
    gh run download "$run" --name "$artifact" --dir "$dir"
    crypt -d -in "$dir/$encrypted" | tar xzf - -C "$dir"
    pnpm exec playwright show-report "$dir/playwright-report"
    ;;
  *)
    echo "Usage: staging-report.sh pack | open <run-id>" >&2
    exit 1
    ;;
esac
