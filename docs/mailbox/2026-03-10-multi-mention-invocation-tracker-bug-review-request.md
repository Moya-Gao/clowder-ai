# Review Request: Fix multi-mention concurrent dispatch abort bug

## What

`dispatchToTarget` 中移除 `InvocationTracker` 的使用，修复 multi-mention 汇总显示"(空回答)"的 bug。

核心变更（2 文件）：
1. **`packages/api/src/routes/callback-multi-mention-routes.ts`** — `dispatchToTarget` 不再调用 `invocationTracker.start/complete`，移除 `controller.signal.aborted` break 逻辑
2. **`packages/api/test/multi-mention-routes.test.js`** — 新增带 `InvocationTracker` 的并发回归测试

附带改进：增加 `toolsUsed` 捕获，工具回复不再显示"(空回答)"而是 `(通过工具回复: tool1, tool2)`。

## Why

**根因**：`InvocationTracker` 以 `threadId` 为 key，同一 thread 同一时刻只允许一个活跃 invocation。新调用自动 abort 旧调用（`InvocationTracker.ts:44`）。Multi-mention 对同一 thread 并发 dispatch 多个猫，每个 dispatch 调用 `tracker.start(threadId)` → abort 前一个 → 只有最后一个 dispatch 的 controller 存活 → 其余响应为空 → 汇总显示"(空回答)"。

**约束**：`InvocationTracker` 的设计目的是用户级"停止"按钮（前端 cancel），不适用于 multi-mention 的并发场景。Multi-mention 已有独立的超时机制（`scheduleTimeout`）。

## Original Requirements（必填）

> 有bug 猫猫multi menthon 之后没生效！你可以自己测试看看
> 有点点小bug 其他猫猫回答了，但是你这里总结似乎没有？

- 来源：铲屎官 chat 消息 2026-03-10 20:36 / 00:48
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **放弃**：multi-mention dispatch 不再受用户"停止"按钮控制（`InvocationTracker` 的 cancel 不会传播到 dispatch 内部）
- **为什么可以接受**：multi-mention 有自己的 timeout 机制；用户取消整个 thread invocation 时，multi-mention 的 timeout 也会最终清理

## Open Questions

1. **是否需要给 multi-mention dispatch 加独立的取消机制？** 当前 multi-mention 只能通过 timeout 终止，没有即时取消能力。短期可接受，长期可能需要。
2. **`toolsUsed` 捕获是否完备？** 新增了 `msg.type === 'tool_use' && msg.toolName` 的捕获，但原代码没有这个逻辑——请确认这是否覆盖了所有 edge case。

## Next Action

请全量 review 这两个文件的改动，重点关注：
- 移除 InvocationTracker 后是否有副作用（资源泄漏、状态不一致）
- 并发 dispatch 的正确性
- 测试是否充分覆盖 bug 场景

## 自检证据

### Spec 合规
- 根因分析完成（InvocationTracker per-thread abort 语义与并发 dispatch 冲突）
- Bug report 五件套已写
- Red-Green TDD：先写失败测试复现 bug → 修复 → 绿灯

### 测试结果
```
node --test packages/api/test/multi-mention-*.test.js
# 62 passed, 0 failed
```

### 相关文档
- Feature: F086 (Multi-Mention Orchestration)
- Bug: InvocationTracker concurrent abort in dispatchToTarget
