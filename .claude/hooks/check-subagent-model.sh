#!/usr/bin/env bash
# Hook: PreToolUse (matcher: "Task")
# Gate subagent cost by checking subagent_type.
#
# Tested on Claude Code v2.1.70 (2026-03-06):
#   Explore        → auto haiku   ✅ cheap, allow
#   Plan           → inherits Opus ✅ needs deep thinking, allow
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

# Plan → needs Opus-level deep thinking. Allow.
if [ "$SUBAGENT_TYPE" = "Plan" ]; then
  exit 0
fi

# general-purpose / empty → inherits Opus. Usually overkill. Ask.
emit_decision "ask" "⚠️ Agent(${SUBAGENT_TYPE:-未指定}) 继承 Opus。如果是搜代码/读文件/探索代码库 → 请改用 subagent_type=Explore（自动 haiku，不污染主上下文）。不要因为被拦就放弃 subagent 自己 grep——那更浪费上下文！确认必须用 general-purpose？"
exit 0
