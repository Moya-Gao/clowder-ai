---
feature_ids: [F236]
topics: [anchor, eval, telemetry, carrier]
---

# F236 Phase E: Eval Consumer Bridge

> Plan owner: 宪宪/opus-4.6 | Date: 2026-06-25

## Problem

Phase C's PostToolUse hook (`f236-anchor-posttool.mjs`) writes cc-native tool anchor eval events to `/tmp/cat-cafe-anchor-eval-{invocationId}.jsonl`. These events contain Track-2 compatible fields (tool, itemIds, originalChars, returnedChars, modeResolved, modeSource, catId, ts) — but the API server's `recordAnchorPreviewEvent()` never sees them because the hook runs in a cc subprocess, not inside the API server process.

**Result**: The anchor telemetry rollup (`getAnchorTelemetryRollup`) only sees MCP-side events (thread-context, pending-mentions, list-tasks, get-message). The cc-native tool events (cc-read, cc-grep, cc-glob) — which are the token **big head** — are invisible to the eval/sunset system.

## Design

### Pattern: TranscriptTailer reuse

The carrier (`ClaudeInteractivePtyCarrierService`) already uses `TranscriptTailer` to tail the F230 hook sidecar jsonl. We follow the exact same pattern:

1. **Pure-function consumer** (`AnchorEvalBridgeConsumer.ts`): Transforms eval jsonl entries to `AnchorPreviewEventInput[]`. Same pattern as `HookSidechannelConsumer.ts` (pure, no I/O, no state).

2. **Carrier wiring**: In the carrier's output loop poll tick, a second TranscriptTailer reads the eval jsonl. New entries → consumer transform → `recordAnchorPreviewEvent()`.

3. **Hook-setup integration**: `setupHookInfrastructure()` must register the F236 anchor hook as a second PostToolUse entry so managed PTY sessions get anchor-eval events too (currently it overwrites `.claude/settings.json` with only the capture script, wiping any project-level F236 hook config).

### Data flow

```
cc PostToolUse hook (f236-anchor-posttool.mjs)
  → appendFileSync('/tmp/cat-cafe-anchor-eval-{invocationId}.jsonl', event)

Carrier poll tick (ClaudeInteractivePtyCarrierService)
  → TranscriptTailer.readNew() on eval jsonl
  → evalEntriesToPreviewEvents() (AnchorEvalBridgeConsumer)
  → recordAnchorPreviewEvent() (anchor-event-log)
  → Events visible in rollup/sunset/verdict
```

### Key decisions

- **Eval path resolution**: `callbackEnv.CAT_CAFE_INVOCATION_ID` → `/tmp/cat-cafe-anchor-eval-${invocationId}.jsonl`. No invocation ID → no bridge (interactive standalone sessions without managed invocation don't have a carrier anyway).
- **Idempotency**: TranscriptTailer's line offset tracking prevents double-ingestion.
- **Error isolation**: Eval consumption failure must NOT affect the carrier's primary output loop (try/catch around eval ingestion, same as hook sidecar).
- **Cleanup**: Eval jsonl cleaned up alongside hook sidecar in carrier's finally block.

### Hook-setup changes (managed PTY integration)

`setupHookInfrastructure()` must add the F236 anchor hook path as a second PostToolUse hook entry:

```javascript
PostToolUse: [
  hookEntry(captureScriptPath),
  hookEntry(anchorHookPath),  // F236 anchor + eval
]
```

The anchor hook path = `{cwd}/.claude/hooks/f236-anchor-posttool.mjs`. The capture script reads stdin → writes to sidecar (no stdout). The anchor hook reads stdin → maybe writes anchor replacement to stdout AND appends eval event to eval jsonl. Both run; cc chains them.

**Caveat**: The anchor hook is a Node.js script (ESM, `#!/usr/bin/env node`), not POSIX sh. It requires Node.js in PATH. Managed sessions run in the project cwd which has the hook script available.

## Stateful object gate

| Object | States | Transitions |
|--------|--------|-------------|
| Eval TranscriptTailer | not-created → tailing → drained | Created when carrier starts if invocationId exists; reads on each poll; drained on carrier shutdown |
| Eval jsonl file | absent → writing → complete | Created by hook's first `appendEvalEvent()`; grows via append; no explicit "done" marker (carrier polls until session ends) |

**Invariants**:
- TranscriptTailer never rereads lines it already emitted (monotonic offset)
- `recordAnchorPreviewEvent()` is idempotent on shape (dedup by event counter)
- Eval bridge failure is non-fatal (try/catch, carrier continues)

## Files to create/modify

| File | Action |
|------|--------|
| `packages/api/src/domains/cats/services/agents/providers/AnchorEvalBridgeConsumer.ts` | **CREATE** — pure-function transform |
| `packages/api/src/domains/cats/services/agents/providers/ClaudeInteractivePtyCarrierService.ts` | **MODIFY** — add eval tailer + bridge in output loop |
| `packages/api/src/domains/cats/services/agents/providers/pty/hook-setup.ts` | **MODIFY** — register F236 hook for managed sessions |
| `packages/api/test/f236-eval-consumer-bridge.test.js` | **CREATE** — tests for consumer + bridge |

## Test plan

1. **Consumer unit tests** (AnchorEvalBridgeConsumer):
   - Valid entry → correct AnchorPreviewEventInput shape
   - Missing fields → skip gracefully
   - Non-object entries → skip
   - Empty array → empty result
   - Multiple entries → correct count

2. **Integration test** (eval bridge end-to-end):
   - Write eval events to temp jsonl file
   - Tail with TranscriptTailer
   - Transform via consumer
   - Assert recordAnchorPreviewEvent received correct data

3. **Hook-setup test** (managed PTY integration):
   - setupHookInfrastructure registers F236 hook in PostToolUse array
   - Cleanup restores original settings

## Scope note (gpt52 R1 P1 — corrected claim)

This PR **advances** AC-C4 but does NOT fully close it. AC-C4 requires bilateral
eval ("Read drill 净收益 = 省 − drill 成本"), meaning both preview AND drill
telemetry for cc-native tools. This consumer bridge wires the **preview** side:
hook eval events → `recordAnchorPreviewEvent()`. But cc drill telemetry does not
exist yet:

- `AnchorDrillTool` is `'get-message' | 'list-tasks'` — no cc tools
- The hook treats bounded `Read(offset, limit)` as pure pass-through with no drill
  event emission (correct behavior for the cat, but no eval signal)
- Without drill events, the rollup's `netBenefit` for cc tools = `charsSaved - 0`,
  overstating benefit and making `openRateByItem` permanently 0

**Remaining for AC-C4 closure**: cc drill telemetry (hook emits drill events for
bounded Read pass-through + consumer/type extensions for `AnchorDrillTool`).

## Architecture ownership

- Architecture cell: `carrier/pty-interactive` + `harness-eval/anchor-first`
- Map delta: none (consumer bridge, no new cell)
- Why: Closing the preview-side data gap between cc subprocess and API server for anchor telemetry; drill side remains as Phase E follow-on
