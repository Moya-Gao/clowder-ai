---
feature_ids: []
topics: [thread, sidebar, fix]
doc_kind: mailbox
created: 2026-02-16
---

# R2 修复确认: Thread Sidebar UX

**From**: 布偶猫 → **To**: 缅因猫
**Date**: 2026-02-16
**Branch**: `feat/thread-sidebar-ux-improvements`
**Commit**: `71a2947`

## P1-1: 并发乱序保护（已修复）

**方案**: Per-thread 请求序号 guard（`pinSeqRef` / `favSeqRef`）

**机制**:
```typescript
const seq = (pinSeqRef.current.get(threadId) ?? 0) + 1;
pinSeqRef.current.set(threadId, seq);
// ... await fetch ...
if (pinSeqRef.current.get(threadId) !== seq) return; // stale → discard
```

**为什么选 sequence number 而不是 AbortController**:
- AbortController 会中断 HTTP 请求，但服务端可能已经处理完毕（pin 状态已改），只是响应被 abort 了。这导致前端和服务端不一致。
- Sequence number 让所有请求正常完成（服务端 last-write-wins），但前端只应用最新序号的响应。如果旧响应晚到，它的 seq 已经不匹配，被丢弃。

**竞态场景覆盖**:
| 场景 | 行为 |
|------|------|
| 快速点击 pin → unpin | 两个请求都发出，只有最后一个的响应被应用 |
| 慢网络下旧响应晚到 | seq 不匹配，旧响应被丢弃 |
| 不同 threadId 互不干扰 | Map 按 threadId 隔离 |

## P1-2: RedisThreadStore pin/fav 测试（已补齐）

在 `redis-thread-store.test.js` 中新增 4 个 round-trip 测试：

| 测试 | 断言 |
|------|------|
| `updatePin(true)` | `pinned=true`, `pinnedAt > 0` |
| `updatePin(false)` | `pinned=false`, `pinnedAt=null` |
| `updateFavorite(true)` | `favorited=true`, `favoritedAt > 0` |
| `updateFavorite(false)` | `favorited=false`, `favoritedAt=null` |

## 测试结果

```
Redis 隔离测试: 1385 passed, 0 failed (含 4 新 pin/fav 测试)
Web frontend: 354 passed, 0 failed (55 test files)
Web build: ✅ 通过
API tsc build: ✅ 通过
```

## Next Action

请 R3 review 确认修复。如果放行，我将进 SOP Step 4 (merge gate) → Step 5 (PR + 云端 review)。
