---
feature_ids: [F201]
related_features: [F061, F172, F174, F178, F183, F193, F194, F197]
topics: [antigravity, reliability, implementation-plan, side-effect-journal, smoke-test, rich-block]
doc_kind: plan
created: 2026-05-15
---

# F201 Antigravity Reliability Contract — Implementation Plan

**Feature:** F201 — `docs/features/F201-antigravity-reliability-contract.md`
**Goal:** 把 Antigravity 从“接入可用但事故靠人猜”提升为“失败可解释、side effect 可追踪、恢复策略安全、可用性有 smoke gate”的可靠运行面。
**Acceptance Criteria:** F201 AC-A..F。
**Architecture:** 单点 step-effect classifier + side-effect journal + recovery decision engine + explicit availability smoke + typed UI recovery card。
**Tech Stack:** TypeScript API provider layer、Fastify route metadata、React hook/UI、Vitest/node test、optional Antigravity LS opt-in smoke。

## Current Evidence

- F061 是 Antigravity 接入主线，当前 `done`；Phase 3 已交付 upstream error taxonomy、`shouldRetryTransient` retry pipeline、toolish-step safety gate、`textMode=replace` recovery。F201 不重做 F061 Phase 3，只把 retry decision 从 inline booleans refactor 到 side-effect-aware decision engine。
- F178 是 persistent MCP agent-key auth，当前 `in-progress`；Phase B/C 已落，Phase D UI/audit/orphan guard 未完。
- F172 image-only response 已修 `empty_response` 误报；F201 不把 image-only path 作为 close-gate smoke，避免重新承载 F172 scope。
- `AntigravityAgentService.ts` 当前 retry gate 在 `stream_error` grace 到期时，只有“没有 resolved/tool/native/toolish step”才 fresh retry。这是对 side effect 的安全保护，但缺少用户可见的 resumable state。
- 当前 `batchHasToolishStep` 只认 `RUN_COMMAND`、`WAITING`、toolCall/toolResult/metadata.toolCall，不显式覆盖 `CORTEX_STEP_TYPE_CODE_ACTION`。
- `antigravity-event-transformer.ts` 对未知 step 默认 `unknown_activity` silent log；对 side-effect-capable unknown step 缺少 hard budget。

## Migration Contract

F201 不新增第三套长期分类系统。迁移边界如下：

| Existing / New | 责任 | F201 后状态 |
|----------------|------|-------------|
| `classifyStep()` | UI bucket mapping：text/thinking/tool activity/error 是否显示给前端 | 保留，但遇到 effect-sensitive step 时调用 `classifyAntigravityStepEffect()` 取 effect metadata，不自己判断 retry safety |
| `batchHasToolishStep` inline boolean | 旧 retry gate 的粗粒度 side-effect guard | 删除/替换；retry gate 改读 `AntigravitySideEffectJournal.hasUnsafeSideEffect()` / `hasCompletedSideEffect()` |
| `executionJournal` inline metadata | 旧错误 metadata 里的临时 execution summary | Phase B 改为 `AntigravitySideEffectJournal` passthrough wrapper；Phase C 由 journal state 真正派生兼容字段 |
| `classifyAntigravityStepEffect()` | single source of truth for side-effect/retry safety | 新增；所有 retry/resume/smoke 判断只读这一套 effect semantics |
| `shouldRetryTransient` inline decision | F061 Phase 3 的 transient retry gate | 由 `decideAntigravityRecovery()` 接管；保留 `classifyUpstreamError()` / `humanErrorMessage()` helpers，不保留第二套 retry policy |

UI bucket 和 effect classification 可以不同，但必须有映射测试。例如 `GENERATE_IMAGE` 对 UI 是 `checkpoint`（由 brain scanner 发布 rich media），对 effect 是 `side_effect_done/pending`（生成了 artifact，retry 需要 publication idempotency）。

## Journal / Audit Boundary

| Layer | Owner feature | Storage / UI | F201 interaction |
|-------|---------------|--------------|------------------|
| Callback verify telemetry | F174 | callback registry + 24h telemetry / plug indicator | F201 reads failures as context only; no new callback audit writer. |
| Agent-key audit and inventory | F178 | agent-key registry/audit + Hub UI | F201 smoke may call agent-key writeback, but key lifecycle health stays in F178. |
| Side-effect journal | F201 | invocation memory + Antigravity JSONL audit + error/rich block metadata | Used for retry veto, resume payload, and typed recovery card. |

## Task 0: Feature Indexing

**Files**

- Modify: `docs/features/README.md`
- Modify: `docs/features/index.json`

**Work**

1. 将 F201 加入 active feature index。
2. F201 review 通过后再把 status 从 `draft` 改成 `in-progress`；Owner 已按当前提案设为缅因猫（砚砚），等待 CVO 显式 ack。

**Verification**

- `rg -n "F201" docs/features/README.md docs/features/index.json docs/features/F201-antigravity-reliability-contract.md`

## Task 1: Step-Effect Classifier

**Files**

- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-step-effects.ts`
- Test: `packages/api/src/domains/cats/services/agents/providers/antigravity/__tests__/antigravity-step-effects.test.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-event-transformer.ts`

**Work**

Introduce a single classifier:

```ts
type AntigravityEffectKind =
  | 'none'
  | 'text'
  | 'thinking'
  | 'tool_read'
  | 'side_effect_pending'
  | 'side_effect_done'
  | 'side_effect_failed'
  | 'upstream_error'
  | 'unknown_side_effect_capable';
```

Rules:

- `CORTEX_STEP_TYPE_CODE_ACTION` is at least `unknown_side_effect_capable`; if shape reveals file operation, classify more specifically.
- `CORTEX_STEP_TYPE_MCP_TOOL` defaults to side-effect-capable unless the tool is on an explicit read-only allowlist (`search_evidence`, `graph_resolve`, `list_recent`, `get_thread_context`, `list_threads`, and other reviewed read-only tools). Unknown MCP tools are unsafe by default.
- `CORTEX_STEP_TYPE_RUN_COMMAND` is side-effect-capable unless explicitly dry-run/read-only.
- `CORTEX_STEP_TYPE_GENERATE_IMAGE` is side-effect-capable artifact generation but retry-safe only with publication idempotency.
- Existing `toolCall/toolResult` shape fallback remains, but is centralized.

Mapping table:

| Step type | UI bucket target | Effect target | Note |
|-----------|------------------|---------------|------|
| `PLANNER_RESPONSE` with text | `terminal_output` | `text` | visible output |
| `PLANNER_RESPONSE` stream error | `tool_error` | `upstream_error` | recovery policy decides retry |
| `CODE_ACTION` | normally no direct text | `unknown_side_effect_capable` or specific file op | must block blind retry |
| `MCP_TOOL` read-only allowlist | `tool_pending` / result | `tool_read` | retry-safe only if no other side effects |
| `MCP_TOOL` unknown/write | `tool_pending` / result | `side_effect_pending/done/failed` | unsafe by default |
| `RUN_COMMAND` | `tool_pending` / result | `side_effect_*` | shell commands are unsafe unless proven dry-run |
| `GENERATE_IMAGE` | `checkpoint` | `side_effect_*` | UI handled by brain scanner; effect journal still records artifact |
| `CHECKPOINT` / `EPHEMERAL` / `USER_INPUT` | `checkpoint` | `none` | no retry impact |

**Tests**

- Red: CODE_ACTION after file write should block blind retry and appear in journal summary.
- Red: unknown step with side-effect-looking fields should fail warning budget.
- Red: GENERATE_IMAGE remains UI `checkpoint` but effect-classifies as side-effect-capable.
- Red: unknown MCP_TOOL is unsafe by default; allowlisted read-only MCP tool is `tool_read`.
- Green: CHECKPOINT/EPHEMERAL/USER_INPUT do not affect retry safety.
- Green: `classifyStep()` and `classifyAntigravityStepEffect()` mapping fixture has no contradictions.

**Verification**

- `pnpm --filter @cat-cafe/api vitest run packages/api/src/domains/cats/services/agents/providers/antigravity/__tests__/antigravity-step-effects.test.ts`

## Task 2: Side-Effect Journal

**Files**

- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravitySideEffectJournal.ts`
- Test: `packages/api/src/domains/cats/services/agents/providers/antigravity/__tests__/AntigravitySideEffectJournal.test.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`

**Work**

Journal entry v1:

```ts
interface AntigravitySideEffectJournalEntry {
  invocationId?: string;
  threadId: string;
  catId: string;
  cascadeId: string;
  stepIndex?: number;
  stepId?: string;
  stepType: string;
  effectKind: AntigravityEffectKind;
  operation: string;
  target?: string;
  status: 'pending' | 'done' | 'failed' | 'unknown';
  retrySafe: boolean;
  idempotencyKey: string;
  observedAt: number;
}
```

Storage v1:

- In-memory per invocation for decisioning.
- JSONL audit under existing Antigravity audit area for local diagnosis.
- Include journal summary in emitted error metadata.
- Replace the current inline `executionJournal` metadata source with an `AntigravitySideEffectJournal` passthrough wrapper in Phase B; Phase C derives compatibility metadata from journal state.

**Tests**

- appends entries in order;
- computes `hasSideEffect`, `hasCompletedSideEffect`, `retrySafeSummary`;
- computes stable idempotency keys for completed file/MCP/shell/artifact effects and dedups resume-time duplicates;
- redacts paths/secrets consistently with existing logger policy.

## Task 3: Recovery Decision Engine

**Files**

- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-recovery-policy.ts`
- Test: `packages/api/src/domains/cats/services/agents/providers/antigravity/__tests__/antigravity-recovery-policy.test.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`

**Work**

Replace repeated retry booleans with:

```ts
type AntigravityRecoveryDecision =
  | { action: 'retry_fresh_cascade'; reason: string; delayMs: number }
  | { action: 'surface_resumable_error'; reason: string; journalSummary: unknown }
  | { action: 'surface_terminal_error'; reason: string };
```

Rules:

- `stream_error` before side effects: retry once through fresh cascade.
- `stream_error` after pending/done side effects: no blind retry; surface resumable error.
- `empty_response` with no side effects and large/old cascade: fresh cascade retry once.
- `empty_response` with side effects: surface resumable error.
- upstream capacity/network error follows existing transient policy, but journal can veto retry.
- This task replaces inline `shouldRetryTransient` retry decisions; it may call F061 Phase 3 taxonomy helpers but must not leave a parallel retry policy behind.

**Verification**

- Existing stream-error tests remain green.
- New pre/post-side-effect tests cover both branches.

## Task 3.5: Resume Prompt Payload

**Files**

- Create: `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-resume-context.ts`
- Test: `packages/api/src/domains/cats/services/agents/providers/antigravity/__tests__/antigravity-resume-context.test.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`

**Work**

Build a machine-readable resume context from the journal summary:

```ts
interface AntigravityResumeContext {
  cascadeId: string;
  interruptedAt: number;
  completedEffects: AntigravitySideEffectJournalEntry[];
  pendingOrUnknownEffects: AntigravitySideEffectJournalEntry[];
  instruction: 'continue_without_repeating_completed_side_effects';
}
```

Rules:

- API constructs the resume payload; frontend only displays/copies it and may trigger a user-approved resume action later.
- The next Antigravity turn receives a concise system prefix or structured payload saying which effects are already complete and which are pending/unknown.
- If the user never resumes, journal entries age out according to normal invocation/audit retention; no background auto-resume.
- Resume prompt construction is tested with file-write and image-generation fixtures.

**Verification**

- Red: post-side-effect interruption yields resumable error but no resume context.
- Green: resumable error includes `resumeContext` with completed/pending split and no duplicated side effects.

## Task 4: Cascade Health Gate

**Files**

- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- Modify: `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- Test: `packages/api/src/domains/cats/services/agents/providers/antigravity/__tests__/antigravity-cascade-health.test.ts`

**Work**

- Add `getCascadeHealth(cascadeId)` or piggyback existing trajectory polling diagnostics.
- Track `stepCount`, approximate trajectory byte size, last planner output, and last side-effect timestamp.
- Initial threshold: `warn` at ≥ 1.5 MiB trajectory proxy or ≥ 150 steps; `retire` at ≥ 2.0 MiB or ≥ 200 steps. Values live behind config/env so F061/F201 empirical data can tune them.
- If health exceeds retire threshold before a new user turn and journal is clean, retire to fresh cascade.
- Emit a silent system_info / metadata marker so later diagnosis explains why session reset happened.

## Task 5: Availability Smoke Runner

**Files**

- Create: `scripts/antigravity-availability-smoke.mjs`
- Modify: `package.json`
- Test: `scripts/antigravity-availability-smoke.test.mjs` or equivalent node test

**Work**

Smoke modes:

- `--mode=readonly`: LS reachability, provider config, MCP tool visibility, agent-key file presence.
- `--mode=sentinel`: write/delete a sentinel file under a generated temp/sandbox directory.
- `--mode=thread`: agent-key `post_message` / `get_thread_context` call smoke in an explicit test thread; key expiry/revoke/rotation checks remain F178.

Report:

```json
{
  "ok": false,
  "stage": "sentinel-delete",
  "cascadeId": "...",
  "journal": [],
  "cleanup": { "ok": false, "leftovers": [] },
  "diagnostics": {}
}
```

Type:

```ts
interface AntigravityAvailabilitySmokeReport {
  ok: boolean;
  stage: string;
  cascadeId?: string;
  journal: AntigravitySideEffectJournalEntry[];
  cleanup: { ok: boolean; leftovers: string[] };
  diagnostics: Record<string, unknown>;
}
```

Constraints:

- Default command is read-only.
- Any write smoke requires explicit flag and sandbox path. Default sentinel root: `~/.cat-cafe/smoke/antigravity-sentinel-<ts>/`; never write under `docs/` for routine smoke.
- Cleanup failure exits non-zero.
- Sentinel mode creates a `.antigravity-smoke-lock` with pid + timestamp. Next run checks stale locks and leftovers before writing; stale cleanup failure exits non-zero.

## Task 6: UI Recovery Card

**Files**

- Modify: `packages/web/src/hooks/useAgentMessages.ts`
- Add/modify rich block rendering through the existing F183 bubble pipeline; v1 uses `kind: card`, future path can introduce `kind: antigravity_recovery`.
- Test: relevant `packages/web/src/hooks/__tests__/*` or component test.

**Work**

- Parse Antigravity error metadata.
- Emit/display the recovery card as a rich block attached to the canonical bubble, not as a separate React message tree.
- Render typed recovery card for `post_side_effect_interrupted`, `empty_response_with_side_effect`, and `large_cascade_retired`.
- Show:
  - completed actions;
  - incomplete/unknown actions;
  - leftover artifacts;
  - copyable diagnostic id/cascadeId;
  - suggested next command/message.

No visible instructional essay in app chrome; card text stays action-oriented.

## Task 7: Close Gate

**Commands**

- `pnpm --filter @cat-cafe/api vitest run packages/api/src/domains/cats/services/agents/providers/antigravity`
- `pnpm --filter @cat-cafe/web test -- --runInBand` or repo-current equivalent for touched web tests
- `pnpm antigravity:smoke --mode=readonly`
- explicit sentinel smoke only with runtime owner approval

**Close Evidence**

- Unit + integration tests.
- Smoke report artifact.
- One alpha manual pass.
- F178 dependency state called out.
- Cross-cat review from Opus 4.6 and Opus 4.7.

## Non-Goals

- No blanket permission bypass.
- No side-effect blind retry.
- No “red error swallowed as success”.
- No new Redis schema in first PR unless review says metadata/JSONL cannot support UI needs.
- No F178 agent-key lifecycle health clone.
- No F172 image-only close-gate clone.
