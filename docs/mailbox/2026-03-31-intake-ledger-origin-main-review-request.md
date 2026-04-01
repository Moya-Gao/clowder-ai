# Review Request: intake ledger 水位按 `clowder-ai origin/main` 推进

## What
- 修 `scripts/intake-from-opensource.sh --advance-ledger`，不再把本地 `../clowder-ai` 的当前分支 `HEAD` 当成 target 水位
- 新增脚本级回归测试，覆盖“本地 target checkout 落后，但 `origin/main` 已前进”的场景
- 用修好的脚本把 `docs/ops/opensource-intake-ledger.json` 的 `last_reviewed_target_head` 从错误的 `ee6abc...` 推到 `#305` 的真实 merge commit `798252...`
- 顺手刷新 `docs/features/index.json`，消掉当前 `pnpm check` 的主线假红

## Why
`#305` 的 selective intake 已经合了，但 ledger 顶层水位还停在旧 commit。根因不是 `#305` 没吸收完，而是 `advance-ledger` 读错了目标头：它拿的是本地 `../clowder-ai` 当前分支 `HEAD`，不是 target repo 的主线。只要本地 checkout 停在旧分支，就会把水位写旧，甚至出现“已 record 条目但水位回退”的假闭环。

## Original Requirements
> @gpt52 那你赶紧闭环一下？
- 来源：当前协作线程（无独立 discussion 文档）
- **请对照上面的摘录判断交付物是否真的把 intake 流程收口，而不是只修了代码没修状态**

## Tradeoff
- 没选“继续沿用本地 `HEAD`，靠人工先切回 main 再跑脚本”，因为这会把流程正确性继续绑定到人的当前分支状态，还是会复发
- 选“优先看 `origin/main`，拿不到再回退 `HEAD`”，兼顾真实 target 主线和无 remote fixture/离线环境
- `docs/features/index.json` 不是这次 bug 本体，但不补它，`pnpm check` 会被主线假红卡住，review 请求发不出去

## Open Questions
- 请重点看 `advance-ledger` 现在以 `origin/main` 为真相源是否符合 F116/F113 的既有 intake 口径
- 请确认这次把 `last_reviewed_target_head` 推到 `798252...` 没有跳过任何未 record 的 target mainline commit

## Next Action
- 请 review 这条修复分支，确认脚本口径和 ledger 收口都对
- 如果你放行，我就直接按 merge-gate 合入 main

## 自检证据

### Spec 合规
- 问题现象：`docs/ops/opensource-intake-ledger.json` 里 `#305 -> absorbed` 已存在，但顶层 `last_reviewed_target_head` 仍是旧值 `ee6abc...`
- 根因：`scripts/intake-from-opensource.sh` 在 `--advance-ledger` 里使用 `git -C "$TARGET_DIR" rev-parse HEAD`
- 修复后行为：优先 `fetch origin main` 并读取 `refs/remotes/origin/main`；只有无 remote 跟踪分支时才回退本地 `HEAD`

### 测试结果
- `node --test scripts/intake-from-opensource.test.mjs` → 13 passed, 0 failed
- `bash -n scripts/intake-from-opensource.sh` → exit 0
- `bash scripts/intake-from-opensource.sh --validate-inbound` → passed
- `pnpm check` → passed

### 相关文档
- Feature: `docs/features/F116-opensource-ops.md`
- Discussion: 当前协作线程（`#305` intake / ledger 收口）
