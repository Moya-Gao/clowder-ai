# Review Request: intake(clowder-ai#455) callback invocationId broadcast fix

Review-Target-ID: intake-clowder-455
Branch: fix/intake-clowder-455

## What
吸收 `clowder-ai#455` 的 3 个共享 API 改动：
- `packages/api/src/routes/callbacks.ts`：callback text / rich_block 广播统一携带 `invocationId`
- `packages/api/src/routes/callback-document-routes.ts`：generate-document 广播补 `invocationId`
- `packages/api/test/callback-routes.test.js`：补 4 个协议级回归测试，锁住所有 callback broadcast 路径

## Why
`clowder-ai#410` 已经证明前端 heuristic 止血会持续堆复杂度；`clowder-ai#455` 改成协议层修复，直接让 callback-origin websocket payload 稳定带上 `invocationId`，前端可以 exact-match 回原 stream bubble。

这次 intake 的目标不是“再设计一版”，而是把公开仓已经 merge 的协议级根治准确吸收回家，避免双仓在 callback 合约上继续漂移。

## Original Requirements
> “怎么前端还有重复消息显示的问题的；#378 #266 这两个pr不都反复改了的”

- 来源：`clowder-ai#455` PR body（摘录自铲屎官原始反馈，关联 `clowder-ai#454`）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
放弃继续吸收 `clowder-ai#410` 的客户端 heuristic（`fencedAt / matchKind / callbackBridge`），改吸收 `#455` 的协议层不变量。代价是需要同步维护 callback broadcast 的所有出口；收益是前端 dedup 不再依赖内容猜测。

## Open Questions
- 我吸收的 3 个文件是否与 `cat-cafe#1117` 的逐文件决策表完全一致，没有漏掉任何 callback-origin broadcast 出口？
- 4 个新增回归测试是否足以覆盖这次协议不变量，还是还应再补 background-thread / rich-block 变体？
- 这次 intake 作为 `absorbed` 是否可以直接提 merge，还是你认为还需要额外扩大验证面？

## Next Action
请按 `cat-cafe#1117` 对照 review，确认：
1. 3 个 `absorb` 文件都已落地；
2. 没有引入额外 scope；
3. 验证证据足够支持后续 merge。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-455/opencode`
- Start Command: `pnpm review:start`
- Ports: `web=3301`, `api=3302`

## 自检证据

### Spec 合规
- Intake Intent Issue：`cat-cafe#1117`
- `bash scripts/intake-from-opensource.sh --pr 455 --mode=plan` → 3 个文件全部分类为 `safe-cherry-pick`
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected`
- 本次无 `packages/web/**` 改动；设计稿对照不适用

### 测试结果
- `pnpm --filter @cat-cafe/api run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 node --test packages/api/test/callback-routes.test.js` → `80 passed, 0 failed`
- `pnpm --filter @cat-cafe/api run lint` → success
- `pnpm biome check packages/api/src/routes/callbacks.ts packages/api/src/routes/callback-document-routes.ts packages/api/test/callback-routes.test.js --diagnostic-level=error` → clean
- `git diff --check` → clean
- `pnpm check` → **blocked by pre-existing unrelated errors** in `packages/ppt-forge/scripts/html-slide-to-pptx.ts`（imports/format），不是本次 intake 引入

### 相关文档
- Intake Intent: `cat-cafe#1117`
- Source Issue: `clowder-ai#454`
- Source PR: `clowder-ai#455`
