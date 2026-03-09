---
date: 2026-03-09
topic: F069-R5 backend read/latest truth-source fix
author: opus
reviewer: codex
---

# Review Request: F069-R5 Backend read/latest truth-source fix

## What

Added `POST /api/threads/:id/read/latest` backend endpoint that finds the latest real message server-side and acks it atomically. Replaced frontend's complex `lastRealMessageId` useMemo + `storeThreadId` race guard with a simple POST call on thread entry.

**Changed files (3 modified + 1 new):**
- `packages/api/src/routes/threads.ts` (+37): New endpoint after existing PATCH /read
- `packages/web/src/components/ChatContainer.tsx` (-17): Replaced 15-line useMemo+useEffect with 4-line POST
- `packages/web/src/components/__tests__/chat-container-read-ack-race.test.ts` (-4): Rewritten for new behavior
- `packages/api/test/read-latest-endpoint.test.js` (new, 7 tests): Backend endpoint coverage

Net diff: -21 lines (simpler than what it replaces).

## Why

Unread badge "1" persists after clicking into thread — reproduced across FOUR rounds of fixes (PRs #279, #282, #295, #327). The fundamental issue: frontend ack depends on `messages` state which races with async `fetchHistory`. User clicks thread → ack fires with stale cached ID → switches away before fetchHistory completes → badge reappears.

## Original Requirements
> "还是会！@gpt52 还是n次点不掉！你来定位看看？" — 铲屎官 2026-03-09
> Unread badge persists after entering thread, through 4 rounds of fixes.

- 来源：当前 thread 对话记录 + codex review of PR #327
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

**Chose backend truth-source over frontend timing hacks:**
- R1-R4 each added a new frontend guard (suppression window, synthetic ID filter, sortable ID regex, force-refresh). Each fixed one timing path but left others.
- Backend approach: zero frontend state dependency. Server finds latest message, acks it. No race possible.
- Kept existing `PATCH /api/threads/:id/read` for backward compatibility (mark-all-read still uses it).

**Rejected: removing useChatHistory's force-refresh (PR #327)**
- The R4 force-refresh is still valuable for cache freshness. The bug was that ack fired BEFORE the refresh completed. With R5, ack doesn't depend on refresh results at all.

## Open Questions

1. **Should we deprecate the old PATCH /read endpoint?** Currently kept for backward compat + mark-all-read uses it. Could consolidate later.
2. **Per-codex's original recommendation**: This is exactly the "后端 latest-ack 真相源" fix codex recommended in PR #327 R1 review. Please verify the implementation matches your intent.

## Next Action

请 review 代码变更，重点关注：
- Backend endpoint 的 auth/validation 是否完整
- Frontend 简化是否遗漏了必要的 guard
- 是否还有其他 timing path 未覆盖

## 自检证据

### Spec 合规
- Quality gate passed: 愿景对照 ✅, 功能验收 5/5 ✅
- All 5 root causes addressed: suppression (R1) + synthetic filter (R2) + sortable regex (R3) + force-refresh (R4) + backend truth-source (R5)

### 测试结果
```
node --test packages/api/test/read-latest-endpoint.test.js  # 7 passed, 0 failed ✅
node --test packages/api/test/threads-endpoint.test.js      # 37 passed, 0 failed ✅
node --test packages/api/test/mark-all-read.test.js         # 5 passed, 0 failed ✅
pnpm --filter @cat-cafe/web test (read-ack + thread-switch) # 8 passed, 0 failed ✅
pnpm --filter @cat-cafe/api build                           # exit 0 ✅
pnpm lint                                                   # 0 new errors ✅
```

### 相关文档
- Feature: F069 / unread badge persistence
- Prior PRs: #279 (R1), #282 (R2), #295 (R3), #327 (R4)
- Codex R1 review of #327: recommended backend latest-ack truth-source
