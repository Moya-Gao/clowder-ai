# 场景 C: Outbound PR — 我们往开源仓提 PR

> 返回 → [opensource-ops SKILL.md](../opensource-ops/SKILL.md)

## 核心原则

开源仓（clowder-ai）的 Feature 编号由 **maintainer 统一分配**。
贡献者本地可能用了临时编号（如 F110），但官方编号可能是 F115。
**PR 前必须校验并对齐到官方编号。**

## 触发条件

- 我们的代码要以 PR 形式发布到 clowder-ai
- 通常用于 Feature PR 或需要 review 的改动

## Step 1: 确认 PR 类型

| 类型 | 判断条件 | 需要 Feature Doc？ |
|------|---------|-------------------|
| **Patch** | Bug fix、文案修正、测试补洞 | 不需要 |
| **Feature** | 新能力、行为变更 | 需要 |
| **Protocol** | 规则、workflow 变更 | 文档本身就是贡献 |

## Step 2: 查官方 F 编号（Feature PR 必做）

```bash
# 1. 找到关联的 GitHub Issue
gh issue list --repo zts212653/clowder-ai --label "feature" --state open

# 2. 查看 Issue 详情，找 maintainer 分配的 F 编号
gh issue view {ISSUE_NUMBER} --repo zts212653/clowder-ai

# 3. 在 issue 评论或 label 中寻找：
#    - label: feature:F115
#    - 评论中 maintainer 说"已分配 F115"
#    - 关联的 Feature Doc 路径: docs/features/F115-xxx.md
```

**如果 Issue 没有官方 F 编号**：
- 在 issue 中评论请求分配："@maintainer 请分配 F 编号"
- **不要自行选号** — 等 maintainer 回复后再继续

## Step 3: 本地编号对齐

如果本地使用的编号（如 F110）与官方编号（F115）不同：

```bash
# 1. 找出所有引用了旧编号的文件
grep -r "F110" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.yaml" --include="*.json"

# 2. 批量替换
# 文件名重命名
mv docs/features/F110-xxx.md docs/features/F115-xxx.md

# 内容替换（frontmatter、引用、注释）
# 跨平台 sed（macOS + Linux 均可用）：
if [[ "$OSTYPE" == "darwin"* ]]; then SED_I="sed -i ''"; else SED_I="sed -i"; fi
find . \( -name "*.md" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.yaml" \) \
  -exec sh -c "$SED_I 's/F110/F115/g' \"\$1\"" _ {} \;

# 3. 验证替换完整性
grep -r "F110" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.json"
# 应该零结果
```

## Step 4: Feature Doc 校验（Feature PR 必做）

```bash
# 1. 确认 Feature Doc 存在
ls docs/features/F115-*.md

# 2. 检查 frontmatter 格式
# 必须包含：
#   feature_ids: [F115]
#   doc_kind: spec
#   created: YYYY-MM-DD

# 3. 检查必要章节
#   - Status / Why / What / AC（验收标准）
#   - AC 中的 checkbox 是否有已勾选的完成项

# 4. 对照 AC 检查代码实现
# 逐条确认每个验收标准是否有对应的代码改动和测试
```

## Step 5: 运行质量门禁

```bash
pnpm check          # Biome lint
pnpm lint           # TypeScript 类型检查
pnpm --filter @cat-cafe/api run test:public  # 公开测试套件
```

## Step 5.5: Issue 关单判断（PR 创建前必做）

**创建 PR 前问一句**："这个 PR merge 后，关联的 clowder-ai issue 是否可以关闭？"

| 判断 | PR body 用法 | 效果 |
|------|-------------|------|
| PR 完整覆盖 issue scope | `Closes #N` 或 `Fixes #N` | merge 后 **auto-close** |
| PR 仅部分交付（分阶段） | `Refs #N`（+ 说明剩余 scope） | issue **保持 open** |
| PR 无关联 issue | 不写 | — |

**默认用 `Closes`。** 只有明确是分阶段交付时才降级为 `Refs`。

> 事故教训（v0.5.0）：F151 PR #354 用了 `Implements` 引用而非 `Closes`，导致 #341 漏关。

## Step 6: 组装 PR

> **编号规则**：PR body 中裸 `#N` 有两种含义——`Fixes #N` 是 GitHub **auto-close** 语法（PR merge 后自动关 issue），`(#N)` 仅是同仓 **issue 引用/链接**（不会自动关单）。两者都在同仓 PR body 中有效且必须保留。但在**猫猫讨论、mailbox、评论**中必须写显式前缀（`clowder-ai#N` / `cat-cafe#N`），不要裸写。

**Bug fix PR**：

```bash
gh pr create --repo zts212653/clowder-ai \
  --title "fix: 简短描述" \
  --body "$(cat <<'EOF'
## What
<!-- 改了什么 -->

## Why
Fixes #ISSUE_NUMBER <!-- Fixes #N = auto-close（merge 后自动关 issue），猫猫讨论时写 clowder-ai#N -->

## Test Evidence
```
pnpm check          # ✅
pnpm lint           # ✅
pnpm --filter @cat-cafe/api test:public  # ✅ X passed
```
EOF
)"
```

**Feature PR（完整交付 — AC 全部勾选）**：

```bash
gh pr create --repo zts212653/clowder-ai \
  --title "feat(F115): 简短描述" \
  --body "$(cat <<'EOF'
## What
<!-- 改了什么，关键文件列表 -->

## Why
Closes #ISSUE_NUMBER <!-- AC 全勾 → Closes = auto-close -->
Feature Doc: docs/features/F115-xxx.md

## AC Checklist
- [x] AC 1: xxx（证据：测试 / 截图）
- [x] AC 2: xxx
- [x] AC 3: xxx

## Test Evidence
```
pnpm check          # ✅
pnpm lint           # ✅
pnpm --filter @cat-cafe/api test:public  # ✅ X passed
```

## Tradeoff
<!-- 考虑过的替代方案 -->
EOF
)"
```

**Feature PR（分阶段交付 — 有未完成 AC）**：

```bash
gh pr create --repo zts212653/clowder-ai \
  --title "feat(F115): 简短描述 — Phase A" \
  --body "$(cat <<'EOF'
## What
<!-- 改了什么，关键文件列表 -->

## Why
Refs #ISSUE_NUMBER <!-- 有未完成 AC → Refs（不会 auto-close），issue 保持 open -->
Feature Doc: docs/features/F115-xxx.md

## AC Checklist
- [x] AC 1: xxx（证据：测试 / 截图）
- [x] AC 2: xxx
- [ ] AC 3: xxx（Phase B scope）

## Remaining Scope
AC 3 将在 Phase B 交付。Issue 保持 open 直到所有 AC 完成。

## Test Evidence
```
pnpm check          # ✅
pnpm lint           # ✅
pnpm --filter @cat-cafe/api test:public  # ✅ X passed
```

## Tradeoff
<!-- 考虑过的替代方案 -->
EOF
)"
```

## Step 6.5: 注册 PR Tracking + CI 状态追踪

PR 创建后通过 `cat_cafe_register_pr_tracking` 注册。**Outbound PR 是"等 CI 绿就 merge"场景
（你是 maintainer，CI 过了用 `--admin` 合），所以必须传 `intent='merge'`** —— 这样 CI 全绿才会
唤醒你去 merge。默认 `intent='review'` 是"等 review"用的、CI-pass **静默**（F140），开源 merge-wait
路径用默认会漏掉"CI 绿了"的唤醒。

```text
# CI 过了就 merge → 注册 merge intent（不是默认 review）
cat_cafe_register_pr_tracking(repoFullName="<owner>/clowder-ai", prNumber=<N>, intent="merge")
```

| 条件 | 行为（intent=merge） |
|------|------|
| 仓库有 GitHub Actions | 系统自动轮询 CI 状态，失败/成功通知到 thread |
| CI 失败 | 收到通知（urgent）→ 查看失败检查 → 修复 → push → 等下一轮通知 |
| CI 全绿 | **被唤醒（normal → merge-gate）** → 继续 merge 流程 |
| 无 Actions / 无额度 | 跳过 CI 等待，依赖本地 `test:public` 结果 |

> 详细通知格式、去重机制、处理策略 → [refs/cicd-tracking.md](cicd-tracking.md)

## Common Mistakes

| 错误 | 后果 | 修复 |
|------|------|------|
| 自行分配 F 编号 | 与其他贡献者或上游撞号 | 去 Issue 请求 maintainer 分配 |
| 本地编号没改就提 PR | Feature Doc 引用错误的编号 | Step 3 批量替换 |
| Feature PR 没有 Feature Doc | PR 无锚，reviewer 不知道对照什么 | 先开 Issue → 等 Feature Doc merge → 再提实现 PR |
| 跳过 test:public | CI 会挂 | 本地先跑通再提 |
| PR title 没有 feat/fix 前缀 | changelog 生成不正确 | 用 conventional commit 格式 |
