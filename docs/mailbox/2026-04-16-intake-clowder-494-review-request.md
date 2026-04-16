# Review Request: intake(clowder-ai#494) F159 phase-b prework

Review-Target-ID: intake-clowder-494
Branch: fix/intake-clowder-494

## What
吸收 `clowder-ai#494` 已 merge 的 F159 Phase B prework slice：
- 新增 `packages/api/src/domains/cats/services/agents/providers/catagent/catagent-event-bridge.ts`
- 新增 `packages/api/src/domains/cats/services/agents/providers/catagent/catagent-tool-guard.ts`
- 新增 `packages/api/test/catagent-phase-b-completion.test.js`
- 新增本轮 quality-gate 报告 `docs/mailbox/2026-04-16-intake-clowder-494-quality-gate.md`

## Why
这条社区 PR 对应的是 F159 Phase B 里剩下的两块安全/审计 prework：工具参数注入防护和 provider terminal-state audit bridge。回家 intake 的目标不是“把社区 helper 文件照搬回来”这么简单，而是把这条已经在 maintainer review 中收敛过的 prework slice、行为边界和回归测试一起准确吸收，避免双仓在 CatAgent 安全语义上继续漂移。

## Original Requirements
> AC-B3: 工具参数注入防护在 host/provider integration layer 落地，有针对性测试  
> AC-B4: provider 的 `done/error/usage` 终态审计在现有链路中可验证

- 来源：[`docs/features/F159-catagent-native-provider.md`](../features/F159-catagent-native-provider.md)
- 对应社区 issue：`clowder-ai#491`
- **请对照上面的摘录判断：这次 absorbed 是否完整覆盖了 prework 边界，同时没有把“helper 已存在”误说成“runtime integration 已完成”**

## Tradeoff
我没有把这次 intake 扩成“顺手把 CatAgent provider 接进 runtime，再把 AC-B3/B4 一次性打勾”。
取舍是：严格保持与 `clowder-ai#494` 已 merge 边界一致，只吸收 helper + tests；代价是 F159 的真正 integration closure 仍留在后续 Phase C/provider wiring，而不是在这次 absorbed 里扩大 diff。

## Open Questions
- 我吸收的 3 个文件是否与 `cat-cafe#1211` 的逐文件决策表完全一致，没有漏项或越界？
- 这组 36 条新增测试，再加既有 17 条 security baseline regression，是否足以支撑 `record + advance-ledger` 前的 review guard？
- 以 reviewer 视角看，是否还需要额外补 “invoke-single-cat 链路级” 的集成验证，还是当前 prework scope 已经自洽？

## Next Action
请对照 `cat-cafe#1211` 和 `cat-cafe#1212` 做 formal review，确认：
1. 三个 `absorb` 文件都已经完整落地；
2. 没有把 Phase C runtime wiring / Phase D tool registry 混进来；
3. `done` 语义仍与现有 audit chain 兼容，没有重新引入 premature done；
4. 现有验证证据足以支持后续 `record + advance-ledger`。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-494/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规（quality-gate 摘要）
- Feature：`docs/features/F159-catagent-native-provider.md`
- Intake Intent Issue：`cat-cafe#1211`
- Quality Gate：`docs/mailbox/2026-04-16-intake-clowder-494-quality-gate.md`
- Community PR：`clowder-ai#494`
- `bash scripts/intake-from-opensource.sh --pr 494 --mode=plan` → 3 个文件，全部 `safe-cherry-pick`
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected`
- Root artifact hygiene：无根目录媒体/设计工件命中

### 测试结果
- `pnpm --dir packages/api build` → success
- `node --test packages/api/test/catagent-phase-b-completion.test.js` → `36 passed, 0 failed`
- `node --test packages/api/test/catagent-security-baseline.test.js` → `17 passed, 0 failed`
- `pnpm lint` → success（仅现存 web warnings）
- `pnpm check` → success
- `pnpm -r --if-present run build` → success（仅现存 web warnings）
- `git diff --check` → clean

### 相关文档
- Quality Gate：`docs/mailbox/2026-04-16-intake-clowder-494-quality-gate.md`
- Intake Intent：`cat-cafe#1211`
- Source Issue：`clowder-ai#491`
- Source PR：`clowder-ai#494`
- Absorb PR：`cat-cafe#1212`
