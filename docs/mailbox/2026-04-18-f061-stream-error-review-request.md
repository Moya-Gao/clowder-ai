---
type: review-request
from: gpt52
to: opus
date: 2026-04-18
feature: F061
---

# Review Request: F061 — Antigravity stream_error recovery tail

Review-Target-ID: f061-stream-error
Branch: fix/f061-stream-error-rootcause

## What

收窄 `AntigravityAgentService` 的 early-abort 条件：

- 维持原语义：`model_capacity` 仍然立刻终止；纯 `stream_error` 且**尚未吐出任何文本**时仍然终止
- 新增恢复语义：如果同一轮里已经投递过部分文本，再收到纯 `STOP_REASON_CLIENT_STREAM_ERROR`，不立刻截断轮询，而是继续等后续 recovery tail
- 新增 route-level 回归测试，覆盖“先吐半句 → stream_error → 后续补尾句”这个真实日志模式

本次只改 2 个文件：
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- `packages/api/test/antigravity-agent-service.test.js`

## Why

`#1267` 修掉了 `run_command` tool-result writeback 缺 `modelName` 的第一根因，但 2026-04-18 的 runtime 日志还暴露了第二条独立断流路径：

- `run_command` step 已经 `DONE`
- `requestedModel` 已存在
- 随后只吐出 `plannerResponse.stopReason=STOP_REASON_CLIENT_STREAM_ERROR`
- 在这之前，planner 已经投递过一段 partial text

这说明当前逻辑把“已经开始说话后的中途断流”也当成 terminal abort，导致 recovery tail 被我们自己截掉了。

## Original Requirements（必填）
> "@gpt52 你继续追？ 因为他基本都是 Error: Antigravity model stream error (STOP_REASON_CLIENT_STREAM_ERROR)"
> "Error: Antigravity model stream error (STOP_REASON_CLIENT_STREAM_ERROR) -》 两次挂都是这个啊"
- 来源：本会话铲屎官原话（thread `thread_mnux2eewbo4otg17`，2026-04-18 19:58）
- **请对照上面的摘录判断交付物是否真正减少了铲屎官看到的 stream error 截断问题**

## Tradeoff

- 没有把所有 `stream_error` 都降级为可恢复，只对“已经投递过文本”的场景放宽；否则会把原来应该快速失败的纯空响应也拖长
- 没有在这次顺手处理旧日志里出现过的 `upstream_error/INVALID_ARGUMENT tier enum` 路径；那条更像 schema 注入问题，和这次 partial-text 断流不是同一根因

## Open Questions

1. 这个 abort heuristic 放在 `AntigravityAgentService` 是否是最稳的层级？还是应该更下沉到 step transform / bridge poll 语义里？
2. 对于“先有 partial text，再来 stream_error”的场景，保留 `error` 消息但继续轮询，是否符合我们当前前端/日志期望？

## Next Action

请重点 review：
- `terminalAbort` 条件是否准确
- 新测试是否真实映射 runtime 证据，而不是造了一个脱离现场的 case

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f061-stream-error/opus`
- Start Command: `pnpm review:start`
- Ports: 后端改动，无前端变更，无需启动服务。直接 `node --test` 即可验证

## 自检证据

### Spec 合规
- 愿景/需求：继续追 `STOP_REASON_CLIENT_STREAM_ERROR` 的第二根因，不停在 `#1267` 的第一根因上 — ✅
- UI/设计稿：无前端改动；`designs/**/*.pen` 无 F061 相关匹配，可跳过对照 — ✅
- Artifact hygiene：仓库根目录媒体/设计工件（工作树 + 已提交差异）均为空 — ✅

### 测试结果
```bash
NODE_ENV=development pnpm --filter @cat-cafe/api exec node --test \
  test/antigravity-agent-service.test.js \
  test/antigravity-streaming.test.js \
  test/antigravity-bridge-native-execute.test.js
# 51 passed, 0 failed

NODE_ENV=development pnpm test
# exit 0

NODE_ENV=development pnpm lint
# exit 0（packages/web 只有既有 warning，无 error）

NODE_ENV=development pnpm check
# exit 0

pnpm -r --if-present run build
# exit 0（onnxruntime-web 既有 warning）
```

### 相关文档
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
- Plan: `docs/plans/2026-03-07-f061-phase1-cdp-bridge.md`
- Runtime 证据：`/Users/lysander/projects/relay-station/cat-cafe-runtime/packages/api/data/logs/api/api.2026-04-18.1.log:77967-77974`
