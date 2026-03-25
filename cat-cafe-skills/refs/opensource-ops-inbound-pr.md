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

### 质量不达标但方向正确 — 上游完整修复

**家规 P1：面向终态。** 不在 clowder-ai 上迭代半成品，在 cat-cafe 做到位再出去。

以下三种策略按成本递增排列，根据情况选择：

---

#### 策略 A：先 Merge 社区 PR → 全量同步覆盖（推荐 ⭐ 低成本）

**适用**：社区 PR 代码质量一般但不会炸，clowder-ai 当前没有活跃用户。

1. `[clowder-ai]` 在社区 PR 评论感谢 + 说明我们会在上游完善
2. `[cat-cafe]` 走正常开发流程（`worktree` + `tdd`）做到终态
3. `[clowder-ai]` **直接 merge 社区 PR**（`gh pr merge {N} --repo zts212653/clowder-ai --squash`）
4. `[cat-cafe → clowder-ai]` 走全量 outbound sync — `rsync --delete` 会把文件覆盖成终态版本

**为什么可行**：全量同步是文件级覆盖（rsync），不是 git merge。社区 PR 的代码被 merge 后虽然短暂存在于 clowder-ai main，但下次全量同步会用我们的终态版本覆盖所有文件。**Git 历史不会丢**——贡献者的 commit 永远留在 `git log` 里，PR 显示 "Merged" 绿标，贡献者 GitHub contribution graph 有绿点。

**注意**：
- 全量同步的 `--co-author` **不要用**——co-author 挂在整个 sync commit 上语义不精确（张冠李戴）
- 社区 PR 的 merge commit 本身就精确记录了贡献者归属
- Merge 后别忘了 intake 登记（B3）

**时序**：merge 社区 PR 和全量同步的先后无所谓——rsync 只看文件内容不看 git 历史

---

#### 策略 B：Push 完善代码到社区 PR 分支 → Merge（高质量归属，中等成本）

**适用**：想让 merge 进去的代码就是终态版本，贡献者和 maintainer 的 commit 都在同一个 PR 里（类似 OpenClaw 的做法）。

1. `[cat-cafe]` 走正常开发流程做到终态
2. `[clowder-ai]` checkout 社区 PR 分支 → 把终态代码 push 上去（追加 commit）
3. `[clowder-ai]` merge 社区 PR — PR 里同时有贡献者和 maintainer 的 commit
4. 全量同步时这部分文件已在 main 上，diff 不变

**前提**：社区 PR 允许 maintainer 编辑（fork PR 需 `maintainer_can_modify: true`，同仓分支 PR 直接有权限）

**额外成本**：需要在 clowder-ai 端手动操作 checkout + cp + commit + push（约 5-10 分钟 + token）

---

#### 策略 C：关闭社区 PR → 全量同步 + Acknowledgment（最低成本，贡献者体验差）

**适用**：社区 PR 代码质量很差 / 方向偏了很多 / 贡献者不在意归属。

1. `[clowder-ai]` 在社区 PR 评论感谢 + 说明原因 → **关闭 PR（不 merge）**
2. `[clowder-ai]` 关掉重复 issue（如有）
3. `[cat-cafe]` 走正常开发流程做到终态
4. `[cat-cafe → clowder-ai]` 全量同步，commit body 里写 acknowledgment（不用 `Co-authored-by` trailer）：
   ```
   Acknowledgments:
   - Governance bootstrap card inspired by @bouillipx (clowder-ai#154)
   ```

**缺点**：贡献者看到 PR 被关闭，GitHub 上没有 "Merged" 绿标，没有 contribution 绿点。

---

#### 选择指南

| 条件 | 推荐策略 |
|------|---------|
| 社区 PR 不会破坏 clowder-ai + 没有活跃用户 | **A**（merge → 全量覆盖）|
| 想让 merge 的代码就是终态 + 有精力操作 | **B**（push 完善代码到 PR 分支）|
| 社区 PR 质量极差 / 方向错 / 安全风险 | **C**（关闭 + acknowledgment）|
| clowder-ai 有活跃用户在用 main | **B** 或 **C**（不能让半成品留在 main 上）|

## B3: Intake Gate `[cat-cafe]`

PR merge 进 clowder-ai 后，**必须做 intake 登记闭环**（即使决定不回流）。
这里的闭环不是“只 record 一笔”。
**`--record` 和 `--advance-ledger` 视为同一检查点：record 完立刻尝试 advance。**

### Step 1: Plan — 分析 PR 文件

```bash
bash scripts/intake-from-opensource.sh --pr {N} --mode=plan
```

输出会把文件分为：
- ✅ safe-cherry-pick（可直接吸收）
- ⚠️ manual-port（需人工对照 diff）
- ○ public-only（跳过）

### Step 1.5: 🛡 Inbound Brand Guard（Plan 输出有 ⚠️ 时必做）

**事故背景**：`a0c5f8ca`（absorb clowder-ai#183）在 intake 时直接覆盖了 `layout.tsx`，把 outbound sanitizer 产生的 `Clowder AI` 品牌名和精简的 icon 配置带回了家里，导致 Tab 标题变成 "Clowder AI"、favicon 消失。

**根因**：outbound 有 sanitizer（Cat Cafe → Clowder AI），但 inbound 没有反向守卫。

**规则**：Plan 输出中标记为 `🛡 BRAND GUARD` 的文件，**禁止直接 cherry-pick / copy**。必须：

1. `git diff` 对比开源仓版本和家里版本
2. 只取**逻辑改动**（新组件 import、bug fix、功能代码）
3. **保留家里的品牌值**（title、description、icons 声明、品牌名）
4. 手动合并后确认：
   ```bash
   # 快速检查：品牌值是否被覆盖
   bash scripts/intake-from-opensource.sh --validate-inbound
   ```

**Brand-sensitive 文件清单**（完整列表见 SKILL.md 原则 13）：
- `packages/web/src/app/layout.tsx` — title、description、icons、appleWebApp
- `packages/web/public/manifest.json` — name、short_name、description
- `packages/web/src/components/SplitPaneView.tsx` — h1 品牌名
- `packages/web/src/components/ChatContainerHeader.tsx` — INTERNAL_BASENAMES
- `packages/web/src/utils/api-client.ts` — CORS origins
- `packages/web/public/icons/*` — logo 文件

### Step 2: 执行吸收（如果 absorbed）

目前 V1 需要手工 cherry-pick safe 文件 + 手工 port manual 文件。
**Brand Guard 文件必须走 Step 1.5 的手工 diff-merge 路径，不能直接 cherry-pick。**

### Step 3: Record + Immediate Advance — 登记决策并立刻尝试推进门禁

```bash
bash scripts/intake-from-opensource.sh --record --pr {N} --decision absorbed
# 或: --decision public-only
# 或: --decision rejected
bash scripts/intake-from-opensource.sh --advance-ledger
```

如果 `--advance-ledger` 失败，说明**还有别的社区 PR 没登记**，不能把当前 PR 停在“已吸收但没推进水位”的半状态。
先把遗漏 PR 补 record，再重新跑 advance。

### Step 4: Sync Gate 排错 — 区分“没登记”还是“水位没推进”

如果 `sync-to-opensource.sh --dry-run` 报 ledger gate 卡住：

1. 先看 `docs/ops/opensource-intake-ledger.json` 里是否已经有对应 `target_merge_commit`
2. 如果 merge commit 已经在 `entries[]` 里，说明不是“没吸收”，而是 `last_reviewed_target_head` 没推进
3. 直接补跑：

```bash
bash scripts/intake-from-opensource.sh --advance-ledger
```

只有 merge commit 不在 ledger 里时，才说明这条社区 PR 真的还没完成 intake record。

## 完整链路

```
Issue accept → Merge Gate (B1) → Merge (B2) → Intake Plan (B3.1)
  → Cherry-pick/Port (B3.2) → Record + Immediate Advance (B3.3)
```

每一步断了都不能跳。只 record 不 advance，ledger 水位一样会卡住下次 sync。
