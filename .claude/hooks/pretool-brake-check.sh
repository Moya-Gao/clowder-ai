#!/bin/bash
# F085 Hyperfocus Brake — PreToolUse hook shim
# Delegates to cat-cafe-skills/hyperfocus-brake/pretool-brake-check.sh

set -euo pipefail

SKILL_HOOK="${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}/cat-cafe-skills/hyperfocus-brake/pretool-brake-check.sh"

if [[ -x "$SKILL_HOOK" ]]; then
  exec "$SKILL_HOOK"
else
  cat > /dev/null  # drain stdin
  exit 0
fi
