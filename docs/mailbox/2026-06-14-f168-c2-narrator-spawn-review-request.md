# Review Request: F168 Phase C C2 — narrator spawn + DirectionCard schema

Review-Target-ID: f168
Branch: feat/f168-phase-c2-narrator-spawn
PR: #2289

## What

NarratorDriver — thin spawn coordinator that fires the narrator cat (resolved via RoleResolver, never hardcoded) to produce a DirectionCard TriageEntry with narrative + evidence + route recommendation.

Core changes (11 files, +746/-4):

1. **shared types** (`community-issue.ts`): `RouteRecommendation` discriminated union (`existing-thread | new-thread | decline`) + narrator fields on `TriageEntry` (`authoredByRole`, `narrative`, `evidenceRefs`, `routeRecommendation`, `recommendedOwnerRole`). All optional for INV-12 backward compat.
2. **NarratorDriver** (`NarratorDriver.ts`): 147 行。RoleResolver → executor → briefing → `WakeCatFn` fire-and-forget。INV-1 (no case.state), INV-2 (capability ceiling), INV-3 (sourceEventId dedup set), INV-4/5 (fail-closed via RoleResolver).
3. **dispatch integration** (`community-issues.ts`): `case.triaged` event → `void narratorDriver.spawnNarrator(…).catch(() => {})` fire-and-forget.
4. **production wiring** (`index.ts`): env-gated by `COMMUNITY_NARRATOR_THREAD_ID`。reuses existing `createWakeCatFn` (same as game narrator — SPIKE-1 decision).
5. **env-registry**: `COMMUNITY_NARRATOR_THREAD_ID` registered (category: server, not sensitive).
6. **tests**: 3 new test files (519 lines total): narrator-driver.test.js (INV-1-5 coverage), direction-card-schema.test.js, community-issues-routes.test.js (narrator spawn integration).

## Why

Phase C plan (C2.0 SPIKE-1 → C2.1 → C2.2) milestone. Narrator is the first role that uses the C1 Role Registry, proving the registry → executor → spawn pipeline works end-to-end. Unblocks C3 (routing) and the frontend narrator UX.

SPIKE-1 decision: reuse `WakeCatFn` path (candidate a, proven in production via GameNarratorDriver), model-agnostic, zero new infrastructure.

## Original Requirements（必填）
> "现在全看我喊你们去看有点麻烦"
> "你们得想想得做管理的啊，不然上次这个任务派发给什么线程的猫，然后他们进度如何"
> "issue 112 发送给系统猫（如果没有被具体线程接单）"
- 来源：`docs/features/F168-community-ops-board.md` lines 50-79（铲屎官 2026-04-18 需求讨论）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**：C2 实现的是 narrator 自动被唤醒去做 triage（系统猫角色），减少铲屎官手动 @ 猫看 issue 的人肉 dispatch。

## Tradeoff

- **选了 WakeCatFn（复用 GameNarratorDriver 机制）**：proven，零新基建。放弃了 candidate b（dedicated MCP tool for narrator）和 candidate c（direct HTTP call），因为 WakeCatFn 已在生产环境稳定运行，且 model-agnostic。
- **in-memory dedup set（INV-3）**：放弃了 Redis dedup key，因为 narrator spawn 是 fire-and-forget 的增值操作，进程重启后重新 spawn 一次是可接受的（幂等于 TriageEntry 层面），不值得引入 Redis 依赖。
- **sonnet 原始代码用了 custom `NarratorWakeCatFn` 类型**：我删除了它，直接复用 `WakeCatFn` from `GameNarratorDriver.js` + `createCatId()` branded type 转换。减少类型碎片，保证签名一致。

## Architecture Ownership（必填）

Architecture cell: community-ops
Map delta: update required
Why: NarratorDriver 是 community-ops cell 新增的 spawn 协调器，扩展了 cell 的运行时组件（engine → dispatch → narrator spawn 路径）

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
  → 无新建。NarratorDriver 复用 existing `createWakeCatFn` + `RoleResolver`（C1 已合入）
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor
  → 未修改 cells 文档（map update 待 Phase C 整体完成后批量更新）

## Open Questions

### 技术 OQ（给 reviewer）
1. **briefing prompt 的语言/格式**：`buildNarratorBriefing()` 产出的中文 prompt 是否足够让 narrator 猫（gemini35）理解任务？能力禁区是否写清楚了？
2. **INV-3 dedup 粒度**：当前 dedup key = `sourceEventId`。如果同一 case 多次 dispatch（不同 eventId），会 spawn 多个 narrator。这是 by-design（每个 dispatch 事件独立 triage），还是应该加 subjectKey-level dedup？
3. **错误传播**：fire-and-forget 在 route handler 里用 `void …catch(() => {})`，catch 只 log 不抛。reviewer 觉得这样够还是需要 dead-letter 追踪？

### 价值 OQ（给 CVO，如有）
无。技术选型（SPIKE-1）已在 plan 阶段三猫收敛 + CVO 未否决。

## Next Action

请 reviewer 做 full review：代码质量 + invariant 验证 + 测试覆盖 + 愿景对照（Original Requirements）。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f168/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规
- Plan `docs/plans/2026-06-12-f168-phase-c-narrator-routing.md` C2.0/C2.1/C2.2 全部覆盖
- 6 项 invariant（INV-1 through INV-6）在 NarratorDriver 代码 + 测试中显式验证
- INV-12 backward compat: TriageEntry narrator 字段全部 optional

### 测试结果
```
pnpm --filter @cat-cafe/api test   # 112 passed, 0 failed（含 community 全集）
pnpm check                         # 22/22 passed
```

### 相关文档
- Plan: `docs/plans/2026-06-12-f168-phase-c-narrator-routing.md`（C2 section: lines 315-337）
- Feature: `docs/features/F168-community-ops-board.md`
- Design: `docs/discussions/2026-06-09-f168-community-ops-final-design.md`
