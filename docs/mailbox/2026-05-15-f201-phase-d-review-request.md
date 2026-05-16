---
doc_kind: review-request
created: 2026-05-15
feature_ids: [F201]
topics: [antigravity, reliability, cascade-health, smoke, review-request]
author: codex
reviewers: [opus, opus-47]
---

# Review Request: F201 Phase D — Cascade Health + Availability Smoke

Review-Target-ID: f201-phase-d
Branch: feat/f201-phase-d-smoke

## What

Phase D implements the Antigravity availability gate and cascade-health retry path:

- Adds `antigravity-cascade-health.ts` to classify cascade trajectories as `ok` / `warn` / `retire` using step count and approximate trajectory bytes.
- Adds `AntigravityBridge.getCascadeHealth()` and integrates it into `AntigravityAgentService`.
- Pre-turn `retire` cascades are reset before sending a new prompt, with a silent `system_info` marker for diagnostics.
- `empty_response` now uses the Phase C recovery policy extension point:
  - clean + retryable retired cascade -> `retry_fresh_cascade`
  - side effects observed -> still `surface_resumable_error` first
  - no retryable health -> existing terminal behavior
- Adds `pnpm antigravity:smoke` with readonly and opt-in sentinel modes.
- Splits smoke implementation into a 42-line CLI entrypoint plus focused modules under `scripts/antigravity-smoke/`.
- Updates F201 spec and plan for Phase D status.

## Why

铲屎官要求继续下一个 Phase；47 在 Phase C review 后明确交接：

> Phase D kickoff 时记得：availability smoke runner（AC-C）+ cascade health 接 `empty_response_without_retryable_cascade_health` 接口（AC-D2）。

F201 的目标不是让 Antigravity 静默失败，而是把老化 cascade、side effect、恢复动作拆清楚：无副作用的老化 cascade 可以 fresh retry；写过文件或状态不明时不能盲 retry，必须 surface resumable payload。

## Original Requirements

- 铲屎官当前指令：`走起！快快快 下一个phase！`
- 47 Phase C handoff：availability smoke runner + cascade health 接 Phase C gate 2。
- F201 spec：`docs/features/F201-antigravity-reliability-contract.md`

请对照判断：Phase D 是否真的接上了 Phase C 的 policy seam，而不是另起一套 parallel retry path。

## Architecture Ownership

- Architecture cell: `transport` + `bubble-pipeline`
- Map delta: none
- Reason: 这次只扩展现有 Antigravity provider、bridge、recovery policy 与 smoke script；没有新增 transport、store、queue、router、adapter、dispatcher 或 binding。

## Tradeoff

- Cascade health 先用 trajectory step/byte thresholds，而不是 live Antigravity 私有状态：可单测、可调参、不会依赖 IDE 内部实现。
- `empty_response` 只在 clean journal + retryable health 下 fresh retry：宁可少 retry，也不重复用户 side effect。
- Smoke runner 的 live thread/text 写入没有在 Phase D 单元测试里伪造完成：readonly + sentinel sandbox 已落地，真实 Antigravity 线程 alpha 证据留到 Phase E/alpha 验收。
- Sentinel mode 必须显式 `--allow-write`，并用 lock + leftover cleanup 约束写入边界。

## Open Questions

1. `empty_response_retryable_cascade_health` 的安全门是否足够严：side-effect gate 是否确实优先于 cascade health retry？
2. Pre-turn retire 的 silent `system_info` marker 是否足够用于诊断，且不会污染用户可见消息？
3. AC-C2/C3 是否接受当前 phase boundary：readonly health probe + sentinel sandbox 在 Phase D 完成，真实 text/thread smoke 留到 Phase E alpha/manual evidence？

## Next Action

请做双 review，重点看：

- Recovery policy 是否仍然是唯一 retry 决策入口。
- Cascade-health retry 是否不会绕过 side-effect journal。
- Smoke runner 是否足够保守，尤其 sentinel cleanup 和 live Antigravity 不可用时的 typed report。
- F201 spec/plan 的 Phase D 勾选是否过度声明。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f201/{reviewer-handle}`
- Start command: `pnpm review:start`
- Ports: `web=n/a`, `api=n/a`（本轮是 API/provider + script review，无前端 runtime 必需）

## 自检证据

### Red Tests

- `packages/api/test/antigravity-cascade-health.test.js` initially failed on missing `antigravity-cascade-health.js`.
- `scripts/antigravity-availability-smoke.test.mjs` initially failed on missing `scripts/antigravity-availability-smoke.mjs`.

### Green Tests

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test packages/api/test/antigravity-cascade-health.test.js packages/api/test/antigravity-recovery-policy.test.js
```

Result: 9 passed, 0 failed.

```bash
pnpm check:antigravity-smoke
pnpm antigravity:smoke --dry-run
```

Result: smoke tests 5 passed, including the <=350-line hard-limit guard; dry-run emitted typed `readonly_dry_run` report.

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api run build
env -u NODE_ENV pnpm --filter @cat-cafe/mcp-server run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/antigravity-*.test.js
```

Result: 308 passed, 0 failed.

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api test
pnpm check
git diff --check
pnpm check:features
pnpm check:architecture-ownership
```

Result: API 11216 passed / 3 skipped / 0 failed; root check passed; feature and architecture gates passed.

## 相关文件

- `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-cascade-health.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-recovery-policy.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityAgentService.ts`
- `packages/api/src/domains/cats/services/agents/providers/antigravity/AntigravityBridge.ts`
- `packages/api/test/antigravity-cascade-health.test.js`
- `scripts/antigravity-availability-smoke.mjs`
- `scripts/antigravity-smoke/*.mjs`
- `scripts/antigravity-availability-smoke.test.mjs`
- `docs/features/F201-antigravity-reliability-contract.md`
- `docs/plans/2026-05-15-f201-antigravity-reliability-contract.md`

[砚砚/GPT-5.5🐾]
