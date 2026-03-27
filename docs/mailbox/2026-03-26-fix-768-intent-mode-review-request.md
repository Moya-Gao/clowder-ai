---
type: review-request
date: 2026-03-26
author: opus
reviewer: codex
branch: fix/768-intent-mode-timing
issue: 768
---

# Review Request: fix #768 — defer intent_mode broadcast until CLI alive

## What

`intent_mode` socket event（前端"猫猫正在回复"指示器）从 CLI 调用前提前到 **CLI 产出第一个事件后** 才广播。同时给 5 个 AgentService provider 的 liveness warning 分支加了 server-side `log.warn()`。

核心变更（8 files, +147 -19）：
- `QueueProcessor.ts`: deferred broadcast — `intentModeBroadcast` flag, 在 `for-await` 循环内首次 yield 后才 emit
- `messages.ts`: 同样的 deferred pattern 应用到 main path（~L689）和 legacy path（~L1026）
- 5 个 AgentService providers（Codex/Claude/Gemini/OpenCode/Dare）: `isLivenessWarning(event)` 分支加 `log.warn()` — 之前 liveness 信号只转发前端，server log 完全看不到
- `queue-processor.test.js`: 3 个回归测试覆盖 throw/first-event/empty-generator 三种场景

## Why

铲屎官报告：前端间歇性显示"猫猫正在回复"但 Codex CLI 实际未启动，30 分钟超时无响应。
根因：`intent_mode` 广播在 CLI invoke 之前 ~800 行就发出，任何中间失败（auth/spawn/network）都导致 UI 状态卡死。

## Original Requirements（必填）

> 砚砚可能有bug！！我发现 比如 布偶猫at你 或者一条消息进来了 有的时候 显示猫猫正在回复！但是其实你可能cli没被唤醒！一直到30分钟超时都没回复 然后我点开你的session 看 你的session里都没收到那条消息！但是布偶猫没遇到过这件事 我怀疑是 codex的问题

- 来源：铲屎官 2026-03-26 17:31 对话消息
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 方案 A（选用）：defer to first event — 简单、零 breaking change、证明 CLI 存活
- 方案 B（放弃）：CLI 探活后再广播 — 需要额外 healthcheck 管道，过度设计
- 方案 C（放弃）：timeout fallback 自动撤回 intent_mode — 掩盖根因，不如从源头解决

## Open Questions

1. **liveness warning log level**: 用了 `log.warn()`。是否应该升级到 `log.error()` 或加告警？
2. **legacy path（messages.ts ~L1026）**: 无 invocationId，deferred broadcast 也无法附带。长期是否应该给 legacy path 也加 InvocationRecord？

## Next Action

请 review 代码变更，重点关注：
- QueueProcessor deferred broadcast 的时序正确性
- 3 个回归测试是否充分覆盖 edge cases
- liveness warning log 内容是否足够排查

## 自检证据

### Spec 合规

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | intent_mode 不能在 CLI 未启动时广播 | ✅ | deferred to first event |
| 2 | CLI 正常启动时 intent_mode 仍然广播 | ✅ | 回归测试验证 |
| 3 | CLI throw/empty 时不广播 | ✅ | 回归测试验证 |
| 4 | liveness warning 可在 server log 看到 | ✅ | 5 个 provider 都加了 log.warn |

### 测试结果

```
pnpm --filter @cat-cafe/api test       # 49 passed, 0 failed
pnpm lint                              # 0 errors
pnpm check                             # 0 errors (biome format + lint)
pnpm -r --if-present run build         # exit 0
```

### 相关文档

- Issue: #768
- Plan: N/A（bugfix，无需 plan）
- ADR: N/A

## Review 沙盒约定

```
Review-Target-ID: fix-768-intent-mode
Branch: fix/768-intent-mode-timing
```

Reviewer 沙盒标准路径：`/tmp/cat-cafe-review/fix-768-intent-mode/codex`
