---
type: review-request
date: 2026-05-15
feature: F200
phase: D
author: opus-46
reviewer: codex
---

# Review Request: F200 Phase D — Full Trajectory Records

Review-Target-ID: f200-phase-d
Branch: feat/f200-phase-d-trajectory

## What

Phase D extends F200's single-search telemetry (Phase A-C) to task-level trajectory records with outcome verification. 7 commits, 4 new domain classes, 2 new API endpoints, 48 tests.

Core additions:
- **TaskTrajectory** aggregation by invocation/thread (V22 schema migration)
- **TrajectoryAggregator**: correlates recall_events → trajectory with filesRead/filesModified/taskContext
- **OutputVerifiedDetector**: injectable signal source architecture for async outcome verification (v1: PR merge + invocation status)
- **CrossCatMetricsComputer**: CrossCatEffortVariance + ConsumedButNotUsedRate
- **API**: `GET /api/recall/trajectories` + `GET /api/recall/metrics/cross-cat`
- **Integration in recall-correlation-hook**: trajectory persisted after recall event correlation

## Why

Phase A-C captured individual search events. Phase D captures the *entire task arc* — what was searched, what was read, what was modified, and whether the output was verified. This enables:
- Success trajectory reuse ("last time this type of task succeeded, the cat searched X, read Y")
- Failure diagnosis (5 searches + 8 reads but review rejected — why?)
- Cross-cat index gap discovery (same task, different effort across cats)

## Original Requirements（必填）
> "比如猫猫目前的任务 xxxx，猫猫搜索了 xxxx 看了 xxx 文档 修改了 xxx 干了啥啥啥，最后产出 yyyy，我倒是觉得这个轨迹很值钱，搜集的多了都能优化我们的系统"
> "有的时候行为能暴露出你们对于这些东西的判断的！！！"
- 来源：`docs/features/F200-memory-recall-eval.md`「为什么」节
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **outputVerified v1 only uses PR merge + invocation status**. CVO accept and reviewer approval signals deferred to v1.1 — they require thread message scanning which adds coupling to the messaging layer. Design gate decision.
- **Two-phase architecture**: trajectory creation is sync (in correlation hook, sqlite-only), outcome verification is async (needs Redis stores). This keeps the hot path simple.
- **ConsumedButNotUsedRate** uses N+1 queries per trajectory — acceptable for the current scale (dozens of trajectories per query window), not a concern until 10k+.

## Architecture Ownership（必填）
Architecture cell: memory-recall
Map delta: none
Why: Extends existing recall pipeline with trajectory aggregation layer; no new Store/Queue/Router.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding
- 若修改 docs/architecture/ownership/cells/*.md，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. CrossCatMetricsComputer.computeConsumedButNotUsedRate 做了 N+1 查询（每个 trajectory 单独查 recall_events）。当前 scale 下 OK，是否需要 JOIN 优化？
2. TrajectoryAggregator.aggregate 从 events 数组提取 threadId（取第一个非空值）。如果同一 invocation 跨 thread（极端情况），是否需要处理？

### 价值 OQ（给 CVO，如有）
无

## Next Action
请做 cross-family code review。重点关注：
1. 数据模型完整性（TaskTrajectory 是否覆盖铲屎官要求的"搜了/看了/改了/产出"全链路）
2. outputVerified v1 signal 设计（是否足够 bootstrap，v1.1 扩展是否自然）
3. API 查询接口是否满足下游消费需求

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f200-phase-d/codex`
- Start Command: `pnpm review:start`
- Ports: 纯后端改动，无需启动 web

## 自检证据

### Spec 合规
AC-D1 ✅ TaskTrajectory 按 invocation/thread 粒度聚合
AC-D2 ✅ outputVerified 从 PR merge + invocation status 自动推断 (v1)
AC-D3 ✅ 轨迹可被 /api/recall/trajectories 查询
AC-D4 ✅ CrossCatEffortVariance + ConsumedButNotUsedRate 上线

### 测试结果
pnpm test (F200) → 48/48 pass, 0 failed
pnpm check → 0 errors
pnpm lint → 0 errors
pnpm -r --if-present run build → exit 0

### 相关文档
- Plan: `docs/plans/2026-05-15-f200-phase-d-trajectory-records.md`
- Feature: `docs/features/F200-memory-recall-eval.md`
