#!/bin/bash
# F085 Hyperfocus Brake — UserPromptSubmit hook shim
# Records that the human sent a message (heartbeat).
# Used to distinguish "human working with cat" from "cat working alone".

set -euo pipefail

SKILL_HOOK="${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}/cat-cafe-skills/hyperfocus-brake/user-heartbeat.sh"

if [[ -x "$SKILL_HOOK" ]]; then
  exec "$SKILL_HOOK"
else
  cat > /dev/null  # drain stdin
  exit 0
fi
