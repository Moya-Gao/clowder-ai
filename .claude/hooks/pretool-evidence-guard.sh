#!/usr/bin/env bash
# Evidence Guard — PreToolUse hook on Edit|Write
# Checks that the cat has recently performed Read/Grep/Glob before editing.
# If no recent evidence of investigation, asks for confirmation.
#
# Why (2026-03-14): 布偶猫不看代码就改代码，不看设计就说完美。
# 砚砚们会诊处方：read-before-write 门禁，先 ask 不 deny。
#
# v1: ask mode only. After 1 week of data, consider upgrading to deny.

set -euo pipefail

INPUT="$(cat)"

TOOL_NAME="$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")"

# Only guard Edit and Write
case "$TOOL_NAME" in
  Edit|Write) ;;
  *) exit 0 ;;
esac

MARKER_FILE="${TMPDIR:-/tmp}/cat-cafe-evidence-${USER:-default}.marker"

emit() {
  local decision="$1"
  local reason="$2"
  cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"$decision","permissionDecisionReason":"$reason"}}
EOF
}

# If marker doesn't exist or is a symlink, ask
if [[ -L "$MARKER_FILE" ]] || [[ ! -f "$MARKER_FILE" ]]; then
  emit "ask" "$(cat <<MSG
⚠️ Evidence Guard: 本 session 还没有 Read/Grep/Glob 记录。
你确定已经看过相关代码了吗？

家规 P5："可验证才算完成。" 先看代码再改代码。
如果你确实已经看过（比如在之前的对话轮次中），可以继续。
MSG
)"
  exit 0
fi

# Check if marker is recent (within 15 minutes = 900 seconds)
MARKER_TS=$(cat "$MARKER_FILE" 2>/dev/null || echo "0")
NOW_TS=$(date +%s)
AGE=$((NOW_TS - MARKER_TS))

if [[ $AGE -gt 900 ]]; then
  emit "ask" "$(cat <<MSG
⚠️ Evidence Guard: 上次 Read/Grep/Glob 是 $((AGE / 60)) 分钟前。
你确定对当前要修改的文件有足够了解吗？

如果你在修改一个已经充分调查过的文件，可以继续。
MSG
)"
  exit 0
fi

# Recent evidence exists, allow silently
exit 0
