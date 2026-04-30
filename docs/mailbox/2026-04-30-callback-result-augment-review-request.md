---
feature_ids: []
related_features: [F022, F117, F175]
doc_type: review_request
status: open
last_updated: 2026-04-30
---

# Review Request: Callback result metadata augment after F5 reload

Review-Target-ID: fix-callback-result-augment
Branch: fix/callback-result-augment

## What
- `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
  - Teach `parseCallbackPostResult()` to extract the callback JSON payload from Codex-style MCP tool output shaped as `mcp:server/tool (completed)\n{...}`.
  - Preserve `messageId` / `threadId` extraction so route-serial can augment the callback-stored message instead of losing stream-only metadata.
- `packages/api/test/route-serial-callback-dedup.test.js`
  - Add a regression covering prefixed MCP tool results plus buffered audio rich blocks.
  - Assert no duplicate stream bubble is stored, and `thinking`, `toolEvents`, `extra.stream`, and `extra.rich.blocks` are merged into the callback message for F5 recovery.

## Why
Runtime evidence showed the test voice message existed live, but after F5 only the plain callback text remained. The stored callback message had no `thinking`, no `toolEvents`, and no `extra.rich.blocks`.

The root cause is that Codex MCP tool results include a human-readable prefix before the JSON payload. The old parser confirmed `"status":"ok"` via substring fallback, so it skipped the duplicate stream append, but it failed to recover `messageId`. Without `messageId`, the existing `augmentStreamMetadata()` path could not attach CLI/thinking/audio metadata to the callback message.

## Original Requirements（必填）
> "我f5刷新之前是正常的我看到了你的气泡 语音的气泡 也听了！"
> "然后我按了f5 你的cli 气泡thinking气泡包括语音都没了！？"

- 来源：2026-04-30 当前 thread 铲屎官原话和截图；这是 runtime regression report，没有独立 repo discussion 文档。
- 请 reviewer 对照判断：本 patch 是否让 callback-posted Codex replies 在刷新后恢复 live 时已有的 CLI/thinking/audio metadata，而不重新引入重复气泡。

## Tradeoff
- 采用 route-serial parser 修复，不改 frontend hydration，也不改 `create-rich-block` callback contract。
- 好处：修在已经存在的 single source of truth augment path 上，保留 #573/#1492 的“callback 已持久化就不再存第二个 stream bubble”语义。
- 代价：仍需容忍 tool result 有 transport prefix；长期更干净的方案是 provider transform 给 `tool_result` 保留结构化 raw payload，但这比当前回归修复范围大。

## Open Questions
- 请重点看 JSON candidate extraction 是否足够窄：它只接受带 `status` 的 callback payload，避免把无关 JSON 当作 post-message success。
- 请确认 buffered audio rich block 走 `extra.rich.blocks` augment 后，不会和 #1494 的 frontend dedupe 互相打架。
- Fallback layer guard 因 `route-serial.ts` 文件历史累计 fallback 层较多触发自检；本 diff 对该文件 fallback 净变化为 -1，判断为修正解析坐标而非新增兜底层。

## Next Action
请 review this branch，重点看：
1. Codex-style prefixed MCP result 是否能稳定提取 `messageId`。
2. callback message augment 是否覆盖 F5 恢复需要的 `thinking/toolEvents/richBlocks`。
3. 是否存在误确认其他工具 JSON 输出为 `cat_cafe_post_message` 的风险。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/fix-callback-result-augment/opus`
- Start Command: `pnpm review:start`
- Ports: backend-only unit review; no dev server required. If reviewer starts sandbox, avoid runtime ports `3001/3002/3011/3012/4111`.

## 自检证据

### Spec 合规
- Root cause：Codex `tool_result` content has MCP prefix before JSON; old parser could confirm success but not extract `messageId`, so stream metadata augment was skipped.
- Fix scope：API route-serial callback result parsing + regression test only.
- 根目录工件闸门：工作树和 committed diff 均无根目录媒体/设计工件。
- Hotfix guard：`node scripts/check-hotfix-pattern.mjs` -> `hotfix=false`.
- Fallback layer guard：triggered by historical total layers in `route-serial.ts`; this patch has net fallback change `-1`, and the remaining JSON parse try/catch is required at the transport boundary.
- UI/design：no frontend files changed; `.pen` design comparison not applicable.

### 测试结果
- `pnpm --dir packages/api run build`
  - passed.
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/route-serial-callback-dedup.test.js`
  - 15 tests passed, 0 failed.
- `pnpm --dir packages/api run lint`
  - passed.
- `pnpm biome check packages/api/src/domains/cats/services/agents/routing/route-serial.ts packages/api/test/route-serial-callback-dedup.test.js --diagnostic-level=error`
  - passed.
- `pnpm check`
  - passed.

### 相关文档
- Source regression report: current thread, 2026-04-30.
- Related rich block persistence invariant: F022.
- Related callback/queue delivery invariants: F117 / F175.
