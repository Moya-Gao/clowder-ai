#!/bin/bash
# f24-guard-post-compact.sh — F24 Session Blindness Fix, Layer 3
# Hook: PreToolUse (matcher: "Bash")
# Runs BEFORE every Bash tool call.
#
# If a recent-compact marker exists (within 10 min TTL) and the command
# matches a high-risk pattern, deny the tool call to prevent post-compact
# mistakes (e.g., merging a PR based on stale/compressed context).

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Check recent-compact marker (session_id isolated)
MARKER_FILE="/tmp/cat-cafe-opus-recent-compact-${SESSION_ID}.marker"
if [ ! -f "$MARKER_FILE" ]; then
  exit 0  # No marker = no recent compact, allow
fi

# TTL check: marker older than 10 minutes = expired, allow
MARKER_TIME=$(cat "$MARKER_FILE")
if [ "$(uname)" = "Darwin" ]; then
  MARKER_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$MARKER_TIME" +%s 2>/dev/null || echo 0)
else
  MARKER_EPOCH=$(date -d "$MARKER_TIME" +%s 2>/dev/null || echo 0)
fi
NOW_EPOCH=$(date +%s)
AGE=$(( NOW_EPOCH - MARKER_EPOCH ))

if [ "$AGE" -gt 600 ]; then
  exit 0  # Marker expired, allow
fi

# High-risk command pattern matching
if echo "$COMMAND" | grep -qE '(gh pr merge|git push.*(--force|-f )|git merge.*(main|master)|git reset --hard|git rebase)'; then
  jq -n --arg age "$AGE" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("Post-compact safety: context was compressed " + $age + "s ago. High-risk command blocked. Please verify your context is complete and get explicit user approval before retrying.")
    }
  }'
else
  exit 0  # Not a high-risk command, allow
fi
