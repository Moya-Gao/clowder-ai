# 场景 D: Outbound Sync — 定期全量同步

> 返回 → [opensource-ops SKILL.md](../opensource-ops/SKILL.md)
>
> Scene C (Outbound PR) 详细步骤 → [opensource-ops-outbound-pr.md](opensource-ops-outbound-pr.md)

## 场景 D: Outbound Sync — 定期全量同步

### 触发条件

- cat-cafe 积累了多个改动，需要批量 sync 到 clowder-ai
- 铲屎官要求同步

### Step 1: Pre-sync Gate `[cat-cafe]`

```bash
# 完整同步（含 dry-run 预览）
bash scripts/sync-to-opensource.sh --dry-run
```

Pre-sync gate 检查：
- Source (cat-cafe) clean?
- Target (clowder-ai) clean?
- 有无未登记的 inbound 社区 commit?（ledger gate）

### Step 2: Diff Preview `[cat-cafe]`

Dry-run 会输出：
- 新增 / 更新 / 删除的文件数
- 安全扫描结果

**确认 diff 无问题后再继续。**

### Step 3: 执行 Sync `[cat-cafe]`

```bash
# 带验证的完整同步
bash scripts/sync-to-opensource.sh

# 快速模式（跳过 install + build 验证）
bash scripts/sync-to-opensource.sh --fast-validate

# 跳过验证（谨慎使用）
bash scripts/sync-to-opensource.sh --skip-validate
```

### Step 4: Post-sync Validation `[clowder-ai]`

脚本会自动验证：
- `pnpm install` 成功
- `pnpm check` + `pnpm lint` 通过
- 端口可访问

### Step 5: PR 记录 `[clowder-ai]` 🔴

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

### Step 6: Commit + Push `[clowder-ai]`

脚本通常会自动创建 sync commit，但 PR 需要手动创建或由脚本触发。

### Step 7: Post-Sync Community Reconciliation 🔴

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
