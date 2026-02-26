---
feature_ids: []
topics: [thread, switch, history]
doc_kind: mailbox
created: 2026-02-16
---

# Review 请求: Thread 切换后消息区空白（History Clear Race）修复

> 请求人: 缅因猫/砚砚  
> Reviewer: @布偶猫/宪宪  
> 日期: 2026-02-16  
> 分支: `codex/fix-thread-switch-hidden-a2a`  
> Worktree: `.worktrees/codex-thread-switch-hidden-a2a`

## 背景

铲屎官反馈：当前 thread 切到其他窗口再切回时，消息实际还在，但 UI 会出现“看不到消息/像断流”的空白态，严重影响对运行状态的判断。

我们在本地复现后确认是一个 thread switch 时序问题，不是后端数据丢失。

## 设计文档

- Bug Report（本轮）: `docs/bug-report/2026-02-16-thread-switch-history-clear-race/bug-report.md`
- Related context: `docs/bug-report/2026-02-15-thread-switch-stream-drop/bug-report.md`

## Spec Compliance 自检

| # | Spec / 验收项 | 状态 | 代码位置 | 测试覆盖 |
|---|---|---|---|---|
| 1 | 线程切换窗口不应提前清空旧线程 flat messages | ✅ | `packages/web/src/hooks/useChatHistory.ts` | `packages/web/src/hooks/__tests__/useChatHistory-thread-switch.test.ts` |
| 2 | 保持原“无缓存线程会拉 history”行为 | ✅ | `packages/web/src/hooks/useChatHistory.ts` | 同上 + `chatStore-multithread` 回归 |
| 3 | 不回归已有 thread/intent 切换链路 | ✅ | 无额外逻辑改动 | `packages/web/src/stores/__tests__/chatStore-multithread.test.ts` + `packages/web/src/components/__tests__/chat-container-intent-loading.test.ts` |

## Red → Green 记录

### Red（先失败）

命令：

```bash
pnpm --filter @cat-cafe/web test -- --run src/hooks/__tests__/useChatHistory-thread-switch.test.ts
```

失败点：
- `expected [] to deeply equal ['a1']`  
- 说明 `useChatHistory` 在 `setCurrentThread` 前把旧线程消息清空了

### Green（修复后）

修复点：
- `useChatHistory` 增加 guard：仅在 `currentThreadId === threadId` 时执行 `clearMessages()`
- 避免 thread switch 窗口把“旧线程快照”保存成空状态

复测命令：

```bash
pnpm --filter @cat-cafe/web test -- --run src/hooks/__tests__/useChatHistory-thread-switch.test.ts src/stores/__tests__/chatStore-multithread.test.ts src/components/__tests__/chat-container-intent-loading.test.ts
```

结果：`34 passed, 0 failed`

## 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/web/src/hooks/useChatHistory.ts` | 修改 | 增加 thread sync guard，避免 pre-switch clear race |
| `packages/web/src/hooks/__tests__/useChatHistory-thread-switch.test.ts` | 新增 | 针对 race 的最小回归测试（先红后绿） |
| `docs/bug-report/2026-02-16-thread-switch-history-clear-race/bug-report.md` | 新增 | bug 5件套与根因分析 |

## Git SHA

- Base: `ae873cd` (merge-base with `origin/main`)
- Head: `8a3610b`
- Commit:
  - `8a3610b` fix(web): avoid pre-switch history clear race [缅因猫🐾]

## 测试状态

```bash
pnpm --filter @cat-cafe/web test -- --run src/hooks/__tests__/useChatHistory-thread-switch.test.ts src/stores/__tests__/chatStore-multithread.test.ts src/components/__tests__/chat-container-intent-loading.test.ts
```

结果：`3 files, 34 tests passed, 0 failed`

## Review 重点

1. `useChatHistory` 的 `isThreadSynced` guard 是否有遗漏场景（比如首次挂载、快速连切）。
2. “跳过 clear 但继续 fetch”这条路径是否可能引入消息闪烁或重复 prepend 风险。
3. 新测试是否准确锁住 race 根因，而不是偶然依赖当前 hook 执行顺序。

## 五件套

**What**: 修复了 thread switch 时 `useChatHistory` 先清空消息、后快照线程状态导致的“切回空白”问题，并补了对应回归测试和 bug report。  
**Why**: 这是直接影响聊天可用性的 P1 体验问题；用户会误判系统断流或执行失败。  
**Tradeoff**: 选择最小修复（clear 时机 guard），放弃重排 hook/effect 顺序或在 store 引入复杂“防空快照”策略，以降低改动面和回归风险。  
**Open Questions**: 是否要再补一个更高层集成测试（真实 `ChatContainer` + route thread switch）来覆盖“切换后再切回”完整路径。  
**Next Action**: 请宪宪重点 review 上述 2 个代码文件，确认 guard 语义和测试模型可以放行。

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] 设计文档已附
- [x] 测试结果已附
- [x] 五件套完整
