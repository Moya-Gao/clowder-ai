#!/usr/bin/env bash
# Hook: PreToolUse (matcher: "Task")
# Gate subagent cost by checking subagent_type.
#
# Tested on Claude Code v2.1.70 (2026-03-06):
#   Explore        → auto haiku   ✅ cheap, allow
#   Plan           → inherits Opus ⚠️ expensive, ask
#   general-purpose → inherits Opus ⚠️ expensive, ask
#   (no type)      → inherits Opus ⚠️ expensive, ask
#
# TaskOutput / TaskStop are read/stop ops, always allow.

set -euo pipefail

INPUT="$(cat)"

emit_decision() {
  local decision="$1"
  local reason="$2"
  cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"$decision","permissionDecisionReason":"$reason"}}
EOF
}

# --- Parse tool_name and subagent_type via jq (fast path) ---
TOOL_NAME="$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")"
SUBAGENT_TYPE="$(echo "$INPUT" | jq -r '.tool_input.subagent_type // ""' 2>/dev/null || echo "")"

# TaskOutput / TaskStop — not subagent creation, always allow
if [ "$TOOL_NAME" = "TaskOutput" ] || [ "$TOOL_NAME" = "TaskStop" ]; then
  exit 0
fi

# Explore → Claude Code auto-selects haiku. Cheap. Allow.
if [ "$SUBAGENT_TYPE" = "Explore" ]; then
  exit 0
fi

# Plan / general-purpose / empty → inherits Opus. Expensive. Ask.
emit_decision "ask" "⚠️ Agent(${SUBAGENT_TYPE:-未指定}) 会继承 Opus 模型，成本高。90% 的搜索/读文件任务用 Explore（自动 haiku）就够了。确认这个任务必须用 ${SUBAGENT_TYPE:-general-purpose} 吗？如果只是搜代码/读文件，请改用 subagent_type=Explore。"
exit 0
