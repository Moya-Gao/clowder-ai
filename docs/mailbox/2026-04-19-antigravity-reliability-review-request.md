# Review Request: Antigravity Reliability Hardening

Review-Target-ID: antigravity-reliability
Branch: feat/antigravity-reliability
Code-SHA: 033cab01f
Base-Code-SHA: 15ef59644
Remote-Branch-SHA: 033cab01f

## What
- 修了两个问题：
- Antigravity `thinking` snapshot 增长时，不再重复拼接整段内容。
- Antigravity `model_capacity`（上游 high traffic / rate limit）改为有限自动重试，而不是首次命中就直接终止。
- 代码范围：
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- `packages/api/src/domains/cats/services/agents/routing/{route-serial,route-parallel,thinking-chunks}.ts`
- `packages/web/src/stores/chatStore.ts`

## Why
- 铲屎官明确指出两个现象还没过关：`thinking` 有重复内容；上游模型容量不足时应自动重试，总预算约 2 分钟。
- 这次修复把“重复 thinking”归因到 snapshot 型 thinking 被当成新块追加；把“容量不足”归因到 Antigravity service 层把 `model_capacity` 当硬终止，没有任何 backoff/self-heal。

## Original Requirements
> 两个问题 1. thinking里还是有重复内容  
> Error: ⚠️ 上游模型服务端容量不足（服务器繁忙），非 Cat Café 系统故障。原始信息：Our servers are experiencing high traffic right now, please try again in a minute.-》 我们应该能够自动重试 比如1s / 3s /5s 一共重试时间加起来可能2min 这样可靠性？  
> 其实我在想你们的这个antigravity的实现是不是需要自己站在可靠性工程师的视角好好想想现在真的足够可靠吗？
- 来源：当前 thread `thread_mnux2eewbo4otg17`，消息 `0001776651629048-000079-edb25fb1`
- 请对照上面的摘录判断交付物是否真的解决了铲屎官的问题

## Tradeoff
- `model_capacity` 自动重试只在“尚未产出文本、也没有 tool activity”时触发，避免把已有副作用的请求静默重放。
- 重试通过 fresh cascade/session 进行，避免把污染状态留在旧会话里；代价是 session 会被重建。
- `thinking` 去重采用“前缀增长覆盖最后一块”的策略，保留真正的新思路块，但会忽略明显更短的 stale snapshot。

## Open Questions
- `model_capacity` 的触发条件是否够保守，是否还需要把某些 provider_signal-only 场景纳入或排除。
- `thinking` 的“前缀增长覆盖”是否已经足够，还是需要把 Antigravity bridge 的 step delta 也一起做成 thinking 级增量。
- 当前默认 backoff `1/3/5/10/15/20/30/36s` 是否合适。

## Next Action
- 请重点 review：
- 自动重试的边界是否会误吞应该立即暴露给前端的错误。
- thinking 合并逻辑是否会错误吞掉真正的新思路块。
- 如果你认可，给我明确放行/退回结论和 P1/P2 列表。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/antigravity-reliability/opus-47`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 愿景覆盖：
- `thinking` 重复：已在 API 持久化层与前端 chatStore 同时修复，新增 snapshot-growth regression tests。
- 上游容量不足自动重试：已在 Antigravity service 层实现有限 backoff retry，并用 fresh cascade 重新发送 prompt。
- `.pen` 检查：未发现 `F061` / `antigravity reliability` 的直接设计稿命中；本次以 provider/runtime 行为修复为主。
- Artifact Hygiene：根目录媒体/设计工件闸门为空。

### 测试结果
- `pnpm --dir packages/api run build` ✅
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test --test-timeout=60000 test/antigravity-agent-service-fatal-errors.test.js test/antigravity-waiting-approval.test.js test/route-strategies.test.js` → `113 pass, 0 fail` ✅
- `bash ./scripts/with-test-home.sh node --test --test-timeout=60000 test/antigravity-agent-service-executors.test.js test/api-instance-lease.test.js` → `16 pass, 0 fail` ✅
- `pnpm --dir packages/web exec vitest run src/stores/__tests__/chatStore-thinking-dedup.test.ts` → `7 pass, 0 fail` ✅
- `pnpm gate`：build / tsc / 相关回归套件通过，但全量测试被**无关用例** `test/api-instance-lease.test.js` 挡住；该用例单独复跑通过，当前判断为 pre-existing flaky，非本次改动引入。

### 相关文档
- Mailbox: `docs/mailbox/2026-04-19-antigravity-reliability-review-request.md`
- Related feature history: `F061`
