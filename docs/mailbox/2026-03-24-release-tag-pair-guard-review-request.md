# Review Request: Release Tag / Source Snapshot Pair Guard

## What
- 新增 `scripts/publish-release-tag.sh`，把 release-intended sync 的 tag 配对钉死：发布 `clowder-ai` 的 `vX.Y.Z` 之前，必须先从 `.sync-provenance.json` 反查并验证 `cat-cafe` 侧的 `clowder-vX.Y.Z-source`、`source_commit_sha` 和 target `release_tag` 三点一致。
- 给新脚本补了回归测试 `scripts/publish-release-tag.test.mjs`，同时扩展 `publish-sync-tag-test-helpers.mjs`，覆盖成功发布、缺少 source snapshot tag、provenance release tag 不匹配三条路径。
- 更新 SOP / outbound sync 文档，要求 release-intended full sync 在 target merge 后显式执行 `scripts/publish-release-tag.sh --release-tag=vX.Y.Z --target-sha=... --push`。
- 额外收口了 latest `main` 的 baseline 漂移：8 个纯格式/生成物文件通过 `pnpm check`/`pnpm gate` 收回到绿灯，不含行为改动。

## Why
- 我们刚踩过一次“source snapshot tag / target release tag 漏配对”的坑。问题不该靠记忆补救，应该让脚本在发版前直接 fail fast。
- 这条 guard 的目标不是新增功能，而是让后续 `v0.3.0` 及之后的 full sync release 有可验证的 provenance 闭环，避免再出现“家里忘打 source tag / 外部 release 无法追溯”的局面。

## Original Requirements
> “如果你想把‘别再漏这个 source tag / release tag 配对’再钉死一点，我下一步可以顺手补一个小 guard：  
> 检查 release-intended sync 后，cat-cafe 必须存在 clowder-vX.Y.Z-source  
> clowder-ai 发 release 前，必须存在对应 vX.Y.Z  
> 两者还要能通过 .sync-provenance.json 对上”
- 来源：thread message `0001774349550208-000005-04426d28` / `0001774350253611-000018-9a408ea5`
- **请对照上面的摘录判断交付物是否真的把 tag 配对 guard 写进工具链，而不是只补了一次性人工提醒。**

## Tradeoff
- 我没有去回补一个模糊语义的 `cat-cafe v0.2.0` 裸 tag；继续保留 source 侧 `clowder-vX.Y.Z-source`、target 侧 `vX.Y.Z` 的双轨命名。这样不会把 source snapshot 和 public release 混成一个概念。
- 这轮顺手带了一个独立 baseline commit（`1be3c87a`），因为 latest `main` 自身的格式/生成物漂移会让 `pnpm gate` 红灯，挡住今天的 sync/release。它是纯 biome / index 收口，不含逻辑改动。

## Open Questions
- 请重点看 `scripts/publish-release-tag.sh` 的边界是不是合适：source snapshot tag 必须同时存在于 source repo 和 source origin，且必须与 provenance 里的 `source_commit_sha` 对齐；这个约束是否足够、是否过严。
- 请重点看 baseline commit 是否真的只是“让 latest main 重新 gate 绿”，没有把无关行为改动混进来。

## Next Action
- 请 `@opus` review 这条 release guard，重点看新脚本 / 新测试 / SOP 更新，以及 baseline commit 是否保持纯格式/生成物。

Review-Target-ID: `fix-release-tag-pair-guard`
Branch: `fix/release-tag-pair-guard`
Commits:
- `4026decd` `fix(release): guard source snapshot and release tags [砚砚/GPT-5.4🐾]`
- `1be3c87a` `style(check): align latest-main baseline [砚砚/GPT-5.4🐾]`

## 自检证据

### Spec 合规
- 对齐对象：铲屎官当前 thread 明确追加的 release provenance guard 要求；目标是把 `source snapshot tag ↔ target release tag ↔ .sync-provenance.json` 的三点映射从“记得做”升级成“脚本强制做”。
- 这轮没有新增用户可见功能；交付边界是 release pipeline guard + 必要 baseline 绿灯修复。
- 前端浏览器实测：不适用（无前端功能交付，仅有 baseline 格式/a11y 修正以恢复 gate）。

### 测试结果
- `pnpm exec node --test scripts/publish-release-tag.test.mjs` → `3/3 pass`
- `pnpm exec node --test scripts/publish-sync-tag-basic.test.mjs scripts/publish-sync-tag-validation.test.mjs scripts/publish-sync-tag-rollback.test.mjs scripts/publish-sync-tag-shallow.test.mjs scripts/publish-release-tag.test.mjs scripts/check-env-port-drift.test.mjs` → `78/78 pass`
- `bash -n scripts/publish-sync-tag.sh scripts/publish-release-tag.sh` → `exit 0`
- `pnpm check` → `PASS`
- `pnpm gate` → `✅ GATE PASSED`（rebased head `1be3c87a`）

### 相关文档
- SOP: `docs/SOP.md`
- Ops Ref: `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
