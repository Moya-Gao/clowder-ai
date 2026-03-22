# Review Request: release provenance alignment for outbound sync

Review-Target-ID: fix-release-provenance-alignment
Branch: fix/release-provenance-alignment

## What
- 给 `scripts/sync-to-opensource.sh` 增加 `--release-tag=vX.Y.Z`，用于 release-intended full sync
- source-owned public gate 通过后，自动创建并 push `clowder-vX.Y.Z-source`
- 把 `release_tag` / `source_snapshot_tag` 写入 `.sync-provenance.json`
- 更新 `opensource-ops` skill、outbound sync ref、`docs/SOP.md`，把三点映射规则写死
- 补静态断言，确保：
  - sync tag 仍然只由 `publish-sync-tag.sh` 在 post-merge lane 发布
  - release-intended source snapshot tag 由 sync 脚本自己创建

## Why
我们已经确认：`clowder-ai` 的 release tag 不会和家里 `cat-cafe` 一一同 SHA 对应，因为 sync transform 和 public-only 修补天然会产生 target 专属 commit。问题不是“让 SHA 一样”，而是把 `source snapshot tag → target release tag → backport commit` 做成显式、可追溯的硬规则，不能再靠人记。

## Original Requirements
> “之后要如何拉齐这个问题的？”  
> “不是强行让家里和开源仓‘同一个 SHA’，而是把‘一个开源 release 对应哪一个 source snapshot、叠了哪些 public-only 修补、哪些 sync-managed 又回补回家’这条链显式记下来。”  
> “source tag 应该由 sync-to-opensource.sh 自动打，不靠人记。”  
> “provenance mapping 已经有一半基础了……往 `.sync-provenance.json` 里追加 `release_tag` 字段。”
- 来源：本 thread（2026-03-22 04:47~05:53 铲屎官 + `@opus` 结论）
- **请对照上面的摘录判断交付物是否把 release 对账从“口头约定”变成了 source-owned 真相源**

## Tradeoff
- 没有去碰 `publish-sync-tag.sh` 的 `sync/*` 发布职责；`sync/*` 仍然保持 post-merge lane 唯一真相源
- 新增的是一条并行但不同语义的 source snapshot tag：`clowder-vX.Y.Z-source`
- release provenance 这轮先落到 sync 侧和 `.sync-provenance.json`，没有额外引入新的 release ledger 文件

## Open Questions
1. `--release-tag` 限制为 real full sync + full source-owned public gate（禁止 `--dry-run/--validate/--skip-validate/--fast-validate`）这条边界够不够硬？
2. source snapshot tag 现在在 temp target gate 通过后立即 push；这个时机是否符合“source snapshot 和 sync 行为原子绑定”的要求？
3. `.sync-provenance.json` 目前记录 `release_tag` / `source_snapshot_tag`，但不强制 target release tag 回写同一文件；这条分层是否足够清晰？

## Next Action
- 请按严格标准 review 这 5 个文件
- 如果你放行，我下一步直接进 merge gate，把这条 release provenance 规则合回家里的 `main`

## 自检证据

### Spec 合规
- source-owned public gate 规则没有后退；`sync/*` tag 仍由 `publish-sync-tag.sh` 在 post-merge lane 发布
- 新增的是 release-intended source snapshot tag，不和 `sync/*` 语义混线
- SOP / skill / outbound sync ref 已同步更新，不再只是口头约定

### 测试结果
```bash
bash -n scripts/sync-to-opensource.sh
node --test scripts/check-env-port-drift.test.mjs
pnpm check
```

结果：
- `check-env-port-drift`: `48 pass / 0 fail`
- `pnpm check`: 通过

### 相关文档
- SOP: `docs/SOP.md`
- Skill: `cat-cafe-skills/opensource-ops/SKILL.md`
- Ref: `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
