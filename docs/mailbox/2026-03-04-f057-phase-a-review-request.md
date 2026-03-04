# Review Request: F057 Phase A — Thread 排序 + 搜索增强

## What

F057 Phase A 前端改动：Thread 侧边栏按活跃度排序 + 未读优先 + 搜索支持 thread ID。

核心变更（3 文件）：
1. **`thread-utils.ts`**: 新增 `sortByUnreadThenActive` comparator；`sortAndGroupThreads` 改为 `lastActiveAt` 降序 + 可选 `unreadIds` 优先；`groupByProject` 传透排序
2. **`thread-utils.test.ts`**: 更新 2 个旧测试（pinnedAt→lastActiveAt）+ 新增 5 个测试（unread priority x3, project sort, backward compat）
3. **`ThreadSidebar.tsx`**: 构建 `unreadIds` Set + 传入排序；搜索加 `threadId` 匹配；placeholder 更新

附带 Pencil 设计：砚砚 Postmark v2 (`i4Umv`) — 来源邮戳微调（F057 B2 预演）。

## Why

铲屎官 2026-03-04 实测 F052 跨线程消息后发现：thread 太多找不到活跃的；搜不到 thread ID；猫猫也没有 list_threads 工具。Phase A 先解决排序和搜索，Phase B/C 后续做 badge 增强和 MCP 工具。

## Original Requirements（必填）

> "现在 thread 太多了！希望活跃的 thread 自己跑到前面"
> "比如置顶的 有猫猫回复我 他也要能跳到上面去"
> "好像未读要在前面？"
> "通过 thread id 搜索？不然我找不到！"

- 来源：F057 spec `docs/features/F057-thread-discoverability.md`（铲屎官原话记录于 spec "铲屎官原话" 段落）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 排序改为 `lastActiveAt` 后，原来 pinned 按 `pinnedAt` 排序的行为变了——置顶区里也是最近有消息的在前面。这是 spec 要求的（"置顶的有猫猫回复也要跳到上面"）。
- 搜索做在前端（filter 已加载的 thread list），因为 thread 数量 < 100，不需要后端搜索（KD-2）。

## Open Questions

1. `unreadIds` 是从 `getThreadState(threadId).unreadCount` 构建的——请确认 `getThreadState` 的引用稳定性对 useMemo 的依赖是否正确
2. `sortByUnreadThenActive` 的排序权重：未读 > 已读，同组内再按 lastActiveAt。这是否符合直觉？
3. Pencil 微调（Postmark v2）的来源邮戳改为 `📮 mm72eyvc · F052 跨线程调度测试`——设计语言是否和砚砚 v1 一致？

## Next Action

请 review 代码改动 + Pencil 设计微调，给出 P1/P2 分级反馈。

## 自检证据

### Spec 合规

| AC | 状态 | 验证 |
|----|------|------|
| AC-A1: 置顶按 lastActiveAt | ✅ | 单元测试 |
| AC-A2: 非置顶按 lastActiveAt | ✅ | 单元测试 |
| AC-A3: 未读优先 | ✅ | 4 个单元测试 |
| 搜索支持 thread ID | ✅ | build 通过 |

### 测试结果

```
pnpm vitest run thread-utils.test.ts   # 27/27 passed, 0 failed ✅
pnpm build (packages/web)               # Compiled successfully ✅
pnpm lint (packages/web)                 # 0 errors in changed files ✅
```

### 相关文档

- Feature: `docs/features/F057-thread-discoverability.md`
- Plan: `docs/plans/2026-03-04-f057-thread-discoverability-phase-a.md`
- Design: Pencil `designs/猫粮看板—猫爪导航.pen` frame `i4Umv`
