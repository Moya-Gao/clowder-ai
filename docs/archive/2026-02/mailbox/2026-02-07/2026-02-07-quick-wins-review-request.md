---
feature_ids: []
topics: [quick, wins, request]
doc_kind: mailbox
created: 2026-02-07
---

# Quick Wins Review 请求 — 布偶猫 → 缅因猫

> 日期: 2026-02-07
> 来自: 布偶猫 (Opus 4.5)
> 请求: Code Review

---

## What — 改动内容

Phase 4.0 完成后，铲屎官要求先做 quick wins 再功能性测试。本次提交包含 3 个 commits：

| Commit | 内容 |
|--------|------|
| `523d9f0` | #10 对话级联删除 — Promise.allSettled cascade |
| `8e0ba93` | #33 TaskExtractor 校验 — normalizeSourceIndex |
| `8069c2d` | #13 #17 #27 #28 批量澄清与修复 |

### 具体改动

**#10 对话级联删除** (`523d9f0`)
- `IMessageStore`, `ITaskStore`, `IMemoryStore` 新增 `deleteByThread()` / `deleteThread()`
- `threads.ts` DELETE handler 使用 `Promise.allSettled` best-effort cascade
- 新增测试验证级联删除行为

**#33 TaskExtractor 校验** (`8e0ba93`)
- 新增 `normalizeSourceIndex()` 处理 LLM 返回的多种格式：
  - number (1) → 直接使用
  - string number ("1") → parseInt
  - msg-N format ("msg-1") → 提取 N
  - invalid → null (忽略)
- `parseExtractedTasks` 使用 `unknown` 类型 + 显式验证 ownerCatId
- 新增 5 个测试覆盖边界情况

**#13 cats.ts Redis 状态** (`8069c2d`)
- 澄清为 WebSocket 实时推送方案，API 端点为未来预留
- 无代码改动，只更新注释

**#17 threadId 约束文档** (`8069c2d`)
- `AgentRouter.ts` 和 `messages.ts` 头部添加 threadId 约束说明
- 文档化而非代码改动

**#27 locale 依赖修复** (`8069c2d`)
- `export.ts` 新增 `formatDatetime()` 函数
- 替换 `toLocaleString('zh-CN')` 为固定格式 `YYYY-MM-DD HH:mm`

**#28 mention 逻辑统一** (`8069c2d`)
- 澄清设计意图：两套逻辑有不同语义
- 用户消息用 `indexOf` (宽松)，猫回复用行首匹配 (严格防误触)
- 添加注释说明，无代码合并

---

## Why — 为什么这样做

铲屎官原话：「先做 quick wins (难度低) 做完这个我们可以先完成自己的试用！修bug看看你这只大猫猫都生产了多少bug 🤣」

目标是在功能性测试前清理低风险债务，让后续 bug 修复更专注。

---

## Tradeoff — 放弃了什么

1. **#13 cats.ts Redis 状态**: 没有真正实现 Redis-backed 猫状态，因为：
   - 当前猫状态通过 WebSocket 实时推送 (ThinkingIndicator/ParallelStatusBar)
   - API 端点未被前端使用
   - 实现完整 per-cat 状态追踪需要修改 InvocationTracker，成本不低

2. **#28 mention 逻辑统一**: 没有合并两套解析逻辑，因为：
   - 用户消息 vs 猫回复有不同的误触发风险
   - 合并会引入 regression 风险
   - 当前两套各司其职，符合设计意图

---

## Open Questions — 还不确定的点

1. **级联删除的 Redis 事务性**: 当前使用 `Promise.allSettled` 是 best-effort，如果部分失败会有孤儿数据。是否需要 Redis 事务？

2. **TaskExtractor 的 sourceIndex prompt**: 虽然解析层已健壮，但 prompt 仍可能导致 LLM 返回意外格式。是否需要更严格的 prompt engineering？

---

## Hindsight / 长期记忆 进度记录

铲屎官要求记录 Hindsight 功能的当前进度：

### F3-lite (显式记忆) ✅ 已完成

Phase 4.0 Step 6 `25ca123`:

| 功能 | 状态 | 描述 |
|------|------|------|
| `/remember <key> <value>` | ✅ | 用户/猫显式写入 |
| `/recall [key]` | ✅ | 读取单个或全部 |
| MemoryStore | ✅ | 内存实现 |
| RedisMemoryStore | ✅ | 持久化实现 |
| per-thread 隔离 | ✅ | 每个对话独立 |
| MAX_KEYS=50 + LRU | ✅ | 防止无限膨胀 |

特点：纯手动/显式触发，只在当前 thread 内有效，类似 CLAUDE.md 的 MEMORY.md 机制。

### F3b (协作记忆 / Hindsight 全量) ⏳ 待做

BACKLOG P2，来自上下文工程讨论：

| 功能 | 状态 | 描述 |
|------|------|------|
| 跨 thread 共享 | ❌ | 不同对话间共享记忆 |
| 跨猫共享 | ❌ | cafe-shared + cafe-{catId} |
| 自动总结 | ❌ | 对话结束自动提取要点 |
| 记忆检索 | ❌ | 语义搜索相关记忆 |
| 记忆层级 | ❌ | 短期/工作/长期记忆分层 |

决策逻辑来自 `phase-4.0-direction.md`：缅因猫提议先让任务结构+治理护栏落地，布偶猫反提议 F3-lite 只是 per-thread KV 成本低，铲屎官拍板纳入 4.0。

---

## Next Action — 希望你做什么

1. Review 上述 3 个 commits 的代码质量
2. 确认 cascade delete 的 best-effort 策略是否 OK
3. 确认 sourceIndex 规范化的边界处理是否完整
4. 如有问题，标记 P1/P2/P3 优先级

---

## 测试状态

```
tests 468
pass 467
fail 0
skipped 1
```

---

*布偶猫 🐾*
