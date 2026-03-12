# F102 Phase A: 记忆组件 Adapter 化重构 — 实施计划

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** 把记忆组件从 Hindsight 硬编码改为可插拔 Adapter 接口，实现 SQLite 本地替代方案
**Acceptance Criteria:** AC-A1 ~ AC-A12（详见 feat doc）
**Architecture:** 新建 `packages/api/src/domains/memory/` 域，定义 6 接口，实现 SqliteEvidenceStore + IIndexBuilder + IMarkerQueue，保留 HindsightAdapter 做 legacy fallback，路由层全部 DI 注入
**Tech Stack:** better-sqlite3 (FTS5)、node:test、TypeScript
**前端验证:** No — 纯后端接口层重构，MCP tools 调 HTTP 路由不变

---

## Straight-Line Check

**终点 B**: 所有记忆相关路由通过 `IEvidenceStore` 接口工作，可在 SQLite 和 Hindsight 之间切换；retain 走 marker candidate queue 而非直写；SQLite 是编译产物，从 docs/*.md rebuild。

**不做的事**: Phase B（自动索引/SOP 集成）、Phase C（向量）、MCP tool 改造（它们调 HTTP 不变）、全局 `global_knowledge.sqlite`（Phase A 只做项目层）、`IMaterializationService` 完整实现（Phase A 只定义接口 + 骨架，完整的 .md patch 逻辑在 Phase B）。

---

## Task 1: 接口定义 + 类型系统

**Files:**
- Create: `packages/api/src/domains/memory/interfaces.ts`
- Test: `packages/api/test/memory/interfaces.test.js`

定义全部 6 接口 + 配套类型（`EvidenceItem`, `Marker`, `SearchOptions`, `MarkerStatus` 等）。这是所有后续 task 的基础。

**Step 1:** 写类型导出检查测试——import 所有接口和类型，断言它们存在且是正确的 shape。

**Step 2:** 跑测试确认失败（文件不存在）。

**Step 3:** 创建 `interfaces.ts`，定义 6 接口 + 所有类型。关键类型：
- `EvidenceItem`: anchor, kind, status, title, summary, keywords, sourcePath, sourceHash, supersededBy, updatedAt
- `Marker`: id, content, source, status, targetKind, createdAt
- `MarkerStatus`: 'captured' | 'normalized' | 'approved' | 'rejected' | 'needs_review' | 'materialized' | 'indexed'
- `SearchOptions`: kind, status, keywords, limit, scope
- `RebuildResult`, `ConsistencyReport`, `MaterializeResult`, `KnowledgeResult`

**Step 4:** 跑测试确认通过。

**Step 5:** Commit。

---

## Task 2: SQLite schema + SqliteEvidenceStore

**Files:**
- Create: `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- Create: `packages/api/src/domains/memory/schema.ts` — SQL DDL 常量 + migration
- Test: `packages/api/test/memory/sqlite-evidence-store.test.js`

依赖: better-sqlite3 (需先 `pnpm add`)

**Step 1:** `pnpm --filter @cat-cafe/api add better-sqlite3` + `pnpm --filter @cat-cafe/api add -D @types/better-sqlite3`

**Step 2:** 写测试——initialize 创建表、upsert 写入 evidence_docs、search 用 FTS5 返回结果、getByAnchor 精确查找、deleteByAnchor 删除、health 返回 true。用 `:memory:` 数据库。

**Step 3:** 跑测试确认失败。

**Step 4:** 实现 `schema.ts` — DDL 语句（evidence_docs, evidence_fts, edges, markers, schema_version）+ PRAGMA 设置（WAL, journal_size_limit, foreign_keys）。

**Step 5:** 实现 `SqliteEvidenceStore` — constructor 接收 db path、`initialize()` 跑 migration、`search()` 用 FTS5 MATCH + bm25 排序（superseded_by IS NULL 优先）、`upsert()` INSERT OR REPLACE + FTS sync trigger、`deleteByAnchor()`、`getByAnchor()`、`health()`。

**Step 6:** 跑测试确认通过。

**Step 7:** Commit。

---

## Task 3: edges 表查询（1-hop expand）

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts`
- Test: `packages/api/test/memory/sqlite-evidence-store.test.js`（追加用例）

**Step 1:** 写测试——upsert 两个 doc + 一条 edge → search 结果包含 1-hop 相关 doc；supersedes/invalidates 关系正确写入/查询。

**Step 2:** 跑测试确认失败。

**Step 3:** 在 SqliteEvidenceStore 加 `addEdge()`, `getRelated()` 方法，search 结果做 1-hop expand。

**Step 4:** 跑测试确认通过。

**Step 5:** Commit。

---

## Task 4: IIndexBuilder

**Files:**
- Create: `packages/api/src/domains/memory/IndexBuilder.ts`
- Test: `packages/api/test/memory/index-builder.test.js`

**Step 1:** 写测试——给定一个含 frontmatter 的 .md 文件目录，`rebuild()` 后 evidence_docs 中有对应记录；`checkConsistency()` 在 FTS 同步时返回 ok；`incrementalUpdate()` 只更新 changed files（用 source_hash 对比）。

**Step 2:** 跑测试确认失败。

**Step 3:** 实现 IndexBuilder：
- `rebuild()`: 扫描 docs/ 目录 → 解析 frontmatter → 计算 hash → upsert 到 store → 返回 stats
- `incrementalUpdate()`: 只处理 changedPaths 列表
- `checkConsistency()`: 比对 evidence_docs rowcount vs evidence_fts rowcount

**Step 4:** 跑测试确认通过。

**Step 5:** Commit。

---

## Task 5: IMarkerQueue（docs/markers/*.yaml 真相源）

**Files:**
- Create: `packages/api/src/domains/memory/MarkerQueue.ts`
- Test: `packages/api/test/memory/marker-queue.test.js`

**Step 1:** 写测试——`submit()` 写入 YAML 文件到 docs/markers/、`list()` 读取并按 filter 返回、`transition()` 更新状态。用临时目录做测试。

**Step 2:** 跑测试确认失败。

**Step 3:** 实现 MarkerQueue：
- YAML 文件格式：`{id}.yaml`，含 content/source/status/targetKind/createdAt
- `submit()` → 写文件 + 写 SQLite 缓存
- `list()` → 从 SQLite 缓存读（快），fallback 扫描 YAML 目录
- `transition()` → 更新 YAML 文件 + SQLite 缓存

**Step 4:** 跑测试确认通过。

**Step 5:** Commit。

---

## Task 6: HindsightAdapter（legacy IEvidenceStore）

**Files:**
- Create: `packages/api/src/domains/memory/HindsightAdapter.ts`
- Test: `packages/api/test/memory/hindsight-adapter.test.js`

把现有 `HindsightClient` 包装为 `IEvidenceStore` 接口。不改 HindsightClient 内部实现，只加 adapter 壳。

**Step 1:** 写测试——HindsightAdapter 实现 IEvidenceStore 接口，`search()` 代理到 `recall()`，`health()` 代理到 `isHealthy()`，`initialize()` 代理到 `ensureBank()`。

**Step 2:** 跑测试确认失败。

**Step 3:** 实现 HindsightAdapter：
- constructor 接收 `IHindsightClient` + bankId
- `search()` → 调 `recall()`，转换 `HindsightMemory[]` → `EvidenceItem[]`
- `upsert()` → 调 `retain()`，转换 `EvidenceItem[]` → `RetainItem[]`
- `health()` → `isHealthy()`
- `initialize()` → `ensureBank()`
- `getByAnchor()` / `deleteByAnchor()` → Hindsight 不支持，抛 UnsupportedError

**Step 4:** 跑测试确认通过。

**Step 5:** Commit。

---

## Task 7: ReflectionService 独立化

**Files:**
- Create: `packages/api/src/domains/memory/ReflectionService.ts`
- Test: `packages/api/test/memory/reflection-service.test.js`

**Step 1:** 写测试——ReflectionService 实现 IReflectionService，`reflect()` 接收 query 返回 string。mock LLM 调用。

**Step 2:** 跑测试确认失败。

**Step 3:** 从现有 `reflect.ts` 路由中提取反思逻辑到 `ReflectionService`。支持两种 backend：Hindsight reflect API（legacy） 和 本地 LLM reflect（新）。

**Step 4:** 跑测试确认通过。

**Step 5:** Commit。

---

## Task 8: Factory + 路由解耦

**Files:**
- Create: `packages/api/src/domains/memory/factory.ts`
- Create: `packages/api/src/domains/memory/index.ts` — barrel exports
- Modify: `packages/api/src/index.ts` — 用 factory 替换 `createHindsightClient()`
- Modify: `packages/api/src/routes/evidence.ts` — 注入 `IEvidenceStore`
- Modify: `packages/api/src/routes/reflect.ts` — 注入 `IReflectionService`
- Modify: `packages/api/src/routes/callback-memory-routes.ts` — 注入 `IEvidenceStore` + `IMarkerQueue`
- Modify: `packages/api/src/routes/callbacks.ts` — 传新接口
- Test: 现有路由测试应继续通过（mock 对象换接口）

**Step 1:** 实现 `factory.ts`——`createMemoryServices(config)` 根据 `EVIDENCE_STORE_TYPE=sqlite|hindsight` 返回 `{ evidenceStore, markerQueue, reflectionService, indexBuilder }`。

**Step 2:** 实现 `index.ts` barrel，导出所有接口 + 实现 + factory。

**Step 3:** 修改 `packages/api/src/index.ts`——替换 `createHindsightClient()` 为 `createMemoryServices()`，把接口传给路由。

**Step 4:** 修改路由文件——`evidence.ts` 的 Options 从 `hindsightClient: IHindsightClient` 改为 `evidenceStore: IEvidenceStore`；`reflect.ts` 改为 `reflectionService: IReflectionService`；`callback-memory-routes.ts` retain 改写 `markerQueue.submit()`。

**Step 5:** 跑全部现有测试，确认没 break。路由测试的 mock 从 IHindsightClient shape 换成 IEvidenceStore shape。

**Step 6:** Commit。

---

## Task 9: KnowledgeResolver 骨架

**Files:**
- Create: `packages/api/src/domains/memory/KnowledgeResolver.ts`
- Test: `packages/api/test/memory/knowledge-resolver.test.js`

Phase A 只做项目层 resolve（不含 global_knowledge.sqlite），联邦检索在 Phase B 补全。

**Step 1:** 写测试——`resolve()` 查询项目 `IEvidenceStore`，返回 `KnowledgeResult`（results + sources）。

**Step 2:** 跑测试确认失败。

**Step 3:** 实现 KnowledgeResolver：
- constructor 接收 `projectStore: IEvidenceStore`（Phase B 再加 globalStore）
- `resolve()` → 调 projectStore.search() → 包装为 KnowledgeResult
- 预留 RRF rank fusion 的接口（Phase B 启用）

**Step 4:** 跑测试确认通过。

**Step 5:** Commit。

---

## Task 10: IMaterializationService 骨架

**Files:**
- Create: `packages/api/src/domains/memory/MaterializationService.ts`
- Test: `packages/api/test/memory/materialization-service.test.js`

Phase A 只做骨架——接口定义已在 Task 1，这里实现 `canMaterialize()` 判断和基本的 `materialize()` 流程框架。完整的 .md patch 逻辑在 Phase B。

**Step 1:** 写测试——`canMaterialize()` 对 approved marker 返回 true、其他状态返回 false；`materialize()` 调用后 marker 状态变为 materialized。

**Step 2:** 跑测试确认失败。

**Step 3:** 实现 MaterializationService：
- `canMaterialize()` → 检查 marker 状态是否为 approved
- `materialize()` → 创建 .md 文件 → transition marker 到 materialized → 触发 indexBuilder.incrementalUpdate()

**Step 4:** 跑测试确认通过。

**Step 5:** Commit。

---

## Task 11: 集成验证 + 清理

**Files:**
- Modify: `packages/api/src/domains/cats/services/index.ts` — 保留 legacy exports 做 deprecation
- Run: 全量测试 `pnpm --filter @cat-cafe/api test:public`
- Run: `pnpm check` (Biome) + `pnpm lint` (TypeScript)

**Step 1:** 跑全量测试，修复任何失败。

**Step 2:** 跑 Biome + TypeScript 检查，修复 lint 问题。

**Step 3:** 检查文件行数限制（200 warn / 350 hard）。如果 SqliteEvidenceStore 超了，拆分。

**Step 4:** 最终 commit。

---

## 依赖关系

```
Task 1 (接口) ──┬── Task 2 (SQLite) ── Task 3 (edges)
                ├── Task 6 (Hindsight adapter)
                ├── Task 7 (ReflectionService)
                └── Task 10 (MaterializationService 骨架)
Task 2 ─── Task 4 (IndexBuilder)
Task 2 ─── Task 5 (MarkerQueue)
Task 2 ─── Task 9 (KnowledgeResolver)
Task 1~9 ── Task 8 (Factory + 路由解耦)
Task 1~10 ── Task 11 (集成验证)
```

可并行的组合：Task 2+6+7（都只依赖 Task 1）；Task 3+4+5（都只依赖 Task 2）。
但实际在 worktree 里顺序执行，TDD 节奏走。
