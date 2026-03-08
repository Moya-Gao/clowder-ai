# Review Request: F069 Thread Read State (Unread Badge Persistence)

## What

F5 刷新后未读 badge 消失的完整修复。新增后端 `ThreadReadStateStore`（Redis Hash），per-user/per-thread 已读游标，前端刷新时从 API 恢复未读状态。

核心变更：
1. **Port + Redis keys**: `IThreadReadStateStore` 接口 + `ReadStateKeys`
2. **Redis 实现**: `RedisThreadReadStateStore` — monotonic ack、unread summaries、SCAN cleanup
3. **Factory + DI**: `createReadStateStore(redis?)` + 注入 `threadsRoutes`
4. **API routes**: `GET /api/threads` hydrate `unreadCount`/`hasUserMention`; `PATCH /api/threads/:id/read` ack endpoint; cascade delete
5. **Frontend**: `initThreadUnread()` action + ThreadSidebar 恢复 + ChatContainer fire-and-forget ack

5 commits on `feat/f069-thread-read-state`, worktree at `cat-cafe-f069-thread-read-state`.

## Why

铲屎官报 bug：F5 后未读 badge 全部清零。根因是 `unreadCount`/`hasUserMention` 纯前端内存状态，无后端持久化。三猫（Opus + 2x Codex）讨论后共识：后端真相源，否决 localStorage 和复用 DeliveryCursorStore。

## Original Requirements

> 铲屎官原话：
> "这里有点小 bug 我一按 f5 没读过的消息也都消失了...这是 bug 还是 feature？？"
> "我不喜欢不完美的方案你们有什么看法？"
> "走起！不要老问我！自己完成全流程闭环！"

- 来源：Thread `thread_mm4dj9jp0tij0ch3`（2026-03-06）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 方案 | 否决原因 |
|------|----------|
| localStorage | 跨标签/跨设备不一致，不可审计 |
| 复用 DeliveryCursorStore | 语义不匹配（投递游标 + 7 天 TTL），生命周期不对 |
| N+1 优化（Redis pipeline） | MVP 先逐线程查询，线程数 <100 性能可接受，后续可优化 |

## Open Questions

1. **N+1 查询**: `getUnreadSummaries` 逐线程调用 `messageStore.getByThreadAfter`，线程多时可能慢。MVP 可接受，后续可用 pipeline 或缓存摘要优化。
2. **多标签页实时同步**: 当前只在刷新时恢复，未通过 WebSocket 推送 ack 同步。铲屎官 AC 只要求"另一个刷新也能看到"，满足。
3. **monotonic ack 用字符串比较**: 依赖 `generateSortableId()` 的 zero-padded 时间戳格式。请确认这个假设是否安全。

## Next Action

请 review 代码质量、架构合理性、以及是否完整解决铲屎官的问题。

## 自检证据

### Spec 合规
- AC1 F5 刷新后未读恢复: `GET /api/threads` hydrate + `initThreadUnread`
- AC2 打开线程 ack: ChatContainer `PATCH /api/threads/:id/read` fire-and-forget
- AC3 多标签页: 服务端真相源，刷新即恢复
- AC4 单调性: `messageId <= existing` 拒绝回退
- AC5 线程删除清理: cascade delete 中 `readStateStore.deleteByThread(id)`
- AC6 不影响 DeliveryCursorStore: 完全独立的 store/key/factory

### 测试结果
```
pnpm --filter @cat-cafe/api test        # 2896 passed, 5 failed (pre-existing)
pnpm --filter @cat-cafe/api test:redis  # 12 new read-state tests passed
pnpm --filter @cat-cafe/web test        # 749 passed, 0 failed
pnpm -r --if-present run build          # clean
pnpm check                              # 0 errors
```

### 相关文档
- Feature: `docs/features/F069-thread-read-state.md`
- Plan: `docs/plans/2026-03-06-f069-thread-read-state.md`
- 讨论: Thread `thread_mm4dj9jp0tij0ch3`
