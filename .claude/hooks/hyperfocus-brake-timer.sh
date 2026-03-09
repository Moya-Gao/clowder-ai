#!/bin/bash
# F085 Hyperfocus Brake — PostToolUse hook shim
# Delegates to cat-cafe-skills/hyperfocus-brake/hook.sh
# Registered in settings.json PostToolUse with broad matcher.
#
# This shim exists because settings.json uses $CLAUDE_PROJECT_DIR,
# and the actual logic lives alongside the skill definition.

set -euo pipefail

SKILL_HOOK="${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}/cat-cafe-skills/hyperfocus-brake/hook.sh"

if [[ -x "$SKILL_HOOK" ]]; then
  exec "$SKILL_HOOK"
else
  # Skill not present (e.g. fresh clone without skill dir) — silently skip
  cat > /dev/null  # drain stdin
  exit 0
fi
