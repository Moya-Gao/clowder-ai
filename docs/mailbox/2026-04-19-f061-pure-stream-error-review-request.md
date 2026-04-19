# Review Request: F061 pure stream_error grace follow-up

Review-Target-ID: f061
Branch: fix/f061-pure-stream-error

## What
- widen `AntigravityAgentService` stream-error grace so a pure `STOP_REASON_CLIENT_STREAM_ERROR` with no prior text is buffered briefly instead of immediately surfaced
- keep the existing expiry/supersede behavior: no-text `stream_error` still surfaces after grace expiry, and later `upstream_error` / `model_capacity` still win
- update telemetry wording so buffered `stream_error` is no longer described as partial-text-only
- extend `antigravity-agent-service-fatal-errors.test.js` with two no-text cases:
  - recovery text arrives after pure `stream_error`
  - pure `stream_error` expires without recovery

## Why
- runtime log evidence on 2026-04-19 shows a real Antigravity cascade (`84d0d1f2-690f-47a9-bbb9-cbe361ea8c03`) hitting `STOP_REASON_CLIENT_STREAM_ERROR` with no emitted text, so the current implementation surfaces a user-visible error immediately
- current service behavior is intentional-but-strict: pure `stream_error` aborts early, while only partial-text cases get the grace window
- this change tests whether giving no-text `stream_error` the same short recovery window reduces false-visible failures without weakening `model_capacity` / `upstream_error` precedence

## Original Requirements（必填）
> `@gpt52 -》Error: Antigravity model stream error (STOP_REASON_CLIENT_STREAM_ERROR)`
> `@gpt52 笑死了 你先合入 fix/f061-hang-and-thinking 然后再定位看看 他怎么又 Error: Antigravity model stream error (STOP_REASON_CLIENT_STREAM_ERROR)`
- 来源：`thread_mnux2eewbo4otg17`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- this is a policy change, not a pure bug fix: we now accept the risk of yielding later text after a no-text `stream_error` if recovery arrives within the grace window
- we keep the grace window short and preserve expiry behavior so hard failures still surface quickly

## Open Questions
- should pure `stream_error` share the exact same grace heuristic as partial-text recovery, or do we need an even narrower gate later (for example tool-completion-only)?
- is the existing 4.5s grace window still appropriate for no-text recovery, or should it split by path in a follow-up?

## Next Action
- please review whether widening grace to no-text `stream_error` is the right product/runtime tradeoff, and whether the new tests accurately model the desired recovery semantics

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f061/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- runtime preflight captured a real runtime-only failure path:
  - `PORT=3002`
  - `PID=25499`
  - `HEAD=e6ecf8174`
  - `PROCESS_AFTER_TARGET=no_COMMIT_NOT_IN_HISTORY`
  - runtime history already contains `#1267/#1268/#1274/#1279`, so this is not “missing previous F061 fixes”
- runtime log for `cascadeId=84d0d1f2-690f-47a9-bbb9-cbe361ea8c03` showed `msgTypeCounts={"error":1}` and `plannerResponse.stopReason=STOP_REASON_CLIENT_STREAM_ERROR` with no text, matching the current code path that aborts early on no-text `stream_error`

### 测试结果
- `NODE_ENV=development pnpm --filter @cat-cafe/api exec node --test test/antigravity-agent-service-fatal-errors.test.js test/antigravity-waiting-approval.test.js test/antigravity-streaming.test.js test/antigravity-bridge-native-execute.test.js test/antigravity-event-transformer.test.js`  # 35 passed, 0 failed
- `pnpm gate`  # passed on rebased HEAD `7704722f`

### 相关文档
- Plan: None（runtime-driven bug follow-up）
- ADR: None
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
