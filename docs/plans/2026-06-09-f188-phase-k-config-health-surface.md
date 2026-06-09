---
feature_id: F188
phase: K
created: 2026-06-09
author: opus-47
---

# F188 Phase K Implementation Plan — Memory Center Config Health Surface

**Spec**: `docs/features/F188-library-stewardship.md` (Phase K section, AC-K1..K7, KD-14/15/16)
**Source issue**: clowder-ai #880 (`funkdog`, "发现记忆中心因为配置原因没有实际在工作")
**Design Gate**: 砚砚 R2 APPROVE (`a31c27cc7..29b6936b7..45563620e`)

## Goal

`/api/evidence/status` 加 `functionalStatus: 'ok' | 'degraded'` + `configWarnings[]`（5 类 detector），前端 Memory Center `IndexStatus` 顶部黄色 degraded banner 显示 warnings + suggestedAction，不动 `healthy` 字段语义。

## Architecture cell + Map delta

- **cell**: memory（扩 `/api/evidence/status` + `IndexStatus`，不开新 cell）
- **delta**: none
- **Why**: evaluator 在现有 endpoint handler 内同步评估（KD-16），frontend 在现有 IndexStatus 加 banner，不破坏既有 health badge / status panel 布局

## Tech Stack

- Backend: TypeScript + zod schema (warning type validation) + fastify route extension
- Frontend: React + 现有 IndexStatus 组件 + Tailwind amber tokens
- Test: node --test (backend) + vitest (frontend)

## Tasks

### Task 1: EvidenceStatusSignals + ConfigWarning types + 5 detector 函数（AC-K2 backend）

**File**: `packages/api/src/domains/memory/evidence-status-signals.ts`（新建）

**Exports**:
- Type `EvidenceStatusSignals`（四类输入聚合）：
  - `dbCounts: { docs_count, edges_count, vectors_count, passage_vectors_count, threads_count, passages_count }`（evidence.sqlite）
  - `embeddingMeta: { embedding_model: string | null }`（evidence_meta）
  - `embeddingService: { passage_vectors_supported: boolean }`（service runtime state）
  - `catalogSnapshot: { collections: Array<{ id, root, kind, status }> }`（LibraryCatalog.list()；**含 `status`** — `CollectionStatus` enum 只有 6 个值：`registered`/`indexing`/`active`/`stale`/`blocked`/`archived`；detector 只跳过 `archived`，其余 5 个全参与；P2-1 from 砚砚 R3，R4 收窄修正：之前误用 `routable`——那是 LibraryCatalog 内部派生概念，不是 manifest status 字段值）
- Type `ConfigWarning`: `{ code, message, suggestedAction }`（v1 无 severity per KD-AC-K2）
- Type `WarningCode` union (5 个)
- 5 个纯 detector 函数：
  - `detectDocsRootSuspicious(signals)`: **filter `(m.status ?? 'active') !== 'archived'`**（archived 跳过；registered/indexing/active/stale/blocked 全参与；R4 修正：`routable` 是 LibraryCatalog 派生概念非 manifest 字段值）→ 检查剩余 collection.root 是否存在/为目录/非空（`fs.existsSync` + `fs.statSync` + `fs.readdirSync`）；**测试覆盖 4 条 path**：active+missing→报警 / stale+missing→报警 / archived+missing→不报警 / status 字段缺失（默认 active）+missing→报警
  - `detectEmbeddingDisabled(signals)`: `embedding_model === null`
  - `detectVectorsEmpty(signals)`: `vectors_count === 0 && docs_count > 0`
  - `detectGraphEmpty(signals)`: `edges_count === 0 && docs_count > 0`
  - `detectVecTableMissing(signals)`: `passage_vectors_supported === false`
- `evaluateConfigWarnings(signals): ConfigWarning[]`（聚合 5 个 detector，返回非空 warnings）
- `computeFunctionalStatus(warnings): 'ok' | 'degraded'`（length-based）

**TDD**:
- `packages/api/test/memory/evidence-status-signals.test.js`（新建）
- 5 个 detector 各 2 个测试（true case + false case）
- 1 个 evaluator test（多 warning 聚合）
- 1 个 functionalStatus test（length-based）
- 总 ~12 test

### Task 2: 接入 /api/evidence/status response（AC-K1 + AC-K3 backend）

**File**: `packages/api/src/routes/evidence.ts:319-398`（修改）

**Changes**:
- **EvidenceRoutesOptions 扩展**（P1 from 砚砚 R3，真实接口已 verify）: 加 `catalog?: Pick<LibraryCatalog, 'list' | 'getRoutable'>`（**不是** `libraryCatalog?.getCollections()`——后者不存在）
- **index.ts 注册侧传 catalog**（line ~2599 `app.register(evidenceRoutes, ...)`）: 加 `catalog: memoryServices.catalog`
- 在 line 389 return 处加 `functionalStatus` + `configWarnings`
- 在 handler 内 build `EvidenceStatusSignals`（复用既有 db reads + catalog read via `opts.catalog?.list()`——真实方法名 per LibraryCatalog.ts:39）
- 调 `evaluateConfigWarnings()` + `computeFunctionalStatus()`
- 如果 `opts.catalog` 不可用（worktree no-catalog 场景），`catalogSnapshot.collections = []`，`docs_root_suspicious` skip（不抛错）
- **`healthy: false` 路径（no_db）也返回扩展 schema**（P2-2 from 砚砚 R3，避免 type 不一致）: `functionalStatus: 'degraded'` + `configWarnings: []`；前端红色 fatal banner 继续优先（healthy=false 时不显示 degraded yellow banner），snapshot test 只锁 `healthy` 字段语义不变

**TDD**:
- `packages/api/test/routes/evidence-status-config-warnings.test.js`（新建）
- 测试 healthy + no warnings → functionalStatus='ok' + configWarnings=[]
- 测试 healthy + 多 warnings → functionalStatus='degraded' + configWarnings.length >= N

### Task 3: External healthcheck backward compat snapshot（AC-K6）

**File**: `packages/api/test/routes/evidence-status-healthy-snapshot.test.js`（新建）

**Lock**:
- `healthy=true` 路径前后字段相同（用 snapshot 锁住 `healthy` 字段位置 + 类型 + 值）
- `healthy=false` 路径前后字段相同
- 新增 `functionalStatus` 和 `configWarnings` 不影响 `healthy` 字段
- snapshot 对比 Phase K 前 baseline 状态

### Task 4: Frontend IndexStatus degraded banner（AC-K4）

**File**: `packages/web/src/components/memory/IndexStatus.tsx`（修改 ~40-60 行）

**Changes**:
- Type 扩展: `IndexStatus` 接口加 `functionalStatus`、`configWarnings`
- 顶部 banner（在 health badge 之上）：当 `functionalStatus === 'degraded'` 时显示
- Banner colour: Tailwind `amber` tokens (yellow/orange)
- Banner content:
  - 标题: `"Memory capabilities degraded"` + 副标题 `"API running but configuration issues detected"`
  - 每条 warning 一行: `<message>` + clickable `<suggestedAction>` (button or external link)
- `healthy: false` 红色 fatal banner 保留（向后兼容）
- **不动**: F163/F188 `HealthReport` debt panel（Phase J system debt 不混入 Phase K config health）

**TDD**:
- `packages/web/src/components/memory/__tests__/IndexStatus.test.tsx`（新建 or 扩展）
- 3 vitest tests:
  - `functionalStatus='ok'` → 无 banner
  - `functionalStatus='degraded'` + 1 warning → banner 显示 1 row
  - `functionalStatus='degraded'` + 3 warnings → banner 显示 3 rows + suggestedAction clickable

### Task 5: #880 reporter fixture regression（AC-K5）

**File**: `packages/api/test/routes/evidence-status-config-warnings.test.js`（Task 2 的 file，加测试）

**Fixture**:
```ts
const reporter880State = {
  healthy: true,
  docs_count: 10,        // docs 已 ingest
  edges_count: 0,
  vectors_count: 0,
  passage_vectors_count: 0,
  embedding_model: null,
  passage_vectors_supported: false,
  // catalog 假设 1 个 collection，root 存在（不 trigger docs_root_suspicious）
};
```

**Assertions**:
- `functionalStatus === 'degraded'`
- `configWarnings.length >= 3`
- 包含 `vectors_empty` + `graph_empty` + `embedding_disabled` codes
- 可能加 `vec_table_missing`（passage_vectors_supported=false）

### Task 6: Dogfood report（AC-K7，**PR merge 前** in feature/alpha 环境）

**File**: `docs/harness-feedback/2026-06-09-f188-phase-k-dogfood-report.md`（新建，**同 PR commit**，per P2-3 from 砚砚 R3——dogfood 是本 PR 合入 gate，不能 post-merge）

**Content**:
- 在 feature worktree 启 alpha 环境（`pnpm alpha:start` 含 3011/3012/4111/6398 隔离 Redis）跑 `curl http://localhost:3011/api/evidence/status`
- 文档化 functionalStatus 实际值 + warnings 数 + 每条 suggestedAction text
- Screenshot Memory Center `IndexStatus` 实际效果（degraded banner if any，or "no warnings, all green" 也合法）
- **至少一个 warning 状态被验证**: 人为造 stale state（如临时改 collection root 到不存在路径 → trigger `docs_root_suspicious`；或 mock embedding_model=null → trigger `embedding_disabled`），跑 endpoint + 截图 + 还原状态
- Report 提交时机: PR open 之后、merge 之前，同 PR commit chain 内

## Quality Gate Checklist

- [ ] 5 个 detector unit tests pass（Task 1）
- [ ] evaluator + functionalStatus tests pass（Task 1）
- [ ] /api/evidence/status integration tests pass（Task 2）
- [ ] External healthcheck snapshot test pass（Task 3 / AC-K6）
- [ ] Frontend banner vitest tests pass（Task 4）
- [ ] #880 fixture regression test pass（Task 5 / AC-K5）
- [ ] `pnpm gate` 全绿
- [ ] Biome / lint clean on new files
- [ ] Dogfood report committed in PR（Task 6 / AC-K7，**PR merge 前** in feature/alpha 环境完成，per 砚砚 R3 P2-3）

## PR Packaging

**单 PR** — 不拆分。Backend evaluator + endpoint extension + frontend banner + tests + dogfood 在一个 PR 内同时 review。
- 预估体量: 400-600 lines (backend ~150 + frontend ~100 + tests ~250 + plan + dogfood report)
- TDD commit 链: Task 1 (red→green) → Task 2 → Task 3 → Task 4 → Task 5 → closeout (Task 6 spec sync + dogfood)

## Cross-Cat Review Path

- **Author**: 布偶猫 / @opus47（this thread, F188 Phase K owner）
- **Reviewer**: 缅因猫 / @codex（this thread, R2 已 APPROVE spec）
- **Cloud review**: PR open 后触发 (packages/ 代码改动, 不豁免)
- **Vision guard**: F188 已 close 3 次，Phase K reopen 第 4 次。close 时找 F192/F200/F186 域猫做 vision guard（不让本 thread 47 同时是 author + guardian）

## Forward / KD compliance

- **KD-14**: `healthy` 字段语义不动 — Task 3 snapshot test 锁住
- **KD-15**: warnings 是 user-actionable hints — 每条必带 `suggestedAction`（已写进 Task 1 schema）
- **KD-16**: evaluator 同步评估，不引入新 background job — Task 2 在现有 endpoint handler 内
- **Non-goals (v1)**:
  - 不加 `info` / `error` severity（v1 KISS，未来 v2 扩展）
  - 不混入 HealthReport debt panel
  - 不做 startup warning / onboarding guide（spec Tradeoff 已 ruled out）
  - 不加 OQ-K1 类未决问题（spec Phase K Open Questions 空，全 AC met）

[宪宪/Opus-47🐾]
