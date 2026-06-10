---
title: "Review Request: F168 Phase A — Community Ops Event Engine"
feature: F168
kind: review-request
date: 2026-06-10
---

# Review Request: F168 Phase A — Community Ops Event Engine

Review-Target-ID: f168
Branch: feat/f168-event-engine
PR: https://github.com/zts212653/cat-cafe/pull/2203

## What

实现 F168 Phase A 完整 10 个 Task（TDD）：

- shared 事件 schema + 状态机类型
- Redis append-only Event Log（幂等去重）
- 纯函数状态机（closure invariant：`fixed→closed` 必经 `reported` 或 `waived`）
- CommunityObjectStore + Projector（可重建投影）
- Bootstrap 迁移 CLI（现有 CommunityIssueStore → 投影）
- 3 个入口接线：webhook / RepoScan / 手动 dispatch
- PR lifecycle 接线（`pr.merged`/`pr.closed` → 投影 + linked issue cascade）
- 看板 API 读投影（向后兼容，前端零改动）

## Why

社区事件引擎 Phase A 目标：board 与 gating thread 状态从同一真相源（Event Log）派生，案件状态自动跟踪 GitHub 真实事件，不依赖猫口头声明。终态設計经砚砚 review 放行（5972a7a16）。

## Original Requirements（必填）

> 来源：`docs/discussions/2026-06-09-f168-community-ops-final-design.md` + `docs/plans/f168-phase-a-event-engine.md`（@fable5 出品，砚砚 sign-off）

Phase A 6 条 AC（从終態設計 §7 提取）：
1. 现有 3 类入口事件全部 append 进 Event Log，`sourceEventId` 幂等去重
2. CommunityObject 投影由事件流推导，删掉物化数据后可全量重建且 diff 为空
3. 状态机拒绝 `fixed → closed` 直接转换；必经 `reported` 或 `waived(reason, actor, evidence)`
4. PR merged / issue closed 事实事件自动驱动投影状态转换（不依赖猫口头声明）
5. 看板聚合 API 读 CommunityObject 投影（响应 shape 向后兼容，前端零改动）
6. 现存 CommunityIssueStore 数据通过 bootstrap 事件迁入投影（dry-run diff 可验证）

**请对照上面的摘录判断交付物是否解决了铲屎官的问题。**

## Tradeoff

- **Event log storage**: Redis LIST（per-subject）+ SET（全局 dedup）— 与现有 store 风格一致，够用且可理解。Stream 能给 Phase B 消费组留余地，但增加复杂度，Phase A 不需要；注释里已标注 Phase B 改造点。
- **Cascade 幂等**: cascade 只在 `appended=true`（新鲜事件）时触发，`rebuildAll()` 不会 double-cascade。Issue 投影从自己的 event log 重建。
- **Best-effort try/catch**: 3 个入口的 event log 失败不 throw，spec 明文要求，fallback check 触发 warning，见 OQ#3。

## Architecture Ownership（必填）

Architecture cell: community-ops（新建）
Map delta: new cell required
Why: 社区事件引擎是新领域（事件 log + 投影 + 状态机）。现有 cells（dispatch/transport）只覆盖通知投递，不覆盖案件状态。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致（新建了 community-ops cell + 对应实现文件）
- 新建了 `CommunityEventLog`/`CommunityObjectStore`/`CommunityProjector`，ownership 在新 cell ✅
- 无并行 Router/Dispatcher/Binding（只新增 Store 类型，注册到 community-ops cell）

## Open Questions

### 技术 OQ（给 reviewer）

1. **Event log storage 选型合理性**：LIST + SET 足够 Phase A；Stream 留 Phase B。reviewer 确认对 Phase B 的消费组路径不造成阻力。
2. **Cascade 幂等性**：cascade 事件用 `${parentEventId}:cascade:${linkedIssueKey}` 作 sourceEventId。只有 `appended=true` 时才触发，保证 rebuild 不 double-cascade。reviewer 验证此逻辑是否正确。
3. **Fallback layers（最重要）**：3 处 try/catch 是 spec §Task6 明文要求（"append 失败不阻塞通知"）。`check-fallback-layers.mjs` 触发 warning（3 文件 ≥3 层）。reviewer 确认这是可接受的错误隔离设计，还是需要重构为明确的 `safeAppend()` 抽象。
4. **linkedIssues 跨 repo 假设**：cascade 从 `event.subjectKey` 提取 `prRepo`，构造 `issue:{prRepo}#{issueNumber}`。假设 linked issues 在同一 repo。如果跨 repo 需要从别处获取 issue 的完整 subjectKey，Phase A 先不处理（Phase B 可扩展投影字段）。reviewer 确认此假设在 Phase A 合理。

### 価值 OQ（给 CVO）

无。Phase A 纯后端、可逆（≤1 commit revert，bootstrap 不删原数据）、不碰外部契约。

## Next Action

请 @codex 做 R1 review（技术正确性 + AC 覆盖）。重点看：
- 4 个技术 OQ（fallback 层数设计 + cascade 幂等 + event log 选型 + linkedIssues 假设）
- Task 8 PR lifecycle 接线路径是否正确
- Closure invariant guard 是否完整
review 完 → `@宪宪` 传回。

## Review Sandbox（必填）

- Review-Target-ID: f168
- Path: `/tmp/cat-cafe-review/f168/codex`
- Branch: `feat/f168-event-engine`
- Start Command: `pnpm review:start`
- Ports: web=3201, api=3202（注：纯后端 PR，可能不需要 web）

## 自检证据

### Spec 合规（6 AC 全绿）

| AC | 状态 | 代码 | 测试 |
|----|------|------|------|
| 1 入口接线 + 幂等 | ✅ | GitHubRepoWebhookHandler.ts + RepoScanTaskSpec.ts + community-issues.ts | community-event-ingest.test.js (6) + community-scan-events.test.js (4) |
| 2 投影可重建 | ✅ | community-projector.ts rebuild() | redis-community-projector.test.js |
| 3 closure invariant | ✅ | community-state-machine.ts | community-state-machine.test.js |
| 4 PR lifecycle | ✅ | ReviewFeedbackTaskSpec.ts + projector cascade | redis-community-pr-lifecycle.test.js (4) |
| 5 看板 API 向后兼容 | ✅ | community-issues.ts board handler | community-board-projection.test.js (3) |
| 6 bootstrap 迁移 | ✅ | community-bootstrap.ts | redis-community-bootstrap.test.js |

### 測試结果

```
pnpm --filter @cat-cafe/api test  → 14341/14341 pass, 0 fail ✅
pnpm --filter @cat-cafe/shared test → 275/275 pass ✅
pnpm check → 22/22 checks PASSED ✅
pnpm lint → 0 errors ✅
check-hotfix-pattern.mjs → no hotfix patterns ✅
Artifact hygiene → 无根目录媒体工件 ✅
```

### 相关文档

- Plan: `docs/plans/f168-phase-a-event-engine.md`
- Feature: `docs/features/F168-community-ops-board.md`
- 終態設計: `docs/discussions/2026-06-09-f168-community-ops-final-design.md`
- Architecture cell: `docs/architecture/ownership/cells/community-ops.md`
- BACKLOG: F168 `in-progress` ✅

[宪宪/Sonnet-4.6🐾]
