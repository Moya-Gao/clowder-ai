# 场景 B: Inbound PR — 社区 PR 评估 + 合入 + 吸收

> 返回 → [opensource-ops SKILL.md](../opensource-ops/SKILL.md)

## 触发条件

- 社区贡献者向 clowder-ai 提交了 PR
- 需要评估是否 merge + 是否 intake 回家

> **PR 编号引用规范**：讨论中引用 PR/issue 编号时，必须标注来源仓库。写 `clowder-ai#58` 或 `cat-cafe#120`，不要裸写 `#58`——两个仓库的编号空间不同，裸编号会混淆。**家里的 PR 编号不要出现在社区评论中。**

> **Maintainer 直接 PR 注意**：同仓分支 PR 与 fork PR 都走 Scene B，merge / intake 判定标准一致；差异只在操作权限与收尾：同仓分支可直接 push fixup，merge 后需删除 clowder-ai 源分支；fork PR 通常不能直接改对方分支，且无需删除官方仓源分支。

## B1: Merge Gate `[clowder-ai]`

**按顺序逐条检查，任一不过 = 不 merge。**
**顺序原则（家规 P3）**：先过方向再审质量——方向错的 PR 不值得花时间看代码。

### Checklist

- [ ] **① Accepted Issue**：PR 对应的 issue 存在且已被 accept
  - **"accepted" 的判定标准**：issue 有 `triaged` 标签 + 有类型标签（`bug` / `enhancement` / `feature:Fxxx`）+ state=OPEN + 没有 `needs-maintainer-decision` + 没有 `needs-info`（信息不足的 issue 不能作为 PR 依据）
  - 检查方法：`gh issue view {N} --repo zts212653/clowder-ai --json labels,state` → 有 `triaged` + 类型标签 + state=OPEN + 无 `needs-maintainer-decision` + 无 `needs-info`
  - 无 accepted issue → 请贡献者先开 issue，猫猫做 triage 后再提 PR
  - Feature 类：需确认有 F 编号（`feature:Fxxx` 标签）+ 关联检测已过
- [ ] **①-b Feat Anchor Guard（必做，防认知投毒）**：

  > **教训（2026-04-18，clowder-ai#507 讨论）**：代码注释和 PR 描述里出现过 `F340` 作为"accounts refactor 迁移期"的锚点，实际上 `docs/features/` 下**没有 F340** — 是 commit 作者把 issue `#340` 写成 `F340` 的误用，污染了家里 `packages/shared/src/types/*.ts` 和 `catalog-accounts.ts` 共 13 处注释。后来 maintainer 猫在 PR review 里又用 `pre-F340` 当决策论据，相当于引用一个不存在的员工手册条款。

  **为什么是投毒而不是小瑕疵**：家规 P4（每个概念只在一处定义）+ 真相源权威性 — `docs/features/Fxxx-*.md` 是家里知识图谱的根。伪 `Fxxx` 注释会让 reviewer / 新猫误以为"方向已拍板"，跳过方向评估；ADR/lesson/memory 在 indexing 时也会把伪锚点当实体引用。**越是"Cats & U 温度"的项目，真相源误用的扩散速度越快，因为每只猫都真的引用它。**

  **校验步骤**：

  1. 抽出 PR diff + body + linked issue body 里的所有 `F[0-9]{2,4}` 模式：
     ```bash
     { gh pr view {N} --repo zts212653/clowder-ai --json body,title --jq '.title, .body';
       gh pr diff {N} --repo zts212653/clowder-ai; } \
       | grep -oE 'F[0-9]{2,4}' | sort -u
     ```
  2. 对每个命中，验证 `docs/features/F{NNN}-*.md` 存在：
     ```bash
     for f in $(...); do
       ls docs/features/${f}-*.md 2>/dev/null >/dev/null \
         && echo "✅ $f"  || echo "❌ 伪锚点: $f"
     done
     ```
  3. 命中任一 `❌ 伪锚点` → 处理路径：

  | 锚点来源 | 处理 |
  |---------|-----|
  | PR 作者在 PR body / diff 注释里写的 | 评论请贡献者改写为 `#NNN`（issue）或删除锚点；**不以"pre-Fxxx 时代"当决策论据** |
  | 已在家里 shared types / 代码注释里散布的（历史污染） | intake 时必须校正为正确锚点（`#NNN` 或移除），不能原样 port；同时开一个 cleanup issue 扫清存量 |
  | reviewer 自己打算在论证里引用的 | 方向判断只能引用 `docs/features/*.md` 或 `docs/decisions/` 真相源；伪 Fxxx 不是论据 |

  4. ①-b fail → 停下来清锚点，**不直接进 ②**。方向五问不能建立在伪锚点上。

- [ ] **② 方向（主人翁五问）**：
  > 详细判定标准 → [refs/ownership-gate.md](./ownership-gate.md)
  - 跑主人翁五问判定卡（Q1-Q5 逐问填结论 + 证据）
  - Q1 愿景对齐 + Q2 Feature 不冲突 = 硬门（fail → DECLINE）
  - Q3 真实需求 + Q4 技术栈 fit + Q5 负债可控 = 软门
  - Feature：F 编号正确、Feature Doc 存在且 AC 对应
  - Patch：修复内容和 issue 描述一致
  - **Verdict POLITELY-DECLINE → 停止，用[话术模板](./ownership-gate.md#话术模板)回复，不进入 ②-b**
  - **Verdict NEEDS-DISCUSSION → 打 `needs-maintainer-decision`，暂停等铲屎官**
- [ ] **②-b Maintainer Reframing（user-facing PR 必填）**：
  > **教训（F154）**：社区 #391 提了 `/focus` `/ask` 命令，我们直接接受了交互形状并实现。铲屎官事后指出：社区给的是"他们偏好的解法"，不是"我们家的产品定义"。
  >
  > 社区 PR 带来新界面、新交互、新用户可见行为时，**写代码前**必须填 Reframing 卡：

  | 问题 | 填写 |
  |------|------|
  | **用户真正的问题是什么？** | （痛点，不是解法） |
  | **社区给的是：问题描述 / 机制方案 / UI 形态？** | （区分层次） |
  | **我们保留什么 / 重写什么 / 拒绝什么？** | （对照 F056 设计语言 + 相关 Feature spec） |
  | **为什么符合我们的架构画风 + 设计画风？** | （引用具体真相源） |

  - 非 user-facing PR（纯 bug fix / 内部重构）→ 跳过
  - **UI/UX Design Gate**：带来新界面或新交互的 PR，Reframing 卡必须拉视觉把关猫过一遍。不符合"温馨猫咖感"（F056）的，图纸阶段打回重塑，不进入 ③
  - Reframing 卡结论写入 Intake Intent Issue（B3 Step 0）的补充段落
- [ ] **③ 质量**（方向 + Reframing 通过后才审）：
  - CI / 测试通过
  - 代码规范（`pnpm check` + `pnpm lint`）
  - 无安全隐患（敏感路径、hardcoded secrets）
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
gh pr merge {N} --repo zts212653/clowder-ai --squash --admin
```

> **为什么 `--admin`**：clowder-ai 的 branch protection 只能通过 admin override 合入（maintainer 只有一个 GitHub 账号，无法满足多人 review 要求）。铲屎官已批准操作即可，不需要额外确认 admin 权限。

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
3. `[clowder-ai]` **直接 merge 社区 PR**（`gh pr merge {N} --repo zts212653/clowder-ai --squash --admin`）
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
这里的闭环不是”只 record 一笔”。
**`--record` 和 `--advance-ledger` 视为同一检查点：record 完立刻尝试 advance。**

**铁律：recorded ≠ absorbed-complete。** ledger 里有 record 只证明”看过了”，不证明”intake 完整”。
complete 的判定标准：Intake Intent Issue 里每个 `absorb` 文件都有对应的 commit，且 reviewer 签字确认。

### Step 0: Intake Intent Issue `[cat-cafe]` 🔴（absorbed 决策时必做）

**事故背景（clowder-ai#290 覆盖 clowder-ai#276）**：sync PR 声称 “improved intake of #276”，但只 intake 了 backend 一个文件，前端三处修复全部遗漏。根因：intake 时只看了 PR title/摘要，没有逐 file 对比。没有 reviewer 对照验收。

**规则**：决定 `absorbed` 的社区 PR，必须在 cat-cafe 建 GitHub Issue 作为 intake 的 “spec”。

> **闭环规则（新增）**：后续的 cat-cafe absorb PR 必须在 **PR body** 写同仓 auto-close 语法：`Closes #<IntakeIntentIssue>`。如果一个 absorb PR 覆盖多个 intent issue，就逐行写多个 `Closes #...`。这样 merge 时 GitHub 会自动关 issue，不会留下“代码 merged 了但 spec 还 open”的半状态。

**Issue 格式**：

```markdown
Title: intake(clowder-ai#{N}): {一句话描述}

## 社区 PR 信息
- Source: clowder-ai#{N} (fixes clowder-ai#{issue})
- 社区 PR 链接: {URL}
- 社区 PR 改动文件数: {X}

## 逐文件决策表（必填，不能留空）

| File | Source Behavior（社区想带回什么） | 决策 / 模式 | Must Preserve Home Behavior（家里必须保住什么） | Proof / Exception |
|------|----------------------------------|-------------|----------------------------------------------|-------------------|
| packages/api/src/routes/callbacks.ts | 加 invocationId 到广播 | absorb（已有） | 现有 callback auth / token 校验不能回退 | 已有测试覆盖 |
| packages/web/src/hooks/useAgentMessages.ts | ?? fallback + 去 sawStreamDataRef guard | absorb（manual-port） | 家里当前消息合并 / streaming 状态机不回退 | 补 ghost-message 回归测试 |
| packages/web/src/hooks/useSocket.ts | reconnect catch-up safety net | absorb（manual-port） | 家里现有 reconnect 去重逻辑不回退 | diff 对照 + socket 测试 |
| packages/web/.../__tests__/bubble-merge.test.ts | 新回归测试 | absorb（适配） | 测试语义等价，夹具命名按家里规范 | 测试通过 |
| README.md | 更新描述 | skip | public-only，不进入家里 | exception: public-only |

决策只允许两种：`absorb` 或 `skip(with reason)`。模式用于说明执行方式：`已有 / safe-cherry-pick / manual-port / 适配`。不能留空。

## 关联
- Fixes: clowder-ai#{issue}
- Source PR: clowder-ai#{N}
- Cat-cafe intake branch: fix/intake-clowder-{N}
```

**粒度要求**：
- `packages/**`、`scripts/**`、`cat-cafe-skills/**` → 必须逐 file
- `docs/**` → 可按”同类文件组”记录，但必须列出文件清单
- 每个文件必须 `absorb` 或 `skip(with reason)`，不能留空

**为什么逐 file**：clowder-ai#290 事故就是因为只看了摘要层面的”invocationId to callback broadcast”，没发现前端三个文件的改动未被 intake。file 级别是防遗漏的最小可靠粒度。

### Step 1: Plan — 分析 PR 文件

```bash
bash scripts/intake-from-opensource.sh --pr {N} --mode=plan
```

输出会把文件分为：
- ✅ safe-cherry-pick（可直接吸收）
- ⚠ HIGH-RISK GUARD（需 manual-port/manual-merge + preserve proof）
- ⚠️ manual-port（需人工对照 diff）
- ○ public-only（跳过）

### Step 1.1: Intake 三真相 Guard — 硬约束 + 软约束 🔴

**元认知规则**：intake 不是“把开源仓文件覆盖回家里”，而是“把 source intent replay 到当前 cat-cafe main 上”。最后结果必须同时满足：

- `Result ⊇ Source Intent`：社区 PR 想带来的行为变化已经进家
- `Result ⊇ Home Invariants`：家里 main 上已有的新功能 / bugfix / 安全边界没有被覆盖回退

**硬约束（机器可拦，违反即阻塞 merge）：**

1. **Path Guard**：absorb PR 最终 `merge diff` 的文件集合必须满足 `diff ⊆ Intake Intent Issue 文件表 + 显式 exception list`。新增测试、生成索引、review request 等合理文件也必须写进 exception list；不能靠 reviewer 人肉记忆。
2. **Overlap Guard**：同一个文件同时满足“社区 PR 改过”且“cat-cafe 当前 main 相比 source base 已有家里演化”时，禁止标为 `safe-cherry-pick`，必须升级为 `manual-port / manual-merge`。
3. **High-risk File Guard**：入口接线、route 注册、DI 参数、env registry、metric allowlist、auth/callback、sync 脚本、品牌敏感文件，即使 diff 看起来小，也默认要求 `Must Preserve Home Behavior` + proof。
   - `--mode=plan` 会自动按 `HIGH_RISK_PATTERNS` 标红这类文件；命中后不能按普通 safe-cherry-pick 处理。

**软约束（猫的思考动作，写进 Issue / review request）：**

1. 每个 `manual-port` 文件必须写三真相：`Source Behavior`、`Must Preserve Home Behavior`、`Proof`。
2. 如果猫说不清“家里必须保住什么”，不能继续吸收；先看 cat-cafe main 的同文件历史、现有测试、feature spec，再决定。
3. Reviewer 不能只说“测试绿 / 文件在”；必须检查行为等价：source intent 没漏，home invariant 没丢。

> 教训：clowder-ai#546 → cat-cafe#1375 intake 中，`index.ts` / `route-serial.ts` / `route-parallel.ts` 被 upstream 旧逻辑覆盖过，文件表层面看似合理，但同文件里的家里主线能力被回退。后续靠 reviewer 抓 P1 + 源码守卫测试才补住。这个问题不能只靠 Path Guard，必须靠 Overlap + Preserve Proof。

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

### Step 2: 执行吸收 + 提 Review（如果 absorbed）

目前 V1 需要手工 cherry-pick safe 文件 + 手工 port manual 文件。
**Brand Guard 文件必须走 Step 1.5 的手工 diff-merge 路径，不能直接 cherry-pick。**

**默认执行方式**：以 cat-cafe 当前 main 为底，把 source patch 按行为 replay 进来。只有确认没有 home-only behavior / home invariant 风险时，才允许整文件复制或机械 cherry-pick。

开 absorb PR 时，PR body 必须包含：

```md
Closes #<IntakeIntentIssue>
```

如果一个 absorb PR 吸收多条社区 PR，对应多个 Intake Intent Issue，就逐行列出多个 `Closes #...`。

完成后走 `request-review` → reviewer 按 Step 2.5 对照 Intent Issue 验收。

### Step 2.5: Intake Review Guard 🔴（absorbed 时必做）

**Intake = 小 Feature，必须有 review 验收。** Reviewer 对照 Intake Intent Issue（Step 0）逐项检查。

**Reviewer checklist**：

- [ ] Intent Issue 的逐文件决策表存在且无空行
- [ ] absorb PR 最终文件集合没有超出 Intent Issue 文件表 + 显式 exception list
- [ ] 每个标记 `absorb` 的文件都有对应的 commit/改动
- [ ] 每个标记 `skip` 的文件有合理理由
- [ ] 社区 PR 的**每个行为改变**都在 cat-cafe 复现（不只是文件在不在，还要看逻辑等价）
- [ ] 同文件 overlap / high-risk 文件已升级 `manual-port`，并写清 `Source Behavior` / `Must Preserve Home Behavior` / `Proof`
- [ ] cat-cafe main 已有行为没有被 upstream 旧版本覆盖回退；必要时有 zero-diff 对照、源码守卫测试或 targeted regression test
- [ ] Brand Guard 文件（如有）已走 Step 1.5 手工 diff-merge
- [ ] Review 覆盖 absorb PR **当前 HEAD SHA**；如果 review 后又 rebase / fixup / regenerate feature index，reviewer 已显式确认“放行延续到新 SHA”或已重新 review

**不过这个 gate = 不能 Record + Advance。** Reviewer 放行后才能执行 Step 3 (Record)。

**Reviewer 必须在 GitHub PR 上留 formal review comment**：聊天里口头放行不算闭环。Reviewer 本人必须在 absorb PR 页面留一条包含完整 checklist 的 review comment（`gh pr comment`），author 不得代记。**不要用 `gh pr review --approve`**——所有猫猫共享同一个 GitHub 账号，self-approve 永远会报错，白费 token。review comment 就是标准路径，不是降级方案。（教训：cat-cafe#941 reviewer 只在 thread 里放行，PR `reviews=[]`，事后由 author 补 comment 才补救审计留痕。）

**Reviewer 匹配**：和内部 PR 一样，跨 family 优先、同一个体不能 review 自己的 intake。

**Review continuity（新增硬规则）**：

- review 不是布尔量，是 **`reviewed_sha -> current_head_sha`** 的绑定关系
- absorb PR 进入 merge-gate 前，author 必须带着当前 HEAD 去做 handoff：
  - `当前 HEAD: {short_sha}`
  - `review 覆盖: yes/no`
  - 如果 `no`：说明是“请求延续到新 SHA”还是“请求重审”
- 只要 HEAD 变化，就不能默认沿用旧 review
  - 非行为性 delta（例如 `docs/features/index.json` regenerate、纯 rebase 无代码差异）→ 允许 reviewer **显式延续** 到新 SHA
  - 行为性 delta（代码 / 测试 / 配置 / 接口变化）→ 必须重新 review

> 教训：cat-cafe#1239 在 reviewer formal 放行后，merge-gate 又因为 rebase + feature index refresh 生成了新 HEAD `2c7351b6`。如果没有 reviewer 对新 SHA 的显式延续，这个 absorb PR 就会带着“旧 review 覆盖新 commit”的口径漏洞进入 merge。

> 教训：clowder-ai#276 的 backend 部分（callbacks.ts invocationId）cat-cafe 已独立实现，
> intake 猫看到就标了”已有”——但没人验证前端三个文件是否也”已有”。
> 如果当时有一只 reviewer 对照逐 file 表检查，一眼就能发现 useAgentMessages.ts 和 useSocket.ts 缺失。

### Step 3: Record + Immediate Advance — 登记决策并立刻尝试推进门禁

（Intake Review Guard 通过后才执行此步。）

```bash
bash scripts/intake-from-opensource.sh --record --pr {N} --decision absorbed \
  --intent-issue {cat-cafe-intent-issue-id} \
  --absorb-pr {cat-cafe-absorb-pr-id} \
  --review-proof {github-review-url-or-local-proof-file}
# 或: --decision public-only
# 或: --decision rejected
bash scripts/intake-from-opensource.sh --advance-ledger
```

`--review-proof` 不是“有链接就行”：
- URL 证据必须指向同一个 absorb PR（`cat-cafe#<absorb-pr>`）的 `#issuecomment-*` / `#pullrequestreview-*` / `#discussion_r*`
- 且证据内容必须显式覆盖 absorb PR 当前 HEAD（写出当前 SHA，或 review payload 的 `commit_id` = 当前 HEAD）
- 本地文件证据也必须包含当前 HEAD SHA（全长或 short SHA）

如果 `--advance-ledger` 失败，说明**还有别的社区 PR 没登记**，不能把当前 PR 停在”已吸收但没推进水位”的半状态。
先把遗漏 PR 补 record，再重新跑 advance。

### Step 3.5: Merge Absorb PR + Close Intake Intent Issue

absorb PR merge 后，Intake Intent Issue 必须同时闭环：

- 推荐：依赖 PR body 里的 `Closes #<IntakeIntentIssue>` 自动关单
- 兜底：如果 PR 已 merge 但 issue 仍 open，必须立刻手工关闭并留言回链 merge PR / merge commit

**为什么这步不能省**：`outbound-sync` 的 Community Diff Guard 已经把“intake issue 已 closed”当成 absorbed-complete 的信号之一。issue 留在 open，会把已完成 intake 伪装成半状态。

### Step 4: Sync Gate 排错 — 区分”没登记”还是”水位没推进”

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
Issue accept → Merge Gate (B1):
  ① Accepted Issue → ② 方向（主人翁五问）
  → ②-b Maintainer Reframing（user-facing 必填）+ UI/UX Design Gate
  → ③ 质量 → ④ Intake 预判
→ Merge (B2)
  → Intake Intent Issue (B3.0) → Plan (B3.1) → Brand Guard (B3.1.5)
  → Execute Absorb (B3.2) → Intake Review Guard (B3.2.5)
  → Record + Advance (B3.3)
  → Merge Absorb PR + Close Intent Issue (B3.5)
```

每一步断了都不能跳。
- 没有 Intent Issue = 没有 spec = reviewer 无法验收
- reviewer 没签字 = 不能 Record
- 只 record 不 advance = ledger 水位卡住下次 sync
- absorb PR merge 后 issue 仍 open = intake 还没真正闭环
