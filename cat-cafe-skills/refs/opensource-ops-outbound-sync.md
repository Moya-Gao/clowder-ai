# 场景 D: Outbound Sync — 定期全量同步

> 返回 → [opensource-ops SKILL.md](../opensource-ops/SKILL.md)
>
> Scene C (Outbound PR) 详细步骤 → [opensource-ops-outbound-pr.md](opensource-ops-outbound-pr.md)

## 场景 D: Outbound Sync — 定期全量同步

### 触发条件

- cat-cafe 积累了多个改动，需要批量 sync 到 clowder-ai
- 铲屎官要求同步

### 先选通道，再谈同步

full sync 默认目标是 **`clowder-ai main`**，所以前提不是"代码存在"，而是"这批内容已经够稳，值得给普通用户默认看到"。

| 目标 | 什么时候用 |
|------|-----------|
| `clowder-ai main` | 默认可装、默认可跑、默认可解释；可以作为 rolling stable |
| `clowder-ai` release tag `vX.Y.Z` | 需要给普通用户稳定锚点时 |
| `clowder-ai next` / prerelease | 社区激进特性方向对，但稳定性/文档/测试还不够 |
| 保持 PR / feature branch | 还在探索，不值得进任何默认分支 |

**铁律：**
- 激进但未完全稳定的社区特性，**不直接进 `clowder-ai main`**
- 如果当前没有 active `next` 分支，就用 prerelease tag / nightly 或继续保持 PR，不要把 `main` 当试验场
- `clowder-ai main` 的目标是 rolling stable，不是"永远最新"

### Step 1: Baseline Verification `[cat-cafe]`

同步前必须确认源仓代码基线健康。**红灯不出门。source 绿只是前提，不代表 target/public gate 会绿。**

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

> 为什么：full sync 现在会先在 source 侧导出一个 temp target，并在 temp target 跑完整 public gate。
> 如果源仓 UT 本身就红了，temp target public gate 大概率也红 → 白白浪费一次同步流水线。

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

### Step 1.5: Community Diff Guard 🔴（sync 前必做）

**事故背景（clowder-ai#290 覆盖 clowder-ai#276）**：outbound sync 从 cat-cafe 覆盖了社区已合入但未完整 intake 的修复。用户重新遇到已修复的 bug。

**规则**：sync 前检查 clowder-ai 上是否有**已 merge 但未完整 intake** 的社区 PR，且其改动文件与本次 sync diff 有交集。

**手动检查流程**（V1，立即生效）：

```bash
# 1. 列出 clowder-ai 上自上次 sync tag 以来的社区 merge commit
#    （排除 sync PR 自身和 bot commit）
LAST_SYNC_TAG=$(git -C "$CLOWDER_AI_DIR" tag -l 'sync/*' --sort=-version:refname | head -1)
gh pr list --repo zts212653/clowder-ai --state merged \
  --search "merged:>=$(git -C "$CLOWDER_AI_DIR" log -1 --format=%ci "$LAST_SYNC_TAG")" \
  --json number,title,mergedAt

# 2. 对照 intake ledger：每个社区 PR 是否有 record？
cat docs/ops/opensource-intake-ledger.json | jq '.entries[] | select(.pr_number == {N})'

# 3. V1 手动验证（脚本化前的过渡）：
#    - PR 不在 ledger → BLOCKED
#    - PR 标记 absorbed → 检查 cat-cafe 是否有对应的 intake issue（gh issue list --search）
#    - 有 intake issue + reviewer 签字 → PASS
#    - 无 intake issue 或 reviewer 未签字 → WARNING，人工确认完整性
```

**判定表（V1 手动检查）**：

| Ledger 状态 | 验证方式 | Sync 行为 |
|------------|---------|-----------|
| PR 在 ledger + `absorbed` | `gh issue list --state all --search "intake(clowder-ai#{N})"` 找到 intake issue + issue 已 closed（= reviewer 签字） | ✅ 通过 |
| PR 在 ledger + `absorbed` | 无 intake issue 或 issue 仍 open | ⚠️ WARNING — 人工验证完整性后才能继续 |
| PR 在 ledger + `public-only` | — | ✅ 通过（sync 覆盖无影响）|
| PR **不在 ledger** | — | ❌ BLOCKED — 先完成 intake 流程（Scene B3）|

**交集检查**：即使判定表显示通过，如果 sync diff 会覆盖该社区 PR 的改动文件，必须逐 file 验证 cat-cafe 里确实有等价改动。**"recorded" ≠ "absorbed-complete"。**

> **脚本化路线图**（V2，本周）：
> 1. `intake-from-opensource.sh --record` 扩字段：加 `intake_issue`（GitHub issue number）
> 2. `sync-to-opensource.sh` 加 `--community-guard`：自动读 ledger + 检查 intake issue 状态 + 文件交集
> 3. 判定表从"手动检查"升级为"脚本自动 BLOCK"

### Step 2: Pre-sync Gate `[cat-cafe]`

```bash
# 完整同步（含 dry-run 预览）
bash scripts/sync-to-opensource.sh --dry-run
```

Pre-sync gate 检查：
- Source (cat-cafe) clean?
- Target (clowder-ai) clean?
- 有无未登记的 inbound 社区 commit?（ledger gate）
- **Community Diff Guard 通过？**（Step 1.5）

如果 ledger gate 报错，不要立刻假设"社区改动还没吸收"。
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

# release-intended 同步（自动打 source snapshot tag）
bash scripts/sync-to-opensource.sh --release-tag=v0.1.1

# 快速模式（跳过 install + build 验证）
bash scripts/sync-to-opensource.sh --fast-validate

# 跳过验证（谨慎使用）
bash scripts/sync-to-opensource.sh --skip-validate
```

注意：
- `sync-to-opensource.sh` 现在会先把导出产物打到 **temp target**，在 temp target 跑完整 public gate（install + `pnpm check` + `pnpm lint` + `build` + `test:public` + startup acceptance）
- **只有 temp target public gate 全绿，脚本才允许碰真实 `clowder-ai`**
- **一旦 full sync 进入 temp target public gate，执行中的猫必须持续等待脚本退出**：允许汇报的状态只有两种——`=== Sync complete ===` 成功，或明确的红灯失败。`Step 5` 里的 `Biome check...`、`Smoke test (test:public)...`、`Startup acceptance...` 都不是 checkpoint，不能在这些中间状态结束当前执行
- 如果需要观察长静默阶段（尤其是 `test:public`），可以轮询同一个前台会话；但**不能**把"会话还在 / CI 还没开"当成阶段完成，更不能在 temp target public gate 还没收口前就退出
- 如果这次 full sync 是为了后续切 release tag，传 `--release-tag=vX.Y.Z`；脚本会在 source-owned public gate 通过后自动打并 push `clowder-vX.Y.Z-source`，同时把 `release_tag` / `source_snapshot_tag` 写进 `.sync-provenance.json`
- 本机 README/macOS smoke 不属于 full sync 主路径；它是 sync 完成后的独立步骤，必须显式隔离端口/Redis
- `sync-to-opensource.sh` **不会**创建 `sync/*` tag；它只负责导出 + 生成 sync PR
- `sync-hotfix.sh` 会把最新 `sync/*` tag 当成"已经落地 upstream 的基线"，所以 tag 发布必须放在 **sync PR merge 后**
- sync PR merge 后，运行：

```bash
bash scripts/publish-sync-tag.sh \
  --source-sha {cat_cafe_source_sha} \
  --target-sha {clowder_ai_sync_commit_sha} \
  --push
```

- 如果这是一次 **release-intended** sync，在 sync tag 发布后，再运行：

```bash
bash scripts/publish-release-tag.sh \
  --release-tag=vX.Y.Z \
  --target-sha {clowder_ai_release_commit_sha} \
  --push
```

- `publish-release-tag.sh` 会强制校验三点映射：
  - `clowder-vX.Y.Z-source` 必须已经存在于 `cat-cafe`
  - `clowder-ai` 上最近可追溯的 `.sync-provenance.json` 必须记录同一个 `release_tag` / `source_snapshot_tag`
  - 只有这两边对得上，才允许在 `clowder-ai` 发布 `vX.Y.Z`

- `--target-sha` 必须是 **已经在 `clowder-ai main` 上**、而且就是最后一次更新 `.sync-provenance.json` 的 landed sync commit，不能拿未 merge 的 sync 分支 tip，也不能拿后续 README/docs 或 `sync:` descendant commit 代替
- `--source-sha` 必须和 `{clowder_ai_sync_commit_sha}:.sync-provenance.json` 里的 `source_commit_sha` 完全一致，不能手填更靠后的 cat-cafe commit
- 不传 `--tag` 时，脚本会从 landed sync 的 target commit time 自动推导同名 `sync/YYYY-MM-DD-HHMMSS` tag；这里看的是 upstream 真正落地时间，不是 sync 分支生成时写进 provenance 的 `synced_at`
- `CLOWDER_AI_DIR` 可以指向普通 clone，也可以指向 merged worktree checkout；脚本两种都接受
- 即使本地 checkout 还没 pull 到最新 `clowder-ai main`，脚本也会先 fetch `origin main` 再解析 landed sync commit
- `--push` 前脚本会先检查两边 origin 上的同名 tag 是否已存在且指向正确 SHA，再创建本地 tag，避免本地或单侧 remote 先被推进到新的 sync baseline
- 这会在 `cat-cafe` 与 `clowder-ai` 两边创建并 push 同名 `sync/YYYY-MM-DD-HHMMSS` tag
- 这个 tag 记录的是"哪一个 cat-cafe commit 被同步出去，以及它在 clowder-ai 上对应的 merge commit"
- release-intended sync 另外还有一条 **source snapshot tag**：`clowder-vX.Y.Z-source`。它不是 `sync/*` 基线 tag，而是用来把 `source snapshot → target release tag → backport commit` 三点映射钉进真相源
- `clowder-ai` 的 `vX.Y.Z` release tag 由 `publish-release-tag.sh` 发布；不要手工打 tag 再事后补 provenance 校验
- 如果这次同步对应社区激进特性的预览发布，优先考虑 `vX.Y.Z-rc.1` 这类 prerelease tag，而不是直接把特性压进 `clowder-ai main`

### Step 5: Source-Owned Public Gate `[cat-cafe → temp target]`

脚本会自动在 **temp target** 验证：
- `pnpm install` 成功
- `pnpm check` + `pnpm lint` 通过
- `pnpm --filter @cat-cafe/api run test:public` 通过
- 端口可访问
- `3001/3002` 等内部端口没有泄漏进导出产物

**执行纪律：**
- 这是 release 主路径上的**阻塞长跑**，不是"看到 `test:public` 开始了就算推进到了下一步"
- 只有脚本自己打印 `✓ Source-owned public gate passed`，才算 Step 5 真正结束
- 在这之前，执行中的猫不能宣称"同步在跑 CI"或"只差 PR 了"，因为真实 target 还没被碰到

#### Step 5.5: Temp Target 红灯分流 `[cat-cafe]`（仅当 public gate 红灯时）

> **⚠️ 黄金法则：source 绿、temp target/public gate 红 → 先查 source gate / sync 管道，再动 target。**
>
> 如果 cat-cafe main 全绿，但 temp target public gate 红，**第一反应不是在 clowder-ai 手动修测试**，
> 而是检查 `scripts/_sanitize-rules.pl` 的转换规则是否有 bug。
>
> **判断方法：** `diff` 对比 cat-cafe 和 clowder-ai 的红灯测试文件：
> - 如果 diff 显示 sanitizer 把值改坏了（路径截断/URL 变占位符/品牌名漏转/端口漏转）→ **修 sanitizer 规则**
> - 如果 diff 为空（文件完全一样）→ 可能是环境差异或 pre-existing，可以手修目标仓
>
> **只手修 clowder-ai = 重复劳动**——下次全量同步还会再红。
> **修 source gate / sanitizer / temp target contract = 一次修好永远绿**。

**即使源仓基线绿了，sanitizer 转换仍可能引入目标仓 UT 红灯。** 常见 sanitizer bug 类别：

| 类别 | sanitizer 规则缺陷 | 修复目标 |
|------|------|------|
| **路径截断** | `/Users/` 正则贪婪匹配吞掉末段：`/Users/dev/my-project` → `/home/user` | 保留最末路径段：`→ /home/user/my-project` |
| **Placeholder URL** | `http://127.0.0.1:3002` 被替换成文本 `'your local Clowder API URL'` 而非有效 URL | 在测试/源码中替换为 `http://127.0.0.1:3004`，占位符只用于 docs |
| **品牌名跳过测试** | `if` 条件 `$ARGV !~ m{/__tests__/\|\.test\.}` 跳过了测试文件的品牌转换 | 移除测试排除条件，或对需要转换的测试单独加规则 |
| **裸端口号** | 只匹配 `localhost:3001` 模式，漏了数组/注释里的裸 `3001` | 在端口 remap 区域加裸数字或上下文感知规则 |
| **Intake 品牌反流** | Intake（cherry-pick/copy）时忘记还原 sanitizer 产物中的品牌名（Clowder AI → Cat Cafe） | **不是 sanitizer 的问题——是 intake 缺少 Inbound Guard。** 跑 `bash scripts/intake-from-opensource.sh --validate-inbound`。见 inbound-pr.md Step 1.5 |
| **console→pino** | 非 sanitizer 问题——源码日志迁移导致 test mock 失效 | 在 cat-cafe 源码修（行为断言），不是 sanitizer 的责任 |

**修复流程（优先修管道，兜底修目标仓）：**

```bash
# 1. 对比红灯文件，定位是 sanitizer bug 还是其他原因
diff cat-cafe/<path> clowder-ai/<path>

# 2a. 如果是 sanitizer bug → 在 cat-cafe 修 _sanitize-rules.pl
#     走 worktree + PR 流程，合入 main 后重新同步
#     这样下次同步自动绿

# 2b. 如果确实是目标仓特有问题 → 在 clowder-ai sync 分支上修
#     追加 commit 到 sync 分支

# 3. 无论哪种，修完后确认全量 UT 绿
pnpm test  # 必须全绿（Redis 依赖的除外）
```

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

#### 8.1 Sync Coverage Report

从 Step 6 的 PR body 提取本次同步带出的内容清单：

```bash
# 列出本次同步的 feature/bugfix
git log --oneline {last_sync_tag}..{new_sync_tag} --grep="feat\|fix"
```

输出：
- 带了哪些 Feature（F118, F119, F120...）
- 带了哪些 bugfix
- 对应的 sync PR 编号

#### 8.2 Community Reconciliation Draft（按 Feature 分包）

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

#### 8.3 两猫达成一致

两只猫各自独立搜索 + 判断后，对齐每个 Feature 的候选 issue 列表。**半成品不推给铲屎官。**

#### 8.4 逐包推给铲屎官核验

```
@lysander
F118 Community Reconciliation（两猫已对齐）：
- clowder-ai#12: close（已修复，AC-1 覆盖）
- clowder-ai#64: 加 feature:F118（部分覆盖）
- clowder-ai#82: needs-maintainer-decision（不确定关联）

请核验，OK 后我们执行动作。
```

铲屎官 OK → 下一个 Feature。**全部 Feature 核验完 → 执行关单/打标签/评论。**

#### 8.5 执行社区动作 `[clowder-ai]`

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

### Step 9: Release Tag Gate（release-intended sync 专用）🔴

**Release tag 不许在 Step 8 完成前打。** `publish-release-tag.sh` 已加入技术性门禁：必须传 `--reconciliation-report=<path>` 指向一份非空的 reconciliation 报告文件；如果报告里把任何 issue 标成 `closed`，脚本还会回查 GitHub，确认这些 issue 真实状态已经是 `CLOSED`，否则直接 exit 1。

**执行顺序铁律：**

```
Step 7 (sync PR merge) → Step 8 (community reconciliation) → 写报告 → Step 9 (release tag)
```

**Reconciliation Report 格式**（约定路径 `docs/ops/reconciliation-{version}.md`）：

```markdown
# Community Reconciliation: v0.5.0

## Reconciled Features
- F151: #341 closed (Phase A MVP shipped)
- F150: #339 auto-closed by PR #295

## Actions Taken
- #234: commented, root cause → #284
- #137, #252, #338, #169: reviewed, kept open (evidence: ...)

## CVO Sign-off
- Approved by @lysander on YYYY-MM-DD
```

**然后运行：**

```bash
bash scripts/publish-release-tag.sh \
  --release-tag=vX.Y.Z \
  --target-sha={sha} \
  --reconciliation-report=docs/ops/reconciliation-vX.Y.Z.md \
  --push
```

**违反后果**：脚本会拒绝发布。没有 reconciliation report，或者报告里的 `closed` issue 实际还没关掉 = 没有 release tag。

> 事故教训（v0.5.0）：sync PR #384 merge 后直接打 release tag，Step 8 完全跳过，导致 #341 等 issue 漏关。

### Step 10: GitHub Release with Bilingual Notes 🔴

**`publish-release-tag.sh --push` 已强制要求 `--release-notes`**。没有双语 release notes 文件 = 无法发布。

**为什么是硬门禁**：v0.7.0 事故——tag 发了但 GitHub Release 没创建，社区用户看不到 changelog，每次都漏（铲屎官原话："好像每次都会漏"）。

**操作流程：**

1. 根据 reconciliation report 内容，写一份双语 release notes 文件（EN 在上，中文在下，用 `---` 分隔）：

```markdown
## Bug Fixes
- **fix(xxx)**: description

## Features
- **feat(Fxxx)**: description

## Community
- Closes #NNN — description
- Reviewed all N open bugs; full reconciliation report: `docs/ops/reconciliation-vX.Y.Z.md`

---

## 缺陷修复
- **fix(xxx)**：中文描述

## 新功能
- **feat(Fxxx)**：中文描述

## 社区
- 关闭 #NNN — 中文描述
- 审查全部 N 个未关闭 bug；完整对账报告：`docs/ops/reconciliation-vX.Y.Z.md`
```

2. 传给 `publish-release-tag.sh`：

```bash
bash scripts/publish-release-tag.sh \
  --release-tag=vX.Y.Z \
  --target-sha={sha} \
  --reconciliation-report=docs/ops/reconciliation-vX.Y.Z.md \
  --release-notes=release-notes-vX.Y.Z.md \
  --push
```

3. 脚本会在 tag push 后自动调用 `gh release create`，创建带双语 notes 的 GitHub Release。

> 事故教训（v0.7.0）：tag 和 reconciliation 都完成了，但 GitHub Release 没创建——脚本没有这步，SOP 也没写。社区用户在 Releases 页面看到的最新版本停留在 v0.6.1。
