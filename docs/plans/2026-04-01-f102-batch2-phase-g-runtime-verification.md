# F102 Batch 2: Phase G 运行时验收闭环

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** 验证 Phase G (Abstractive Summary + Durable Memory Lifecycle) 全链路在运行时正确工作：thread 摘要 → candidate extraction → approve → materialize
**Acceptance Criteria:**
- AC-B2-1: e2e 集成测试覆盖 processThread 全流程（mock Opus API → segment insertion → candidate → marker → feed）
- AC-B2-2: 缺失 feature flags（F102_DURABLE_CANDIDATES, F102_TOPIC_SEGMENTS）注册到 env-registry
- AC-B2-3: carry-over backlog 测试（>200 消息分批处理）
- AC-B2-4: 失败路径测试（API 超时、marker 提交失败、re-embed 失败）
- AC-B2-5: AbstractiveSummaryClient 解析测试覆盖边界 case
**Architecture:** Phase G foundation 已合入(PR #604)。本批次不写新业务逻辑，而是：(1) 补全测试覆盖确保运行时可信赖 (2) 注册遗漏的 env flags (3) 验证全链路端到端工作
**Tech Stack:** node:test, better-sqlite3 in-memory, mock deps
**前端验证:** No — 纯后端测试

---

## Task 1: Register missing feature flags in env-registry

**Files:**
- Modify: `packages/api/src/config/env-registry.ts` (after line 1085)
- Modify: `docs/env-reference.md` (F102 section)
- Test: `pnpm check` (env-registry consistency check)

**Step 1:** Add `F102_DURABLE_CANDIDATES` and `F102_TOPIC_SEGMENTS` entries to env-registry after the existing `F102_ABSTRACTIVE` entry.

```typescript
{
  name: 'F102_DURABLE_CANDIDATES',
  defaultValue: 'off',
  description: 'Phase G candidate 提取 (off/on)，on = 摘要时提取 durable knowledge 候选',
  phase: 'stable',
  exampleRecommended: false,
},
{
  name: 'F102_TOPIC_SEGMENTS',
  defaultValue: 'off',
  description: 'Phase G topic 分段 (off/on)，on = 摘要按话题切分多个 segment',
  phase: 'stable',
  exampleRecommended: false,
},
```

**Step 2:** Update `docs/env-reference.md` F102 section with the two new flags.

**Step 3:** Run `pnpm check` to validate env-registry consistency. Expected: PASS.

**Step 4:** Commit: `feat(F102): register F102_DURABLE_CANDIDATES + F102_TOPIC_SEGMENTS env flags`

---

## Task 2: e2e processThread integration test (mock Opus → segment → candidate → marker)

**Files:**
- Create: `packages/api/test/memory/summary-compaction-e2e.test.js`
- Test: `node --test test/memory/summary-compaction-e2e.test.js`

This is the core test of Batch 2. Mock all external deps, exercise the real SQLite transaction path.

**Step 1:** Write failing test — `processThread e2e: mock Opus → inserts segment → submits candidate → updates watermark`

Setup:
- In-memory SQLite with schema migrations
- Seed `evidence_docs` with a thread row
- Seed `summary_state` with eligible state (25 messages, 2000 tokens, quiet > 10min, no cooldown)
- Mock `generateAbstractive` returning a segment with 1 `[decision!]` candidate
- Mock `submitCandidate` capturing calls
- Mock `getThreadLastActivity` returning 20min idle
- Mock `getMessagesAfterWatermark` returning 25 messages

Assertions:
- `summary_segments` table has 1 row for the thread
- `evidence_docs.summary` updated to the new abstractive text
- `summary_state.last_summarized_message_id` advanced to last message
- `summary_state.summary_type` = `'abstractive'`
- `submitCandidate` called once with the decision candidate
- Returns `true`

**Step 2:** Run test → RED (function not yet imported, or passes immediately since code exists — if it passes, verify assertions are real).

**Step 3:** If RED from import/setup issues, fix setup. The implementation already exists — this is a validation test, not a new feature.

**Step 4:** Run test → GREEN.

**Step 5:** Commit: `test(F102): e2e processThread integration — mock Opus → segment → candidate → watermark`

---

## Task 3: carry-over backlog test (>200 messages)

**Files:**
- Modify: `packages/api/test/memory/summary-compaction-e2e.test.js` (add test)

**Step 1:** Write failing test — `processThread sets carry_over=1 when messages remain after batch`

Setup:
- Seed `summary_state` with 250 pending messages
- `getMessagesAfterWatermark` first call returns 200 msgs, second call (post-watermark check) returns 50 remaining
- Mock `generateAbstractive` succeeds

Assertions:
- After processThread, `summary_state.carry_over` = 1
- `summary_state.pending_message_count` = 50 (re-populated)

**Step 2:** Run → verify RED then GREEN.

**Step 3:** Commit: `test(F102): carry-over backlog — 250 msgs splits into 200+50 with carry_over=1`

---

## Task 4: failure path tests (API fail, candidate fail, re-embed fail)

**Files:**
- Modify: `packages/api/test/memory/summary-compaction-e2e.test.js` (add 3 tests)

**Test 4a:** `processThread returns false when Opus API returns null (fail-open)`
- Mock `generateAbstractive` returning `null`
- Assert: returns `false`, no segments inserted, watermark unchanged

**Test 4b:** `processThread continues when submitCandidate throws (fail-open)`
- Mock `submitCandidate` throwing Error
- Assert: returns `true`, segments still inserted, watermark still advanced

**Test 4c:** `processThread continues when reEmbed throws (fail-open)`
- Mock `reEmbed` throwing Error
- Assert: returns `true`, segments inserted, watermark advanced

**Step:** Write all 3, run → RED → (already implemented fail-open) → GREEN.

**Commit:** `test(F102): failure path coverage — API null, candidate throw, re-embed throw`

---

## Task 5: AbstractiveSummaryClient parser edge cases

**Files:**
- Create: `packages/api/test/memory/abstractive-client-parser.test.js`

Test `parseNaturalLanguageOutput` (exported via `isImplementationNoise`) and verify candidate extraction:

**Test 5a:** Parse output with title + summary + 1 `[decision!]` + 1 `[lesson]` → 2 candidates

**Test 5b:** Parse output with no `##` title (fallback to first line) → still produces segment

**Test 5c:** Parse output with >2 candidates → capped to `MAX_CANDIDATES_PER_SEGMENT` (2)

**Test 5d:** Parse output with implementation noise candidates → filtered out by `isImplementationNoise`

**Test 5e:** Empty/whitespace input → returns null

Note: `isImplementationNoise` already has 125 tests in `candidate-quality-gate.test.js`. These tests focus on the parser integration, not the noise detector itself.

**Commit:** `test(F102): AbstractiveSummaryClient parser edge cases — title fallback, cap, noise filter`

---

## Task 6: Full pipeline verification test (gate → execute → feed query)

**Files:**
- Modify: `packages/api/test/memory/summary-compaction-e2e.test.js` (add test)

**Step 1:** Write test — `full pipeline: gate finds eligible thread → execute processes → candidate appears in MarkerQueue`

Setup:
- Create `SummaryCompactionTaskSpec` with full deps
- Seed `evidence_docs` + `summary_state` for an eligible thread
- Call `spec.admission.gate()` → expect `run: true` with workItems
- Call `spec.run.execute(workItem.signal, workItem.subjectKey, ctx)`
- Verify segment inserted + marker submitted

This tests the TaskSpec→processThread integration, not just processThread alone.

**Commit:** `test(F102): full pipeline — gate → execute → segment + candidate`

---

## Task 7: Biome + build + full test suite

**Step 1:** `pnpm check:fix` → `pnpm --filter @cat-cafe/api build` → `pnpm --filter @cat-cafe/api exec node --test 'test/memory/*.test.js'`

**Step 2:** Commit any formatting fixes.

**Finish line:** All new tests green, no regressions, env flags registered.
