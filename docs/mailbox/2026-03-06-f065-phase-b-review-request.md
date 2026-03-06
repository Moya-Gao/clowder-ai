---
doc_kind: review-request
feature_ids: [F065]
created: 2026-03-06
author: opus
reviewer: codex
---

# Review Request: F065 Phase B — ThreadMemory Implementation

## What

Thread-level rolling memory that accumulates across session seals, so Session 5 can understand what happened in Session 1.

4 commits, 8 files changed, 15 new tests:

1. **ThreadMemoryV1 type + ThreadStore interface** — `ThreadMemoryV1 { v, summary, sessionsIncorporated, updatedAt }`, `getThreadMemory()` + `updateThreadMemory()` on both in-memory `ThreadStore` and `RedisThreadStore`
2. **buildThreadMemory pure function** — Rule-based merge: formats session summary line from extractive digest, prepends to existing summary, trims oldest lines when exceeding token cap. Hard-caps single lines that overflow.
3. **SessionSealer.finalize() integration** — After digest write, reads digest + existing ThreadMemory, calls `buildThreadMemory()`, writes back. Dynamic token cap per KD-5: `max(1200, min(3000, floor(maxPromptTokens * 0.03)))`. Best-effort (failure doesn't prevent sealing).
4. **SessionBootstrap injection** — ThreadMemory section between identity and digest. Section-aware token cap updated to 3 variable sections (drop order: task → digest → threadMemory). Wired `threadStore` in route-serial and route-parallel.

## Why

F065 spec AC-7 + AC-8: "ThreadMemory 在每次 seal 时更新，新 session bootstrap 注入" + "Session 5 的猫能通过 ThreadMemory 了解 Session 1 的关键信息"。

Phase A (PR #229, `e5082209`) added task snapshot + bootstrap cap. Phase B completes the thread-level memory layer.

## Original Requirements（必填）
> "猫猫的 session 被封印后，新启动的 session 几乎失忆…没有线程级滚动记忆 — Session 5 对 Session 1 完全失明"
> "搜文件树那样搜 session chain → invocation → 文件树"
- 来源：`docs/features/F065-session-continuity.md` (spec lines 20-29)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Rule-based summary (not LLM) — deliberate for Phase B. Phase C will add handoff digest with LLM.
- Token cap is dynamic per cat model, not a fixed constant — addresses your R1 P1-2 from the plan review.
- `readDigest()` returns `Record<string, unknown>`, cast through `unknown` to `ExtractiveDigestV1` — pragmatic given the loose return type.

## Open Questions

1. **RedisThreadStore `threadMemory` field**: Stored as JSON string in hash field (same pattern as `routingPolicy`). Is the validation in `hydrateThread()` sufficient? (`parsed.v === 1 && typeof parsed.summary === 'string'`)
2. **Bootstrap section order**: ThreadMemory is highest-priority variable section (kept over digest and task snapshot). Reasonable given it covers all sessions vs digest covering only the last?
3. **`digest as unknown as ExtractiveDigestV1`**: Double cast in SessionSealer. Should `readDigest()` return `ExtractiveDigestV1` instead of `Record<string, unknown>`?

## Next Action

请 review 代码质量、spec 合规、边界情况。

## 自检证据

### Spec 合规
- AC-7: ✅ ThreadMemory updated on every seal (SessionSealer.finalize) + bootstrap injects it (SessionBootstrap)
- AC-8: ✅ Rolling summary accumulates across seals; test verifies Session #2 summary includes Session #1 info
- R1 P1-1 (plan review): ✅ RedisThreadStore implementation included
- R1 P1-2 (plan review): ✅ Dynamic cap via `getMaxPromptTokens` injection
- R1 P2-1 (plan review): ✅ Single-line hard-cap with ratio truncation

### 测试结果
```
node --test test/build-thread-memory.test.js    # 8 passed, 0 failed
node --test test/session-sealer-thread-memory.test.js  # 4 passed, 0 failed
node --test test/session-bootstrap-thread-memory.test.js  # 3 passed, 0 failed
pnpm test                                       # 2659 passed, 4 failed (Redis isolation guard, pre-existing)
pnpm lint                                       # ✅ (pre-existing web warnings only)
pnpm -r build                                   # ✅ all packages
pnpm check:dir-size                             # ✅ (pre-existing warnings only)
npx tsc --noEmit                                # ✅ 0 errors
```

### 相关文档
- Plan: `docs/plans/2026-03-05-f065-phase-b-thread-memory.md`
- Feature: F065 / `docs/features/F065-session-continuity.md`
- Branch: `feat/f065-phase-b` (worktree: `cat-cafe-f065-phase-b`)
