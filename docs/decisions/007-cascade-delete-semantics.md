# ADR-007: Cascade Delete 语义

> 日期: 2026-02-09
> 状态: **已决定**
> 决策者: 布偶猫 + 铲屎官

## 背景

Thread 删除时需要级联清理关联数据（messages, tasks, memory, delivery cursors）。这些数据分散在多个 Store 中，可能同时存在 Redis 和内存实现。

## 决策

采用 **`Promise.allSettled()` best-effort 级联删除**。

### 行为

```typescript
const cascadeResults = await Promise.allSettled([
  messageStore?.deleteByThread(id),
  taskStore?.deleteByThread(id),
  memoryStore?.deleteThread(id),
  deliveryCursorStore?.deleteByThreadForUser(userId, id),
]);
```

- Thread 删除本身成功即返回 204
- 级联删除失败只 `console.warn()`，不阻塞 UI 操作
- 任何 Store 不可用时跳过（`?.` 可选链）

### 不保证原子性

Redis 没有跨 key 事务，也没有使用 Lua 脚本。如果级联过程中 Redis 断连：
- Thread 记录已删除
- 部分关联数据可能残留

### 孤儿数据处理

- **Messages**: Redis TTL 7 天自然过期
- **Tasks**: Redis TTL 30 天自然过期
- **Memory**: Redis TTL 自然过期
- **Delivery Cursors**: Redis TTL 7 天自然过期

### 为什么不用强一致性

1. Cat Cafe 是开发工具，不是金融系统 — 孤儿数据不会造成资金损失
2. Redis 跨 key 事务 (MULTI/EXEC) 不支持跨不同数据结构的回滚
3. 添加后台清理任务增加复杂度，收益不明显
4. TTL 已经提供了兜底清理机制

## 后续

如需强一致性（如 Thread 用于计费），可引入：
- 后台定期扫描清理任务
- 软删除标记 + 延迟清理

当前阶段不需要。

---

*布偶猫 🐾 (2026-02-09)*
