# Review Request: F095 Phase D — 软删除 + 回收站

## What

Thread 删除从硬删除改为软删除（设 `deletedAt` 时间戳），新增回收站 UI 和恢复功能。

核心变更（7 文件, +346/-64）：
- **ThreadStore + RedisThreadStore**: 新增 `softDelete()`, `restore()`, `listDeleted()` 方法
- **routes/threads.ts**: DELETE → softDelete（不再级联删除），新增 POST restore 端点，GET 支持 `?deleted=true`
- **ThreadSidebar.tsx**: 底部回收站折叠区 + 恢复按钮，删除确认弹窗文案更新为"移入回收站"
- **chat-types.ts**: Thread interface 新增 `deletedAt?: number | null`

## Why

铲屎官误删 `thread_mmlv4v2oq6dxefr6`（73 条消息，cross-thread-sync 教训 thread），无法恢复。
Phase C hotfix（PR #378）加了确认弹窗 + 审计事件，但确认弹窗是**脚手架**。
家规 P1 要求终态基座——软删除 + 回收站才是终态。

## Original Requirements（必填）
> "你别只是 hotfix，你得把你的后续的软删除加回收站的这个功能也在你的这个 F095 里面整一下，然后把它排在你这个现在这个合入之后实现"
> "thread_mmlv4v2oq6dxefr6 cross-thread-sync 教训不知道为什么删除了 也不知道who删除了！！这是因为我们没有做删除保护！也恢复不回来了"
- 来源：铲屎官 2026-03-11 语音消息 + thread 聊天记录
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **AC-D6（30天自动清理）延后**：需要 cron/定时任务基建，当前无此机制。软删除数据不会无限增长（LRU 淘汰仍在），后续加 cron 是扩展不是重写。
- **软删除时不级联清除关联数据**：messages/tasks/memory 保留以支持恢复。物理删除时才清除（future purge endpoint）。

## Open Questions

1. 回收站 UI 目前是最简实现（文字列表 + 恢复按钮），是否需要更丰富的交互？（如：显示删除时间、删除者、批量恢复）
2. RedisThreadStore.restore() 当前用 `hset deletedAt '0'` 清除（因为 Redis hash 不区分 null/0）。是否需要改为 `hdel deletedAt`？

## Next Action

请 review 代码质量、软删除/恢复的边界处理、前端 UX 合理性。

## 自检证据

### Spec 合规
- AC-D1~D5, D7: ✅ 全覆盖
- AC-D6: ⏳ 延后（cron 扩展）
- R10/R11: ✅

### 测试结果
```
node --test threads-endpoint.test.js   # 48 passed, 0 failed ✅
vitest run (thread tests)              # 39 passed, 0 failed ✅
pnpm lint                              # 0 errors ✅
pnpm -r --if-present run build         # exit 0 ✅
```

20 个 web test 失败为 pre-existing（chat-container-intent-loading, mode-switch-proposal 等，main 上也失败）。

### 相关文档
- Feature: `docs/features/F095-sidebar-collapse-memory.md` Phase D
- Commit: `e4c7fe07` on `feat/f095-phase-d-soft-delete`
