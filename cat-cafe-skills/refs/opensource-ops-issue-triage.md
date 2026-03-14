# 场景 A: Issue Triage — 社区 Issue 分类与收敛

> 返回 → [opensource-ops SKILL.md](../opensource-ops/SKILL.md)

## 触发条件

- 社区用户在 clowder-ai 仓库提了新 issue
- 需要整理/收敛已有 issue

## 核心原则

> **分类基于 maintainer 独立判断，不是复读用户自述。** 用户说"我要 X 功能"时，先理解底层需求（problem），再独立判断分类和实现方式（solution）。用户提的是他认为的解决方案，maintainer 要判断的是真正的问题。不要对方要什么就给什么标签。

## Step 1: 读 Issue + 判断类型 `[clowder-ai]`

```bash
gh issue view {N} --repo zts212653/clowder-ai
```

| 类型 | 判断标准 | 标签 |
|------|---------|------|
| **Bug** | 报告了异常行为、有复现步骤 | `bug` |
| **Feature** | 请求新能力、行为变更 | `enhancement` |
| **Enhancement** | 对现有功能的小改进（非独立 feature） | `enhancement` |
| **Duplicate** | 和已有 issue 重复 | `duplicate` |
| **Question** | 使用问题、不是 bug | 回复后关闭 |

### Bug → Feature 升级

调查 bug 时发现是系统性问题（一连串 bug、需要重构）：

1. **原始 bug issue 保持 `bug` 标签** — 它是作为 bug 报告进来的
2. **开一个新的 umbrella issue**，标 `enhancement` 或 `feature:Fxxx` — 描述系统性问题和修复计划
3. **原始 bug issue 互链到新 feature issue** — 评论 "This bug is tracked as part of clowder-ai#{umbrella}"
4. 如果社区已有 PR 只修了表层 → **不要先 merge 不完善的 PR**（家规 P1：面向终态），走 Scene B「上游完整修复」路径，完整修复在新 feature issue 追踪

**一个 issue 一个主分类**，不要同时打 `bug` + `enhancement`。Bug 是入口，Feature 是出口，用两个 issue 分别追踪。

## Step 1.5: Bug 信息完备度评估 `[clowder-ai]`

**仅 bug 类 issue。** 用诊断胶囊评估报告者提供的信息是否足够启动调查：

> 评估标准 + 追问模板 → [refs/bug-diagnosis-capsule.md](../refs/bug-diagnosis-capsule.md)「社区 bug」节

| 关键栏位 | 信息充足？ | 动作 |
|---------|-----------|------|
| 1. 现象（期望 vs 实际） | ✅ | 继续 |
| 2. 证据（复现步骤 + 环境） | ❌ | 打 `needs-info` 标签 + 发追问模板 |

**信息不足时不要急着打类型标签**，先追问再判断。追问后等回复，回复后继续 Step 2+。

## Step 2: 关联检测 `[cat-cafe]` + `[clowder-ai]`

**必须做，防止重复立项。** 流程同 `feat-lifecycle` Step 0。

```bash
# [cat-cafe] 扫描现有 Feature
grep -i "{关键词}" docs/BACKLOG.md docs/features/*.md
```

| 检测结果 | 处置 |
|---------|------|
| 已有 Feature 的子任务 | `[clowder-ai]` 在 issue 评论说明，加 `feature:Fxxx` 标签 |
| 已有 Feature 的相关需求 | `[clowder-ai]` 加 `feature:Fxxx`，由 maintainer 决定合并或独立 |
| 全新独立需求 | 走 Feature 立项流程（需铲屎官拍板） |
| 太小 / 纯 enhancement | `[clowder-ai]` 保留 `enhancement`，不给 F 号 |

## Step 3: 打标签 `[clowder-ai]`

```bash
# 打标签
gh issue edit {N} --repo zts212653/clowder-ai --add-label "bug"
gh issue edit {N} --repo zts212653/clowder-ai --add-label "feature:F113"

# 查看现有标签
gh label list --repo zts212653/clowder-ai
```

标签规范详见 → [Labels 文档](./opensource-ops-labels.md)

## Step 4: 互链相关 Issue `[clowder-ai]`

如果多个 issue 相关，用评论互链：

**总单评论模板：**
```markdown
把这张单定为 F{xxx} 的总跟踪 issue，聚合整体目标和进度。

当前相关子问题：
- #{N1}: {简述}
- #{N2}: {简述}

后续具体修复统一以 #{执行子单} 为主执行入口推进。

{猫猫签名}
```

**子单评论模板：**
```markdown
标记：这张单收敛为 F{xxx} 下的具体执行 issue，对应总单 #{总单号}。

{背景说明}

如果作者愿意，欢迎直接从 fork 提 PR；我们也会在 upstream 修复中引用来源并致谢。

{猫猫签名}
```

## Step 5: 收敛 Duplicate `[clowder-ai]`

**关单评论模板：**
```markdown
感谢这份{报告/反馈}。{肯定贡献的一句话}。

为减少同一问题并行跟踪，后续收敛到 #{保留单号}，由总单 #{总单号} 统一跟踪进度。

这里作为 duplicate / superseded report 关闭；上下文和贡献信息会继续保留并在后续实现中引用。

{猫猫签名}
```

```bash
# 关闭 duplicate
gh issue close {N} --repo zts212653/clowder-ai --comment "..."
```

## Step 6: 同步到 BACKLOG（如果是新 Feature）`[cat-cafe]`

```bash
# [cat-cafe] 在 BACKLOG.md 末尾加一行
# Source 列写 community [#xx](url)
```

格式：`| F{xxx} | {名称} | spec | community | community [#{N}](url) | [F{xxx}](features/F{xxx}-{slug}.md) |`

## Step 7: 打流程状态标签 `[clowder-ai]`

Triage 完成后（已读 + 已回 + 已初判），**必须打 `triaged`**：

```bash
gh issue edit {N} --repo zts212653/clowder-ai --add-label "triaged"
```

如果需要铲屎官拍板方向/边界（Feature 类、scope 不确定）：

```bash
gh issue edit {N} --repo zts212653/clowder-ai --add-label "needs-maintainer-decision"
```

**关键区分**：
- `triaged` = "我们处理过了"（流程状态）
- `bug` / `enhancement` / `feature:Fxxx` = "它是什么"（类型分类）
- 等对方补信息时，打 `triaged` + `needs-info`，**不要急着打类型标签**
- `question` = 纯咨询（回复后可关），`needs-info` = 等补充信息（保持 open），二者不混用

过滤未处理 issue：`-label:triaged` = 还没被我们碰过。

## 签名

所有 `[clowder-ai]` 操作的评论末尾带猫猫签名，例如：`缅因猫-gpt5.4`
