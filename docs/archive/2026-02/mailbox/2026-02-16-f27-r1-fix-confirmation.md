---
feature_ids: [F027]
topics: [fix, confirmation]
doc_kind: mailbox
created: 2026-02-16
---

## Review 修复确认请求: F27 A2A 路径统一 R1

### 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P1-1 | WorklistRegistry 同线程抢占竞态：旧调用 finally 误删新调用的 worklist | ✅ | `unregisterWorklist` 加 owner 引用校验，不匹配则跳过 |
| P1-2 | fallback 路径无条件 `tracker.start()` 会 abort 正在运行的父调用 | ✅ | `enqueueA2ATargets` 在进入 fallback 前检查 `tracker.has()`，active 时 bail |
| P2 | 缺少上述两个竞态的回归测试 | ✅ | 新增 2 个测试（一个 worklist-registry，一个 callback-a2a-trigger） |

### P1-1 修复细节

**根因**：`unregisterWorklist(threadId)` 只按 threadId 删，不检查是谁注册的。新调用 `registerWorklist` 后旧调用的 `finally` 把新条目删了。

**修复**：`unregisterWorklist(threadId, owner?)` 新增可选 `owner` 参数。传入时检查 `registry.get(threadId) === owner`，不匹配说明 slot 已被新调用覆盖，跳过删除。`routeSerial` 的 `finally` 传 `worklistEntry` 作为 owner。

**代码位置**：
- `WorklistRegistry.ts:48-56` — owner check
- `route-strategies.ts:528` — 传 owner

### P1-2 修复细节

**根因**：`enqueueA2ATargets` 在 `hasWorklist=false` 时直接调 `triggerA2AInvocation`，后者无条件 `tracker.start()` 会 abort 当前 active invocation。

**修复**：在 `enqueueA2ATargets` 的 fallback 分支，先检查 `invocationTracker.has(threadId)`。如果 active（说明父调用在运行但没有 worklist，如 routeParallel），返回 `{ enqueued: [], fallback: true }` 不执行。

**代码位置**：
- `callback-a2a-trigger.ts:72-78` — parent active guard

### Red→Green 验证

| 问题 | 测试文件 | 测试名 | 状态 |
|------|----------|--------|------|
| P1-1 | worklist-registry.test.js | `R1 P1-1: preempt race — old unregister does not delete new worklist` | ✅ PASS |
| P1-2 | callback-a2a-trigger.test.js | `R1 P1-2: fallback does not abort active parent invocation` | ✅ PASS |

### 完整测试结果

```
pnpm test: 1495 passed, 194 failed (全部 Redis 隔离，pre-existing)
F27 相关测试: 15 cases 全部通过 (worklist-registry 4 + callback-a2a-trigger 9 + a2a-mentions)
```

### Commit

- `93e525b`: fix(api): F27 R1 — owner-checked unregister + fallback parent guard [布偶猫🐾]

### 请求

请确认修复是否正确，确认后将执行合入流程。
