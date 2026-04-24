# Review Request: intake(clowder-ai#546) F153 Phase E implementation — Opus second opinion

Review-Target-ID: intake-clowder-546
Branch: fix/intake-clowder-546
PR: cat-cafe#1375
HEAD: f2dc139429cd8514de37b552453a154c7242886b

## What
请对 `cat-cafe#1375` 做一轮**独立、从头开始的 cross-family review**。

当前 PR 头 `f2dc13942` 里：
- 功能修复主要在 `4f5258a5`
  - 恢复 `packages/api/src/index.ts` 里被 upstream 覆盖掉的 ACP bootstrap / InvocationRegistry 主线逻辑
  - 恢复 `route-serial.ts` / `route-parallel.ts` 的 mainline 行为：
    - `parentInvocationId` 对齐
    - ping-pong 豁免（substantive tool / long text）
    - verdict-no-pass hint
    - cumulative thinking dedup
    - 同时保留 `#546` 需要的 telemetry `routeSpan` 透传
  - 清掉 `docs/features/index.json` 的 rebase conflict marker
- `f2dc13942` 本身是 docs-only：
  - 新增 `docs/mailbox/2026-04-24-intake-clowder-546-r2-review-request.md`

## Why
这条 intake 之前已经经过一轮 reviewer 循环，但铲屎官怀疑前一位 reviewer 的 agent 状态不稳，希望我们补一轮**更严、独立、不沿用旧结论**的复审。

也就是说，这轮 review 的目标不是“确认小金说得对不对”，而是：
- 把 `cat-cafe#1375` 当成一个当前独立待审的 absorb PR
- 只看代码、spec、测试、门禁证据
- 自己下 maintainer 结论

## Tradeoff
- 我没有再去改代码；author 侧当前停在 `review ready`
- 所以你看到的是一个已经：
  - 过了定向回归
  - 过了 `pnpm gate`
  - 但还没有拿到你这边独立结论
  的版本

## Open Questions
1. `4f5258a5` 这轮修复是否真的是“最小必要主线回补”，没有把 unrelated 主线修复偷带进 intake？
2. `index.ts` / `route-serial.ts` / `route-parallel.ts` 现在是否同时满足：
   - 不回退家里 `main`
   - 不丢 `clowder-ai#546` 的 telemetry / observability 改动
3. 以 maintainer 标准看，`cat-cafe#1375` @ `f2dc13942` 现在是否可合？

## Next Action
请直接 review `cat-cafe#1375` @ `f2dc13942`。  
重点看功能修复 commit `4f5258a5`，不要被旧的 `#1372` / `2ab38931` / 既有 reviewer 结论带偏。

## 自检证据
- 定向回归：
  - `pnpm --dir packages/api exec node --test test/acp/acp-bootstrap-cwd.test.js test/route-serial-parent-invocation-id.test.js test/route-serial-pingpong.test.js test/route-serial-verdict-hint.test.js test/route-strategies.test.js`
  - 结果：`116 passed, 0 failed`
- 全量门禁：
  - `pnpm gate`
  - 结果：`GATE PASSED`
- PR 页面 author follow-up：
  - `https://github.com/zts212653/cat-cafe/pull/1375#issuecomment-4313376717`
