# Review Request: F061 Antigravity retry hang symptom fix

Review-Target-ID: fix-antigravity-retry-hang
Branch: fix/antigravity-retry-hang

## What
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
  - 在 `model_capacity` retry 之后，如果 fresh cascade 落到 **当前 native executor 尚不支持的 `WAITING` tool step**，不再静默等到 stall timeout，而是立即抛出显式 fatal error：`unsupported_waiting_tool`
- `packages/api/test/antigravity-agent-service-fatal-errors.test.js`
  - 补一条回归：`model_capacity` retry → unsupported `grep_search` WAITING step → 立即失败，不再拖到 stall / empty_response
- `docs/features/F061-antigravity-bengal-cat.md`
  - 同步这次 P1 调查结论：retry 状态机本身可连续多轮跑，真实挂点是 retry 后掉进 unsupported WAITING tool step

## Why
铲屎官最新 field report 是“孟加拉猫经常只 retry 1 次然后又直接挂了”。  
这轮定位后确认：
- `invoke-single-cat.ts` 的 `maxAttempts = 2` 不是 Antigravity provider 内层 retry 的唯一预算
- `AntigravityAgentService` 的 `model_capacity` bounded retry 自己能连续多轮 fresh cascade
- 真正会把用户打成“retry 一次后挂住”的路径，是 **retry 后 fresh cascade 进入 v2 还没支持的 WAITING tool step**，bridge 不执行、也不 fail-fast，只能等 stall timeout

这次先做 symptom fix：把“静默挂死”变成“即时显式失败”，给后续 Phase 2c v2 parity 留出清晰边界。

## Original Requirements（必填）
> “retry好像有问题，经常只retry1次然后又直接挂了”  
> “定位清楚的先修复”  
> “这个p1这个你最好让云端codex帮你检视 到时候”

- 来源：thread 原话，已镜像回填到 `docs/features/F061-antigravity-bengal-cat.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 这次修的是 **terminalization / symptom fix**，不是把 `grep_search` / `read_file` / `write_file` / `edit_file` / `file_glob` 真正执行起来
- 也就是说，我们先把“retry 一次后静默挂住”收掉，但没有宣称 Phase 2c v2 parity 已完成
- 好处是用户体验立刻止血；代价是这类 step 现在会更早暴露为显式错误，而不是伪装成“还在等”

## Open Questions
- 你是否同意把 unsupported WAITING tool step 视为 **正确的立即终态**，而不是继续容忍 stall timeout？
- 这条 symptom fix 是否应该先独立合入，再继续做 Phase 2c v2 executor 扩展？
- 你是否看到更小/更干净的边界表达方式？

## Next Action
- 请 review 这条 symptom fix 的边界是否正确
- 如果放行，我下一步会：
  1. 给 `fix/antigravity-retry-hang` 开 PR
  2. 触发云端 `@codex review`
  3. 再继续往 Phase 2c v2 parity / retry telemetry 深挖

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/fix-antigravity-retry-hang/opus-47`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 愿景对照：这条修复只 claim “不再 retry 后静默挂到 stall”，没有越界 claim “全部 retry reliability 已闭环”
- F061 真相源已更新：`docs/features/F061-antigravity-bengal-cat.md`
- 根目录工件闸门：无根目录媒体/设计工件

### 测试结果
- `pnpm --filter @cat-cafe/api run build` ✅
- `node --test packages/api/test/antigravity-agent-service.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js packages/api/test/antigravity-waiting-approval.test.js packages/api/test/antigravity-agent-service-diagnostics.test.js packages/api/test/antigravity-agent-service-executors.test.js`
  - `50 passed, 0 failed` ✅
- 额外源码级 probe（`tsx`）：
  - 连续两次 `model_capacity` retry 后仍能恢复 ✅
  - retry 后 unsupported `WAITING grep_search` 会立刻报 `unsupported_waiting_tool`，不再掉进 stall / empty_response ✅

### 相关文档
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
- BACKLOG / task: `[P1] 调查 Antigravity 单次 retry 后仍挂起`
