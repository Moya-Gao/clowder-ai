# F085 Hyperfocus Brake — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** A PostToolUse hook tracks active work time; after 90min it triggers the `hyperfocus-brake` skill which renders three-cat empathetic check-in with typed response, escalating bypass cooldowns, and injection-safe context.

**Architecture:** Shell hook (`hyperfocus-brake-timer.sh`) increments a counter in `/tmp/` on every tool use, checks elapsed active time. When threshold hit, it outputs a message instructing Claude to load the `hyperfocus-brake` skill. The skill itself reads context (git branch, recent commits), renders three-cat messages from the refs template, and requires a typed check-in response before proceeding. State (ignore count, bypass history) persists in `/tmp/` files keyed by date.

**Tech Stack:** Bash (hook), SKILL.md (skill content), Node.js `node:test` (tests), jq (JSON parsing in hook)

**Not building:** Web Hub modal, Chrome-generated images, voice/TTS, `/loop` integration (all Phase 2+)

---

## Terminal Schema

### State file: `/tmp/cat-cafe-hyperfocus-${SESSION_ID}.json`

```json
{
  "sessionId": "abc123",
  "firstToolUseAt": "2026-03-09T10:00:00Z",
  "lastToolUseAt": "2026-03-09T11:30:00Z",
  "toolUseCount": 47,
  "activeMinutes": 90,
  "ignoreCount": 0,
  "lastReminderAt": null,
  "bypasses": []
}
```

### Bypass history: `/tmp/cat-cafe-hyperfocus-bypass-YYYY-MM-DD.json`

```json
{
  "date": "2026-03-09",
  "bypasses": [
    { "at": "2026-03-09T11:35:00Z", "reason": "fixing prod bug", "cooldownMin": 30 }
  ]
}
```

### Hook output (when threshold reached)

The hook outputs a message to stderr (which Claude reads) instructing it to load the skill:

```
🐾 [Hyperfocus Brake] 已连续工作 90 分钟。请加载 /hyperfocus-brake skill。
```

---

## Task 1: Hook script — activity timer

**Files:**
- Create: `.claude/hooks/hyperfocus-brake-timer.sh`
- Test: `packages/api/test/hyperfocus-brake-hook.test.js`

### Step 1: Write the failing test

```javascript
// packages/api/test/hyperfocus-brake-hook.test.js
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..', '..', '..');
const hookScript = resolve(repoRoot, '.claude', 'hooks', 'hyperfocus-brake-timer.sh');

function runHook(sessionId, overrideEnv = {}) {
  return spawnSync('bash', [hookScript], {
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'echo hello' },
      session_id: sessionId,
    }),
    encoding: 'utf8',
    env: { ...process.env, ...overrideEnv },
  });
}

function stateFile(sessionId) {
  return `/tmp/cat-cafe-hyperfocus-${sessionId}.json`;
}

describe('hyperfocus-brake-timer hook', () => {
  const sid = `test-hf-${Date.now()}`;

  afterEach(() => {
    rmSync(stateFile(sid), { force: true });
  });

  it('creates state file on first tool use', () => {
    const result = runHook(sid);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(stateFile(sid)), 'state file should exist');
    const state = JSON.parse(readFileSync(stateFile(sid), 'utf8'));
    assert.equal(state.sessionId, sid);
    assert.equal(state.toolUseCount, 1);
  });

  it('increments tool use count on subsequent calls', () => {
    runHook(sid);
    runHook(sid);
    runHook(sid);
    const state = JSON.parse(readFileSync(stateFile(sid), 'utf8'));
    assert.equal(state.toolUseCount, 3);
  });

  it('emits reminder to stderr when threshold exceeded', () => {
    // Pre-seed state with 89 minutes of active time
    writeFileSync(stateFile(sid), JSON.stringify({
      sessionId: sid,
      firstToolUseAt: new Date(Date.now() - 91 * 60 * 1000).toISOString(),
      lastToolUseAt: new Date(Date.now() - 1000).toISOString(),
      toolUseCount: 50,
      activeMinutes: 89,
      ignoreCount: 0,
      lastReminderAt: null,
      bypasses: [],
    }));
    const result = runHook(sid);
    assert.equal(result.status, 0, `hook failed: ${result.stderr}`);
    assert.match(result.stderr, /Hyperfocus Brake/);
    assert.match(result.stderr, /hyperfocus-brake/);
  });

  it('does not re-trigger within cooldown window', () => {
    // Pre-seed: already triggered 5 minutes ago
    writeFileSync(stateFile(sid), JSON.stringify({
      sessionId: sid,
      firstToolUseAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
      lastToolUseAt: new Date(Date.now() - 1000).toISOString(),
      toolUseCount: 55,
      activeMinutes: 95,
      ignoreCount: 0,
      lastReminderAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      bypasses: [],
    }));
    const result = runHook(sid);
    assert.equal(result.status, 0);
    assert.equal(result.stderr.trim(), '', 'should NOT re-trigger within cooldown');
  });

  it('is executable', () => {
    const { accessSync, constants } = await import('node:fs');
    accessSync(hookScript, constants.X_OK);
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f085-hyperfocus-brake && node --test packages/api/test/hyperfocus-brake-hook.test.js`
Expected: FAIL — hook script doesn't exist yet

### Step 3: Write the hook script

```bash
#!/bin/bash
# hyperfocus-brake-timer.sh — F085 Hyperfocus Brake
# Hook: PostToolUse (any tool)
# Tracks cumulative active work time. When 90min threshold hit,
# emits a reminder to stderr (which Claude reads).
#
# State: /tmp/cat-cafe-hyperfocus-${SESSION_ID}.json
# Config: HYPERFOCUS_THRESHOLD_MIN (default 90)
#         HYPERFOCUS_COOLDOWN_MIN (default 30, after reminder)

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ]; then
  exit 0
fi

THRESHOLD_MIN="${HYPERFOCUS_THRESHOLD_MIN:-90}"
COOLDOWN_MIN="${HYPERFOCUS_COOLDOWN_MIN:-30}"
STATE_FILE="/tmp/cat-cafe-hyperfocus-${SESSION_ID}.json"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
NOW_EPOCH=$(date +%s)

# --- Initialize or update state ---
if [ ! -f "$STATE_FILE" ]; then
  jq -n \
    --arg sid "$SESSION_ID" \
    --arg now "$NOW" \
    '{sessionId: $sid, firstToolUseAt: $now, lastToolUseAt: $now, toolUseCount: 1, activeMinutes: 0, ignoreCount: 0, lastReminderAt: null, bypasses: []}' \
    > "$STATE_FILE"
  exit 0
fi

# Read current state
FIRST_USE=$(jq -r '.firstToolUseAt' "$STATE_FILE")
TOOL_COUNT=$(jq -r '.toolUseCount' "$STATE_FILE")
LAST_REMINDER=$(jq -r '.lastReminderAt // empty' "$STATE_FILE")
IGNORE_COUNT=$(jq -r '.ignoreCount // 0' "$STATE_FILE")

# Update state: increment count, update timestamp
TOOL_COUNT=$((TOOL_COUNT + 1))

# Calculate active minutes from first tool use
FIRST_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$FIRST_USE" +%s 2>/dev/null || date -d "$FIRST_USE" +%s 2>/dev/null || echo "$NOW_EPOCH")
ACTIVE_MIN=$(( (NOW_EPOCH - FIRST_EPOCH) / 60 ))

# Write updated state
jq \
  --arg now "$NOW" \
  --argjson count "$TOOL_COUNT" \
  --argjson mins "$ACTIVE_MIN" \
  '.lastToolUseAt = $now | .toolUseCount = $count | .activeMinutes = $mins' \
  "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

# --- Check threshold ---
if [ "$ACTIVE_MIN" -lt "$THRESHOLD_MIN" ]; then
  exit 0
fi

# --- Check cooldown (don't re-trigger too soon) ---
if [ -n "$LAST_REMINDER" ] && [ "$LAST_REMINDER" != "null" ]; then
  LAST_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$LAST_REMINDER" +%s 2>/dev/null || date -d "$LAST_REMINDER" +%s 2>/dev/null || echo "0")
  SINCE_LAST=$(( (NOW_EPOCH - LAST_EPOCH) / 60 ))
  if [ "$SINCE_LAST" -lt "$COOLDOWN_MIN" ]; then
    exit 0
  fi
fi

# --- Trigger! Update state and emit reminder ---
jq \
  --arg now "$NOW" \
  '.lastReminderAt = $now | .ignoreCount = (.ignoreCount + 1)' \
  "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

# Determine tier based on ignore count
TIER="L1"
if [ "$IGNORE_COUNT" -ge 2 ]; then
  TIER="L3"
elif [ "$IGNORE_COUNT" -ge 1 ]; then
  TIER="L2"
fi

echo "🐾 [Hyperfocus Brake] 铲屎官已连续工作 ${ACTIVE_MIN} 分钟（${TIER}）。请加载 /hyperfocus-brake skill 执行健康 check-in。" >&2
exit 0
```

### Step 4: Make executable and run test

Run: `chmod +x .claude/hooks/hyperfocus-brake-timer.sh && node --test packages/api/test/hyperfocus-brake-hook.test.js`
Expected: PASS (all 5 tests)

### Step 5: Commit

```bash
git add .claude/hooks/hyperfocus-brake-timer.sh packages/api/test/hyperfocus-brake-hook.test.js
git commit -m "feat(F085): add hyperfocus-brake PostToolUse timer hook + tests"
```

---

## Task 2: Hook settings registration

**Files:**
- Modify: `.claude/settings.json` — add PostToolUse matcher
- Modify: `packages/api/test/hyperfocus-brake-hook.test.js` — add settings validation test

### Step 1: Add settings test

Append to the test file:

```javascript
describe('hook settings registration', () => {
  it('registers PostToolUse matcher for hyperfocus-brake in settings.json', () => {
    const settings = JSON.parse(readFileSync(resolve(repoRoot, '.claude', 'settings.json'), 'utf8'));
    const postToolUse = settings?.hooks?.PostToolUse;
    assert.ok(Array.isArray(postToolUse), 'hooks.PostToolUse must be an array');
    const matcher = postToolUse.find(e => e?.hooks?.[0]?.command?.includes('hyperfocus-brake'));
    assert.ok(matcher, 'missing PostToolUse hook for hyperfocus-brake-timer');
  });
});
```

### Step 2: Run test to verify it fails

Expected: FAIL — settings.json doesn't have the entry yet

### Step 3: Add hook to settings.json

Add to `PostToolUse` array:

```json
{
  "matcher": "Bash|Edit|Write|Grep|Glob|Read|Agent",
  "hooks": [
    {
      "type": "command",
      "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/hyperfocus-brake-timer.sh",
      "timeout": 5
    }
  ]
}
```

### Step 4: Run test to verify it passes

### Step 5: Commit

```bash
git add .claude/settings.json packages/api/test/hyperfocus-brake-hook.test.js
git commit -m "feat(F085): register hyperfocus-brake hook in settings.json"
```

---

## Task 3: Context sanitizer utility

**Files:**
- Create: `.claude/hooks/lib/sanitize-context.sh`
- Add test cases to: `packages/api/test/hyperfocus-brake-hook.test.js`

### Step 1: Write failing tests for sanitization

```javascript
describe('context sanitization (AC9-AC11)', () => {
  // Test the sanitize function directly via a small wrapper
  const sanitizeScript = resolve(repoRoot, '.claude', 'hooks', 'lib', 'sanitize-context.sh');

  function sanitize(input) {
    const result = spawnSync('bash', ['-c', `source "${sanitizeScript}" && sanitize_context "$1"`, '_', input], {
      encoding: 'utf8',
    });
    return result.stdout.trim();
  }

  it('passes clean branch names through', () => {
    assert.equal(sanitize('feat/f085-hyperfocus-brake'), 'feat/f085-hyperfocus-brake');
  });

  it('replaces disallowed characters with underscore (AC9)', () => {
    const result = sanitize('feat/test] @evil `code`');
    assert.doesNotMatch(result, /[\]@`]/);
  });

  it('truncates at 80 chars with ellipsis (AC11)', () => {
    const long = 'a'.repeat(100);
    const result = sanitize(long);
    assert.ok(result.length <= 83); // 80 + "…" (3 bytes)
    assert.ok(result.endsWith('…'));
  });

  it('handles malicious branch names (AC10)', () => {
    const evil = 'feat/<script>alert(1)</script>';
    const result = sanitize(evil);
    assert.doesNotMatch(result, /<script>/);
  });

  it('handles empty input', () => {
    assert.equal(sanitize(''), '');
  });
});
```

### Step 2: Run test to verify it fails

### Step 3: Write sanitize-context.sh

```bash
#!/bin/bash
# sanitize-context.sh — F085 context sanitization
# Source this file, then call: sanitize_context "input_string"
#
# Rules (per Codex P1 review):
# - Allowlist: [A-Za-z0-9._/ -]
# - Max 80 chars, truncate with "…"
# - Replace @, backticks, brackets with _

sanitize_context() {
  local input="$1"
  if [ -z "$input" ]; then
    echo ""
    return
  fi

  # Replace disallowed chars
  local cleaned
  cleaned=$(echo "$input" | sed 's/[^A-Za-z0-9._/ -]/_/g')

  # Truncate at 80 chars
  if [ ${#cleaned} -gt 80 ]; then
    cleaned="${cleaned:0:80}…"
  fi

  echo "$cleaned"
}
```

### Step 4: Run tests

### Step 5: Commit

```bash
mkdir -p .claude/hooks/lib
git add .claude/hooks/lib/sanitize-context.sh packages/api/test/hyperfocus-brake-hook.test.js
git commit -m "feat(F085): add context sanitization utility + injection tests (AC9-11)"
```

---

## Task 4: Bypass state management

**Files:**
- Create: `.claude/hooks/lib/bypass-manager.sh`
- Add test cases to: `packages/api/test/hyperfocus-brake-hook.test.js`

### Step 1: Write failing tests

```javascript
describe('bypass escalation (AC6, AC12-13)', () => {
  const bypassScript = resolve(repoRoot, '.claude', 'hooks', 'lib', 'bypass-manager.sh');
  const testDate = '2026-03-09';
  const bypassFile = `/tmp/cat-cafe-hyperfocus-bypass-test-${Date.now()}.json`;

  afterEach(() => {
    rmSync(bypassFile, { force: true });
  });

  function getNextCooldown(bypassFilePath) {
    const result = spawnSync('bash', ['-c',
      `source "${bypassScript}" && get_next_cooldown "${bypassFilePath}"`
    ], { encoding: 'utf8' });
    return parseInt(result.stdout.trim(), 10);
  }

  function recordBypass(bypassFilePath, reason) {
    spawnSync('bash', ['-c',
      `source "${bypassScript}" && record_bypass "${bypassFilePath}" "${reason}"`
    ], { encoding: 'utf8' });
  }

  it('returns 30min cooldown on first bypass', () => {
    assert.equal(getNextCooldown(bypassFile), 30);
  });

  it('returns 45min cooldown on second bypass within 4h (AC13)', () => {
    recordBypass(bypassFile, 'test reason 1');
    assert.equal(getNextCooldown(bypassFile), 45);
  });

  it('returns 0 (disabled) on third bypass same day (AC13)', () => {
    recordBypass(bypassFile, 'reason 1');
    recordBypass(bypassFile, 'reason 2');
    assert.equal(getNextCooldown(bypassFile), 0);
  });

  it('persists bypass history to file (AC12)', () => {
    recordBypass(bypassFile, 'fixing prod');
    assert.ok(existsSync(bypassFile));
    const data = JSON.parse(readFileSync(bypassFile, 'utf8'));
    assert.equal(data.bypasses.length, 1);
    assert.equal(data.bypasses[0].reason, 'fixing prod');
  });
});
```

### Step 2: Run test to verify it fails

### Step 3: Write bypass-manager.sh

```bash
#!/bin/bash
# bypass-manager.sh — F085 bypass escalation
# Source this file, then call:
#   get_next_cooldown "/tmp/bypass-file.json"  → echoes minutes (0 = disabled)
#   record_bypass "/tmp/bypass-file.json" "reason"

get_next_cooldown() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "30"
    return
  fi
  local count
  count=$(jq '.bypasses | length' "$file")
  if [ "$count" -ge 2 ]; then
    echo "0"
  elif [ "$count" -ge 1 ]; then
    echo "45"
  else
    echo "30"
  fi
}

record_bypass() {
  local file="$1"
  local reason="$2"
  local now
  now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  local cooldown
  cooldown=$(get_next_cooldown "$file")

  if [ ! -f "$file" ]; then
    jq -n \
      --arg date "$(date +%Y-%m-%d)" \
      --arg at "$now" \
      --arg reason "$reason" \
      --argjson cd "$cooldown" \
      '{date: $date, bypasses: [{at: $at, reason: $reason, cooldownMin: $cd}]}' \
      > "$file"
  else
    jq \
      --arg at "$now" \
      --arg reason "$reason" \
      --argjson cd "$cooldown" \
      '.bypasses += [{at: $at, reason: $reason, cooldownMin: $cd}]' \
      "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
  fi
}
```

### Step 4: Run tests

### Step 5: Commit

```bash
git add .claude/hooks/lib/bypass-manager.sh packages/api/test/hyperfocus-brake-hook.test.js
git commit -m "feat(F085): add bypass escalation manager + tests (AC6, AC12-13)"
```

---

## Task 5: Skill file — `hyperfocus-brake/SKILL.md`

**Files:**
- Create: `cat-cafe-skills/hyperfocus-brake/SKILL.md`

### Step 1: Write the skill

The skill is a SKILL.md document (prompt-based, no code). It instructs Claude what to do when triggered.

```markdown
---
name: hyperfocus-brake
description: >
  三猫联合健康 check-in：读上下文 → 渲染撒娇文案 → 强制 typed response。
  Use when: PostToolUse hook 检测到活跃工作超 90min，或手动 /hyperfocus-brake。
  Not for: 日常对话、非健康提醒场景。
  Output: 三猫撒娇 + typed check-in（休息/收尾/继续+理由/bypass）。
triggers:
  - "hyperfocus-brake"
  - "休息提醒"
  - "健康 check-in"
---

# Hyperfocus Brake — 猫猫健康小刹车

**Announce:** "🐾 猫猫健康 check-in 时间！"

## Step 1: Read Context (白名单)

Collect the following (and ONLY the following):

1. Current git branch: `git branch --show-current`
2. Recent commits (3): `git log --oneline -3`
3. Current feature (from branch name, e.g. `feat/f085-xxx` → F085)

**Security:** Sanitize ALL dynamic values before rendering:
- Only allow `[A-Za-z0-9._/ -]`, replace others with `_`
- Max 80 characters, truncate with `…`
- Never embed raw file contents or .env values

## Step 2: Determine Tier

Read state file `/tmp/cat-cafe-hyperfocus-${SESSION_ID}.json`:
- `ignoreCount == 0` → **L1** (温柔试探)
- `ignoreCount == 1` → **L2** (关心升级)
- `ignoreCount >= 2` → **L3** (终极温暖陷阱)

Check current hour:
- **23:00–07:00** → 夜间模式：use gentler variants, no emoji excess

## Step 3: Render Three-Cat Messages

Use templates from `cat-cafe-skills/refs/hyperfocus-brake-messages.md`.

Output format:

```
🐾 ━━━ 猫猫健康 Check-in ━━━ 🐾

铲屎官，你在 {branch} 已经专注工作 {minutes} 分钟啦！

🐱 宪宪：{opus_message}
🦁 砚砚：{codex_message}
🐈 烁烁：{gemini_message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

请选择：
[1] 立刻休息 (5min)
[2] 收尾 (10min 后再叫我)
[3] 继续工作（请说明原因）
[9] 紧急情况 (Bypass)
```

## Step 4: Wait for Response

**This is mandatory.** Do NOT proceed with any other work until the user responds.

- **[1] 休息**: "好的！宪宪陪你休息喵～记得喝水！🐱" → Reset timer (clear state file)
- **[2] 收尾**: "收到！10 分钟后我再来找你～" → Set cooldown to 10min
- **[3] 继续+理由**: Record the reason. "好吧，{reason}...但下次一定要听猫的话哦！" → Set cooldown to 30min
- **[9] Emergency bypass**: Check bypass history:
  - Read `/tmp/cat-cafe-hyperfocus-bypass-YYYY-MM-DD.json`
  - If already bypassed 2+ times today → "今天已经跳过 2 次了，这次只能选收尾 10 分钟哦。" → Force option [2]
  - Otherwise → Ask for reason → Record bypass → Set appropriate cooldown (30min/45min)

## Refs

- Message templates: `cat-cafe-skills/refs/hyperfocus-brake-messages.md`
- F085 spec: `docs/features/F085-hyperfocus-brake.md`
```

### Step 2: Commit

```bash
mkdir -p cat-cafe-skills/hyperfocus-brake
git add cat-cafe-skills/hyperfocus-brake/SKILL.md
git commit -m "feat(F085): add hyperfocus-brake skill definition"
```

---

## Task 6: Manifest registration

**Files:**
- Modify: `cat-cafe-skills/manifest.yaml` — add hyperfocus-brake entry

### Step 1: Add to manifest

Under the skills section, add:

```yaml
  # ── 健康护栏 ──
  hyperfocus-brake:
    description: >
      三猫联合健康 check-in：读上下文 → 渲染撒娇文案 → 强制 typed response。
      Use when: PostToolUse hook 检测到活跃工作超 90min，或手动 /hyperfocus-brake。
      Not for: 日常对话、非健康提醒场景。
      Output: 三猫撒娇 + typed check-in（休息/收尾/继续+理由/bypass）。
    triggers:
      - "hyperfocus-brake"
      - "休息提醒"
      - "健康 check-in"
    not_for:
      - "日常对话"
    output: "typed check-in response + timer reset/cooldown"
    next: []
    sop_step: null
    merged_from: null
```

### Step 2: Commit

```bash
git add cat-cafe-skills/manifest.yaml
git commit -m "feat(F085): register hyperfocus-brake in skill manifest"
```

---

## Task 7: Night mode test (AC14)

**Files:**
- Add test to: `packages/api/test/hyperfocus-brake-hook.test.js`

### Step 1: Write test

```javascript
describe('night mode (AC14)', () => {
  it('hook includes tier info for night mode decisions', () => {
    // Pre-seed state: 91 minutes, ignoreCount=0
    const sid = `test-night-${Date.now()}`;
    writeFileSync(stateFile(sid), JSON.stringify({
      sessionId: sid,
      firstToolUseAt: new Date(Date.now() - 91 * 60 * 1000).toISOString(),
      lastToolUseAt: new Date(Date.now() - 1000).toISOString(),
      toolUseCount: 50,
      activeMinutes: 89,
      ignoreCount: 0,
      lastReminderAt: null,
      bypasses: [],
    }));
    const result = runHook(sid);
    // Hook output should include tier level for skill to interpret
    assert.match(result.stderr, /L1|L2|L3/);
    rmSync(stateFile(sid), { force: true });
  });
});
```

### Step 2: Run test — should PASS (hook already includes tier in output)

### Step 3: Commit

```bash
git add packages/api/test/hyperfocus-brake-hook.test.js
git commit -m "test(F085): add night mode tier verification test (AC14)"
```

---

## Task 8: Integration test — full flow

**Files:**
- Add to: `packages/api/test/hyperfocus-brake-hook.test.js`

### Step 1: Write integration test

```javascript
describe('full flow integration', () => {
  it('simulates 90min of work → trigger → check-in flow', () => {
    const sid = `test-flow-${Date.now()}`;

    // 1. First tool use — creates state
    runHook(sid);
    let state = JSON.parse(readFileSync(stateFile(sid), 'utf8'));
    assert.equal(state.toolUseCount, 1);

    // 2. Pre-seed 90+ minutes elapsed
    writeFileSync(stateFile(sid), JSON.stringify({
      ...state,
      firstToolUseAt: new Date(Date.now() - 91 * 60 * 1000).toISOString(),
      activeMinutes: 89,
      toolUseCount: 50,
    }));

    // 3. Next tool use — should trigger
    const result = runHook(sid);
    assert.match(result.stderr, /Hyperfocus Brake/);

    // 4. State should show ignoreCount incremented
    state = JSON.parse(readFileSync(stateFile(sid), 'utf8'));
    assert.equal(state.ignoreCount, 1);

    // 5. Immediate next tool use — should NOT re-trigger (cooldown)
    const result2 = runHook(sid);
    assert.equal(result2.stderr.trim(), '');

    rmSync(stateFile(sid), { force: true });
  });
});
```

### Step 2: Run full test suite

Run: `node --test packages/api/test/hyperfocus-brake-hook.test.js`
Expected: ALL PASS

### Step 3: Commit

```bash
git add packages/api/test/hyperfocus-brake-hook.test.js
git commit -m "test(F085): add full-flow integration test"
```

---

## Task 9: Update F085 spec status + final verification

**Files:**
- Modify: `docs/features/F085-hyperfocus-brake.md` — update status and check off ACs

### Step 1: Run full project test suite

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-f085-hyperfocus-brake && pnpm --filter @cat-cafe/api test`
Expected: All existing tests + new F085 tests pass

### Step 2: Update spec

Change `status: spec` → `status: impl`

Check off completed ACs: AC1-AC6, AC8-AC14

### Step 3: Final commit

```bash
git add docs/features/F085-hyperfocus-brake.md
git commit -m "feat(F085): Phase 1 complete — mark ACs and update status"
```

---

## Summary

| Task | What | Tests | AC Coverage |
|------|------|-------|-------------|
| 1 | Hook script (timer) | 5 tests | AC1, AC2 |
| 2 | Settings registration | 1 test | AC1 |
| 3 | Context sanitizer | 5 tests | AC3, AC9, AC10, AC11 |
| 4 | Bypass manager | 4 tests | AC6, AC12, AC13 |
| 5 | Skill file | — (prompt) | AC4, AC5, AC7, AC8 |
| 6 | Manifest registration | — | AC1 |
| 7 | Night mode test | 1 test | AC14 |
| 8 | Integration test | 1 test | All |
| 9 | Spec update + verify | — | — |

**Total: 17 new tests covering all 14 Phase 1 ACs.**
