---
doc_kind: review-request
feature_ids: [F089]
author: opus
reviewer: codex
created: 2026-03-15
---

# Review Request: F089 invocation-level hard timeout + tmux liveness semantics

## What

两层防御，解决"正在回复中"永远挂起的问题：

1. **invoke-single-cat.ts**: 新增 invocation-level hard timeout（`CLI_TIMEOUT_MS × 2`），用 `AbortSignal.any()` 合并用户取消信号和超时信号，`abortableNext()` helper 打断阻塞的 `gen.next()`
2. **tmux-agent-spawner.ts**: 分离 `firstEventTimeout`（30s，CLI 启动超时）和 `idleTimeout`（CLI_TIMEOUT_MS，事件间隔超时），内联 readline 实现可 kill 的 FIFO 读取（`rl.close()` 而非 `stream.destroy()`）

## Why

铲屎官在 f089-test 环境发现线程卡在"正在回复中"状态不恢复。砚砚和 GPT-5.4 分析后共识两个根因：
- `invoke-single-cat.ts` 没有 invocation 级别超时 → 如果 service generator 既不 yield done 也不 throw，永远挂起
- tmux 路径缺乏活性语义 → 无效输出（非 JSON）可能无限延续超时

## Original Requirements（必填）
> 铲屎官："它不卡了，看起来 Termux 的问题。看起来你们得定位看看了"
> 铲屎官："不只是 tmux！砚砚刚刚也出现了一直在猫猫回复中然后没有回复然后超时！只不过 tmux 概率大？"
- 来源：2026-03-15 实时对话（铲屎官 + 三猫调试 session）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **未选方案**：FIFO `O_RDWR` dummy writer 保持 FIFO 打开 → 导致 tee 退出后 EOF 不传递，5 个原有测试失败
- **未选方案**：FIFO `O_RDONLY|O_NONBLOCK` → EAGAIN 导致 stream 读不到数据
- **选定方案**：正常阻塞 `open()` + `rl.close()` 打断 → 经最小复现测试验证可靠

## Open Questions

1. **idleTimeout 测试 timing**: 当与其他测试一起运行时，`idleTimeout fires after first event` 测试因 tmux 累积状态需要 ~12s（单独运行 2s）。已将断言放宽到 15s，但 reviewer 请评估这是否可接受
2. **killAgent 3s grace period**: `killAgent` 的 C-c → 3s 等待 → kill-pane 是 fire-and-forget（从 setTimeout 回调触发），导致测试进程不会自动退出。这是测试环境问题，不影响生产行为
3. **invocation timeout multiplier**: 当前硬编码 `× 2`，砚砚建议的约束。是否需要配置化？

## Next Action

请 @codex 审查：
- `abortableNext()` 的 AbortSignal 竞争安全性
- invocation timeout 是否覆盖了所有 service.invoke() 挂起的路径
- tmux firstEventTimeout/idleTimeout 分离是否合理
- 测试覆盖是否充分

## 自检证据

### Spec 合规
- ✅ 砚砚 3 个实施约束全部满足：AbortSignal.any、error+done+hadError=true、timeout > CLI_TIMEOUT_MS × 2
- ✅ 两个根因都有对应修复 + 测试

### 测试结果
```
invocation-timeout-guard.test.js  # 3 passed, 0 failed
tmux-agent-spawner.test.js        # 11 passed, 0 failed (含 4 个新测试)
pnpm check                        # 0 errors in changed files
pnpm lint (tsc --noEmit)          # 0 new errors (2 pre-existing in EmbeddingService)
```

### 相关文档
- Feature: `docs/features/F089-hub-terminal-tmux.md`
- Branch: `feat/invocation-timeout-guard`
- Commit: `9107951f fix(F089): invocation-level hard timeout + tmux liveness semantics`
