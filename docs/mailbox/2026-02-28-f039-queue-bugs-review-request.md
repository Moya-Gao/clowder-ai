---
feature_ids: [F039]
debt_ids: []
topics: [review, queue, bugfix]
doc_kind: review-request
created: 2026-02-28
---

## Review 请求: F039 队列 Bug 修复（F5 刷新 + 图片指示器）

### 背景

铲屎官 2026-02-27 在使用队列功能时发现 2 个 bug：
1. F5 刷新后队列消息状态丢失（显示为已发送）
2. 队列 UI 不显示图片附件

### 铲屎官原始需求

- 来源：铲屎官 2026-02-27 截图 + 口头报告
- **原始需求摘录**：
  > "消息队列里面的，然后我 f5 一下他竟然直接发出去了？还是前端展示发出去了？"
  > "队列里没有图片！"
- 核心痛点：队列状态不持久（刷新丢失），队列预览信息不完整（无图片）
- 请 Reviewer 对照：修复后 F5 刷新是否正确恢复队列？图片是否有可见指示？

### 设计文档

- Feature: `docs/features/F039-message-queue-delivery.md`（已知 Bug 章节）
- 无 ADR（bugfix，无架构变更）

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | F5 刷新后 queue 恢复 | ✅ | useChatHistory fetchQueue |
| 2 | paused 状态也恢复 | ✅ | setQueuePaused on paused=true |
| 3 | 空 queue 不 set state | ✅ | guard 条件 |
| 4 | 图片计数显示 | ✅ | messageId → contentBlocks lookup |
| 5 | 无图时无指示器 | ✅ | conditional render |
| 6 | 后端 contentBlocks 传递 | ⚠️ | 已记录，不在本次范围 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/hooks/useChatHistory.ts` | 修改 | 加 fetchQueue 回调 + 在 useEffect 中调用 |
| `packages/web/src/components/QueuePanel.tsx` | 修改 | 读 messages 查 contentBlocks + imageCount 渲染 |
| `packages/web/src/hooks/__tests__/useChatHistory-queue.test.ts` | 新增 | 3 个 queue hydration 测试 |
| `packages/web/src/components/__tests__/queue-panel-images.test.ts` | 新增 | 5 个图片指示器测试 |
| `docs/features/F039-message-queue-delivery.md` | 修改 | 更新 bug 修复状态 + 记录后端遗留 |

### Git SHA

- Base: `fff3319` (main)
- Head: `bbd8049` (fix/f039-queue-bugs)

### 测试状态

```
Web: 546 passed, 0 failed (86 test files)
API: ~2632 passed, 1 failed (pre-existing duplicate test name issue)
```

### Review 重点

1. **fetchQueue 的 abort/stale 防护**：是否正确处理 thread 切换时的竞态？
2. **imageCount 性能**：`messages.find()` 在大消息列表时是否需要优化？
3. **后端遗留的严重性**：QueueProcessor 不传 contentBlocks 的影响评估

### 五件套

**What**:
- Bug 1: useChatHistory 新增 fetchQueue，mount 时调 GET /api/threads/:id/queue 恢复 queue + paused 状态
- Bug 2: QueuePanel 通过 entry.messageId 查找关联消息，显示图片计数指示器

**Why**:
- F5 刷新后 Zustand store 重置，queue 状态只靠 WS 事件维护，没有初始化请求
- QueueEntry 接口只有 content string，但关联消息有 contentBlocks

**Tradeoff**:
- Bug 2 选了前端 lookup（通过 messageId 查 messages 数组）而非扩展 QueueEntry 接口
  - 原因：扩展接口需要改后端 enqueue 逻辑 + QueueProcessor + WS 事件，改动范围大
  - 缺点：messages 数组大时 find() 效率低（O(n)），但队列场景消息量有限

**Open Questions**:
- 后端 QueueProcessor 不传 contentBlocks → 猫猫实际看不到排队消息的图片，需要单独修复
- queue GET 端点不返回 pauseReason，刷新后只知道 paused 但不知道原因

**Next Action**: 请 review 上述 5 个文件
