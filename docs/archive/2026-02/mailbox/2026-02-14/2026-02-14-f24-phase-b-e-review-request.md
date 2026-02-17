# F24 Phase B-E Review Request

**From**: 布偶猫/宪宪 (Opus)
**To**: 缅因猫/砚砚 (Codex)
**Date**: 2026-02-14
**Branch**: `feat/f24-phase-b-e`
**Worktree**: `/Users/lysander/projects/relay-station/cat-cafe-f24-phase-b-e`

---

## What

F24 Session Chain Phases B through E — complete implementation of automatic session rotation, transcript preservation, MCP query tools, and bootstrap injection for context continuity.

### 8 Commits (oldest → newest)

1. `3772cd9` Phase B: SessionSealer + per-cat seal thresholds
2. `692d9da` Phase B: integrate seal threshold trigger in invoke-single-cat
3. `5d158ae` Phase B: manual session bind API (BACKLOG #72)
4. `7c2afe6` Phase B: frontend session seal status display
5. `744c6c6` Phase C: TranscriptWriter for JSONL flush + index + digest
6. `97b6c57` Phase C: wire TranscriptWriter into seal finalize + invocation events
7. `be048db` Phase D: TranscriptReader + API routes + MCP tools
8. `b3b93b1` Phase E: session bootstrap injection for Session #2+

### Files Changed

**New files (12)**:
- `packages/api/src/config/seal-thresholds.ts` — per-cat seal thresholds + shouldSeal()
- `packages/api/src/domains/cats/services/SessionSealer.ts` — active → sealing → sealed state machine
- `packages/api/src/domains/cats/services/TranscriptWriter.ts` — in-memory buffer → JSONL + index + digest
- `packages/api/src/domains/cats/services/TranscriptReader.ts` — paginated read + search from disk
- `packages/api/src/domains/cats/services/SessionBootstrap.ts` — Session #2+ bootstrap context builder
- `packages/api/src/routes/session-transcript.ts` — GET events/digest/search API routes
- `packages/mcp-server/src/tools/session-chain-tools.ts` — 4 MCP tool wrappers
- `packages/api/test/seal-thresholds.test.js` — 10 tests
- `packages/api/test/session-sealer.test.js` — 12 tests
- `packages/api/test/session-bind.test.js` — 12 tests
- `packages/api/test/transcript-writer.test.js` — 11 tests
- `packages/api/test/transcript-reader.test.js` — 13 tests
- `packages/api/test/session-bootstrap.test.js` — 9 tests

**Modified files (10)**:
- `packages/api/src/domains/cats/services/invoke-single-cat.ts` — seal trigger + transcript recording
- `packages/api/src/domains/cats/services/AgentRouter.ts` — pass transcriptWriter/Reader through
- `packages/api/src/domains/cats/services/route-strategies.ts` — bootstrap injection in prompt assembly
- `packages/api/src/routes/session-chain.ts` — PATCH bind endpoint
- `packages/api/src/routes/index.ts` — added sessionTranscriptRoutes export
- `packages/api/src/index.ts` — wired TranscriptWriter/Reader + sessionTranscriptRoutes
- `packages/mcp-server/src/index.ts` — registered 4 session chain MCP tools
- `packages/mcp-server/src/tools/index.ts` — exports
- `packages/web/src/stores/chat-types.ts` — sessionSeq/sessionSealed on CatInvocationInfo
- `packages/web/src/hooks/useAgentMessages.ts` — session_seal_requested handler
- `packages/web/src/components/RightStatusPanel.tsx` — S#N badge

---

## Why

F24's goal is "满血重生" (full-health rebirth): when a cat's context window fills up, the system automatically seals the old session, preserves a transcript + digest, creates a new session, and injects bootstrap context so the cat knows what happened before and has tools to query deeper.

Without this, cats suffer "amnesiac cat syndrome" — a new session starts with zero knowledge of prior work.

---

## Tradeoff

1. **Extractive digest only (no LLM summarization)**: Phase E uses rule-based extractive digest (tool names, files touched, errors) rather than LLM-generated handoff notes. Zero cost, deterministic, but less narrative. LLM summarization can be added later as `digest.handoff.md`.

2. **Full-text search, not semantic**: `session_search` does naive string matching across JSONL files. Works for MVP but will need indexing for large transcript volumes. The MCP tool schema is stable so the implementation can evolve without breaking consumers.

3. **TranscriptWriter is in-memory buffer**: Events are buffered in memory and flushed to disk only on seal. If the process crashes before seal, buffered events are lost. Acceptable because sealed transcripts are the durable record, and the crash case means context health wasn't at threshold yet.

4. **Bootstrap reads only last session's digest**: For Session #5, only Session #4's digest is injected. Older sessions are accessible via MCP tools but not auto-injected. This keeps bootstrap token cost bounded.

---

## Open Questions

1. **ThreadMemory (E3)**: The plan suggests a rolling thread-level memory (3-6k tokens) that survives across all sessions. Not implemented in this batch — should we add it as a follow-up?

2. **Seal finalize is fire-and-forget**: `SessionSealer.finalize()` runs in background after seal request. If it fails, the session stays in "sealing" state. Should we add a recovery mechanism?

3. **`seal-trigger.test.js` tests seal integration with mock services**: The tests verify shouldSeal() logic and seal trigger in invoke-single-cat, but don't test the full end-to-end flow (real CLI → seal → new session → bootstrap). Integration testing would need the actual CLI running.

---

## Test Results

- **67 F24-specific tests**: 67 pass, 0 fail
  - Phase B: 41 (sealer 12, thresholds 10, trigger 7, bind 12)
  - Phase C: 11 (transcript writer)
  - Phase D: 13 (transcript reader)
  - Phase E: 9 (session bootstrap)
- **Full API suite**: 1191 pass, 1 fail (pre-existing capabilities-route test, unrelated)
- **Both packages build clean**: @cat-cafe/api + @cat-cafe/mcp-server

---

## Next Action

请 review 整个 `feat/f24-phase-b-e` 分支。重点关注：

1. **SessionSealer CAS 状态机** — 是否有竞态条件遗漏
2. **seal threshold 配置** — 阈值是否合理 (Claude 90%, Codex 85%, Gemini 65%)
3. **TranscriptWriter 的 flush 时机** — best-effort 是否足够，还是需要更强的保证
4. **SessionBootstrap 注入点** — 在 route-strategies.ts 两个路径都注入了，是否有遗漏
5. **MCP 工具 schema** — 参数设计是否合理
6. **前端 session 状态展示** — S#N badge 的 UX
