#!/bin/bash
# sop-stage-bookmark.sh — F073 SOP Auto-Guardian
# Hook: PostToolUse (matcher: "Skill")
# Records which skill was loaded → tracks SOP stage for post-compact recovery.
#
# This creates a persistent marker file that survives context compression.
# The post-compact-bootstrap hook reads this to tell the cat where they were.

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty')

# Extract skill name from tool input
SKILL_NAME=$(echo "$TOOL_INPUT" | jq -r '.skill // empty')

if [ -z "$SKILL_NAME" ] || [ "$SKILL_NAME" = "null" ]; then
  exit 0
fi

# Map skill to SOP stage (based on manifest development chain)
case "$SKILL_NAME" in
  feat-lifecycle)     SOP_STAGE="lifecycle" ;;
  writing-plans)      SOP_STAGE="planning" ;;
  worktree)           SOP_STAGE="worktree" ;;
  tdd)                SOP_STAGE="development" ;;
  debugging)          SOP_STAGE="debugging" ;;
  quality-gate)       SOP_STAGE="quality-gate" ;;
  request-review)     SOP_STAGE="review-request" ;;
  receive-review)     SOP_STAGE="review-response" ;;
  merge-gate)         SOP_STAGE="merge" ;;
  cross-cat-handoff)  SOP_STAGE="handoff" ;;
  *)                  SOP_STAGE="other:${SKILL_NAME}" ;;
esac

# Write stage bookmark (session-isolated, no TTL — persists until overwritten)
STAGE_FILE="/tmp/cat-cafe-sop-stage-${SESSION_ID}.json"
jq -n \
  --arg skill "$SKILL_NAME" \
  --arg stage "$SOP_STAGE" \
  --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{skill: $skill, sopStage: $stage, recordedAt: $time}' \
  > "$STAGE_FILE"

exit 0
