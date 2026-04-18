# 场景 F: Hotfix Lane — 社区 Bug 精准修复通道

> 返回 → [opensource-ops SKILL.md](../opensource-ops/SKILL.md)

## 触发条件

- 社区报了 bug，需要精准修复推送到开源仓
- **不适合全量 sync**（只改几个文件，不想触发完整 sync 管道）

## 和场景 D（Outbound Sync）的区别

| | Hotfix Lane | Outbound Sync |
|---|---|---|
| 范围 | 1~3 个文件 | 全量 |
| 基准 | sync tag（上次同步点） | cat-cafe HEAD |
| 漂移检查 | 严格（target 文件必须等于 sync 时版本） | rsync --delete |
| 适用场景 | 紧急 bug fix | 定期批量发布 |

## Step 1: 创建 Worktree（基于 sync tag）`[cat-cafe]`

如果上一次 full sync 刚 merge，但本地还没有新的 `sync/*` tag，先在主仓运行：

```bash
bash scripts/publish-sync-tag.sh \
  --source-sha {cat_cafe_source_sha} \
  --target-sha {clowder_ai_sync_commit_sha} \
  --push
```

这里两个 SHA 不能手猜：
- `{clowder_ai_sync_commit_sha}` 必须已经在 `clowder-ai main` 上，而且就是最后一次更新 `.sync-provenance.json` 的那次 landed sync commit，不能拿后续 descendant commit（哪怕 subject 也叫 `sync:`）代替
- `{cat_cafe_source_sha}` 必须等于该 landed sync commit 内 `.sync-provenance.json` 的 `source_commit_sha`
- 不传 `--tag` 时，脚本会把 landed sync 的 target commit time 先正规化到 UTC，再推导同名 `sync/YYYY-MM-DD-HHMMSS` tag；不看 provenance 里的 `synced_at`
- merged 的 `clowder-ai` checkout 用普通 clone 或 worktree 都可以；脚本两种都接受
- checkout 如果还没拉到最新 main 也没关系，脚本会先 fetch `origin main` 再解析 landed sync commit
- `sync-hotfix.sh` 自动选 baseline 时，不再按 tag 名字排序；它会对照 `clowder-ai` 上同名 tag 的 commit time 选择最新 landed sync

```bash
# 查看当前已有的 sync tag（格式是 sync/... 斜杠分隔）
git tag -l "sync/*" | tail -5

# 基于 sync tag 创建 worktree（{tag} 是完整 tag 名如 sync/v3，直接用）
git worktree add -b fix/{issue} ../cat-cafe-hotfix-{issue} {tag}
cd ../cat-cafe-hotfix-{issue}
```

**为什么基于 sync tag？** 因为 hotfix 脚本要求 `HEAD == sync tag`，确保你修的是上次同步到开源仓的精确版本。

## Step 2: 修复 Bug `[cat-cafe]`

在 worktree 中修改文件，写测试，确认修复。

```bash
# 修改文件
# 跑测试确认
pnpm --filter @cat-cafe/api test
```

## Step 3: 推送 Hotfix `[cat-cafe → clowder-ai]`

```bash
# 用法：sync-hotfix.sh <branch-name> <file1> [file2] ...
bash scripts/sync-hotfix.sh fix/{issue} packages/api/src/path/to/file.ts

# 可选 flags：
#   --dry-run         只预览不执行
#   --tag=NAME        指定 sync tag（默认自动检测）
#   --no-sanitize     跳过内容清洗（仅限紧急场景）
#   --push            自动 push 到 clowder-ai remote
#   --force-unsafe-source  跳过 source 侧门禁（危险）
```

脚本会：
1. 检查 HEAD 基于 sync tag（source 侧门禁）
2. 检查本地改动 ⊆ 指定 FILES
3. 检查 clowder-ai 对应文件 == sync 时版本（target 侧漂移检查）
4. 对文件执行 outbound sanitize（去内部路径/猫名）
5. 复制文件到 clowder-ai 并创建 commit

**脚本不会自动创建 PR。** 脚本结束后手动操作：

```bash
# Step 3.5: 手动创建 PR [clowder-ai]
cd ../clowder-ai
git push -u origin fix/{issue}
gh pr create --title "fix: {简述}" --body "Fixes #{issue}"  # 同仓 PR body 裸 #N = GitHub auto-close，OK
```

PR 创建后注册 tracking（`cat_cafe_register_pr_tracking`），CI/CD 自动追踪启动。
如果仓库有 GitHub Actions，等 CI 通知（失败则修复后 push）；无 Actions 则依赖本地测试。
详见 → [refs/cicd-tracking.md](cicd-tracking.md)

## Step 4: Cherry-pick 回 Main `[cat-cafe]`

Hotfix 修复同样需要回到 main：

```bash
# 切到 cat-cafe 主仓目录（git worktree list 可查主仓路径）
cd $(git worktree list | grep 'bare\|main' | head -1 | awk '{print $1}')
git cherry-pick {hotfix-commit-sha}
# 或者在 main 上重新做修复
```

## Step 5: Intake Record + Advance `[cat-cafe]`

Hotfix PR merge 后，也需要走 intake 登记闭环（即使是我们自己提的）：

```bash
# 等 PR merge 后
# Hotfix 是 outbound-filed PR（我们从 cat-cafe 侧推的修复），
# 没有 cat-cafe 内的 Intake Intent Issue / absorb PR，
# 因此用 --skip-absorbed-guard 跳过 record 时的 strict guard。
bash scripts/intake-from-opensource.sh --record --pr {N} --decision absorbed --skip-absorbed-guard
bash scripts/intake-from-opensource.sh --advance-ledger
```

不要停在 `--record`。如果 `--advance-ledger` 失败，先把别的漏记 PR 补齐，再回来推进水位。

## Step 6: 清理 `[cat-cafe]`

```bash
git worktree remove ../cat-cafe-hotfix-{issue}
git branch -d fix/{issue}
```

## 常见问题

| 问题 | 解决 |
|------|------|
| HEAD 不等于 sync tag | 确保 worktree 基于正确的 sync tag 创建 |
| Target 侧漂移（文件被社区改过） | 先做 intake 把社区改动吸收回来，再重新 hotfix |
| 需要改 docs/**（有 outbound transform） | 不走 hotfix，走全量 sync |
| Hotfix 涉及 `docs/features/`（有 export transform） | 代码文件走 hotfix，文档等下次全量 sync。紧急情况可直接在 clowder-ai 手工编辑，下次 sync 会覆盖 |
