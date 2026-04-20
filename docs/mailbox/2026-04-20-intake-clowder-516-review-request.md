# Review Request: intake(clowder-ai#516) F159 Phase D absorb

Review-Target-ID: intake-clowder-516
Branch: fix/intake-clowder-516

## What
吸收 `clowder-ai#516` 已 merge 的 F159 Phase D patch：
- `CatAgentService` 从单轮 text-only 升到 read-only tools + provider-internal agentic loop
- 新增 `catagent-read-tools.ts`，包含 `read_file` / `list_files` / `search_content`
- `workspace-security.ts` 补 realpath 后 denylist 二次校验，堵住 symlink alias denylist bypass
- 新增 `catagent-phase-d.test.js`，覆盖 tool registry、read-only tools、loop、overflow、first-turn error usage regression

## Why
这条社区 PR 已经 merge 到 `clowder-ai main`，而且 4 个文件全部落在 `packages/api/**` 共享路径。回家 intake 的目标是把社区已经验证过的 F159 Phase D 能力带回主真相源，同时避免 intake 常见事故：
- 不只 cherry-pick provider 能力，也把共享安全层修复和 Phase D 回归测试一起带回家
- 不跳过 Intent Issue / review / ledger strict guard
- 不把 public repo 的品牌差异或 unrelated baseline 噪音误判成这次吸收本身的问题

## Original Requirements（必填）
> Add three read-only tools (`read_file`, `list_files`, `search_content`) to CatAgent native provider.  
> Implement multi-turn agentic loop: `stop_reason: 'tool_use'` → execute → tool_result → re-call API until terminal.  
> Not in scope: compaction; write/edit/delete tools (ADR-001 prohibition).  
> F159 Phase D only after host security boundaries are already reused.  
- 来源：`clowder-ai#515`, `docs/features/F159-catagent-native-provider.md`
- **请对照上面的摘录判断：这次 absorb 是否既完整带回了 AC-D1 / AC-D2，又没有突破 ADR-001 和 F159 已定边界**

## Tradeoff
这次我保留了 upstream 的单 patch 形状，用 `format-patch | git am -3` 直接吸收已 merge 的 squash commit，没有顺手在家里重写成另一套 provider 抽象。代价是本分支保留了社区 patch 的原提交边界；好处是 reviewer 可以逐文件对照 `cat-cafe#1308` 验证，没有“我顺便优化了一圈”带来的额外噪音。

## Open Questions
1. `cat-cafe#1308` 的 4 个 `absorb` 文件是否都在本分支完整落地，没有漏掉共享安全层或测试层？
2. `workspace-security.ts` 的 denylist 二次校验会不会对现有 workspace routes 引入意外回归？
3. `CatAgentService.handleFetchError()` 的 usage 修复是否足够守住“首轮 error 仍有零 usage”的终态契约？
4. `pnpm check` 当前卡住的是 unrelated baseline 格式漂移；在这个前提下，你是否同意这次 intake 先按“变更面验证已充分”继续放行？

## Next Action
请按 Intake Review Guard 对照 `cat-cafe#1308` 做 review，重点看：
1. 4 个 `absorb` 文件和 Intent Issue 决策表是否一一对应；
2. shared security 修复有没有被完整带回，不只留在 CatAgent 测试层；
3. Phase D 的 tests 是否真的覆盖了上轮挡住的 usage regression；
4. 通过后请在 absorb PR 上留 formal review/comment，我再走 `--record --advance-ledger`。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/intake-clowder-516/opus`
- Start Command: `pnpm review:start`
- Ports: 纯后端改动，无需启动服务；如需起 review sandbox，使用 `review:start` 自动分配（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规
- Intake Intent Issue：`cat-cafe#1308`
- Quality Gate：`docs/mailbox/2026-04-20-intake-clowder-516-quality-gate.md`
- Community Issue：`clowder-ai#515`
- Community PR：`clowder-ai#516`
- `bash scripts/intake-from-opensource.sh --pr 516 --mode=plan` → `4 safe-cherry-pick`
- `bash scripts/intake-from-opensource.sh --validate-inbound` → `✓ No brand violations detected`

### 测试结果
- `pnpm --filter @cat-cafe/api build` → success
- `bash ./scripts/with-test-home.sh node --test --test-timeout=60000 test/catagent-phase-d.test.js test/catagent-provider.test.js test/catagent-security-baseline.test.js test/catagent-phase-b-completion.test.js test/workspace-security.test.js` → `112 passed, 0 failed`
- `pnpm --filter @cat-cafe/api test` → `8936 passed, 0 failed, 1 skipped`
- `pnpm lint` → success（仅 existing warnings）
- `pnpm build` → success（仅 existing warnings）
- `pnpm check` → blocked by pre-existing unrelated formatter failure in `packages/api/test/f148-phase-g.test.js`
- `git diff --check` → clean

### 相关文档
- Feature: `docs/features/F159-catagent-native-provider.md`
- Decision: `docs/decisions/001-agent-invocation-approach.md`
- Intake Intent: `cat-cafe#1308`
- Quality Gate: `docs/mailbox/2026-04-20-intake-clowder-516-quality-gate.md`
- Source Issue: `clowder-ai#515`
- Source PR: `clowder-ai#516`
