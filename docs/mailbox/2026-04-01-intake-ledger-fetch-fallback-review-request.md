# Review Request: fix(ops) intake ledger fetch-fail fallback

Review-Target-ID: intake-ledger-fetch-fallback
Branch: fix/intake-ledger-fetch-fallback

## What
- 修正 `resolve_target_main_head()`：只有在 `git fetch origin main` 成功时才信任 `refs/remotes/origin/main`
- 当 fetch 失败时，明确 fallback 到 target repo 的本地 `HEAD`
- 新增回归测试，覆盖 “fetch 失败 + 本地残留 stale `origin/main` ref” 场景

## Why
`cat-cafe#901` 合并后，云端 review 在 inline comment 里补抓到一个 P1：当前实现会在 fetch 失败时继续使用陈旧的 `origin/main`，从而把 ledger 错判为 “already at target HEAD”。这会让 `--advance-ledger` 在 target remote 暂时不可达时漏推进水位。

## Original Requirements（必填）
> @gpt52 把这个 fetch-fail/stale-remote-ref 的 P1 收掉。
- 来源：当前 thread（2026-04-01 06:13，铲屎官）
- **请对照上面的摘录判断交付物是否真的把这条 P1 收干净**

## Tradeoff
- 没做更激进的 remote/source-of-truth 重构，只修正 fetch 失败时的决策分支
- 保留 “fetch 成功 → 用 `origin/main`；fetch 失败 → 用本地 `HEAD`” 的两级策略，避免扩大到其他 intake/ledger 路径

## Open Questions
- 这个 fallback 边界是否足够精确：只有 fetch 成功才读 `refs/remotes/origin/main`，否则直接退回本地 `HEAD`
- 测试场景是否完整覆盖 reviewer 的 deterministic repro

## Next Action
- 请按 P1 审查口径 review 这次修复是否把 `#901` 遗漏的 inline finding 收掉

## 自检证据

### Spec 合规
- 目标明确且收敛：只修 `fetch-fail/stale-remote-ref` 这一条 merged-after-review P1
- 无 UI / 无设计稿 / 无 runtime 变更
- 修改面仅限：
  - `scripts/intake-from-opensource.sh`
  - `scripts/intake-from-opensource.test.mjs`

### 测试结果
- `node --test scripts/intake-from-opensource.test.mjs` → 14 passed, 0 failed
- `bash -n scripts/intake-from-opensource.sh` → exit 0
- `bash scripts/intake-from-opensource.sh --validate-inbound` → pass
- `pnpm check` → pass

### 相关文档
- Mailbox: `docs/mailbox/2026-04-01-intake-ledger-fetch-fallback-review-request.md`
- Related PR: `cat-cafe#901`
