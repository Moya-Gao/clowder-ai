#!/bin/bash
# F177 Phase G: Routing Guard Hook — Unit Tests
# Tests the hook logic by creating mock transcripts and checking output.
#
# Usage: bash test/hooks/f177-routing-guard.test.sh

set -euo pipefail

HOOK=".claude/hooks/f177-routing-guard.sh"
PASS=0
FAIL=0
TMPDIR_TEST=$(mktemp -d)

cleanup() { rm -rf "$TMPDIR_TEST"; }
trap cleanup EXIT

# --- Helpers ---

make_transcript() {
  local file="$1"
  local text="$2"
  local tool_use="${3:-}"
  mkdir -p "$(dirname "$file")"

  local content
  if [[ -n "$tool_use" ]]; then
    content=$(jq -n --arg t "$text" --arg tn "$tool_use" \
      '[{type:"text",text:$t},{type:"tool_use",name:$tn,id:"t1",input:{}}]')
  else
    content=$(jq -n --arg t "$text" '[{type:"text",text:$t}]')
  fi

  jq -cn --argjson c "$content" '{type:"assistant",message:{content:$c}}' > "$file"
}

run_hook() {
  local session_id="$1"
  local cwd="$2"
  local keep_guard="${3:-}"

  if [[ -z "$keep_guard" ]]; then
    rm -f "${TMPDIR:-/tmp}/cat-cafe-routing-guard/$session_id" 2>/dev/null
  fi

  echo "{\"session_id\":\"$session_id\",\"cwd\":\"$cwd\"}" \
    | HOME="$TMPDIR_TEST" CLAUDE_PROJECT_DIR="$MOCK_PROJECT" bash "$HOOK" 2>/dev/null || true
}

assert_silent() {
  local desc="$1"
  local output="$2"
  if [[ -z "$output" ]]; then
    echo "  PASS: $desc"
    ((++PASS))
  else
    echo "  FAIL: $desc — expected silent, got: $output"
    ((++FAIL))
  fi
}

assert_reminder() {
  local desc="$1"
  local output="$2"
  if echo "$output" | grep -qF '路由守卫 F177-G'; then
    echo "  PASS: $desc"
    ((++PASS))
  else
    echo "  FAIL: $desc — expected reminder, got: $(echo "$output" | head -1)"
    ((++FAIL))
  fi
}

# --- Setup mock project structure ---

SESSION="test-session-001"
CWD="/mock/project"
SLUG=$(echo "$CWD" | sed 's|/|-|g')
TRANSCRIPT_DIR="$TMPDIR_TEST/.claude/projects/$SLUG"
TRANSCRIPT="$TRANSCRIPT_DIR/${SESSION}.jsonl"
mkdir -p "$TRANSCRIPT_DIR"

# Mock cat-config.json with breeds mentionPatterns + coCreator
MOCK_PROJECT="$TMPDIR_TEST/mock-project"
mkdir -p "$MOCK_PROJECT"
cat > "$MOCK_PROJECT/cat-config.json" << 'CONFIGEOF'
{
  "version":"test",
  "roster":{"opus":{},"codex":{},"gemini":{}},
  "breeds":[
    {"catId":"opus","mentionPatterns":["@opus","@布偶猫","@宪宪"],"variants":[{"id":"opus-47","mentionPatterns":["@opus-47","@opus47"]},{"id":"sonnet","mentionPatterns":["@sonnet"]}]},
    {"catId":"codex","mentionPatterns":["@codex","@缅因猫","@砚砚"],"variants":[{"id":"gpt52","mentionPatterns":["@gpt52","@gpt-52"]},{"id":"spark","mentionPatterns":["@spark"]}]},
    {"catId":"gemini","mentionPatterns":["@gemini","@暹罗猫","@烁烁"],"variants":[]}
  ],
  "coCreator":{"mentionPatterns":["@landy","@l.s."]}
}
CONFIGEOF

echo ""
echo "=== F177 Phase G: Routing Guard Tests ==="
echo ""

# --- Test 1: Line-start @mention → silent ---
echo "Test group: Valid routing (should be silent)"

make_transcript "$TRANSCRIPT" "分析完了，请砚砚 review。

@codex
请帮忙看一下 PR #1467。

[宪宪/Opus-46🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "line-start @mention (roster)" "$OUT"

# --- Test 2: @mention with markdown prefix → silent ---
make_transcript "$TRANSCRIPT" "Review 完成。

- @opus 请处理

[砚砚/GPT-5.5🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "@mention with list prefix" "$OUT"

# --- Test 3: hold_ball tool call → silent ---
make_transcript "$TRANSCRIPT" "等云端 review 结果。

[宪宪/Opus-46🐾]" "cat_cafe_hold_ball"

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "hold_ball tool call" "$OUT"

# --- Test 4: Parallel mode → silent (skip check) ---
make_transcript "$TRANSCRIPT" "我的分析如下...

当前模式：并行模式

[宪宪/Opus-47🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "parallel mode skipped" "$OUT"

# --- Test 5: 独立回答 mode → silent ---
make_transcript "$TRANSCRIPT" "这是我的独立回答。blabla。

[宪宪/Opus-46🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "独立回答 mode skipped" "$OUT"

# --- Test 6: No cat signature → silent (not a cat message) ---
make_transcript "$TRANSCRIPT" "This is a regular Claude Code response without cat signature."

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "no cat signature (human session)" "$OUT"

# --- Test 6b: @ inside fenced code block → NOT valid routing → reminder ---
{
  echo '{"type":"assistant","message":{"content":[{"type":"text","text":"看一下这段代码：\n\n```bash\n@codex run this\n```\n\n[宪宪/Opus-47🐾]"}]}}'
} > "$TRANSCRIPT"

OUT=$(run_hook "$SESSION" "$CWD")
assert_reminder "@ in fenced code block (not valid routing)" "$OUT"

# --- Test: @ inside indented fenced code block → NOT valid → reminder ---
{
  printf '{"type":"assistant","message":{"content":[{"type":"text","text":"看看这段：\\n\\n   ```python\\n   @codex do stuff\\n   ```\\n\\n[宪宪/Opus-47🐾]"}]}}\n'
} > "$TRANSCRIPT"

OUT=$(run_hook "$SESSION" "$CWD")
assert_reminder "@ in indented fenced code block" "$OUT"

# --- Test 6c: hold_ball in earlier JSONL record (separate from text) → silent ---
{
  jq -cn '{type:"user",message:{content:"请处理一下"}}'
  jq -cn '{type:"assistant",message:{content:[{type:"tool_use",name:"cat_cafe_hold_ball",id:"t1",input:{}}]}}'
  jq -cn '{type:"assistant",message:{content:[{type:"text",text:"已持球，等云端结果。\n\n[宪宪/Opus-46🐾]"}]}}'
} > "$TRANSCRIPT"

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "hold_ball in earlier JSONL record (turn-window scan)" "$OUT"

# --- Test 6d: @not-a-cat at line start → NOT valid (non-roster) → reminder ---
make_transcript "$TRANSCRIPT" "Done with analysis.

@not-a-cat please review

[宪宪/Opus-47🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_reminder "@not-a-cat (non-roster handle)" "$OUT"

# --- Test 6e: Chinese handle @缅因猫 → valid (breed mentionPattern) → silent ---
make_transcript "$TRANSCRIPT" "Review 结果出来了。

@缅因猫 请确认。

[宪宪/Opus-46🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "@缅因猫 (Chinese breed alias)" "$OUT"

# --- Test: variant handle @sonnet → valid → silent ---
make_transcript "$TRANSCRIPT" "这部分比较简单。

@sonnet 你来处理。

[宪宪/Opus-46🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "@sonnet (variant handle)" "$OUT"

# --- Test: variant handle @gpt52 → valid → silent ---
make_transcript "$TRANSCRIPT" "Review 交给你。

@gpt52

[宪宪/Opus-46🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "@gpt52 (variant handle)" "$OUT"

# --- Test 6g: @landy at line start → valid (铲屎官 escalation) → silent ---
make_transcript "$TRANSCRIPT" "这个需要铲屎官决定。

@landy
请确认一下方向。

[宪宪/Opus-46🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "@landy (铲屎官 escalation)" "$OUT"

# --- Test 6f: Old-turn hold_ball should NOT cover new-turn missing route ---
{
  jq -cn '{type:"user",message:{content:"第一轮"}}'
  jq -cn '{type:"assistant",message:{content:[{type:"tool_use",name:"cat_cafe_hold_ball",id:"t1",input:{}}]}}'
  jq -cn '{type:"assistant",message:{content:[{type:"text",text:"持球中\n\n[宪宪/Opus-46🐾]"}]}}'
  jq -cn '{type:"user",message:{content:"第二轮"}}'
  jq -cn '{type:"assistant",message:{content:[{type:"text",text:"分析完毕。\n\n[宪宪/Opus-46🐾]"}]}}'
} > "$TRANSCRIPT"

OUT=$(run_hook "$SESSION" "$CWD")
assert_reminder "old-turn hold_ball does not cover new-turn" "$OUT"

# --- Test: ordered list prefix "1. @codex" → valid → silent ---
make_transcript "$TRANSCRIPT" "以下步骤：

1. @codex 请 review PR

[宪宪/Opus-46🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_silent "ordered list prefix 1. @codex" "$OUT"

# --- Test: *@codex (no space after *) → NOT valid → reminder ---
make_transcript "$TRANSCRIPT" "请注意*@codex*重要内容。

[宪宪/Opus-47🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_reminder "*@codex (no space, not markdown prefix)" "$OUT"

# --- Test: text mentions hold_ball without tool_use → reminder ---
make_transcript "$TRANSCRIPT" "我应该调用 cat_cafe_hold_ball 来持球。

[宪宪/Opus-47🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_reminder "text mentions hold_ball without tool_use" "$OUT"

echo ""
echo "Test group: Missing routing (should remind)"

# --- Test 7: Inline @mention (wrong format) → reminder ---
make_transcript "$TRANSCRIPT" "球权在 @codex 这个需要 review。

[宪宪/Opus-47🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_reminder "inline @mention (wrong format)" "$OUT"

# --- Test 8: No routing at all → reminder ---
make_transcript "$TRANSCRIPT" "分析完成，以上是我的建议。

[宪宪/Opus-47🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_reminder "no routing at all" "$OUT"

# --- Test 9: Says "持球" but no hold_ball call → reminder ---
make_transcript "$TRANSCRIPT" "我持球了，等结果。

[宪宪/Opus-47🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
assert_reminder "text says 持球 but no hold_ball call" "$OUT"

echo ""
echo "Test group: Loop guard"

# --- Test 10: Second fire → silent (loop guard) ---
make_transcript "$TRANSCRIPT" "还是没有路由。

[宪宪/Opus-47🐾]"

# First fire should remind
OUT1=$(run_hook "$SESSION" "$CWD")
assert_reminder "first fire reminds" "$OUT1"

# Second fire should be silent (guard file exists from first fire)
OUT2=$(run_hook "$SESSION" "$CWD" keep)
assert_silent "second fire silent (loop guard)" "$OUT2"

echo ""
echo "Test group: Output format"

# --- Test 11: Reminder output is valid JSON with decision:block ---
make_transcript "$TRANSCRIPT" "没路由的消息。

[宪宪/Opus-47🐾]"

OUT=$(run_hook "$SESSION" "$CWD")
DECISION=$(echo "$OUT" | jq -r '.decision // empty' 2>/dev/null || true)
if [[ "$DECISION" == "block" ]]; then
  echo "  PASS: output is JSON with decision:block"
  ((++PASS))
else
  echo "  FAIL: expected decision:block, got: $OUT"
  ((++FAIL))
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[[ $FAIL -eq 0 ]] && echo "All tests passed!" || exit 1
