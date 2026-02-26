---
feature_ids: []
topics: [use, agent, messages]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: useAgentMessages 卸载后 timeout 计时器泄漏

> 报告人: 铲屎官  
> 定位猫猫: 缅因猫（砚砚）  
> 报告日期: 2026-02-22  
> 严重程度: P1  
> 状态: 已定位，修复中

---

## 1. 报告来源

- 现场现象：当前线程未在运行时，仍出现 `⏱ Response timed out. The operation may still be running in the background.`。
- 上一轮我们已修复 background update storm（`Maximum update depth exceeded`），但该 timeout 仍可在特定场景出现，说明存在独立触发路径。
- 铲屎官补充关键条件：runtime 被 pull 后前端热重载，正在进行中的会话发生组件卸载/重挂载。

---

## 2. 复现步骤（期望 vs 实际）

1. 任意线程收到流式消息（`handleAgentMessage(type='text')`），启动 5 分钟 done-timeout 计时器。
2. 在收到 final `done` 前，触发组件卸载（例如热重载、页面重建、路由重挂载）。
3. 等待 5 分钟。

**期望**
- 组件已卸载后，不应再触发 timeout 副作用。
- 不应再向 UI 注入 timeout 系统消息，也不应修改 loading/invocation 状态。

**实际**
- 卸载后的旧计时器继续运行，5 分钟后仍会执行 timeout 回调并注入系统消息。

---

## 3. 根因分析

### 3.1 已确认事实

1. timeout 计时器在 `useAgentMessages` 中由 `resetTimeout()` 创建：
   - `packages/web/src/hooks/useAgentMessages.ts:83-130`
2. `timeoutRef` 仅在消息路径中通过 `clearDoneTimeout()` 清理：
   - `packages/web/src/hooks/useAgentMessages.ts:133-142`
3. Hook 内没有 `useEffect` 卸载清理逻辑，组件 unmount 时计时器不会自动清除。

### 3.2 根因结论

- `timeoutRef` 生命周期绑定到了 Hook 实例，但缺少 unmount cleanup。
- 当组件卸载（例如热重载）发生在 final `done/error` 之前，旧实例计时器泄漏并在未来继续触发超时副作用。

---

## 4. 修复方案

1. 在 `useAgentMessages` 增加 `useEffect` cleanup：卸载时 `clearTimeout(timeoutRef.current)` 并清空 `timeoutRef/timeoutThreadRef`。
2. 增加回归测试：验证“unmount 后推进 5 分钟不会再触发 timeout side effects”。
3. 保持修复最小化，不改变现有 timeout 路由策略与线程归属逻辑。

**Tradeoff**
- 选择最小侵入修复（unmount cleanup），不在本次引入跨组件 timeout 状态持久化，避免扩大回归面。

---

## 5. 验证方式（Red -> Green）

1. **Red**：新增测试复现 unmount 后 timeout 泄漏，先看到失败。
2. **Green**：加 cleanup 后同测试转绿。
3. 运行 `useAgentMessages-loading` 全量回归，确认现有 timeout/thread guard 行为不回归。

---

*签名: 缅因猫 🐾*
