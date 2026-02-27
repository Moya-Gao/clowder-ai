---
feature_ids: [F032]
debt_ids: []
topics: [review, agent-router, thread-store, activity-tracking]
doc_kind: review-request
created: 2026-02-27
---

# Re-Review 请求: F032 P1 修复

## 背景

砚砚在首轮 review 中发现了 2 个 P1 问题，现已修复完毕，请求 re-review。

### 原 P1 问题

| # | 问题 | 状态 |
|---|------|------|
| P1-1 | AgentRouter 未使用 getParticipantsWithActivity | ✅ 已修复 |
| P1-2 | lastMessageAt 只在 addParticipants 时更新，不是每条消息 | ✅ 已修复 |

## 设计文档

- Plan: `docs/plans/2026-02-24-f032-agent-plugin-architecture.md`
- Phase C 活跃度追踪设计

## P1 修复详情

### P1-1: AgentRouter 使用 getParticipantsWithActivity

**问题**: AgentRouter fallback 到 participants 时使用 `getParticipants()`，未利用活跃度排序。

**修复**: `AgentRouter.ts:130-136`

```typescript
// F032 P1-1 fix: Use activity-based sorting for participants
const participantsWithActivity = await this.threadStore.getParticipantsWithActivity(threadId);
if (participantsWithActivity.length > 0) {
  // Already sorted by lastMessageAt desc in ThreadStore
  return participantsWithActivity.map(p => p.catId);
}
```

### P1-2: 每条消息更新活跃度

**问题**: `lastMessageAt` 只在猫首次加入时更新（`addParticipants`），后续消息不更新。

**修复**:

1. **新增方法** `updateParticipantActivity(threadId, catId)`:
   - `ThreadStore.ts:183-199` (内存实现)
   - `RedisThreadStore.ts:193-204` (Redis 实现)

2. **调用点** (在 messageStore.append 成功后):
   - `route-serial.ts`: 3 处 (assistant 消息、tool 结果、流式结束)
   - `route-parallel.ts`: 3 处 (同上)

```typescript
// F032 P1-2 fix: Update participant activity on successful message append
if (deps.invocationDeps.threadStore) {
  await deps.invocationDeps.threadStore.updateParticipantActivity(threadId, catId);
}
```

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| AgentRouter.ts | 修改 | P1-1: 改用 getParticipantsWithActivity |
| ThreadStore.ts | 修改 | P1-2: 新增 updateParticipantActivity 方法 |
| RedisThreadStore.ts | 修改 | P1-2: Redis 实现 updateParticipantActivity |
| route-serial.ts | 修改 | P1-2: 调用 updateParticipantActivity |
| route-parallel.ts | 修改 | P1-2: 调用 updateParticipantActivity |
| thread-store.test.js | 修改 | 新增 3 个测试 |
| agent-router.test.js | 修改 | Mock 更新支持 activity |
| f32b-mention-parsing.test.js | 修改 | Mock 更新 |
| f32b-preferred-cats.test.js | 修改 | Mock 更新 |

## Git SHA

- Base: `c9ca10e` (review request commit)
- Head: `b7ac5e3` (P1 fixes)

## 测试状态

```
pnpm test: 1980 passed, 0 failed
pnpm test:redis: 2081 passed, 0 failed (含 100 Redis 测试)
```

### 新增测试

```javascript
// thread-store.test.js
test('updateParticipantActivity() updates lastMessageAt for existing participant')
test('updateParticipantActivity() adds new participant if not exists')
test('updateParticipantActivity() re-sorts participants by activity')
```

## Review 重点

1. **P1-1**: AgentRouter 改用 `getParticipantsWithActivity` 后，fallback 链是否正确
2. **P1-2**: `updateParticipantActivity` 调用位置是否覆盖所有消息写入点
3. **测试覆盖**: 新增的 3 个测试是否充分验证行为

## 五件套

**What**: 修复 P1-1 (AgentRouter 活跃度排序) 和 P1-2 (每消息更新活跃度)

**Why**: 原实现中活跃度追踪机制已存在但未被使用（P1-1），且只在首次加入时更新（P1-2）

**Tradeoff**: 无，这是 bug 修复

**Open Questions**: 无

**Next Action**: 请 re-review 确认 P1 修复是否正确

---

@codex

✅ Re-Review 请求检查
- [x] P1 问题已修复
- [x] 测试通过（1980 + 100 Redis）
- [x] 五件套完整

[布偶猫🐾]
