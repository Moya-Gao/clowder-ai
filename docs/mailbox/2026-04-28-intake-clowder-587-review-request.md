# Review Request: intake(clowder-ai#587) batch bugfixes

Review-Target-ID: fix-intake-clowder-587
Branch: fix/intake-clowder-587

## What

吸收已合入开源仓的 `clowder-ai#587`：Windows CLI shim / silent completion diagnostics、governance skill-sync、MLX embed-api Apple Silicon fallback、GPT special-token token counter，以及 queue/callback/provider CLI args 的 defense-in-depth 改动。

## Why

铲屎官要求这批社区修复走完整 intake 回家流程。`clowder-ai#587` 已 merge，且 `clowder-ai#234/#284/#327/#586/#591` 已由社区 PR 自动关闭；本 PR 按 `cat-cafe#1458` 的逐文件决策表 replay source intent 到 cat-cafe 当前 main。

## Original Requirements

> “那你走intake 回家的流程吧，merge 然后读sop 走流程回家”
> “记得一定要好好看看intake skills 大多数猫猫都会犯错”
- 来源：当前 thread（铲屎官 2026-04-28 23:06 PDT 指令）
- 请对照上面的原话判断：这次 intake 是否完整执行 SOP、逐文件吸收 source intent，并守住 cat-cafe 当前主线约束。

## Tradeoff

- `clowder-ai#567` 只吸收 backend provider `cliConfigArgs` runtime 支持；Hub 前端可见性仍是 refs-only，不在本 PR 关闭完整 AC。
- `clowder-ai#558` 只吸收 backend invocationId/callback defense；frontend root cause 不在本 PR 声明已修。
- Callback skip 的 stream-only metadata merge gap 已按 reviewer 要求跟踪到 `cat-cafe#1462`，本 PR 不声明该 gap 完成。
- `cat-cafe-skills/refs/shared-rules.md` 是 CI baseline unblock，已写入 `cat-cafe#1458` exception list；它不是 source PR 行为。

## Open Questions

1. `messages.ts` / queue busy 改动是否覆盖 #555 gap，同时不破坏 whisper、@mention、broadcast 的现有 routing 判断？
2. `route-serial.ts` 的 callback confirmed skip stream append 是否只避免重复气泡；stream-only metadata merge gap 已跟踪到 `cat-cafe#1462`。
3. 6 个 provider 的 `cliConfigArgs` dedup 是否只让用户覆盖同名 CLI flags，没有吞掉系统必须注入的 callback/MCP/session/env 参数？
4. `scripts/embed-api.py` / `scripts/embed-server.sh` 是否只吸收 #586 fallback 行为，没有改变 cat-cafe model defaults、ports、health API 和 OpenAI-compatible endpoint？
5. PR 文件集合是否完全符合 `cat-cafe#1458` 文件表 + exception list？

## Next Action

请 review `cat-cafe#1460`，并在 GitHub PR 留 formal review comment。review comment 必须写明覆盖的当前 HEAD SHA；intake record guard 需要 review-proof URL，聊天口头放行不算闭环。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-intake-clowder-587/opus-47`
- Start Command: `pnpm review:start`
- Ports: `web=review:start 分配`, `api=review:start 分配`（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规

- Intent Issue: `cat-cafe#1458`
- Absorb PR: `cat-cafe#1460`
- Source PR: `clowder-ai#587`
- Brand Guard: `bash scripts/intake-from-opensource.sh --validate-inbound` and `--from-index` -> pass
- Artifact Hygiene: 根目录媒体/设计工件检查 -> 无命中
- 设计稿 glob：没有匹配 intake/clowder/587；本 PR 无前端 UI 改动

### 测试结果

- `python3 -m py_compile scripts/embed-api.py` -> pass
- `bash -n scripts/embed-server.sh` -> pass
- `pnpm --filter @cat-cafe/api run build` -> pass
- `node --test packages/api/test/acp/acp-event-transformer.test.js` -> 13/13 pass
- `node --test packages/api/test/cli-spawn-win.test.js` -> 32/32 pass
- `node --test packages/api/test/connector-invoke-trigger.test.js` -> 38/38 pass
- `node --test packages/api/test/invocation-queue.test.js` -> 88/88 pass
- `node --test packages/api/test/queue-processor-zombie.test.js` -> 7/7 pass
- `node --test packages/api/test/route-serial-callback-dedup.test.js` -> 5/5 pass
- `node --test packages/api/test/token-counter.test.js` -> 12/12 pass
- `pnpm --filter @cat-cafe/api run lint` -> pass
- `pnpm check` -> pass
- `pnpm lint` -> exit 0; existing web warnings remain unrelated
- `pnpm -r --if-present run build` -> exit 0; existing web warnings remain unrelated

### 相关文档

- Intent Issue: `cat-cafe#1458`
- Absorb PR: `cat-cafe#1460`
- Tracking Issue: `cat-cafe#1462`
- Source PR: `clowder-ai#587`

[砚砚/GPT-5.5🐾]
