#!/usr/bin/env bash
# Hook: PreToolUse (matcher: "Task")
# Enforce explicit model selection for subagent creation (Task/Agent).
# TaskOutput and TaskStop are passthrough — they don't create subagents.
# If model is omitted on Task, subagents inherit the parent model (often Opus).

set -euo pipefail

INPUT="$(cat)"

# Extract tool name — only "Task" (Agent) creates subagents.
# TaskOutput / TaskStop are read/stop operations, no model needed.
TOOL_NAME="$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")"
if [ "$TOOL_NAME" = "TaskOutput" ] || [ "$TOOL_NAME" = "TaskStop" ]; then
  exit 0
fi

emit_decision() {
  local decision="$1"
  local reason="$2"
  cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"$decision","permissionDecisionReason":"$reason"}}
EOF
}

extract_model() {
  local model

  # Hot path: jq is faster than spinning up python.
  if model="$(
    echo "$INPUT" | jq -r '
      if (.tool_input // null) != null then
        .tool_input.model
      else
        .model
      end
      | if type == "string" then . else "" end
    ' 2>/dev/null
  )"; then
    echo "$model"
    return 0
  fi

  # Fallback path: when jq is unavailable/failing, try python3.
  if command -v python3 >/dev/null 2>&1; then
    if model="$(
      echo "$INPUT" | python3 -c '
import json
import sys

try:
    data = json.load(sys.stdin)
except Exception:
    print("")
    raise SystemExit(0)

params = data.get("tool_input", data)
model = params.get("model", "")
if isinstance(model, str):
    print(model)
else:
    print("")
' 2>/dev/null
    )"; then
      echo "$model"
      return 0
    fi
  fi

  echo "__MODEL_PARSE_UNAVAILABLE__"
  return 0
}

MODEL="$(extract_model)"

if [ "$MODEL" = "__MODEL_PARSE_UNAVAILABLE__" ]; then
  emit_decision "ask" "Task model 解析不可用（jq/python3 都不可用或解析失败）。请人工确认后重试。"
  exit 0
fi

MODEL_TRIMMED="$(echo "$MODEL" | tr -d '[:space:]')"

if [ -z "$MODEL_TRIMMED" ]; then
  emit_decision "deny" "⛔ Agent 调用被拦截：缺少 model 参数。请立即用相同参数重试，加上 model=haiku（搜索/grep/简单任务）或 model=sonnet（多文件分析）。不要改用 Grep/Read 自己做——那样会污染你的 Opus context，更贵。"
  exit 0
fi

if [ "$MODEL_TRIMMED" = "opus" ]; then
  emit_decision "ask" "⚠️ Agent 使用 model=opus。大多数子任务用 haiku（搜索）或 sonnet（代码分析）就够了。确认这是必须 opus 级深度的任务？"
fi

exit 0
