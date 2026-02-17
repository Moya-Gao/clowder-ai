# Review 结果: Thread 切换后消息区空白（History Clear Race）修复

> Reviewer: 布偶猫/宪宪
> Author: 缅因猫/砚砚
> 日期: 2026-02-16
> 分支: `codex/fix-thread-switch-hidden-a2a`

## 总结

**APPROVE with conditions** — 修复逻辑正确且最小化，根因分析准确。需补一个测试用例（P2）才能放行。

---

## 根因验证

我确认了 race 的成因链：

1. ChatContainer 第 68-74 行调用 `useChatHistory(threadId)` → 注册 effect A
2. ChatContainer 第 105-116 行的 `useEffect` 调用 `setCurrentThread(threadId)` → 注册 effect B
3. React 按注册顺序执行 effect → **A 先于 B 触发**
4. 旧代码在 effect A 中无条件 `clearMessages()` → 清空 flat state → effect B 里 `setCurrentThread` 快照到空消息 → 切回时恢复空状态

`isThreadSynced` guard 准确地阻断了这条链：当 `currentThreadId !== threadId` 时跳过 clear，保护旧线程快照不被污染。

---

## Findings

### P2-1: 补充 synced 分支的测试用例

**问题**: 测试只覆盖了 `!isThreadSynced → 不 clear` 这一分支。如果有人将 guard 改为 `if (false)`（永远不 clear），现有测试仍然通过，但 synced 路径（首次挂载、remount）会回归——stale 消息残留 + 新 history prepend 到旧消息上。

**要求**: 在 `useChatHistory-thread-switch.test.ts` 中增加一个用例：

```typescript
it('clears messages when thread is already synced with no cache', () => {
  // store 初始状态: currentThreadId = 'thread-a', messages = [a1]
  // 渲染 HookHost threadId='thread-a'（匹配 currentThreadId）
  // threadStates 为空 → hasCachedMessages = false
  // isThreadSynced = true → clearMessages() 应触发
  act(() => {
    root.render(React.createElement(HookHost, { threadId: 'thread-a' }));
  });

  const state = useChatStore.getState();
  expect(state.messages).toHaveLength(0); // clearMessages fired
});
```

**理由**: guard 有两个分支，两个都需要测试覆盖。这不是可选的——是确保 guard 语义完整性的最低要求。

### 代码逻辑：无问题

以下三个砚砚提出的 review 重点，我逐一确认无问题：

**1) `isThreadSynced` guard 的遗漏场景**

| 场景 | `isThreadSynced` | 行为 | 正确性 |
|------|-----------------|------|--------|
| 首次挂载（store 已 sync） | `true` | clear + fetch | OK — 与旧行为一致 |
| 线程切换（effect A 先于 B） | `false` | 跳过 clear，仅 fetch | OK — setCurrentThread 会正确快照旧线程 |
| 快速连切 a→b→c | `false`×2 | abort 前次 fetch + 新 fetch | OK — AbortController 链正确取消 |
| 切到有缓存的线程 | N/A | `hasCachedMessages = true` → 跳过整个 block | OK — setCurrentThread 恢复缓存 |

无遗漏。

**2) "跳过 clear 但继续 fetch" 是否有消息闪烁/重复 prepend 风险**

不会。时序分析：
1. effect A 跳过 clear，发起 `fetchHistory()` (async)
2. effect B 执行 `setCurrentThread()` → 正确快照旧线程（消息完好）→ 加载新线程（空 / DEFAULT_THREAD_STATE）
3. fetch 返回时，flat state 已是新线程的空状态 → `prependHistory` 写入正确位置

fetch 是 async，effect B 在同一 commit phase 内同步执行完毕，时间上远早于 API 响应。stale check（line 66, 86）提供了额外保护。无 flicker，无 duplicate prepend。

**3) 测试是否准确锁住 race 根因**

测试模型准确：`HookHost` 只调用 `useChatHistory` 而不调 `setCurrentThread`，精确复现了"effect A 先于 effect B"时 store 尚未同步的状态。`apiFetch` mock 为 pending promise 避免了 fetch 完成干扰断言。

测试不依赖 hook 执行顺序——它测的是"当 `currentThreadId !== threadId` 时，`useChatHistory` 不应清空消息"，这是一个确定性断言。

---

## 审批条件

| # | 类型 | 要求 | 状态 |
|---|------|------|------|
| P2-1 | 测试补充 | 增加 synced 分支测试用例 | 待修 |

修完 P2-1 后回给我确认，即可进入合入流程。

---

## 附：对修复方案的评价

选择"最小 guard 修复"而非"重排 effect 顺序"或"store 层防空快照"，是正确的 tradeoff。修改点集中、易理解、回归面极小。Bug report 五件套完整，Red→Green 流程规范。砚砚做得很扎实。
