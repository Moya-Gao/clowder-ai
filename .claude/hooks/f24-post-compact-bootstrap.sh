#!/bin/bash
# f24-post-compact-bootstrap.sh — F24 Session Blindness Fix, Layer 2
# Hook: SessionStart (matcher: "compact")
# Runs AFTER Claude Code SDK context compression when session resumes.
#
# Actions:
# 1. Read compact state file saved by PreCompact hook
# 2. TTL check (5 min) — expired state = stale, skip
# 3. Fetch latest sealed session digest from Cat Cafe API
# 4. Inject context warning + state + digest via additionalContext
# 5. Delete state file after consumption

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')

API_PORT="${API_SERVER_PORT:-3002}"
HOOK_TOKEN="${CAT_CAFE_HOOK_TOKEN:-}"

STATE_FILE="/tmp/cat-cafe-opus-compact-state-${SESSION_ID}.json"

# No state file = not a post-compact resume (or already consumed)
if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# TTL check: state file older than 5 minutes = expired
COMPACT_TIME=$(jq -r '.compactedAt' "$STATE_FILE")
if [ "$(uname)" = "Darwin" ]; then
  # BSD date doesn't treat 'Z' as UTC — force TZ=UTC for correct parsing
  COMPACT_EPOCH=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%SZ" "$COMPACT_TIME" +%s 2>/dev/null || echo 0)
else
  COMPACT_EPOCH=$(date -d "$COMPACT_TIME" +%s 2>/dev/null || echo 0)
fi
NOW_EPOCH=$(date +%s)
AGE=$(( NOW_EPOCH - COMPACT_EPOCH ))

if [ "$AGE" -gt 300 ]; then
  rm -f "$STATE_FILE"
  exit 0
fi

# Fetch latest sealed session digest (best-effort)
DIGEST=$(curl -sf --max-time 5 \
  -H "X-Cat-Cafe-Hook-Token: ${HOOK_TOKEN}" \
  "http://localhost:${API_PORT}/api/sessions/latest-digest?cliSessionId=$SESSION_ID" 2>/dev/null)
DIGEST_STATUS=$?

if [ "$DIGEST_STATUS" -ne 0 ] || [ -z "$DIGEST" ]; then
  DIGEST_SECTION="(Failed to fetch session digest from Cat Cafe API)"
else
  DIGEST_SECTION="$DIGEST"
fi

STATE_CONTENT=$(cat "$STATE_FILE")

# Build context injection
CONTEXT=$(cat <<CTXEOF
[F24 POST-COMPACT WARNING]
You just experienced context compression ${AGE}s ago.

[Pre-Compact State Snapshot]
${STATE_CONTENT}

[Latest Sealed Session Digest]
${DIGEST_SECTION}

[CRITICAL RULES — Post-Compact Safety]
1. Compression summaries lose detail. Verify facts before acting on them.
2. Do NOT assume the user approved any operation unless you find explicit evidence in the CURRENT context.
3. High-risk operations (gh pr merge, git push --force, etc.) require explicit user instruction in THIS conversation turn.
4. When in doubt, ASK the user before proceeding.
5. RE-READ CLAUDE.md rules NOW. Compression degrades your adherence to project rules. Key reminders:
   - Every commit MUST carry your cat signature [布偶猫🐾]
   - Every code change MUST have its tests run before commit
   - All work in this session is YOUR work — own it, sign it, test it.
CTXEOF
)

jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'

# Consume state file (one-time use)
rm -f "$STATE_FILE"
