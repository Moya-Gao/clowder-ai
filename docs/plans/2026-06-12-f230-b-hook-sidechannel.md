# F230 B-hook: Hook Sidechannel Implementation Plan

**Feature:** F230 — `docs/features/F230-claude-interactive-pty-carrier.md`
**Goal:** Replace transcript-tail output face with hook-sidechannel, unpin 2.1.170
**Acceptance Criteria:**
- Carrier uses Stop + PostToolUse hooks for output (not transcript)
- Works on system claude (any version, 2.1.175 spike-verified)
- Factory no longer requires 2.1.170 pin
- Existing smoke + carrier tests pass on hook path
- Usage degraded (no token data from hooks — accepted per spike)
**Architecture cell:** F143 Hostable Agent Runtime (carrier domain)
**Map delta:** none — same carrier abstraction, different output channel
**Architecture:** PTY input face unchanged. Output face switches from tailing claude's internal transcript jsonl to tailing a hook-written sidecar jsonl. Stop hook = terminal signal (replaces turn_duration). PostToolUse hook = tool step visibility. TranscriptTailer reused for sidecar (generic jsonl reader). New HookSidechannelConsumer replaces BgTranscriptEventConsumer for event transform.
**Tech Stack:** node:fs, node:child_process (tmux), claude hooks API
**Not building:** usage recovery (future), streaming (structural), Phase C lifecycle

---

## Terminal Schema (Hook Events)

```typescript
/** Stop hook stdin — fires at end of each assistant turn */
interface StopHookEvent {
  hook_event_name: 'Stop';
  session_id: string;           // UUID, stable across turns
  last_assistant_message: string; // full reply text
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  stop_hook_active: boolean;
  // no usage/token fields — spike-confirmed gap
}

/** PostToolUse hook stdin — fires after each tool call */
interface PostToolUseHookEvent {
  hook_event_name: 'PostToolUse';
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: string;          // tool output content
  tool_use_id: string;
  duration_ms: number;
}

type HookEvent = StopHookEvent | PostToolUseHookEvent;
```

Sidecar file: `<tmpDir>/f230-hook-<sessionName>.jsonl` — one JSON line per hook event.

## Stateful Object Gate

**Census:** One new stateful object — the sidecar jsonl file.

| State | Events | Next State |
|-------|--------|------------|
| not-exist | driver.start() creates hook infra | empty |
| empty | first PostToolUse/Stop fires | has-lines |
| has-lines | more events append | has-lines |
| has-lines | Stop event | terminal (carrier breaks loop) |
| terminal | driver.dispose() | cleaned up |

**Invariants:**
- INV-1: sidecar file exists before injectPrompt (created in start)
- INV-2: each sidecar line JSON-parses to a HookEvent
- INV-3: Stop event appears exactly once per turn (terminal signal)
- INV-4: session_id consistent across all events in one session

**Adversarial:** hook script crash → sidecar not written → silence timeout fires (existing fallback). Concurrent hooks (PostToolUse + Stop rapid fire) → shell append is line-level atomic for small writes (< PIPE_BUF).

---

## Task 1: HookSidechannelConsumer (new file)

Pure functions — transforms hook events to AgentMessages. No I/O.

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/HookSidechannelConsumer.ts`
- Test: `packages/api/test/f230-hook-sidechannel-consumer.test.js`

### Step 1: Red — Stop event → text message

```javascript
// test: Stop hook event transforms to text AgentMessage
const entries = [{ hook_event_name: 'Stop', session_id: 'abc', last_assistant_message: 'Hello world' }];
const msgs = hookEntriesToAgentMessages(entries, { catId: 'opus' });
assert.equal(msgs.length, 1);
assert.equal(msgs[0].type, 'text');
assert.equal(msgs[0].content, 'Hello world');
assert.equal(msgs[0].catId, 'opus');
```

### Step 2: Green — implement hookEntriesToAgentMessages for Stop

```typescript
export function hookEntriesToAgentMessages(
  entries: unknown[], opts: { catId: CatId }
): AgentMessage[] {
  const msgs: AgentMessage[] = [];
  for (const raw of entries) {
    const entry = raw as Record<string, unknown>;
    if (entry.hook_event_name === 'Stop' && typeof entry.last_assistant_message === 'string') {
      msgs.push({ type: 'text', catId: opts.catId, content: entry.last_assistant_message, timestamp: Date.now() });
    }
  }
  return msgs;
}
```

### Step 3: Red — PostToolUse event → tool_use message

```javascript
const entries = [{ hook_event_name: 'PostToolUse', session_id: 'abc',
  tool_name: 'Read', tool_input: { path: '/foo' }, tool_response: 'file contents',
  tool_use_id: 'tu_1', duration_ms: 150 }];
const msgs = hookEntriesToAgentMessages(entries, { catId: 'opus' });
assert.equal(msgs[0].type, 'tool_use');
assert.equal(msgs[0].toolName, 'Read');
```

### Step 4: Green — add PostToolUse branch

### Step 5: Red — isHookTerminalEvent helper

```javascript
assert.equal(isHookTerminalEvent({ hook_event_name: 'Stop' }), true);
assert.equal(isHookTerminalEvent({ hook_event_name: 'PostToolUse' }), false);
assert.equal(isHookTerminalEvent({ type: 'system' }), false); // non-hook entry
```

### Step 6: Green — implement isHookTerminalEvent

### Step 7: Red — extractSessionIdFromHookEntries

```javascript
const entries = [
  { hook_event_name: 'PostToolUse', session_id: 'abc-123' },
  { hook_event_name: 'Stop', session_id: 'abc-123' },
];
assert.equal(extractSessionIdFromHookEntries(entries), 'abc-123');
assert.equal(extractSessionIdFromHookEntries([]), undefined);
```

### Step 8: Green — implement. Commit Task 1.

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-feat-f230-hook-sidechannel && pnpm --filter @cat-cafe/api test -- --test-name-pattern 'hook-sidechannel'`

---

## Task 2: Hook Setup Utilities (new file)

Creates hook infrastructure in PTY cwd: settings.json + capture script.

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/pty/hook-setup.ts`
- Test: `packages/api/test/f230-hook-setup.test.js`

### Step 9: Red — writeHookSettings creates .claude/settings.json

```javascript
const tmpCwd = mkdtempSync(join(tmpdir(), 'hook-test-'));
const sidecarPath = join(tmpCwd, 'sidecar.jsonl');
const { settingsPath, scriptPath } = await setupHookInfrastructure(tmpCwd, sidecarPath);
assert.ok(existsSync(settingsPath));
const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
assert.ok(settings.hooks.Stop);
assert.ok(settings.hooks.PostToolUse);
```

### Step 10: Green — implement setupHookInfrastructure

Core logic:
1. `mkdirSync(<cwd>/.claude, { recursive: true })`
2. Write capture script to temp dir (reads stdin → appends to `$CAT_CAFE_HOOK_SIDECAR`)
3. `chmod +x` the script
4. Write `.claude/settings.json` with Stop + PostToolUse hooks pointing to script
5. Return `{ settingsPath, scriptPath, cleanup }` — cleanup restores original settings

### Step 11: Red — capture script is executable and reads from stdin

```javascript
// Write test data to a temp file, pipe through the capture script
const { scriptPath } = await setupHookInfrastructure(tmpCwd, sidecarPath);
execSync(`echo '{"test":true}' | ${scriptPath}`, { env: { ...process.env, CAT_CAFE_HOOK_SIDECAR: sidecarPath } });
const lines = readFileSync(sidecarPath, 'utf8').trim().split('\n');
assert.equal(lines.length, 1);
assert.deepEqual(JSON.parse(lines[0]), { test: true });
```

### Step 12: Green — implement. Commit Task 2.

### Step 13: Red — cleanupHookInfrastructure restores original settings

```javascript
const originalSettings = '{"existingKey": true}';
writeFileSync(join(tmpCwd, '.claude', 'settings.json'), originalSettings);
// ... setup + cleanup
assert.equal(readFileSync(settingsPath, 'utf8'), originalSettings);
```

### Step 14: Green — implement backup/restore in cleanup. Commit.

---

## Task 3: PtyDriver — hook sidecar integration

Modify PtyDriver to set up hooks and pass sidecar path.

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/pty/PtyDriver.ts`
- Modify: `packages/api/test/f230-pty-driver-helpers.test.js`

### Step 15: Add hookSidecarPath option to PtyDriverOptions

```typescript
// In PtyDriverOptions interface:
/** Path to hook sidecar jsonl. When set, hooks are configured in cwd. */
hookSidecarPath?: string;
```

### Step 16: Modify start() — setup hooks before tmux session

After `this.sessionName = generateSessionName(...)` and before tmux new-session:
```typescript
if (this.opts.hookSidecarPath) {
  this.hookCleanup = await setupHookInfrastructure(cwd, this.opts.hookSidecarPath);
  // Add sidecar path to env delta so hook script can find it
  envDelta.CAT_CAFE_HOOK_SIDECAR = this.opts.hookSidecarPath;
}
```

Note: hooks setup MUST be in cwd BEFORE claude starts (settings.json read at startup).

### Step 17: Modify dispose() — cleanup hooks

```typescript
if (this.hookCleanup) await this.hookCleanup.cleanup();
```

### Step 18: Add CAT_CAFE_HOOK_SIDECAR to tmux -e env vars

Already handled by the existing env loop (string values → tmux -e KEY=VALUE).

### Step 19: Test — verify hookSidecarPath flows through to env. Commit Task 3.

Line budget: PtyDriver is at 339 lines. Steps 15-18 add ~15 lines. Extract `setupHookInfrastructure` call into hook-setup.ts keeps PtyDriver under 350.

---

## Task 4: CarrierService — switch to hook sidecar

The core switch: tail sidecar instead of transcript, use hook consumer.

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/ClaudeInteractivePtyCarrierService.ts`
- Modify: `packages/api/test/f230-interactive-pty-carrier.test.js`

### Step 20: Create sidecar path in invoke()

Before driver setup:
```typescript
const sidecarDir = mkdtempSync(join(tmpdir(), 'f230-hook-sidecar-'));
const sidecarPath = join(sidecarDir, `hook-events.jsonl`);
writeFileSync(sidecarPath, '', 'utf8'); // create empty file for tailer
```

Pass `hookSidecarPath: sidecarPath` to driver factory.

### Step 21: Switch to sidecar tailing

Replace transcript tailing loop:
```typescript
// OLD: const tailer = new TranscriptTailer(transcriptPath, initialLines ?? 0);
// NEW:
const tailer = new TranscriptTailer(sidecarPath, 0);  // always start from 0 (fresh per invocation)
```

### Step 22: Switch consumer + terminal detection

Replace in the polling loop:
```typescript
// OLD: const messages = transcriptEntriesToAgentMessages(entries, { catId });
// NEW:
const messages = hookEntriesToAgentMessages(entries, { catId });

// OLD: if (entry.type === 'system' && entry.subtype === 'turn_duration')
// NEW:
if (isHookTerminalEvent(entry))
```

### Step 23: Session ID from hook events

After the transcript-watch flow still gives us session_id for session_init (transcript file still created in new versions for ai-title). But hook sidecar also carries session_id. For robustness, extract from first hook event if transcript-watch fails:

```typescript
// After yielding messages, if session_id not yet emitted:
if (!sessionInitEmitted) {
  const hookSessionId = extractSessionIdFromHookEntries(entries);
  if (hookSessionId) {
    yield { type: 'session_init', catId, sessionId: hookSessionId, timestamp: Date.now() };
    sessionInitEmitted = true;
  }
}
```

### Step 24: Remove usage accumulation (degraded)

```typescript
// Remove: accumulateUsageFromEntries(acc, entries);
// Replace: const usage = {} as TokenUsage; // degraded — hook has no usage data
```

### Step 25: Update carrier test fixtures

Change MockPtyDriver to accept hookSidecarPath. Change test fixtures from transcript format to hook event format:

```javascript
function stopEventLine(text) {
  return JSON.stringify({
    hook_event_name: 'Stop', session_id: TEST_SESSION_ID,
    last_assistant_message: text
  });
}
function postToolUseLine(toolName, input, response) {
  return JSON.stringify({
    hook_event_name: 'PostToolUse', session_id: TEST_SESSION_ID,
    tool_name: toolName, tool_input: input ?? {}, tool_response: response ?? '',
    tool_use_id: 'tu_test', duration_ms: 100
  });
}
```

### Step 26: Run full carrier test suite. Commit Task 4.

Run: `cd /Users/lysander/projects/relay-station/cat-cafe-feat-f230-hook-sidechannel && pnpm --filter @cat-cafe/api test -- --test-name-pattern 'interactive-pty-carrier'`

Line budget: CarrierService at 348 lines. The switch is mostly replacements (transcript → sidecar, old consumer → new consumer). Net delta ≈ +5/-10 lines. Under 350.

---

## Task 5: Factory — remove 2.1.170 pin

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/claude-carrier-factory.ts`
- Modify: `packages/api/test/claude-carrier-factory.test.js`

### Step 27: Remove resolveInteractivePtyBinary

Delete lines 37-67 (the entire function + constants). Factory becomes:

```typescript
if (carrier === CARRIER_INTERACTIVE_PTY) {
  return new ClaudeInteractivePtyCarrierService({ catId });
  // No claudeBinary → uses system 'claude' (any version, hook sidechannel)
}
```

Remove exports: `CARRIER_PTY_BINARY_KEY`.

### Step 28: Remove graceful fallback try/catch

With no pin, no binary resolution failure → no need for fallback. The carrier just uses `claude` from PATH.

### Step 29: Update factory tests

- Remove: "missing default binary → graceful fallback" test
- Remove: "invalid PTY_BINARY override → graceful fallback" test
- Remove: "non-executable PTY_BINARY override → graceful fallback" test
- Add: "interactive_pty → ClaudeInteractivePtyCarrierService (no pin)" test

```javascript
test('canary factory: interactive_pty → ClaudeInteractivePtyCarrierService (hook sidechannel, no pin)', () => {
  const service = createClaudeAgentServiceForCanary('opus', {
    CAT_CAFE_CLAUDE_CARRIER: 'interactive_pty',
  });
  assert.equal(service.constructor.name, 'ClaudeInteractivePtyCarrierService');
});
```

### Step 30: Run factory tests. Commit Task 5.

### Step 31: Run full gate

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-feat-f230-hook-sidechannel && pnpm gate
```

---

## Task 6: Cleanup + carrier test update for hook

Ensure ALL existing carrier tests work with hook format.

### Step 32: Update remaining carrier tests

Walk through each test in `f230-interactive-pty-carrier.test.js`:
- Step 1 (spike fixture → session_init → text → done): change fixture to Stop event
- Step 2 (abort → cancel): unchanged (abort mechanism same)
- Step 3 (tool_use): change fixture to PostToolUse event
- Step 4 (driver error): unchanged (error handling same)
- Step 13 (image inputs): unchanged (input face unchanged)
- Fallback tests: update for hook events

### Step 33: Run full test suite + gate. Commit Task 6.

---

## Open Questions

| # | Question | Type | Resolution |
|---|----------|------|------------|
| 1 | Does claude support `--settings-file` flag for non-cwd settings? | Technical | Use cwd-level `.claude/settings.json` (spike-verified). If conflicts with existing settings, backup+restore. |
| 2 | Hook capture script: bash vs node? | Technical | Bash (`#!/bin/sh` + `cat` + `printf`) — simpler, no node startup cost, POSIX portable. |
| 3 | Sidecar file atomicity under concurrent hooks | Technical | POSIX guarantees atomic append for writes < PIPE_BUF (4KB). Hook JSON is well under. |

All OQs are technical — no CVO escalation needed.
