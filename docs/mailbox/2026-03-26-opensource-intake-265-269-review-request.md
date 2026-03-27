# Review Request: absorb clowder-ai#265 and #269

## What
Absorb two merged clowder-ai bugfix PRs into Cat Cafe:

- `clowder-ai#265`: builtin provider profile updates now silently ignore non-model fields and still apply model-list changes.
- `clowder-ai#269`: `start-windows.ps1` now sets UTF-8 encoding in the main script and all `Start-Job` runspaces for CJK Windows locales.
- Record both intake decisions in `docs/ops/opensource-intake-ledger.json`.

Review-Target-ID: opensource-intake-265-269
Branch: `feat/opensource-intake-265-269`
Commit: `585a2f337465e5a4aff2279be4757c05b876f18f`

## Why
These two PRs were merged into `zts212653/clowder-ai` on 2026-03-26 and both fix bugs that also exist in our home repo. `#265` is a shared API behavior bug; `#269` is a Windows startup script bug. We agreed to merge them upstream first, then intake them back home with the correct intake mode (`safe-cherry-pick` for `#265`, `manual-port` for `#269`).

## Original Requirements
> “@opencode @gpt52 来吧，加载一下开源管理 skills，去我们的开源社区看看这个 265 跟 269 这两个 PR 是干啥的。 以及我们要不要合入 和 takein”
> “@gpt52 按照你说的来吧！ 1-3这个 我同意你说的”
- 来源：当前 thread 对话（2026-03-26）
- 请对照上面的摘录判断：这次交付是否完成了“判断并执行 merge + take-in”这件事，而不是只停在分析。

## Tradeoff
- `#265` 按 `safe-cherry-pick` 直接吸收，保留 upstream 行为和测试。
- `#269` 没做整段脚本替换，只手工 port UTF-8 相关逻辑，避免把 `scripts/` 路径上的其他 target-side transform 噪音带回家里。
- 没有做 Windows 真机运行验证，因为当前环境没有 `pwsh` / `powershell`；这部分以 upstream CI 通过 + diff 对照替代。

## Open Questions
- `#269` 的 manual-port 范围是否够窄，没有漏掉任何与 UTF-8 相关的必要上下文？
- 这次 ledger `advance` 显示 “already at target HEAD (24740ee8...)”；请顺手看一眼这是否符合当前 intake 脚本预期。

## Next Action
请 review 这次 intake 的代码和 ledger 记录；如果没有 P1/P2，请放行我继续走后续 PR/merge 流程。

## 自检证据

### Spec 合规
- 按 `opensource-ops` 执行：先补 `triaged`，再 merge `clowder-ai#265/#269`，然后在家里 intake。
- `#265` 的 intake plan 分类为 `safe-cherry-pick (2 files)`。
- `#269` 的 intake plan 分类为 `manual-port (1 file)`。
- 两条 PR 都已 merge 到 `clowder-ai main`，并登记进 `docs/ops/opensource-intake-ledger.json`。

### 测试结果
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 node --test --test-timeout=60000 --test-name-pattern='builtin accounts silently ignore non-model fields' packages/api/test/provider-profiles-store.test.js` → 1 passed, 0 failed
- `pnpm --dir packages/api run lint` → success
- `pnpm --dir packages/api run build` → success
- `pnpm check` → success
- `packages/api/test/provider-profiles-store.test.js` 全文件运行时有 3 个无关失败，根因是本机缺少 `/Users/lysander/projects/cat-template.json`；本次新增/变更场景本身已单独验证通过
- Windows 脚本未做本机语法解析：当前环境无 `pwsh` / `powershell`

### 相关文档
- Intake ledger: `docs/ops/opensource-intake-ledger.json`
- Skill rule: `cat-cafe-skills/refs/opensource-ops-inbound-pr.md`
