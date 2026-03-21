# 场景 D: Outbound Sync — 定期全量同步

> 返回 → [opensource-ops SKILL.md](../opensource-ops/SKILL.md)
>
> Scene C (Outbound PR) 详细步骤 → [opensource-ops-outbound-pr.md](opensource-ops-outbound-pr.md)

## 场景 D: Outbound Sync — 定期全量同步

### 触发条件

- cat-cafe 积累了多个改动，需要批量 sync 到 clowder-ai
- 铲屎官要求同步

### Step 1: Baseline Verification `[cat-cafe]`

同步前必须确认源仓代码基线健康。**红灯不出门。**

```bash
# 1a. 拉取最新 remote main（确保基线是最新的）
git pull --ff-only origin main

# 1b. 跑全量单元测试（红灯 = 阻塞同步）
pnpm test

# 1c. 静态检查（biome + tsc）
pnpm check && pnpm lint

# 1d. 构建验证（确保 build 不挂）
pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build
```

**任何一步失败 → 阻塞同步，走 Step 1.5 修复流程。不允许带红灯同步。**

> 为什么：全量同步的 Step 6 会在目标仓跑 post-sync validation（install + check + lint + build + test:public），
> 如果源仓 UT 本身就红了，目标仓大概率也红 → 白白浪费一次同步流水线。

#### Step 1.5: 基线修复 `[cat-cafe]`（仅当 Step 1 红灯时）

**红灯不出门 = 不是跳过红灯，而是修绿了才走。**

```bash
# 1. 拉 feature worktree 修复 UT
bash scripts/worktree-manager.sh create fix/baseline-ut-green

# 2. 在 worktree 里修复所有挂的测试（包括 pre-existing 的）
#    修完后确认全量 UT 绿
pnpm test

# 3. 提 PR，review 通过后 squash merge 到 main
gh pr create --title "fix: 修复基线 UT 红灯 (同步前置)" --body "..."

# 4. PR 合入后，回到 main 重新验证
git checkout main && git pull --ff-only origin main
pnpm test  # 必须全绿

# 5. 确认绿了 → 回到 Step 2 继续同步流程
```

**修复原则：**
- 即使是 pre-existing 的红灯（历史遗留），也必须在同步前修绿
- 修复范围仅限让 UT 通过，不做功能改动（scope 控制）
- 修完必须走 PR 流程合入 main，不能直接 push

### Step 2: Pre-sync Gate `[cat-cafe]`

```bash
# 完整同步（含 dry-run 预览）
bash scripts/sync-to-opensource.sh --dry-run
```

Pre-sync gate 检查：
- Source (cat-cafe) clean?
- Target (clowder-ai) clean?
- 有无未登记的 inbound 社区 commit?（ledger gate）

如果 ledger gate 报错，不要立刻假设“社区改动还没吸收”。
先检查 `docs/ops/opensource-intake-ledger.json`：
- merge commit 不在 `entries[]` 里：说明真的没做 intake record
- merge commit 已在 `entries[]` 里：说明 record 做了，但 `last_reviewed_target_head` 还没推进，先跑 `bash scripts/intake-from-opensource.sh --advance-ledger`

### Step 3: Diff Preview `[cat-cafe]`

Dry-run 会输出：
- 新增 / 更新 / 删除的文件数
- 安全扫描结果

**确认 diff 无问题后再继续。**

### Step 4: 执行 Sync `[cat-cafe]`

```bash
# 带验证的完整同步
bash scripts/sync-to-opensource.sh

# 快速模式（跳过 install + build 验证）
bash scripts/sync-to-opensource.sh --fast-validate

# 跳过验证（谨慎使用）
bash scripts/sync-to-opensource.sh --skip-validate
```

注意：
- `sync-to-opensource.sh` **不会**创建 `sync/*` tag；它只负责导出 + 生成 sync PR
- `sync-hotfix.sh` 会把最新 `sync/*` tag 当成“已经落地 upstream 的基线”，所以 tag 发布必须放在 **sync PR merge 后**
- sync PR merge 后，运行：

```bash
bash scripts/publish-sync-tag.sh \
  --source-sha {cat_cafe_source_sha} \
  --target-sha {clowder_ai_sync_commit_sha} \
  --push
```

- `--target-sha` 必须是 **已经在 `clowder-ai main` 上**、而且就是最后一次更新 `.sync-provenance.json` 的 landed sync commit，不能拿未 merge 的 sync 分支 tip，也不能拿后续 README/docs 或 `sync:` descendant commit 代替
- `--source-sha` 必须和 `{clowder_ai_sync_commit_sha}:.sync-provenance.json` 里的 `source_commit_sha` 完全一致，不能手填更靠后的 cat-cafe commit
- 不传 `--tag` 时，脚本会从 landed sync 的 target commit time 自动推导同名 `sync/YYYY-MM-DD-HHMMSS` tag；这里看的是 upstream 真正落地时间，不是 sync 分支生成时写进 provenance 的 `synced_at`
- `CLOWDER_AI_DIR` 可以指向普通 clone，也可以指向 merged worktree checkout；脚本两种都接受
- 即使本地 checkout 还没 pull 到最新 `clowder-ai main`，脚本也会先 fetch `origin main` 再解析 landed sync commit
- `--push` 前脚本会先检查两边 origin 上的同名 tag 是否已存在且指向正确 SHA，再创建本地 tag，避免本地或单侧 remote 先被推进到新的 sync baseline
- 这会在 `cat-cafe` 与 `clowder-ai` 两边创建并 push 同名 `sync/YYYY-MM-DD-HHMMSS` tag
- 这个 tag 记录的是“哪一个 cat-cafe commit 被同步出去，以及它在 clowder-ai 上对应的 merge commit”

### Step 5: Post-sync Validation `[clowder-ai]`

脚本会自动验证：
- `pnpm install` 成功
- `pnpm check` + `pnpm lint` 通过
- 端口可访问

#### Step 5.5: Post-sync Test Fix `[clowder-ai]`（仅当目标仓 UT 红灯时）

**即使源仓基线绿了，sanitizer 转换仍可能引入目标仓 UT 红灯。** 常见原因：

| 类别 | 根因 | 示例 |
|------|------|------|
| **路径截断** | sanitizer 把 `/Users/dev/my-project` 缩成 `/home/user`，丢失末段 | test 断言 `projectDisplayName` 返回 `'my-project'` 但实际得到 `'user'` |
| **Placeholder URL** | sanitizer 把有效 URL 替换成人类可读文本 | `http://127.0.0.1:3002` → `'your local Clowder API URL'`，`new URL()` 抛 `ERR_INVALID_URL` |
| **裸端口号** | sanitizer 只匹配 `localhost:3001` 模式，漏了数组里的裸端口 | `DEFAULT_EXCLUDED_PORTS = [3001, 3002]` 未被转换为 `[3003, 3004]` |
| **品牌名遗漏** | sanitizer 排除 test 文件的品牌转换，但 test 断言检查了已转换的源码输出 | test 期望 `'Cat Café Hub'` 但源码已变成 `'Clowder AI Hub'` |
| **console→pino** | 源码 `console.*` 被转为 pino `log.*`，但 test mock 仍拦截 `console.*` | `assert.ok(console.error.mock.callCount() > 0)` 永远是 0 |

**修复流程：**

```bash
# 1. 在 clowder-ai sync 分支上跑全量 UT
cd $CLOWDER_AI_DIR
pnpm test  # 看哪些红了

# 2. 逐个修复（对照 cat-cafe 源文件理解原始意图）
#    - 路径截断 → 补全路径段
#    - placeholder URL → 改成有效 URL (http://127.0.0.1:3004)
#    - 裸端口号 → 修改源码或测试
#    - console→pino → 改用行为断言

# 3. 修完后确认全量 UT 绿
pnpm test  # 必须全绿（Redis 依赖的除外）

# 4. 修复 commit 追加到 sync 分支
git add -A && git commit -m "fix: post-sync test fixes for sanitizer transform gaps"
```

**同时回流修复 sanitizer：** 如果发现 sanitizer 规则有 bug（如路径截断、placeholder URL），
**必须在 cat-cafe 侧修复 `_sanitize-rules.pl`**，这样下次同步不会再产生同样的问题。
sanitizer 修复走单独的 PR，不阻塞当前同步。

### Step 6: PR 记录 `[clowder-ai]` 🔴

**铲屎官要求（KD-6）：PR body 必须列清同步了什么。**

PR body 模板：

```markdown
## Sync: cat-cafe → clowder-ai

### Features
- feat(F{xxx}): {Feature 名称} — {简述改动}
- feat(F{yyy}): {Feature 名称} — {简述改动}

### Bug Fixes
- fix: {简述} (clowder-ai#{issue})
- fix: {简述} (clowder-ai#{issue})

### Other Changes
- refactor: {简述}
- docs: {简述}

### Sync Metadata
- Source commit range: {from_sha}..{to_sha}
- Sync script version: {version}
- Sync tag: {tag}
```

**如何生成内容：**

```bash
# 查看上次 sync tag 到当前 HEAD 的 commit 列表
git log --oneline {last_sync_tag}..HEAD --grep="feat\|fix\|refactor\|docs"
```

### Step 7: Commit + Push `[clowder-ai]`

脚本通常会自动创建 sync commit，但 PR 需要手动创建或由脚本触发。

### Step 8: Post-Sync Community Reconciliation 🔴

**全量同步完成 ≠ 发布闭环完成。** Sync PR merge 后，必须做社区侧复核收口。

#### 7.1 Sync Coverage Report

从 Step 5 的 PR body 提取本次同步带出的内容清单：

```bash
# 列出本次同步的 feature/bugfix
git log --oneline {last_sync_tag}..{new_sync_tag} --grep="feat\|fix"
```

输出：
- 带了哪些 Feature（F118, F119, F120...）
- 带了哪些 bugfix
- 对应的 sync PR 编号

#### 7.2 Community Reconciliation Draft（按 Feature 分包）

**逐个 Feature 搜索关联社区 issue，不要一锅端：**

```bash
# 先搜 F118 相关
gh issue list --repo zts212653/clowder-ai --state open --search "{F118 关键词}"
```

每个 Feature 输出一张表：

```markdown
## F118 Community Reconciliation

| Issue | 标题 | 建议动作 | 证据 |
|-------|------|---------|------|
| clowder-ai#12 | {标题} | close — 已修复 | F118 AC-1 覆盖 |
| clowder-ai#64 | {标题} | 加 `feature:F118` — 关联但未完全覆盖 | 部分覆盖，Phase 2 |
| clowder-ai#82 | {标题} | `needs-maintainer-decision` — 不确定 | 可能相关但需确认 |
```

建议动作类型：
- `close` — 已被本次 sync 修复
- `relabel` — 加 `feature:Fxxx` 标签
- `comment` — 评论说明进展但保持 open
- `keep open` — 未覆盖，保持现状
- `needs-maintainer-decision` — 不确定，等铲屎官

#### 7.3 两猫达成一致

两只猫各自独立搜索 + 判断后，对齐每个 Feature 的候选 issue 列表。**半成品不推给铲屎官。**

#### 7.4 逐包推给铲屎官核验

```
@lysander
F118 Community Reconciliation（两猫已对齐）：
- clowder-ai#12: close（已修复，AC-1 覆盖）
- clowder-ai#64: 加 feature:F118（部分覆盖）
- clowder-ai#82: needs-maintainer-decision（不确定关联）

请核验，OK 后我们执行动作。
```

铲屎官 OK → 下一个 Feature。**全部 Feature 核验完 → 执行关单/打标签/评论。**

#### 7.5 执行社区动作 `[clowder-ai]`

铲屎官逐包核验通过后：

```bash
# 关闭已修复的 issue
gh issue close {N} --repo zts212653/clowder-ai \
  --comment "Shipped in F118 (sync PR clowder-ai#{sync_pr}). Thank you for reporting!"

# 加标签
gh issue edit {N} --repo zts212653/clowder-ai --add-label "feature:F118"

# 评论进展
gh issue comment {N} --repo zts212653/clowder-ai \
  --body "Partial progress shipped in F118. Remaining scope tracked in F{xxx}."
```

**全部执行完 → 这次全量同步才算闭环。**
