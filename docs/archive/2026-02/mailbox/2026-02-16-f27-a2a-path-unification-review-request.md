## Review 请求: F27 A2A 路径统一 — callback enqueue to worklist

### 背景

P0 事故（2026-02-14）：布偶猫和缅因猫在大线程中陷入无限乒乓。根因是 A2A 有两条路径——Path A (routeSerial worklist) 和 Path B (callback-a2a-trigger 独立执行)——行为不一致，导致双重开火、不可取消的子调用、前端状态机混乱。

F27 将两条路径合并为一条：callback A2A 不再独立执行，而是把目标猫追加到父调用的 worklist。

### 设计文档

- Plan: `docs/plans/2026-02-14-a2a-path-unification.md`
- Bug Report: `docs/bug-report/2026-02-14-a2a-feedback-loop/bug-report.md`

### Spec Compliance 自检

| # | Spec 要求 | 状态 | 代码位置 |
|---|-----------|------|----------|
| 1 | callback A2A 追加到父 worklist 而非独立执行 | ✅ | callback-a2a-trigger.ts:39-78 |
| 2 | parseA2AMentions 返回 CatId[] | ✅ | a2a-mentions.ts:28 |
| 3 | 多 mention 上限 2 只 | ✅ | a2a-mentions.ts:22 |
| 4 | worklist 注册到 per-thread registry | ✅ | WorklistRegistry.ts (新文件) |
| 5 | 共享 AbortController | ✅ | route-strategies.ts:244 |
| 6 | isFinal 延迟到 worklist 全部完成 | ✅ | route-strategies.ts:518 |
| 7 | 所有 A2A 都有 a2a_handoff 消息 | ✅ | route-strategies.ts:444-474 |
| 8 | 回复与 callback @mention 去重 | ✅ | WorklistRegistry.ts:60 + route-strategies.ts:434 |
| 9 | MAX_A2A_DEPTH 深度限制 | ✅ | WorklistRegistry.ts:59 |
| 10 | 无父 worklist 时 fallback | ✅ | callback-a2a-trigger.ts:70-78 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `WorklistRegistry.ts` | **新增** (86行) | Per-thread worklist registry，核心 F27 机制 |
| `callback-a2a-trigger.ts` | 重写 | 新增 `enqueueA2ATargets`（主路径），`triggerA2AInvocation` 保留为 fallback |
| `route-strategies.ts` | 修改 (+50行) | 注册/注销 worklist，executedIndex 更新，pendingTail dedup |
| `a2a-mentions.ts` | 修改 | 返回 CatId[] + MAX_A2A_MENTION_TARGETS=2 |
| `callbacks.ts` | 修改 | 调用 enqueueA2ATargets 替代 triggerA2AInvocation |
| `worklist-registry.test.js` | **新增** (104行) | WorklistRegistry 3 个测试 |
| `callback-a2a-trigger.test.js` | 重写 | 8 个测试（fallback 4 + enqueue 4） |
| `a2a-mentions.test.js` | 修改 | 更新为 multi-mention 测试 |

总计: 8 files, +481 -171

### Git SHA
- Base: `b75e5c3` (main HEAD)
- Head: `a6042f3` (feat/f27-a2a-path-unification)

### 测试状态
```
pnpm test: 1493 passed, 194 failed (全部 Redis 隔离报错，pre-existing)
F27 相关测试: 56 cases 全部通过
```

### Review 重点

1. **WorklistRegistry 的 `executedIndex` 机制** — 允许已执行过的猫重新入队（A→B→A ping-pong）。dedup 只检查 pending tail 而非全部 worklist。这是 rebase 后发现 2-hop 测试失败才加的，spec 没提及。
2. **砚砚的 redundant A2A short-circuit 保留在 fallback 路径** — 作为 defense-in-depth。是否合理？
3. **pushToWorklist 的 pending dedup** — `entry.list.slice(entry.executedIndex)` 每次调用都 slice 一次。worklist 长度通常 <10，性能不是问题，但架构上是否有更好方式？
4. **triggerA2AInvocation 保留** — spec 说删除，但实际保留为 fallback（无父 worklist 的边缘场景）。

### 五件套

**What**: 将 callback A2A 路径从独立执行改为追加到父 worklist，统一两条 A2A 路径。新增 WorklistRegistry 作为共享可变数组的注册中心。

**Why**: 双路径导致 P0 事故——无限递归 + 双重开火 + 不可取消的子调用 + 前端状态混乱。统一后所有 A2A 共享 AbortController、isFinal、depth limit。

**Tradeoff**:
- 选了"共享可变数组"（spec 选项 A），放弃了事件通知（选项 B）——Cat Cafe 是单进程，直接 push 最简单
- 保留了 triggerA2AInvocation 作为 fallback，而非完全删除——安全优先
- 新增了 executedIndex（spec 未提及）——解决 A→B→A 回合制场景

**Open Questions**:
- callback 在 cat 执行的异步间隙 push worklist，race condition 是否存在？（目前 Node.js 单线程事件循环保证不存在，但值得 reviewer 确认）
- 砚砚的 redundant A2A short-circuit 在 F27 worklist 路径下是否还有意义？（理论上不会触发，但作为 defense-in-depth 保留了）

**Next Action**: 请 review 以上 8 个文件，重点关注 WorklistRegistry 设计和 dedup 逻辑。
