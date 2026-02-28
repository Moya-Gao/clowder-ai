---
feature_ids: [F039]
debt_ids: []
topics: [queue, force-send, cancel, bugfix, review-request]
doc_kind: review-request
created: 2026-02-27
---

# Review 请求: F39 Force Send / Cancel / Queue 三连 Bug 修复

## 背景

铲屎官 2026-02-27 手动测试 Force Send 功能时发现三个相互关联的 bug：
1. Force Send 只取消旧调用，不执行新消息
2. 取消后猫猫仍然有输出泄漏
3. 队列面板显示残留条目

这三个 bug 的根因是 F39 Phase A/C 在 force-send 路径上的遗漏。

## 铲屎官原始需求（🔴 必填）

- Discussion: `docs/plans/2026-02-26-message-queue-delivery.md`
- **原始需求摘录**：
  > "你们在跑A2A的时候，我的操作应该有两个选择——取消调用，或者发送消息进入队列。有的时候就会看着你们两个慢吞吞的往错的方向讨论，我就很着急。"
  > 强制发送 = 中断当前猫猫 + 立即用新消息发起调用（铲屎官着急了，要纠正方向）
- 铲屎官核心痛点：Force Send 实际上只是 Cancel，没有立即用新消息发起调用
- **请 Reviewer 对照上面的摘录判断：修复后是否解决了铲屎官的问题？**

## 设计文档

- 需求: `docs/plans/2026-02-26-message-queue-delivery.md`
- 技术 Plan: `docs/plans/2026-02-26-message-queue-delivery-plan.md`
- Feature 追踪: `docs/features/F039-message-queue-delivery.md`
- Bug Report: `docs/bug-report/f39-force-send-cancel-queue-bugs/bug-report.md`

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | Force cancel 后新消息立即执行 | ✅ | `clearPause()` 防止状态中毒 |
| 2 | Cancel 后不再泄漏猫猫输出 | ✅ | `route-serial.ts` + `messages.ts` + `ConnectorInvokeTrigger.ts` 全部加 abort check |
| 3 | Force cancel 后 WS 通知前端更新 | ✅ | `queue_updated` with `action: 'force_cleared'` |
| 4 | `finalStatus` 正确区分 canceled vs failed | ✅ | `messages.ts` catch 块检测 `signal.aborted` |
| 5 | 回归测试覆盖 | ✅ | 2 个新集成测试（`queue-integration.test.js`） |
| 6 | 现有测试不受影响 | ✅ | 2145 pass, 1 fail (pre-existing Redis) |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `QueueProcessor.ts` | 修改 | 新增 `clearPause(threadId)` 方法（防止旧 invocation 异步 cleanup 中毒暂停状态） |
| `messages.ts` | 修改 | Force 路径加 `clearPause` + `queue_updated` 发射；catch 块区分 canceled/failed；两个 `for await` 循环加 abort break |
| `route-serial.ts` | 修改 | 内层 `for await` 循环加 `signal?.aborted` break |
| `ConnectorInvokeTrigger.ts` | 修改 | 流式循环加 `controller?.signal.aborted` break |
| `queue-integration.test.js` | 修改 | 新增 2 个 bugfix 回归测试 |
| `bug-report.md` | 新增 | 完整 bug report（3 个 bug 根因分析 + 修复方案） |

## Git SHA

- Base: `5f2f1da` (main)
- Head: `8f5e08d` (fix/f39-force-send-bugs)

## 测试状态

```
pnpm test: 2145 passed, 1 failed (pre-existing Redis, 非本次改动)
pnpm --filter @cat-cafe/web build: clean (0 errors)
```

## Review 重点

1. **`QueueProcessor.clearPause` 竞态安全性**：`clearPause()` 在 force cancel 后立即调用，但旧 invocation 的 `finally` 块异步执行 `onInvocationComplete('canceled'/'failed')` → 会重新 `pausedThreads.add(threadId)`。当前设计依赖新 invocation 最终 `onInvocationComplete('succeeded')` 清除暂停。请审查这个时序是否有遗漏场景。
2. **`messages.ts` catch 块结构**：新增的 `if (controller?.signal.aborted)` 分支 + else 包裹原有逻辑，请确认缩进/控制流无误。
3. **abort break 覆盖完整性**：`route-serial.ts` 内层、`messages.ts` 两个外层、`ConnectorInvokeTrigger.ts` 都加了 break。是否还有其他流式循环遗漏？
4. **前端侧**：本次只做了后端修复。前端 `useSocket.ts` 对 `queue_updated` 的 `action: 'force_cleared'` 处理是否需要额外改动？（当前 `queue_updated` handler 直接用 `data.queue` 替换整个队列状态，应该已经够用）

## 五件套

**What**: 修复 F39 force-send 路径的三个 bug——QueueProcessor 状态中毒、cancel 后输出泄漏、队列面板残留

**Why**: 铲屎官手测发现 force-send 实质是 cancel-only，新消息不执行。根因是 `finalStatus` 默认值错误 + 缺少 `clearPause` + 流式循环无 abort 检查

**Tradeoff**: 考虑过在 `broadcastAgentMessage` 内部加 abort guard（一处修改覆盖所有调用方），但这会改变 `broadcastAgentMessage` 的语义（它不应该知道 invocation 状态），选择在每个 `for await` 调用方检查更清晰

**Open Questions**:
- 前端 `queue_paused` handler 在 force 场景下是否需要额外处理？（后端已发 `queue_updated` 清空队列，但 `queue_paused` 仍会因旧 cleanup 触发）
- `clearPause` → 旧 cleanup 重新 pause → 新 invocation succeeded 再清除：这个三步时序有无极端场景漏洞？

**Next Action**: 请 review 上述 5 个文件的改动（重点 `messages.ts` 和 `QueueProcessor.ts`）
