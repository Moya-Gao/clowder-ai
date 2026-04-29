#!/bin/bash
# F177 Phase G: Routing Guard — Session End Hook
#
# Gmail-style "forgot attachment?" for A2A ball passing.
# Checks if the last cat message has valid routing action.
# Has routing → silent (exit 0). Missing → decision:block + reminder.
#
# Guards:
# - Only fires for cat messages (detected by [name/model🐾] signature)
# - Skips parallel mode (no routing semantics in parallel)
# - Max 1 reminder per stop cycle (prevents infinite loop)

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null || true)
[[ -z "$SESSION_ID" ]] && exit 0

# Loop guard: only remind once per stop cycle
GUARD_DIR="${TMPDIR:-/tmp}/cat-cafe-routing-guard"
mkdir -p "$GUARD_DIR" 2>/dev/null
GUARD_FILE="$GUARD_DIR/$SESSION_ID"
if [[ -f "$GUARD_FILE" ]]; then
  rm -f "$GUARD_FILE"
  exit 0
fi

# --- Load mention handles from cat-config.json ---
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
CONFIG="$PROJECT_DIR/cat-config.json"
if [[ -f "$CONFIG" ]]; then
  ROSTER_RE=$(jq -r '
    [.breeds[]?.mentionPatterns[]?, .breeds[]?.variants[]?.mentionPatterns[]?, .coCreator?.mentionPatterns[]?]
    | map(ltrimstr("@"))
    | unique
    | join("|")
  ' "$CONFIG" 2>/dev/null | sed 's/\./\\./g')
  [[ -z "$ROSTER_RE" ]] && exit 0
else
  exit 0
fi

# --- Find transcript JSONL ---
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
[[ -z "$CWD" ]] && CWD="$PROJECT_DIR"

SLUG=$(echo "$CWD" | sed 's|/|-|g')
TRANSCRIPT=""

for CANDIDATE in \
  "$HOME/.claude/projects/${SLUG}/${SESSION_ID}.jsonl" \
  "$HOME/.claude/projects/-${SLUG}/${SESSION_ID}.jsonl"; do
  if [[ -f "$CANDIDATE" ]]; then
    TRANSCRIPT="$CANDIDATE"
    break
  fi
done

[[ -z "$TRANSCRIPT" ]] && exit 0

# --- Read last assistant message (reverse search) ---
reverse_file() {
  if command -v tac >/dev/null 2>&1; then
    tac "$1"
  else
    tail -r "$1" 2>/dev/null
  fi
}

LAST_LINE=$(reverse_file "$TRANSCRIPT" | grep -m1 '"type":"assistant"' || true)
[[ -z "$LAST_LINE" ]] && exit 0

TEXT=$(echo "$LAST_LINE" | jq -r '
  if .message.content | type == "array" then
    [.message.content[] | select(.type == "text") | .text] | join("\n")
  else
    .message.content // empty
  end
' 2>/dev/null || true)

[[ -z "$TEXT" ]] && exit 0

# --- Guard: only check cat messages (has [name/model🐾] signature) ---
if ! echo "$TEXT" | grep -qE '\[.+/.+🐾\]'; then
  exit 0
fi

# --- Guard: skip parallel mode ---
if echo "$TEXT" | grep -qF '并行模式'; then
  exit 0
fi
if echo "$TEXT" | grep -qF '独立回答'; then
  exit 0
fi

# --- Check for valid routing ---

# 1. Line-start @mention — aligned with parseA2AMentions' MARKDOWN_LINE_PREFIX_RE:
#    >\s*  |  [-*+]\s+  |  \d+[.)]\s+
TEXT_NO_FENCE=$(echo "$TEXT" | awk '/^[[:space:]]*```/{skip=!skip;next} !skip')
if echo "$TEXT_NO_FENCE" | grep -qEi "^[[:space:]]*(>[[:space:]]*|[-*+][[:space:]]+|[0-9]+[.)][[:space:]]+)*@(${ROSTER_RE})([^a-zA-Z0-9_-]|$)" ; then
  exit 0
fi

# 2. Tool-based routing: scan ALL assistant lines in current turn
#    Match JSON "name" fields to avoid false positives from text content
LAST_USER_LINENO=$(grep -n '"type":"user"' "$TRANSCRIPT" 2>/dev/null | tail -1 | cut -d: -f1)
if [[ -n "$LAST_USER_LINENO" ]]; then
  TURN_ASSISTANTS=$(tail -n +"$LAST_USER_LINENO" "$TRANSCRIPT" | grep '"type":"assistant"')
else
  TURN_ASSISTANTS=$(grep '"type":"assistant"' "$TRANSCRIPT")
fi

if echo "$TURN_ASSISTANTS" | grep -qF '"name":"cat_cafe_hold_ball"'; then exit 0; fi
if echo "$TURN_ASSISTANTS" | grep -qF '"targetCats"'; then exit 0; fi
if echo "$TURN_ASSISTANTS" | grep -qF '"name":"cat_cafe_multi_mention"'; then exit 0; fi

# --- No valid routing → block stop with reminder ---
touch "$GUARD_FILE"

REASON='[路由守卫 F177-G] 你的消息没有合法路由。请在末尾补一行：
- 传球 → 另起一行行首写 @句柄（如 @codex）
- 持球 → 调用 cat_cafe_hold_ball
- 升级 → 另起一行行首写 @landy'

jq -cn --arg r "$REASON" '{decision:"block",reason:$r}'
