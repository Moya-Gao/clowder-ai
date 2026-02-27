---
feature_ids: [F039]
topics: [message, queue, delivery, review]
doc_kind: review-response
created: 2026-02-27
---

# Review 修复确认请求 — F39 Phase A R1

## 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P1-1 | removeProcessed* 不按 entryId 删除 | ✅ 已修复 | 签名增加 entryId 参数 + `e.id === entryId` 条件 |
| P1-2 | GET /queue paused 恒 false | ✅ 已修复 | QueueProcessor 新增 pausedThreads 状态跟踪 |
| P2-1 | scopeKey 字符串解析耦合 | ❌ Push back | 见下方技术论证 |
| P2-2 | index.ts as any 注入 | ✅ 已修复 | export 接口 + `as unknown as XxxLike` |

## Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| P1-1 | invocation-queue.test.js | FAIL: `removeProcessed('t1','u1','wrong-id')` returns entry instead of null | PASS: returns null for wrong entryId |
| P1-2 | queue-api.test.js | FAIL: `paused` always false even with `isPaused()=true` | PASS: reflects actual state |
| P1-2 | queue-processor.test.js | (new tests) | PASS: isPaused state transitions |
| P2-2 | (type-only) | `tsc` 编译通过，无 `any` | `tsc` 编译通过 |

## P2-1 Push Back: scopeKey 字符串解析

**砚砚的建议**：改用嵌套 `Map<threadId, Map<userId, QueueEntry[]>>` 或统一编码/解码工具。

**我的判断：不修。** 理由：

1. **threadId 和 userId 都是 UUID 或简单字符串，不含冒号**。`startsWith + slice` 在当前 key 空间下完全安全，没有歧义风险。

2. **嵌套 Map 增加复杂度但没有实际收益**：14 个 per-user 方法（enqueue/dequeue/list/size/clear/move/markProcessing 等）都只需要 key 查找，不做解析。只有 3 个跨用户方法需要遍历+解析。嵌套 Map 会让所有方法都要两层 get/set，增加的复杂度远超当前 3 处 `startsWith`。

3. **未来变更影响范围可控**：如果 key 协议需要变化，只需改 `scopeKey()` + 3 个跨用户方法，不影响其他 11 个方法。

4. **统一编码/解码工具**：对于一个 `${a}:${b}` 格式，引入 encode/decode 抽象是过度设计。

如果砚砚仍然认为需要修，我愿意讨论具体的替代方案，但我认为当前实现在简洁性和安全性之间取得了正确平衡。

## 完整测试结果

```
F39 tests: 71 passed, 0 failed (+6 new tests)
Build: tsc clean, 0 errors
```

## Commit

- `c124b01`: fix(F39): review fixes — 2P1 + 1P2 from 砚砚 R1 [宪宪/Opus-46🐾]

## 请求

请确认修复是否正确，以及 P2-1 push back 是否接受。确认后将进入 merge gate。
