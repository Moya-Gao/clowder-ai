---
feature_ids: [F045]
debt_ids: []
topics: [task-progress, redis, abort, reliability]
doc_kind: review_request
created: 2026-03-01
---

## Review 请求: F045 Hotfix — task progress snapshot guards (cloud P1/P2)

@opus（宪宪）我这边作为 author 请求本地 review（SOP Step 3a）。这是 PR #106 云端 Codex 的 **2 条 inline 意见（P1/P2）** 对应的 hotfix。

### 背景

PR #106 合入后，云端 Codex 在 `invoke-single-cat.ts` 留了两条 inline comment：

- **P1**：`finalizeTaskProgress()` 写 Redis 失败会把本应成功的 invocation 变成用户可见 error（应降级）
- **P2**：abort/early-close（consumer `iterator.return()`）时，interruption state 可能没来得及更新，`finally` 会把 snapshot 误写为 `completed`（应写 `interrupted` + reason）

为了避免 checklist 恢复/继续链路在“短暂 Redis 故障 / 用户中断”场景下误导或刷错误气泡，需要修。

### 原始需求 / 触发来源（🔴 必填）

- 来源：PR #106 云端 inline comments（IDs: `2868056898` / `2868056899`）+ 我们的 F045 Gap #4 语义（中断需要显示“继续”入口）
- 复现与根因记录：`docs/bug-report/2026-03-01-f045-task-progress-finalize-guards/bug-report.md`

### 修复摘要（Spec compliance 自检）

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | snapshot 写入失败不影响主成功路径 | ✅ | running/final snapshot 都 try/catch degrade（warn 不 throw） |
| 2 | abort/early close 后 snapshot 仍为 interrupted | ✅ | `signal.aborted` → `interruptReason: 'aborted'` |
| 3 | early close 不丢 lastTasks/snapshot | ✅ | `maybePersistTaskProgress(out)` 移到 `yield out` 之前 |
| 4 | Red→Green 回归测试 | ✅ | 新增 2 tests 覆盖 P1/P2 |

### 改动文件

| 文件 | 改动 | 说明 |
|---|---|---|
| `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts` | 修改 | store 写入降级 + yield 前置更新 flag/snapshot + abort interruption |
| `packages/api/test/invoke-single-cat.test.js` | 修改 | 2 个回归测试（finalize throw 不刷 error；abort early return → interrupted/aborted） |
| `docs/bug-report/2026-03-01-f045-task-progress-finalize-guards/bug-report.md` | 新增 | 复现/根因/修复/验证记录 |

### Git SHA

- Base: `origin/main`（当前 worktree 基于最新 main）
- Head: `8659fe2a` (`fix/f045-task-progress-store-guards`)

### 测试证据

```bash
node --test packages/api/test/invoke-single-cat.test.js
pnpm --filter @cat-cafe/api test:redis
```

### Review 重点

1. 我把 `maybePersistTaskProgress(out)` 移到 `yield out` 之前（为了解决 early close 丢 snapshot）。你确认这个时序改动不会引入副作用/死锁风险。
2. `finalizeTaskProgress()` 现在会在 store throw 时 degrade（warn + skip），不再上升为 user-visible error。你确认这符合我们对“可观测性写入失败不影响主链路”的一贯原则。
3. abort 的 interruptReason 我选了 `'aborted'`；你看是否需要与前端/文案对齐（目前只是 snapshot 字段）。

### 五件套

**What**: task progress snapshot 写入降级 + abort interruption 语义修复 + 回归测试。  
**Why**: 云端 P1/P2 指出当前实现会把存储故障变成用户错误、以及 abort 误标 completed。  
**Tradeoff**: yield 前置写 snapshot 会增加一点点 store write latency，但换取 early-close correctness。  
**Open Questions**: abort 原因枚举是否需要统一到前端 i18n。  
**Next Action**: 请做 R1 review；如放行我再走 merge gate → PR → Step2.5 PR tracking → 云端 review → 合入。  
