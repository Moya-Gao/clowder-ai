# Review Request: F093 Phase A — Cats & U 世界引擎 Runtime

Review-Target-ID: f093
Branch: feat/f093-world-engine

## What

F093 Phase A 全部 10 个 task，实现"一个活着的房间"——世界引擎的完整 runtime 层：

| Task | 交付物 | 关键文件 |
|------|--------|----------|
| A1 | shared world contracts (Zod schemas + TS types) | `packages/shared/src/world/` |
| A2 | SqliteWorldStore + world.sqlite runtime tables | `packages/api/src/domains/world/SqliteWorldStore.ts` |
| A3 | WorldRuntimeCoordinator + 8 typed action handlers | `packages/api/src/domains/world/WorldRuntimeCoordinator.ts`, `action-handlers.ts` |
| A4 | WorldKnowledgeAdapter + schema V16 world scope | `packages/api/src/domains/world/WorldKnowledgeAdapter.ts`, `packages/api/src/domains/memory/schema.ts` |
| A5 | WorldContextProvider + SystemPromptBuilder injection | `packages/api/src/domains/world/WorldContextProvider.ts`, `SystemPromptBuilder.ts` |
| A6 | WorldDriverBridge — pack driver ↔ world runtime | `packages/api/src/domains/world/WorldDriverBridge.ts` |
| A7 | CareLoopEvaluator — 温柔 check-in 触发引擎 | `packages/api/src/domains/world/CareLoopEvaluator.ts` |
| A8 | WorldPanel — build/perform/replay 三模式 UI | `packages/web/src/components/workspace/WorldPanel.tsx` |
| A9 | World API routes — CRUD + action dispatch + replay | `packages/api/src/routes/world.ts` |
| A10 | End-to-end acceptance test — 全生命周期验证 | `packages/api/test/world/world-e2e-acceptance.test.js` |

13 commits (11 feat + 1 docs design gate + 1 style fix)。

## Why

> "我们的初心从来不是做一个 coding 协作 agent 平台呀——是 cats & u。"
> — 铲屎官，2026-03-10

Phase A 把三个核心协议（WorldContextEnvelope / WorldActionEnvelope / CanonPromotionRecord）从 spec 落地为可运行的 runtime。交付后 F129 Scenario Pack 的 `world-driver.yaml` 有了真正的执行后端。

## Original Requirements（必填）

> "Cat Café 不只是开发协作平台，是'有温度的共创空间'——陪伴是共创的副产品，AI 是人际关系的放大器而非替代品。"
> "RP 台词不自动入典——需要显式 propose_canon 动作 + 确认"
> "F093 的 runtime state 可以有自己的权威 SQLite 表，但 evidence index 仍然只是检索编译产物，不是正典真相源"
> — `docs/features/F093-cats-and-u-world-engine.md`

- 来源：`docs/features/F093-cats-and-u-world-engine.md` (AC-A1 ~ AC-A11)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

1. **world.sqlite 独立于 evidence.sqlite** — 权威 runtime state 独立存储，evidence 只做派生检索层。代价是两个 DB 需要各自维护 schema 版本，但确保了"正典真相源"的清晰边界
2. **CareLoopEvaluator 用关键词触发而非语义分析** — Phase A 选择简单可控的关键词匹配（CN+EN），语义分析留给 Phase A+。代价是覆盖率有限，但避免了误触发
3. **WorldPanel 前端为静态骨架** — 只做了 fetch + 展示，没接 WebSocket 实时推送。Phase A 优先保证 runtime 层完整性
4. **Schema V16 给 evidence_docs 加 world_id/scene_id** — 需要在 5 个搜索路径都加过滤（anchor/FTS5/CONTAINS/semantic/hybrid），实际修了 3 个遗漏路径

## Open Questions

1. **action-handlers.ts 的 propose_canon 默认 sourceEventId** — 自发提案时 `action.sourceEventId` 为 undefined，我用 `event.eventId`（刚生成的事件 ID）兜底。这个语义是否合理？
2. **CareLoopEvaluator 的触发关键词表** — 当前是硬编码的 CN+EN 词表，reviewer 觉得是否需要外置配置？
3. **WorldContextProvider.assemble() 的 recall 查询** — 当前只在显式传 `query` 时才搜 evidence，是否应该默认用 scene name 做一次 recall？

## 如果我判断错了，最可能错在哪

1. **evidence schema V16 的 5 路过滤可能还有遗漏** — 我修了 CONTAINS/semantic/hybrid 三路，但如果有第 6 条搜索路径（比如后续新增的），会静默返回跨世界结果
2. **WorldDriverBridge 对 F129 pack config 的假设** — 我假设 `driverConfig.actions` 是 string[]，如果 F129 实际 pack format 用了嵌套结构，bridge 的校验会失效
3. **SystemPromptBuilder 的世界上下文注入位置** — 放在 alwaysOnDocs 之前，如果上下文窗口紧张，world context 可能挤掉后面的内容

## Next Action

请 reviewer：
1. 重点审 Task 3（WorldRuntimeCoordinator）和 Task 4（WorldKnowledgeAdapter + schema V16）——这两块是 runtime 核心 + 跨域耦合点
2. 跑 E2E acceptance test 验证全链路
3. 对照 AC-A1 ~ AC-A10 逐条确认

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f093/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规

AC-A1 ~ AC-A10 逐条覆盖（AC-A3 Role Mask 在 Character 5 槽的 maskOverlay 可选字段预留，AC-A11 F129 解锁由 WorldDriverBridge 实现）。

### 测试结果

```
# World tests (73 passed, 0 failed)
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js \
  --test test/world/*.test.js test/memory/world-scope-filter.test.js

ℹ tests 73
ℹ suites 36
ℹ pass 73
ℹ fail 0
ℹ duration_ms 293.323125

# Biome
pnpm biome check . --diagnostic-level=error
Checked 2707 files in 865ms. No fixes applied.

# Build (packages/api)
tsc → exit 2 (pre-existing TS7016 better-sqlite3 — 25+ files, no new errors)

# Root artifacts gate
git status --short | rg '^.. [^/]+\.(png|...)$'  → (empty)
git diff --name-only origin/main...HEAD | rg ...  → (empty)
```

### 相关文档

- Feature: `docs/features/F093-cats-and-u-world-engine.md`
- Plan: `docs/plans/2026-04-30-f093-phase-a-world-engine.md`
- Design Gate: commit `1283077db` + `9d38c829e`
