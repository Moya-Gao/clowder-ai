---
feature_ids: [F236]
topics: [context-engineering, hooks, anchor, implementation-plan]
doc_kind: plan
created: 2026-06-25
author: opus
---

# F236 Phase C: cc native Read/Grep/Glob anchor化

> ACs: C1 (Read), C2 (Grep/Glob), C4 (eval), C5 (cat-controlled mode)
> AC-C3 (codex/agy) explicitly out of scope.
> Spikes passed: C0a (Read replace), C0b (Grep replace), C0c (cat-mode signaling).

## Architecture

```
Cat ──MCP──▶ cat_cafe_set_read_mode(mode='anchor')
               │
               ▼
         API callback handler
               │
               ▼
         Write mode file (/tmp/cat-cafe-anchor-mode-{invocationId})
               │
               ▼ (later, same session)
Cat uses cc Read/Grep ──▶ cc executes tool ──▶ PostToolUse hook fires
                                                    │
                                                    ▼
                                              Read mode file
                                                    │
                                         ┌──────────┴──────────┐
                                         │                      │
                                   mode=anchor            mode=full/absent
                                         │                      │
                                         ▼                      ▼
                                  Shape-matched            exit 0
                                  replace output         (pass-through)
                                         │
                                         ▼
                                  Cat sees locator
                                  (not synopsis!)
                                         │
                                         ▼
                              Cat drills: Read(offset,limit)
                                         │
                                         ▼
                                  Hook sees bounded
                                  → exit 0 → real slice
```

## Key Design Decisions (from spikes + feature doc pivot)

1. **Shape must match** — `updatedToolOutput` must preserve original tool_response structure; only replace content fields
2. **Read content field**: `.file.content`; **Grep content field**: `.content` — per-tool branching
3. **Bounded drill = unconditional pass-through** — `offset` or `limit` present → exit 0, no re-anchoring
4. **Anchor = locator not synopsis** (ADR-031 hard invariant) — path + total lines + drill pointer, zero summarization
5. **Fail-open default** — no mode file = full text
6. **Empty `.file` anomaly** — cc may cache tool_response; hook fallback to `wc -l` on disk for line count
7. **Mode file keyed by invocation ID** — `/tmp/cat-cafe-anchor-mode-{$CAT_CAFE_INVOCATION_ID}`; hook falls back to `$CLAUDE_PROJECT_DIR/.f236-anchor-mode` for interactive sessions

## Files

### Create
| File | Purpose |
|------|---------|
| `.claude/hooks/f236-anchor-posttool.mjs` | PostToolUse hook — reads mode, conditionally anchorizes |
| `packages/api/test/f236-cc-anchor-hook.test.js` | Hook logic unit tests (mock stdin, assert output shape) |
| `packages/api/test/f236-set-read-mode.test.js` | MCP tool + callback route tests |

### Modify
| File | Change |
|------|--------|
| `.claude/settings.json` | Add PostToolUse hook entry for Read\|Grep\|Glob |
| `packages/mcp-server/src/tools/callback-tools.ts` | Add `cat_cafe_set_read_mode` tool definition |
| `packages/api/src/routes/callbacks.ts` | Add handler for `set-read-mode` endpoint |
| `packages/api/src/routes/anchor-event-log.ts` | Add `cc-read`/`cc-grep`/`cc-glob` to AnchorPreviewTool; emit from hook sidecar |

## Implementation Order (TDD)

### Step 1: AC-C5 — Mode Mechanism (foundation)

**MCP tool `cat_cafe_set_read_mode`**:
- Input: `{ mode: 'anchor' | 'full' }`
- Handler: resolve invocationId from callback auth → write `/tmp/cat-cafe-anchor-mode-{invocationId}` with content = mode value; `full` deletes the file (fail-open semantics)
- Returns: `{ ok: true, mode, path }`

**Tests (red first)**:
- `set_read_mode(anchor)` → file created with "anchor" content
- `set_read_mode(full)` → file deleted
- No mode file → hook returns null (fail-open)

### Step 2: AC-C1 — Read Anchorize

**Hook logic** (`.claude/hooks/f236-anchor-posttool.mjs`):
1. Parse stdin JSON → extract `tool_name`, `tool_input`, `tool_response`
2. If `tool_name !== 'Read'` and `tool_name !== 'Grep'` and `tool_name !== 'Glob'` → exit 0
3. If `tool_input.offset != null || tool_input.limit != null` → exit 0 (bounded drill pass-through)
4. Read mode file → if absent or content !== 'anchor' → exit 0 (fail-open)
5. **Read path**: Extract `filePath` from `tool_response.file` or `tool_input.file_path`
6. Get `totalLines`: from `tool_response.file.totalLines`; fallback: `wc -l` on disk file (anomaly handling)
7. Construct anchor content:
   ```
   [F236-ANCHOR] {filePath} ({totalLines} lines)
   Omitted: {totalLines} lines
   Drill: Read(file_path="{filePath}", offset=1, limit={min(totalLines, 200)})
   ```
8. Output shape-matched replacement: `{ updatedToolOutput: { ...original, file: { ...original.file, content: anchorContent } } }`

**Tests (red first)**:
- Unbounded Read + anchor mode → output has `updatedToolOutput` with locator content, original shape preserved
- Unbounded Read + no mode → no output (pass-through)
- Bounded Read (offset=5, limit=10) + anchor mode → no output (pass-through)
- Empty `.file` + anchor mode → fallback to disk stat for line count
- Invariant: anchor content contains NO lines from original file content (locator not synopsis)

### Step 3: AC-C2 — Grep/Glob Anchorize

**Hook logic** (same file, branching on `tool_name`):

**Grep**:
1. Extract from `tool_response`: `numFiles`, `filenames`, `numLines`, `content`
2. Parse `content` to count per-file matches (lines per file from `filename:linenum:text` format)
3. Construct anchor:
   ```
   [F236-ANCHOR] Grep: {numFiles} files, {numLines} lines matched
   Pattern: "{tool_input.pattern}"
   {filenames[0]} ({count} hits)
   {filenames[1]} ({count} hits)
   ...
   Drill: Grep(pattern="{pattern}", path="{filenames[0]}") or Read(file_path="{filenames[0]}")
   ```
4. Output: `{ updatedToolOutput: { ...original, content: anchorContent } }`

**Glob**:
- Capture shape during implementation (not spike-tested, "与 Grep 同理待验")
- Expected: similar structure, file list + drill pointers

**Tests (red first)**:
- Grep + anchor mode → anchored with file counts, pattern preserved
- Grep + no mode → pass-through
- Glob + anchor mode → anchored with file list
- Invariant: no original file content in anchor output

### Step 4: AC-C4 — Eval Integration (partial — consumer deferred)

**Done in Phase C**:
- ✅ Extend `AnchorPreviewTool` type to include `'cc-read' | 'cc-grep' | 'cc-glob'`
- ✅ Hook emits Track-2 compatible eval events to `/tmp/cat-cafe-anchor-eval-{invocationId}.jsonl` with fields: `tool`, `itemIds` (file-level), `originalChars`, `returnedChars`, `modeResolved`, `modeSource`, `catId`
- ✅ Tests: cc-read/cc-grep/cc-glob event fields validated + rollup filter includes cc tools

**Deferred to Phase E** (≥3 round review escalation — plan assumption was wrong):
- ❌ ~~Emit events from hook sidecar consumption path (TranscriptTailer already reads sidecar JSONL)~~
- **Correction**: F236 anchor hook and carrier hook-capture (`pty/hook-setup.ts`) are **independent hooks** writing to **separate sidecar files**. TranscriptTailer reads carrier's sidecar, not the anchor eval file. Bridging requires either: (a) shared sidecar path via env var + HookSidechannelConsumer extension, or (b) dedicated API endpoint for eval flush. Both need Phase E eval domain infrastructure.
- Phase C guarantees: data shape matches `AnchorPreviewEventInput` contract exactly — Phase E consumer only needs to read jsonl + call `recordAnchorPreviewEvent()`, no hook changes needed.

### Step 5: settings.json Update

Add to PostToolUse hooks (alongside existing `posttool-evidence-marker.sh`):
```json
{
  "matcher": "Read|Grep|Glob",
  "hooks": [{
    "type": "command",
    "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/f236-anchor-posttool.mjs",
    "timeout": 5
  }]
}
```

**Order matters**: anchor hook BEFORE evidence-marker (marker drains stdin — if it runs first, anchor hook gets empty stdin). Actually, evidence-marker does `cat > /dev/null` — both hooks get the same stdin independently (cc pipes to each hook separately). Verify during integration.

## Stateful Object Gate (F229 lesson)

**Mode file state machine**:
| State | Transition | Result |
|-------|-----------|--------|
| absent (initial) | `set_read_mode('anchor')` | file created, content="anchor" |
| anchor | `set_read_mode('full')` | file deleted |
| anchor | `set_read_mode('anchor')` | no-op (idempotent) |
| absent | `set_read_mode('full')` | no-op (already fail-open) |
| absent | Read tool fires | pass-through (fail-open) |
| anchor | Read tool fires (unbounded) | anchorize |
| anchor | Read tool fires (bounded) | pass-through (drill escape) |

**Invariant**: mode file content ∈ {"anchor"} ∪ absent. No other values. Hook treats any non-"anchor" content as absent.

## Risk / Open

1. **Glob shape unknown** — not spike-tested. Implementation will capture and handle, or defer Glob to follow-up if shape differs significantly.
2. **Hook stdin sharing** — verify cc pipes stdin independently to each PostToolUse hook (not serial consumption). If serial, re-order or merge with evidence-marker.
3. **Interactive session mode** — fallback path (`$CLAUDE_PROJECT_DIR/.f236-anchor-mode`) works but cat must have approved Bash or use a different signaling mechanism. Lower priority than Cat Café managed path.

[宪宪/claude-opus-4-6🐾]
