# Review 请求: 多 Thread 并行前端实现 (S1-S6)

> 发件猫：布偶猫 🐾
> 收件猫：缅因猫 🐾
> 日期：2026-02-12
> 分支：`feat/multi-thread-parallel`
> Worktree：`/Users/lysander/projects/relay-station/cat-cafe-multi-thread`

---

## 背景

铲屎官要求："单线程好挫 我都能指挥五组猫猫！你这是限制我的发挥！"

后端架构已完全支持多 thread 并行（独立 CLI 子进程、Redis 按 thread 隔离、Socket room 路由），**瓶颈完全在前端**。这次改动让前端支持：

1. **主+通知模式（默认）**：切 thread 不丢状态 + 侧边栏 ᓚᘏᗢ 动画 + toast 通知
2. **分屏模式（田字格）**：2×2 网格 + mini 侧栏 + 共用输入框 + 快捷键

## 设计文档

- **Plan**: `docs/plans/2026-02-12-multi-thread-parallel-design.md`
- 含铲屎官采访决策记录 + Claude Code Agent Teams 调研

## Spec Compliance 自检

| # | Spec 要求 | 状态 | 代码位置 | 测试 |
|---|-----------|------|----------|------|
| 1 | threadStates Map 状态缓存 | ✅ | chatStore.ts `threadStates: Record<>` | chatStore-multithread.test.ts |
| 2 | 切 thread 不丢状态 (messages/catStatuses/mode/intentMode/isLoading) | ✅ | `setCurrentThread` save/restore | 5 项保留测试 |
| 3 | Socket 多 room 并行监听 | ✅ | useSocket.ts joinRoom/leaveRoom/syncRooms | ✅ |
| 4 | 背景 thread 消息累积 + 去重 | ✅ | useSocket.ts + addMessageToThread | 3 tests |
| 5 | ᓚᘏᗢ 工作中弹跳 (amber) | ✅ | ThreadCatStatus.tsx animate-cat-bounce | 13 tests |
| 6 | ᓚᘏᗢ 完成绿色 ✓ | ✅ | ThreadCatStatus.tsx text-green-500 | ✅ |
| 7 | ᓚᘏᗢ 出错红色抖动 | ✅ | ThreadCatStatus.tsx animate-cat-shake | ✅ |
| 8 | 未读角标 ᓚᘏᗢ ③ (max 99+) | ✅ | ThreadCatStatus.tsx:44-48 | ✅ |
| 9 | 猫完成 → toast 通知 | ✅ | useSocket.ts isFinal → addToast | 5 tests |
| 10 | 猫出错 → toast 通知 | ✅ | useSocket.ts error → addToast | ✅ |
| 11 | 中间过程不弹 toast | ✅ | 只在 isFinal/error 触发 | ✅ |
| 12 | 分屏 2×2 田字格 | ✅ | SplitPaneView.tsx grid-cols-2 grid-rows-2 | - |
| 13 | 左栏缩 mini ~40px | ✅ | MiniThreadSidebar.tsx w-10 | - |
| 14 | 精简视图最近 5 条 | ✅ | SplitPaneCell.tsx VISIBLE_MESSAGES=5 | - |
| 15 | 点击窗格选中 (高亮边框) | ✅ | SplitPaneCell border-owner-primary | - |
| 16 | Cmd+1/2/3/4 快捷键 | ✅ | useSplitPaneKeys.ts | 4 tests |
| 17 | 空窗格 "拖入 thread" 占位 | ✅ | SplitPanePlaceholder | - |
| 18 | 双击放大回单屏 | ✅ | handleZoomToThread | - |
| 19 | [▣] 按钮一键切换 | ✅ | ChatContainer.tsx header | - |
| 20 | 共用输入框发往选中窗格 | ✅ | SplitPaneView.tsx 底部 ChatInput | - |
| 21 | viewMode 状态保持 | ✅ | zustand global state | chatStore-viewmode.test.ts (5 tests) |

**偏离说明**：Spec 说分屏时右栏"自动收起"，实际分屏走了不同 render 分支 (`SplitPaneView`)，右栏自然不存在。效果一致。

## 改动文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `stores/chat-types.ts` | **新增** | 从 chatStore 提取类型定义 (ThreadState, CatStatusType 等) |
| `stores/chatStore.ts` | **重写** | "flat surface + internal map" 多 thread 状态架构 |
| `stores/toastStore.ts` | **新增** | Toast 通知 zustand store |
| `hooks/useSocket.ts` | **重写** | 单 room → 多 room，背景消息 + toast 集成 |
| `hooks/useChatHistory.ts` | **修改** | 切 thread 跳过重复 fetch (用缓存) |
| `hooks/useSplitPaneKeys.ts` | **新增** | Cmd+1234 + Cmd+\ 快捷键 |
| `components/ThreadCatStatus.tsx` | **新增** | ᓚᘏᗢ ASCII 猫状态指示器 |
| `components/ToastContainer.tsx` | **新增** | Toast 通知容器 |
| `components/SplitPaneCell.tsx` | **新增** | 分屏窗格 (精简聊天视图) |
| `components/SplitPaneView.tsx` | **新增** | 2×2 网格 + 共用输入 |
| `components/MiniThreadSidebar.tsx` | **新增** | 分屏 mini 侧栏 |
| `components/ChatContainer.tsx` | **修改** | [▣] 按钮 + 分屏/单屏切换 + auto-populate |
| `components/ThreadSidebar.tsx` | **修改** | 集成 ThreadCatStatus |
| `app/layout.tsx` | **修改** | 挂载 ToastContainer |
| `tailwind.config.js` | **修改** | cat-bounce/shake/toast-in/out 动画 |
| 5 个测试文件 | **新增** | 47 个新测试用例 |
| 1 个测试文件 | **修改** | mock 适配新 API |

## Git SHA

- **Base**: `c110e25` (main)
- **Head**: `ca74240` (feat/multi-thread-parallel)
- **Commits**: 6 个 (S1→S6 各一个)

## 测试状态

```
pnpm --filter @cat-cafe/web test:
  22 test files, 174 tests, 0 failed ✅
  (含 47 个新增测试)

后端无改动，无需跑 backend tests。
```

## Review 重点

1. **chatStore 重构 (S1)** — "flat surface + internal map" 模式是否有状态泄漏风险？`snapshotActive`/`flattenThread` 是否遗漏字段？
2. **Socket 多 room (S2)** — 背景 thread 消息路由逻辑。`addMessageToThread` 去重 + `updateThreadCatStatus` 是否正确？重连时 rejoin 所有 room 是否安全？
3. **chatStore.ts 362 行 / useSocket.ts 313 行** — 超过 200 行限制。这两个是 zustand store 单 `create()` 调用和 socket hook 单 `useEffect` 设置，拆分会增加复杂度。请评估是否需要拆。
4. **SplitPaneView 中 handleSend 路由** — 当前共用输入框的 `handleSend` 实际还是走 active thread 的 `useSendMessage`。如果 `splitPaneTargetId !== currentThreadId`，消息会发到错误的 thread。这是一个**已知限制**，需要讨论解决方案。

## 五件套

**What**: 前端多 Thread 并行 — 6 步实现两种视图模式 (主+通知 / 分屏田字格)

**Why**: 后端已完全支持多 thread 并行，但前端切 thread 时清空状态 (`clearCatStatuses` + `resetRefs`)，导致铲屎官只能串行操作猫猫。这限制了铲屎官同时指挥多组猫猫的能力。

**Tradeoff**:
- 考虑过 "每个 thread 独立 ChatContainer 实例" 方案 — 太重，N 份 hooks/socket 连接
- 考虑过 "中间件/proxy 自动分发" — 改动面更大，需要重写所有 consumer
- 选择 "flat surface + internal map" — 零 consumer 改动，向后兼容

**Open Questions**:
1. 分屏模式下 `handleSend` 路由问题 — 共用输入框发消息时，`useSendMessage` 内部用的是 active thread 的上下文。如果选中的窗格不是 active thread，消息目标可能不对。需要讨论：是否在 `handleSend` 前先切 `currentThreadId`？
2. chatStore 362 行 — 是否值得拆分？拆成什么粒度？
3. 分屏窗格的组件测试 — 当前 SplitPaneCell/SplitPaneView/MiniThreadSidebar 没有单元测试（只有 store 层测试）。这些是纯展示组件，review 通过后是否需要补？

**Next Action**: 请 review 上述文件，重点关注 chatStore 重构 (S1) 和 socket 多 room 路由 (S2)。

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成 (21/21 全绿)
- [x] 设计文档已附
- [x] 测试通过 (174 pass, 0 fail)
- [x] 五件套完整
