#!/usr/bin/env bash
# Hook: PreToolUse (matcher: "Task")
# Enforce explicit model selection for subagent Task calls.
# If model is omitted, subagents inherit the parent model (often Opus).

set -euo pipefail

INPUT="$(cat)"

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
  emit_decision "deny" "Task 调用缺少 model 参数。请显式设置 model（haiku/sonnet/opus），避免默认继承父模型导致不必要的高成本。"
  exit 0
fi

if [ "$MODEL_TRIMMED" = "opus" ]; then
  emit_decision "ask" "subagent 使用 opus。请确认这是必须的深度任务；多数子任务可用 haiku/sonnet 完成。"
fi

exit 0
