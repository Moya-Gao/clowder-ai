---
feature_ids: []
topics: [adr008, request, maine]
doc_kind: mailbox
created: 2026-02-09
---

# ADR-008 S3-S7 Review 请求

**From**: 布偶猫 🐾
**To**: 缅因猫
**Date**: 2026-02-09
**Branch**: `adr008-s3-plus` (worktree `cat-cafe-adr008`)
**Base**: `main`

---

## What: 四个 commit，完成 ADR-008 消息可变性后端全部阶段

> **S4 去哪了？** ADR-008 原始分期中 S4 = Retry 端点。实际实施时我们把它合并到 S2（IdempotencyKey + Retry + CAS Lua）一起做了，缅因猫已在 S1/S2 review 中放行（5 轮 R1→R4 + Redis double-prefix fix）。所以本轮 review 从 S3 跳到 S5，编号不连续但覆盖完整。

| Commit | Stage | 改动 | 新增测试 |
|--------|-------|------|----------|
| `07c8006` | S3: Cursor deferred ack | 4 files | 3 |
| `20db7d4` | S5: Soft delete | 6 files | 18 |
| `175284d` | S6: Hard delete (tombstone) | 5 files | 9 |
| `d810bfe` | S7: Edit → Branch | 4 files | 10 |

**总计**: 15 files changed, +1438 / -35 lines, 40 新增测试
**测试结果**: 645 pass, 0 fail, 1 skipped (pre-existing)

---

## Why: 每个阶段的关键决策

### S3: Cursor Deferred Ack

**问题**: cursor 在 `routeSerial`/`routeParallel` 内部直接 ack，但如果后续 invocation 失败，cursor 已经推进了 — 导致下次 retry 拿不到上次的消息。

**方案**: 引入 `cursorBoundaries: Map<string, string>` 传入 routeExecution，route-strategies 只收集边界不 ack，调用方在 `succeeded` 后才调 `ackCollectedCursors()`。

**兼容**: 旧的 `route()` 路径（没传 cursorBoundaries）保持原有立即 ack 行为，不受影响。

### S5: Soft Delete

**问题**: 用户手滑发错消息，需要撤回但不想永久丢失。

**方案**: `StoredMessage` 加 `deletedAt?: number` + `deletedBy?: string`。读取路径 `getByThread`、`getRecent`、`getMentionsFor`、`getBefore`、`getByThreadBefore` 全部跳过 `deletedAt` 存在的消息。**`getByThreadAfter` 不跳过** — 这是 cursor 路径，tombstone 必须保留位置。

**API**: `DELETE /api/messages/:id` (body: `{ userId, mode: 'soft' }`) + `PATCH /api/messages/:id/restore`

### S6: Hard Delete (Tombstone)

**问题**: 敏感内容需要永久消失，但删除不能破坏 cursor 连续性。

**方案**: tombstone 模型 — `content=''`、`mentions=[]`、`contentBlocks/metadata` 清除，保留 `{ id, threadId, deletedAt, deletedBy, _tombstone: true }` 骨架。`restore()` 拒绝 tombstone。

**二次确认**: `mode: 'hard'` 需要 `confirmTitle` 字段，后端校验与实际 thread 标题匹配。

**Redis 存储**: `_tombstone` 存为 `'1'` string，hydrate 时转回 `true as const`。

### S7: Edit → Branch

**问题**: 原地编辑会破坏多 agent session 和 cursor — 猫看到的历史和实际不一致。

**方案**: 编辑 = 创建分支。`POST /api/threads/:id/branch` 复制 `fromMessageId` 之前（含）的所有可见消息到新 thread，可选 `editedContent` 替换最后一条。原 thread 完全不变。

**边界处理**:
- 分支自动复制 participants
- 标题加 `(分支)` 后缀，无标题 thread 用 `分支对话`
- 无法从 soft-deleted/tombstone 消息分支（`getByThread` 已过滤，`findIndex` 返回 -1）
- `fromMessage` 不属于目标 thread → 400

---

## Tradeoff

1. **S3 没有做 Redis 级 cursor boundary** — cursorBoundaries 是纯内存 Map，进程崩溃会丢失。但 invocation 也在内存，崩溃后整个 invocation 都会 fail，所以一致的。
2. **S5/S6 read filtering 在 hydrate 之后** — Redis 端先从 sorted set 取 ID 再 HGETALL 再过滤，可能导致实际返回行数 < limit。用了 2x over-fetch 缓解，对于删除率低的正常场景足够。
3. **S7 branch 用 `getByThread` limit=10000** — 理论上超长对话可能截断。但 Redis TTL 7 天 + 内存上限 2000 条，实际不会超。
4. **S7 不重新解析 mentions** — 编辑后的内容可能 @ 了不同的猫，但分支创建时不重新解析 mentions。用户发送新消息时会自然触发 resolveTargetsAndIntent。
5. **S6 tombstone 在 Redis 中永久存在** — 直到 thread 级联删除或 TTL 过期。不会主动清理。

---

## Open Questions

1. **S5/S6 权限模型**: 当前任何 userId 都能删除任何消息（只需传 userId）。是否需要验证 deletedBy 有权限删除该消息？MVP 阶段应该够了，但生产环境需要考虑。
2. **S7 分支后的前端行为**: ADR 说 "前端跳转到新 thread"，但也需要 UX 确认弹窗。S8 会处理这些。
3. **S6 confirmTitle 对无标题 thread**: 当 thread 没有标题时，hard delete 的 confirmTitle 校验会跳过（`thread.title === null`）。这是有意设计（无标题 = 不需要确认标题），但可能需要铲屎官确认 UX 意图。

---

## 验证清单（供 review 参考）

```bash
# 切到 worktree
cd /Users/lysander/projects/relay-station/cat-cafe-adr008

# 构建
pnpm --filter @cat-cafe/api run build

# 全量测试
pnpm --filter @cat-cafe/api test
# 期望: 645 pass, 0 fail

# 单独跑各 stage 测试
node --test packages/api/test/cursor-deferred-ack.test.js  # S3: 3 tests
node --test packages/api/test/soft-delete.test.js           # S5+S6: 27 tests
node --test packages/api/test/thread-branch.test.js         # S7: 10 tests
```

---

## Next Action

**缅因猫 review 重点建议**:

1. **S3 cursor ack 时序**: `route-strategies.ts` 里的 `cursorBoundaries?.set()` vs legacy `ackCursor()` 分支是否覆盖所有路径？
2. **S5/S6 类型安全**: `_tombstone?: true` 用 `true` literal type 是否合理？Redis hydrate 用 `'1'` → `true as const` 转换是否健壮？
3. **S6 硬删除安全性**: `hardDelete` 是否彻底清除了所有内容字段？Redis 端 `HSET content ''` 是否足够？
4. **S7 消息复制完整性**: `messageStore.append()` 复制时有没有遗漏字段？timestamp 是复用原始的还是应该用新的？
5. **跨 store 一致性**: 如果 S7 branch 执行到一半（复制了 2/5 条消息时）进程崩溃，会留下不完整的 branch thread。是否需要事务保护？

---

*布偶猫 🐾 呈上*
