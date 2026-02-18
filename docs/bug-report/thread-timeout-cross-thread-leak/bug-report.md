# Bug Report: thread 切换后 timeout 串线到当前线程

> 报告人: 铲屎官  
> 定位猫猫: 缅因猫（砚砚）  
> 报告日期: 2026-02-18  
> 严重程度: P1  
> 状态: 已定位，修复中

---

## 1. 报告来源

- 用户现场反馈：`thread_mlr5t5b7s2uf5vcx` 运行中切到 thread2，thread2 出现  
  `⏱ Response timed out. The operation may still be running in the background.`
- 用户怀疑：thread1 的超时报错被打到了 thread2。

---

## 2. 复现步骤（期望 vs 实际）

1. thread1 有进行中的 invocation（尚未收到 final done/error）。
2. 在 5 分钟 timeout 窗口内切换到 thread2。
3. 等待 timeout 触发。

**期望**
- timeout 只影响原始 thread1（或仅在 thread1 可见）。
- 不应污染当前 thread2 的消息流与 loading 状态。

**实际**
- timeout 系统消息出现在当前活跃 thread2，造成串线误导。

---

## 3. 根因分析

### 3.1 已确认事实

1. 超时文案由 `useAgentMessages` 注入：
   - `packages/web/src/hooks/useAgentMessages.ts:92`
2. timeout 计时器是单实例 ref，无 thread 归属：
   - `packages/web/src/hooks/useAgentMessages.ts:71`
   - `packages/web/src/hooks/useAgentMessages.ts:74-95`
3. thread 切换时仅清理 `activeRefs`，没有清理/迁移 timeout：
   - `packages/web/src/components/ChatContainer.tsx:107-113`
4. timeout 回调通过 active-thread API（`addMessage/setLoading/...`）直接写入当前平铺状态，天然落到“当前线程”：
   - `packages/web/src/hooks/useAgentMessages.ts:80-94`

### 3.2 根因结论

- timeout 生命周期缺少 `threadId` 绑定。  
- 切线程后 timer 继续存活，触发时把旧线程超时写进了新线程视图。

---

## 4. 修复方案

1. 为 timeout 增加 `threadId` 归属（schedule 时绑定）。
2. timeout 回调只清理和标记所属线程状态；若当前线程不同，则写入 `threadStates` 对应线程，不污染 active thread。
3. 增加回归测试：thread1 启动 timeout 后切到 thread2，断言 timeout 不会落到 thread2。

---

## 5. 验证方式（Red -> Green）

1. **Red**：新增测试复现“切线程后 timeout 串线”，先看到失败。
2. **Green**：修复后同测试转绿。
3. 补跑 `useSocket-thread-guard` 与 `useSocket-background` 相关用例，确保线程路由回归不破。

---

*签名: 缅因猫 🐾*
