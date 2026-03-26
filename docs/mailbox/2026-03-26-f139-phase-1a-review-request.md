# Review Request: F139 Phase 1a — Unified Internal Poller

Review-Target-ID: f139
Branch: feat/f139-unified-poller

## What

将三套独立 `setInterval` poller 收敛为统一 `TaskSpec_P1` 调度模型：

1. **Core engine**: `TaskSpec_P1` 六维度类型 + `TaskRunnerV2` 五步流水线 + `RunLedger` SQLite 记录
2. **Profile defaults**: `awareness` (30min/120s/drop) + `poller` (60s/30s/record)
3. **四个 consumer**:
   - `summary-compact` — 迁移 F102 SummaryCompactionTask (boolean gate → typed signal + workItems)
   - `cicd-check` — 迁移 F133 CiCdCheckPoller (self-managed interval → TaskSpec)
   - `conflict-check` — 新增 PR merge conflict detection
   - `review-comments` — 新增 PR comment detection (in-memory cursor)
4. **Bootstrap wiring**: `index.ts` 创建单一 `TaskRunnerV2`，注册四个 spec，替换旧 `startGithubCiPoller()`

## Why

铲屎官需求："没人找你但该主动检查"的自省能力需要统一抽象，不能再加独立 `setInterval`。ADR-022 已通过。Phase 1a 纯后端交付，为 Phase 2 (Cron + UI + Context) 打基础。

## Original Requirements（必填）

> 铲屎官原话："我们现有的能力是不是已经功能上满足小龙虾的 heartbeat 覆盖的能力？"
> "不建议你这个可配置是编辑到什么 Markdown 文档里……能让人类跟你直接说自然语言，你帮别人去编辑，或者你有个 UI 去把东西呈现出来"

- 来源：`docs/features/F139-unified-schedule-abstraction.md` (spec)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**
- Phase 1a 聚焦后端收敛；UI + 自然语言配置 deferred to Phase 2

## Tradeoff

1. **Lease 仍为 task-level**（非 subject-level）——Phase 1a 保持简单，subject-level lease 延后到 Phase 1b
2. **CiCdCheckTaskSpec execute 内联 pollOne 逻辑**——因为 `pollOne` 是 private 方法，选择用 public `fetchPrStatus` + 内联路由，而非修改原类可见性
3. **ReviewComments cursor 纯内存**——SQLite cursor 持久化延后到 Phase 2
4. **TaskRunnerV2 内部用 `any` 存 tasks**——解决 TypeScript variance 问题（`TaskSpec_P1<Signal>` 的 execute 参数逆变）

## Open Questions

1. **conflict-check / review-comments 的 execute 当前只 log**——真正的通知路由应该接入什么？直接复用 CiCdRouter 模式还是单独做？
2. **老 TaskRunner 类保留在 codebase 但不再使用**——本轮清理还是等 Phase 1b 确认无引用再删？
3. **index.ts 里 `checkMergeable` / `fetchComments` 用 `gh` CLI**——生产环境 gh 认证是否需要额外处理？

## Next Action

请 review 代码质量 + AC 覆盖度 + 架构合理性。重点关注：
- TaskRunnerV2 五步流水线是否正确实现了 ADR-022 设计
- Gate typed signal 是否真正消除了二次扫描
- Bootstrap wiring 是否干净（旧代码清理够不够）

## 自检证据

### Spec 合规

| AC | Status |
|----|--------|
| AC-A1: TaskSpec_P1 + typed signal gate | ✅ |
| AC-A2: subjectKey execute/cursor/dedupe/ledger | ✅ |
| AC-A3: run ledger SQLite | ✅ |
| AC-A4: SummaryCompaction migration | ✅ |
| AC-A5: CiCdCheckPoller migration | ✅ |
| AC-A6: conflict-check + review-comments | ✅ |
| AC-A7: awareness/poller profiles | ✅ |
| AC-A8: No regression, pure interval convergence | ✅ |

### 测试结果

```
node --test packages/api/test/scheduler/*.test.js packages/api/test/memory/task-runner.test.js
→ 40/40 pass, 0 fail ✅

pnpm lint                → 0 errors ✅
pnpm check               → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-25-f139-phase-1a-unified-poller.md`
- ADR: `docs/decisions/022-unified-schedule-abstraction.md`
- Feature: `docs/features/F139-unified-schedule-abstraction.md`

### 10 commits on `feat/f139-unified-poller`

```
b08c9094f Task 1: TaskSpec_P1 types
ab5674d70 Task 2: RunLedger + schema V5
9f70e7dd0 Task 3: TaskRunnerV2 engine
e5e41ce6b Task 4: profiles
671f03222 Task 5: SummaryCompactionTaskSpec
c9ae01c53 Task 6: CiCdCheckTaskSpec
47537ddec Task 7: ConflictCheckTaskSpec
87f84bcab Task 8: ReviewCommentsTaskSpec
9beb60f47 Task 9: Bootstrap wiring
2e28f29df Biome fixes + feature index
```
