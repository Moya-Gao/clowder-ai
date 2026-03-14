# 场景 B: Inbound PR — 社区 PR 评估 + 合入 + 吸收

> 返回 → [opensource-ops SKILL.md](../opensource-ops/SKILL.md)

## 触发条件

- 社区贡献者向 clowder-ai 提交了 PR
- 需要评估是否 merge + 是否 intake 回家

> **PR 编号引用规范**：讨论中引用 PR/issue 编号时，必须标注来源仓库。写 `clowder-ai#58` 或 `cat-cafe#120`，不要裸写 `#58`——两个仓库的编号空间不同，裸编号会混淆。**家里的 PR 编号不要出现在社区评论中。**

> **Maintainer 直接 PR 注意**：同仓分支 PR 与 fork PR 都走 Scene B，merge / intake 判定标准一致；差异只在操作权限与收尾：同仓分支可直接 push fixup，merge 后需删除 clowder-ai 源分支；fork PR 通常不能直接改对方分支，且无需删除官方仓源分支。

## B1: Merge Gate `[clowder-ai]`

**按顺序逐条检查，任一不过 = 不 merge：**

### Checklist

- [ ] **① Accepted Issue**：PR 对应的 issue 存在且已被 accept
  - **"accepted" 的判定标准**：issue 有 `triaged` 标签 + 有类型标签（`bug` / `enhancement` / `feature:Fxxx`）+ state=OPEN + 没有 `needs-maintainer-decision` + 没有 `needs-info`（信息不足的 issue 不能作为 PR 依据）
  - 检查方法：`gh issue view {N} --repo zts212653/clowder-ai --json labels,state` → 有 `triaged` + 类型标签 + state=OPEN + 无 `needs-maintainer-decision` + 无 `needs-info`
  - 无 accepted issue → 请贡献者先开 issue，猫猫做 triage 后再提 PR
  - Feature 类：需确认有 F 编号（`feature:Fxxx` 标签）+ 关联检测已过
- [ ] **② 质量**：
  - CI / 测试通过
  - 代码规范（`pnpm check` + `pnpm lint`）
  - 无安全隐患（敏感路径、hardcoded secrets）
- [ ] **③ 方向**：
  - Feature：F 编号正确、Feature Doc 存在且 AC 对应
  - Patch：修复内容和 issue 描述一致
  - 不和我们正在做的工作冲突
- [ ] **④ Intake 预判**：

```bash
# 预判 PR 文件的 intake 分类
# 看 PR 改了哪些文件，对照 intake 脚本的分类逻辑：
gh pr view {N} --repo zts212653/clowder-ai --json files
```

| 预判结果 | 含义 | 后续 |
|---------|------|------|
| `absorbed` | 改的是 packages/** 等共享代码，值得回流 | merge bar 更高（影响两边） |
| `public-only` | 改的是 README/CONTRIBUTING/模板 | 可以 merge，不回流 |
| `manual-port` | 改的是 docs/scripts/skills（有 outbound transform） | 需人工 port，评估成本 |

## B2: Merge 执行 `[clowder-ai]`

### Patch 类 — 猫猫可自主 merge

**4 条件同时满足才可自主 merge：**
1. 有 accepted issue
2. 只改 `safe-cherry-pick` 或 `public-only` 路径
3. 公开仓 CI / 测试过
4. 不涉及 sync 脚本 / ledger / 边界规则 / 安全

```bash
gh pr merge {N} --repo zts212653/clowder-ai --squash
```

### Feature 类 / 碰到 manual-port / 涉及工具链 — 升级铲屎官

```
@lysander
社区 PR #{N} 需要你拍板是否 merge：
- Issue: #{issue}
- 类型: Feature / manual-port / 涉及工具链
- Intake 预判: {absorbed / manual-port}
- 我的建议: {merge / 不 merge + 理由}
```

### 质量不达标但方向正确 — 上游完整修复（推荐）

**家规 P1：面向终态。** 不要先 merge 不完善的 PR 再修——那是脚手架，不是终态。直接做到位一次 sync 出去。

1. `[clowder-ai]` 在社区 PR 评论："感谢贡献！我们会基于你的方案在上游完成完整修复。" **关闭 PR（不 merge）**
2. `[clowder-ai]` 关掉重复 issue（如有）
3. `[cat-cafe]` 走正常开发流程（`worktree` + `tdd`）：完整修复代码 + 文档 + 测试，**做到终态**
4. `[cat-cafe → clowder-ai]` 走 **Scene D (Outbound Sync)** 同步到开源仓，PR closes 原 issue
5. commit message 加 `Co-authored-by: {原作者}` — **尊重社区贡献**

又快又不失礼。贡献者的方案被采纳，由我们完成终态实现后一次性发布。

## B3: Intake Gate `[cat-cafe]`

PR merge 进 clowder-ai 后，**必须做 intake 登记**（即使决定不回流）。

### Step 1: Plan — 分析 PR 文件

```bash
bash scripts/intake-from-opensource.sh --pr {N} --mode=plan
```

输出会把文件分为：
- ✅ safe-cherry-pick（可直接吸收）
- ⚠️ manual-port（需人工对照 diff）
- ○ public-only（跳过）

### Step 2: 执行吸收（如果 absorbed）

目前 V1 需要手工 cherry-pick safe 文件 + 手工 port manual 文件。

### Step 3: Record — 登记决策

```bash
bash scripts/intake-from-opensource.sh --record --pr {N} --decision absorbed
# 或: --decision public-only
# 或: --decision rejected
```

### Step 4: Advance Ledger — 推进门禁

```bash
bash scripts/intake-from-opensource.sh --advance-ledger
```

如果有未登记的社区 commit，会报错并列出遗漏的 PR。

## 完整链路

```
Issue accept → Merge Gate (B1) → Merge (B2) → Intake Plan (B3.1)
  → Cherry-pick/Port (B3.2) → Record (B3.3) → Advance Ledger (B3.4)
```

每一步断了都不能跳——不 record 就无法 advance，无法 advance 就卡住下次 sync。
