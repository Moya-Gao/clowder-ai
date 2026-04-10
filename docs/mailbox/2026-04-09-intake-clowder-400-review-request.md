---
topics: [review-request, intake, clowder-ai, acp]
doc_kind: mailbox
created: 2026-04-09
---

# Review Request: clowder-ai#400 Intake

Review-Target-ID: intake-clowder-ai-400-acp-windows-spawn
Branch: `feat/intake-clowder-400`

## What

把 `clowder-ai#400` 的 ACP Windows `.cmd` shim 修复吸收到 Cat Café：

- 在社区 PR 分支上补推 lint fixup，批准 workflow，补 maintainer approval，并完成 squash merge
- 在 source worktree 里把 `AcpClient` 的 Windows fallback 逻辑带回家
- 同步吸收 ACP Windows 回归测试 `packages/api/test/acp/acp-client-windows-spawn.test.js`
- 创建 Intake Intent Issue `cat-cafe#1022`
- 记录 `docs/ops/opensource-intake-ledger.json`：`clowder-ai#400 -> absorbed`

## Why

这个 bug 是共享代码缺口，不是开源仓特有问题。`AcpClient` 原本直接 `spawn(command, args)`，在 Windows 上会撞到 `.cmd` shim 的 `ENOENT` 路径。社区 PR 修复方向对，家里同一调用链也有同样问题，所以应该 merge 并 intake。

## Original Requirements

> “我感觉这个bug得早点改 但是等社区小伙伴过pr有点慢我们能帮他推commit 让他过现在的ci吗？然后合入 然后intake回家”
> “动手！ 然后记得intake回家要走流程 我们的skills的流程，然后最后让布偶猫帮你看intake流程是不是完整走了”

- 来源：当前 thread 对话（2026-04-09）
- 请对照上面的摘录判断：这次交付是否真的做到了“社区 PR 合入 + source intake 按流程落地 + 流程完整性可审”，而不是只停在代码 patch。

## Tradeoff

- 没有为追求 ledger 立即前进而使用 `--force-overwrite`，因为 auto-advance 报出两个更早的未登记社区 PR：`clowder-ai#399`、`clowder-ai#394`
- 因为 `pnpm check` 受 `docs/features/index.json is stale` 的既存基线问题影响，这轮自检证据聚焦于 ACP 相关 build/test、Brand Guard、community merge、ledger record
- 按我们家 SOP，这里先停在 review-ready，请你检查 intake 流程是否完整，再决定要不要开 source PR 继续 merge gate

## Open Questions

1. 这轮 intake 停在“已 record，但未 advance”是否是正确边界？还是应该把 `#394/#399` 一并补记后再算流程完整？
2. 以这轮 scope 而言，focused regression set 是否足够，还是还要补一条更显式的 non-Windows / injected-`spawnFn` 交叉断言？
3. 你是否同意这里先 request-review，再开 source PR，而不是先开 PR 再请你验 intake 流程？

## Next Action

请重点 review：

- 这次 intake 是否完整走了 `opensource-ops` 的关键闭环：Intent Issue、worktree、TDD、community merge、ledger record
- `ledger advance` 被更早未登记 PR 阻塞时，我这次选择“不 force、先显式升级 reviewer”是否正确
- 如果没有 P1/P2，请放行我继续开 source PR，把 `cat-cafe#1022` 挂上 `Closes #1022`

## 自检证据

### Quality Gate

- 报告：`docs/mailbox/2026-04-09-intake-clowder-400-quality-gate.md`

### 测试结果

```bash
# clowder-ai PR branch
pnpm check
pnpm --filter @cat-cafe/api run build
cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 \
  node --test test/acp/acp-client-windows-spawn.test.js test/acp/acp-client.test.js

# cat-cafe intake branch
pnpm --filter @cat-cafe/api run build
cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 \
  node --test test/acp/acp-client-windows-spawn.test.js test/acp/acp-client.test.js test/cli-spawn-win.test.js
bash scripts/intake-from-opensource.sh --validate-inbound
bash scripts/intake-from-opensource.sh --record --pr 400 --decision absorbed
pnpm check
```

结果：

- community side checks/build/tests ✅
- source side API build ✅
- source side focused regression set `54 passed, 0 failed` ✅
- Brand Guard ✅
- ledger record ✅
- ledger auto-advance blocked by old unrecorded PRs `#399/#394` ⚠️
- repo-wide `pnpm check` 受既存 stale feature index 影响，未作为本轮 diff blocker ⚠️

### 相关文档

- Intake Intent Issue: `cat-cafe#1022`
- Quality Gate: `docs/mailbox/2026-04-09-intake-clowder-400-quality-gate.md`
- Intake ledger: `docs/ops/opensource-intake-ledger.json`
- Skill rule: `cat-cafe-skills/refs/opensource-ops-inbound-pr.md`
