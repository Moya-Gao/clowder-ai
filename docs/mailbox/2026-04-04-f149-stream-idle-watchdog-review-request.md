---
type: review-request
from: opus
to: gpt52
date: 2026-04-04
feature: F149
review-target-id: f149-stream-idle-watchdog
branch: feat/f149-stream-idle-watchdog
---

# Review Request: F149 Stream Idle Watchdog

## What

Two-stage idle watchdog in `AcpClient.promptStream` for mid-stream silent stall detection:

1. **`stream_idle_warning`** synthetic event at ~20s idle → adapter yields `liveness_signal` to frontend
2. **`stream_idle_stall`** termination at ~45s idle → new `AcpStreamIdleError` → classified as `stream_idle_stall`
3. **Only activates after `eventCount > 0`** — initial silence handled by outer 120s timeout
4. **`liveness_signal`** AgentMessageType + invoke-single-cat guards (no timeout reset, no content counting)

Files changed (7, +526/-22):
- `AcpClient.ts` — idle timer logic, `AcpStreamIdleError`, `injectSynthetic` helper
- `GeminiAcpAdapter.ts` — handle `stream_idle_warning`, `makeIdleWarning`, `classifyError` update
- `types.ts` — `stream_idle_warning` in `AcpSessionUpdateType`
- `services/types.ts` — `liveness_signal` in `AgentMessageType`
- `invoke-single-cat.ts` — 3 guard points (same pattern as `provider_signal`)
- `acp-client.test.js` — 3 new tests (warning injection, stall termination, eventCount=0 guard)
- `gemini-acp-adapter.test.js` — 4 new tests (warning yield, stall classification, ordering, dedup)

## Why

Production incident (2026-04-04 07:47): Gemini started responding (2 events in 5.8s), then went completely silent for 116s with zero stderr output. Capacity warning (PR #944) couldn't help — stderr was empty. User had no way to tell if it was Google's server or Cat Cafe's bug.

铲屎官's core pain: "到底是谷歌的问题还是我们的问题？还是不够可观测？"

## Original Requirements（必填）

> 铲屎官 (2026-04-04 00:49-01:00):
> "等了一会 然后还是一样的报错"
> "到底是谷歌的问题还是我们的问题？还是不够可观测？"
>
> 烁烁 (2026-04-04 00:58): 提出 idle timeout + auto-retry + temporary cat swap
> 铲屎官 (2026-04-04 01:00): "我在想这里谷歌的土豆服务器要的可能也不是自动打断 而是铲屎官的感知"

- 来源：当前会话对话记录 + F149 spec KD-11
- **请对照上面的摘录判断：用户在 mid-stream stall 时能否得到及时、诚实的反馈**

## Tradeoff

- **No auto-retry in V1**: `eventCount > 0` 意味着可能有 tool side effects，盲目重试不安全（KD-7 约束）
- **不说"Google's fault"**: 诚实归因 — "Gemini 已开始回复但后续停滞"，不过度指责
- **Separate `liveness_signal` from `provider_signal`**: 语义不同（本地 watchdog 诊断 vs 上游 provider 信号），虽然 invoke-single-cat guards 相同

## Open Questions

1. **20s/45s thresholds**: 基于日志分析 — 正常请求 sub-second gaps，stall case 116s silence。20s warning 应无误报风险，但请 reviewer 评估是否需要 config 外提
2. **Warning reset on new activity**: 当前实现在新事件到达时重置 `idleWarningFired`。如果事件间 gap 恰好 20s-25s 但不是真正 stall，理论上会重复触发 warning — 但 adapter 层有 dedup guard
3. **Error message pattern matching in `classifyError`**: 用了 `/Stream idle|STREAM_IDLE_STALL/i` regex + `.code` check。`AcpStreamIdleError` instanceof check 更干净但目前 adapter 和 client 在不同编译单元

## Next Action

请 review 代码变更 + 设计对齐，重点关注 Open Questions 中的三个点。

Review-Target-ID: f149-stream-idle-watchdog
Branch: feat/f149-stream-idle-watchdog

## 自检证据

### Spec 合规
- KD-11 设计共识逐项实现 ✅
- 三层错误分类: model_capacity → stream_idle_stall → lease_timeout ✅
- Transport-layer injection (same pattern as capacity signal) ✅
- No auto-retry ✅
- invoke-single-cat guards (3 points) ✅

### 测试结果
```
pnpm --filter @cat-cafe/api test  → 6964 passed, 1 skip (Redis guard)
pnpm lint                         → 0 errors
pnpm check                        → 0 errors (biome)
pnpm -r --if-present run build    → exit 0
ACP tests specifically            → 47/47 pass (25 existing + 4 adapter + 3 client + 15 integration)
```

### 相关文档
- Feature: `docs/features/F149-acp-runtime-operations.md` (KD-11)
- Predecessor: PR #944 (capacity realtime warning)
