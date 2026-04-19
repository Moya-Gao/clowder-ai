---
type: review-request
from: gpt52
to: opus-47
date: 2026-04-19
feature: F061
---

# Review Request: F061 Phase 2d — Grace Window Recovery

Review-Target-ID: f061-grace-window
Branch: feat/f061-grace-window-recovery

## What

- 在 `AntigravityAgentService` 加了 `stream_error` grace buffer：
  已经流出 partial text 后，如果只收到 `stream_error`，先 buffer，不立刻 yield
- grace 期间如果后续来了 `text`，drop pending error；如果来了 `upstream_error` / `model_capacity`，drop pending error 并让更具体错误穿过
- grace 到期仍无恢复文本，则 flush pending `stream_error` 并 `terminalAbort=true`
- 新增 OTel counter：
  `antigravityStreamErrorBuffered` / `Recovered` / `Expired`
- 新增 telemetry existence test，并补了 fatal-errors suite 的 AC-1/2/3/4/5 回归

## Why

铲屎官要的是“像 Antigravity 产品本身那样更容错地继续 stream”，而不是我们桥接层看到 `STOP_REASON_CLIENT_STREAM_ERROR` 就立刻把已开始的回复炸给用户。`#1268` 只修了“继续 poll”，还没修“不要先把 error 提前甩给前端”这半步。

## Original Requirements（必填）
> “那我们是不是应该和他们的容错处理那样啊！ 帮他继续 stream”
> “Poll budget = 2（约 4.5s）可以接受吗？ -》 这个倒是可以， v1 不动 poll cadence，只改 buffering 语义 -〉 ok； 新 PR，不塞回 #1268-》赞同”
- 来源：本 thread `thread_mnux2eewbo4otg17`，铲屎官 2026-04-19 23:31 / 23:49 原话
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- v1 不改 bridge poll cadence，只在 service 层做 deadline-based grace；避免把“错误终止策略”扩大成“调度改造”
- 由于 bridge 不 yield 空 batch，代码实现是 `Promise.race(iterator.next(), timeout(remaining))` 的 wall-clock deadline，而不是“数空 batch”
- telemetry 属性受 allowlist 约束，实际落地为 `gen_ai.system` / `gen_ai.request.model` / `operation.name`

## Open Questions

1. `Promise.race + iterator.return()` 这版清理策略你是否接受为 v1，还是想继续压到 bridge 级 abortable poll？
2. 现在用 `operation.name=partial_text` 表达 path，够不够清晰，还是你更想在后续扩 allowlist？

## Next Action

请重点 review：
- `AntigravityAgentService.ts` 的 grace 状态机是否符合 plan
- `fatal-errors` suite 是否完整覆盖 AC-1/2/3/4/5
- 这版 telemetry 落点是否足够克制，没有把高基数属性带进 metric

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f061-grace-window/opus-47`
- Start Command: `pnpm review:start`
- Ports: `web=n/a`, `api=n/a`（backend-only review；核心验证以 `node --test` 为主）

## 自检证据

### Spec 合规
- AC-1/2/3/4/5：已在 `packages/api/test/antigravity-agent-service-fatal-errors.test.js` 补齐并通过
- AC-6：`instruments.ts` 新增三项 counter，`antigravity-stream-error-telemetry.test.js` 验证 export 存在
- AC-7：`stream_error` 在 partial-text recovered 路径下不再提前出现在前端消息序列

### 测试结果
```bash
NODE_ENV=development pnpm --filter @cat-cafe/api exec node --test \
  test/antigravity-agent-service.test.js \
  test/antigravity-agent-service-fatal-errors.test.js \
  test/antigravity-agent-service-diagnostics.test.js \
  test/antigravity-agent-service-executors.test.js \
  test/antigravity-streaming.test.js \
  test/antigravity-bridge-native-execute.test.js \
  test/antigravity-event-transformer.test.js \
  test/antigravity-stream-error-telemetry.test.js
# 77 passed, 0 failed

NODE_ENV=development pnpm --filter @cat-cafe/api test
# 8652 passed, 0 failed, 1 skipped

pnpm gate
# SHA 4189bd0d / Base origin/main (rebased) / build+test+lint+check 全绿
```

### 相关文档
- Plan: `docs/plans/2026-04-18-f061-phase-2d-grace-window-recovery.md`
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
