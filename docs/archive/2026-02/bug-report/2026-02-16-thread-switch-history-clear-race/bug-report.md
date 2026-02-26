---
feature_ids: []
topics: [thread, switch, history]
doc_kind: bug-report
created: 2026-02-16
---

# Bug Report: Thread 切换后消息区空白（History Clear Race）

> 日期：2026-02-16  
> 报告人：铲屎官（实际使用中发现，附截图）  
> 定位：缅因猫（砚砚）  
> 严重度：P1（直接影响线程切换可用性）

## 1. 报告人

- 报告人：铲屎官
- 发现方式：在 Thread A 看完内部讨论后，切到其他 thread 再切回，消息区出现“空掉/只剩一部分”

## 2. 复现步骤（期望 vs 实际）

1. 在 Thread A 产生一段包含内部讨论（A2A 折叠）和 assistant 消息的对话
2. 切换到 Thread B（首次进入，尚无本地 threadStates 缓存）
3. 再切回 Thread A

**期望行为**：
- Thread A 的消息列表应完整恢复（含内部讨论折叠块）

**实际行为**：
- Thread A 会出现“消息空掉”或仅剩部分消息，用户感知像断流或系统异常

## 3. 根因分析

### 定位证据（Red）

新增回归测试：
- `packages/web/src/hooks/__tests__/useChatHistory-thread-switch.test.ts`

红灯结果：
- `pnpm --filter @cat-cafe/web test -- --run src/hooks/__tests__/useChatHistory-thread-switch.test.ts`
- 断言失败：`expected [] to deeply equal ['a1']`

### 根因

`ChatContainer` 里 `useChatHistory(threadId)` 的 effect 先于 `setCurrentThread(threadId)` effect 执行。  
当切到一个“无缓存线程”时，时序如下：

1. `useChatHistory` 先执行，发现 `!hasCachedMessages`，立即 `clearMessages()`
2. 随后 `setCurrentThread` 执行，会把“当前 flat state”快照保存到旧线程
3. 由于第 1 步已清空，旧线程被保存成空消息快照
4. 切回旧线程时恢复到空状态，出现“消息看似丢失”

## 4. 修复方案（为何选择）

主方案（最小修复）：
- 在 `useChatHistory` 中仅当 `currentThreadId === threadId` 时才允许 `clearMessages()`
- 对“正在切线程（store 尚未同步）”场景，跳过 clear，交给 `setCurrentThread` 负责状态切换

Why：
- 不改 store 协议，不改 socket 路由，修复点集中在触发 race 的清空时机
- 可以直接由红灯测试覆盖并锁回归

放弃方案：
- 调整 `ChatContainer` hooks/effects 顺序（可行但耦合高，后续重构易回归）
- 在 store 层做“防空快照”特殊逻辑（会引入额外状态语义，复杂度更高）

## 5. 验证方式

1. Red→Green：
   - 上述回归测试先红后绿
2. 回归测试：
   - 线程状态保存/恢复相关测试保持通过（`chatStore-multithread`）
3. 手工验证：
   - 在线程 A 触发内部讨论 → 切到 B → 切回 A，消息与折叠区应稳定显示
