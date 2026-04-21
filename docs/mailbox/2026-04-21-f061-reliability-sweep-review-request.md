---
feature_ids: [F061]
related_features: [F061]
doc_type: review_request
status: open
last_updated: 2026-04-21
---

# Review Request: F061 Bundle A — quota-style capacity retry reliability sweep

Review-Target-ID: f061
Branch: feat/f061-reliability-sweep

## What
- `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-event-transformer.ts`
  - 扩展 `model_capacity` classifier，新增 quota-style provider 文案匹配：`exhausted your capacity` / `quota will reset`
- `packages/api/test/antigravity-event-transformer.test.js`
  - 新增回归：`You have exhausted your capacity on this model. Your quota will reset after 0s.` 必须产出 `provider_signal + model_capacity`
- `packages/api/test/antigravity-agent-service-fatal-errors.test.js`
  - 新增 service 回归：quota-style `model_capacity` 触发 fresh-cascade retry，且 retry 后重发的 prompt 仍保留 `callback fallback` / thread-bound reply path
- `docs/features/F061-antigravity-bengal-cat.md`
  - 同步 Bundle A 分支状态：quota-style capacity gap 已补；剩余 open item 收敛为 parity / telemetry / 实机复验

## Why
铲屎官贴了新的 provider 报错：

> `Error: Encountered retryable error from model provider: You have exhausted your capacity on this model. Your quota will reset after 0s.`

当前 Antigravity classifier 只认 `high traffic / rate limit / too many requests / try again / overloaded`。  
这意味着 quota-style provider 文案会被误判成 `upstream_error`，现有的 bounded retry/backoff 根本起不来。

这次不改 backoff 策略本身，只修 **“该重试的错误先被识别成 model_capacity”** 这一层，并顺手锁住：fresh-cascade retry 后不能把 callback fallback / thread reply path 丢掉，否则 fatal 后 continuity 还会继续脆。

## Original Requirements（必填）
> “好像得做一下安全防护 或者说这叫可靠性？ 这个谷歌应该是控制了访问速率 估计得给他重试 比如过5s重试 ：Error: Encountered retryable error from model provider: You have exhausted your capacity on this model. Your quota will reset after 0s.”  
> “因为我看我的额度现在还是100%呢”  
> “你每次走一遍流程 几个小时，然后测试发现还有一堆问题的？”

- 来源：2026-04-21 thread 原话；问题边界已镜像到 `docs/features/F061-antigravity-bengal-cat.md`
- 请 reviewer 对照判断：这次交付是否至少把 **quota-style capacity 文案识别 + retry continuity guard** 收住

## Tradeoff
- 这次是 **Bundle A reliability sweep**，不碰 Phase 2c v2 executor 扩展；`run_command/context canceled` 仍留给 Bundle B
- 好处：风险集中，review 可以只看 transformer/service 的可靠性边界
- 代价：这次不会解决 “写文件/改代码仍不稳定” 的真实可用性问题，只先保证 provider quota 这条线不会因为分类缺口直接绕开 retry

## Open Questions
- 你是否同意把 quota-style provider 文案归进 `model_capacity`，而不是单独再造一个错误类？
- 把 “retry 后 callback fallback 不丢” 作为 continuity guard 的第一层，你觉得边界够不够，还是还要额外锁更深的 thread-memory 行为？
- 现有默认 backoff（1/3/5/10/15/20/30/36s）这次没改，你认为应该保持，还是 quota-style 容量路径要单独调？

## Next Action
- 请 review 这次 Bundle A diff 的边界是否正确
- 重点看：
  1. capacity classifier 是否会误吞非 quota 错误
  2. service-level retry guard 是否真的锁住了 callback fallback continuity
  3. 文档是否准确表达“这次修了什么、没修什么”
- 如果放行，我下一步直接继续 Bundle B（tool parity v2 / `run_command context canceled`）

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f061/sonnet`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 愿景对照：这次只 claim “quota-style capacity 文案能进入现有 retry + retry continuity guard 不丢 callback fallback”，没有越界 claim “F061 reliability 全闭环”
- F061 真相源已更新：`docs/features/F061-antigravity-bengal-cat.md`
- 根目录工件闸门：无根目录媒体/设计工件

### 验证命令
- `node --test packages/api/test/antigravity-event-transformer.test.js packages/api/test/antigravity-agent-service-fatal-errors.test.js packages/api/test/antigravity-agent-service.test.js`
  - `54 passed, 0 failed` ✅

### 已知外部阻塞（非本 patch 引入）
- `NODE_ENV=development pnpm --filter @cat-cafe/api run build` ❌
  - 当前 worktree 在 **未改动的文件** 上就被 repo 级类型缺失挡住：`PushNotificationService.ts`、`domains/memory/*`、`preview-gateway.ts`、`email-service.ts`、`xiaoyi-*`、`scheduler/*`、`routes/evidence.ts`、`routes/knowledge-feed.ts`
  - 这批报错与本次 diff 无重叠；本次 review 依据以 diff + 定向测试为主

### 相关文档
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
- Verification: `docs/features/F061-verification-2026-04-21.md`
- Bundle plan: `docs/plans/2026-04-21-f061-remaining-issue-bundles.md`
