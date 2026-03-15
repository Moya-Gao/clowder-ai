---
feature_ids: [F121]
related_features: [F095, F057]
topics: [frontend, ux, sidebar, collapse-state]
doc_kind: bug-report
created: 2026-03-14
status: fixed-awaiting-review
---

# Bug Report: F121 置顶分组在新回复到达时自动展开

## Bug 诊断胶囊

| 栏位 | 内容 |
|------|------|
| **1. 现象** | 铲屎官把当前 thread 所在的 `置顶` 分组手动折叠后，只要这个 thread 收到新回复，`置顶` 会“biu”一下自己展开，打断阅读。期望：分组保持用户手动折叠状态；实际：收到新消息后被强制展开。 |
| **2. 证据** | 2026-03-14 17:53 铲屎官反馈：“如果有人回消息，置顶那一栏会 'biu' 一下突然展开。” 浏览器实测：当前 thread 置顶并折叠 `置顶` 后，发送 `只回复 ok`，修复前会被自动展开；修复后保持折叠。 |
| **3. 根因** | `useCollapseState()` 的 auto-expand effect 依赖 `[currentThreadId, threadGroups]`。当前 thread 没切换时，只要新消息导致 `threadGroups` 重算，effect 就会再次按 `currentThreadId` 找到该分组并删除 collapsed key，覆盖用户手动折叠。 |
| **4. 诊断策略** | 先看 F095/F121 同区域代码，定位到 `use-collapse-state.ts` 的 auto-expand effect；然后补 hook 级失败测试，验证“仅 `threadGroups` 变化、`currentThreadId` 不变”时被错误展开。 |
| **5. 超时策略** | 如果 hook 测试不能稳定复现，就回到浏览器加诊断桩，直接观察 `threadGroups` 变化和 collapsed set 的写入。 |
| **6. 预警策略** | 如果修复要求改动 group 排序、`findGroupKeyForThread()` 或 socket unread 流程，说明方向跑偏；这次 bug 应只收敛在 auto-expand 的触发条件，不该触碰 group 归属判定。 |
| **7. 用户可见交互修正** | 当前 thread 所在分组只在“切换到该 thread”的那一刻自动展开一次；之后用户手动折叠了，就算有新消息、未读数、排序变化，也不再把分组强行弹开。 |
| **8. 验收** | 失败测试：`use-collapse-state-hook.test.ts` 新增 case。手工验证：置顶当前 thread → 折叠 `置顶` → 发一条最小消息并等猫回复 → `置顶` 保持折叠。回归验证：原有 `use-collapse-state.test.ts` 全绿。 |

## 1. 报告人

- **谁**：铲屎官（Landy）
- **时间**：2026-03-14 17:53 PDT
- **发现方式**：runtime 实际使用中观察到 sidebar 视觉跳变

## 2. 复现步骤

1. 选中一个已经置顶的 thread，让它成为当前 active thread。
2. 手动折叠 `置顶` 分组。
3. 在该 thread 内等待猫回复，或自己发送一条消息触发新回复。
4. 观察 sidebar。

**期望**
- `置顶` 继续保持折叠。
- 当前 thread 仍然打开在聊天面板里，但 sidebar 不抢焦点。

**实际**
- `置顶` 分组在新消息到达后自动展开。
- 用户刚手动建立的阅读状态被 UI 抢走。

## 3. 根因分析

根因在 [use-collapse-state.ts](/Users/lysander/projects/relay-station/cat-cafe-f121-pinned-expand/packages/web/src/components/ThreadSidebar/use-collapse-state.ts)：

- F095 的设计里，“切换到当前 thread 时自动展开其所在分组”本身是对的。
- 但实现把 effect 依赖写成了 `[currentThreadId, threadGroups]`。
- 于是只要 thread 的 `lastActiveAt`、未读、排序等变化触发 `threadGroups` 重算，effect 就会在 **没有切线程** 的情况下再次运行。
- effect 会基于同一个 `currentThreadId` 找到所属分组，并从 collapsed set 中删除它，等价于把用户手动折叠的组再次强制展开。

这不是：

- `findGroupKeyForThread()` 选错组（那是 clowder-ai#89）。
- `recent` / `pinned` 排序问题。
- socket 或 unread 真相源错误。

这是一个更直接的 **effect 触发条件过宽**。

## 4. 修复方案

修复只收紧 auto-expand 的触发条件，不改 group 归属逻辑：

1. 在 `useCollapseState()` 中新增 `lastAutoExpandedThreadId` ref。
2. 当 effect 检测到“当前 thread 已经为这个 threadId 自动展开过”时直接 early return。
3. 只有真正发生 thread 切换，或初始化后首次拿到当前 thread 所在 group 时，才执行 auto-expand。

这样保留了 F095 原始需求：

- 切到某个 thread 时，它所在分组会自动展开一次。

同时消除了这次 bug：

- 后续只是 `threadGroups` 重算，不会再覆盖用户手动折叠状态。

## 5. 验证方式

### 自动化

- `pnpm --filter @cat-cafe/web test -- src/components/__tests__/use-collapse-state-hook.test.ts`
  - 新增 case 先红后绿：`does not re-expand the same group when only threadGroups change`
- `pnpm --filter @cat-cafe/web test -- src/components/__tests__/use-collapse-state.test.ts`
  - 22/22 通过
- `cd packages/web && pnpm exec next lint --file src/components/ThreadSidebar/use-collapse-state.ts --file src/components/__tests__/use-collapse-state-hook.test.ts --file src/components/__tests__/use-collapse-state.test.ts`
  - 0 warning / 0 error

### 浏览器实测

开发环境：worktree `fix/f121-pinned-expand`，Web `3000`，API `3102`，Redis `6398`

1. 将 `codex Review Inbox` 置顶并切到该 thread。
2. 手动折叠 `置顶`。
3. 发送最小消息：`只回复 ok`。
4. 等待缅因猫回复 `ok`。

**结果**：
- 发送后 `置顶` 没有自动展开。
- 回复到达后 `置顶` 仍保持折叠。

## Links

- Feature: [F121-community-frontend-ux-triage.md](/Users/lysander/projects/relay-station/cat-cafe-f121-pinned-expand/docs/features/F121-community-frontend-ux-triage.md)
- Related feature: [F095-sidebar-collapse-memory.md](/Users/lysander/projects/relay-station/cat-cafe-f121-pinned-expand/docs/features/F095-sidebar-collapse-memory.md)
- Related community issue: <https://github.com/zts212653/clowder-ai/issues/89> (同区域、不同触发条件)
