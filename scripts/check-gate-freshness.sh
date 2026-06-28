#!/bin/bash
# F253 Phase C — AC-C1: Gate Freshness Checker
#
# Called from .githooks/pre-push Layer 4.
# Checks if `pnpm gate` was run recently by looking at the
# .gate-last-run sentinel file.
#
# ALWAYS exits 0 — this is a soft reminder, never blocks push.
# Warnings go to stderr (visible to user during git push).
#
# Usage: check-gate-freshness.sh <REPO_ROOT>

set -euo pipefail

REPO_ROOT="${1:-}"

# Fail-open wrapper: any error inside → exit 0 silently
(
  if [ -z "$REPO_ROOT" ] || [ ! -d "$REPO_ROOT" ]; then
    exit 0
  fi

  GATE_SENTINEL="$REPO_ROOT/.gate-last-run"

  if [ ! -f "$GATE_SENTINEL" ]; then
    echo "" >&2
    echo "  💡 REMINDER: pnpm gate has not been run in this session." >&2
    echo "     Run 'pnpm gate' before pushing to catch issues early." >&2
    echo "     (This is a reminder, not a blocker.)" >&2
    echo "" >&2
    exit 0
  fi

  GATE_TIME=$(cat "$GATE_SENTINEL" 2>/dev/null || echo "0")

  # Validate: must be a number
  if ! [[ "$GATE_TIME" =~ ^[0-9]+$ ]]; then
    # Garbage in sentinel — treat as missing, warn
    echo "" >&2
    echo "  💡 REMINDER: pnpm gate has not been run in this session." >&2
    echo "     Run 'pnpm gate' before pushing to catch issues early." >&2
    echo "     (This is a reminder, not a blocker.)" >&2
    echo "" >&2
    exit 0
  fi

  NOW=$(date +%s)
  AGE=$(( NOW - GATE_TIME ))

  if [ "$AGE" -gt 3600 ]; then
    echo "" >&2
    echo "  💡 REMINDER: pnpm gate was last run $(( AGE / 60 )) minutes ago." >&2
    echo "     Consider re-running 'pnpm gate' if you made changes since." >&2
    echo "     (This is a reminder, not a blocker.)" >&2
    echo "" >&2
  fi

) || true
# ^ Subshell + || true = fail-open. Any error → exit 0 silently.

exit 0
