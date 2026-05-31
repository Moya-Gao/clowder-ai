---
feature_ids: [F216]
topics: [routing, review-request]
doc_kind: review-request
created: 2026-05-31
---

# Review Request: F216-c3 supersede — abort running handoff on same-turn repeat

Review-Target-ID: f216
Branch: feat/f216-c3-supersede

## What

Implement the **supersede** path in `callback-a2a-trigger.ts` (Guard 2 processing branch): when a second same-caller→same-target handoff arrives while the first is already processing, abort the running invocation and let the follow-up restart (last-wins semantics).

Changes:
- `QueueProcessorLike` interface extended with `clearPause`/`releaseSlot`
- `invocationQueue` Pick extended with `removeProcessed`
- Processing branch: interim log → full supersede sequence (`cancelInvocation` → `clearPause` → `releaseSlot` → `removeProcessed` → fall-through enqueue → `tryAutoExecute`)
- INTERIM test contract upgraded to SUPERSEDE with 6-point assertion suite

## Why

Closes the second half of the coalesce bug (processing scenario). Without supersede, target cat executes the first (possibly wrong) handoff before seeing the caller's real intent. LL-064 mandates reusing force-send's abort-resume coordinate system to avoid `processingSlots` mutex race.

## Original Requirements（必填）
> 铲屎官有一次发现，当一只猫在同一个回合里对同一只目标猫连续 at 了两次，系统的行为是错的：第一条 handoff 会先被独立执行。猫连发两条往往意味着"我改主意了，后一条才是我真正想让你做的"。但系统把两条都当真，于是目标猫会先按第一条（可能是错的那条）跑一遍，把队友带偏。
- 来源：`docs/plans/2026-05-31-f216-c3-supersede-handoff.md` + `docs/features/F216-route-serial-refactor.md` Phase D
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择同步 supersede（在 enqueue path 内完成 abort+cleanup）而非异步信号通知，因为必须保证 follow-up enqueue 时 slot 已释放、entry 已移除，否则 `tryAutoExecute` 看不到空闲 slot
- `removeProcessed` 直接移除旧 entry（而非 rollback），因为 supersede 的语义是"此意图作废"，不是"此意图等会儿再跑"

## Architecture Ownership（必填）
Architecture cell: `routing`
Map delta: none
Why: 在 callback-a2a-trigger.ts 现有 processing 分支内实现，未新建 router/adapter/binding

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. supersede 后 `onInvocationComplete('canceled')` 的异步回调会跑（tracker `.catch` path）——此时 entry 已被 `removeProcessed` 移走、slot 已被 `releaseSlot` 释放。请确认这两个异步幂等操作不会干扰 follow-up 的 processing 状态。
2. AC-D5 (vote 路径 coalesced→missed 问题) 未在本 PR 修——确认是否可 defer 到 Phase D 后续或独立 PR。

### 价值 OQ（给 CVO，如有）
无——技术选择已由 LL-064 + 砚砚 5 轮 review 收敛，回滚成本低。

## Next Action

请 reviewer 重点检查：
1. supersede 不进 `resolveRoutingDecisions`（执行层 only）
2. abort/restart 时序完整性（cancelInvocation + clearPause + releaseSlot + removeProcessed 四步）
3. 红测真红验证（断言失败 not mock error）
4. 回归覆盖（queued-merge / THIRD coalesce / cross-cat isolation / F216 P1-1 全绿）

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f216/codex`
- Start Command: `pnpm review:start`
- Ports: 由 `review:start` 自动分配（起点 3201/3202）

## 自检证据

### Spec 合规
- AC-D1 ✅: processing 中 target 收到 follow-up → abort + last-wins restart
- AC-D2 ✅: 复用 force-send 坐标系，无 processingSlots mutex race
- AC-D3 ⬜: 真实 runtime 验证（post-review, pre-merge）
- AC-D4 ⬜: feature doc 状态更新（post-merge）

### 测试结果
```
npx node --test packages/api/test/a2a-coalesce.test.js
  tests 21, pass 21, fail 0

pnpm --filter @cat-cafe/api lint (tsc --noEmit)
  zero errors
```

### 相关文档
- Plan: `docs/plans/2026-05-31-f216-c3-supersede-handoff.md`
- Feature: F216 / `docs/features/F216-route-serial-refactor.md` Phase D
- Lesson: LL-064 (invoke-single-cat runtime gap)
