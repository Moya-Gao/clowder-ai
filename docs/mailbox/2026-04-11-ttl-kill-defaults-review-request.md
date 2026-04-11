---
doc_kind: review-request
created: 2026-04-11
feature_ids: []
topics: [redis, ttl, data-loss, p0-fix]
---

# Review Request: Redis DEFAULT_TTL → 0 + thread self-healing (PR #1075)

Review-Target-ID: fix-ttl-kill-defaults
Branch: fix/ttl-defaults-to-zero

## What

25 files changed across 4 categories:

1. **DEFAULT_TTL → 0** in 16+ Redis stores (thread/message/task/summary/backlog/session/memory/auth/push/pr-tracking/invocation/workflow)
2. **EXPIRE 0 trap guards**: Lua scripts + direct `expire()` calls wrapped with `> 0` conditional
3. **Thread self-healing**: `get()` recovers orphaned thread metadata from surviving message timeline via `recoverThreadFromMessages()`
4. **Unified key retention**: All detail mutations through `setDetailFields()`/`deleteDetailFields()` → auto `applyKeyRetention()` (PERSIST or EXPIRE depending on config)
5. **Docs**: LL-048, Iron Rule #5, env-reference.md, .env.example updated

## Why

F100 Self-Evolution thread (`thread_mmlv4v2oq6dxefr6`) silently vanished on 2026-04-10 after 30-day hardcoded TTL expired. `updateLastActive()` refreshed sorted set score but never refreshed hash TTL → orphan index entry pointing to deleted hash.

This is a P0 fix: user-visible data disappeared with zero warning, zero trash record, zero recovery path.

## Original Requirements（必填）

> 铲屎官 2026-04-10 21:44:
> "@opus 我认为我们设置默认值要改成不过期。不然社区小伙伴也会过几天发现特么东西丢了！！！这个太恐怖了。然后如果要过期才要单独配置！！！突然丢了非常恐怖的！！你看一下砚砚的定位 你们先把f100恢复回来 然后在代码层面都得止血 任何到redis的地方！禁止什么1天过期 什么30天过期！包括你要检查env example 以及env opensouce example等等可能覆盖ttl的地方！！！！"

> 铲屎官 2026-04-10 22:02:
> "我感觉你这个必须记录教训 甚至写到铁律，我们家不能出现数据静默消失。"

- 来源：本次对话直接需求（P0 incident response），无独立 Discussion 文档
- **请对照上面的摘录判断：(1) 所有 Redis store 都止血了吗？(2) env example 覆盖了吗？(3) 铁律和教训记录了吗？**

## Tradeoff

- **不修 updateLastActive() 刷新 TTL**：因为 DEFAULT_TTL=0 后不需要刷新。如果用户未来配了非零 TTL，`applyKeyRetention()` 统一处理。
- **self-healing 只在 `get()` 触发**：不做后台扫描——按需恢复够用，不增加 Redis 负载。

## Open Questions

1. **EXPIRE 0 陷阱全覆盖？** — 16+ 个 store 改了，请逐一确认没有漏网的 `EXPIRE`/`SET EX` 调用未加 `> 0` 守卫
2. **Lua 模板字面量安全？** — `RedisSessionChainStore` 和 `RedisInvocationRecordStore` 用 JS template literal 在 Lua 脚本中做条件分支（编译时求值），确认 TTL=0 时生成的 Lua 不会意外执行 EXPIRE
3. **self-healing title 截断** — `deriveRecoveredTitle()` 取前 30 字符，是否足够？

## Next Action

请 @codex review 代码正确性 + TTL 覆盖完整性。放行后走 merge-gate。

## 自检证据

### Spec 合规

- [x] 所有 16+ Redis store DEFAULT_TTL → 0
- [x] .env.example + .env.example.opensource TTL 文档更新
- [x] docs/env-reference.md TTL 默认值更新
- [x] LL-048 lessons-learned 条目
- [x] CLAUDE.md Iron Rule #5
- [x] F100 thread 已手动恢复到 Redis 6399

### 测试结果

```
tsc --noEmit                                    # 0 errors
redis-thread-store.test.js                      # 26 passed, 0 failed
redis-session-chain-store.test.js               # 18 passed, 0 failed
```

### 相关文档

- Lesson: `docs/lessons-learned.md` → LL-048
- Feature spec (丢失线程来源): `docs/features/F100-self-evolution.md` line 54
- Iron Rule: `CLAUDE.md` → "五条铁律" #5
